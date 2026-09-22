const path = require('path');
const fs = require('fs');

const serverNodeModules = path.join(__dirname, '..', 'server', 'node_modules');
const mongoose = require(path.join(serverNodeModules, 'mongoose'));

// Load server/.env file
const envPath = path.join(__dirname, '..', 'server', '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Helper mock response object
function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      this.headersSent = true;
      return this;
    }
  };
}

const mockNext = (err) => {
  if (err) console.error('Express next() error:', err);
};

function makeQueryMock(targetObj) {
  return () => {
    const mock = {
      then: (resolve, reject) => Promise.resolve(targetObj).then(resolve, reject),
      populate: () => ({
        then: (resolve, reject) => Promise.resolve(targetObj).then(resolve, reject)
      })
    };
    return mock;
  };
}

async function runDirectTests() {
  console.log('=== Running Direct Controller & Schema Verification ===');

  try {
    const dbUri = process.env.MONGO_URI || 'mongodb+srv://satyamsmartboy143_db_user:Satyam_788058@cluster0.whawppn.mongodb.net/';
    console.log('Connecting to MongoDB...');
    try {
      await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 5000 });
      console.log('✓ Connected to MongoDB');
    } catch (connErr) {
      console.log('Mongo connection offline/timeout, performing schema unit tests...');
    }

    // Register models
    require(path.join(__dirname, '..', 'server', 'models', 'User.js'));
    require(path.join(__dirname, '..', 'server', 'models', 'Shop.js'));
    require(path.join(__dirname, '..', 'server', 'models', 'Product.js'));
    require(path.join(__dirname, '..', 'server', 'models', 'Category.js'));

    const User = mongoose.model('User');
    const Shop = mongoose.model('Shop');
    const Product = mongoose.model('Product');
    const Category = mongoose.model('Category');

    // 1. Verify Shop model has foodType field schema
    const shopPaths = Shop.schema.paths;
    if (!shopPaths.foodType) {
      throw new Error('Shop schema missing foodType field!');
    }
    console.log('✓ Shop schema has foodType field registered');

    // 2. Verify Product model has variantName field schema
    const productPaths = Product.schema.paths;
    if (!productPaths.variantName) {
      throw new Error('Product schema missing variantName field!');
    }
    console.log('✓ Product schema has variantName field registered');

    // 3. Import shopkeeperController ES module functions
    const shopkeeperControllerPath = path.join(__dirname, '..', 'server', 'controllers', 'shopkeeperController.js');
    const shopkeeperController = await import(`file://${shopkeeperControllerPath.replace(/\\/g, '/')}`);

    const { createShop, updateShop, createProduct } = shopkeeperController;

    const mockCategoryId = new mongoose.Types.ObjectId();
    const origCategoryFindById = Category.findById;
    Category.findById = makeQueryMock({ _id: mockCategoryId, name: 'Food & Dining' });

    // Test 1: Food Type validation in createShop logic
    console.log('\n--- Test 1: Custom Food Type Validation ---');
    const mockReqCustomFoodEmpty = {
      user: { _id: new mongoose.Types.ObjectId() },
      headers: {},
      body: {
        name: 'Test Food Corner',
        category: mockCategoryId,
        address: 'Main Gate',
        foodType: 'Custom',
        customFoodType: '   '
      }
    };
    const mockRes1 = createMockRes();
    await createShop(mockReqCustomFoodEmpty, mockRes1, mockNext);
    console.log(`✓ Empty custom food type rejected with status ${mockRes1.statusCode}: "${mockRes1.data?.message}"`);
    if (mockRes1.statusCode !== 400) {
      throw new Error('Expected status 400 for empty custom food type');
    }

    // Test 2: Custom Food Type Trim & Save
    const mockReqCustomFoodValid = {
      user: { _id: new mongoose.Types.ObjectId() },
      headers: {},
      body: {
        name: 'Valid Momos Hub',
        category: mockCategoryId,
        foodType: 'Custom',
        customFoodType: '  Momos & Chinese Point  ',
        address: 'Stall 1',
        openingTime: '10:00',
        closingTime: '22:00',
        phone: '9876543210'
      }
    };
    // Mock Shop.create
    let savedShopData = null;
    const origShopCreate = Shop.create;
    Shop.create = async (data) => {
      savedShopData = data;
      return { _id: new mongoose.Types.ObjectId(), ...data };
    };

    const mockRes2 = createMockRes();
    await createShop(mockReqCustomFoodValid, mockRes2, mockNext);
    Shop.create = origShopCreate; // restore

    console.log(`✓ Custom food type saved as: "${savedShopData.foodType}" (Expected: "Momos & Chinese Point")`);
    if (savedShopData.foodType !== 'Momos & Chinese Point') {
      throw new Error(`Trim failed! Got: ${savedShopData.foodType}`);
    }

    // Test 3: Multi-Variant Product Creation Logic
    console.log('\n--- Test 3: Multi-Variant Product Batch Creation ---');
    const mockShopId = new mongoose.Types.ObjectId();
    const mockUserId = new mongoose.Types.ObjectId();

    const origShopFindById = Shop.findById;
    Shop.findById = makeQueryMock({ _id: mockShopId, owner: mockUserId });

    let insertedProducts = [];
    const origProductCreate = Product.create;
    Product.create = async (docs) => {
      const docArr = Array.isArray(docs) ? docs : [docs];
      const createdList = docArr.map(d => ({ _id: new mongoose.Types.ObjectId(), ...d }));
      insertedProducts.push(...createdList);
      return Array.isArray(docs) ? createdList : createdList[0];
    };

    const mockReqVariants = {
      user: { _id: mockUserId },
      headers: {},
      query: { shopId: mockShopId.toString() },
      body: {
        name: 'Veg Pizza',
        category: mockCategoryId,
        unit: 'piece',
        variants: [
          { variantName: 'Small', price: 150, stock: 10, packingCharges: 5 },
          { variantName: 'Medium', price: 250, stock: 15, packingCharges: 10 },
          { variantName: 'Large', price: 350, stock: 8, packingCharges: 15 }
        ]
      }
    };

    const mockRes3 = createMockRes();
    await createProduct(mockReqVariants, mockRes3, mockNext);

    console.log(`✓ Batch create status ${mockRes3.statusCode}: "${mockRes3.data?.message}"`);
    console.log(`✓ Response created count: ${mockRes3.data?.products?.length || 0}`);
    const returnedProds = mockRes3.data?.products || [];
    if (returnedProds.length !== 3) {
      throw new Error(`Expected 3 variants created, got ${returnedProds.length}`);
    }

    console.log('✓ Created product names:', returnedProds.map(p => p.name));
    if (returnedProds[0].name !== 'Veg Pizza - Small' || returnedProds[1].name !== 'Veg Pizza - Medium' || returnedProds[2].name !== 'Veg Pizza - Large') {
      throw new Error('Variant product names formatting incorrect!');
    }

    // Test 4: Duplicate Variant Name Rejection
    console.log('\n--- Test 4: Duplicate Variant Name Rejection ---');
    const mockReqDupVariants = {
      user: { _id: mockUserId },
      headers: {},
      query: { shopId: mockShopId.toString() },
      body: {
        name: 'Cold Coffee',
        category: mockCategoryId,
        unit: 'cup',
        variants: [
          { variantName: 'Small', price: 50, stock: 10 },
          { variantName: 'SMALL', price: 60, stock: 10 }
        ]
      }
    };
    const mockRes4 = createMockRes();
    await createProduct(mockReqDupVariants, mockRes4, mockNext);

    console.log(`✓ Duplicate variant rejected with status ${mockRes4.statusCode}: "${mockRes4.data?.message}"`);
    if (mockRes4.statusCode !== 400) {
      throw new Error('Expected status 400 for duplicate variant names');
    }

    // Test 5: Shop Ownership Rejection (403)
    console.log('\n--- Test 5: Shop Ownership Verification (403) ---');
    const mockOtherOwnerId = new mongoose.Types.ObjectId();
    const mockReqOwnershipViolation = {
      user: { _id: new mongoose.Types.ObjectId() }, // Different user ID
      headers: {},
      query: { shopId: mockShopId.toString() },
      body: {
        name: 'Hacked Item',
        category: mockCategoryId,
        unit: 'piece',
        price: 10,
        stock: 5
      }
    };
    Shop.findById = makeQueryMock({ _id: mockShopId, owner: mockOtherOwnerId }); // Owned by someone else
    const mockRes5 = createMockRes();
    await createProduct(mockReqOwnershipViolation, mockRes5, mockNext);
    Shop.findById = origShopFindById;
    Product.create = origProductCreate;
    Category.findById = origCategoryFindById;

    console.log(`✓ Unauthorized product create rejected with status ${mockRes5.statusCode}: "${mockRes5.data?.message}"`);
    if (mockRes5.statusCode !== 403) {
      throw new Error('Expected status 403 for shop ownership violation');
    }

    console.log('\n==================================================');
    console.log('ALL 5 CONTROLLER & MODEL TESTS PASSED SUCCESSFULLY! 🚀');
    console.log('==================================================\n');

  } catch (err) {
    console.error('❌ Test failed:', err.stack || err.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runDirectTests();
