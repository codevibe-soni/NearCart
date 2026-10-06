import Address from '../models/Address.js';
import { validateCoordinates, isValidCoordinatePair } from '../utils/distanceCalculator.js';

const FORBIDDEN_PLACEHOLDERS = [
  'SELECT HOSTEL',
  'SELECT',
  'CHOOSE HOSTEL',
  'ENTER HOSTEL NAME',
  'N/A',
  'NA',
  'NONE',
  'NULL',
  'UNDEFINED',
  'TEST HOSTEL',
  'HOME ADDRESS',
  'YOUR HOSTEL',
];

const sanitizeHostelFields = (reqBody, userCustomerType) => {
  const addressLabel = (reqBody.label || 'HOSTEL').toUpperCase();
  const customerType = (userCustomerType || reqBody.customerType || 'STUDENT').toUpperCase();

  let hostelName = reqBody.hostelName ? reqBody.hostelName.trim() : '';
  let roomNumber = reqBody.roomNumber ? reqBody.roomNumber.trim() : '';

  // ATITHI or HOME addresses MUST NOT contain any hostel info
  if (customerType === 'ATITHI' || addressLabel === 'HOME') {
    return { hostelName: '', roomNumber: '' };
  }

  // Sanitize / reject placeholder values
  if (FORBIDDEN_PLACEHOLDERS.includes(hostelName.toUpperCase())) {
    hostelName = '';
    roomNumber = '';
  }

  return { hostelName, roomNumber };
};

/**
 * Helper to extract and validate location coordinates from request body
 */
const extractAndValidateLocation = (reqBody, requireLocation = true) => {
  let lat = reqBody.latitude !== undefined ? reqBody.latitude : (reqBody.lat !== undefined ? reqBody.lat : null);
  let lng = reqBody.longitude !== undefined ? reqBody.longitude : (reqBody.lng !== undefined ? reqBody.lng : null);

  if ((lat === null || lng === null) && reqBody.location && Array.isArray(reqBody.location.coordinates) && reqBody.location.coordinates.length >= 2) {
    lng = reqBody.location.coordinates[0];
    lat = reqBody.location.coordinates[1];
  }

  if (lat === null || lng === null || lat === '' || lng === '') {
    if (requireLocation) {
      return { location: null, error: 'Please pin your exact location on the map before saving the address.' };
    }
    return { location: null, error: null };
  }

  const error = validateCoordinates(lat, lng);
  if (error) {
    return { location: null, error };
  }

  return {
    location: {
      type: 'Point',
      coordinates: [Number(lng), Number(lat)],
    },
    error: null,
  };
};

/**
 * @desc    Get available campus hostel names
 * @route   GET /api/addresses/hostels
 * @access  Private (Student)
 */
export const getHostels = async (req, res) => {
  try {
    const existingHostels = await Address.distinct('hostelName', {
      hostelName: { $exists: true, $ne: '' },
    });

    const cleanHostels = Array.from(
      new Set(
        existingHostels
          .map((h) => h && h.trim())
          .filter((h) => h && !FORBIDDEN_PLACEHOLDERS.includes(h.toUpperCase()))
      )
    );

    const defaultCampusHostels = [ 'Hostel 1', 'Hostel 5', 'Block A', 'Block B', 'Block C'];
    const allHostels = Array.from(new Set([...cleanHostels, ...defaultCampusHostels]));

    return res.status(200).json({
      success: true,
      data: allHostels,
    });
  } catch (error) {
    console.error('Error fetching hostels:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch hostels',
    });
  }
};

/**
 * @desc    Get all addresses for authenticated student
 * @route   GET /api/addresses
 * @access  Private (Student)
 */
export const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new delivery address for student / atithi
 * @route   POST /api/addresses
 * @access  Private (Student)
 */
export const createAddress = async (req, res) => {
  try {
    const { label, fullAddress, landmark, city, state, postalCode, isDefault } = req.body;

    if (!fullAddress || !fullAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full address is required',
      });
    }

    const { location, error: locationError } = extractAndValidateLocation(req.body, true);
    if (locationError || !location) {
      return res.status(400).json({
        success: false,
        message: locationError || 'Please pin your exact location on the map before saving the address.',
      });
    }

    const { hostelName, roomNumber } = sanitizeHostelFields(req.body, req.user?.customerType);

    // If setting as default, clear default status from other user addresses
    if (isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    // Check if this is the user's first address; if so, make default automatically
    const count = await Address.countDocuments({ user: req.user._id });
    const makeDefault = count === 0 ? true : Boolean(isDefault);

    const userCustomerType = (req.user?.customerType || 'STUDENT').toUpperCase();
    const effectiveLabel = userCustomerType === 'ATITHI' ? 'HOME' : (label || 'HOSTEL');

    const address = await Address.create({
      user: req.user._id,
      label: effectiveLabel,
      hostelName,
      roomNumber,
      fullAddress: fullAddress.trim(),
      landmark: landmark ? landmark.trim() : '',
      city: city ? city.trim() : '',
      state: state ? state.trim() : '',
      postalCode: postalCode ? postalCode.trim() : '',
      isDefault: makeDefault,
      ...(location ? { location } : {}),
    });

    return res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: address,
    });
  } catch (error) {
    console.error('Error creating address:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create address',
      error: error.message,
    });
  }
};

/**
 * @desc    Update existing address
 * @route   PUT /api/addresses/:id
 * @access  Private (Student)
 */
export const updateAddress = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.user._id });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    const { label, fullAddress, landmark, city, state, postalCode, isDefault } = req.body;

    const { location, error: locationError } = extractAndValidateLocation(req.body, false);
    if (locationError) {
      return res.status(400).json({
        success: false,
        message: locationError,
      });
    }

    if (location) {
      address.location = location;
    } else if (!isValidCoordinatePair(address.location?.coordinates)) {
      return res.status(400).json({
        success: false,
        message: 'Please pin your exact location on the map before saving the address.',
      });
    }

    if (isDefault && !address.isDefault) {
      await Address.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const userCustomerType = (req.user?.customerType || 'STUDENT').toUpperCase();
    const effectiveLabel = userCustomerType === 'ATITHI' ? 'HOME' : (label || address.label);

    const { hostelName, roomNumber } = sanitizeHostelFields(req.body, userCustomerType);

    address.label = effectiveLabel;
    address.hostelName = hostelName;
    address.roomNumber = roomNumber;
    if (fullAddress) address.fullAddress = fullAddress.trim();
    if (landmark !== undefined) address.landmark = landmark.trim();
    if (city !== undefined) address.city = city.trim();
    if (state !== undefined) address.state = state.trim();
    if (postalCode !== undefined) address.postalCode = postalCode.trim();
    if (isDefault !== undefined) address.isDefault = Boolean(isDefault);
    if (location) address.location = location;

    await address.save();

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: address,
    });
  } catch (error) {
    console.error('Error updating address:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update address',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete an address
 * @route   DELETE /api/addresses/:id
 * @access  Private (Student)
 */
export const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message,
    });
  }
};
