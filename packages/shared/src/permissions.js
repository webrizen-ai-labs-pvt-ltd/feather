import { ROLES } from './constants.js';

const { OWNER, SIDING_SUPERVISOR, GATE_INSPECTOR, DISPATCH_OPERATOR } = ROLES;

/** Purchase price, landed cost and margins — owner only. */
export const canSeePurchasePrices = (role) => role === OWNER;

/** Sale rates, freight, deductions — owner and dispatch office. Never field staff. */
export const canSeeMoney = (role) => role === OWNER || role === DISPATCH_OPERATOR;

/**
 * Blind entry: field staff never see the weight or bag count recorded at the
 * other end of a trip, so they cannot type a number that "matches".
 */
export const canSeeBothEnds = (role) => role === OWNER || role === DISPATCH_OPERATOR;

/** Route groups of the Operations app and which roles can open them. */
export const OPS_ROUTE_ACCESS = Object.freeze({
  loading: [SIDING_SUPERVISOR, OWNER],
  gate: [GATE_INSPECTOR, OWNER],
  dispatch: [DISPATCH_OPERATOR, OWNER],
  rakes: [SIDING_SUPERVISOR, DISPATCH_OPERATOR, OWNER],
  stockCount: [GATE_INSPECTOR, OWNER],
});

export const OWNER_APP_ROLES = Object.freeze([OWNER]);
export const OPS_APP_ROLES = Object.freeze([SIDING_SUPERVISOR, GATE_INSPECTOR, DISPATCH_OPERATOR, OWNER]);

export const canAccess = (group, role) => Boolean(OPS_ROUTE_ACCESS[group]?.includes(role));

/** Where a user lands after login in the Operations app. */
export const OPS_HOME_BY_ROLE = Object.freeze({
  siding_supervisor: '/loading',
  gate_inspector: '/gate',
  dispatch_operator: '/dispatch',
  owner: '/dispatch',
});
