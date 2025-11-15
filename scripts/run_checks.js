import dotenv from 'dotenv';
import mongoose from 'mongoose';
import OrderModel from '../models/Orders.js';
import ProductModel from '../models/products.js';

dotenv.config({ path: './.env' });

const run = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('MONGO_URI not set in environment (.env expected in server/)');
      process.exit(2);
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected.');

    const productCount = await ProductModel.countDocuments();
    console.log('Product count:', productCount);
    const orderCount = await OrderModel.countDocuments();
    console.log('Order count:', orderCount);

    const sampleProduct = await ProductModel.findOne().lean();
    console.log('Sample product:', sampleProduct ? { _id: sampleProduct._id, Name: sampleProduct.Name, cost: sampleProduct.cost, QTY: sampleProduct.QTY } : 'none');

    // Run inventory insights aggregation mimic
    const days = 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const soldAgg = await OrderModel.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', soldQty: { $sum: '$products.quantity' } } },
      { $sort: { soldQty: -1 } },
      { $limit: 5 }
    ]);
    console.log('Top sold agg (sample):', soldAgg);

    // Quick P&L check (revenue and cogs)
    const plMatch = { createdAt: { $gte: since } };
    const revenueAgg = await OrderModel.aggregate([
      { $match: plMatch },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' } } }
    ]);
    console.log('Revenue (since 30d):', revenueAgg[0]?.revenue || 0);

    await mongoose.disconnect();
    console.log('Disconnected and done.');
    process.exit(0);
  } catch (err) {
    console.error('Error during checks:', err && (err.stack || err.message || err));
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
};

run();
