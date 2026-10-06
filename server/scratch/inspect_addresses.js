import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../server/.env') });

import Address from '../../server/models/Address.js';
import { isValidCoordinatePair } from '../../server/utils/distanceCalculator.js';

async function inspectExistingAddresses() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const allAddresses = await Address.find({});
  const total = allAddresses.length;
  let validCount = 0;
  let missingCount = 0;
  let invalidCount = 0;

  for (const addr of allAddresses) {
    if (!addr.location || !Array.isArray(addr.location.coordinates) || addr.location.coordinates.length < 2) {
      missingCount++;
    } else {
      if (isValidCoordinatePair(addr.location.coordinates)) {
        validCount++;
      } else {
        invalidCount++;
      }
    }
  }

  console.log(`--- EXISTING ADDRESSES INSPECTION REPORT ---`);
  console.log(`Total Addresses: ${total}`);
  console.log(`Valid Coordinates: ${validCount}`);
  console.log(`Missing Coordinates: ${missingCount}`);
  console.log(`Invalid Coordinates: ${invalidCount}`);

  process.exit(0);
}

inspectExistingAddresses();
