import RevenueModel from '../models/Revenue.js';

export const createRevenue = async (req, res) => {
  try {
    const revenue = new RevenueModel(req.body);
    await revenue.save();
    res.status(201).json(revenue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getRevenues = async (req, res) => {
  try {
    const revenues = await RevenueModel.find();
    res.json(revenues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRevenueById = async (req, res) => {
  try {
    const revenue = await RevenueModel.findById(req.params.id);
    if (!revenue) return res.status(404).json({ error: 'Revenue not found' });
    res.json(revenue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateRevenue = async (req, res) => {
  try {
    const revenue = await RevenueModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!revenue) return res.status(404).json({ error: 'Revenue not found' });
    res.json(revenue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteRevenue = async (req, res) => {
  try {
    const revenue = await RevenueModel.findByIdAndDelete(req.params.id);
    if (!revenue) return res.status(404).json({ error: 'Revenue not found' });
    res.json({ message: 'Revenue deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
