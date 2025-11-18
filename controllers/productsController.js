import ProductModel from '../models/products.js';

export const createProduct = async (req, res) => {
  try {
    const product = new ProductModel(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    // Build filter from query params (support comma-separated multi-values)
    const { sort, cat } = req.query;
    const querySource = { ...req.query };
    if (!querySource.Category && cat) {
      querySource.Category = cat;
    }
    const fields = ['Category', 'Subcategory', 'Material', 'Season', 'Style'];
    const filter = {};
    for (const f of fields) {
      const v = querySource[f];
      if (!v) continue;
      // allow comma-separated lists
      const parts = v.toString().split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 1) filter[f] = parts[0];
      else filter[f] = { $in: parts };
    }

    // Sorting: support sort=Sell_asc or Sell_desc or sort=asc/desc
    let sortObj = {};
    if (sort) {
      if (sort === 'Sell_asc' || sort === 'asc') sortObj = { Sell: 1 };
      else if (sort === 'Sell_desc' || sort === 'desc') sortObj = { Sell: -1 };
    }

    const query = ProductModel.find(filter);
    if (Object.keys(sortObj).length) query.sort(sortObj);

    // Pagination support: if page or limit present, return metadata
    const page = parseInt(req.query.page, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 0;
    if (page > 0 && limit > 0) {
      const total = await ProductModel.countDocuments(filter);
      const pages = Math.max(1, Math.ceil(total / limit));
      const p = Math.min(page, pages);
      const products = await query.skip((p - 1) * limit).limit(limit).lean();
      return res.json({ products, total, page: p, pages, limit });
    }

    // No pagination requested — return array for backward compatibility
    const products = await query.lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getFilters = async (req, res) => {
  try {
    // Return distinct values for filterable fields so the client can build filter UI
    const [categories, subcategories, materials, seasons, styles] = await Promise.all([
      ProductModel.distinct('Category'),
      ProductModel.distinct('Subcategory'),
      ProductModel.distinct('Material'),
      ProductModel.distinct('Season'),
      ProductModel.distinct('Style')
    ]);

    res.json({ categories, subcategories, materials, seasons, styles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = parseInt(req.query.limit, 10) || 50;

    if (!q) {
      const products = await ProductModel.find().limit(limit).lean();
      return res.json(products);
    }

    const qLower = q.toLowerCase();
    // Find candidates matching any of the fields
    const regex = new RegExp(q, 'i');
    const candidates = await ProductModel.find({
      $or: [
        { Name: { $regex: regex } },
        { Category: { $regex: regex } },
        { Subcategory: { $regex: regex } },
        { Material: { $regex: regex } }
      ]
    }).limit(200).lean();

    // Score candidates heuristically
    const scored = candidates.map(p => {
      let score = 0;
      const name = (p.Name || '').toString().toLowerCase();
      const cat = (p.Category || '').toString().toLowerCase();
      const sub = (p.Subcategory || '').toString().toLowerCase();
      const mat = (p.Material || '').toString().toLowerCase();

      if (name.startsWith(qLower)) score += 100;
      if (name.includes(qLower)) score += 50;
      if (cat.includes(qLower)) score += 30;
      if (sub.includes(qLower)) score += 20;
      if (mat.includes(qLower)) score += 10;

      return { product: p, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tiebreak: higher price first
      return (b.product.Sell || 0) - (a.product.Sell || 0);
    });

    const results = scored.slice(0, limit).map(s => s.product);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getHiddenGems = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 8;
    // The schema uses `QTY` for quantity sold and `Sell` for price.
    // Sort ascending by `QTY` (lowest sold first) so users discover less-seen items.
    const products = await ProductModel.find()
      .sort({ QTY: 1, Sell: -1 })
      .limit(limit)
      .lean();

    // Map to return a consistent field name `soldQty` from `QTY`, keep `Sell` as price.
    const gems = products.map(p => ({ ...p, soldQty: p.QTY || 0 }));

    res.json(gems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await ProductModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await ProductModel.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProductReviews = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id).select('reviews');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product.reviews || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addProductReview = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const customerName = (req.body.customerName || '').trim() || 'زائر';
    const comment = (req.body.comment || '').trim();
    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    const review = {
      customerName,
      comment,
      rating,
      createdAt: new Date()
    };
    if (!Array.isArray(product.reviews)) product.reviews = [];
    product.reviews.unshift(review);
    await product.save();
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
