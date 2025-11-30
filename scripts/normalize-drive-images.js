#!/usr/bin/env node
import dotenv from 'dotenv';
import connectToDB from '../db/connectToDB.js';
import ProductModel from '../models/products.js';

dotenv.config();

const normalizeDrive = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const driveFile = trimmed.match(/https?:\/\/(?:www\.)?drive\.google\.com\/file\/d\/([^\/\?]+)/i);
    if (driveFile && driveFile[1]) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
    const openMatch = trimmed.match(/https?:\/\/(?:www\.)?drive\.google\.com\/open\?id=([^&]+)/i);
    if (openMatch && openMatch[1]) return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
    const thumbMatch = trimmed.match(/https?:\/\/(?:www\.)?drive\.google\.com\/thumbnail\?id=([^&]+)/i);
    if (thumbMatch && thumbMatch[1]) return `https://drive.google.com/uc?export=view&id=${thumbMatch[1]}`;
    const ucMatch = trimmed.match(/https?:\/\/(?:www\.)?drive\.google\.com\/uc\?id=([^&]+)/i);
    if (ucMatch && ucMatch[1]) return `https://drive.google.com/uc?export=view&id=${ucMatch[1]}`;
  } catch (err) {
    // fallthrough
  }
  return trimmed;
};

const normalizeGalleryInput = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => (v || '').toString().trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const run = async ({ write = false, limit = 0 } = {}) => {
  await connectToDB();
  console.log('Scanning products for Drive links...');
  const cursor = ProductModel.find().cursor();
  let updated = 0;
  let toUpdate = 0;
  let scanned = 0;
  const samples = [];
  for await (const doc of cursor) {
    scanned += 1;
    const imageUrl = normalizeDrive(doc.imageUrl || '');
    const secondaryImageUrl = normalizeDrive(doc.secondaryImageUrl || '');
    const gallery = normalizeGalleryInput(doc.imageGallery || doc.images || '');
    const resolvedGallery = gallery.map(normalizeDrive).filter(Boolean);

    // combine while preserving order and dedup
    const combined = [];
    const seen = new Set();
    const push = (v) => {
      if (!v) return;
      if (seen.has(v)) return;
      seen.add(v);
      combined.push(v);
    };
    push(imageUrl);
    push(secondaryImageUrl);
    resolvedGallery.forEach(push);

    const MAX = 20;
    const limited = combined.slice(0, MAX);

    const next = {
      imageUrl: limited[0] || '',
      secondaryImageUrl: limited[1] || '',
      imageGallery: limited.slice(2)
    };

    // detect changes
    const changed = (
      (doc.imageUrl || '') !== (next.imageUrl || '') ||
      (doc.secondaryImageUrl || '') !== (next.secondaryImageUrl || '') ||
      JSON.stringify(doc.imageGallery || []) !== JSON.stringify(next.imageGallery || [])
    );

    if (changed) {
      toUpdate += 1;
      if (samples.length < 10) samples.push({ _id: doc._id.toString(), before: { imageUrl: doc.imageUrl || '', secondaryImageUrl: doc.secondaryImageUrl || '', imageGallery: doc.imageGallery || [] }, after: next });
      if (write) {
        await ProductModel.updateOne({ _id: doc._id }, { $set: next });
        updated += 1;
        console.log(`Updated ${doc._id} -> images: ${limited.length}`);
      }
    }

    if (limit > 0 && scanned >= limit) break;
  }
  if (write) console.log(`Done. Scanned: ${scanned}, Updated: ${updated}`);
  else console.log(`Dry-run complete. Scanned: ${scanned}, WouldUpdate: ${toUpdate}`);
  if (samples.length) {
    console.log('Sample changes (up to 10):');
    for (const s of samples) console.log(JSON.stringify(s, null, 2));
  }
  process.exit(0);
};

// CLI args
const args = process.argv.slice(2);
const write = args.includes('--write') || args.includes('-w');
const limitIndex = args.findIndex(a => a === '--limit' || a === '-l');
let limit = 0;
if (limitIndex >= 0 && args[limitIndex + 1]) limit = parseInt(args[limitIndex + 1], 10) || 0;

console.log('normalize-drive-images.js - mode:', write ? 'WRITE' : 'DRY-RUN', 'limit:', limit || 'none');
run({ write, limit }).catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
