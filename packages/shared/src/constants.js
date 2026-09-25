export const APP_NAME = 'Feather';
export const COMPANY_NAME = 'Webrizen AI Labs Pvt Ltd';

export const ROLES = Object.freeze({
  OWNER: 'owner',
  SIDING_SUPERVISOR: 'siding_supervisor',
  GATE_INSPECTOR: 'gate_inspector',
  DISPATCH_OPERATOR: 'dispatch_operator',
});

export const ROLE_LABELS = Object.freeze({
  owner: 'Owner / Finance',
  siding_supervisor: 'Loading / Siding Supervisor',
  gate_inspector: 'Yard / Gate Inspector',
  dispatch_operator: 'Dispatch & Logistics',
});

/** Office roles log in with an email OTP. Field roles log in with phone + PIN. */
export const EMAIL_LOGIN_ROLES = Object.freeze([ROLES.OWNER, ROLES.DISPATCH_OPERATOR]);
export const PIN_LOGIN_ROLES = Object.freeze([ROLES.SIDING_SUPERVISOR, ROLES.GATE_INSPECTOR]);

export const CONSIGNMENT_MODES = Object.freeze({
  RAIL_RAKE: 'rail_rake',
  RIVER_BARGE: 'river_barge',
  COASTAL_SHIP: 'coastal_ship',
});

export const CONSIGNMENT_MODE_LABELS = Object.freeze({
  rail_rake: 'Railway rake',
  river_barge: 'River barge',
  coastal_ship: 'Coastal ship',
});

/** Rail uses a Railway Receipt (RR); water uses a Bill of Lading (BL). */
export const REFERENCE_TYPE_BY_MODE = Object.freeze({
  rail_rake: 'RR',
  river_barge: 'BL',
  coastal_ship: 'BL',
});

export const CONSIGNMENT_STATUS = Object.freeze({
  EXPECTED: 'expected', // on the way, not yet at siding / wharf
  PLACED: 'placed', // at siding, free-time clock is running
  RELEASED: 'released', // rake / hold emptied and released
  CLOSED: 'closed', // all trips received and reconciled
});

export const CONSIGNMENT_STATUS_LABELS = Object.freeze({
  expected: 'On the way',
  placed: 'Unloading',
  released: 'Released',
  closed: 'Closed',
});

export const MATERIAL_KINDS = Object.freeze({
  BAGGED: 'bagged', // cement in 50 kg bags — counted in bags
  BULK: 'bulk', // sand, aggregate, soil — weighed in MT
});

export const UNITS = Object.freeze({
  BAG: 'bag',
  MT: 'MT',
});

export const LOCATION_TYPES = Object.freeze({
  SIDING: 'siding',
  PORT: 'port',
  STOCKYARD: 'stockyard',
  CUSTOMER_SITE: 'customer_site',
});

export const LOCATION_TYPE_LABELS = Object.freeze({
  siding: 'Railway siding',
  port: 'Port / wharf',
  stockyard: 'Stockyard',
  customer_site: 'Customer site',
});

export const TRIP_SOURCE = Object.freeze({
  CONSIGNMENT: 'consignment', // lifted from a rake / ship
  STOCKYARD: 'stockyard', // dispatched from our own yard
});

export const TRIP_STATUS = Object.freeze({
  IN_TRANSIT: 'in_transit',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
});

export const TRIP_STATUS_LABELS = Object.freeze({
  in_transit: 'On the road',
  received: 'Received',
  cancelled: 'Cancelled',
});

export const FREIGHT_STATUS = Object.freeze({
  ON_HOLD: 'on_hold', // truck not yet received — nothing payable
  LOCKED: 'locked', // loss / damage found — owner must review
  READY: 'ready', // cleared — balance can be paid
  PAID: 'paid',
});

export const FREIGHT_STATUS_LABELS = Object.freeze({
  on_hold: 'Waiting for receipt',
  locked: 'Locked — needs review',
  ready: 'Ready to pay',
  paid: 'Paid',
});

/**
 * Bag buckets recorded at unloading. The inspector counts the first four
 * physically; "missing" is always calculated by the system (invoice − counted)
 * so the inspector cannot adjust it to match the paperwork.
 */
export const BAG_BUCKETS = Object.freeze([
  { key: 'sound', label: 'Good bags', help: 'Bag is fine. Goes to saleable stock.' },
  { key: 'burst', label: 'Torn / burst bags', help: 'Cement is clean. Will be re-bagged and sold at discount.' },
  { key: 'lumpy', label: 'Hard / wet bags', help: 'Cement has set or is lumpy. Rejected.' },
  { key: 'underweight', label: 'Light bags', help: 'Bag looks full but weighs less. Weigh a few and enter average.' },
]);

export const STOCK_GRADES = Object.freeze({
  PRIME: 'prime',
  SECONDS: 'seconds', // re-bagged burst cement, sold at discount
  REJECTED: 'rejected',
});

export const STOCK_GRADE_LABELS = Object.freeze({
  prime: 'Prime (saleable)',
  seconds: 'Seconds (discount)',
  rejected: 'Rejected',
});

export const TRIP_FLAGS = Object.freeze({
  TRANSIT_LOSS: 'transit_loss',
  WEIGHT_GAIN: 'weight_gain',
  BAG_DAMAGE: 'bag_damage',
  BAG_SHORTAGE: 'bag_shortage',
  BAG_EXCESS: 'bag_excess',
  TARE_HISTORY: 'tare_history',
  TARE_MISMATCH: 'tare_mismatch',
  SLOW_TRANSIT: 'slow_transit',
  BREAKDOWN: 'breakdown',
  OFFLINE_ENTRY: 'offline_entry',
  CREDIT_OVERRIDE: 'credit_override',
});

export const TRIP_FLAG_LABELS = Object.freeze({
  transit_loss: 'Weight lost on the road',
  weight_gain: 'Weight increased on the road (water added?)',
  bag_damage: 'Damaged bags',
  bag_shortage: 'Bags missing',
  bag_excess: 'More bags counted than billed',
  tare_history: 'Empty truck weight is unusual for this vehicle',
  tare_mismatch: 'Empty truck weight differs between the two weighbridges',
  slow_transit: 'Took much longer than normal',
  breakdown: 'Breakdown reported',
  offline_entry: 'Entered while offline',
  credit_override: 'Sent under owner credit override',
});

export const ALERT_SEVERITY = Object.freeze({ INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' });

export const ALERT_TYPES = Object.freeze({
  TRANSIT_LOSS: 'transit_loss',
  BAG_DAMAGE: 'bag_damage',
  TARE_ANOMALY: 'tare_anomaly',
  DEMURRAGE_RISK: 'demurrage_risk',
  CREDIT_BLOCK: 'credit_block',
  CREDIT_OVERRIDE: 'credit_override',
  DELAYED_TRIP: 'delayed_trip',
  BREAKDOWN: 'breakdown',
  PIN_RESET: 'pin_reset',
  STOCK_MISMATCH: 'stock_mismatch',
});

export const DEFAULT_SETTINGS = Object.freeze({
  defaultTransitLossTolerancePct: 0.5,
  defaultCreditLimit: 2500000, // ₹25 Lakh
  defaultCreditDays: 45,
  defaultExpectedTransitHours: 6,
  slowTransitFactor: 1.5, // flag if trip takes 1.5× the expected time
  tareDeviationPct: 2, // flag if empty weight differs >2% from vehicle history
  tareMismatchTons: 0.3, // flag if loading tare vs unloading tare differ by >0.3 T
  burstDiscountPct: 20,
  chargeBurstLossToTransporter: false,
  demurrageWarnHours: 2, // warn when projected overrun is within this many hours of free time end
  stockMismatchPct: 1,
  alertEmails: [],
});

export const BRASS_CUBIC_FEET = 100;
export const CUBIC_METERS_PER_BRASS = 2.8317;

export const TIMEZONE = 'Asia/Kolkata';
