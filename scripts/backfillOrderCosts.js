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
    const cursor = OrderModel.find().cursor();
    let updated = 0, scanned = 0;
    for (let order = await cursor.next(); order != null; order = await cursor.next()) {
      scanned++;
      let changed = false;
      for (const line of order.products) {
        if (!line.productDetails) continue;
        // if Cost is missing or null/undefined, fill from product
        if (typeof line.productDetails.Cost === 'undefined' || line.productDetails.Cost === null) {
          const pid = line.product;
          let prod = null;
          try { prod = await ProductModel.findById(pid).select('cost'); } catch (e) { /* ignore */ }
          const costVal = (prod && typeof prod.cost !== 'undefined') ? prod.cost : 0;
          line.productDetails.Cost = costVal;
          changed = true;
        }
      }
      if (changed) {
        if (!dryRun) {
          await order.save();
        }
        updated++;
        console.log(`${dryRun ? '[dry]' : ''} Updated order ${order._id}`);
      }
    }
    console.log('Scanned', scanned, 'orders. Updated', updated, dryRun ? '(dry run - no writes)' : '');
  } finally {
    await mongoose.disconnect();
  }
}

const args = process.argv.slice(2);
const dry = !(args.includes('--write') || args.includes('-w'));
backfill(dry).catch(err => { console.error(err); process.exit(1); });
