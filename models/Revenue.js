import mongoose from "mongoose";

const RevenueSchema = new mongoose.Schema({
	order: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Orders',
	},
	product: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Products',
	},
	amount: {
		type: Number,
		required: true,
		min: 0
	},
	type: {
		type: String,
		enum: ['sale', 'refund', 'adjustment'],
		required: true
	},
	date: {
		type: Date,
		default: Date.now
	},
	notes: {
		type: String
	}
});

const RevenueModel = mongoose.model('Revenue', RevenueSchema);
export default RevenueModel;
