import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function seedAdmin() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuscart');
  console.log('Connected to DB');

  let admin = await User.findOne({ email: 'admin@campuscart.com' });
  if (!admin) {
    admin = await User.create({
      name: 'Test Admin',
      email: 'admin@campuscart.com',
      phone: '0000000001',
      password: 'Password123!',
      role: 'ADMIN',
      accountStatus: 'APPROVED',
      isActive: true,
      isVerified: true,
    });
    console.log('Created admin@campuscart.com');
  } else {
    admin.password = 'Password123!';
    admin.isActive = true;
    admin.accountStatus = 'APPROVED';
    admin.role = 'ADMIN';
    await admin.save();
    console.log('Reset admin@campuscart.com password');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seedAdmin();
