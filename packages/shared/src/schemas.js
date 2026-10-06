/**
 * Validation shared by the API and the forms. Messages are written in simple
 * English because they are shown directly to field staff.
 */
import { z } from 'zod';
import {
  CONSIGNMENT_MODES,
  DOCUMENT_KINDS,
  LATE_FEE_BASIS,
  LOCATION_TYPES,
  MATERIAL_KINDS,
  PAPER_UNITS,
  ROLES,
  ROUTED_LOCATION_TYPES,
  STOCK_GRADES,
  UNLOADING_POINT_TYPES,
  WEIGH_METHODS,
} from './constants.js';
import { normalizeVehicleNo } from './format.js';

const blankToUndefined = (v) => (v === '' || v === null || v === 'null' || v === 'undefined' ? undefined : v);

const num = (label) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: `Enter ${label}` }).refine(Number.isFinite, `Enter ${label}`));
const positive = (label) => num(label).refine((v) => v > 0, `${label} must be more than 0`);
const nonNegative = (label) => num(label).refine((v) => v >= 0, `${label} cannot be negative`);
const wholeCount = (label) =>
  num(label).refine((v) => Number.isInteger(v) && v >= 0, `${label} must be a whole number`);
const optional = (schema) => z.preprocess(blankToUndefined, schema.optional());

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Please choose from the list');
const optionalId = z.preprocess(blankToUndefined, objectId.optional());

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10 digit mobile number'));

export const vehicleNoSchema = z
  .string()
  .transform(normalizeVehicleNo)
  .pipe(z.string().regex(/^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/, 'Enter a correct truck number, like MH12AB1234'));

export const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits');

// ---------- Auth ----------
export const otpRequestSchema = z.object({ email: z.email('Enter a correct email') });
export const otpVerifySchema = z.object({
  email: z.email('Enter a correct email'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code'),
});
export const pinLoginSchema = z.object({ phone: phoneSchema, pin: pinSchema });

// ---------- Masters ----------
export const userSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter name'),
    role: z.enum(Object.values(ROLES)),
    email: optional(z.email('Enter a correct email')),
    phone: optional(phoneSchema),
    pin: optional(pinSchema),
    locations: z.array(objectId).default([]),
    active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    const office = v.role === ROLES.OWNER || v.role === ROLES.DISPATCH_OPERATOR;
    if (office && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email is needed for office login' });
    if (!office && !v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Phone is needed for field login' });
  });

export const materialSchema = z.object({
  name: z.string().trim().min(2, 'Enter material name'),
  kind: z.enum(Object.values(MATERIAL_KINDS)),
  bagWeightKg: optional(positive('Bag weight')),
  transitLossTolerancePct: optional(nonNegative('Tolerance')),
  densityTPerM3: optional(positive('Density')),
  landedCostPerUnit: optional(nonNegative('Your cost')),
  /** Who we buy this product from. Required. */
  seller: z.preprocess(blankToUndefined, z.string({ error: 'Choose the seller' }).regex(/^[a-f\d]{24}$/i, 'Please choose from the list')),
  active: z.boolean().default(true),
});

const routeSchema = z.object({
  from: objectId,
  distanceKm: positive('Distance'),
  pricePerTruck: nonNegative('Price per truck'),
});

export const locationSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter location name'),
    type: z.enum(Object.values(LOCATION_TYPES)),
    address: optional(z.string().trim()),
    customer: optionalId,
    expectedTransitHours: optional(positive('Transit hours')),
    routes: z.array(routeSchema).default([]),
    // Unloading labour at a railway station / port.
    labourCostPerWagon: optional(nonNegative('Labour cost per wagon')),
    labourCostPerTruck: optional(nonNegative('Labour cost per truck')),
    labourCostPerKg: optional(nonNegative('Labour cost per kg')),
    active: z.boolean().default(true),
  })
  .refine((v) => v.type !== LOCATION_TYPES.CUSTOMER_SITE || v.customer, {
    path: ['customer'],
    message: 'Choose the customer for this site',
  })
  .superRefine((v, ctx) => {
    const seen = new Set();
    v.routes.forEach((r, i) => {
      if (seen.has(r.from)) ctx.addIssue({ code: 'custom', path: ['routes', i, 'from'], message: 'This unloading point is already added' });
      seen.add(r.from);
    });
  })
  // Routes belong to warehouses / delivery sites, labour costs to stations / ports. Clear what does not apply
  // (an undefined key is removed on save, so a type change also drops the old values).
  .transform((v) => ({
    ...v,
    routes: ROUTED_LOCATION_TYPES.includes(v.type) ? v.routes : [],
    ...(UNLOADING_POINT_TYPES.includes(v.type) ? {} : { labourCostPerWagon: undefined, labourCostPerTruck: undefined, labourCostPerKg: undefined }),
  }));

export const transporterSchema = z.object({
  name: z.string().trim().min(2, 'Enter truck company name'),
  phone: optional(phoneSchema),
  gstin: optional(z.string().trim().toUpperCase()),
  defaultRatePerUnit: optional(nonNegative('Truck rate')),
  active: z.boolean().default(true),
});

/** Sellers: who we buy material from (owner only). */
export const sellerSchema = z.object({
  name: z.string().trim().min(2, 'Enter seller name'),
  contactPerson: optional(z.string().trim()),
  phone: optional(phoneSchema),
  email: optional(z.email('Enter a correct email')),
  gstin: optional(z.string().trim().toUpperCase()),
  address: optional(z.string().trim()),
  active: z.boolean().default(true),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter customer name'),
  phone: optional(phoneSchema),
  email: optional(z.email('Enter a correct email')),
  gstin: optional(z.string().trim().toUpperCase()),
  creditLimit: optional(nonNegative('Credit limit')),
  creditDays: optional(wholeCount('Credit days')),
  active: z.boolean().default(true),
});

// ---------- Consignments ----------
export const consignmentSchema = z
  .object({
    mode: z.enum(Object.values(CONSIGNMENT_MODES)),
    referenceNo: z.string().trim().min(3, 'Enter the shipment paper number'),
    /** Who we bought it from. Blank = the product's seller. */
    seller: optionalId,
    /** Old free-text supplier name; set from the seller now. */
    supplier: optional(z.string().trim().min(2, 'Enter supplier')),
    material: objectId,
    location: objectId,
    /** Quantity as written on the paper, in declaredUnit (KG / Metric Tonne / Bags). Blank unit = already in the product's unit. */
    declaredQty: positive('Quantity'),
    declaredUnit: z.preprocess(blankToUndefined, z.enum(Object.values(PAPER_UNITS)).optional()),
    wagonCount: optional(wholeCount('Wagons')),
    freeTimeHours: positive('Free hours'),
    /** Late fee: how it is charged (per hour / per day / one time) and the amount — per wagon for a train. */
    demurrageBasis: z.preprocess(blankToUndefined, z.enum(Object.values(LATE_FEE_BASIS)).default(LATE_FEE_BASIS.HOUR)),
    demurrageRate: optional(nonNegative('Late fee amount')),
    /** Total amount on the seller's bill for this shipment (owner only). */
    purchaseAmount: optional(nonNegative('Total billing amount')),
    /** Seller's invoice number for this shipment (owner only). */
    invoiceNo: optional(z.string().trim().max(60, 'Invoice number is too long')),
    /** Not on the form any more (price per truck / truck company rate is used); kept for older API callers. */
    freightRatePerUnit: optional(nonNegative('Truck rate')),
    /** Date the material was manufactured (from the seller's bill or the bag print). */
    manufacturedAt: optional(z.coerce.date({ error: 'Enter a correct date' })),
    expectedAt: optional(z.coerce.date()),
    notes: optional(z.string().trim()),
  })
  .refine((v) => v.mode !== CONSIGNMENT_MODES.RAIL_RAKE || v.wagonCount > 0, {
    path: ['wagonCount'],
    message: 'Enter the number of wagons',
  })
  // Compared by day (India time for "today"): made on the day it arrives, or today, is fine.
  .refine((v) => !v.manufacturedAt || v.manufacturedAt.toISOString().slice(0, 10) <= new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10), {
    path: ['manufacturedAt'],
    message: 'Date of manufacturing cannot be in the future',
  })
  .refine((v) => !v.manufacturedAt || !v.expectedAt || v.manufacturedAt.toISOString().slice(0, 10) <= v.expectedAt.toISOString().slice(0, 10), {
    path: ['manufacturedAt'],
    message: 'Date of manufacturing cannot be after the expected arrival',
  });

// ---------- Trips ----------
const geoFields = {
  lat: optional(num('latitude')),
  lng: optional(num('longitude')),
  accuracy: optional(num('accuracy')),
};

const clientMeta = {
  clientId: z.string().uuid('Bad request id'),
  deviceTime: optional(z.coerce.date()),
  wasOffline: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(false),
  ...geoFields,
};

export const loadingSchema = z
  .object({
    consignment: optionalId,
    sourceLocation: optionalId,
    order: optionalId,
    destination: objectId,
    vehicleNo: vehicleNoSchema,
    driverName: z.string().trim().min(2, 'Enter driver name'),
    driverPhone: phoneSchema,
    transporter: objectId,
    weighMethod: z.preprocess(blankToUndefined, z.enum(Object.values(WEIGH_METHODS)).default(WEIGH_METHODS.WEIGHT)),
    grossWeight: optional(positive('Full truck weight')),
    tareWeight: optional(positive('Empty truck weight')),
    loadedBags: optional(wholeCount('Bags loaded')),
    slipNo: optional(z.string().trim()),
    overrideReason: optional(z.string().trim().min(5, 'Write a short reason')),
    /** A different price per truck than the owner quoted — goes to the owner for approval. */
    truckPrice: optional(nonNegative('New price per truck')),
    truckPriceReason: optional(z.string().trim().min(5, 'Write why the price is different')),
    /** A different unloading labour cost for this truck than the owner set — also needs approval. */
    labourCost: optional(nonNegative('New labour cost')),
    labourCostReason: optional(z.string().trim().min(5, 'Write why the labour cost is different')),
    ...clientMeta,
  })
  .refine((v) => v.truckPrice === undefined || v.truckPriceReason, {
    path: ['truckPriceReason'],
    message: 'Write why the price is different',
  })
  .refine((v) => v.labourCost === undefined || v.labourCostReason, {
    path: ['labourCostReason'],
    message: 'Write why the labour cost is different',
  })
  .refine((v) => Boolean(v.consignment) !== Boolean(v.sourceLocation), {
    path: ['consignment'],
    message: 'Choose a shipment, or a warehouse — not both',
  })
  .superRefine((v, ctx) => {
    if (v.weighMethod === WEIGH_METHODS.BAGS) {
      if (!v.loadedBags) ctx.addIssue({ code: 'custom', path: ['loadedBags'], message: 'Enter number of bags loaded' });
      return;
    }
    if (v.grossWeight === undefined) ctx.addIssue({ code: 'custom', path: ['grossWeight'], message: 'Enter Full truck weight' });
    if (v.tareWeight === undefined) ctx.addIssue({ code: 'custom', path: ['tareWeight'], message: 'Enter Empty truck weight' });
    if (v.grossWeight !== undefined && v.tareWeight !== undefined && v.grossWeight <= v.tareWeight) {
      ctx.addIssue({ code: 'custom', path: ['grossWeight'], message: 'Full truck weight must be more than empty truck weight' });
    }
  })
  // Bag-count loading has no weighbridge reading — drop any numbers left in the boxes.
  .transform((v) => (v.weighMethod === WEIGH_METHODS.BAGS ? { ...v, grossWeight: undefined, tareWeight: undefined } : v));

export const receiptSchema = z
  .object({
    grossWeight: positive('Full truck weight'),
    tareWeight: positive('Empty truck weight'),
    slipNo: optional(z.string().trim()),
    sound: optional(wholeCount('Good bags')),
    burst: optional(wholeCount('Torn bags')),
    lumpy: optional(wholeCount('Hard / wet bags')),
    underweight: optional(wholeCount('Light bags')),
    underweightAvgKg: optional(positive('Average weight of light bags')),
    remarks: optional(z.string().trim().max(500)),
    ...clientMeta,
  })
  .refine((v) => v.grossWeight > v.tareWeight, {
    path: ['grossWeight'],
    message: 'Full truck weight must be more than empty truck weight',
  })
  .refine((v) => !(v.underweight > 0) || v.underweightAvgKg, {
    path: ['underweightAvgKg'],
    message: 'Weigh a few light bags and enter their average weight',
  });

export const assignOrderSchema = z.object({
  order: objectId,
  overrideReason: optional(z.string().trim().min(5, 'Write a short reason')),
});

export const breakdownSchema = z.object({ note: z.string().trim().min(3, 'Write what happened') });

export const reasonSchema = z.object({ reason: z.string().trim().min(5, 'Write a short reason') });

export const tripCorrectionSchema = z.object({
  reason: z.string().trim().min(5, 'Write a short reason'),
  loadingGross: optional(positive('Full weight at loading')),
  loadingTare: optional(positive('Empty weight at loading')),
  receiptGross: optional(positive('Full weight at receiving')),
  receiptTare: optional(positive('Empty weight at receiving')),
});

export const advanceSchema = z.object({ advance: nonNegative('Advance') });

export const noteSchema = z.object({ note: optional(z.string().trim().max(500)) });

/** Loading staff mark a train wagon fully empty (or undo a wrong tap). */
export const wagonMarkSchema = z.object({
  no: num('Wagon number').refine((v) => Number.isInteger(v) && v >= 1, 'Wagon number must be 1 or more'),
  emptied: z.preprocess((v) => v === true || v === 'true', z.boolean()),
  deviceTime: optional(z.coerce.date()),
  wasOffline: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(false),
});

/** Fields sent with an uploaded document (the file itself comes as multipart "file"). */
export const documentUploadSchema = z.object({
  kind: z.preprocess(blankToUndefined, z.enum(Object.values(DOCUMENT_KINDS)).default(DOCUMENT_KINDS.OTHER)),
});

// ---------- Orders, money, stock ----------
export const orderSchema = z.object({
  customer: objectId,
  material: objectId,
  deliverySite: objectId,
  qty: positive('Quantity'),
  ratePerUnit: nonNegative('Rate'),
  notes: optional(z.string().trim()),
});

export const paymentSchema = z.object({
  amount: positive('Amount'),
  receivedAt: optional(z.coerce.date()),
  reference: optional(z.string().trim()),
});

export const invoiceSchema = z.object({
  amount: positive('Amount'),
  invoiceDate: optional(z.coerce.date()),
  reference: optional(z.string().trim()),
});

export const creditOverrideSchema = z.object({
  reason: z.string().trim().min(5, 'Write a short reason'),
  hours: z.coerce.number().int().min(1).max(168).default(24),
  maxUses: z.coerce.number().int().min(1).max(50).default(1),
});

export const stockCountSchema = z.object({
  location: objectId,
  material: objectId,
  grade: z.enum(Object.values(STOCK_GRADES)).default(STOCK_GRADES.PRIME),
  physicalQty: nonNegative('Counted quantity'),
  method: optional(z.string().trim()),
  ...clientMeta,
});

export const settingsSchema = z.object({
  defaultTransitLossTolerancePct: nonNegative('Tolerance'),
  defaultCreditLimit: nonNegative('Credit limit'),
  defaultCreditDays: wholeCount('Credit days'),
  defaultExpectedTransitHours: positive('Transit hours'),
  slowTransitFactor: positive('Slow factor'),
  tareDeviationPct: nonNegative('Empty weight deviation'),
  tareMismatchTons: nonNegative('Empty weight mismatch'),
  burstDiscountPct: nonNegative('Burst discount'),
  chargeBurstLossToTransporter: z.boolean(),
  demurrageWarnHours: nonNegative('Warn hours'),
  stockMismatchPct: nonNegative('Stock mismatch'),
  shelfLifeDays: wholeCount('Shelf life'),
  shelfLifeWarnDays: wholeCount('Use-first warning'),
  alertEmails: z.array(z.email()).default([]),
});

/** Turn a ZodError into { field: message } for forms. */
export function fieldErrors(error) {
  const out = {};
  for (const issue of error?.issues ?? []) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
