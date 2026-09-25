/** Aggregations used by the owner dashboard and the Excel exports. */
import { aging, CONSIGNMENT_STATUS, FREIGHT_STATUS, round, TRIP_STATUS, UNITS } from '@feather/shared';
import { Consignment, CreditOverride, Customer, Invoice, Material, Trip } from '@/models/index.js';
import { customerCredit } from '@/services/credit.js';
import { bookStock } from '@/services/stock.js';

/** Convert any quantity to MT (bags use the material's bag weight). */
const toTons = (qty, unit, bagWeightKg = 50) => (unit === UNITS.BAG ? (qty * bagWeightKg) / 1000 : qty);

export async function materialWeights() {
  const materials = await Material.find({}, 'bagWeightKg').lean();
  return new Map(materials.map((m) => [String(m._id), m.bagWeightKg ?? 50]));
}

/** Tonnage sitting in each stage of the chain right now. */
export async function pipeline() {
  const weights = await materialWeights();
  const bucket = () => ({ tons: 0, bags: 0, count: 0 });
  const out = { onRailOrSea: bucket(), atSidingOrPort: bucket(), onRoad: bucket(), inYards: bucket() };
  const add = (b, qty, unit, material) => {
    b.tons = round(b.tons + toTons(qty, unit, weights.get(String(material))));
    if (unit === UNITS.BAG) b.bags += qty;
    b.count += 1;
  };

  const consignments = await Consignment.find({ status: { $in: [CONSIGNMENT_STATUS.EXPECTED, CONSIGNMENT_STATUS.PLACED] } }, 'status declaredQty liftedQty unit material').lean();
  for (const c of consignments) {
    if (c.status === CONSIGNMENT_STATUS.EXPECTED) add(out.onRailOrSea, c.declaredQty, c.unit, c.material);
    else add(out.atSidingOrPort, Math.max(0, c.declaredQty - c.liftedQty), c.unit, c.material);
  }
  const onRoad = await Trip.find({ status: TRIP_STATUS.IN_TRANSIT }, 'loading.qty unit material').lean();
  for (const t of onRoad) add(out.onRoad, t.loading.qty, t.unit, t.material);
  const stock = await bookStock();
  for (const s of stock) {
    if (s.location?.type === 'stockyard' && s.grade !== 'rejected' && s.qty > 0) add(out.inYards, s.qty, s.unit, s.material._id);
  }
  out.inYards.count = new Set(stock.map((s) => String(s.location?._id))).size;
  return out;
}

/** Damage / shrinkage league table for transporters over the last N days. */
export async function transporterScorecard(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  return Trip.aggregate([
    { $match: { status: TRIP_STATUS.RECEIVED, 'receipt.at': { $gte: since } } },
    {
      $group: {
        _id: '$transporter',
        trips: { $sum: 1 },
        loadedTons: { $sum: '$loading.net' },
        receivedTons: { $sum: '$receipt.net' },
        lossTons: { $sum: { $max: [0, { $subtract: ['$loading.net', '$receipt.net'] }] } },
        lockedTrips: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: [{ $setIntersection: ['$flags', ['transit_loss', 'weight_gain', 'bag_damage', 'bag_shortage', 'bag_excess', 'tare_mismatch']] }, []] } }, 0] }, 1, 0] } },
        deductions: { $sum: '$freight.deduction' },
        billedBags: { $sum: { $ifNull: ['$receipt.bags.invoice', 0] } },
        damagedBags: { $sum: { $add: [{ $ifNull: ['$receipt.bags.burst', 0] }, { $ifNull: ['$receipt.bags.lumpy', 0] }, { $ifNull: ['$receipt.bags.underweight', 0] }] } },
        missingBags: { $sum: { $ifNull: ['$receipt.bags.missing', 0] } },
      },
    },
    { $lookup: { from: 'transporters', localField: '_id', foreignField: '_id', as: 't' } },
    {
      $project: {
        _id: 0,
        transporter: { _id: '$_id', name: { $arrayElemAt: ['$t.name', 0] } },
        trips: 1,
        loadedTons: { $round: ['$loadedTons', 3] },
        lossTons: { $round: ['$lossTons', 3] },
        lossPct: { $cond: [{ $gt: ['$loadedTons', 0] }, { $round: [{ $multiply: [{ $divide: ['$lossTons', '$loadedTons'] }, 100] }, 2] }, 0] },
        lockedTrips: 1,
        problemRatePct: { $round: [{ $multiply: [{ $divide: ['$lockedTrips', '$trips'] }, 100] }, 1] },
        deductions: { $round: ['$deductions', 2] },
        billedBags: 1,
        damagedBags: 1,
        missingBags: 1,
        bagDamagePct: { $cond: [{ $gt: ['$billedBags', 0] }, { $round: [{ $multiply: [{ $divide: [{ $add: ['$damagedBags', '$missingBags'] }, '$billedBags'] }, 100] }, 2] }, 0] },
      },
    },
    { $sort: { problemRatePct: -1, lossPct: -1 } },
  ]);
}

export async function freightSummary() {
  const rows = await Trip.aggregate([
    { $match: { 'freight.status': { $in: [FREIGHT_STATUS.LOCKED, FREIGHT_STATUS.READY] } } },
    { $group: { _id: '$freight.status', count: { $sum: 1 }, balance: { $sum: '$freight.balance' }, deduction: { $sum: '$freight.deduction' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, { count: r.count, balance: round(r.balance, 2), deduction: round(r.deduction, 2) }]));
}

/** Credit position and ageing for every active customer, blocked ones first. */
export async function creditOverview() {
  const customers = await Customer.find({ active: true }).sort({ name: 1 }).lean();
  const openInvoices = await Invoice.find({ $expr: { $gt: ['$amount', '$paidAmount'] } }, 'customer amount paidAmount invoiceDate').lean();
  const byCustomer = Object.groupBy(openInvoices, (i) => String(i.customer));
  const overrides = await CreditOverride.find({ revokedAt: null, validUntil: { $gt: new Date() }, $expr: { $lt: ['$uses', '$maxUses'] } }).lean();
  const items = await Promise.all(
    customers.map(async (c) => ({
      customer: { _id: c._id, name: c.name },
      credit: await customerCredit(c),
      aging: aging(byCustomer[String(c._id)] ?? []),
      override: overrides.find((o) => String(o.customer) === String(c._id)) ?? null,
    })),
  );
  return items.sort((a, b) => Number(b.credit.blocked) - Number(a.credit.blocked) || b.credit.exposure - a.credit.exposure);
}
