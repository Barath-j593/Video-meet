/**
 * Seed script to create demo users
 * Run with: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define schema directly to avoid any import issues
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, enum: ['admin', 'teacher', 'student'], default: 'student' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

const demoUsers = [
  {
    name: 'Admin User',
    email: 'admin@videomeet.com',
    password: 'Admin@123',
    role: 'admin',
  },
  {
    name: 'Teacher User',
    email: 'teacher@videomeet.com',
    password: 'Teacher@123',
    role: 'teacher',
  },
  {
    name: 'Student User',
    email: 'student@videomeet.com',
    password: 'Student@123',
    role: 'student',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    for (const userData of demoUsers) {
      // Check if user exists
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`⏭️  User ${userData.email} already exists`);
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user
      const user = new User({
        ...userData,
        password: hashedPassword,
      });
      await user.save();
      console.log(`✅ Created ${userData.role}: ${userData.email}`);
    }

    console.log('\n🎉 Demo users ready!\n');
    console.log('┌─────────────┬──────────────────────────┬──────────────┐');
    console.log('│ Role        │ Email                    │ Password     │');
    console.log('├─────────────┼──────────────────────────┼──────────────┤');
    console.log('│ Admin       │ admin@videomeet.com      │ Admin@123    │');
    console.log('│ Teacher     │ teacher@videomeet.com    │ Teacher@123  │');
    console.log('│ Student     │ student@videomeet.com    │ Student@123  │');
    console.log('└─────────────┴──────────────────────────┴──────────────┘');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
