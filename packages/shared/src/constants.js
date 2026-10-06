export const APP_NAME = 'Feather';
export const COMPANY_NAME = 'Webrizen AI Labs Pvt Ltd';

export const ROLES = Object.freeze({
  OWNER: 'owner',
  SIDING_SUPERVISOR: 'siding_supervisor',
  GATE_INSPECTOR: 'gate_inspector',
  DISPATCH_OPERATOR: 'dispatch_operator',
});

export const ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  siding_supervisor: 'Loading staff',
  gate_inspector: 'Receiving staff',
  dispatch_operator: 'Dispatch office',
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
  rail_rake: 'Train',
  river_barge: 'River barge',
  coastal_ship: 'Ship',
});

/** How the late fee (demurrage) is charged once free hours are over. Trains: per wagon. */
export const LATE_FEE_BASIS = Object.freeze({ HOUR: 'hour', DAY: 'day', ONCE: 'once' });
export const LATE_FEE_BASIS_LABELS = Object.freeze({ hour: 'Per hour', day: 'Per day', once: 'One time' });

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
  released: 'Emptied',
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

/**
 * Unit the quantity on a shipment paper is written in. Converted to the product's unit (MT or bags).
 * BAGS is stored as 'pieces' (its first name) so shipments already saved with it keep working.
 */
export const PAPER_UNITS = Object.freeze({ KG: 'kg', TONS: 'tons', BAGS: 'pieces' });
export const PAPER_UNIT_LABELS = Object.freeze({ kg: 'KG', tons: 'Metric Tonne (MT)', pieces: 'Bags' });

/** Documents attached to a shipment (bill, RR / BL…). Owner only. */
export const DOCUMENT_KINDS = Object.freeze({
  SELLER_BILL: 'seller_bill',
  SHIPMENT_PAPER: 'shipment_paper',
  WEIGHMENT: 'weighment',
  OTHER: 'other',
});
export const DOCUMENT_KIND_LABELS = Object.freeze({
  seller_bill: 'Seller bill',
  shipment_paper: 'RR / Bill of Lading',
  weighment: 'Weighment slip',
  other: 'Other',
});
/** PDF and pictures, up to 10 MB each. */
export const DOCUMENT_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
export const DOCUMENT_MAX_MB = 10;

/** How the loaded material weight is worked out at loading. Bag count works only for bagged material. */
export const WEIGH_METHODS = Object.freeze({
  WEIGHT: 'weight', // weighbridge: full truck − empty truck
  BAGS: 'bags', // bags loaded × bag weight
});

export const WEIGH_METHOD_LABELS = Object.freeze({
  weight: 'Full truck and empty truck weight',
  bags: 'Number of bags loaded',
});

export const LOCATION_TYPES = Object.freeze({
  SIDING: 'siding',
  PORT: 'port',
  STOCKYARD: 'stockyard',
  CUSTOMER_SITE: 'customer_site',
});

export const LOCATION_TYPE_LABELS = Object.freeze({
  siding: 'Railway station',
  port: 'Port',
  stockyard: 'Warehouse',
  customer_site: 'Delivery site',
});

/** Railway stations and ports — where shipments are unloaded. */
export const UNLOADING_POINT_TYPES = Object.freeze([LOCATION_TYPES.SIDING, LOCATION_TYPES.PORT]);
/** Places trucks are sent to. Each keeps its distance and truck price from every unloading point. */
export const ROUTED_LOCATION_TYPES = Object.freeze([LOCATION_TYPES.STOCKYARD, LOCATION_TYPES.CUSTOMER_SITE]);

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
  locked: 'On hold — needs review',
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
  prime: 'Good',
  seconds: 'Discount',
  rejected: 'Rejected',
});

/** Shelf life of a lot of stock (see shelfLife in calc.js). */
export const SHELF_STATUS_LABELS = Object.freeze({
  fresh: 'Fresh',
  soon: 'Use first',
  expired: 'Past shelf life',
  none: 'No shelf life',
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
  credit_override: 'Sent under owner special permission',
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
  TRUCK_PRICE_REQUEST: 'truck_price_request',
  LABOUR_COST_REQUEST: 'labour_cost_request',
});

/**
 * Owner rates on a trip from a shipment (price per truck, unloading labour per truck).
 * "quoted" = the owner's rate is used as is. A different amount asked for by loading staff
 * is "pending" until the owner approves or rejects it.
 */
export const PRICE_REQUEST_STATUS = Object.freeze({
  QUOTED: 'quoted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** The trip rates loading staff can ask to change. Key = field on the trip. */
export const PRICE_REQUEST_KINDS = Object.freeze({
  truckPrice: { label: 'Price per truck', alertType: ALERT_TYPES.TRUCK_PRICE_REQUEST, path: 'truck-price' },
  labourCost: { label: 'Labour cost per truck', alertType: ALERT_TYPES.LABOUR_COST_REQUEST, path: 'labour-cost' },
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
  shelfLifeDays: 90, // bagged cement: days from shipment arrival
  shelfLifeWarnDays: 15, // "use first" when this few days are left
  alertEmails: [],
});

export const BRASS_CUBIC_FEET = 100;
export const CUBIC_METERS_PER_BRASS = 2.8317;

export const TIMEZONE = 'Asia/Kolkata';
