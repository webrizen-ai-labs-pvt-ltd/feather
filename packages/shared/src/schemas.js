/**
 * Validation shared by the API and the forms. Messages are written in simple
 * English because they are shown directly to field staff.
 */
import { z } from 'zod';
import {
  CONSIGNMENT_MODES,
  LOCATION_TYPES,
  MATERIAL_KINDS,
  ROLES,
  STOCK_GRADES,
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
  active: z.boolean().default(true),
});

export const locationSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter location name'),
    type: z.enum(Object.values(LOCATION_TYPES)),
    address: optional(z.string().trim()),
    customer: optionalId,
    expectedTransitHours: optional(positive('Transit hours')),
    active: z.boolean().default(true),
  })
  .refine((v) => v.type !== LOCATION_TYPES.CUSTOMER_SITE || v.customer, {
    path: ['customer'],
    message: 'Choose the customer for this site',
  });

export const transporterSchema = z.object({
  name: z.string().trim().min(2, 'Enter truck company name'),
  phone: optional(phoneSchema),
  gstin: optional(z.string().trim().toUpperCase()),
  defaultRatePerUnit: optional(nonNegative('Truck rate')),
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
export const consignmentSchema = z.object({
  mode: z.enum(Object.values(CONSIGNMENT_MODES)),
  referenceNo: z.string().trim().min(3, 'Enter the shipment paper number'),
  supplier: z.string().trim().min(2, 'Enter supplier'),
  material: objectId,
  location: objectId,
  declaredQty: positive('Quantity on Paper no.'),
  wagonCount: optional(wholeCount('Wagon count')),
  freeTimeHours: positive('Free hours'),
  demurrageRatePerWagonHour: optional(nonNegative('Late fee rate')),
  purchaseRatePerUnit: optional(nonNegative('Purchase rate')),
  freightRatePerUnit: optional(nonNegative('Truck rate')),
  expectedAt: optional(z.coerce.date()),
  notes: optional(z.string().trim()),
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
    grossWeight: positive('Full truck weight'),
    tareWeight: positive('Empty truck weight'),
    loadedBags: optional(wholeCount('Bags loaded')),
    slipNo: optional(z.string().trim()),
    overrideReason: optional(z.string().trim().min(5, 'Write a short reason')),
    ...clientMeta,
  })
  .refine((v) => Boolean(v.consignment) !== Boolean(v.sourceLocation), {
    path: ['consignment'],
    message: 'Choose a shipment, or a warehouse — not both',
  })
  .refine((v) => v.grossWeight > v.tareWeight, {
    path: ['grossWeight'],
    message: 'Full truck weight must be more than empty truck weight',
  });

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
