// Load required packages
const mongoose = require('mongoose');

// Define our user schema
/* name, email are required
 *
 */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    pendingTasks: { type: [String], default: [] },
    dateCreated: { type: Date, default: Date.now }
  }
);

// Export the Mongoose model
module.exports = mongoose.model("User", UserSchema);
