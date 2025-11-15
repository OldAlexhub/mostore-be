import mongoose from "mongoose";

const ProductsSchema = new mongoose.Schema({
    Number: { type: Number, required: true, unique: true },
    Name: { type: String, required: true },
    QTY: { type: Number, required: true, min: 0 },
    Sell: { type: Number, required: true, min: 0 },
    // Cost / purchase price per unit for accounting (new)
    cost: { type: Number, required: false, default: 0, min: 0 },
    // Minimum desired quantity to trigger low-stock alerts
    minQty: { type: Number, required: false, default: 0, min: 0 },
    Category: { type: String },
    Subcategory: { type: String },
    Material: { type: String },
    Season: { type: String },
    Style: { type: String },
    
})

const ProductModel = mongoose.model('Products', ProductsSchema);
export default ProductModel;