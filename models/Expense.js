import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'general' },
  description: { type: String },
  date: { type: Date, default: Date.now },
  receiptUrl: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admins' }
}, { timestamps: true });

const ExpenseModel = mongoose.model('Expense', ExpenseSchema);
export default ExpenseModel;
