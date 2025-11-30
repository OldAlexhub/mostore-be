#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { enrichImagePayload } from '../controllers/productsController.js';
import ProductModel from '../models/products.js';

dotenv.config();

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/mostore';

// Use server controller's enrichImagePayload so testing uses same logic

async function run() {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const exampleDriveLink = 'https://drive.google.com/file/d/12BXwo_F30SedwdgAVRRrMtEJ75f1o2DY/view?usp=sharing';
    const payload = {
      Name: 'SmokeTest - Drive Image',
      Sell: 1,
      cost: 0,
      imageUrl: exampleDriveLink,
      imageGallery: [exampleDriveLink]
    };
    const normalized = await enrichImagePayload(payload);
    console.log('Normalized payload:', normalized);

    // Insert the document into DB (will trigger schema validation / pre hooks)
    const created = await ProductModel.create(normalized);
    console.log('Created product _id:', created._id.toString());
    const fetched = await ProductModel.findById(created._id).lean();
    console.log('Stored document:', fetched);

    // Cleanup: remove the test product to avoid polluting DB
    await ProductModel.deleteOne({ _id: created._id });
    console.log('Cleaned up test product');
  } catch (err) {
    console.error('Error during smoke test:', err && (err.stack || err.message || err));
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
