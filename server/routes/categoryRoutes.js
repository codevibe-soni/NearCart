import express from 'express';
import { getCategories, getShopCategories } from '../controllers/categoryController.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/shop/:shopId', getShopCategories);

export default router;
