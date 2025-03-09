const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  habitDescription: {
    type: String,
    required: true,
    trim: true
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  friend: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'abandoned'],
    default: 'pending'
  },
  inviteToken: {
    type: String,
    required: true,
    unique: true
  },
  startDate: {
    type: Date
  },
  streaks: {
    initiator: {
      count: {
        type: Number,
        default: 0
      },
      history: [String] // Array of dates (YYYY-MM-DD)
    },
    friend: {
      count: {
        type: Number,
        default: 0
      },
      history: [String] // Array of dates (YYYY-MM-DD)
    }
  },
  lastCheckinDate: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Challenge', challengeSchema);