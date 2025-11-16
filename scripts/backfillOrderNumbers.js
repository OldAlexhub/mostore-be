#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import OrderModel from '../models/Orders.js';

dotenv.config();

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/mostore';

async function backfill(dryRun = true) {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO);
  try {
    const missing = await OrderModel.find({ orderNumber: { $exists: false } }).select('_id createdAt').lean();
    console.log('Orders missing orderNumber:', missing.length);
    let updated = 0;

    const generateOrderNumber = () => String(Math.floor(Math.random() * 100000)).padStart(5, '0');

    for (const o of missing) {
      let attempts = 0;
      let orderNumber = generateOrderNumber();
      while (await OrderModel.findOne({ orderNumber })) {
        orderNumber = generateOrderNumber();
        attempts += 1;
        if (attempts > 20) break;
      }
      if (await OrderModel.findOne({ orderNumber })) {
        console.log(`[skip] ${o._id} — cannot find unique orderNumber after attempts`);
        continue;
      }
      console.log(`[assign] ${o._id} => ${orderNumber}`);
      if (!dryRun) {
        await OrderModel.updateOne({ _id: o._id }, { $set: { orderNumber } });
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
