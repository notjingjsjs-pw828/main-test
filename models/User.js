const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  phone: String,
  email: String,
  password: String,
  coins: { type: Number, default: 0 },
  lastCoinAdd: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
