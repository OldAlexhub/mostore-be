import mongoose from 'mongoose';
import OrderModel from '../models/Orders.js';
import ProductModel from '../models/products.js';

// Create or update product stock info. Body may include `product` (id), `currentQty` and `minQty`.
export const createInventory = async (req, res) => {
  try {
    const { product, currentQty, minQty } = req.body;
    if (!product) return res.status(400).json({ error: 'product id required' });
    const p = await ProductModel.findById(product);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    if (typeof currentQty !== 'undefined') p.QTY = Number(currentQty);
    if (typeof minQty !== 'undefined') p.minQty = Number(minQty);
    await p.save();
    res.status(200).json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getInventories = async (req, res) => {
  try {
    // Return products with basic stock fields
    const products = await ProductModel.find().select('Number Name QTY minQty').lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getInventoryInsights = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const topN = parseInt(req.query.top || 10, 10) || 10;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // aggregate sold quantities per product in the window (exclude cancelled orders)
    const soldAgg = await OrderModel.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', soldQty: { $sum: '$products.quantity' } } },
      { $sort: { soldQty: -1 } }
    ]);

    // load products and map by id
    const products = await ProductModel.find().lean();
    const prodMap = {};
    products.forEach(p => { prodMap[p._id.toString()] = p; });

    const soldList = soldAgg.map(s => ({
      productId: s._id ? s._id.toString() : '',
      soldQty: s.soldQty || 0,
      product: prodMap[s._id ? s._id.toString() : ''] || null
    }));

    // high demand: top N sold
    const highDemand = soldList.slice(0, topN);
    // slow selling: products with zero soldQty in window (normalize shape for compatibility)
    const soldIds = new Set(soldList.map(s => s.productId));
    const slowSelling = products.filter(p => !soldIds.has(p._id ? p._id.toString() : '')).slice(0, topN).map(p => ({ _id: p._id, Name: p.Name, currentQty: p.QTY || 0, minQty: p.minQty || 0 }));
    // low stock: QTY <= minQty or QTY <= 5
    const lowStock = products.filter(p => (p.QTY || 0) <= (p.minQty || 0) || (p.QTY || 0) <= 5).slice(0, topN).map(p => ({ _id: p._id, Name: p.Name, currentQty: p.QTY || 0, minQty: p.minQty || 0 }));

    res.json({ days, highDemand, slowSelling, lowStock, totalInventory: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getInventoryById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const product = await ProductModel.findById(id);
    if (!product) return res.status(404).json({ error: 'Product / Inventory not found' });
    res.json({ _id: product._id, Number: product.Number, Name: product.Name, currentQty: product.QTY, minQty: product.minQty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateInventory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const { currentQty, minQty } = req.body;
    const product = await ProductModel.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (typeof currentQty !== 'undefined') product.QTY = Number(currentQty);
    if (typeof minQty !== 'undefined') product.minQty = Number(minQty);
    await product.save();
    res.json({ _id: product._id, Number: product.Number, Name: product.Name, currentQty: product.QTY, minQty: product.minQty });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteInventory = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    // Instead of deleting a product, zero out stock fields to preserve product data
    const product = await ProductModel.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    product.QTY = 0;
    product.minQty = 0;
    await product.save();
    res.json({ message: 'Product stock cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
