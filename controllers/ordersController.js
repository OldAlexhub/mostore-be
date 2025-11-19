import OrderModel from '../models/Orders.js';
import ProductModel from '../models/products.js';
import PromotionModel from '../models/Promotions.js';
import StoreDiscountModel from '../models/StoreDiscount.js';
import UserModel from '../models/users.js';

const THIRTY_MIN_MS = 30 * 60 * 1000;
const CANCELLED_STATUSES = new Set(['cancelled', 'refunded']);
const COMPLETED_STATUSES = new Set(['delivered']);
const IN_PROGRESS_STATUSES = new Set(['pending', 'paid', 'processing', 'shipped']);

const PHONE_DIGIT_COUNT = 11;

const normalizePhone = (value = '') => String(value || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
const isValidPhoneNumber = (value = '') => normalizePhone(value).length === PHONE_DIGIT_COUNT;

const normalizeImageValue = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
};

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const pickImageFromSource = (source) => {
  if (!source || typeof source !== 'object') return '';
  const candidates = [
    source.imageUrl,
    source.image,
    source.mainImage,
    source.thumbnail,
    source.thumbnailUrl,
    source.secondaryImageUrl,
    source.photo
  ];
  for (const candidate of candidates) {
    const normalized = normalizeImageValue(candidate);
    if (normalized) return normalized;
  }
  const galleryCandidates = [...toArray(source.imageGallery), ...toArray(source.images)];
  for (const candidate of galleryCandidates) {
    const normalized = normalizeImageValue(candidate);
    if (normalized) return normalized;
  }
  return '';
};

const resolvePrimaryImage = (...sources) => {
  for (const candidateSource of sources) {
    if (!candidateSource) continue;
    if (typeof candidateSource === 'string') {
      const normalized = normalizeImageValue(candidateSource);
      if (normalized) return normalized;
      continue;
    }
    const resolved = pickImageFromSource(candidateSource);
    if (resolved) return resolved;
  }
  return '';
};

const canCancelOrder = (order) => {
  if (!order) return false;
  const status = order.status;
  if (!status) return false;
  if (CANCELLED_STATUSES.has(status) || status === 'shipped' || status === 'delivered') return false;
  const created = new Date(order.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return (Date.now() - created) <= THIRTY_MIN_MS;
};

const toPublicOrderSummary = (doc) => {
  const order = doc?.toObject ? doc.toObject() : doc;
  const cancellable = canCancelOrder(order);
  const cancelableUntil = cancellable && order.createdAt
    ? new Date(new Date(order.createdAt).getTime() + THIRTY_MIN_MS)
    : null;
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    totalPrice: order.totalPrice,
    shippingFee: order.shippingFee || 0,
    userDetails: order.userDetails,
    canCancel: cancellable,
    cancelableUntil
  };
};

const toPublicOrderDetail = (doc) => {
  const base = toPublicOrderSummary(doc);
  const order = doc?.toObject ? doc.toObject() : doc;
  return {
    ...base,
    products: order.products,
    discountAmount: order.discountAmount,
    originalTotalPrice: order.originalTotalPrice,
    storeDiscountAmount: order.storeDiscountAmount,
    storeDiscount: order.storeDiscount,
    coupon: order.coupon,
    shippingFee: order.shippingFee || 0
  };
};

export const createOrder = async (req, res) => {
  try {
    const userId = req.user && req.user.id;

    const { products: incoming = [], totalPrice } = req.body || {};
    if (!Array.isArray(incoming) || incoming.length === 0) return res.status(400).json({ error: 'No products provided' });

    // determine customer details: registered user OR guest-provided details
    let user = null;
    let userDetails = {};
    if (userId) {
      user = await UserModel.findById(userId).select('-password -refreshToken');
      if (!user) return res.status(400).json({ error: 'User not found' });
      const normalizedUserPhone = user.phoneNumber ? normalizePhone(user.phoneNumber) : '';
      userDetails = {
        username: user.username,
        Address: user.Address || '',
        phoneNumber: normalizedUserPhone
      };
    } else {
      // guest checkout: require a reachable phone number with an exact digit count
      const name = (req.body && (req.body.name || (req.body.userDetails && req.body.userDetails.username))) || '';
      const address = (req.body && (req.body.address || (req.body.userDetails && req.body.userDetails.Address))) || '';
      const phone = (req.body && (req.body.phone || (req.body.userDetails && req.body.userDetails.phoneNumber))) || '';
      if (!isValidPhoneNumber(phone)) {
        return res.status(400).json({ error: `رقم الموبايل لازم يكون ${PHONE_DIGIT_COUNT} رقم.` });
      }
      const normalizedGuestPhone = normalizePhone(phone);
      userDetails = { username: name || 'Guest', Address: address || '', phoneNumber: normalizedGuestPhone };
    }

    // prepare products array by fetching product details from DB
    const productPromises = incoming.map(async p => {
      const pid = p.product || p.productId || p._id;
      const qty = p.qty || p.quantity || 1;
      if (!pid) throw new Error('Invalid product id');
      const prod = await ProductModel.findById(pid);
      if (!prod) throw new Error(`Product not found: ${pid}`);
      const availableQty = Number(prod.QTY ?? 0);
      if (availableQty <= 0) throw new Error(`${prod.Name || 'المنتج'} غير متوفر حالياً`);
      if (qty > availableQty) throw new Error(`${prod.Name || 'المنتج'} متاح بكمية ${availableQty} فقط`);
      const numberValue = prod.Number ?? prod.number ?? 0;
      const productImage = resolvePrimaryImage(prod);
      return {
          product: prod._id,
          productDetails: {
            // keep legacy capitalized keys for backward-compatibility
            Number: numberValue,
            Name: prod.Name,
            Sell: prod.Sell,
            Cost: prod.cost || 0,
            Category: prod.Category,
            Subcategory: prod.Subcategory,
            Material: prod.Material,
            Season: prod.Season,
            Style: prod.Style,
            // product image (if available)
            imageUrl: productImage || undefined,
            // also populate lowercase keys for future-proofing / standardization
            number: numberValue,
            name: prod.Name,
            sell: prod.Sell,
            cost: prod.cost || 0
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
    let promoToIncrement = null;
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
      promoToIncrement = promo;
    }

    // store config (discount + shipping)
    let storeDiscountAmount = 0;
    let appliedStoreDiscount = null;
    let shippingFee = 0;
    let storeConfig = null;
    try {
      storeConfig = await StoreDiscountModel.findOne();
    } catch (e) {
      storeConfig = null;
    }
    if (storeConfig && storeConfig.active && storeConfig.value > 0) {
      const meetsThreshold = storeConfig.type === 'general' || baseTotal >= (storeConfig.minTotal || 0);
      if (meetsThreshold) {
        storeDiscountAmount = Math.round(baseTotal * (storeConfig.value / 100) * 100) / 100;
        if (storeDiscountAmount > baseTotal) storeDiscountAmount = baseTotal;
        appliedStoreDiscount = {
          type: storeConfig.type,
          value: storeConfig.value,
          minTotal: storeConfig.type === 'threshold' ? (storeConfig.minTotal || 0) : 0
        };
      }
    }
    if (storeConfig && storeConfig.shipping && storeConfig.shipping.enabled && storeConfig.shipping.amount > 0) {
      shippingFee = Math.max(0, storeConfig.shipping.amount);
    }

    const finalTotal = Math.max(0, Math.round((baseTotal - discountAmount - storeDiscountAmount + shippingFee) * 100) / 100);

    const stockAdjustments = [];
    const rollbackStockAdjustments = async () => {
      if (!stockAdjustments.length) return;
      await Promise.all(
        stockAdjustments.map(adj => ProductModel.updateOne({ _id: adj.productId }, { $inc: { QTY: adj.qty } }))
      );
      stockAdjustments.length = 0;
    };

    try {
      for (const item of products) {
        const updated = await ProductModel.findOneAndUpdate(
          { _id: item.product, QTY: { $gte: item.quantity } },
          { $inc: { QTY: -item.quantity } },
          { new: true }
        );
        if (!updated) {
          throw new Error(`${item.productDetails?.Name || 'المنتج'} غير متاح بالكمية المطلوبة`);
        }
        stockAdjustments.push({ productId: item.product, qty: item.quantity });
      }
    } catch (stockErr) {
      await rollbackStockAdjustments();
      return res.status(400).json({ error: stockErr.message || 'لا توجد كمية كافية للمنتج المطلوب' });
    }

    // generate a short random 5-digit order number (string, zero-padded) and ensure uniqueness
    const generateOrderNumber = () => String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    let orderNumber = generateOrderNumber();
    let attempts = 0;
    while (await OrderModel.findOne({ orderNumber })) {
      orderNumber = generateOrderNumber();
      attempts += 1;
      if (attempts > 10) break;
    }

    const orderData = {
      user: user ? user._id : undefined,
      userDetails,
      orderNumber,
      products,
      totalPrice: finalTotal,
      originalTotalPrice: baseTotal,
      discountAmount,
      coupon: appliedCoupon,
      storeDiscountAmount,
      storeDiscount: appliedStoreDiscount,
      shippingFee
    };

    const order = new OrderModel(orderData);
    try {
      await order.save();
    } catch (saveErr) {
      await rollbackStockAdjustments();
      throw saveErr;
    }
    if (promoToIncrement) {
      try {
        promoToIncrement.usedCount = (promoToIncrement.usedCount || 0) + 1;
        await promoToIncrement.save();
      } catch (promoErr) {
        // ignore usage count failure to avoid blocking order
        console.warn('[orders] failed to increment promo usage', promoErr?.message);
      }
    }
    // return only limited fields for guests? We return the created order (admin can fetch full)
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// public: lookup order by short order number (guest receipt/tracking)
export const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) return res.status(400).json({ error: 'Order number required' });
    const order = await OrderModel.findOne({ orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const phone = (req.query && req.query.phone) || (req.body && req.body.phone) || '';
    if (!phone) return res.status(400).json({ error: 'Phone number required to view this receipt' });
    if (normalizePhone(order.userDetails && order.userDetails.phoneNumber) !== normalizePhone(phone)) {
      return res.status(403).json({ error: 'Phone number does not match order' });
    }
    res.json(toPublicOrderDetail(order));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const trackOrdersByPhone = async (req, res) => {
  try {
    const phone = (req.query && req.query.phone) || '';
    const normalized = normalizePhone(phone);
    if (!normalized) return res.status(400).json({ error: 'Phone number is required' });
    const orders = await OrderModel.find({ 'userDetails.phoneNumber': normalized }).sort({ createdAt: -1 }).lean();
    const grouped = { inProgress: [], completed: [], cancelled: [] };
    for (const order of orders) {
      const summary = toPublicOrderSummary(order);
      // attach a small thumbnail (first product image) when available for UI list previews
      const firstProduct = Array.isArray(order.products) && order.products.length ? order.products[0] : null;
      const firstImage = resolvePrimaryImage(firstProduct, firstProduct?.productDetails);
      if (firstImage) summary.firstProductImage = firstImage;
      if (CANCELLED_STATUSES.has(order.status)) grouped.cancelled.push(summary);
      else if (COMPLETED_STATUSES.has(order.status)) grouped.completed.push(summary);
      else grouped.inProgress.push(summary);
    }
    res.json({
      phone: normalized,
      summary: {
        total: orders.length,
        inProgress: grouped.inProgress.length,
        completed: grouped.completed.length,
        cancelled: grouped.cancelled.length
      },
      grouped
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const cancelOrderByPhone = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const phone = (req.body && req.body.phone) || (req.query && req.query.phone) || '';
    if (!orderNumber || !phone) return res.status(400).json({ error: 'Order number and phone are required' });
    const order = await OrderModel.findOne({ orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (normalizePhone(order.userDetails && order.userDetails.phoneNumber) !== normalizePhone(phone)) {
      return res.status(403).json({ error: 'Phone number does not match order' });
    }
    if (!canCancelOrder(order)) {
      return res.status(400).json({ error: 'Order can no longer be cancelled' });
    }
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    res.json({ message: 'Order cancelled', order: toPublicOrderDetail(order) });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (!userId || !order.user || order.user.toString() !== userId) return res.status(403).json({ error: 'Access denied' });
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

export const getOrderCustomers = async (req, res) => {
  try {
    const customers = await OrderModel.aggregate([
      { $match: { 'userDetails.phoneNumber': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$userDetails.phoneNumber',
          name: { $last: '$userDetails.username' },
          address: { $last: '$userDetails.Address' },
          totalOrders: { $sum: 1 },
          totalSpend: { $sum: '$totalPrice' },
          lastOrderAt: { $max: '$createdAt' }
        }
      },
      { $sort: { lastOrderAt: -1 } }
    ]);
    const mapped = customers.map(c => ({
      phoneNumber: c._id,
      name: c.name || '',
      address: c.address || '',
      totalOrders: c.totalOrders || 0,
      totalSpend: c.totalSpend || 0,
      lastOrderAt: c.lastOrderAt
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const exportOrderCustomersCsv = async (req, res) => {
  try {
    const customers = await OrderModel.aggregate([
      { $match: { 'userDetails.phoneNumber': { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$userDetails.phoneNumber',
          name: { $last: '$userDetails.username' },
          address: { $last: '$userDetails.Address' },
          totalOrders: { $sum: 1 },
          totalSpend: { $sum: '$totalPrice' },
          lastOrderAt: { $max: '$createdAt' }
        }
      },
      { $sort: { lastOrderAt: -1 } }
    ]);
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const header = ['phoneNumber', 'name', 'address', 'totalOrders', 'totalSpend', 'lastOrderAt'];
    const rows = customers.map(c => ({
      phoneNumber: c._id,
      name: c.name || '',
      address: c.address || '',
      totalOrders: c.totalOrders || 0,
      totalSpend: c.totalSpend || 0,
      lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt).toISOString() : ''
    }));
    const csv = [header.join(',')]
      .concat(rows.map(r => header.map(h => escape(r[h])).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
