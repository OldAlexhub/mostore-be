import PromotionModel from '../models/Promotions.js';

export const createPromotion = async (req, res) => {
  try {
    const payload = req.body || {};
    // normalize code
    if (payload.code) payload.code = String(payload.code).trim().toUpperCase();
    const promo = new PromotionModel(payload);
    await promo.save();
    res.status(201).json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getPromotions = async (req, res) => {
  try {
    const promos = await PromotionModel.find().sort({ createdAt: -1 });
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPromotion = async (req, res) => {
  try {
    const promo = await PromotionModel.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    if (req.body.code) req.body.code = String(req.body.code).trim().toUpperCase();
    const promo = await PromotionModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const promo = await PromotionModel.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ message: 'Promotion deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const validatePromotion = async (req, res) => {
  try {
    const { code, total = 0 } = req.query || {};
    if (!code) return res.status(400).json({ error: 'code required' });
    const norm = String(code).trim().toUpperCase();
    const promo = await PromotionModel.findOne({ code: norm });
    if (!promo || !promo.active) return res.status(404).json({ error: 'Invalid or inactive code' });
    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) return res.status(400).json({ error: 'Promotion not started yet' });
    if (promo.endsAt && promo.endsAt < now) return res.status(400).json({ error: 'Promotion expired' });
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return res.status(400).json({ error: 'Promotion usage limit reached' });

    const tt = parseFloat(total) || 0;
    let discount = 0;
    if (promo.type === 'amount') discount = promo.value;
    else if (promo.type === 'percent') discount = Math.round((promo.value / 100) * tt * 100) / 100;
    if (discount > tt) discount = tt;

    res.json({ code: promo.code, type: promo.type, value: promo.value, discount, total: Math.max(0, tt - discount) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
