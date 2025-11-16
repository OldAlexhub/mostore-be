import OrderModel from '../models/Orders.js';

export const getRevenues = async (req, res) => {
  try {
    const match = { status: { $ne: 'cancelled' } };
    const sumAgg = await OrderModel.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
    ]);
    const total = sumAgg[0]?.total || 0;
    const count = sumAgg[0]?.count || 0;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const daily = await OrderModel.aggregate([
      { $match: { ...match, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$totalPrice' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ total, orders: count, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
