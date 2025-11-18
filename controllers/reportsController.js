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

const BOM = '\uFEFF';
const sendCsvResponse = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`${BOM}${csv}`);
};

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

const resolveRange = (rangeKey = 'this-month', customStart, customEnd) => {
  const now = new Date();
  let startDate = null;
  let endDate = new Date(now);

  switch (rangeKey) {
    case 'last-month': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'last-quarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      let prevQuarter = currentQuarter - 1;
      let year = now.getFullYear();
      if (prevQuarter < 0) {
        prevQuarter += 4;
        year -= 1;
      }
      const startMonth = prevQuarter * 3;
      const endMonth = startMonth + 2;
      startDate = new Date(year, startMonth, 1);
      endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last-6-months': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last-12-months': {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      startDate = parseDateInput(customStart, false);
      endDate = parseDateInput(customEnd, true);
      break;
    }
    case 'this-month':
    default: {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
      break;
    }
  }

  return { startDate, endDate };
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
    sendCsvResponse(res, `products-${Date.now()}.csv`, csv);
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
    sendCsvResponse(res, `orders-${Date.now()}.csv`, csv);
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
    sendCsvResponse(res, `promotions-${Date.now()}.csv`, csv);
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
    sendCsvResponse(res, `users-${Date.now()}.csv`, csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const exportProductSalesReport = async (req, res) => {
  try {
    const {
      category = '',
      subcategory = '',
      material = '',
      season = '',
      style = '',
      range = 'this-month',
      start,
      end,
      limit,
      minUnits,
      maxUnits,
      format
    } = req.query;

    const { startDate, endDate } = resolveRange(range, start, end);
    const match = { status: { $nin: ['cancelled', 'refunded'] } };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lte = endDate;
    }

    const pipeline = [
      { $match: match },
      { $unwind: '$products' }
    ];

    const productMatch = {};
    if (category) productMatch['products.productDetails.Category'] = category;
    if (subcategory) productMatch['products.productDetails.Subcategory'] = subcategory;
    if (material) productMatch['products.productDetails.Material'] = material;
    if (season) productMatch['products.productDetails.Season'] = season;
    if (style) productMatch['products.productDetails.Style'] = style;
    if (Object.keys(productMatch).length) pipeline.push({ $match: productMatch });

    pipeline.push({
      $group: {
        _id: {
          productId: '$products.product',
          number: '$products.productDetails.Number',
          name: '$products.productDetails.Name',
          category: '$products.productDetails.Category',
          subcategory: '$products.productDetails.Subcategory',
          material: '$products.productDetails.Material',
          season: '$products.productDetails.Season',
          style: '$products.productDetails.Style'
        },
        unitsSold: { $sum: '$products.quantity' },
        grossSales: { $sum: { $multiply: ['$products.quantity', { $ifNull: ['$products.productDetails.Sell', 0] }] } },
        avgPrice: { $avg: { $ifNull: ['$products.productDetails.Sell', 0] } },
        lastOrderDate: { $max: '$createdAt' }
      }
    });

    const afterGroupMatch = {};
    const minUnitsNum = parseInt(minUnits, 10);
    const maxUnitsNum = parseInt(maxUnits, 10);
    if (!Number.isNaN(minUnitsNum)) afterGroupMatch.unitsSold = { ...(afterGroupMatch.unitsSold || {}), $gte: minUnitsNum };
    if (!Number.isNaN(maxUnitsNum)) afterGroupMatch.unitsSold = { ...(afterGroupMatch.unitsSold || {}), $lte: maxUnitsNum };
    if (Object.keys(afterGroupMatch).length) pipeline.push({ $match: afterGroupMatch });

    pipeline.push({ $sort: { unitsSold: -1, grossSales: -1 } });
    const parsedLimit = parseInt(limit, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      pipeline.push({ $limit: parsedLimit });
    }

    const data = await OrderModel.aggregate(pipeline);
    const rows = data.map((row) => ({
      productId: row._id.productId ? row._id.productId.toString() : '',
      number: row._id.number || '',
      name: row._id.name || '',
      category: row._id.category || '',
      subcategory: row._id.subcategory || '',
      material: row._id.material || '',
      season: row._id.season || '',
      style: row._id.style || '',
      unitsSold: row.unitsSold || 0,
      grossSales: row.grossSales || 0,
      avgPrice: row.avgPrice || 0,
      lastOrderDate: row.lastOrderDate ? new Date(row.lastOrderDate).toISOString() : ''
    }));

    const totals = rows.reduce(
      (acc, row) => {
        acc.totalUnits += row.unitsSold || 0;
        acc.totalGrossSales += row.grossSales || 0;
        return acc;
      },
      { totalUnits: 0, totalGrossSales: 0 }
    );

    if (format === 'csv') {
      const header = ['productId','number','name','category','subcategory','material','season','style','unitsSold','grossSales','avgPrice','lastOrderDate'];
      const csv = [header.join(',')].concat(rows.map(r => header.map(h => escape(r[h])).join(','))).join('\n');
      const rangeLabel = range === 'custom'
        ? `${startDate ? startDate.toISOString().slice(0, 10) : 'start'}_${endDate ? endDate.toISOString().slice(0, 10) : 'now'}`
        : range;
      sendCsvResponse(res, `product-sales-${rangeLabel}-${Date.now()}.csv`, csv);
      return;
    }

    res.json({
      rows,
      meta: {
        totalUnits: totals.totalUnits,
        totalGrossSales: totals.totalGrossSales,
        range: {
          start: startDate ? startDate.toISOString() : null,
          end: endDate ? endDate.toISOString() : null,
        },
        filters: {
          category,
          subcategory,
          material,
          season,
          style,
          range,
          minUnits: Number.isNaN(minUnitsNum) ? null : minUnitsNum,
          maxUnits: Number.isNaN(maxUnitsNum) ? null : maxUnitsNum
        },
        count: rows.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
