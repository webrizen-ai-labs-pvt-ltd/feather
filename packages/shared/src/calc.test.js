import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bagDebit, creditCheck, demurrage, netWeight, reconcileBags, transitLoss } from './calc.js';

test('net weight from slip', () => {
  assert.equal(netWeight(42.5, 14.0), 28.5);
  assert.throws(() => netWeight(14, 14.2));
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
