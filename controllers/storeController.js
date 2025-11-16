import StoreDiscountModel from '../models/StoreDiscount.js';

export const getStoreDiscount = async (req, res) => {
  try {
    const config = await StoreDiscountModel.findOne().lean();
    res.json(config || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateStoreDiscount = async (req, res) => {
  try {
    const payload = req.body || {};
    const update = {
      active: !!payload.active,
      type: payload.type === 'threshold' ? 'threshold' : 'general',
      value: Math.min(100, Math.max(0, Number(payload.value || 0))),
      minTotal: Math.max(0, Number(payload.minTotal || 0))
    };
    if (!update.active) {
      update.value = 0;
      update.minTotal = 0;
    }
    if (update.type === 'general') {
      update.minTotal = 0;
    }
    const shippingPayload = payload.shipping || {};
    const shippingEnabled = !!shippingPayload.enabled;
    const shippingAmount = Math.max(0, Number(
      shippingPayload.amount ?? shippingPayload.value ?? shippingPayload.fee ?? 0
    ));
    update.shipping = {
      enabled: shippingEnabled,
      amount: shippingEnabled ? shippingAmount : 0
    };
    const config = await StoreDiscountModel.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
