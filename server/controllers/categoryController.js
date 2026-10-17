import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

// @route   GET /api/categories
// @desc    Get all active categories with optional search
// @access  Public
export const getCategories = async (req, res, next) => {
  try {
    const { search } = req.query;

    const query = { isActive: true };

    if (search) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const categories = await Category.find(query).sort({ sortOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/categories/shop/:shopId
// @desc    Get categories that have at least one active product in the specified shop
// @access  Public
export const getShopCategories = async (req, res, next) => {
  try {
    const { shopId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID format' });
    }

    // Find distinct category IDs from active, available products in this shop
    const categoryIds = await Product.distinct('category', {
      shop: shopId,
      isActive: true,
      isAvailable: true,
    });

    // Fetch the actual Category documents for those IDs (only active ones)
    const categories = await Category.find({
      _id: { $in: categoryIds },
      isActive: true,
    }).sort({ sortOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};
