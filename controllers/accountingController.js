import ExpenseModel from '../models/Expense.js';
import OrderModel from '../models/Orders.js';

// Create an expense record
export const createExpense = async (req, res) => {
  try {
    const { amount, category, description, date, receiptUrl } = req.body;
    if (typeof amount === 'undefined') return res.status(400).json({ error: 'amount required' });
    const expense = new ExpenseModel({ amount: Number(amount), category, description, date: date ? new Date(date) : undefined, receiptUrl, createdBy: req.user?._id });
    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// List expenses with optional date range and pagination
export const listExpenses = async (req, res) => {
  try {
    const { start, end, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (start || end) filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lte = new Date(end);
    const p = Math.max(1, Number(page));
    const l = Math.min(1000, Number(limit));
    const total = await ExpenseModel.countDocuments(filter);
    const expenses = await ExpenseModel.find(filter).sort({ date: -1 }).skip((p - 1) * l).limit(l).lean();
    res.json({ expenses, total, page: p, pages: Math.max(1, Math.ceil(total / l)), limit: l });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete expense
export const deleteExpense = async (req, res) => {
  try {
    const ex = await ExpenseModel.findByIdAndDelete(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Profit & Loss summary for a date range with optional grouping (none|month|year)
export const getPL = async (req, res) => {
  try {
    const { start, end, group } = req.query;
    const matchOrders = { status: { $ne: 'cancelled' } };
    const matchExpenses = {};
    if (start) {
      const sd = new Date(start);
      matchOrders.createdAt = { ...(matchOrders.createdAt || {}), $gte: sd };
      matchExpenses.date = { ...(matchExpenses.date || {}), $gte: sd };
    }
    if (end) {
      const ed = new Date(end);
      matchOrders.createdAt = { ...(matchOrders.createdAt || {}), $lte: ed };
      matchExpenses.date = { ...(matchExpenses.date || {}), $lte: ed };
    }

    // Total revenue
    const revAgg = await OrderModel.aggregate([
      { $match: matchOrders },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' } } }
    ]);
    const revenue = (revAgg[0] && revAgg[0].revenue) || 0;

    // COGS: compute both snapshot-based COGS and fallback-based COGS so we can report usage
    const cogsAgg = await OrderModel.aggregate([
      { $match: matchOrders },
      { $unwind: '$products' },
      { $lookup: { from: 'products', localField: 'products.product', foreignField: '_id', as: 'prod' } },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      { $project: { qty: '$products.quantity', orderCost: '$products.productDetails.Cost', prodCost: { $ifNull: ['$prod.cost', 0] } } },
      { $project: {
          snapshotPart: { $multiply: ['$qty', { $cond: [{ $ne: ['$orderCost', null] }, '$orderCost', 0] }] },
          fallbackPart: { $multiply: ['$qty', { $cond: [{ $eq: ['$orderCost', null] }, '$prodCost', 0] }] }
      } },
      { $group: { _id: null, snapshotCogs: { $sum: '$snapshotPart' }, fallbackCogs: { $sum: '$fallbackPart' } } }
    ]);
    const snapshotCogs = (cogsAgg[0] && cogsAgg[0].snapshotCogs) || 0;
    const fallbackCogs = (cogsAgg[0] && cogsAgg[0].fallbackCogs) || 0;
    const cogs = snapshotCogs + fallbackCogs;

    // Expenses total
    const expAgg = await ExpenseModel.aggregate([
      { $match: matchExpenses },
      { $group: { _id: null, expenses: { $sum: '$amount' } } }
    ]);
    const expenses = (expAgg[0] && expAgg[0].expenses) || 0;

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    // optional grouping series
    let series = null;
    if (group === 'month' || group === 'year') {
      const dateFormat = group === 'month' ? '%Y-%m' : '%Y';
      // revenue series
      const revSeries = await OrderModel.aggregate([
        { $match: matchOrders },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, revenue: { $sum: '$totalPrice' } } },
        { $sort: { _id: 1 } }
      ]);
      // cogs series: compute snapshot and fallback parts per period
      const cogsSeries = await OrderModel.aggregate([
        { $match: matchOrders },
        { $unwind: '$products' },
        { $lookup: { from: 'products', localField: 'products.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $project: { qty: '$products.quantity', orderCost: '$products.productDetails.Cost', prodCost: { $ifNull: ['$prod.cost', 0] }, createdAt: 1 } },
        { $project: {
            period: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            snapshotPart: { $multiply: ['$qty', { $cond: [{ $ne: ['$orderCost', null] }, '$orderCost', 0] }] },
            fallbackPart: { $multiply: ['$qty', { $cond: [{ $eq: ['$orderCost', null] }, '$prodCost', 0] }] }
        } },
        { $group: { _id: '$period', snapshotCogs: { $sum: '$snapshotPart' }, fallbackCogs: { $sum: '$fallbackPart' } } },
        { $sort: { _id: 1 } }
      ]);
      // expenses series
      const expSeries = await ExpenseModel.aggregate([
        { $match: matchExpenses },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$date' } }, expenses: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]);

      // merge series by _id
      const map = {};
      const allKeys = new Set();
      revSeries.forEach(r => { allKeys.add(r._id); map[r._id] = { period: r._id, revenue: r.revenue || 0, snapshotCogs: 0, fallbackCogs: 0, expenses: 0 }; });
      cogsSeries.forEach(c => { allKeys.add(c._id); map[c._id] = map[c._id] || { period: c._id, revenue: 0, snapshotCogs: 0, fallbackCogs: 0, expenses: 0 }; map[c._id].snapshotCogs = c.snapshotCogs || 0; map[c._id].fallbackCogs = c.fallbackCogs || 0; });
      expSeries.forEach(e => { allKeys.add(e._id); map[e._id] = map[e._id] || { period: e._id, revenue: 0, snapshotCogs: 0, fallbackCogs: 0, expenses: 0 }; map[e._id].expenses = e.expenses || 0; });
      series = Array.from(allKeys).sort().map(k => {
        const it = map[k];
        const cogsTotal = (it.snapshotCogs || 0) + (it.fallbackCogs || 0);
        const usedSnapshotPercent = cogsTotal > 0 ? ((it.snapshotCogs || 0) / cogsTotal) : 0;
        return { period: it.period, revenue: it.revenue, cogs: cogsTotal, cogsSnapshot: it.snapshotCogs || 0, cogsFallback: it.fallbackCogs || 0, cogsSnapshotPercent: Math.round(usedSnapshotPercent * 10000)/100, grossProfit: (it.revenue - cogsTotal), expenses: it.expenses, netProfit: (it.revenue - cogsTotal - it.expenses) };
      });
    }

    res.json({ revenue, cogs, expenses, grossProfit, netProfit, series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export P&L as CSV. Accepts same params as getPL (start,end,group)
export const exportPLCsv = async (req, res) => {
  try {
    const { start, end, group } = req.query;
    // reuse getPL logic by calling internal function pieces: compute totals and series
    // We'll replicate key parts but return CSV
    const matchOrders = { status: { $ne: 'cancelled' } };
    const matchExpenses = {};
    if (start) {
      const sd = new Date(start);
      matchOrders.createdAt = { ...(matchOrders.createdAt || {}), $gte: sd };
      matchExpenses.date = { ...(matchExpenses.date || {}), $gte: sd };
    }
    if (end) {
      const ed = new Date(end);
      matchOrders.createdAt = { ...(matchOrders.createdAt || {}), $lte: ed };
      matchExpenses.date = { ...(matchExpenses.date || {}), $lte: ed };
    }

    const revAgg = await OrderModel.aggregate([
      { $match: matchOrders },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' } } }
    ]);
    const revenue = (revAgg[0] && revAgg[0].revenue) || 0;

    const cogsAgg = await OrderModel.aggregate([
      { $match: matchOrders },
      { $unwind: '$products' },
      { $lookup: { from: 'products', localField: 'products.product', foreignField: '_id', as: 'prod' } },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
      { $project: { qty: '$products.quantity', orderCost: '$products.productDetails.Cost', prodCost: { $ifNull: ['$prod.cost', 0] } } },
      { $project: {
          snapshotPart: { $multiply: ['$qty', { $cond: [{ $ne: ['$orderCost', null] }, '$orderCost', 0] }] },
          fallbackPart: { $multiply: ['$qty', { $cond: [{ $eq: ['$orderCost', null] }, '$prodCost', 0] }] }
      } },
      { $group: { _id: null, snapshotCogs: { $sum: '$snapshotPart' }, fallbackCogs: { $sum: '$fallbackPart' } } }
    ]);
    const snapshotCogs = (cogsAgg[0] && cogsAgg[0].snapshotCogs) || 0;
    const fallbackCogs = (cogsAgg[0] && cogsAgg[0].fallbackCogs) || 0;
    const cogs = snapshotCogs + fallbackCogs;

    const expAgg = await ExpenseModel.aggregate([
      { $match: matchExpenses },
      { $group: { _id: null, expenses: { $sum: '$amount' } } }
    ]);
    const expenses = (expAgg[0] && expAgg[0].expenses) || 0;

    let series = [];
    if (group === 'month' || group === 'year') {
      const dateFormat = group === 'month' ? '%Y-%m' : '%Y';
      const revSeries = await OrderModel.aggregate([
        { $match: matchOrders },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, revenue: { $sum: '$totalPrice' } } },
        { $sort: { _id: 1 } }
      ]);
      const cogsSeries = await OrderModel.aggregate([
        { $match: matchOrders },
        { $unwind: '$products' },
        { $lookup: { from: 'products', localField: 'products.product', foreignField: '_id', as: 'prod' } },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        { $project: { qty: '$products.quantity', orderCost: '$products.productDetails.Cost', prodCost: { $ifNull: ['$prod.cost', 0] }, createdAt: 1 } },
        { $project: {
            period: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            snapshotPart: { $multiply: ['$qty', { $cond: [{ $ne: ['$orderCost', null] }, '$orderCost', 0] }] },
            fallbackPart: { $multiply: ['$qty', { $cond: [{ $eq: ['$orderCost', null] }, '$prodCost', 0] }] }
        } },
        { $group: { _id: '$period', snapshotCogs: { $sum: '$snapshotPart' }, fallbackCogs: { $sum: '$fallbackPart' } } },
        { $sort: { _id: 1 } }
      ]);
      const expSeries = await ExpenseModel.aggregate([
        { $match: matchExpenses },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$date' } }, expenses: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]);

      const map = {};
      const allKeys = new Set();
      revSeries.forEach(r => { allKeys.add(r._id); map[r._id] = { period: r._id, revenue: r.revenue || 0, cogs: 0, expenses: 0 }; });
      cogsSeries.forEach(c => { allKeys.add(c._id); map[c._id] = map[c._id] || { period: c._id, revenue: 0, cogs: 0, expenses: 0 }; map[c._id].cogs = c.cogs || 0; });
      expSeries.forEach(e => { allKeys.add(e._id); map[e._id] = map[e._id] || { period: e._id, revenue: 0, cogs: 0, expenses: 0 }; map[e._id].expenses = e.expenses || 0; });
      series = Array.from(allKeys).sort().map(k => {
        const it = map[k];
        const cogsTotal = (it.snapshotCogs || 0) + (it.fallbackCogs || 0);
        const usedSnapshotPercent = cogsTotal > 0 ? ((it.snapshotCogs || 0) / cogsTotal) : 0;
        return { period: it.period, revenue: it.revenue, cogs: cogsTotal, cogsSnapshot: it.snapshotCogs || 0, cogsFallback: it.fallbackCogs || 0, cogsSnapshotPercent: Math.round(usedSnapshotPercent * 10000)/100, grossProfit: (it.revenue - cogsTotal), expenses: it.expenses, netProfit: (it.revenue - cogsTotal - it.expenses) };
      });
    }

    // Build CSV rows
    const rows = [];
    if (series && series.length) {
      rows.push(['period','revenue','cogs','cogsSnapshot','cogsFallback','cogsSnapshotPercent','grossProfit','expenses','netProfit']);
      series.forEach(s => rows.push([s.period, s.revenue, s.cogs, s.cogsSnapshot || 0, s.cogsFallback || 0, s.cogsSnapshotPercent || 0, s.grossProfit, s.expenses, s.netProfit]));
    } else {
      rows.push(['metric','value']);
      rows.push(['revenue', revenue]);
      rows.push(['cogs', cogs]);
      rows.push(['cogsSnapshot', snapshotCogs]);
      rows.push(['cogsFallback', fallbackCogs]);
      rows.push(['grossProfit', revenue - cogs]);
      rows.push(['expenses', expenses]);
      rows.push(['netProfit', revenue - cogs - expenses]);
    }

    const csv = rows.map(r => r.map(c => {
      if (c === null || typeof c === 'undefined') return '';
      const s = String(c);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    }).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pl-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
