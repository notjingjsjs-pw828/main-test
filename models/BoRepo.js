const mongoose = require('mongoose');

const botRepoSchema = new mongoose.Schema({
  name: String,
  repoUrl: String,
  status: String
});

module.exports = mongoose.model('BotRepo', botRepoSchema);