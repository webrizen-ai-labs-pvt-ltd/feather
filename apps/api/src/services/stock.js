/**
 * Stock ledger. Every change is a StockMovement row; book stock = sum of rows.
 *
 * Lots: each row also carries the shipment (lot) the stock arrived in, so stock can be shown per
 * shipment with its age, and dispatches take the oldest shipment first (first in, first out).
 */
import mongoose from 'mongoose';
import { fifoOrder, istDayCode, MATERIAL_KINDS, NO_LOT, round, settleLots, shelfLife, STOCK_GRADES, stockIdFor, takeFifo } from '@feather/shared';
import { Consignment, Counter, Location, Material, StockLot, StockMovement } from '@/models/index.js';
import { getSettings } from '@/services/settings.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const UNTAGGED = 'untagged';
/** Lot key of a row: its shipment id, NO_LOT, or UNTAGGED for rows saved before lots were tracked. */
const rowLotKey = { $cond: [{ $eq: [{ $type: '$lot' }, 'missing'] }, UNTAGGED, { $ifNull: ['$lot', NO_LOT] }] };
const lotValue = (key) => (key === NO_LOT ? null : key === UNTAGGED ? undefined : key);

const lotKeyOf = (location, material, lot) => `${location}:${material}:${lot ?? NO_LOT}`;

/**
 * Stock ID of a lot at a warehouse, made the first time its stock arrives there:
 * ddmmyyyy (arrival day, India time) + running number for that day across all warehouses.
 */
export async function ensureStockLot({ location, material, lot = null, at = new Date() }) {
  const key = { location, material, lot: lot ?? null };
  const found = await StockLot.findOne(key, 'stockId').lean();
  if (found) return found.stockId;
  const { seq } = await Counter.findOneAndUpdate({ _id: `STK-${istDayCode(at)}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  try {
    return (await StockLot.create({ ...key, stockId: stockIdFor(at, seq), firstInAt: at })).stockId;
  } catch (err) {
    // Two trucks of the same lot received at the same moment: the other one made it first.
    if (err.code === 11000) return (await StockLot.findOne(key, 'stockId').lean())?.stockId;
    throw err;
  }
}

/** stockId by lotKeyOf(location, material, lot) for the given lots. */
async function stockIdMap(keys) {
  if (!keys.length) return new Map();
  const docs = await StockLot.find({ $or: keys.map(({ location, material, lot }) => ({ location, material, lot: lot ?? null })) }, 'stockId location material lot').lean();
  return new Map(docs.map((d) => [lotKeyOf(d.location, d.material, d.lot), d.stockId]));
}

/**
 * One stock row. lot: shipment id, null = no shipment, undefined = leave unmarked
 * (only when putting back rows that were saved unmarked). Stock coming in gives its lot a stock ID.
 */
export async function move({ location, material, unit, qty, grade = STOCK_GRADES.PRIME, reason, lot, trip, stockCount, note, by }) {
  if (!qty) return null;
  const row = { location, material, unit, qty: round(qty), grade, reason, trip, stockCount, note, by };
  if (lot !== undefined) row.lot = lot;
  const doc = await StockMovement.create(row);
  if (row.qty > 0 && lot !== undefined) await ensureStockLot({ location, material, lot, at: doc.createdAt });
  return doc;
}

export async function bookQty(location, material, grade = STOCK_GRADES.PRIME) {
  const [row] = await StockMovement.aggregate([
    { $match: { location: oid(location), material: oid(material), grade } },
    { $group: { _id: null, qty: { $sum: '$qty' } } },
  ]);
  return round(row?.qty ?? 0);
}

/** Book stock for every location / material / grade. */
export function bookStock(match = {}) {
  return StockMovement.aggregate([
    { $match: match },
    { $group: { _id: { location: '$location', material: '$material', grade: '$grade' }, qty: { $sum: '$qty' }, unit: { $first: '$unit' } } },
    { $lookup: { from: 'locations', localField: '_id.location', foreignField: '_id', as: 'location' } },
    { $lookup: { from: 'materials', localField: '_id.material', foreignField: '_id', as: 'material' } },
    {
      $project: {
        _id: 0,
        location: { $arrayElemAt: ['$location', 0] },
        material: { $arrayElemAt: ['$material', 0] },
        grade: '$_id.grade',
        qty: { $round: ['$qty', 3] },
        unit: 1,
      },
    },
    { $project: { 'location._id': 1, 'location.name': 1, 'location.type': 1, 'material._id': 1, 'material.name': 1, 'material.unit': 1, grade: 1, qty: 1, unit: 1 } },
    { $sort: { 'location.name': 1, 'material.name': 1, grade: 1 } },
  ]);
}

/**
 * Rows with their lot worked out. Rows saved before lots were tracked: a truck received at the
 * warehouse still names its shipment, so those get their lot from the trip; the rest stay UNTAGGED.
 */
const LOT_STAGES = [
  { $lookup: { from: 'trips', localField: 'trip', foreignField: '_id', as: 't', pipeline: [{ $project: { consignment: 1, destination: 1 } }] } },
  { $set: { t: { $first: '$t' } } },
  {
    $set: {
      lotKey: {
        $switch: {
          branches: [
            { case: { $ne: [{ $type: '$lot' }, 'missing'] }, then: { $ifNull: ['$lot', NO_LOT] } },
            { case: { $and: [{ $eq: ['$location', '$t.destination'] }, '$t.consignment'] }, then: '$t.consignment' },
          ],
          default: UNTAGGED,
        },
      },
    },
  },
];

/**
 * Balance of each lot per location / material / grade, oldest shipment first within each group.
 * Every group's lots add up to its book stock.
 */
export async function lotBalances(match = {}) {
  const groups = await StockMovement.aggregate([
    { $match: match },
    ...LOT_STAGES,
    {
      $group: {
        _id: { location: '$location', material: '$material', grade: '$grade', lot: '$lotKey' },
        qty: { $sum: '$qty' },
        receivedQty: { $sum: { $cond: [{ $eq: ['$reason', 'receipt'] }, '$qty', 0] } },
        movedQty: { $sum: { $cond: [{ $in: ['$reason', ['dispatch', 'cancel']] }, '$qty', 0] } },
        firstInAt: { $min: { $cond: [{ $gt: ['$qty', 0] }, '$createdAt', null] } },
        lastInAt: { $max: { $cond: [{ $gt: ['$qty', 0] }, '$createdAt', null] } },
        unit: { $first: '$unit' },
      },
    },
  ]);

  const shipmentIds = [...new Set(groups.map((g) => g._id.lot).filter((l) => l instanceof mongoose.Types.ObjectId).map(String))];
  const shipments = await Consignment.find({ _id: { $in: shipmentIds } }, 'referenceType referenceNo mode status placedAt manufacturedAt invoiceNo createdAt declaredQty unit seller supplier')
    .populate('seller', 'name')
    .lean();
  const shipmentById = new Map(shipments.map((s) => [String(s._id), s]));

  const buckets = new Map();
  for (const g of groups) {
    const k = `${g._id.location}:${g._id.material}:${g._id.grade}`;
    if (!buckets.has(k)) buckets.set(k, { location: g._id.location, material: g._id.material, grade: g._id.grade, unit: g.unit, lots: [], untagged: 0 });
    const b = buckets.get(k);
    if (g._id.lot === UNTAGGED) {
      b.untagged += g.qty;
      b.untaggedFirstInAt = g.firstInAt;
      continue;
    }
    const key = g._id.lot === NO_LOT ? NO_LOT : String(g._id.lot);
    const shipment = shipmentById.get(key) ?? null;
    b.lots.push({
      key,
      qty: g.qty,
      receivedQty: round(g.receivedQty),
      // Rows other than receipts and dispatches: count adjustments and owner corrections.
      adjustedQty: round(g.qty - g.receivedQty - g.movedQty),
      firstInAt: g.firstInAt,
      lastInAt: g.lastInAt,
      receivedAt: shipment?.placedAt ?? g.firstInAt,
      manufacturedAt: shipment?.manufacturedAt ?? null,
      // First-in-first-out order: oldest manufacturing date first (arrival when it was not entered).
      // NO_LOT has no date so it sorts first: it is stock from before tracking.
      arrivedAt: key === NO_LOT ? null : (shipment?.manufacturedAt ?? shipment?.placedAt ?? g.firstInAt),
      shipment,
    });
  }

  const out = [];
  for (const b of buckets.values()) {
    for (const l of settleLots(b.lots, round(b.untagged))) {
      const receivedQty = l.receivedQty ?? 0;
      const adjustedQty = l.adjustedQty ?? 0;
      const firstInAt = [l.firstInAt, l.key === NO_LOT ? b.untaggedFirstInAt : null].filter(Boolean).sort((x, y) => x - y)[0] ?? null;
      out.push({
        location: b.location,
        material: b.material,
        grade: b.grade,
        unit: b.unit,
        lot: l.key === NO_LOT ? null : l.key,
        shipment: l.shipment ?? null,
        qty: l.qty,
        receivedQty,
        adjustedQty,
        // Whatever left the lot besides adjustments (includes old dispatches saved without a lot).
        sentQty: round(receivedQty + adjustedQty - l.qty),
        firstInAt,
        lastInAt: l.lastInAt ?? null,
        arrivedAt: l.receivedAt ?? firstInAt,
        manufacturedAt: l.manufacturedAt ?? null,
        // Shelf life runs from the date of manufacturing; arrival only when that date is missing.
        startedOn: l.manufacturedAt ?? l.receivedAt ?? firstInAt,
      });
    }
  }
  return out;
}

const groupMatch = (location, material, grade) => ({ location: oid(location), material: oid(material), grade });

/** Lots of one location / material / grade, oldest first, as { key, qty } for takeFifo. */
async function fifoLots(location, material, grade) {
  const lots = await lotBalances(groupMatch(location, material, grade));
  return lots.map((l) => ({ key: l.lot ?? NO_LOT, qty: l.qty, arrivedAt: l.lot ? l.startedOn : null }));
}

/**
 * Takes stock out, oldest shipment first. Anything the lots cannot cover goes out with no lot
 * (shows as negative stock, so the owner sees it). Returns [{ lot, qty }].
 */
export async function issueFifo({ location, material, unit, grade = STOCK_GRADES.PRIME, qty, reason, trip, stockCount, note, by }) {
  if (!(qty > 0)) return [];
  const { takes, short } = takeFifo(await fifoLots(location, material, grade), qty);
  if (short) {
    const none = takes.find((t) => t.key === NO_LOT);
    if (none) none.qty = round(none.qty + short);
    else takes.push({ key: NO_LOT, qty: short });
  }
  for (const t of takes) {
    await move({ location, material, unit, grade, qty: -t.qty, reason, lot: lotValue(t.key), trip, stockCount, note, by });
  }
  return takes.map((t) => ({ lot: lotValue(t.key), qty: t.qty }));
}

/** Adds stock found in a count to the oldest lot still holding stock (shelf life is never stretched). */
export async function addToOldestLot({ location, material, unit, grade = STOCK_GRADES.PRIME, qty, reason, stockCount, note, by }) {
  if (!(qty > 0)) return null;
  const lots = await fifoLots(location, material, grade);
  const target = lots.find((l) => l.qty > 0) ?? lots.at(-1);
  return move({ location, material, unit, grade, qty, reason, lot: target ? lotValue(target.key) : null, stockCount, note, by });
}

/**
 * Puts back stock a trip took out of a warehouse, into the same lots.
 * qty = how much (default: everything still out). Partial returns go to the newest lot first.
 */
export async function returnToLots({ trip, location, material, unit, grade = STOCK_GRADES.PRIME, qty, reason, by }) {
  const rows = await StockMovement.aggregate([
    { $match: { trip: oid(trip), location: oid(location), grade } },
    { $group: { _id: rowLotKey, qty: { $sum: '$qty' } } },
  ]);
  const taken = rows.filter((r) => r.qty < 0).map((r) => ({ key: r._id === NO_LOT || r._id === UNTAGGED ? r._id : String(r._id), qty: round(-r.qty) }));
  const shipments = await Consignment.find({ _id: { $in: taken.filter((t) => t.key !== NO_LOT && t.key !== UNTAGGED).map((t) => t.key) } }, 'manufacturedAt placedAt createdAt').lean();
  const arrival = new Map(shipments.map((s) => [String(s._id), s.manufacturedAt ?? s.placedAt ?? s.createdAt]));
  const newestFirst = fifoOrder(taken.map((t) => ({ ...t, arrivedAt: arrival.get(t.key) ?? null }))).reverse();

  let left = qty === undefined ? Infinity : round(qty);
  const returned = [];
  for (const t of newestFirst) {
    if (left <= 0) break;
    const back = round(Math.min(t.qty, left));
    await move({ location, material, unit, grade, qty: back, reason, lot: lotValue(t.key), trip, by });
    returned.push({ lot: lotValue(t.key), qty: back });
    left = round(left - back);
  }
  // Nothing on record to put back (should not happen): return it with no lot so totals stay right.
  if (Number.isFinite(left) && left > 0) await move({ location, material, unit, grade, qty: left, reason, lot: null, trip, by });
  return returned;
}

/** Shipments a trip's stock came from: [{ lot, shipment, qty }]. */
export async function tripLots(tripId) {
  const rows = await StockMovement.aggregate([
    { $match: { trip: oid(tripId) } },
    ...LOT_STAGES,
    { $group: { _id: { lot: '$lotKey', location: '$location', material: '$material' }, qty: { $sum: '$qty' } } },
  ]);
  const ids = rows.map((r) => r._id.lot).filter((l) => l instanceof mongoose.Types.ObjectId);
  const shipments = new Map((await Consignment.find({ _id: { $in: ids } }, 'referenceType referenceNo mode placedAt manufacturedAt').lean()).map((s) => [String(s._id), s]));
  const lotOf = (r) => (r._id.lot === NO_LOT || r._id.lot === UNTAGGED ? null : r._id.lot);
  const stockIds = await stockIdMap(rows.filter((r) => r._id.lot !== UNTAGGED).map((r) => ({ location: r._id.location, material: r._id.material, lot: lotOf(r) })));
  return rows
    .filter((r) => r.qty)
    .map((r) => ({
      lot: lotOf(r),
      stockId: stockIds.get(lotKeyOf(r._id.location, r._id.material, lotOf(r))) ?? null,
      shipment: shipments.get(String(r._id.lot)) ?? null,
      qty: round(r.qty),
    }));
}

/**
 * Stock per shipment for the inventory screen: one row per warehouse / product / shipment with the
 * quantity left in each grade, age and shelf life (from the shipment's date of manufacturing), and
 * its place in the first-in-first-out queue (oldest manufactured first).
 */
/** owner = include owner-only shipment fields (seller, seller's invoice number). */
export async function stockLots({ location, material, owner = false } = {}) {
  const match = {};
  if (location) match.location = oid(location);
  if (material) match.material = oid(material);
  const [balances, settings] = await Promise.all([lotBalances(match), getSettings()]);
  const [locations, materials] = await Promise.all([
    Location.find({ _id: { $in: [...new Set(balances.map((b) => String(b.location)))] } }, 'name type').lean(),
    Material.find({ _id: { $in: [...new Set(balances.map((b) => String(b.material)))] } }, 'name unit kind').lean(),
  ]);
  const locById = new Map(locations.map((l) => [String(l._id), l]));
  const matById = new Map(materials.map((m) => [String(m._id), m]));

  const rows = new Map();
  for (const b of balances) {
    const k = `${b.location}:${b.material}:${b.lot ?? NO_LOT}`;
    if (!rows.has(k)) {
      const s = b.shipment;
      rows.set(k, {
        key: k,
        location: locById.get(String(b.location)) ?? { _id: b.location, name: '—' },
        material: matById.get(String(b.material)) ?? { _id: b.material, name: '—' },
        unit: b.unit,
        lot: b.lot,
        shipment: s && {
          _id: s._id,
          referenceType: s.referenceType,
          referenceNo: s.referenceNo,
          mode: s.mode,
          status: s.status,
          placedAt: s.placedAt,
          manufacturedAt: s.manufacturedAt,
          ...(owner ? { seller: s.seller?.name ?? s.supplier, invoiceNo: s.invoiceNo } : {}),
        },
        arrivedAt: b.arrivedAt,
        manufacturedAt: b.manufacturedAt,
        startedOn: b.startedOn,
        firstInAt: b.firstInAt,
        lastInAt: b.lastInAt,
        qty: { prime: 0, seconds: 0, rejected: 0 },
        receivedQty: 0,
        sentQty: 0,
        adjustedQty: 0,
      });
    }
    const r = rows.get(k);
    r.qty[b.grade] = round(r.qty[b.grade] + b.qty);
    r.receivedQty = round(r.receivedQty + b.receivedQty);
    r.sentQty = round(r.sentQty + b.sentQty);
    r.adjustedQty = round(r.adjustedQty + b.adjustedQty);
    if (b.firstInAt && (!r.firstInAt || b.firstInAt < r.firstInAt)) r.firstInAt = b.firstInAt;
    if (b.lastInAt && (!r.lastInAt || b.lastInAt > r.lastInAt)) r.lastInAt = b.lastInAt;
    if (!r.arrivedAt || (b.arrivedAt && b.arrivedAt < r.arrivedAt)) r.arrivedAt = b.arrivedAt ?? r.arrivedAt;
    if (!r.startedOn || (b.startedOn && b.startedOn < r.startedOn)) r.startedOn = b.startedOn ?? r.startedOn;
  }

  const now = new Date();
  const items = [...rows.values()]
    .map((r) => {
      r.totalQty = round(r.qty.prime + r.qty.seconds + r.qty.rejected);
      // Shelf life counts for bagged cement only; sand and aggregate show their age.
      const days = r.material.kind === MATERIAL_KINDS.BAGGED ? settings.shelfLifeDays : 0;
      // Counted from the date of manufacturing. shelfFrom says which date was used, so a shipment
      // saved without one can be spotted and fixed.
      r.shelfFrom = r.manufacturedAt ? 'manufactured' : 'arrived';
      r.shelf = shelfLife({ startedOn: r.startedOn, shelfLifeDays: days, warnDays: settings.shelfLifeWarnDays, now });
      return r;
    })
    .filter((r) => r.totalQty !== 0);

  const stockIds = await stockIdMap(items.map((r) => ({ location: r.location._id, material: r.material._id, lot: r.lot })));
  for (const r of items) r.stockId = stockIds.get(lotKeyOf(r.location._id, r.material._id, r.lot)) ?? null;

  // Queue position for good stock within each warehouse + product: 1 = goes out next.
  const queues = new Map();
  for (const r of fifoOrder(items.map((r) => ({ ...r, key: r.key, arrivedAt: r.lot ? r.startedOn : null })))) {
    if (!(r.qty.prime > 0)) continue;
    const q = `${r.location._id}:${r.material._id}`;
    queues.set(q, (queues.get(q) ?? 0) + 1);
    items.find((x) => x.key === r.key).fifoRank = queues.get(q);
  }

  items.sort(
    (a, b) =>
      a.location.name.localeCompare(b.location.name) ||
      a.material.name.localeCompare(b.material.name) ||
      (a.lot ? new Date(a.startedOn) : 0) - (b.lot ? new Date(b.startedOn) : 0),
  );
  return { items, shelfLifeDays: settings.shelfLifeDays, shelfLifeWarnDays: settings.shelfLifeWarnDays };
}

/** Every row of one lot (rows saved before lots were tracked are left out, except receipts). */
export async function lotLedger({ location, material, lot }) {
  const lotKey = lot && lot !== NO_LOT ? oid(lot) : NO_LOT;
  return StockMovement.aggregate([
    { $match: { location: oid(location), material: oid(material) } },
    ...LOT_STAGES,
    { $match: { lotKey } },
    { $sort: { createdAt: 1 } },
    { $limit: 2000 },
    { $lookup: { from: 'trips', localField: 'trip', foreignField: '_id', as: 'trip', pipeline: [{ $project: { tripNo: 1, challanNo: 1, vehicleNo: 1, destination: 1, customer: 1 } }] } },
    { $set: { trip: { $first: '$trip' } } },
    { $lookup: { from: 'locations', localField: 'trip.destination', foreignField: '_id', as: 'dest', pipeline: [{ $project: { name: 1 } }] } },
    { $lookup: { from: 'customers', localField: 'trip.customer', foreignField: '_id', as: 'cust', pipeline: [{ $project: { name: 1 } }] } },
    { $lookup: { from: 'users', localField: 'by', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1 } }] } },
    {
      $project: {
        _id: 1,
        at: '$createdAt',
        reason: 1,
        grade: 1,
        qty: 1,
        unit: 1,
        note: 1,
        stockCount: 1,
        trip: { _id: '$trip._id', tripNo: '$trip.tripNo', challanNo: '$trip.challanNo', vehicleNo: '$trip.vehicleNo' },
        destination: { $first: '$dest.name' },
        customer: { $first: '$cust.name' },
        by: { $first: '$user.name' },
      },
    },
  ]);
}
/**
 * One-time: gives a stock ID to every lot that came in before stock IDs existed, numbered by the day
 * its first stock arrived at the warehouse (oldest first). dryRun = only list what would be made.
 */
export async function backfillStockIds({ dryRun = false } = {}) {
  const lots = new Map();
  for (const b of await lotBalances({})) {
    if (!b.firstInAt) continue;
    const k = lotKeyOf(b.location, b.material, b.lot);
    const prev = lots.get(k);
    if (!prev || b.firstInAt < prev.at) lots.set(k, { location: b.location, material: b.material, lot: b.lot ? oid(b.lot) : null, at: b.firstInAt });
  }
  const existing = await stockIdMap([...lots.values()]);
  const todo = [...lots.entries()].filter(([k]) => !existing.has(k)).map(([, v]) => v).sort((a, b) => a.at - b.at);
  const made = [];
  for (const l of todo) {
    made.push({ ...l, stockId: dryRun ? `${istDayCode(l.at)}-??` : await ensureStockLot(l) });
  }
  return { existing: existing.size, made };
}
