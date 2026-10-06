import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreedPrice, fifoOrder, istDayCode, istDayNumber, stockIdFor, NO_LOT, settleLots, shelfLife, stockAgeBucket, takeFifo, bagDebit, bagsToTons, creditCheck, demurrage, freightSettlement, lateFee, lateFeeTerms, netWeight, paperQtyToUnit, reconcileBags, routeFrom, transitLoss } from './calc.js';

test('net weight from slip', () => {
  assert.equal(netWeight(42.5, 14.0), 28.5);
  assert.throws(() => netWeight(14, 14.2));
});

test('material weight from bag count', () => {
  assert.equal(bagsToTons(600, 50), 30);
  assert.equal(bagsToTons(573, 50), 28.65);
  assert.equal(bagsToTons(10, 40), 0.4);
  assert.throws(() => bagsToTons(0));
  assert.throws(() => bagsToTons(2.5));
});

test('shipment paper quantity in the product unit', () => {
  const sand = { unit: 'MT' };
  const cement = { unit: 'bag', bagWeightKg: 50 };
  assert.equal(paperQtyToUnit(3200, 'tons', sand), 3200);
  assert.equal(paperQtyToUnit(3200500, 'kg', sand), 3200.5);
  assert.throws(() => paperQtyToUnit(10, 'pieces', sand));
  assert.equal(paperQtyToUnit(50000, 'pieces', cement), 50000);
  assert.equal(paperQtyToUnit(2500, 'tons', cement), 50000);
  assert.equal(paperQtyToUnit(2500000, 'kg', cement), 50000);
  assert.equal(paperQtyToUnit(1000, 'kg', { unit: 'bag', bagWeightKg: 40 }), 25);
});

test('owner example: 28.5 T loaded, 27.1 T received is a hard alert', () => {
  const r = transitLoss({ loadedQty: 28.5, receivedQty: 27.1, tolerancePct: 0.5, unitCost: 1200 });
  assert.equal(r.lossQty, 1.4);
  assert.equal(r.lossPct, 4.91);
  assert.equal(r.isLossAlert, true);
  // Only the loss above the 0.5% allowance is deducted: 1.4 − 0.143 (allowance, 3 dp) = 1.257 T
  assert.equal(r.excessLossQty, 1.257);
  assert.equal(r.deduction, 1508.4);
});

test('small moisture loss clears automatically', () => {
  const r = transitLoss({ loadedQty: 28.5, receivedQty: 28.4, tolerancePct: 0.5 });
  assert.equal(r.withinTolerance, true);
  assert.equal(r.deduction, 0);
});

test('weight gain beyond tolerance is flagged (water spraying)', () => {
  const r = transitLoss({ loadedQty: 28.5, receivedQty: 28.9, tolerancePct: 0.5 });
  assert.equal(r.isGainAlert, true);
  assert.equal(r.deduction, 0);
});

test('bag reconciliation derives missing bags', () => {
  const rec = reconcileBags({ invoiceBags: 2000, sound: 1905, burst: 40, lumpy: 25, underweight: 15, underweightAvgKg: 46 });
  assert.equal(rec.missing, 15);
  assert.equal(rec.underweightShortKg, 60);
  const debit = bagDebit(rec, { costPerBag: 380 });
  assert.equal(debit.total, 25 * 380 + 15 * 380 + (60 / 50) * 380);
});

test('freight: agreed price per truck replaces rate × quantity', () => {
  assert.equal(freightSettlement({ loadedQty: 28.5, rate: 180 }).amount, 5130);
  const r = freightSettlement({ loadedQty: 28.5, rate: 180, pricePerTruck: 6500, advance: 2000, deduction: 500 });
  assert.equal(r.amount, 6500);
  assert.equal(r.balance, 4000);
  // A price of 0 is still a price (e.g. own truck), not "no price".
  assert.equal(freightSettlement({ loadedQty: 10, rate: 100, pricePerTruck: 0 }).amount, 0);
});

test('agreed rate: approved request wins, otherwise the owner quote', () => {
  assert.equal(agreedPrice({ status: 'quoted', quoted: 350 }), 350);
  assert.equal(agreedPrice({ status: 'pending', quoted: 350, requested: 500 }), 350);
  assert.equal(agreedPrice({ status: 'rejected', quoted: 350, requested: 500 }), 350);
  assert.equal(agreedPrice({ status: 'approved', quoted: 350, requested: 500 }), 500);
  assert.equal(agreedPrice({ status: 'pending', requested: 500 }), undefined);
  assert.equal(agreedPrice(undefined), undefined);
});

test('route lookup by unloading point', () => {
  const place = { routes: [{ from: { _id: 'stn1', name: 'Main' }, distanceKm: 42, pricePerTruck: 6500 }, { from: 'stn2', distanceKm: 18, pricePerTruck: 3000 }] };
  assert.equal(routeFrom(place, 'stn1').pricePerTruck, 6500);
  assert.equal(routeFrom(place, 'stn2').distanceKm, 18);
  assert.equal(routeFrom(place, 'nope'), null);
  assert.equal(routeFrom(null, 'stn1'), null);
});

test('late charges so far: all wagons, each started hour after free hours', () => {
  const placedAt = new Date('2026-10-04T00:00:00Z');
  const base = { placedAt, freeTimeHours: 9, wagonCount: 11, rate: 150, basis: 'hour', declaredQty: 3000, liftedQty: 2900 };
  // Still inside free hours → nothing yet
  assert.equal(demurrage({ ...base, now: new Date('2026-10-04T08:00:00Z') }).accruedPenalty, 0);
  // 2 h 10 min over → 3 started hours × 11 wagons × ₹150, even though only one wagon still has material
  const late = demurrage({ ...base, now: new Date('2026-10-04T11:10:00Z') });
  assert.equal(late.accruedPenalty, 3 * 11 * 150);
  assert.equal(late.accruedOverHours, 2.17);
  // Once emptied, it stops at the release time
  assert.equal(demurrage({ ...base, releasedAt: new Date('2026-10-04T10:30:00Z'), now: new Date('2026-10-05T00:00:00Z') }).accruedPenalty, 2 * 11 * 150);
});

test('demurrage projects penalty at slow lifting rate', () => {
  const placedAt = new Date('2026-09-25T00:00:00Z');
  const now = new Date('2026-09-25T04:00:00Z');
  const r = demurrage({ placedAt, freeTimeHours: 7, wagonCount: 58, ratePerWagonHour: 150, declaredQty: 3500, liftedQty: 1400, now });
  // 350 T/h → 2100 T left → 6 more hours → finish at 10h, 3h over
  assert.equal(r.liftRatePerHour, 350);
  assert.equal(r.projectedOverHours, 3);
  assert.equal(r.projectedPenalty, 3 * 58 * 150);
  assert.equal(r.status, 'at_risk');
});

test('late fee: per hour, per day or one time; per wagon for trains, once for a ship', () => {
  // 3 h 10 min late, 58 wagons, ₹150
  const overHours = 3 + 10 / 60;
  assert.equal(lateFee({ overHours, rate: 150, basis: 'hour', wagonCount: 58 }), 4 * 58 * 150);
  assert.equal(lateFee({ overHours, rate: 2000, basis: 'day', wagonCount: 58 }), 1 * 58 * 2000);
  assert.equal(lateFee({ overHours: 25, rate: 2000, basis: 'day', wagonCount: 58 }), 2 * 58 * 2000);
  assert.equal(lateFee({ overHours, rate: 50000, basis: 'once', wagonCount: 58 }), 58 * 50000);
  assert.equal(lateFee({ overHours: 0, rate: 50000, basis: 'once', wagonCount: 58 }), 0);
  // Ship: no wagons, charged the rate itself
  assert.equal(lateFee({ overHours, rate: 10000, basis: 'hour', wagonCount: 0 }), 4 * 10000);
  assert.equal(lateFee({ overHours: null, rate: 1 }), null);
});

test('older shipments keep their per-wagon-hour late fee', () => {
  assert.deepEqual(lateFeeTerms({ demurrageRatePerWagonHour: 150 }), { basis: 'hour', rate: 150 });
  assert.deepEqual(lateFeeTerms({ demurrageBasis: 'day', demurrageRate: 2000, demurrageRatePerWagonHour: 150 }), { basis: 'day', rate: 2000 });
});

test('credit check counts material already on the road', () => {
  const now = new Date('2026-09-25');
  const r = creditCheck({
    creditLimit: 2500000,
    creditDays: 45,
    invoices: [{ amount: 2300000, paidAmount: 0, invoiceDate: new Date('2026-09-10') }],
    unbilledValue: 300000,
    newValue: 50000,
    now,
  });
  assert.equal(r.blocked, true);
  assert.deepEqual(r.reasons, ['over_limit']);
});

test('credit check blocks on overdue invoice', () => {
  const now = new Date('2026-09-25');
  const r = creditCheck({
    creditLimit: 2500000,
    creditDays: 45,
    invoices: [{ amount: 100000, paidAmount: 0, invoiceDate: new Date('2026-07-01') }],
    now,
  });
  assert.deepEqual(r.reasons, ['overdue']);
});

test('shelf life of a stock lot, from the date of manufacturing', () => {
  // 4 Oct 2026, 3 pm India time.
  const now = new Date('2026-10-04T09:30:00Z');
  const fresh = shelfLife({ startedOn: new Date('2026-09-01'), shelfLifeDays: 90, warnDays: 15, now });
  assert.equal(fresh.ageDays, 33);
  assert.equal(fresh.daysLeft, 57);
  assert.equal(fresh.status, 'fresh');
  assert.equal(fresh.expiresAt.toISOString().slice(0, 10), '2026-11-30');
  assert.equal(shelfLife({ startedOn: new Date('2026-07-15'), shelfLifeDays: 90, warnDays: 15, now }).status, 'soon');
  const last = shelfLife({ startedOn: new Date('2026-07-06'), shelfLifeDays: 90, warnDays: 15, now });
  assert.equal(last.daysLeft, 0);
  assert.equal(last.status, 'soon');
  assert.equal(shelfLife({ startedOn: new Date('2026-07-05'), shelfLifeDays: 90, warnDays: 15, now }).status, 'expired');
  assert.equal(shelfLife({ startedOn: new Date('2026-01-01'), shelfLifeDays: 0, now }).status, 'none');
  assert.equal(shelfLife({ startedOn: null, shelfLifeDays: 90, now }).status, 'none');
  // Calendar days in India time: made yesterday is 1 day old just after midnight IST.
  assert.equal(shelfLife({ startedOn: new Date('2026-10-03'), shelfLifeDays: 90, now: new Date('2026-10-03T18:31:00Z') }).ageDays, 1);
  assert.equal(shelfLife({ startedOn: new Date('2026-10-03'), shelfLifeDays: 90, now: new Date('2026-10-03T18:29:00Z') }).ageDays, 0);
  // An arrival time late in the evening still counts as that day.
  assert.equal(istDayNumber('2026-10-03T17:00:00Z'), istDayNumber(new Date('2026-10-03')));
  assert.equal(stockAgeBucket(0).key, 'a0_30');
  assert.equal(stockAgeBucket(90).key, 'a61_90');
  assert.equal(stockAgeBucket(91).key, 'a90_plus');
});

test('first in, first out', () => {
  const lots = fifoOrder([
    { key: 'B', qty: 300, arrivedAt: '2026-09-10' },
    { key: 'A', qty: 100, arrivedAt: '2026-08-01' },
    { key: NO_LOT, qty: 20, arrivedAt: null },
  ]);
  assert.deepEqual(lots.map((l) => l.key), [NO_LOT, 'A', 'B']);
  assert.deepEqual(takeFifo(lots, 150), { takes: [{ key: NO_LOT, qty: 20 }, { key: 'A', qty: 100 }, { key: 'B', qty: 30 }], short: 0 });
  assert.deepEqual(takeFifo(lots, 500).short, 80);
  assert.deepEqual(takeFifo([{ key: 'A', qty: 0 }, { key: 'B', qty: 5 }], 3).takes, [{ key: 'B', qty: 3 }]);
});

test('lot balances with stock from before lot tracking', () => {
  const lots = [
    { key: 'A', qty: 100, arrivedAt: '2026-08-01' },
    { key: 'B', qty: 300, arrivedAt: '2026-09-10' },
  ];
  // Old dispatches with no lot come out of the oldest shipment first.
  assert.deepEqual(settleLots(lots, -130).map((l) => [l.key, l.qty]), [['A', 0], ['B', 270]]);
  // Old extra stock with no lot is kept as its own lot.
  assert.deepEqual(settleLots(lots, 40).map((l) => [l.key, l.qty]), [[NO_LOT, 40], ['A', 100], ['B', 300]]);
  // A lot pushed below zero borrows from the oldest lot; the total never changes.
  const neg = settleLots([{ key: 'A', qty: 50, arrivedAt: '2026-08-01' }, { key: 'B', qty: -10, arrivedAt: '2026-09-10' }]);
  assert.deepEqual(neg.map((l) => [l.key, l.qty]), [['A', 40], ['B', 0]]);
  // More taken out than ever came in: shows as negative stock with no lot.
  const over = settleLots([{ key: 'A', qty: 10, arrivedAt: '2026-08-01' }], -25);
  assert.deepEqual(over.map((l) => [l.key, l.qty]), [[NO_LOT, -15], ['A', 0]]);
});

test('stock ID: arrival day in India time + running number', () => {
  assert.equal(stockIdFor('2026-10-04T05:00:00Z', 1), '04102026-01');
  assert.equal(stockIdFor('2026-10-04T05:00:00Z', 12), '04102026-12');
  assert.equal(stockIdFor('2026-10-04T05:00:00Z', 105), '04102026-105');
  // 11:45 pm on 3 Oct UTC is already 4 Oct in India.
  assert.equal(istDayCode('2026-10-03T18:45:00Z'), '04102026');
  assert.equal(istDayCode('2026-10-03T18:15:00Z'), '03102026');
});
