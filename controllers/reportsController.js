import OrderModel from '../models/Orders.js';
import ProductModel from '../models/products.js';
import PromotionModel from '../models/Promotions.js';
import UserModel from '../models/users.js';

const escape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

export const exportProductsCsv = async (req, res) => {
  try {
    const items = await ProductModel.find().lean();
    const header = ['id','Number','Name','QTY','Sell','Category','Subcategory','Material','Season','Style'];
    const rows = items.map(p => ({
      id: p._id.toString(), Number: p.Number, Name: p.Name, QTY: p.QTY, Sell: p.Sell,
      Category: p.Category || '', Subcategory: p.Subcategory || '', Material: p.Material || '', Season: p.Season || '', Style: p.Style || ''
    }));
    const csv = [header.join(',')].concat(rows.map(r => header.map(h => escape(r[h])).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const exportOrdersCsv = async (req, res) => {
  try {
    const items = await OrderModel.find().lean();
    const header = ['id','user','username','status','totalPrice','originalTotalPrice','discountAmount','couponCode','productsCount','createdAt'];
    const rows = items.map(o => ({
      id: o._id.toString(), user: o.user ? o.user.toString() : '', username: o.userDetails?.username || '', status: o.status || '',
      totalPrice: o.totalPrice || 0, originalTotalPrice: o.originalTotalPrice || '', discountAmount: o.discountAmount || 0,
      couponCode: o.coupon?.code || '', productsCount: Array.isArray(o.products) ? o.products.length : 0,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : ''
    }));
    const csv = [header.join(',')].concat(rows.map(r => header.map(h => escape(r[h])).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const exportPromotionsCsv = async (req, res) => {
  try {
    const items = await PromotionModel.find().lean();
    const header = ['id','code','type','value','description','active','startsAt','endsAt','usageLimit','usedCount','createdAt'];
    const rows = items.map(p => ({
      id: p._id.toString(), code: p.code || '', type: p.type || '', value: p.value || 0, description: p.description || '', active: p.active ? '1' : '0',
      startsAt: p.startsAt ? new Date(p.startsAt).toISOString() : '', endsAt: p.endsAt ? new Date(p.endsAt).toISOString() : '',
      usageLimit: p.usageLimit || '', usedCount: p.usedCount || 0, createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : ''
    }));
    const csv = [header.join(',')].concat(rows.map(r => header.map(h => escape(r[h])).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="promotions-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const exportUsersCsvGeneric = async (req, res) => {
  // delegate to existing users export logic by reproducing behavior
  try {
    const users = await UserModel.find().select('-password').lean();
    const agg = await OrderModel.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: '$user', total: { $sum: '$totalPrice' } } }
    ]);
    const totals = {};
    agg.forEach(a => { totals[a._id.toString()] = a.total; });
    const header = ['id','username','phoneNumber','Address','createdAt','totalSpend'];
    const rows = users.map(u => ({
      id: u._id.toString(), username: u.username || '', phoneNumber: u.phoneNumber || '', Address: u.Address || '', createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '', totalSpend: totals[u._id.toString()] || 0
    }));
    const csv = [header.join(',')].concat(rows.map(r => header.map(h => escape(r[h])).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
