import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreedPrice, bagDebit, bagsToTons, creditCheck, demurrage, freightSettlement, lateFee, lateFeeTerms, netWeight, paperQtyToUnit, reconcileBags, routeFrom, transitLoss } from './calc.js';

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
