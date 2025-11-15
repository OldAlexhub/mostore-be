import OrderModel from '../models/Orders.js';
import ProductModel from '../models/products.js';
import PromotionModel from '../models/Promotions.js';
import UserModel from '../models/users.js';

export const createOrder = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { products: incoming = [], totalPrice } = req.body || {};
    if (!Array.isArray(incoming) || incoming.length === 0) return res.status(400).json({ error: 'No products provided' });

    // fetch user details
    const user = await UserModel.findById(userId).select('-password -refreshToken');
    if (!user) return res.status(400).json({ error: 'User not found' });

    // prepare products array by fetching product details from DB
    const productPromises = incoming.map(async p => {
      const pid = p.product || p.productId || p._id;
      const qty = p.qty || p.quantity || 1;
      if (!pid) throw new Error('Invalid product id');
      const prod = await ProductModel.findById(pid);
      if (!prod) throw new Error(`Product not found: ${pid}`);
      return {
        product: prod._id,
        productDetails: {
          Number: prod.Number,
          Name: prod.Name,
          Sell: prod.Sell,
          Cost: prod.cost || 0,
          Category: prod.Category,
          Subcategory: prod.Subcategory,
          Material: prod.Material,
          Season: prod.Season,
          Style: prod.Style
        },
        quantity: qty
      };
    });

    let products = [];
    try {
      products = await Promise.all(productPromises);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // compute base total
    const baseTotal = totalPrice || products.reduce((s, p) => s + ((p.productDetails?.Sell || 0) * p.quantity), 0);

    // coupon support
    let appliedCoupon = null;
    let discountAmount = 0;
    const couponCode = (req.body && req.body.couponCode) ? String(req.body.couponCode).trim().toUpperCase() : null;
    if (couponCode) {
      const promo = await PromotionModel.findOne({ code: couponCode });
      if (!promo || !promo.active) return res.status(400).json({ error: 'Invalid or inactive coupon' });
      const now = new Date();
      if (promo.startsAt && promo.startsAt > now) return res.status(400).json({ error: 'Coupon not active yet' });
      if (promo.endsAt && promo.endsAt < now) return res.status(400).json({ error: 'Coupon expired' });
      if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return res.status(400).json({ error: 'Coupon usage limit reached' });

      if (promo.type === 'amount') discountAmount = promo.value;
      else if (promo.type === 'percent') discountAmount = Math.round((promo.value / 100) * baseTotal * 100) / 100;
      if (discountAmount > baseTotal) discountAmount = baseTotal;
      appliedCoupon = { code: promo.code, type: promo.type, value: promo.value };

      // increment usage count
      try { promo.usedCount = (promo.usedCount || 0) + 1; await promo.save(); } catch(e){ /* ignore */ }
    }

    const finalTotal = Math.max(0, Math.round((baseTotal - discountAmount) * 100) / 100);

    const order = new OrderModel({
      user: user._id,
      userDetails: {
        username: user.username,
        Address: user.Address || '',
        phoneNumber: user.phoneNumber || ''
      },
      products,
      totalPrice: finalTotal,
      originalTotalPrice: baseTotal,
      discountAmount,
      coupon: appliedCoupon
    });

    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    // Support filtering, pagination and simple search
    const { status, page = 1, limit = 50, since, q, user, coupon } = req.query || {};
    const filter = {};
    if (status) {
      // allow comma-separated statuses: status=shipped,delivered
      if (status.indexOf(',') !== -1) {
        const parts = status.split(',').map(s => s.trim()).filter(Boolean);
        filter.status = { $in: parts };
      } else {
        filter.status = status;
      }
    }
    if (since) {
      const d = new Date(since);
      if (!isNaN(d.getTime())) filter.createdAt = { $gte: d };
    }
    if (user) {
      filter.user = user;
    }
    if (coupon) {
      // support coupon code filtering (case-insensitive)
      filter['coupon.code'] = String(coupon).trim().toUpperCase();
    }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { 'userDetails.username': re },
        { 'userDetails.phoneNumber': re },
        { 'products.productDetails.Name': re },
        { _id: q }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));

    const total = await OrderModel.countDocuments(filter);
    const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * lim).limit(lim);
    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrdersSummary = async (req, res) => {
  try {
    const windowMin = parseInt(req.query.windowMin, 10) || 15; // minutes to consider "new"
    const since = new Date(Date.now() - windowMin * 60 * 1000);

    const pendingCount = await OrderModel.countDocuments({ status: 'pending' });
    const shippedCount = await OrderModel.countDocuments({ status: 'shipped' });
    const deliveredCount = await OrderModel.countDocuments({ status: 'delivered' });
    const cancelledCount = await OrderModel.countDocuments({ status: 'cancelled' });
    const newCount = await OrderModel.countDocuments({ status: 'pending', createdAt: { $gte: since } });

    const recentNew = await OrderModel.find({ status: 'pending', createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10);
    const recentCompleted = await OrderModel.find({ status: { $in: ['shipped', 'delivered'] } }).sort({ createdAt: -1 }).limit(10);

    res.json({ counts: { pending: pendingCount, shipped: shippedCount, delivered: deliveredCount, cancelled: cancelledCount, new: newCount }, recentNew, recentCompleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // ensure the requesting user owns the order OR is an admin/manager
    const requester = req.user && req.user.id;
    const role = req.user && req.user.role;
    const isAdmin = role === 'manager' || role === 'superadmin' || role === 'admin';
    if (!requester) return res.status(401).json({ error: 'Not authenticated' });
    if (!isAdmin && order.user.toString() !== requester) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateOrder = async (req, res) => {
  try {
    const order = await OrderModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await OrderModel.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const orders = await OrderModel.find({ user: userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const userId = req.user && req.user.id;
    if (!userId || order.user.toString() !== userId) return res.status(403).json({ error: 'Access denied' });
    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel an order that has already been shipped or delivered' });
    }
    // allow cancellation only within 30 minutes of order creation
    const created = new Date(order.createdAt).getTime();
    const now = Date.now();
    const thirtyMin = 30 * 60 * 1000;
    if (now - created > thirtyMin) {
      return res.status(400).json({ error: 'Cancellation window expired' });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    res.json({ message: 'Order cancelled', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const removeCoupon = async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!order.coupon || !order.coupon.code) return res.status(400).json({ error: 'No coupon applied' });

    const code = order.coupon.code;
    // attempt to decrement usage count
    try {
      const promo = await PromotionModel.findOne({ code });
      if (promo && promo.usedCount && promo.usedCount > 0) {
        promo.usedCount = Math.max(0, promo.usedCount - 1);
        await promo.save();
      }
    } catch (e) {
      // ignore promo update errors
    }

    // restore totals
    order.totalPrice = order.originalTotalPrice != null ? order.originalTotalPrice : order.totalPrice + (order.discountAmount || 0);
    order.discountAmount = 0;
    order.coupon = undefined;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
