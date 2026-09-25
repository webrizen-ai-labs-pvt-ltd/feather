import mongoose from 'mongoose';
import { round, STOCK_GRADES } from '@feather/shared';
import { StockMovement } from '@/models/index.js';

export function move({ location, material, unit, qty, grade = STOCK_GRADES.PRIME, reason, trip, stockCount, note, by }) {
  if (!qty) return null;
  return StockMovement.create({ location, material, unit, qty: round(qty), grade, reason, trip, stockCount, note, by });
}

export async function bookQty(location, material, grade = STOCK_GRADES.PRIME) {
  const [row] = await StockMovement.aggregate([
    {
      $match: {
        location: new mongoose.Types.ObjectId(String(location)),
        material: new mongoose.Types.ObjectId(String(material)),
        grade,
      },
    },
    { $group: { _id: null, qty: { $sum: '$qty' } } },
  ]);
  return round(row?.qty ?? 0);
}

/** Book stock for every location / material / grade. */
export function bookStock(match = {}) {
  return StockMovement.aggregate([
    { $match: match },
    { $group: { _id: { location: '$location', material: '$material', grade: '$grade' }, qty: { $sum: '$qty' }, unit: { $first: '$unit' } } },
    { $lookup: { from: 'locations', localField: '_id.location', foreignField: '_id', as: 'location' } },
    { $lookup: { from: 'materials', localField: '_id.material', foreignField: '_id', as: 'material' } },
    {
      $project: {
        _id: 0,
        location: { $arrayElemAt: ['$location', 0] },
        material: { $arrayElemAt: ['$material', 0] },
        grade: '$_id.grade',
        qty: { $round: ['$qty', 3] },
        unit: 1,
      },
    },
    { $project: { 'location._id': 1, 'location.name': 1, 'location.type': 1, 'material._id': 1, 'material.name': 1, 'material.unit': 1, grade: 1, qty: 1, unit: 1 } },
    { $sort: { 'location.name': 1, 'material.name': 1, grade: 1 } },
  ]);
}
