/**
 * Role-based shaping of API responses. The server removes what a role must not
 * see — hiding it only in the frontend is not enough.
 */
import { canSeeBothEnds, canSeeMoney, canSeePurchasePrices, ROLES } from '@feather/shared';
import { fileUrl } from '@/services/storage.js';

const plain = (doc) => (doc?.toObject ? doc.toObject({ virtuals: false }) : { ...doc });

export function presentMaterial(doc, role) {
  const m = plain(doc);
  if (!canSeePurchasePrices(role)) delete m.landedCostPerUnit;
  return m;
}

export function presentConsignment(doc, role) {
  const c = plain(doc);
  if (!canSeePurchasePrices(role)) delete c.purchaseRatePerUnit;
  if (!canSeeMoney(role)) {
    delete c.freightRatePerUnit;
    delete c.demurrageRatePerWagonHour;
    if (c.demurrage) delete c.demurrage.finalPenalty;
  }
  // Field staff should not see how much has been received at the other end.
  if (!canSeeBothEnds(role)) {
    delete c.receivedQty;
    delete c.receivedLoadedQty;
  }
  if (c.material && typeof c.material === 'object') c.material = presentMaterial(c.material, role);
  return c;
}

export function presentOrder(doc, role) {
  const o = plain(doc);
  if (!canSeeMoney(role)) delete o.ratePerUnit;
  return o;
}

const withPhotoUrl = async (side) => {
  if (side?.photo?.key) side.photo = { ...side.photo, url: await fileUrl(side.photo.key) };
  return side;
};

/**
 * @param {object} doc Trip document or lean object
 * @param {object} user Current user
 * @param {{ photos?: boolean }} opts Add signed photo links (detail views only)
 */
export async function presentTrip(doc, user, { photos = false } = {}) {
  const t = plain(doc);
  const role = user.role;
  if (t.material && typeof t.material === 'object') t.material = presentMaterial(t.material, role);
  if (t.order && typeof t.order === 'object') t.order = presentOrder(t.order, role);
  if (t.consignment && typeof t.consignment === 'object') t.consignment = presentConsignment(t.consignment, role);

  if (!canSeeMoney(role)) {
    delete t.freight;
    delete t.credit;
  }
  if (!canSeeBothEnds(role)) {
    // Blind entry: each side sees only its own numbers.
    delete t.variance;
    delete t.flags;
    if (role === ROLES.GATE_INSPECTOR) {
      t.loading = { at: t.loading?.at };
    }
    if (role === ROLES.SIDING_SUPERVISOR) {
      t.receipt = t.receipt?.at ? { at: t.receipt.at, grnNo: t.receipt.grnNo } : undefined;
    }
  }
  if (photos) {
    await withPhotoUrl(t.loading);
    await withPhotoUrl(t.receipt);
  } else {
    if (t.loading?.photo) t.loading.photo = { hasPhoto: true };
    if (t.receipt?.photo) t.receipt.photo = { hasPhoto: true };
  }
  return t;
}

export const presentTrips = (docs, user) => Promise.all(docs.map((d) => presentTrip(d, user)));
