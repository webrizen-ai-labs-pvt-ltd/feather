/**
 * pnpm --filter @feather/api backfill:stock-ids              → gives a stock ID to every lot received
 *                                                             before stock IDs existed
 * pnpm --filter @feather/api backfill:stock-ids -- --dry-run → only lists what it would do
 * Safe to run again: lots that already have a stock ID are left as they are.
 */
import { connectDb, disconnectDb } from '@/config/db.js';
import { Consignment, Location, Material } from '@/models/index.js';
import { backfillStockIds } from '@/services/stock.js';

const dryRun = process.argv.includes('--dry-run');
await connectDb();
const { existing, made } = await backfillStockIds({ dryRun });
const [locations, materials, shipments] = await Promise.all([
  Location.find({}, 'name').lean(),
  Material.find({}, 'name').lean(),
  Consignment.find({ _id: { $in: made.map((m) => m.lot).filter(Boolean) } }, 'referenceNo').lean(),
]);
const name = (list, id) => list.find((x) => String(x._id) === String(id));
console.log(`${existing} lot(s) already had a stock ID.`);
console.log(`${dryRun ? 'Would give' : 'Gave'} ${made.length} stock ID(s):`);
for (const m of made) {
  console.log(`  ${m.stockId}  ${name(locations, m.location)?.name} · ${name(materials, m.material)?.name} · ${m.lot ? name(shipments, m.lot)?.referenceNo : 'Older stock'}  (first in ${m.at.toISOString()})`);
}
await disconnectDb();
