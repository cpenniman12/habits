const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    trim: true
  },
  activeChallenges: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);