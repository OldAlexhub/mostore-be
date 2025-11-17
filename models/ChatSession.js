import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['customer', 'admin', 'system'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    customerPhone: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    orderNumber: { type: String },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Orders' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    closedAt: { type: Date },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    startedAsGuest: { type: Boolean, default: false }
  },
  { timestamps: true }
);

chatSessionSchema.pre('save', function normalizePhone(next) {
  if (this.customerPhone) {
    this.customerPhone = String(this.customerPhone).replace(/\D/g, '');
  }
  if (!this.lastMessageAt) {
    this.lastMessageAt = this.createdAt || new Date();
  }
  next();
});

const ChatSessionModel = mongoose.model('ChatSession', chatSessionSchema);
export default ChatSessionModel;
