import mongoose from "mongoose";

const ProductsSchema = new mongoose.Schema({
    // human-facing product number (kept for legacy reports). If missing, we'll auto-assign.
    Number: { type: Number, required: false, unique: true },
    Name: { type: String, required: true },
    QTY: { type: Number, required: false, default: 0, min: 0 },
    Sell: { type: Number, required: true, min: 0 },
    // Cost / purchase price per unit for accounting (new)
    cost: { type: Number, required: true, default: 0, min: 0 },
    // public image URL for product listing
    imageUrl: { type: String, required: false },
    // optional secondary image for gallery-style layouts
    secondaryImageUrl: { type: String, required: false },
    // optional gallery (kept flexible for future expansion beyond 2 images)
    imageGallery: { type: [String], required: false, default: [] },
    // longer product description
    Description: { type: String, required: false },
    // Minimum desired quantity to trigger low-stock alerts
    minQty: { type: Number, required: false, default: 0, min: 0 },
    Category: { type: String },
    Subcategory: { type: String },
    Material: { type: String },
    Season: { type: String },
    Style: { type: String },
    reviews: {
        type: [{
            customerName: { type: String, required: true, trim: true, default: 'زائر' },
            rating: { type: Number, required: true, min: 1, max: 5 },
            comment: { type: String, required: false, trim: true },
            createdAt: { type: Date, default: Date.now }
        }],
        default: []
    }
})

// Auto-assign a unique incremental `Number` when creating products if not provided.
ProductsSchema.pre('validate', async function (next) {
    try {
        if (typeof this.Number !== 'undefined' && this.Number !== null) return next();
        const Model = mongoose.models.Products || mongoose.model('Products');
        // find max existing Number and increment (fallback to timestamp-based number on error)
        const doc = await Model.findOne().sort({ Number: -1 }).select('Number').lean();
        const max = doc && typeof doc.Number === 'number' ? doc.Number : 0;
        this.Number = max + 1;
        return next();
    } catch (err) {
        // fallback: assign based on timestamp
        this.Number = Date.now() % 1000000;
        return next();
    }
});

const ProductModel = mongoose.model('Products', ProductsSchema);
export default ProductModel;
