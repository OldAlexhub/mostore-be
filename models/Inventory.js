import mongoose from "mongoose";

const InventorySchema = new mongoose.Schema({
	product: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Products',
		required: true
	},
	Number: { type: Number, required: true },
	Name: { type: String, required: true },
	currentQty: { type: Number, required: true, min: 0 },
	minQty: { type: Number, default: 0 }, // Alert if below
	location: { type: String },
	movements: [
		{
			type: { type: String, enum: ['in', 'out', 'adjustment'], required: true },
			quantity: { type: Number, required: true },
			date: { type: Date, default: Date.now },
			reason: { type: String }
		}
	],
	lastUpdated: { type: Date, default: Date.now }
});

const InventoryModel = mongoose.model('Inventory', InventorySchema);
export default InventoryModel;
