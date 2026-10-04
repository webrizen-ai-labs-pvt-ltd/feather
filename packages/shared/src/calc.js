/**
 * Pure business calculations. Used by the API (source of truth) and by the
 * frontends for previews. Quantities: MT to 3 decimals, money to 2 decimals.
 */
import { CUBIC_METERS_PER_BRASS, PAPER_UNITS } from './constants.js';

export const round = (value, places = 3) => {
  const f = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * f) / f;
};
export const roundMoney = (value) => round(value, 2);

const HOUR_MS = 3_600_000;
const hoursBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / HOUR_MS;

/** Net payload from a weighbridge slip. Throws if the slip does not make sense. */
export function netWeight(gross, tare) {
  const g = Number(gross);
  const t = Number(tare);
  if (!Number.isFinite(g) || !Number.isFinite(t) || g <= 0 || t <= 0) {
    throw new RangeError('Gross and empty weight must both be more than zero.');
  }
  if (g <= t) throw new RangeError('Gross weight must be more than empty truck weight.');
  return round(g - t);
}

/** Material weight in MT worked out from a bag count (no weighbridge). */
export function bagsToTons(bags, bagWeightKg = 50) {
  const n = Number(bags);
  const kg = Number(bagWeightKg) || 50;
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('Number of bags must be more than zero.');
  return round((n * kg) / 1000);
}

/**
 * A shipment-paper quantity (KG / Metric Tonne / Bags) in the product's own unit:
 * MT for weighed products, bags for bagged ones. Bags are rounded to whole bags.
 */
export function paperQtyToUnit(qty, paperUnit, { unit, bagWeightKg = 50 }) {
  const n = Number(qty);
  const bagKg = Number(bagWeightKg) || 50;
  if (unit === 'bag') {
    if (paperUnit === PAPER_UNITS.BAGS) return Math.round(n);
    const kg = paperUnit === PAPER_UNITS.KG ? n : n * 1000;
    return Math.round(kg / bagKg);
  }
  if (paperUnit === PAPER_UNITS.BAGS) throw new RangeError('Bags is only for products counted in bags. Choose KG or Metric Tonne (MT).');
  return round(paperUnit === PAPER_UNITS.KG ? n / 1000 : n);
}

/**
 * Transit loss between the loading and unloading weighbridge.
 * A *gain* beyond tolerance is also flagged — it usually means water was
 * sprayed to hide stolen material, or a weighbridge slip was tampered.
 */
export function transitLoss({ loadedQty, receivedQty, tolerancePct, unitCost = 0 }) {
  const loaded = Number(loadedQty);
  const received = Number(receivedQty);
  const lossQty = round(loaded - received);
  const lossPct = loaded > 0 ? round((lossQty / loaded) * 100, 2) : 0;
  const allowedQty = round((loaded * tolerancePct) / 100);
  const excessLossQty = lossQty > allowedQty ? round(lossQty - allowedQty) : 0;
  const isLossAlert = lossPct > tolerancePct;
  const isGainAlert = -lossPct > tolerancePct;
  return {
    lossQty,
    lossPct,
    allowedQty,
    excessLossQty,
    isLossAlert,
    isGainAlert,
    withinTolerance: !isLossAlert && !isGainAlert,
    deduction: roundMoney(excessLossQty * unitCost),
  };
}

/**
 * Reconcile a bag count against the invoice. "missing" is derived, never typed.
 * underweightAvgKg is the average weight of the light bags (sample weighed).
 */
export function reconcileBags({
  invoiceBags,
  sound = 0,
  burst = 0,
  lumpy = 0,
  underweight = 0,
  underweightAvgKg = 0,
  bagWeightKg = 50,
}) {
  const counted = sound + burst + lumpy + underweight;
  const diff = invoiceBags - counted;
  const missing = Math.max(0, diff);
  const excess = Math.max(0, -diff);
  const underweightShortKg =
    underweight > 0 && underweightAvgKg > 0 ? round(underweight * Math.max(0, bagWeightKg - underweightAvgKg), 2) : 0;
  return {
    invoiceBags,
    counted,
    sound,
    burst,
    lumpy,
    underweight,
    missing,
    excess,
    underweightShortKg,
    damaged: burst + lumpy,
    damagePct: invoiceBags > 0 ? round(((burst + lumpy + underweight + missing) / invoiceBags) * 100, 2) : 0,
    isClean: missing === 0 && excess === 0 && burst === 0 && lumpy === 0 && underweight === 0,
  };
}

/** Amount chargeable to the transporter for a bagged receipt. */
export function bagDebit(rec, { costPerBag, bagWeightKg = 50, burstDiscountPct = 20, chargeBurst = false }) {
  const lumpyAmt = rec.lumpy * costPerBag;
  const missingAmt = rec.missing * costPerBag;
  const lightAmt = (rec.underweightShortKg / bagWeightKg) * costPerBag;
  const burstAmt = chargeBurst ? rec.burst * costPerBag * (burstDiscountPct / 100) : 0;
  return {
    lumpy: roundMoney(lumpyAmt),
    missing: roundMoney(missingAmt),
    underweight: roundMoney(lightAmt),
    burst: roundMoney(burstAmt),
    total: roundMoney(lumpyAmt + missingAmt + lightAmt + burstAmt),
  };
}

/**
 * Freight settlement for one trip. A negative balance means we recover money from the transporter.
 * With an agreed pricePerTruck the truck is paid that flat price; otherwise loaded quantity × rate.
 */
export function freightSettlement({ loadedQty, rate, pricePerTruck, advance = 0, deduction = 0 }) {
  const amount = roundMoney(pricePerTruck ?? loadedQty * rate);
  const balance = roundMoney(amount - advance - deduction);
  return { amount, advance: roundMoney(advance), deduction: roundMoney(deduction), balance, recoverable: balance < 0 ? -balance : 0 };
}

/**
 * Late fee once free hours are over. basis: 'hour' (each started hour), 'day' (each started day)
 * or 'once' (a single charge if late at all). A train is charged per wagon; a barge / ship
 * (no wagons) is charged the rate once for the whole vessel.
 */
export function lateFee({ overHours, rate = 0, basis = 'hour', wagonCount = 0 }) {
  if (overHours === null || overHours === undefined) return null;
  const units = wagonCount > 0 ? wagonCount : 1;
  const over = round(overHours, 4);
  const periods = basis === 'once' ? (over > 0 ? 1 : 0) : basis === 'day' ? Math.ceil(over / 24) : Math.ceil(over);
  return roundMoney(periods * units * rate);
}

/** Late fee terms of a shipment (older shipments only have a per-wagon-hour rate). */
export const lateFeeTerms = (c) => ({ basis: c.demurrageBasis ?? 'hour', rate: c.demurrageRate ?? c.demurrageRatePerWagonHour ?? 0 });

/** Free-hours clock for a shipment record. extra: { releasedAt?, warnHours?, now? } */
export const shipmentDemurrage = (c, extra = {}) =>
  demurrage({
    placedAt: c.placedAt,
    freeTimeHours: c.freeTimeHours,
    wagonCount: c.wagonCount,
    ...lateFeeTerms(c),
    declaredQty: c.declaredQty,
    liftedQty: c.liftedQty,
    releasedAt: c.releasedAt,
    ...extra,
  });

/**
 * Railway / port free-time clock for a placed rake or ship.
 * Projection uses the lifting rate achieved since placement.
 */
export function demurrage({
  placedAt,
  freeTimeHours,
  wagonCount = 0,
  rate,
  basis = 'hour',
  ratePerWagonHour = 0,
  declaredQty,
  liftedQty,
  releasedAt = null,
  warnHours = 2,
  now = new Date(),
}) {
  if (!placedAt) return { status: 'not_placed' };
  const end = releasedAt ? new Date(releasedAt) : new Date(now);
  const freeEndsAt = new Date(new Date(placedAt).getTime() + freeTimeHours * HOUR_MS);
  const elapsedHours = Math.max(0, hoursBetween(placedAt, end));
  const remainingFreeHours = round(freeTimeHours - elapsedHours, 2);
  const remainingQty = Math.max(0, round(declaredQty - liftedQty));
  const liftRatePerHour = elapsedHours > 0.05 ? round(liftedQty / elapsedHours, 2) : 0;
  const requiredRatePerHour = remainingFreeHours > 0 ? round(remainingQty / remainingFreeHours, 2) : null;

  let projectedFinishAt = null;
  if (releasedAt) projectedFinishAt = new Date(releasedAt);
  else if (remainingQty === 0) projectedFinishAt = end;
  else if (liftRatePerHour > 0) projectedFinishAt = new Date(end.getTime() + (remainingQty / liftRatePerHour) * HOUR_MS);

  const overHours = projectedFinishAt ? Math.max(0, hoursBetween(freeEndsAt, projectedFinishAt)) : null;
  // Railways bill each started hour.
  const billableHours = overHours === null ? null : Math.ceil(round(overHours, 4));
  const penalty = lateFee({ overHours, rate: rate ?? ratePerWagonHour, basis, wagonCount });

  let status = 'ok';
  if (releasedAt) status = billableHours > 0 ? 'penalty' : 'done';
  else if (elapsedHours > freeTimeHours) status = 'overdue';
  else if (projectedFinishAt === null && elapsedHours > 0.5) status = 'at_risk';
  else if (overHours > 0 || (remainingFreeHours <= warnHours && remainingQty > 0)) status = 'at_risk';

  return {
    status,
    freeEndsAt,
    elapsedHours: round(elapsedHours, 2),
    remainingFreeHours,
    remainingQty,
    liftRatePerHour,
    requiredRatePerHour,
    projectedFinishAt,
    projectedOverHours: overHours === null ? null : round(overHours, 2),
    projectedPenalty: penalty,
    isFinal: Boolean(releasedAt),
  };
}

/** The owner's route (distance, price per truck) from an unloading point to a warehouse / delivery site. */
export const routeFrom = (place, fromId) =>
  fromId ? (place?.routes ?? []).find((r) => String(r.from?._id ?? r.from) === String(fromId)) ?? null : null;

/** Rate in force for a trip (price per truck, labour cost): the approved new amount, else the owner's quote (undefined = none). */
export const agreedPrice = (request) => (request?.status === 'approved' ? request.requested : request?.quoted ?? undefined);

/** Age buckets for unpaid invoices (days since invoice date). */
export const AGING_BUCKETS = Object.freeze([
  { key: 'd0_30', label: '0–30 days', min: 0, max: 30 },
  { key: 'd31_45', label: '31–45 days', min: 31, max: 45 },
  { key: 'd46_60', label: '46–60 days', min: 46, max: 60 },
  { key: 'd60_plus', label: '60+ days', min: 61, max: Infinity },
]);

export const daysSince = (date, now = new Date()) => Math.floor((new Date(now) - new Date(date)) / 86_400_000);

export function aging(invoices, now = new Date()) {
  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b.key, 0]));
  for (const inv of invoices) {
    const due = roundMoney(inv.amount - (inv.paidAmount || 0));
    if (due <= 0) continue;
    const age = daysSince(inv.invoiceDate, now);
    const bucket = AGING_BUCKETS.find((b) => age >= b.min && age <= b.max) ?? AGING_BUCKETS.at(-1);
    buckets[bucket.key] = roundMoney(buckets[bucket.key] + due);
  }
  return buckets;
}

/**
 * Credit check before a dispatch challan is made.
 * Exposure = unpaid invoices + value of material already on the road (not yet billed).
 */
export function creditCheck({ creditLimit, creditDays, invoices = [], unbilledValue = 0, newValue = 0, now = new Date() }) {
  let outstanding = 0;
  let overdueAmount = 0;
  let oldestOverdueDays = 0;
  for (const inv of invoices) {
    const due = roundMoney(inv.amount - (inv.paidAmount || 0));
    if (due <= 0) continue;
    outstanding += due;
    const age = daysSince(inv.invoiceDate, now);
    if (age > creditDays) {
      overdueAmount += due;
      oldestOverdueDays = Math.max(oldestOverdueDays, age);
    }
  }
  outstanding = roundMoney(outstanding);
  const exposure = roundMoney(outstanding + unbilledValue);
  const afterDispatch = roundMoney(exposure + newValue);
  const reasons = [];
  if (afterDispatch > creditLimit) reasons.push('over_limit');
  if (overdueAmount > 0) reasons.push('overdue');
  return {
    outstanding,
    unbilledValue: roundMoney(unbilledValue),
    exposure,
    afterDispatch,
    creditLimit,
    available: roundMoney(creditLimit - exposure),
    overdueAmount: roundMoney(overdueAmount),
    oldestOverdueDays,
    blocked: reasons.length > 0,
    reasons,
  };
}

export const CREDIT_REASON_LABELS = Object.freeze({
  over_limit: 'Credit limit will be crossed',
  overdue: 'Payment overdue beyond credit days',
});

/** Median of a list of numbers (used for vehicle tare history). */
export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Brass → MT using material bulk density (tonnes per cubic metre). */
export const brassToTons = (brass, densityTPerM3) => round(brass * CUBIC_METERS_PER_BRASS * densityTPerM3);
export const tonsToBrass = (tons, densityTPerM3) => (densityTPerM3 > 0 ? round(tons / (CUBIC_METERS_PER_BRASS * densityTPerM3), 2) : null);
