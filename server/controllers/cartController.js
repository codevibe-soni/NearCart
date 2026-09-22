import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';

/**
 * @desc    Get current student's cart
 * @route   GET /api/cart
 * @access  Private (Student)
 */
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate({
        path: 'items.product',
        select: 'name price discountPrice images isAvailable stock unit shop gstPercentage packingCharges',
      })
      .populate({
        path: 'items.shop',
        select: 'name isApproved isActive deliveryFee deliveryChargeSlabs location minimumOrder upiEnabled upiId upiQrImage'
      });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Filter out deleted products if any, update latest effective prices
    let updated = false;
    const validItems = [];

    for (const item of cart.items) {
      if (item.product && item.shop) {
        // Calculate server-side effective selling price
        const effectivePrice =
          item.product.discountPrice != null && item.product.discountPrice < item.product.price
            ? item.product.discountPrice
            : item.product.price;

        if (item.price !== effectivePrice) {
          item.price = effectivePrice;
          updated = true;
        }
        validItems.push(item);
      } else {
        updated = true;
      }
    }

    if (updated) {
      cart.items = validItems;
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve cart',
      error: error.message,
    });
  }
};

/**
 * @desc    Add product to cart (or update quantity if already in cart)
 * @route   POST /api/cart/add
 * @access  Private (Student)
 */
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, clearCartFirst = false } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }

    // Fetch product and shop from DB
    const product = await Product.findById(productId).populate('shop');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Product is currently not available',
      });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} units available in stock`,
      });
    }

    if (!product.shop || !product.shop.isApproved || !product.shop.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Shop is not currently accepting orders',
      });
    }

    // Calculate effective selling price
    const effectivePrice =
      product.discountPrice != null && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check Single Shop Cart Rule
    if (cart.items.length > 0) {
      const existingShopId = cart.items[0].shop.toString();
      const newShopId = product.shop._id.toString();

      if (existingShopId !== newShopId) {
        if (clearCartFirst) {
          // User confirmed clearing cart for new shop
          cart.items = [];
        } else {
          return res.status(409).json({
            success: false,
            differentShop: true,
            message: 'Your cart contains items from another shop. Clear cart to add items from this shop?',
          });
        }
      }
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      const newQty = cart.items[existingItemIndex].quantity + qty;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than ${product.stock} units of ${product.name}`,
        });
      }
      cart.items[existingItemIndex].quantity = newQty;
      cart.items[existingItemIndex].price = effectivePrice; // Always use latest DB effective price
    } else {
      cart.items.push({
        product: product._id,
        shop: product.shop._id,
        quantity: qty,
        price: effectivePrice,
      });
    }

    await cart.save();

    await cart.populate([
      { path: 'items.product', select: 'name price discountPrice images isAvailable stock unit shop' },
      { path: 'items.shop', select: 'name isApproved isActive deliveryFee deliveryChargeSlabs location minimumOrder upiEnabled upiId upiQrImage' },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Product added to cart successfully',
      data: cart,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message,
    });
  }
};

/**
 * @desc    Update quantity of specific product in cart
 * @route   PUT /api/cart/item/:productId
 * @access  Private (Student)
 */
export const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity',
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    if (qty === 0) {
      // Remove item if quantity is set to 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Check stock availability
      const product = await Product.findById(productId);
      if (!product || !product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Product is no longer available',
        });
      }

      if (product.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available in stock`,
        });
      }

      const effectivePrice =
        product.discountPrice != null && product.discountPrice < product.price
          ? product.discountPrice
          : product.price;

      cart.items[itemIndex].quantity = qty;
      cart.items[itemIndex].price = effectivePrice; // Update with latest DB effective price
    }

    await cart.save();

    await cart.populate([
      { path: 'items.product', select: 'name price discountPrice images isAvailable stock unit shop' },
      { path: 'items.shop', select: 'name isApproved isActive deliveryFee deliveryChargeSlabs location minimumOrder upiEnabled upiId upiQrImage' },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      data: cart,
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update cart item',
      error: error.message,
    });
  }
};

/**
 * @desc    Remove single item from cart
 * @route   DELETE /api/cart/item/:productId
 * @access  Private (Student)
 */
export const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();

    await cart.populate([
      { path: 'items.product', select: 'name price discountPrice images isAvailable stock unit shop' },
      { path: 'items.shop', select: 'name isApproved isActive deliveryFee deliveryChargeSlabs location minimumOrder upiEnabled upiId upiQrImage' },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: cart,
    });
  } catch (error) {
    console.error('Error removing cart item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message,
    });
  }
};

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart/clear
 * @access  Private (Student)
 */
export const clearCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart || { items: [] },
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message,
    });
  }
};
