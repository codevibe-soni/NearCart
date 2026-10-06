import express from 'express';
import { protect, authorizeRoles  } from '../middleware/authMiddleware.js';
import {
  getAddresses,
  getHostels,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/addressController.js';

const router = express.Router();

router.use(protect);
router.use(authorizeRoles ('STUDENT'));

router.get('/hostels', getHostels);
router.get('/', getAddresses);
router.post('/', createAddress);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);

export default router;
