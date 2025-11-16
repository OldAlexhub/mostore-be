import mongoose from 'mongoose';

const StoreDiscountSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  type: { type: String, enum: ['general', 'threshold'], default: 'general' },
  value: { type: Number, min: 0, max: 100, default: 0 },
  minTotal: { type: Number, min: 0, default: 0 },
  shipping: {
    enabled: { type: Boolean, default: false },
    amount: { type: Number, min: 0, default: 0 }
  }
}, { timestamps: true });

const StoreDiscountModel = mongoose.model('StoreDiscount', StoreDiscountSchema);
export default StoreDiscountModel;
