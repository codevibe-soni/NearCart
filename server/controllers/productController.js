import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import Category from '../models/Category.js';

// @route   GET /api/products
// @desc    Get active & available products with filters, search, sorting & pagination
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const {
      shop,
      category,
      search,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // First find all approved & active shop IDs
    const activeShops = await Shop.find({ isApproved: true, isActive: true }).select('_id');
    const activeShopIds = activeShops.map((s) => s._id);

    const query = {
      isActive: true,
      isAvailable: true,
      shop: { $in: activeShopIds },
    };

    // Enforce Shop-First policy: Products are only retrieved for a specific shop
    if (!shop) {
      return res.status(200).json({
        success: true,
        products: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 1,
        },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(shop)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID format' });
    }
    const isShopActive = activeShopIds.some((id) => id.toString() === shop.toString());
    if (!isShopActive) {
      return res.status(200).json({
        success: true,
        products: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          totalPages: 1,
        },
      });
    }
    query.shop = shop;

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const catDoc = await Category.findOne({
          name: new RegExp(`^${category.trim()}`, 'i'),
        });
        if (catDoc) {
          query.category = catDoc._id;
        } else {
          query.category = new mongoose.Types.ObjectId();
        }
      }
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined && !isNaN(minPrice)) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined && !isNaN(maxPrice)) query.price.$lte = Number(maxPrice);
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'price_asc') sortOptions = { price: 1 };
    else if (sort === 'price_desc') sortOptions = { price: -1 };
    else if (sort === 'rating') sortOptions = { rating: -1 };

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .select('name price discountPrice unit stock images shop category rating totalRatings gstPercentage packingCharges createdAt')
      .populate('shop', 'name logo rating address isOpen deliveryFee deliveryChargeSlabs')
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/products/:id
// @desc    Get single product details
// @access  Public
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
      });
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
      isAvailable: true,
    })
      .populate({
        path: 'shop',
        select: 'name description logo rating totalRatings address phone isOpen isApproved isActive deliveryFee deliveryChargeSlabs upiEnabled upiId upiQrImage',
        match: { isApproved: true, isActive: true },
      })
      .populate('category', 'name image');

    if (!product || !product.shop) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};
