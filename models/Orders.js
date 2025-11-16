
import mongoose from 'mongoose';
import ProductModel from './products.js';

const orderSchema = new mongoose.Schema({
	// optional reference to a registered user (guest checkouts won't have this)
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Users'
	},
	// customer details: for registered users we copy values here; for guests these are required at order time
	userDetails: {
		username: { type: String },
		Address: { type: String },
		phoneNumber: { type: String }
	},
	// short random order number used for guest tracking/receipt (5 digits)
	orderNumber: {
		type: String,
		required: true,
		index: true,
		unique: true
	},
	products: [
		{
			product: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Products',
				required: true
			},
			productDetails: {
				Number: { type: Number, required: false, default: 0 },
				Name: { type: String, required: false },
				Sell: { type: Number, required: false, default: 0 },
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
shippingFee: {
	type: Number,
	default: 0
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
	storeDiscount: {
		type: {
			type: String,
			enum: ['general', 'threshold']
		},
		value: { type: Number },
		minTotal: { type: Number }
	},
	storeDiscountAmount: { type: Number, default: 0 },
	// original total before coupon
	originalTotalPrice: { type: Number },
	// amount discounted by coupon
	discountAmount: { type: Number, default: 0 }
}, { timestamps: true });

// generate a short unique 5-digit orderNumber for documents that don't have one
orderSchema.pre('validate', async function (next) {
	try {
		// ensure productDetails fields exist and are synchronized; if missing, try to populate from Products
		if (Array.isArray(this.products)) {
			for (let i = 0; i < this.products.length; i++) {
				const line = this.products[i];
				if (!line) continue;
				line.productDetails = line.productDetails || {};

				// sync lowercase/uppercase variants
				if ((typeof line.productDetails.Sell === 'undefined' || line.productDetails.Sell === null) && typeof line.productDetails.sell !== 'undefined') {
					line.productDetails.Sell = line.productDetails.sell;
				}
				if ((typeof line.productDetails.sell === 'undefined' || line.productDetails.sell === null) && typeof line.productDetails.Sell !== 'undefined') {
					line.productDetails.sell = line.productDetails.Sell;
				}
				if ((typeof line.productDetails.Cost === 'undefined' || line.productDetails.Cost === null) && typeof line.productDetails.cost !== 'undefined') {
					line.productDetails.Cost = line.productDetails.cost;
				}
				if ((typeof line.productDetails.cost === 'undefined' || line.productDetails.cost === null) && typeof line.productDetails.Cost !== 'undefined') {
					line.productDetails.cost = line.productDetails.Cost;
				}
				if ((typeof line.productDetails.Number === 'undefined' || line.productDetails.Number === null) && typeof line.productDetails.number !== 'undefined') {
					line.productDetails.Number = line.productDetails.number;
				}
				if ((typeof line.productDetails.number === 'undefined' || line.productDetails.number === null) && typeof line.productDetails.Number !== 'undefined') {
					line.productDetails.number = line.productDetails.Number;
				}

				// if crucial metadata missing, try loading product
				if ((!line.productDetails.Number || !line.productDetails.Name || typeof line.productDetails.Sell === 'undefined') && line.product) {
					try {
						const prod = await ProductModel.findById(line.product).lean();
						if (prod) {
							line.productDetails.Number = line.productDetails.Number || prod.Number;
							line.productDetails.Name = line.productDetails.Name || prod.Name;
							if (typeof line.productDetails.Sell === 'undefined' || line.productDetails.Sell === null) {
								line.productDetails.Sell = prod.Sell || 0;
							}
							if (typeof line.productDetails.sell === 'undefined' || line.productDetails.sell === null) {
								line.productDetails.sell = prod.Sell || 0;
							}
							line.productDetails.Cost = line.productDetails.Cost || prod.cost || 0;
							line.productDetails.cost = line.productDetails.cost || prod.cost || 0;
							line.productDetails.Name = line.productDetails.Name || prod.Name;
						}
					} catch (e) {
						// ignore and continue
					}
				}
			}
		}

		// generate orderNumber if missing (existing behavior)
		if (this.orderNumber) return next();
		const Order = mongoose.models.Orders || mongoose.model('Orders');
		const gen = () => String(Math.floor(Math.random() * 100000)).padStart(5, '0');
		let attempts = 0;
		let candidate = gen();
		while (await Order.findOne({ orderNumber: candidate })) {
			candidate = gen();
			attempts += 1;
			if (attempts > 20) break;
		}
		if (attempts > 20) return next(new Error('Unable to generate unique orderNumber'));
		this.orderNumber = candidate;
		return next();
	} catch (err) {
		return next(err);
	}
});

// normalize phone numbers for userDetails before saving (digits-only)
orderSchema.pre('save', function (next) {
	try {
		if (this.userDetails && this.userDetails.phoneNumber) {
			const raw = String(this.userDetails.phoneNumber || '');
			const norm = raw.replace(/[^0-9+]/g, '');
			// store digits only (strip leading +) for consistent matching
			this.userDetails.phoneNumber = norm.replace(/^\+/, '');
		}
		return next();
	} catch (err) {
		return next(err);
	}
});

// index for fast lookup when tracking by phone + orderNumber
orderSchema.index({ 'userDetails.phoneNumber': 1 });

const OrderModel = mongoose.model('Orders', orderSchema);
export default OrderModel;
