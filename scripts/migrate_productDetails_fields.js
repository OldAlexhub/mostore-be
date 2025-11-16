#!/usr/bin/env node
/*
  Migration script: standardize productDetails keys in Orders documents.
  Dry-run by default. Use --write to persist changes.
*/
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import OrderModel from '../models/Orders.js';

dotenv.config();

const MONGO = process.env.MONGO_URI || process.env.MONGO || '';
if (!MONGO) {
  console.error('MONGO_URI not provided. Set environment variable and retry.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const write = argv.indexOf('--write') !== -1;

async function run() {
  await mongoose.connect(MONGO, {});
  console.log('Connected to DB');

  const cursor = OrderModel.find({}).cursor();
  let count = 0;
  let changed = 0;
  for await (const ord of cursor) {
    count += 1;
    let modified = false;
    if (Array.isArray(ord.products)) {
      ord.products.forEach(p => {
        if (!p.productDetails) return;
        const pd = p.productDetails;
        // copy capitalized -> lowercase if missing
        if ((typeof pd.sell === 'undefined' || pd.sell === null) && (typeof pd.Sell !== 'undefined')) { pd.sell = pd.Sell; modified = true; }
        if ((typeof pd.cost === 'undefined' || pd.cost === null) && (typeof pd.Cost !== 'undefined')) { pd.cost = pd.Cost; modified = true; }
        if ((typeof pd.number === 'undefined' || pd.number === null) && (typeof pd.Number !== 'undefined')) { pd.number = pd.Number; modified = true; }
        if ((typeof pd.name === 'undefined' || pd.name === null) && (typeof pd.Name !== 'undefined')) { pd.name = pd.Name; modified = true; }
      });
    }
    if (modified) {
      changed += 1;
      console.log(`[DRY] would update order ${ord._id}`);
      if (write) {
        await ord.save();
        console.log(`  wrote ${ord._id}`);
      }
    }
  }
  console.log(`Scanned ${count} orders. Modified candidates: ${changed}. write=${write}`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
