
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Users',
		required: true
	},
	userDetails: {
		username: { type: String, required: true },
		Address: { type: String, required: true },
		phoneNumber: { type: String, required: true }
	},
	products: [
		{
			product: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Products',
				required: true
			},
			productDetails: {
				Number: { type: Number, required: true },
				Name: { type: String, required: true },
				Sell: { type: Number, required: true },
				Cost: { type: Number, required: false, default: 0 },
				Category: { type: String },
				Subcategory: { type: String },
				Material: { type: String },
				Season: { type: String },
				Style: { type: String }
			},
			quantity: {
				type: Number,
				required: true,
				min: 1
			}
		}
	],
	totalPrice: {
		type: Number,
		required: true
	},
	status: {
		type: String,
		enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
		default: 'pending'
	}
,
	cancelledAt: {
		type: Date
	}
,
    // whether an admin has reviewed/seen this order in the admin UI
    adminSeen: {
        type: Boolean,
        default: false
    },
    adminSeenAt: {
        type: Date
    }
	,
	// coupon applied at order time (if any)
	coupon: {
		code: { type: String },
		type: { type: String, enum: ['amount','percent'] },
		value: { type: Number }
	},
	// original total before coupon
	originalTotalPrice: { type: Number },
	// amount discounted by coupon
	discountAmount: { type: Number, default: 0 }
}, { timestamps: true });

const OrderModel = mongoose.model('Orders', orderSchema);
export default OrderModel;
