#!/usr/bin/env node
/**
 * Data seed / reset: deletes all products and dependent rows so you can re-import cleanly.
 * Run: npm run seed:data
 */
require('dotenv').config();
const productRepository = require('../repositories/postgres/ProductRepository');

async function main() {
  try {
    const removed = await productRepository.deleteAllPermanently();
    console.log(`✅ Deleted all products (${removed} product row(s) removed).`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
