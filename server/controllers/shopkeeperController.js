import mongoose from 'mongoose';
import Shop from '../models/Shop.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import Coupon from '../models/Coupon.js';
import { validateDeliveryChargeSlabs } from '../utils/distanceCalculator.js';
import { uploadBase64Image, generateCloudinarySignature } from '../services/cloudinaryService.js';
import { assertNoBase64Image } from '../utils/imageGuard.js';

// @route   POST /api/shopkeeper/cloudinary/sign
// @desc    Generate server-side signed Cloudinary upload parameters for shopkeepers
// @access  Private/Shopkeeper
export const getCloudinarySignature = async (req, res, next) => {
  try {
    const folder = req.body.folder || 'nearcart/products';
    const params = generateCloudinarySignature(folder);
    return res.status(200).json({
      success: true,
      ...params,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate upload signature',
    });
  }
};

/**
 * Upload Base64 Data URLs in product images array to Cloudinary when configured.
 * Safely falls back to preserving original Base64 strings if Cloudinary is not configured or upload fails.
 */
const processImagesForStorage = async (imagesArray, folder = 'nearcart/products') => {
  if (!Array.isArray(imagesArray) || imagesArray.length === 0) return [];

  const uploadPromises = imagesArray.map(async (img) => {
    if (!img) return null;
    if (typeof img === 'string' && img.startsWith('data:image/')) {
      const res = await uploadBase64Image(img, { folder });
      if (res.success && res.url && typeof res.url === 'string' && (res.url.startsWith('https://res.cloudinary.com/') || res.url.startsWith('http://') || res.url.startsWith('https://')) && !res.url.startsWith('data:image/')) {
        return res.url;
      }
      throw new Error(`Cloudinary image upload failed: ${res.error || 'Upload error'}. Base64 storage is strictly prohibited.`);
    } else if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
      return img;
    } else {
      throw new Error('Invalid image format: Must be a valid HTTP/HTTPS URL or Base64 data string.');
    }
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(Boolean);
};

/**
 * Helper to fetch a shop and enforce ownership check if shopId is provided.
 * - If shopId is supplied:
 *     - 400 if invalid ObjectId format
 *     - 404 if shop does not exist in DB
 *     - 403 if shop.owner !== userId
 * - If shopId is NOT supplied:
 *     - Returns the first shop owned by userId (or null if shopkeeper has no shops)
 */
const getShopWithOwnership = async (shopId, userId, res, populateCategory = false) => {
  if (shopId) {
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      res.status(400).json({ success: false, message: 'Invalid shop ID format' });
      return null;
    }
    let query = Shop.findById(shopId);
    if (populateCategory) query = query.populate('category', 'name image');
    const existingShop = await query;
    if (!existingShop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
      return null;
    }
    if (existingShop.owner.toString() !== userId.toString()) {
      res.status(403).json({ success: false, message: 'Forbidden: Access denied to this shop' });
      return null;
    }
    return existingShop;
  }
  let query = Shop.findOne({ owner: userId });
  if (populateCategory) query = query.populate('category', 'name image');
  return await query;
};

// @route   GET /api/shopkeeper/stats
// @desc    Get real-time dashboard statistics for logged-in shopkeeper (supports ?shopId=)
// @access  Private/Shopkeeper
export const getShopkeeperStats = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(200).json({
        success: true,
        stats: {
          totalProducts: 0,
          activeProducts: 0,
          outOfStock: 0,
          lowStock: 0,
          pendingOrders: 0,
          todaysOrders: 0,
          todaysSales: 0,
        },
      });
    }

    const [totalProducts, activeProducts, outOfStock, lowStock] = await Promise.all([
      Product.countDocuments({ shop: shop._id }),
      Product.countDocuments({ shop: shop._id, isActive: true, isAvailable: true }),
      Product.countDocuments({ shop: shop._id, stock: 0 }),
      Product.countDocuments({ shop: shop._id, stock: { $gt: 0, $lte: 5 } }),
    ]);

    const pendingOrders = await Order.countDocuments({
      shop: shop._id,
      orderStatus: { $in: ['PLACED', 'SHOP_ACCEPTED', 'PREPARING'] },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaysOrdersList = await Order.find({
      shop: shop._id,
      createdAt: { $gte: startOfToday },
    });

    const todaysOrders = todaysOrdersList.length;
    const todaysSales = todaysOrdersList
      .filter((o) => o.orderStatus !== 'CANCELLED')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        outOfStock,
        lowStock,
        pendingOrders,
        todaysOrders,
        todaysSales,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/shopkeeper/shops
// @desc    Get all shops owned by the logged-in shopkeeper
// @access  Private/Shopkeeper
export const getMyShops = async (req, res, next) => {
  try {
    const shops = await Shop.find({ owner: req.user._id })
      .populate('category', 'name image')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: shops.length,
      shops,
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/shopkeeper/shop
// @desc    Create a new shop for logged-in shopkeeper (supports multiple shops)
// @access  Private/Shopkeeper
export const createShop = async (req, res, next) => {
  try {
    const {
      name,
      description,
      phone,
      category,
      address,
      openingTime,
      closingTime,
      minimumOrderAmount,
      deliveryFee,
      packingCharges,
      logo,
      coverImage,
      foodType,
      customFoodType,
    } = req.body;

    if (!name || !category || !address) {
      return res.status(400).json({
        success: false,
        message: 'Shop name, category, and address are required.',
      });
    }

    let finalFoodType = '';
    if (foodType === 'Custom') {
      finalFoodType = customFoodType ? customFoodType.trim() : '';
      if (!finalFoodType) {
        return res.status(400).json({
          success: false,
          message: 'Custom food type is required and cannot be empty.',
        });
      }
    } else if (foodType) {
      finalFoodType = foodType.trim();
    }

    if (finalFoodType.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Food type cannot exceed 50 characters.',
      });
    }

    const finalOpen = (openingTime && typeof openingTime === 'string' && openingTime.trim()) ? openingTime.trim() : null;
    const finalClose = (closingTime && typeof closingTime === 'string' && closingTime.trim()) ? closingTime.trim() : null;

    if (finalOpen && finalClose) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(finalOpen) || !timeRegex.test(finalClose)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format. Please use HH:mm format (e.g., 09:00, 21:00).',
        });
      }
      if (finalClose <= finalOpen) {
        return res.status(400).json({
          success: false,
          message: 'Closing time must be after opening time.',
        });
      }
    }

    const shopIdTemp = new mongoose.Types.ObjectId();
    let finalLogo = logo || '';
    let finalCover = coverImage || '';

    if (typeof finalLogo === 'string' && finalLogo.startsWith('data:image/')) {
      const uploadRes = await uploadBase64Image(finalLogo, { folder: `nearcart/shops/${shopIdTemp}/logo`, public_id: `logo_${shopIdTemp}`, overwrite: true });
      if (uploadRes.success && uploadRes.url && !uploadRes.url.startsWith('data:image/')) {
        finalLogo = uploadRes.url;
      } else {
        return res.status(400).json({ success: false, message: 'Cloudinary upload failed for logo. Base64 storage is not allowed.' });
      }
    }

    if (typeof finalCover === 'string' && finalCover.startsWith('data:image/')) {
      const uploadRes = await uploadBase64Image(finalCover, { folder: `nearcart/shops/${shopIdTemp}/cover`, public_id: `coverImage_${shopIdTemp}`, overwrite: true });
      if (uploadRes.success && uploadRes.url && !uploadRes.url.startsWith('data:image/')) {
        finalCover = uploadRes.url;
      } else {
        return res.status(400).json({ success: false, message: 'Cloudinary upload failed for cover image. Base64 storage is not allowed.' });
      }
    }

    assertNoBase64Image({ logo: finalLogo, coverImage: finalCover }, 'Shop images');

    const shop = await Shop.create({
      _id: shopIdTemp,
      name: name.trim(),
      description: description ? description.trim() : '',
      phone: phone ? phone.trim() : '',
      owner: req.user._id,
      category,
      address: address.trim(),
      openingTime: finalOpen,
      closingTime: finalClose,
      minimumOrderAmount: Number(minimumOrderAmount) || 0,
      deliveryFee: Number(deliveryFee) || 0,
      packingCharges: packingCharges !== undefined ? Math.max(0, Number(packingCharges) || 0) : 0,
      logo: finalLogo,
      coverImage: finalCover,
      foodType: finalFoodType,
      isApproved: true, // Auto approve for convenience in development
      isActive: true,
      isOpen: true,
    });

    res.status(201).json({
      success: true,
      message: 'Shop created successfully',
      shop,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/shopkeeper/shop
// @desc    Get logged-in shopkeeper's shop details (supports ?shopId= for multi-shop)
// @access  Private/Shopkeeper
export const getMyShop = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res, true);
    if (res.headersSent) return;

    res.status(200).json({
      success: true,
      shop: shop || null,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/shopkeeper/shop
// @desc    Update shop details for logged-in shopkeeper (supports ?shopId= for multi-shop)
// @access  Private/Shopkeeper
export const updateShop = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const {
      name,
      description,
      phone,
      category,
      address,
      openingTime,
      closingTime,
      minimumOrderAmount,
      deliveryFee,
      deliveryChargeSlabs,
      packingCharges,
      logo,
      coverImage,
      isOpen,
      upiEnabled,
      upiId,
      upiQrImage,
      latitude,
      longitude,
      location,
      foodType,
      customFoodType,
    } = req.body;

    // Validate delivery charge slabs if provided
    if (deliveryChargeSlabs !== undefined) {
      const slabError = validateDeliveryChargeSlabs(deliveryChargeSlabs);
      if (slabError) {
        return res.status(400).json({
          success: false,
          message: slabError,
        });
      }
    }

    if (foodType !== undefined || customFoodType !== undefined) {
      let finalFoodType = '';
      if (foodType === 'Custom') {
        finalFoodType = customFoodType ? customFoodType.trim() : '';
        if (!finalFoodType) {
          return res.status(400).json({
            success: false,
            message: 'Custom food type is required and cannot be empty.',
          });
        }
      } else if (foodType) {
        finalFoodType = foodType.trim();
      }

      if (finalFoodType.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Food type cannot exceed 50 characters.',
        });
      }
      shop.foodType = finalFoodType;
    }

    const newOpen = openingTime !== undefined ? (openingTime && openingTime.trim() ? openingTime.trim() : null) : shop.openingTime;
    const newClose = closingTime !== undefined ? (closingTime && closingTime.trim() ? closingTime.trim() : null) : shop.closingTime;

    if (newOpen || newClose) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if ((newOpen && !timeRegex.test(newOpen)) || (newClose && !timeRegex.test(newClose))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format. Please use HH:mm format (e.g., 09:00, 21:00).',
        });
      }
      if (newOpen && newClose && newClose <= newOpen) {
        return res.status(400).json({
          success: false,
          message: 'Closing time must be after opening time.',
        });
      }
    }

    if (name) shop.name = name.trim();
    if (description !== undefined) shop.description = description.trim();
    if (phone !== undefined) shop.phone = phone.trim();
    if (category) shop.category = category;
    if (address) shop.address = address.trim();
    shop.openingTime = newOpen;
    shop.closingTime = newClose;
    if (minimumOrderAmount !== undefined) shop.minimumOrderAmount = Number(minimumOrderAmount);
    if (deliveryFee !== undefined) shop.deliveryFee = Number(deliveryFee);
    if (deliveryChargeSlabs !== undefined) shop.deliveryChargeSlabs = deliveryChargeSlabs;
    if (packingCharges !== undefined) shop.packingCharges = Math.max(0, Number(packingCharges) || 0);
    if (logo !== undefined) {
      if (typeof logo === 'string' && logo.startsWith('data:image/')) {
        const uploadRes = await uploadBase64Image(logo, { folder: `nearcart/shops/${shop._id}/logo`, public_id: `logo_${shop._id}`, overwrite: true });
        if (uploadRes.success && uploadRes.url && !uploadRes.url.startsWith('data:image/')) {
          shop.logo = uploadRes.url;
        } else {
          return res.status(400).json({ success: false, message: 'Cloudinary upload failed for logo. Base64 storage is not allowed.' });
        }
      } else {
        shop.logo = logo;
      }
    }
    if (coverImage !== undefined) {
      if (typeof coverImage === 'string' && coverImage.startsWith('data:image/')) {
        const uploadRes = await uploadBase64Image(coverImage, { folder: `nearcart/shops/${shop._id}/cover`, public_id: `coverImage_${shop._id}`, overwrite: true });
        if (uploadRes.success && uploadRes.url && !uploadRes.url.startsWith('data:image/')) {
          shop.coverImage = uploadRes.url;
        } else {
          return res.status(400).json({ success: false, message: 'Cloudinary upload failed for cover image. Base64 storage is not allowed.' });
        }
      } else {
        shop.coverImage = coverImage;
      }
    }
    if (isOpen !== undefined) shop.isOpen = Boolean(isOpen);
    if (upiEnabled !== undefined) shop.upiEnabled = Boolean(upiEnabled);
    if (upiId !== undefined) shop.upiId = upiId.trim();
    if (upiQrImage !== undefined) {
      if (typeof upiQrImage === 'string' && upiQrImage.startsWith('data:image/')) {
        const uploadRes = await uploadBase64Image(upiQrImage, { folder: `nearcart/shops/${shop._id}/upi-qr`, public_id: `upiQrImage_${shop._id}`, overwrite: true });
        if (uploadRes.success && uploadRes.url && !uploadRes.url.startsWith('data:image/')) {
          shop.upiQrImage = uploadRes.url;
          if (uploadRes.public_id) shop.upiQrPublicId = uploadRes.public_id;
        } else {
          return res.status(400).json({ success: false, message: 'Cloudinary upload failed for UPI QR image. Base64 storage is not allowed.' });
        }
      } else {
        shop.upiQrImage = upiQrImage;
      }
    }

    assertNoBase64Image({ logo: shop.logo, coverImage: shop.coverImage, upiQrImage: shop.upiQrImage }, 'Shop update images');

    if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      shop.location = {
        type: 'Point',
        coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
      };
    } else if (latitude !== undefined && longitude !== undefined) {
      shop.location = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    await shop.save();

    res.status(200).json({
      success: true,
      message: 'Shop details updated successfully',
      shop,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/shopkeeper/products
// @desc    Get all products belonging to logged-in shopkeeper's shop (supports ?shopId=)
// @access  Private/Shopkeeper
export const getShopkeeperProducts = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(200).json({ success: true, products: [] });
    }

    const products = await Product.find({ shop: shop._id })
      .select('name description category price discountPrice unit stock sku isAvailable isActive rating totalRatings gstPercentage packingCharges variantName createdAt updatedAt images')
      .slice('images', 1)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/shopkeeper/products
// @desc    Add a product to shopkeeper's shop (supports ?shopId= for multi-shop)
// @access  Private/Shopkeeper
export const createProduct = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'You must create a shop before adding products.',
      });
    }

    const {
      name,
      description,
      category,
      price,
      discountPrice,
      unit,
      stock,
      sku,
      isAvailable,
      images,
      gstPercentage,
      packingCharges,
      idempotencyKey,
      variants,
    } = req.body;

    const key = idempotencyKey || req.headers['x-idempotency-key'] || null;

    const processedImages = await processImagesForStorage(Array.isArray(images) ? images : []);

    assertNoBase64Image(processedImages, 'product images');

    // Multi-variant product creation flow
    if (Array.isArray(variants) && variants.length > 0) {
      if (!name || !category || !unit) {
        return res.status(400).json({
          success: false,
          message: 'Product name, category, and unit are required.',
        });
      }

      // Idempotency check for multi-variant
      if (key) {
        const existingKeyProducts = await Product.find({
          shop: shop._id,
          idempotencyKey: { $regex: `^${key}` },
        }).sort({ createdAt: 1 });

        if (existingKeyProducts.length >= variants.length) {
          return res.status(200).json({
            success: true,
            message: `${existingKeyProducts.length} product${existingKeyProducts.length > 1 ? 's' : ''} added successfully.`,
            count: existingKeyProducts.length,
            products: existingKeyProducts,
          });
        }
      }

      // Validate variants array
      const variantNamesSeen = new Set();
      const validatedVariants = [];

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const vName = (v.name || v.variantName || '').trim();
        if (!vName) {
          return res.status(400).json({
            success: false,
            message: 'Variant name is required for all selected options.',
          });
        }

        const lowerVName = vName.toLowerCase();
        if (variantNamesSeen.has(lowerVName)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate variant name "${vName}" is not allowed in the same submission.`,
          });
        }
        variantNamesSeen.add(lowerVName);

        if (v.price === undefined || v.price === '' || isNaN(Number(v.price))) {
          return res.status(400).json({
            success: false,
            message: `Valid price is required for variant "${vName}".`,
          });
        }
        const vPrice = Number(v.price);
        if (vPrice < 0) {
          return res.status(400).json({
            success: false,
            message: `Price for variant "${vName}" cannot be negative.`,
          });
        }

        const vStock = v.stock !== undefined && v.stock !== '' ? Number(v.stock) : (Number(stock) || 0);
        if (vStock < 0) {
          return res.status(400).json({
            success: false,
            message: `Stock for variant "${vName}" cannot be negative.`,
          });
        }

        const vPackingCharges = v.packingCharges !== undefined && v.packingCharges !== ''
          ? Math.max(0, Number(v.packingCharges) || 0)
          : (packingCharges !== undefined && packingCharges !== '' ? Math.max(0, Number(packingCharges) || 0) : 0);

        if (vPackingCharges < 0) {
          return res.status(400).json({
            success: false,
            message: `Packing charges for variant "${vName}" cannot be negative.`,
          });
        }

        const vImages = Array.isArray(v.images) && v.images.length > 0 ? await processImagesForStorage(v.images) : processedImages;
        assertNoBase64Image(vImages, `variant images for "${vName}"`);

        validatedVariants.push({
          name: vName,
          price: vPrice,
          stock: vStock,
          packingCharges: vPackingCharges,
          images: vImages,
        });
      }

      // Helper to generate formatted display name
      const formatProductName = (base, variant) => {
        const trimmedBase = base.trim();
        const trimmedVariant = variant.trim();
        const lowerBase = trimmedBase.toLowerCase();
        const lowerVariant = trimmedVariant.toLowerCase();

        if (lowerBase.endsWith(` - ${lowerVariant}`) || lowerBase.endsWith(`-${lowerVariant}`)) {
          return trimmedBase;
        }
        if (lowerBase === lowerVariant) {
          return trimmedBase;
        }
        return `${trimmedBase} - ${trimmedVariant}`;
      };

      // Create variants using transaction if supported, else safe batch
      let session = null;
      let useTransaction = false;
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        useTransaction = true;
      } catch (e) {
        session = null;
        useTransaction = false;
      }

      const createdProducts = [];
      try {
        for (let i = 0; i < validatedVariants.length; i++) {
          const v = validatedVariants[i];
          const fullProductName = formatProductName(name, v.name);
          const varIdempotencyKey = key ? `${key}_${i}_${v.name.replace(/\s+/g, '_')}` : undefined;

          const prodData = {
            shop: shop._id,
            category,
            name: fullProductName,
            variantName: v.name,
            description: description ? description.trim() : '',
            price: v.price,
            unit: unit.trim(),
            stock: v.stock,
            isAvailable: v.stock > 0,
            images: v.images || processedImages,
            gstPercentage: gstPercentage !== undefined && gstPercentage !== '' ? Math.min(100, Math.max(0, Number(gstPercentage) || 0)) : 0,
            packingCharges: v.packingCharges,
            ...(varIdempotencyKey ? { idempotencyKey: varIdempotencyKey } : {}),
            isActive: true,
          };

          assertNoBase64Image(prodData.images, 'variant images');

          let created;
          if (useTransaction && session) {
            const [doc] = await Product.create([prodData], { session });
            created = doc;
          } else {
            created = await Product.create(prodData);
          }
          createdProducts.push(created);
        }

        if (useTransaction && session) {
          await session.commitTransaction();
          session.endSession();
        }

        const count = createdProducts.length;
        return res.status(201).json({
          success: true,
          message: `${count} product${count > 1 ? 's' : ''} added successfully.`,
          count,
          products: createdProducts,
        });
      } catch (batchErr) {
        if (useTransaction && session) {
          await session.abortTransaction();
          session.endSession();
        } else if (createdProducts.length > 0) {
          const createdIds = createdProducts.map((p) => p._id);
          await Product.deleteMany({ _id: { $in: createdIds } });
        }
        throw batchErr;
      }
    }

    // Single product creation flow (existing)
    if (key) {
      const existingProduct = await Product.findOne({ shop: shop._id, idempotencyKey: key });
      if (existingProduct) {
        return res.status(200).json({
          success: true,
          message: 'Product created successfully',
          product: existingProduct,
        });
      }
    }

    if (!name || price === undefined || !category || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Product name, price, category, and unit are required.',
      });
    }

    const numPrice = Number(price);
    const numDiscount = discountPrice !== undefined && discountPrice !== '' ? Number(discountPrice) : undefined;
    const numStock = Number(stock) || 0;

    if (numPrice < 0 || numStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price and stock cannot be negative.',
      });
    }

    if (packingCharges !== undefined && Number(packingCharges) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Packing charges cannot be negative.',
      });
    }

    if (numDiscount !== undefined && (numDiscount < 0 || numDiscount > numPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Discount price must be non-negative and less than or equal to original price.',
      });
    }

    try {
      assertNoBase64Image(processedImages, 'single product images');
      const product = await Product.create({
        shop: shop._id,
        category,
        name: name.trim(),
        variantName: req.body.variantName ? req.body.variantName.trim() : '',
        description: description ? description.trim() : '',
        price: numPrice,
        discountPrice: numDiscount,
        unit: unit.trim(),
        stock: numStock,
        sku: sku ? sku.trim() : '',
        isAvailable: isAvailable !== undefined ? isAvailable : numStock > 0,
        images: processedImages,
        gstPercentage: gstPercentage !== undefined && gstPercentage !== '' ? Math.min(100, Math.max(0, Number(gstPercentage) || 0)) : 0,
        packingCharges: packingCharges !== undefined && packingCharges !== '' ? Math.max(0, Number(packingCharges) || 0) : 0,
        ...(key ? { idempotencyKey: key } : {}),
        isActive: true,
      });

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        product,
      });
    } catch (createErr) {
      if (createErr.code === 11000 && key) {
        const existingProduct = await Product.findOne({ shop: shop._id, idempotencyKey: key });
        if (existingProduct) {
          return res.status(200).json({
            success: true,
            message: 'Product created successfully',
            product: existingProduct,
          });
        }
      }
      throw createErr;
    }
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/shopkeeper/products/:id
// @desc    Update product belonging to shopkeeper's shop (supports ?shopId=)
// @access  Private/Shopkeeper
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shopId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    let product = await Product.findOne({ _id: id, shop: shop._id });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or does not belong to your shop',
      });
    }

    const {
      name,
      description,
      category,
      price,
      discountPrice,
      unit,
      stock,
      sku,
      isAvailable,
      images,
      gstPercentage,
      packingCharges,
      variantName,
    } = req.body;

    if (price !== undefined && Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price cannot be negative' });
    }

    if (packingCharges !== undefined && Number(packingCharges) < 0) {
      return res.status(400).json({ success: false, message: 'Packing charges cannot be negative' });
    }

    if (stock !== undefined && Number(stock) < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot be negative' });
    }

    if (name) product.name = name.trim();
    if (variantName !== undefined) product.variantName = variantName ? variantName.trim() : '';
    if (description !== undefined) product.description = description.trim();
    if (category) product.category = category;
    if (price !== undefined) product.price = Number(price);
    if (discountPrice !== undefined) {
      product.discountPrice = discountPrice !== '' ? Number(discountPrice) : undefined;
    }
    if (unit) product.unit = unit.trim();
    if (stock !== undefined) product.stock = Number(stock);
    if (sku !== undefined) product.sku = sku.trim();
    if (isAvailable !== undefined) product.isAvailable = isAvailable;
    if (images && Array.isArray(images)) {
      product.images = await processImagesForStorage(images);
    }
    if (gstPercentage !== undefined) product.gstPercentage = Math.min(100, Math.max(0, Number(gstPercentage) || 0));
    if (packingCharges !== undefined) product.packingCharges = Math.max(0, Number(packingCharges) || 0);

    if (product.stock === 0) {
      product.isAvailable = false;
    }

    assertNoBase64Image(product.images, 'product update images');

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/shopkeeper/products/:id
// @desc    Delete product belonging to shopkeeper's shop (supports ?shopId=)
// @access  Private/Shopkeeper
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shopId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const product = await Product.findOneAndDelete({ _id: id, shop: shop._id });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or does not belong to your shop',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/shopkeeper/inventory
// @desc    Get inventory items with low-stock / stock status (supports ?shopId=)
// @access  Private/Shopkeeper
export const getInventory = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(200).json({ success: true, inventory: [] });
    }

    const products = await Product.find({ shop: shop._id })
      .populate('category', 'name')
      .select('name sku price stock isAvailable updatedAt category')
      .sort({ stock: 1 });

    const inventory = products.map((p) => {
      let stockStatus = 'IN_STOCK';
      if (p.stock === 0) stockStatus = 'OUT_OF_STOCK';
      else if (p.stock <= 5) stockStatus = 'LOW_STOCK';

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku || 'N/A',
        category: p.category?.name || 'General',
        price: p.price,
        stock: p.stock,
        isAvailable: p.isAvailable,
        stockStatus,
        lastUpdated: p.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      count: inventory.length,
      inventory,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/shopkeeper/orders
// @desc    Get orders belonging to shopkeeper's shop (supports ?shopId=)
// @access  Private/Shopkeeper
export const getShopkeeperOrders = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(200).json({ success: true, orders: [] });
    }

    const orders = await Order.find({ shop: shop._id })
      .populate('user', 'name email phone')
      .populate('address')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/shopkeeper/orders/:id/status
// @desc    Update order status within shopkeeper lifecycle limits (supports ?shopId=)
// @access  Private/Shopkeeper
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderStatus, cancellationReason } = req.body;
    const { shopId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }

    let shop;
    if (shopId) {
      shop = await getShopWithOwnership(shopId, req.user._id, res);
      if (res.headersSent) return;
    } else {
      // Fallback: find the shop that owns this specific order
      const orderForShop = await Order.findById(id).select('shop');
      if (orderForShop) {
        shop = await Shop.findOne({ _id: orderForShop.shop, owner: req.user._id });
      }
    }

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const order = await Order.findOne({ _id: id, shop: shop._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or does not belong to your shop' });
    }

    const ALLOWED_SHOP_TRANSITIONS = {
      PLACED: ['SHOP_ACCEPTED', 'SHOP_REJECTED', 'CANCELLED'],
      SHOP_ACCEPTED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
    };

    const allowed = ALLOWED_SHOP_TRANSITIONS[order.orderStatus] || [];
    if (!allowed.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Shopkeepers cannot transition status from ${order.orderStatus} to ${orderStatus}. Allowed transitions: ${allowed.join(', ')}`,
      });
    }

    const previousStatus = order.orderStatus;
    order.orderStatus = orderStatus;
    if (cancellationReason) {
      order.cancellationReason = cancellationReason.trim();
    }

    await order.save();

    // Stock Restoration: If order transitioned to CANCELLED or SHOP_REJECTED from an active state, restore inventory
    if (['CANCELLED', 'SHOP_REJECTED'].includes(orderStatus) && !['CANCELLED', 'SHOP_REJECTED'].includes(previousStatus)) {
      for (const item of order.items) {
        if (item.product) {
          const product = await Product.findById(item.product);
          if (product) {
            product.stock += item.quantity;
            if (product.stock > 0 && !product.isAvailable) {
              product.isAvailable = true;
            }
            await product.save();
          }
        }
      }
    }

    // Create Notification document for Student on order status change
    let studentNotification = null;
    try {
      let notifTitle = `Order Status: ${orderStatus.replace(/_/g, ' ')}`;
      let notifMsg = `Your order ${order.orderNumber} status updated to ${orderStatus.replace(/_/g, ' ')}.`;

      if (orderStatus === 'SHOP_ACCEPTED') {
        notifTitle = 'Order Accepted';
        notifMsg = `Your order ${order.orderNumber} has been accepted by the shop.`;
      } else if (orderStatus === 'PREPARING') {
        notifTitle = 'Order Preparing';
        notifMsg = `The shop is now preparing your order ${order.orderNumber}.`;
      } else if (orderStatus === 'READY_FOR_PICKUP') {
        notifTitle = 'Order Ready';
        notifMsg = `Your order ${order.orderNumber} is ready for pickup/delivery!`;
      } else if (orderStatus === 'SHOP_REJECTED') {
        notifTitle = 'Order Rejected';
        const reasonMsg = order.cancellationReason ? ` Reason: ${order.cancellationReason}` : '';
        notifMsg = `Your order ${order.orderNumber} was rejected by the shop.${reasonMsg}`;
      } else if (orderStatus === 'CANCELLED') {
        notifTitle = 'Order Cancelled';
        const reasonMsg = order.cancellationReason ? ` Reason: ${order.cancellationReason}` : '';
        notifMsg = `Order ${order.orderNumber} was cancelled.${reasonMsg}`;
      }

      studentNotification = await Notification.create({
        user: order.user,
        title: notifTitle,
        message: notifMsg,
        type: 'ORDER',
        relatedOrder: order._id,
        isRead: false,
      });
    } catch (notifErr) {
      console.warn('Shopkeeper status notification creation notice:', notifErr.message);
    }

    // Broadcast Socket.IO event and FCM Push notification for status change
    try {
      const { getIO } = await import('../config/socket.js');
      const { sendPushToUser } = await import('../services/pushNotificationService.js');
      const io = getIO();

      if (studentNotification) {
        io.to(`user:${order.user.toString()}`).emit('notification:new', {
          _id: studentNotification._id,
          title: studentNotification.title,
          message: studentNotification.message,
          type: studentNotification.type,
          relatedOrder: studentNotification.relatedOrder,
          isRead: studentNotification.isRead,
          createdAt: studentNotification.createdAt,
        });
      }

      const statusPayload = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        previousStatus,
        shopId: shop._id,
        updatedAt: order.updatedAt,
      };

      // Emit to Student
      io.to(`user:${order.user.toString()}`).emit('order:updated', statusPayload);
      // Emit to Shopkeeper
      io.to(`user:${req.user._id.toString()}`).emit('order:updated', statusPayload);

      // Send FCM push to Student
      sendPushToUser(order.user, {
        title: studentNotification?.title || `Order Status: ${orderStatus.replace(/_/g, ' ')}`,
        body: studentNotification?.message || `Your order ${order.orderNumber} status changed to ${orderStatus.replace(/_/g, ' ')}.`,
        orderId: order._id,
        type: 'ORDER',
        url: `/orders/${order._id}`,
      }).catch((err) => console.warn('Student FCM status update notice:', err.message));
    } catch (sockErr) {
      console.warn('Socket/FCM order status update notice:', sockErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${orderStatus}`,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// COUPON MANAGEMENT FOR SHOPKEEPERS
// ==========================================

// @route   GET /api/shopkeeper/coupons
// @desc    Get all coupons for logged-in shopkeeper's shop (supports ?shopId=)
// @access  Private/Shopkeeper
export const getShopkeeperCoupons = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(200).json({
        success: true,
        coupons: [],
      });
    }

    const coupons = await Coupon.find({ shopId: shop._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      coupons,
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/shopkeeper/coupons
// @desc    Create a new coupon for shopkeeper's shop (supports ?shopId=)
// @access  Private/Shopkeeper
export const createShopkeeperCoupon = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'Please create and setup your shop first before creating coupons',
      });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscount,
      usageLimit,
      startDate,
      endDate,
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required',
      });
    }

    const formattedCode = code.trim().toUpperCase();

    // Check if code already exists globally
    const existingCoupon = await Coupon.findOne({ code: formattedCode });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'A coupon with this code already exists. Please choose a different code.',
      });
    }

    if (!discountType || !['PERCENTAGE', 'FIXED'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'Discount type must be either PERCENTAGE or FIXED',
      });
    }

    const numValue = Number(discountValue);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be greater than 0',
      });
    }

    if (discountType === 'PERCENTAGE' && numValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be greater than or equal to start date',
      });
    }

    const newCoupon = await Coupon.create({
      code: formattedCode,
      description: description ? description.trim() : '',
      discountType,
      discountValue: numValue,
      minimumOrderAmount: Number(minimumOrderAmount) || 0,
      maximumDiscount: maximumDiscount !== undefined && maximumDiscount !== '' && maximumDiscount !== null ? Number(maximumDiscount) : null,
      usageLimit: usageLimit !== undefined && usageLimit !== '' && usageLimit !== null ? Number(usageLimit) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      shopId: shop._id,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon: newCoupon,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/shopkeeper/coupons/:id
// @desc    Update an existing coupon (supports ?shopId=)
// @access  Private/Shopkeeper
export const updateShopkeeperCoupon = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const coupon = await Coupon.findOne({ _id: req.params.id, shopId: shop._id });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found or access denied' });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscount,
      usageLimit,
      startDate,
      endDate,
      isActive,
    } = req.body;

    if (code && code.trim().toUpperCase() !== coupon.code) {
      const formattedCode = code.trim().toUpperCase();
      const existing = await Coupon.findOne({ code: formattedCode });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A coupon with this code already exists',
        });
      }
      coupon.code = formattedCode;
    }

    if (description !== undefined) coupon.description = description.trim();
    if (discountType && ['PERCENTAGE', 'FIXED'].includes(discountType)) coupon.discountType = discountType;
    if (discountValue !== undefined) {
      const val = Number(discountValue);
      if (val > 0) {
        if (coupon.discountType === 'PERCENTAGE' && val > 100) {
          return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
        }
        coupon.discountValue = val;
      }
    }
    if (minimumOrderAmount !== undefined) coupon.minimumOrderAmount = Number(minimumOrderAmount) || 0;
    if (maximumDiscount !== undefined) coupon.maximumDiscount = maximumDiscount !== '' && maximumDiscount !== null ? Number(maximumDiscount) : null;
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit !== '' && usageLimit !== null ? Number(usageLimit) : null;
    if (startDate) coupon.startDate = new Date(startDate);
    if (endDate) coupon.endDate = new Date(endDate);
    if (isActive !== undefined) coupon.isActive = Boolean(isActive);

    if (coupon.endDate < coupon.startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be greater than or equal to start date',
      });
    }

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/shopkeeper/coupons/:id/toggle
// @desc    Toggle coupon active status (supports ?shopId=)
// @access  Private/Shopkeeper
export const toggleShopkeeperCoupon = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const coupon = await Coupon.findOne({ _id: req.params.id, shopId: shop._id });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found or access denied' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      coupon,
    });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/shopkeeper/coupons/:id
// @desc    Delete a coupon (supports ?shopId=)
// @access  Private/Shopkeeper
export const deleteShopkeeperCoupon = async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const shop = await getShopWithOwnership(shopId, req.user._id, res);
    if (res.headersSent) return;

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const coupon = await Coupon.findOneAndDelete({ _id: req.params.id, shopId: shop._id });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found or access denied' });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
