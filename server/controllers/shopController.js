import mongoose from 'mongoose';
import Shop from '../models/Shop.js';
import Category from '../models/Category.js';
import { getShopClosureStatus } from '../utils/shopClosure.js';

// @route   GET /api/shops
// @desc    Get all active and approved shops with search & category filter
// @access  Public
export const getShops = async (req, res, next) => {
  try {
    const { search, category } = req.query;

    const query = {
      isApproved: true,
      isActive: true,
    };

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
      query.$or = [{ name: searchRegex }, { description: searchRegex }, { foodType: searchRegex }];
    }

    const shops = await Shop.find(query)
      .populate('category', 'name image')
      .select('-owner')
      .sort({ rating: -1, name: 1 });

    const shopsWithStatus = shops.map((s) => {
      const closure = getShopClosureStatus(s);
      const obj = s.toObject ? s.toObject() : { ...s };
      obj.isCurrentlyOpen = closure.isOpen;
      obj.closedReason = closure.displayReason;
      obj.closureDetails = closure;
      return obj;
    });

    res.status(200).json({
      success: true,
      count: shopsWithStatus.length,
      shops: shopsWithStatus,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/shops/:id
// @desc    Get approved & active shop by ID
// @access  Public
export const getShopById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID format',
      });
    }

    const shop = await Shop.findOne({
      _id: id,
      isApproved: true,
      isActive: true,
    })
      .populate('category', 'name image')
      .select('-owner');

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found or currently unavailable',
      });
    }

    const closure = getShopClosureStatus(shop);
    const shopObj = shop.toObject ? shop.toObject() : { ...shop };
    shopObj.isCurrentlyOpen = closure.isOpen;
    shopObj.closedReason = closure.displayReason;
    shopObj.closureDetails = closure;

    res.status(200).json({
      success: true,
      shop: shopObj,
      closureStatus: closure,
    });
  } catch (error) {
    next(error);
  }
};
