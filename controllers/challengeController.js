const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');
const { sendInvitationEmail, sendAcceptanceNotification } = require('../services/emailService');

// Create a new challenge
router.post('/create', async (req, res) => {
  try {
    const { initiatorEmail, friendEmail, habitDescription } = req.body;
    
    // Validate that initiator and friend are different emails
    if (initiatorEmail.toLowerCase() === friendEmail.toLowerCase()) {
      return res.status(400).render('error', { message: 'You cannot challenge yourself. Please enter a different email for your friend.' });
    }
    
    // Check or create users
    let initiator = await getUserByEmail(initiatorEmail);
    if (!initiator) {
      initiator = await createUser(initiatorEmail);
    }
    
    let friend = await getUserByEmail(friendEmail);
    if (!friend) {
      friend = await createUser(friendEmail);
    }
    
    // Create the challenge
    const inviteToken = uuidv4();
    const challenge = {
      habit_description: habitDescription,
      initiator_id: initiator.id,
      friend_id: friend.id,
      invite_token: inviteToken,
      status: 'pending',
      created_at: new Date()
    };
    
    const { data, error } = await supabase
      .from('challenges')
      .insert(challenge)
      .select()
      .single();
      
    if (error) throw error;
    
    // Send invitation email ONLY to the friend
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
    
    // Get challenge by token
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select(`
        *,
        initiator:initiator_id(id, email),
        friend:friend_id(id, email)
      `)
      .eq('invite_token', token)
      .single();
    
    if (error || !challenge) {
      return res.status(404).render('error', { message: 'Challenge not found' });
    }
    
    if (challenge.status !== 'pending') {
      return res.status(400).render('error', { message: 'Challenge already processed' });
    }
    
    // Update challenge status
    const startDate = new Date();
    const { error: updateError } = await supabase
      .from('challenges')
      .update({ 
        status: 'active',
        start_date: startDate.toISOString(),
        initiator_streak: 0,
        friend_streak: 0
      })
      .eq('id', challenge.id);
    
    if (updateError) throw updateError;
    
    // Initialize streak history in separate tables (for backward compatibility)
    await supabase.from('streak_history').insert([
      {
        challenge_id: challenge.id,
        user_id: challenge.initiator_id,
        streak_count: 0,
        history: []
      },
      {
        challenge_id: challenge.id,
        user_id: challenge.friend_id,
        streak_count: 0,
        history: []
      }
    ]);
    
    // Send acceptance notification to initiator
    await sendAcceptanceNotification(
      challenge.initiator.email,
      challenge.friend.email,
      challenge.habit_description
    );
    
    res.render('challenge-accepted', { 
      initiatorEmail: challenge.initiator.email,
      habitDescription: challenge.habit_description 
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
    
    // Get challenge
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();
    
    if (error || !challenge) {
      return res.status(404).render('error', { message: 'Challenge not found' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const isInitiator = userId === challenge.initiator_id;
    const userType = isInitiator ? 'initiator' : 'friend';
    
    // For backward compatibility - get current streak history
    const { data: streakData, error: streakError } = await supabase
      .from('streak_history')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();
      
    if (streakError) throw streakError;
    
    if (isCompleted) {
      // Insert record in the habit_completions table
      const { error: completionError } = await supabase
        .from('habit_completions')
        .insert({
          challenge_id: challengeId,
          user_id: userId,
          completion_date: today
        });
      
      if (completionError) {
        // If error is due to duplicate, it's okay - the user already completed this today
        if (!completionError.message.includes('duplicate')) {
          throw completionError;
        }
      }
      
      // For backward compatibility - also update streak history
      const newHistory = [...(streakData.history || []), today];
      const newStreak = streakData.streak_count + 1;
      
      await supabase
        .from('streak_history')
        .update({
          streak_count: newStreak,
          history: newHistory
        })
        .eq('id', streakData.id);
      
      // Also update the streak counter in the main challenges table
      const updateField = isInitiator ? 'initiator_streak' : 'friend_streak';
      await supabase
        .from('challenges')
        .update({ [updateField]: newStreak })
        .eq('id', challengeId);
      
      res.render('checkin-success');
    } else {
      // Reset streak count if failed
      await supabase
        .from('streak_history')
        .update({ streak_count: 0 })
        .eq('id', streakData.id);
      
      // Also update the streak counter in the main challenges table
      const updateField = isInitiator ? 'initiator_streak' : 'friend_streak';
      await supabase
        .from('challenges')
        .update({ [updateField]: 0 })
        .eq('id', challengeId);
      
      res.render('checkin-failed');
    }
  } catch (error) {
    console.error('Error recording check-in:', error);
    res.status(500).render('error', { message: 'Failed to record check-in' });
  }
});

// Helper functions to work with users
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error) return null;
  return data;
}

async function createUser(email) {
  const { data, error } = await supabase
    .from('users')
    .insert({ email })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

module.exports = router;