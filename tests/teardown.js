/**
 * Global teardown file for Jest tests
 * This ensures all connections are properly closed
 */

const mongoose = require('mongoose');

module.exports = async () => {
  // Ensure mongoose is disconnected
  await mongoose.disconnect();
  
  // Allow time for any pending timers
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Force exit to clean up any hanging connections
  process.exit(0);
}; 