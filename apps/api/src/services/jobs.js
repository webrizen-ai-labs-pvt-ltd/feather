/**
 * Background watchdog. Runs inside the API process every few minutes:
 *  - warns the owner before a rake / ship runs out of free time
 *  - warns about trucks on the road much longer than normal
 */
import {
  ALERT_SEVERITY,
  ALERT_TYPES,
  CONSIGNMENT_STATUS,
  formatHours,
  formatINR,
  formatQty,
  formatVehicleNo,
  shipmentDemurrage,
  TRIP_FLAGS,
  TRIP_STATUS,
} from '@feather/shared';
import { Consignment, Trip } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { getSettings } from '@/services/settings.js';

const EVERY_MS = 5 * 60_000;
const SEVERITY_ORDER = ['ok', 'at_risk', 'overdue'];

async function checkDemurrage(settings) {
  const placed = await Consignment.find({ status: CONSIGNMENT_STATUS.PLACED }).populate('location', 'name');
  for (const c of placed) {
    const clock = shipmentDemurrage(c, { warnHours: settings.demurrageWarnHours });
    const last = c.demurrage?.lastAlertStatus ?? 'ok';
    // Alert only when things get worse, so the owner is not spammed every 5 minutes.
    if (SEVERITY_ORDER.indexOf(clock.status) <= SEVERITY_ORDER.indexOf(last)) continue;
    const ref = c.referenceNo;
    await raiseAlert({
      type: ALERT_TYPES.DEMURRAGE_RISK,
      severity: clock.status === 'overdue' ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
      title: clock.status === 'overdue' ? `Late fee started — ${ref}` : `Running late — ${ref}`,
      lines: [
        `${c.location?.name}: ${formatQty(clock.remainingQty, c.unit)} still to lift.`,
        `Free hours left: ${formatHours(clock.remainingFreeHours)}. Current speed: ${formatQty(clock.liftRatePerHour, c.unit)} per hour.`,
        clock.requiredRatePerHour ? `Needed speed: ${formatQty(clock.requiredRatePerHour, c.unit)} per hour — send more trucks.` : 'Send more trucks now.',
        clock.projectedPenalty ? `Expected late fee at this speed: ${formatINR(clock.projectedPenalty)}.` : '',
      ].filter(Boolean),
      consignment: c._id,
    });
    c.set('demurrage.lastAlertStatus', clock.status);
    await c.save();
  }
}

async function checkDelayedTrips(settings) {
  const now = Date.now();
  const trips = await Trip.find({ status: TRIP_STATUS.IN_TRANSIT, delayAlertedAt: null }).populate('transporter', 'name');
  for (const t of trips) {
    const expected = (t.expectedTransitHours ?? settings.defaultExpectedTransitHours) * settings.slowTransitFactor;
    const hours = (now - new Date(t.loading.at)) / 3_600_000;
    if (hours <= expected) continue;
    t.delayAlertedAt = new Date();
    t.flags.addToSet(TRIP_FLAGS.SLOW_TRANSIT);
    await t.save();
    await raiseAlert({
      type: ALERT_TYPES.DELAYED_TRIP,
      title: `Truck delayed — ${formatVehicleNo(t.vehicleNo)}`,
      lines: [
        `Trip ${t.tripNo} (${t.transporter?.name}) has been on the road for ${formatHours(hours)}.`,
        `Normal time is ${formatHours(t.expectedTransitHours ?? settings.defaultExpectedTransitHours)}. Call the driver: ${t.driverPhone ?? '—'}.`,
      ],
      trip: t._id,
      email: false,
    });
  }
}

export function startJobs() {
  const run = async () => {
    try {
      const settings = await getSettings();
      await checkDemurrage(settings);
      await checkDelayedTrips(settings);
    } catch (err) {
      console.error('[jobs] failed:', err);
    }
  };
  setTimeout(run, 10_000);
  return setInterval(run, EVERY_MS);
}
