const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const { sendInvitationEmail, sendAcceptanceNotification } = require('../services/emailService');
const { generateToken } = require('../utils/tokenGenerator');

// Create a new challenge
router.post('/create', async (req, res) => {
  try {
    const { initiatorEmail, friendEmail, habitDescription } = req.body;
    
    // Find or create users
    let initiator = await User.findOne({ email: initiatorEmail });
    if (!initiator) {
      initiator = new User({ email: initiatorEmail });
      await initiator.save();
    }
    
    let friend = await User.findOne({ email: friendEmail });
    if (!friend) {
      friend = new User({ email: friendEmail });
      await friend.save();
    }
    
    // Create the challenge
    const inviteToken = generateToken();
    const challenge = new Challenge({
      habitDescription,
      initiator: initiator._id,
      friend: friend._id,
      inviteToken,
      status: 'pending'
    });
    
    await challenge.save();
    
    // Send invitation email
    await sendInvitationEmail(friendEmail, initiatorEmail, habitDescription, inviteToken);
    
    res.status(201).render('challenge-created', { 
      friendEmail,
      habitDescription 
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).render('error', { message: 'Failed to create challenge' });
  }
});

// Accept a challenge
router.get('/accept/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const challenge = await Challenge.findOne({ inviteToken: token })
      .populate('initiator')
      .populate('friend');
    
    if (!challenge) {
      return res.status(404).render('error', { message: 'Challenge not found' });
    }
    
    if (challenge.status !== 'pending') {
      return res.status(400).render('error', { message: 'Challenge already processed' });
    }
    
    // Update challenge status
    challenge.status = 'active';
    challenge.startDate = new Date();
    challenge.streaks = {
      initiator: { count: 0, history: [] },
      friend: { count: 0, history: [] }
    };
    
    await challenge.save();
    
    // Send acceptance notification to initiator
    await sendAcceptanceNotification(
      challenge.initiator.email,
      challenge.friend.email,
      challenge.habitDescription
    );
    
    res.render('challenge-accepted', { 
      initiatorEmail: challenge.initiator.email,
      habitDescription: challenge.habitDescription 
    });
  } catch (error) {
    console.error('Error accepting challenge:', error);
    res.status(500).render('error', { message: 'Failed to accept challenge' });
  }
});

// Record daily check-in
router.get('/checkin/:challengeId/:userId/:completed', async (req, res) => {
  try {
    const { challengeId, userId, completed } = req.params;
    const isCompleted = completed === 'yes';
    
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).render('error', { message: 'Challenge not found' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const isInitiator = userId.toString() === challenge.initiator.toString();
    
    // Update streak information
    const userType = isInitiator ? 'initiator' : 'friend';
    const streakField = `streaks.${userType}`;
    
    if (isCompleted) {
      // Add today to history if completed
      await Challenge.updateOne(
        { _id: challengeId },
        { 
          $push: { [`${streakField}.history`]: today },
          $inc: { [`${streakField}.count`]: 1 }
        }
      );
      
      res.render('checkin-success');
    } else {
      // Reset streak count if failed
      await Challenge.updateOne(
        { _id: challengeId },
        { [`${streakField}.count`]: 0 }
      );
      
      res.render('checkin-failed');
    }
  } catch (error) {
    console.error('Error recording check-in:', error);
    res.status(500).render('error', { message: 'Failed to record check-in' });
  }
});

module.exports = router;