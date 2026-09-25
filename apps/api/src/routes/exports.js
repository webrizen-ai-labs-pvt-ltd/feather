/** Excel downloads for the owner. */
import ExcelJS from 'exceljs';
import { Router } from 'express';
import {
  AGING_BUCKETS,
  CONSIGNMENT_MODE_LABELS,
  CONSIGNMENT_STATUS_LABELS,
  FREIGHT_STATUS_LABELS,
  formatVehicleNo,
  ROLES,
  STOCK_GRADE_LABELS,
  TIMEZONE,
  TRIP_FLAG_LABELS,
  TRIP_STATUS_LABELS,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { Consignment, Trip } from '@/models/index.js';
import { bookStock } from '@/services/stock.js';
import { creditOverview, transporterScorecard } from '@/services/reports.js';
import { notFound } from '@/utils/http.js';

const router = Router();
router.use(requireRole(ROLES.OWNER));

/** Excel shows dates in local time; shift UTC to IST so the cells read correctly. */
const IST_OFFSET_MS = 330 * 60_000;
const ist = (d) => (d ? new Date(new Date(d).getTime() + IST_OFFSET_MS) : null);

function sheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: c.style }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
  ws.addRows(rows);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const DT = { numFmt: 'dd-mmm-yy hh:mm' };
const MONEY = { numFmt: '₹#,##,##0.00' };
const QTY = { numFmt: '0.000' };

const EXPORTS = {
  async trips(req) {
    const filter = {};
    if (req.query.from || req.query.to) {
      filter['loading.at'] = {};
      if (req.query.from) filter['loading.at'].$gte = new Date(req.query.from);
      if (req.query.to) filter['loading.at'].$lte = new Date(req.query.to);
    }
    const trips = await Trip.find(filter)
      .sort({ 'loading.at': -1 })
      .limit(50_000)
      .populate('transporter', 'name')
      .populate('material', 'name')
      .populate('sourceLocation', 'name')
      .populate('destination', 'name')
      .populate('customer', 'name')
      .populate('consignment', 'referenceType referenceNo')
      .lean();
    return {
      name: 'Trips',
      columns: [
        { header: 'Trip No', key: 'tripNo' },
        { header: 'Challan No', key: 'challanNo' },
        { header: 'RR / BL', key: 'ref' },
        { header: 'Vehicle', key: 'vehicle' },
        { header: 'Transporter', key: 'transporter', width: 22 },
        { header: 'Driver', key: 'driver' },
        { header: 'Material', key: 'material' },
        { header: 'From', key: 'from', width: 20 },
        { header: 'To', key: 'to', width: 20 },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Loaded At', key: 'loadedAt', style: DT },
        { header: 'Load Gross', key: 'lg', style: QTY },
        { header: 'Load Tare', key: 'lt', style: QTY },
        { header: 'Load Net', key: 'ln', style: QTY },
        { header: 'Bags Loaded', key: 'lb' },
        { header: 'Received At', key: 'receivedAt', style: DT },
        { header: 'Recv Gross', key: 'rg', style: QTY },
        { header: 'Recv Tare', key: 'rt', style: QTY },
        { header: 'Recv Net', key: 'rn', style: QTY },
        { header: 'Loss MT', key: 'loss', style: QTY },
        { header: 'Loss %', key: 'lossPct' },
        { header: 'Good Bags', key: 'sound' },
        { header: 'Torn', key: 'burst' },
        { header: 'Hard/Wet', key: 'lumpy' },
        { header: 'Light', key: 'light' },
        { header: 'Missing', key: 'missing' },
        { header: 'Status', key: 'status' },
        { header: 'Flags', key: 'flags', width: 40 },
        { header: 'Freight', key: 'freight', style: MONEY },
        { header: 'Advance', key: 'advance', style: MONEY },
        { header: 'Deduction', key: 'deduction', style: MONEY },
        { header: 'Balance', key: 'balance', style: MONEY },
        { header: 'Freight Status', key: 'freightStatus', width: 20 },
      ],
      rows: trips.map((t) => ({
        tripNo: t.tripNo,
        challanNo: t.challanNo,
        ref: t.consignment ? `${t.consignment.referenceType} ${t.consignment.referenceNo}` : '',
        vehicle: formatVehicleNo(t.vehicleNo),
        transporter: t.transporter?.name,
        driver: [t.driverName, t.driverPhone].filter(Boolean).join(' '),
        material: t.material?.name,
        from: t.sourceLocation?.name,
        to: t.destination?.name,
        customer: t.customer?.name,
        loadedAt: ist(t.loading?.at),
        lg: t.loading?.gross,
        lt: t.loading?.tare,
        ln: t.loading?.net,
        lb: t.loading?.bags,
        receivedAt: ist(t.receipt?.at),
        rg: t.receipt?.gross,
        rt: t.receipt?.tare,
        rn: t.receipt?.net,
        loss: t.variance?.lossQty,
        lossPct: t.variance?.lossPct,
        sound: t.receipt?.bags?.sound,
        burst: t.receipt?.bags?.burst,
        lumpy: t.receipt?.bags?.lumpy,
        light: t.receipt?.bags?.underweight,
        missing: t.receipt?.bags?.missing,
        status: TRIP_STATUS_LABELS[t.status],
        flags: (t.flags ?? []).map((f) => TRIP_FLAG_LABELS[f]).join('; '),
        freight: t.freight?.amount,
        advance: t.freight?.advance,
        deduction: t.freight?.deduction,
        balance: t.freight?.balance,
        freightStatus: FREIGHT_STATUS_LABELS[t.freight?.status],
      })),
    };
  },

  async consignments() {
    const items = await Consignment.find().sort({ createdAt: -1 }).populate('material', 'name').populate('location', 'name').lean();
    return {
      name: 'Rakes & Ships',
      columns: [
        { header: 'Type', key: 'mode' },
        { header: 'RR / BL', key: 'ref', width: 20 },
        { header: 'Supplier', key: 'supplier', width: 22 },
        { header: 'Material', key: 'material' },
        { header: 'Siding / Port', key: 'location', width: 20 },
        { header: 'Declared', key: 'declared', style: QTY },
        { header: 'Lifted', key: 'lifted', style: QTY },
        { header: 'Received', key: 'received', style: QTY },
        { header: 'Trucks', key: 'trips' },
        { header: 'Placed At', key: 'placedAt', style: DT },
        { header: 'Released At', key: 'releasedAt', style: DT },
        { header: 'Free Hours', key: 'free' },
        { header: 'Over Hours', key: 'over' },
        { header: 'Demurrage', key: 'penalty', style: MONEY },
        { header: 'Purchase Rate', key: 'rate', style: MONEY },
        { header: 'Status', key: 'status' },
      ],
      rows: items.map((c) => ({
        mode: CONSIGNMENT_MODE_LABELS[c.mode],
        ref: `${c.referenceType} ${c.referenceNo}`,
        supplier: c.supplier,
        material: c.material?.name,
        location: c.location?.name,
        declared: c.declaredQty,
        lifted: c.liftedQty,
        received: c.receivedQty,
        trips: c.tripCount,
        placedAt: ist(c.placedAt),
        releasedAt: ist(c.releasedAt),
        free: c.freeTimeHours,
        over: c.demurrage?.finalOverHours,
        penalty: c.demurrage?.finalPenalty,
        rate: c.purchaseRatePerUnit,
        status: CONSIGNMENT_STATUS_LABELS[c.status],
      })),
    };
  },

  async transporters(req) {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const rows = await transporterScorecard(days);
    return {
      name: `Transporters ${days}d`,
      columns: [
        { header: 'Transporter', key: 'name', width: 24 },
        { header: 'Trips', key: 'trips' },
        { header: 'Loaded MT', key: 'loadedTons', style: QTY },
        { header: 'Lost MT', key: 'lossTons', style: QTY },
        { header: 'Loss %', key: 'lossPct' },
        { header: 'Problem Trips', key: 'lockedTrips' },
        { header: 'Problem %', key: 'problemRatePct' },
        { header: 'Billed Bags', key: 'billedBags' },
        { header: 'Damaged Bags', key: 'damagedBags' },
        { header: 'Missing Bags', key: 'missingBags' },
        { header: 'Bag Loss %', key: 'bagDamagePct' },
        { header: 'Deductions', key: 'deductions', style: MONEY },
      ],
      rows: rows.map((r) => ({ ...r, name: r.transporter.name })),
    };
  },

  async credit() {
    const rows = await creditOverview();
    return {
      name: 'Customer Credit',
      columns: [
        { header: 'Customer', key: 'name', width: 26 },
        { header: 'Credit Limit', key: 'limit', style: MONEY },
        { header: 'Outstanding', key: 'outstanding', style: MONEY },
        { header: 'On Road (unbilled)', key: 'unbilled', style: MONEY },
        { header: 'Exposure', key: 'exposure', style: MONEY },
        { header: 'Overdue', key: 'overdue', style: MONEY },
        { header: 'Oldest Overdue Days', key: 'oldest' },
        ...AGING_BUCKETS.map((b) => ({ header: b.label, key: b.key, style: MONEY })),
        { header: 'Blocked', key: 'blocked' },
      ],
      rows: rows.map((r) => ({
        name: r.customer.name,
        limit: r.credit.creditLimit,
        outstanding: r.credit.outstanding,
        unbilled: r.credit.unbilledValue,
        exposure: r.credit.exposure,
        overdue: r.credit.overdueAmount,
        oldest: r.credit.oldestOverdueDays || '',
        ...r.aging,
        blocked: r.credit.blocked ? 'YES' : '',
      })),
    };
  },

  async stock() {
    const rows = await bookStock();
    return {
      name: 'Book Stock',
      columns: [
        { header: 'Location', key: 'location', width: 22 },
        { header: 'Material', key: 'material', width: 20 },
        { header: 'Grade', key: 'grade', width: 18 },
        { header: 'Quantity', key: 'qty', style: QTY },
        { header: 'Unit', key: 'unit' },
      ],
      rows: rows.map((r) => ({ location: r.location?.name, material: r.material?.name, grade: STOCK_GRADE_LABELS[r.grade], qty: r.qty, unit: r.unit })),
    };
  },
};

router.get('/:name.xlsx', async (req, res) => {
  const build = EXPORTS[req.params.name];
  if (!build) throw notFound('Export');
  const { name, columns, rows } = await build(req);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Feather';
  wb.created = new Date();
  sheet(wb, name, columns, rows);
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="feather-${req.params.name}-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

export default router;
