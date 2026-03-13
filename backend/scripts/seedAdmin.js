#!/usr/bin/env node
/**
 * Seed admin user - creates the first admin account using environment variables.
 * Run: node scripts/seedAdmin.js
 */
require('dotenv').config();
const userRepository = require('../repositories/postgres/UserRepository');

async function seedAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
      console.log('Please set them in your .env file.');
      process.exit(1);
    }

    const exists = await userRepository.emailExists(email);
    if (exists) {
      console.log(`Admin user already exists: ${email}`);
      console.log('To reset password, update the user via the API or database.');
      process.exit(0);
      return;
    }

    const user = await userRepository.create({
      firstName: process.env.ADMIN_FIRST_NAME || 'Admin',
      lastName: process.env.ADMIN_LAST_NAME || 'User',
      email: email,
      password: password,
      role: 'admin',
      status: 'active',
    });

    console.log('✅ Admin user created successfully!');
    console.log('  Email:', user.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

seedAdmin();
