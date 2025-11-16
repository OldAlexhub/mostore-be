#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import OrderModel from '../models/Orders.js';
import ProductModel from '../models/products.js';

dotenv.config();

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/mostore';

async function backfill(dryRun = true) {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO);
  try {
    // Find products missing cost (undefined or null)
    const missing = await ProductModel.find({ $or: [ { cost: { $exists: false } }, { cost: null } ] }).select('_id Name').lean();
    console.log('Products missing cost:', missing.length);
    let updated = 0;

    for (const p of missing) {
      // Find most recent order that contains this product and has a productDetails.Cost
      // look for historical cost stored under either 'Cost' or 'cost' in order snapshots
      const ord = await OrderModel.findOne({ 'products.product': p._id, $or: [{ 'products.productDetails.Cost': { $ne: null } }, { 'products.productDetails.cost': { $ne: null } }] }).sort({ createdAt: -1 }).select('products').lean();
      if (!ord) {
        console.log(`[skip] ${p._id} ${p.Name} — no historical cost found`);
        continue;
      }
      // locate the matching product line
      const line = ord.products.find(lp => lp.product && String(lp.product) === String(p._id));
      const costVal = line && line.productDetails && ((typeof line.productDetails.Cost !== 'undefined') ? line.productDetails.Cost : ((typeof line.productDetails.cost !== 'undefined') ? line.productDetails.cost : null));
      if (costVal === null || typeof costVal === 'undefined') {
        console.log(`[skip] ${p._id} ${p.Name} — no cost in matched order`);
        continue;
      }
      console.log(`[found] ${p._id} ${p.Name} => cost ${costVal}`);
      if (!dryRun) {
        await ProductModel.updateOne({ _id: p._id }, { $set: { cost: Number(costVal) } });
        updated++;
      }
    }

    console.log('Done. Updated', updated, dryRun ? '(dry run - no writes)' : '');
  } finally {
    await mongoose.disconnect();
  }
}

const args = process.argv.slice(2);
const dry = !(args.includes('--write') || args.includes('-w'));
backfill(dry).catch(err => { console.error(err && (err.stack || err.message || err)); process.exit(1); });
