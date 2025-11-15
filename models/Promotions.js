import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['amount','percent'], required: true },
  value: { type: Number, required: true },
  description: { type: String },
  active: { type: Boolean, default: true },
  startsAt: { type: Date },
  endsAt: { type: Date },
  usageLimit: { type: Number },
  usedCount: { type: Number, default: 0 }
}, { timestamps: true });

promoSchema.index({ code: 1 });

const PromotionModel = mongoose.model('Promotions', promoSchema);
export default PromotionModel;
