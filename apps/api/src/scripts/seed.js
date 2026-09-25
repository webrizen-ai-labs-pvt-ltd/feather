/**
 * pnpm seed            → creates the owner account (OWNER_EMAIL) and default settings
 * pnpm seed -- --demo  → also adds sample masters, field users and one rake to try the flow
 * Safe to run again: existing records are left as they are.
 */
import bcrypt from 'bcryptjs';
import { CONSIGNMENT_MODES, DEFAULT_SETTINGS, LOCATION_TYPES, MATERIAL_KINDS, ROLES } from '@feather/shared';
import { connectDb, disconnectDb } from '@/config/db.js';
import { env } from '@/config/env.js';
import { Consignment, Customer, Location, Material, Setting, Transporter, User } from '@/models/index.js';

const demo = process.argv.includes('--demo');

async function upsert(Model, filter, data) {
  const found = await Model.findOne(filter);
  if (found) return found;
  const doc = new Model({ ...filter, ...data });
  await doc.save();
  console.log(`  + ${Model.modelName}: ${doc.name ?? doc.referenceNo ?? doc.email ?? doc._id}`);
  return doc;
}

await connectDb();

if (!env.ownerEmail) throw new Error('Set OWNER_EMAIL in apps/api/.env first.');
await upsert(User, { email: env.ownerEmail.toLowerCase() }, { name: env.ownerName, role: ROLES.OWNER });
await upsert(Setting, { _id: 'global' }, DEFAULT_SETTINGS);

if (demo) {
  console.log('Adding demo data…');
  const opc = await upsert(Material, { name: 'OPC 53 Cement' }, { kind: MATERIAL_KINDS.BAGGED, bagWeightKg: 50, transitLossTolerancePct: 0.2, landedCostPerUnit: 360 });
  await upsert(Material, { name: 'PPC Cement' }, { kind: MATERIAL_KINDS.BAGGED, bagWeightKg: 50, transitLossTolerancePct: 0.2, landedCostPerUnit: 330 });
  await upsert(Material, { name: 'Slag Cement' }, { kind: MATERIAL_KINDS.BAGGED, bagWeightKg: 50, transitLossTolerancePct: 0.2, landedCostPerUnit: 310 });
  const sand = await upsert(Material, { name: 'River Sand' }, { kind: MATERIAL_KINDS.BULK, transitLossTolerancePct: 0.5, densityTPerM3: 1.6, landedCostPerUnit: 1100 });
  const agg = await upsert(Material, { name: 'Crushed Aggregate 20mm' }, { kind: MATERIAL_KINDS.BULK, transitLossTolerancePct: 0.3, densityTPerM3: 1.5, landedCostPerUnit: 950 });
  await upsert(Material, { name: 'Backfill Soil' }, { kind: MATERIAL_KINDS.BULK, transitLossTolerancePct: 1, densityTPerM3: 1.4, landedCostPerUnit: 300 });

  const siding = await upsert(Location, { name: 'Main Rail Siding', type: LOCATION_TYPES.SIDING }, { address: 'Goods shed, platform 3' });
  await upsert(Location, { name: 'River Wharf', type: LOCATION_TYPES.PORT }, {});
  const yard = await upsert(Location, { name: 'North Stockyard', type: LOCATION_TYPES.STOCKYARD }, { expectedTransitHours: 3 });
  await upsert(Location, { name: 'South Stockyard', type: LOCATION_TYPES.STOCKYARD }, { expectedTransitHours: 4 });

  await upsert(Transporter, { name: 'Sharma Roadlines' }, { phone: '9811100001', defaultRatePerUnit: 180 });
  await upsert(Transporter, { name: 'Balaji Carriers' }, { phone: '9811100002', defaultRatePerUnit: 175 });
  await upsert(Transporter, { name: 'Om Sai Transport' }, { phone: '9811100003', defaultRatePerUnit: 170 });

  const customer = await upsert(Customer, { name: 'Skyline Infra Projects' }, { phone: '9822200001' });
  await upsert(Location, { name: 'Skyline — Tower B Site', type: LOCATION_TYPES.CUSTOMER_SITE }, { customer: customer._id, expectedTransitHours: 4 });

  const pinHash = await bcrypt.hash('1234', 10);
  await upsert(User, { phone: '9876500001' }, { name: 'Ramesh (Siding)', role: ROLES.SIDING_SUPERVISOR, pinHash, locations: [siding._id] });
  await upsert(User, { phone: '9876500002' }, { name: 'Suresh (Gate)', role: ROLES.GATE_INSPECTOR, pinHash, locations: [yard._id] });

  await upsert(
    Consignment,
    { referenceType: 'RR', referenceNo: 'RR-DEMO-0001' },
    { mode: CONSIGNMENT_MODES.RAIL_RAKE, supplier: 'Demo Quarry Ltd', material: agg._id, unit: 'MT', location: siding._id, declaredQty: 3200, wagonCount: 58, freeTimeHours: 7, demurrageRatePerWagonHour: 150, purchaseRatePerUnit: 700, freightRatePerUnit: 180 },
  );
  await upsert(
    Consignment,
    { referenceType: 'RR', referenceNo: 'RR-DEMO-0002' },
    { mode: CONSIGNMENT_MODES.RAIL_RAKE, supplier: 'Demo Cement Works', material: opc._id, unit: 'bag', location: siding._id, declaredQty: 50000, wagonCount: 42, freeTimeHours: 9, demurrageRatePerWagonHour: 150, purchaseRatePerUnit: 320, freightRatePerUnit: 8 },
  );
  void sand;
  console.log('\nDemo logins (Operations app):');
  console.log('  Siding supervisor  phone 9876500001  PIN 1234');
  console.log('  Gate inspector     phone 9876500002  PIN 1234');
  console.log(`  Owner / dispatch   email ${env.ownerEmail} (login code by email)`);
}

console.log('Seed done.');
await disconnectDb();
