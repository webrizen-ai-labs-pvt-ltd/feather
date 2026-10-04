/**
 * Trip life cycle: loading → (on the road) → receipt → freight settlement.
 * All the anti-leakage rules live here so every route goes through them.
 */
import mongoose from 'mongoose';
import {
  agreedPrice,
  ALERT_SEVERITY,
  ALERT_TYPES,
  bagDebit,
  bagsToTons,
  CONSIGNMENT_STATUS,
  CREDIT_REASON_LABELS,
  FREIGHT_STATUS,
  formatINR,
  formatPct,
  formatQty,
  formatVehicleNo,
  freightSettlement,
  LOCATION_TYPES,
  MATERIAL_KINDS,
  median,
  netWeight,
  reconcileBags,
  round,
  roundMoney,
  ROLES,
  routeFrom,
  STOCK_GRADES,
  transitLoss,
  TRIP_FLAGS,
  TRIP_FLAG_LABELS,
  TRIP_SOURCE,
  TRIP_STATUS,
  PRICE_REQUEST_KINDS,
  PRICE_REQUEST_STATUS,
  WEIGH_METHODS,
} from '@feather/shared';
import { Alert, Consignment, Customer, Invoice, Location, Material, Order, Transporter, Trip, Vehicle } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { nextNumber } from '@/services/counters.js';
import { activeOverride, applyAdvances, consumeOverride, customerCredit } from '@/services/credit.js';
import { getSettings } from '@/services/settings.js';
import { bookQty, move } from '@/services/stock.js';
import { putFile } from '@/services/storage.js';
import { badRequest, forbidden, HttpError, notFound } from '@/utils/http.js';

const HOUR_MS = 3_600_000;

/** Flags that stop freight payment until the owner reviews the trip. */
const LOCKING_FLAGS = new Set([
  TRIP_FLAGS.TRANSIT_LOSS,
  TRIP_FLAGS.WEIGHT_GAIN,
  TRIP_FLAGS.BAG_DAMAGE,
  TRIP_FLAGS.BAG_SHORTAGE,
  TRIP_FLAGS.BAG_EXCESS,
  TRIP_FLAGS.TARE_MISMATCH,
]);

const worksAt = (user, locationId) =>
  user.role === ROLES.OWNER ||
  user.role === ROLES.DISPATCH_OPERATOR ||
  !user.locations?.length ||
  user.locations.some((l) => String(l) === String(locationId));

async function savePhoto(file, folder, geo) {
  if (!file) throw badRequest('Please take a photo of the weighbridge slip.', { fields: { photo: 'Photo is required' } });
  const stored = await putFile({ folder, buffer: file.buffer, contentType: file.mimetype });
  return { ...stored, lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy };
}

async function tareHistoryFlag(vehicleNo, tare, settings) {
  const recent = await Trip.find({ vehicleNo, 'loading.tare': { $gt: 0 }, status: { $ne: TRIP_STATUS.CANCELLED } }, 'loading.tare')
    .sort({ 'loading.at': -1 })
    .limit(10)
    .lean();
  if (recent.length < 3) return null;
  const usual = median(recent.map((t) => t.loading.tare));
  const deviationPct = (Math.abs(tare - usual) / usual) * 100;
  return deviationPct > settings.tareDeviationPct ? { usual: round(usual), deviationPct: round(deviationPct, 1) } : null;
}

// ----------------------------------------------------------------------------
// Loading
// ----------------------------------------------------------------------------

export async function createLoading({ input, file, user }) {
  const existing = await Trip.findOne({ clientId: input.clientId });
  if (existing) return { trip: existing, duplicate: true };

  const settings = await getSettings();
  const tripId = new mongoose.Types.ObjectId();

  // --- Where is the material coming from?
  let consignment = null;
  let sourceLocation;
  let material;
  if (input.consignment) {
    consignment = await Consignment.findById(input.consignment);
    if (!consignment) throw notFound('Shipment');
    if ([CONSIGNMENT_STATUS.RELEASED, CONSIGNMENT_STATUS.CLOSED].includes(consignment.status)) {
      throw badRequest('This shipment is already finished. You cannot load from it.');
    }
    sourceLocation = consignment.location;
    material = await Material.findById(consignment.material);
  } else {
    if (user.role === ROLES.SIDING_SUPERVISOR) throw forbidden('Loading staff can only load from a shipment.');
    const loc = await Location.findById(input.sourceLocation);
    if (!loc || loc.type !== LOCATION_TYPES.STOCKYARD) throw badRequest('Choose a warehouse to dispatch from.');
    if (!input.order) throw badRequest('Choose the customer order for this dispatch.', { fields: { order: 'Required' } });
    sourceLocation = loc._id;
  }
  if (!worksAt(user, sourceLocation)) throw forbidden('You are not assigned to this unloading point / warehouse.');

  // --- Where is it going?
  const destination = await Location.findById(input.destination);
  if (!destination || !destination.active) throw badRequest('Choose where the truck is going.');
  if (String(destination._id) === String(sourceLocation)) throw badRequest('Truck cannot go to the same place it is loaded.');

  let order = null;
  if (destination.type === LOCATION_TYPES.CUSTOMER_SITE || input.order) {
    if (!input.order) throw badRequest('This is a delivery site. Choose the customer order.', { fields: { order: 'Required' } });
    order = await Order.findById(input.order);
    if (!order || order.status !== 'open') throw badRequest('This order is not open.');
    if (String(order.deliverySite) !== String(destination._id)) throw badRequest('The order is for a different site.');
    if (!material) material = await Material.findById(order.material);
    if (String(order.material) !== String(material._id)) throw badRequest('The order is for a different material.');
  } else if (destination.type !== LOCATION_TYPES.STOCKYARD) {
    throw badRequest('Truck must go to a warehouse or a delivery site.');
  }

  // --- Quantity: weighbridge (full − empty truck), or bag count × bag weight for bagged material.
  const isBagged = material.kind === MATERIAL_KINDS.BAGGED;
  const byBags = input.weighMethod === WEIGH_METHODS.BAGS;
  if (byBags && !isBagged) throw badRequest('This material is not in bags. Use full truck and empty truck weight.', { fields: { weighMethod: 'Not for this material' } });
  if (isBagged && !input.loadedBags) throw badRequest('Enter number of bags loaded.', { fields: { loadedBags: 'Required' } });
  const net = byBags ? bagsToTons(input.loadedBags, material.bagWeightKg) : netWeight(input.grossWeight, input.tareWeight);
  const qty = isBagged ? input.loadedBags : net;

  if (!consignment) {
    const available = await bookQty(sourceLocation, material._id, STOCK_GRADES.PRIME);
    if (qty > available) {
      throw badRequest(`System stock at this warehouse is only ${formatQty(available, material.unit)}. Ask the owner to check the stock count.`);
    }
  }

  // --- Credit hard-stop (customer dispatch only)
  const flags = [];
  let credit;
  if (order) {
    const value = roundMoney(qty * order.ratePerUnit);
    const check = await customerCredit(order.customer, value);
    credit = { snapshot: check };
    if (check.blocked) {
      if (user.role === ROLES.OWNER && input.overrideReason) {
        credit.overrideReason = input.overrideReason;
        flags.push(TRIP_FLAGS.CREDIT_OVERRIDE);
      } else {
        const override = await activeOverride(order.customer);
        if (!override) {
          await creditBlockedAlert(order.customer, check, user);
          throw new HttpError(403, 'Customer on hold: this customer has crossed the credit limit or has overdue payment. Ask the owner.', {
            code: 'CREDIT_BLOCKED',
            data: user.role === ROLES.DISPATCH_OPERATOR || user.role === ROLES.OWNER ? check : { reasons: check.reasons },
          });
        }
        credit.override = override._id;
        credit.overrideReason = override.reason;
        flags.push(TRIP_FLAGS.CREDIT_OVERRIDE);
      }
    }
  }

  // --- Vehicle checks (no empty weight when loaded by bag count)
  const tareIssue = byBags ? null : await tareHistoryFlag(input.vehicleNo, input.tareWeight, settings);
  if (tareIssue) flags.push(TRIP_FLAGS.TARE_HISTORY);
  if (input.wasOffline) flags.push(TRIP_FLAGS.OFFLINE_ENTRY);

  const transporter = await Transporter.findById(input.transporter);
  if (!transporter || !transporter.active) throw badRequest('Choose the truck company.');

  // --- Owner rates for trips from a shipment: price per truck for the route and unloading labour per
  // truck at the station / port. A different amount from loading staff waits for the owner's approval.
  let truckPrice;
  let labourCost;
  let station;
  if (consignment) {
    station = await Location.findById(consignment.location, 'name type labourCostPerTruck').lean();
    const route = routeFrom(destination, consignment.location);
    truckPrice = priceRequestFor({ quoted: route?.pricePerTruck, asked: input.truckPrice, reason: input.truckPriceReason, user });
    if (truckPrice) truckPrice.distanceKm = route?.distanceKm;
    labourCost = priceRequestFor({ quoted: station?.labourCostPerTruck, asked: input.labourCost, reason: input.labourCostReason, user });
  }
  const pricePerTruck = truckPrice?.agreed;

  if (credit?.override) {
    const used = await consumeOverride(credit.override, tripId);
    if (!used) throw new HttpError(403, 'Owner permission has just expired. Ask the owner again.', { code: 'CREDIT_BLOCKED' });
  }

  const photo = await savePhoto(file, 'loading', input);
  const now = new Date();
  const rate = consignment?.freightRatePerUnit ?? transporter.defaultRatePerUnit ?? 0;

  const trip = await Trip.create({
    _id: tripId,
    tripNo: await nextNumber('TRP'),
    challanNo: order ? await nextNumber('DC') : undefined,
    source: consignment ? TRIP_SOURCE.CONSIGNMENT : TRIP_SOURCE.STOCKYARD,
    consignment: consignment?._id,
    sourceLocation,
    destination: destination._id,
    order: order?._id,
    customer: order?.customer,
    material: material._id,
    unit: material.unit,
    vehicleNo: input.vehicleNo,
    transporter: transporter._id,
    driverName: input.driverName,
    driverPhone: input.driverPhone,
    loading: {
      method: byBags ? WEIGH_METHODS.BAGS : WEIGH_METHODS.WEIGHT,
      gross: input.grossWeight,
      tare: input.tareWeight,
      net,
      qty,
      bags: isBagged ? input.loadedBags : undefined,
      slipNo: input.slipNo,
      photo,
      at: now,
      deviceTime: input.deviceTime,
      wasOffline: input.wasOffline,
      by: user._id,
    },
    expectedTransitHours: destination.expectedTransitHours ?? settings.defaultExpectedTransitHours,
    flags,
    truckPrice,
    labourCost,
    freight: { rate, pricePerTruck, ...freightSettlement({ loadedQty: qty, rate, pricePerTruck }), status: FREIGHT_STATUS.ON_HOLD },
    credit,
    clientId: input.clientId,
    createdBy: user._id,
  });

  // --- Running totals and stock
  if (consignment) {
    const update = { $inc: { tripCount: 1, liftedQty: qty } };
    if (consignment.status === CONSIGNMENT_STATUS.EXPECTED) {
      // Loading has started, so the rake is at the siding. Start the clock now.
      update.$set = { status: CONSIGNMENT_STATUS.PLACED, placedAt: consignment.placedAt ?? now };
    }
    await Consignment.updateOne({ _id: consignment._id }, update);
  } else {
    await move({ location: sourceLocation, material: material._id, unit: material.unit, qty: -qty, reason: 'dispatch', trip: trip._id, by: user._id });
  }
  if (order) await Order.updateOne({ _id: order._id }, { $inc: { dispatchedQty: qty } });
  await Vehicle.updateOne(
    { vehicleNo: input.vehicleNo },
    { $set: { transporter: transporter._id, lastDriverName: input.driverName, lastDriverPhone: input.driverPhone, lastSeenAt: now } },
    { upsert: true },
  );

  if (tareIssue) {
    await raiseAlert({
      type: ALERT_TYPES.TARE_ANOMALY,
      title: `Unusual empty weight — ${formatVehicleNo(input.vehicleNo)}`,
      lines: [
        `Trip ${trip.tripNo}: empty truck weight entered as ${input.tareWeight} T.`,
        `This truck usually weighs about ${tareIssue.usual} T empty (${tareIssue.deviationPct}% difference).`,
        'Check if extra diesel, people or spare parts were on the truck at the weighbridge.',
      ],
      trip: trip._id,
    });
  }
  for (const kind of Object.keys(PRICE_REQUEST_KINDS)) {
    if (trip[kind]?.status === PRICE_REQUEST_STATUS.PENDING) await priceRequestAlert({ kind, trip, consignment, station, destination, transporter, user });
  }
  if (credit?.overrideReason) {
    await raiseAlert({
      type: ALERT_TYPES.CREDIT_OVERRIDE,
      severity: ALERT_SEVERITY.INFO,
      title: `Dispatch sent under special permission — ${trip.challanNo}`,
      lines: [`Reason: ${credit.overrideReason}`, `Value: ${formatINR(qty * order.ratePerUnit)}`],
      trip: trip._id,
      customer: order.customer,
    });
  }
  return { trip, duplicate: false };
}

/**
 * An owner rate on a new trip (price per truck, labour cost). An amount different from the owner's
 * quote is a request: it waits for the owner's approval (the owner's own entry counts straight away).
 * Returns undefined when there is neither a quote nor a request.
 */
export function priceRequestFor({ quoted, asked, reason, user }) {
  const isRequest = asked !== undefined && asked !== quoted;
  if (quoted == null && !isRequest) return undefined;
  const request = { quoted: quoted ?? undefined, status: PRICE_REQUEST_STATUS.QUOTED };
  if (isRequest) {
    const at = new Date();
    Object.assign(request, { requested: asked, reason, requestedBy: user._id, requestedAt: at });
    if (user.role === ROLES.OWNER) Object.assign(request, { status: PRICE_REQUEST_STATUS.APPROVED, reviewedBy: user._id, reviewedAt: at });
    else request.status = PRICE_REQUEST_STATUS.PENDING;
  }
  request.agreed = agreedPrice(request);
  return request;
}

async function priceRequestAlert({ kind, trip, consignment, station, destination, transporter, user }) {
  const r = trip[kind];
  const truck = `Truck ${formatVehicleNo(trip.vehicleNo)}, ${transporter.name}.`;
  const instead = r.quoted != null ? `your rate ${formatINR(r.quoted)}` : 'no rate (you have not set one)';
  const lines =
    kind === 'truckPrice'
      ? [
          `${user.name} asked for ${formatINR(r.requested)} per truck instead of ${instead}.`,
          `Route: ${station?.name} → ${destination.name}${r.distanceKm ? ` (${r.distanceKm} km)` : ''}. ${truck}`,
        ]
      : [`${user.name} asked for unloading labour of ${formatINR(r.requested)} for this truck instead of ${instead}.`, `At: ${station?.name}. ${truck}`];
  await raiseAlert({
    type: PRICE_REQUEST_KINDS[kind].alertType,
    title: `New ${PRICE_REQUEST_KINDS[kind].label.toLowerCase()} asked — ${trip.tripNo}`,
    lines: [...lines, `Reason: ${r.reason}`, 'Open the trip to approve or reject. Until you approve, your rate is used.'],
    trip: trip._id,
    consignment: consignment._id,
  });
}

/**
 * Owner decision on a new rate. Approved → the new amount is used; rejected → the quote stays.
 * For the price per truck, the truck payment is worked out again.
 */
export async function reviewPriceRequest({ trip, kind, approve, note, user }) {
  const request = trip[kind];
  if (request?.status !== PRICE_REQUEST_STATUS.PENDING) throw badRequest('There is nothing waiting for approval.');
  if (kind === 'truckPrice' && trip.freight.status === FREIGHT_STATUS.PAID) throw badRequest('Truck payment is already paid.');
  Object.assign(request, {
    status: approve ? PRICE_REQUEST_STATUS.APPROVED : PRICE_REQUEST_STATUS.REJECTED,
    reviewedBy: user._id,
    reviewedAt: new Date(),
    reviewNote: note,
  });
  request.agreed = agreedPrice(request);
  if (kind === 'truckPrice') {
    const pricePerTruck = request.agreed;
    Object.assign(trip.freight, {
      pricePerTruck,
      ...freightSettlement({ loadedQty: trip.loading.qty, rate: trip.freight.rate, pricePerTruck, advance: trip.freight.advance, deduction: trip.freight.deduction }),
    });
  }
  await trip.save();
  // The request alert is dealt with.
  await Alert.updateMany({ type: PRICE_REQUEST_KINDS[kind].alertType, trip: trip._id, readAt: null }, { readAt: new Date() });
  return trip;
}

async function creditBlockedAlert(customerId, check, user) {
  const recent = await Alert.exists({
    type: ALERT_TYPES.CREDIT_BLOCK,
    customer: customerId,
    createdAt: { $gt: new Date(Date.now() - HOUR_MS) },
  });
  if (recent) return;
  const customer = await Customer.findById(customerId, 'name').lean();
  await raiseAlert({
    type: ALERT_TYPES.CREDIT_BLOCK,
    severity: ALERT_SEVERITY.CRITICAL,
    title: `Customer on hold for ${customer?.name}`,
    lines: [
      `${user.name} tried to send a truck to them.`,
      ...check.reasons.map((r) => CREDIT_REASON_LABELS[r]),
      `Outstanding: ${formatINR(check.outstanding)}. On the road (not billed): ${formatINR(check.unbilledValue)}.`,
      `Credit limit: ${formatINR(check.creditLimit)}. Overdue: ${formatINR(check.overdueAmount)}.`,
      'Open the owner app to allow a one-time special permission if needed.',
    ],
    customer: customerId,
  });
}

// ----------------------------------------------------------------------------
// Receipt
// ----------------------------------------------------------------------------

/**
 * Work out every derived number for a receipt. No database writes.
 * Used for a fresh receipt and again when the owner corrects weights.
 */
export function evaluateReceipt({ trip, material, settings, order, input, receivedAt }) {
  const net = netWeight(input.grossWeight, input.tareWeight);
  const isBagged = material.kind === MATERIAL_KINDS.BAGGED;
  const tolerancePct = material.transitLossTolerancePct ?? settings.defaultTransitLossTolerancePct;
  const flags = new Set((trip.flags ?? []).filter((f) => !LOCKING_FLAGS.has(f) && f !== TRIP_FLAGS.SLOW_TRANSIT));
  const unitCost = material.landedCostPerUnit ?? 0;

  // Weight check is done for every trip. For cement, money is recovered through the bag count instead.
  const loss = transitLoss({
    loadedQty: trip.loading.net,
    receivedQty: net,
    tolerancePct,
    unitCost: isBagged ? 0 : unitCost,
  });
  if (loss.isLossAlert) flags.add(TRIP_FLAGS.TRANSIT_LOSS);
  if (loss.isGainAlert) flags.add(TRIP_FLAGS.WEIGHT_GAIN);

  let bags;
  let deduction = isBagged ? 0 : loss.deduction;
  let deductionDetail = isBagged ? {} : { transitLoss: loss.deduction };
  let receivedQty = net;
  let billedQty = net;
  const stockLines = [];

  if (isBagged) {
    const rec = reconcileBags({
      invoiceBags: trip.loading.qty,
      sound: input.sound ?? 0,
      burst: input.burst ?? 0,
      lumpy: input.lumpy ?? 0,
      underweight: input.underweight ?? 0,
      underweightAvgKg: input.underweightAvgKg ?? 0,
      bagWeightKg: material.bagWeightKg,
    });
    bags = {
      invoice: rec.invoiceBags,
      sound: rec.sound,
      burst: rec.burst,
      lumpy: rec.lumpy,
      underweight: rec.underweight,
      underweightAvgKg: input.underweightAvgKg,
      underweightShortKg: rec.underweightShortKg,
      missing: rec.missing,
      excess: rec.excess,
    };
    if (rec.burst + rec.lumpy + rec.underweight > 0) flags.add(TRIP_FLAGS.BAG_DAMAGE);
    if (rec.missing > 0) flags.add(TRIP_FLAGS.BAG_SHORTAGE);
    if (rec.excess > 0) flags.add(TRIP_FLAGS.BAG_EXCESS);
    const debit = bagDebit(rec, {
      costPerBag: unitCost,
      bagWeightKg: material.bagWeightKg,
      burstDiscountPct: settings.burstDiscountPct,
      chargeBurst: settings.chargeBurstLossToTransporter,
    });
    deduction = debit.total;
    deductionDetail = debit;
    receivedQty = rec.counted;
    billedQty = rec.sound;
    stockLines.push(
      { grade: STOCK_GRADES.PRIME, qty: rec.sound },
      { grade: STOCK_GRADES.SECONDS, qty: rec.burst + rec.underweight },
      { grade: STOCK_GRADES.REJECTED, qty: rec.lumpy },
    );
  } else {
    stockLines.push({ grade: STOCK_GRADES.PRIME, qty: net });
  }

  // Only when there was an empty weight at loading (not for bag-count loading).
  if (trip.loading.tare && Math.abs(input.tareWeight - trip.loading.tare) > settings.tareMismatchTons) flags.add(TRIP_FLAGS.TARE_MISMATCH);

  const hoursOnRoad = (receivedAt - new Date(trip.loading.at)) / HOUR_MS;
  if (trip.expectedTransitHours && hoursOnRoad > trip.expectedTransitHours * settings.slowTransitFactor) {
    flags.add(TRIP_FLAGS.SLOW_TRANSIT);
  }

  const locked = [...flags].some((f) => LOCKING_FLAGS.has(f));
  const settlement = freightSettlement({
    loadedQty: trip.loading.qty,
    rate: trip.freight.rate,
    pricePerTruck: trip.freight.pricePerTruck,
    advance: trip.freight.advance,
    deduction,
  });

  return {
    receipt: { gross: input.grossWeight, tare: input.tareWeight, net, qty: receivedQty, bags },
    variance: {
      tolerancePct,
      lossQty: loss.lossQty,
      lossPct: loss.lossPct,
      allowedQty: loss.allowedQty,
      excessLossQty: loss.excessLossQty,
    },
    flags: [...flags],
    freight: {
      ...settlement,
      deductionDetail,
      status: locked ? FREIGHT_STATUS.LOCKED : FREIGHT_STATUS.READY,
    },
    stockLines,
    billedQty,
    invoiceAmount: order ? roundMoney(billedQty * order.ratePerUnit) : 0,
    hoursOnRoad: round(hoursOnRoad, 2),
    locked,
  };
}

export async function receiveTrip({ tripId, input, file, user }) {
  const trip = await Trip.findById(tripId);
  if (!trip) throw notFound('Trip');
  if (trip.receiptClientId && trip.receiptClientId === input.clientId) return { trip, duplicate: true };
  if (trip.status !== TRIP_STATUS.IN_TRANSIT) throw badRequest('This truck is already received or cancelled.');
  if (!worksAt(user, trip.destination)) throw forbidden('This truck is not coming to your warehouse / site.');

  const [material, settings, order, destination] = await Promise.all([
    Material.findById(trip.material),
    getSettings(),
    trip.order ? Order.findById(trip.order) : null,
    Location.findById(trip.destination),
  ]);
  if (material.kind === MATERIAL_KINDS.BAGGED) {
    const counted = (input.sound ?? 0) + (input.burst ?? 0) + (input.lumpy ?? 0) + (input.underweight ?? 0);
    if (counted === 0) throw badRequest('Count the bags and fill the bag boxes.', { fields: { sound: 'Required' } });
  }

  const now = new Date();
  const result = evaluateReceipt({ trip, material, settings, order, input, receivedAt: now });
  const photo = await savePhoto(file, 'receipt', input);

  trip.receipt = {
    ...result.receipt,
    slipNo: input.slipNo,
    remarks: input.remarks,
    photo,
    at: now,
    deviceTime: input.deviceTime,
    wasOffline: input.wasOffline,
    by: user._id,
    grnNo: await nextNumber('GRN'),
  };
  trip.variance = result.variance;
  trip.flags = input.wasOffline ? [...new Set([...result.flags, TRIP_FLAGS.OFFLINE_ENTRY])] : result.flags;
  trip.freight = { ...trip.freight.toObject(), ...result.freight };
  trip.status = TRIP_STATUS.RECEIVED;
  trip.receiptClientId = input.clientId;
  if (trip.breakdown?.active) trip.breakdown.active = false;
  await trip.save();

  // Stock goes up only when a truck is received at our own yard.
  if (destination.type === LOCATION_TYPES.STOCKYARD) {
    for (const line of result.stockLines) {
      await move({ location: destination._id, material: material._id, unit: material.unit, grade: line.grade, qty: line.qty, reason: 'receipt', trip: trip._id, by: user._id });
    }
  }
  if (order) {
    await Order.updateOne({ _id: order._id }, { $inc: { deliveredQty: result.billedQty } });
    if (result.invoiceAmount > 0) {
      const invoice = await Invoice.create({
        invoiceNo: await nextNumber('INV'),
        customer: trip.customer,
        trip: trip._id,
        order: order._id,
        amount: result.invoiceAmount,
        invoiceDate: now,
        auto: true,
      });
      await applyAdvances(invoice);
    }
  }
  if (trip.consignment) {
    await Consignment.updateOne(
      { _id: trip.consignment },
      { $inc: { receivedTripCount: 1, receivedLoadedQty: trip.loading.qty, receivedQty: result.receipt.qty } },
    );
  }
  if (result.locked) await lockedTripAlert(trip, material, result);
  return { trip, duplicate: false };
}

async function lockedTripAlert(trip, material, result) {
  const transporter = await Transporter.findById(trip.transporter, 'name').lean();
  const isBagged = material.kind === MATERIAL_KINDS.BAGGED;
  const lines = [
    `Truck ${formatVehicleNo(trip.vehicleNo)} (${transporter?.name}), trip ${trip.tripNo}.`,
    ...trip.flags.filter((f) => LOCKING_FLAGS.has(f)).map((f) => `• ${TRIP_FLAG_LABELS[f]}`),
    `Loaded ${formatQty(trip.loading.net)} net, received ${formatQty(trip.receipt.net)} net (${formatPct(result.variance.lossPct)} loss, allowed ${formatPct(result.variance.tolerancePct)}).`,
  ];
  if (isBagged) {
    const b = trip.receipt.bags;
    lines.push(`Bags: billed ${b.invoice}, good ${b.sound}, torn ${b.burst}, hard/wet ${b.lumpy}, light ${b.underweight}, missing ${b.missing}${b.excess ? `, extra ${b.excess}` : ''}.`);
  }
  lines.push(`Deduction from truck payment: ${formatINR(result.freight.deduction)}. Truck payment is ON HOLD until you review.`);
  await raiseAlert({
    type: isBagged ? ALERT_TYPES.BAG_DAMAGE : ALERT_TYPES.TRANSIT_LOSS,
    severity: ALERT_SEVERITY.CRITICAL,
    title: `Payment on hold — ${trip.tripNo}`,
    lines,
    trip: trip._id,
    consignment: trip.consignment,
  });
}

// ----------------------------------------------------------------------------
// Owner corrections and cancellation
// ----------------------------------------------------------------------------

/** Owner-only weight correction. Re-runs every check and posts stock / invoice differences. */
export async function correctTrip({ trip, input, user }) {
  const [material, settings, order, destination] = await Promise.all([
    Material.findById(trip.material),
    getSettings(),
    trip.order ? Order.findById(trip.order) : null,
    Location.findById(trip.destination),
  ]);
  const before = { loading: { gross: trip.loading.gross, tare: trip.loading.tare, net: trip.loading.net }, receipt: trip.receipt?.net ? { gross: trip.receipt.gross, tare: trip.receipt.tare, net: trip.receipt.net } : undefined };
  const isBagged = material.kind === MATERIAL_KINDS.BAGGED;

  if (input.loadingGross || input.loadingTare) {
    const gross = input.loadingGross ?? trip.loading.gross;
    const tare = input.loadingTare ?? trip.loading.tare;
    const net = netWeight(gross, tare);
    const qtyDiff = isBagged ? 0 : round(net - trip.loading.qty);
    // A weighbridge correction turns a bag-count loading into a weighed one.
    Object.assign(trip.loading, { method: WEIGH_METHODS.WEIGHT, gross, tare, net, qty: isBagged ? trip.loading.qty : net });
    if (qtyDiff) {
      if (trip.consignment) await Consignment.updateOne({ _id: trip.consignment }, { $inc: { liftedQty: qtyDiff, ...(trip.status === TRIP_STATUS.RECEIVED ? { receivedLoadedQty: qtyDiff } : {}) } });
      else await move({ location: trip.sourceLocation, material: material._id, unit: material.unit, qty: -qtyDiff, reason: 'correction', trip: trip._id, by: user._id });
      if (order) await Order.updateOne({ _id: order._id }, { $inc: { dispatchedQty: qtyDiff } });
    }
    Object.assign(trip.freight, freightSettlement({ loadedQty: trip.loading.qty, rate: trip.freight.rate, pricePerTruck: trip.freight.pricePerTruck, advance: trip.freight.advance, deduction: trip.freight.deduction }));
  }

  if (trip.status === TRIP_STATUS.RECEIVED) {
    const b = trip.receipt.bags ?? {};
    const result = evaluateReceipt({
      trip,
      material,
      settings,
      order,
      receivedAt: trip.receipt.at,
      input: {
        grossWeight: input.receiptGross ?? trip.receipt.gross,
        tareWeight: input.receiptTare ?? trip.receipt.tare,
        sound: b.sound,
        burst: b.burst,
        lumpy: b.lumpy,
        underweight: b.underweight,
        underweightAvgKg: b.underweightAvgKg,
      },
    });
    const qtyDiff = round(result.receipt.qty - trip.receipt.qty);
    if (qtyDiff && destination.type === LOCATION_TYPES.STOCKYARD && !isBagged) {
      await move({ location: destination._id, material: material._id, unit: material.unit, qty: qtyDiff, reason: 'correction', trip: trip._id, by: user._id });
    }
    if (qtyDiff && trip.consignment) await Consignment.updateOne({ _id: trip.consignment }, { $inc: { receivedQty: qtyDiff } });
    if (order && !isBagged) {
      const billedDiff = round(result.billedQty - trip.receipt.net);
      if (billedDiff) {
        await Order.updateOne({ _id: order._id }, { $inc: { deliveredQty: billedDiff } });
        await Invoice.updateOne({ trip: trip._id }, { $set: { amount: result.invoiceAmount } });
      }
    }
    Object.assign(trip.receipt, result.receipt);
    trip.variance = result.variance;
    trip.flags = result.flags;
    if (trip.freight.status !== FREIGHT_STATUS.PAID) {
      Object.assign(trip.freight, result.freight);
      trip.freight.waived = false;
    }
  }
  await trip.save();
  return { before, after: { loading: { gross: trip.loading.gross, tare: trip.loading.tare, net: trip.loading.net }, receipt: trip.receipt?.net ? { gross: trip.receipt.gross, tare: trip.receipt.tare, net: trip.receipt.net } : undefined } };
}

export async function cancelTrip({ trip, reason, user }) {
  if (trip.status !== TRIP_STATUS.IN_TRANSIT) throw badRequest('Only trucks still on the road can be cancelled.');
  const material = await Material.findById(trip.material);
  trip.status = TRIP_STATUS.CANCELLED;
  trip.cancelReason = reason;
  trip.freight.status = FREIGHT_STATUS.ON_HOLD;
  await trip.save();
  if (trip.consignment) await Consignment.updateOne({ _id: trip.consignment }, { $inc: { tripCount: -1, liftedQty: -trip.loading.qty } });
  else await move({ location: trip.sourceLocation, material: material._id, unit: material.unit, qty: trip.loading.qty, reason: 'cancel', trip: trip._id, by: user._id });
  if (trip.order) await Order.updateOne({ _id: trip.order }, { $inc: { dispatchedQty: -trip.loading.qty } });
  return trip;
}
