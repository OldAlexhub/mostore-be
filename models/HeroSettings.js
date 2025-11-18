import mongoose from 'mongoose';

const HeroSettingsSchema = new mongoose.Schema({
  header: { type: String, default: 'أهلاً بيك في M&O Store' },
  sentence1: { type: String, default: 'أحسن المنتجات بأحسن الأسعار — عروض يومية وتوصيل سريع لحد باب البيت.' },
  sentence2: { type: String, default: 'تسوق من تشكيلاتنا المُختارة: تخفيضات، منتجات جديدة، وخامات مضمونة.' },
  sentence3: { type: String, default: 'تعالى نورنا في شارع مسجد سيدي بشر امام جراج النقل العام بجوار كافيتريا الفارس.' },
  contactLabel: { type: String, default: 'كلمنا على واتساب' },
  whatsappNumber: { type: String, default: '+201008508808' }
}, { timestamps: true });

const HeroSettingsModel = mongoose.model('HeroSettings', HeroSettingsSchema);
export default HeroSettingsModel;
