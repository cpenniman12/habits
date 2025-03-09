const sgMail = require('@sendgrid/mail');
const ejs = require('ejs');
const path = require('path');
const supabase = require('./supabaseClient');
const debug = require('debug')('habits:email');

// Configure SendGrid with error handling
try {
  const apiKey = process.env.SENDGRID_API_KEY;
  debug(`API key ${apiKey ? 'exists' : 'is missing'}`);
  if (apiKey) {
    debug(`First few characters: ${apiKey.substring(0, 5)}...`);
  }
  
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  debug('SendGrid initialized successfully');
} catch (error) {
  debug('Error initializing SendGrid:', error);
}

// Send invitation email to friend
async function sendInvitationEmail(friendEmail, initiatorEmail, habitDescription, token) {
  try {
    const templatePath = path.join(__dirname, '../email_templates/invitation.ejs');
    
    // Use the PUBLIC_APP_URL for links in emails (this should be a publicly accessible URL)
    const inviteUrl = `${process.env.PUBLIC_APP_URL || process.env.APP_URL}/challenge/accept/${token}`;
    
    debug(`Generating email with invitation URL: ${inviteUrl}`);
    
    const html = await ejs.renderFile(templatePath, {
      initiatorEmail,
      habitDescription,
      inviteUrl
    });
    
    const msg = {
      to: friendEmail,
      from: process.env.EMAIL_FROM,
      subject: `${initiatorEmail} challenged you to build a new habit!`,
      html
    };
    
    // In development mode, log the email instead of sending if flag is set
    if (process.env.NODE_ENV === 'development' && process.env.LOG_EMAILS === 'true') {
      debug('Email would be sent to:', friendEmail);
      debug('Email subject:', msg.subject);
      debug('Email content not shown due to size');
      return true;
    }
    
    await sgMail.send(msg);
    debug(`Invitation email sent to ${friendEmail}`);
    return true;
  } catch (error) {
    debug('Error sending invitation email:', error);
    if (error.response) {
      debug(error.response.body);
    }
    throw error;
  }
}

// Send acceptance notification to the initiator
async function sendAcceptanceNotification(initiatorEmail, friendEmail, habitDescription) {
  try {
    const templatePath = path.join(__dirname, '../email_templates/acceptance.ejs');
    
    const html = await ejs.renderFile(templatePath, {
      friendEmail,
      habitDescription
    });
    
    const msg = {
      to: initiatorEmail,
      from: process.env.EMAIL_FROM,
      subject: `${friendEmail} accepted your habit challenge!`,
      html
    };
    
    // In development mode, log the email instead of sending if flag is set
    if (process.env.NODE_ENV === 'development' && process.env.LOG_EMAILS === 'true') {
      debug('Email would be sent to:', initiatorEmail);
      debug('Email subject:', msg.subject);
      return true;
    }
    
    await sgMail.send(msg);
    debug(`Acceptance notification sent to ${initiatorEmail}`);
    return true;
  } catch (error) {
    debug('Error sending acceptance notification:', error);
    if (error.response) {
      debug(error.response.body);
    }
    throw error;
  }
}

// Send daily check-in emails to both participants
async function sendDailyCheckIns() {
  try {
    // Get all active challenges with user information
    const { data: activeChallenges, error } = await supabase
      .from('challenges')
      .select(`
        *,
        initiator:initiator_id(id, email),
        friend:friend_id(id, email)
      `)
      .eq('status', 'active');
    
    if (error) {
      debug('Error fetching active challenges:', error);
      return;
    }
    
    if (!activeChallenges.length) {
      debug('No active challenges found');
      return;
    }
    
    debug(`Found ${activeChallenges.length} active challenges`);
    
    const templatePath = path.join(__dirname, '../email_templates/daily-checkin.ejs');
    
    for (const challenge of activeChallenges) {
      const today = new Date().toISOString().split('T')[0];
      
      // Get streak history for both users
      const { data: streakHistories, error: streakError } = await supabase
        .from('streak_history')
        .select('*')
        .in('user_id', [challenge.initiator_id, challenge.friend_id])
        .eq('challenge_id', challenge.id);
      
      if (streakError) {
        debug('Error fetching streak histories:', streakError);
        continue;
      }
      
      const initiatorStreakData = streakHistories.find(sh => sh.user_id === challenge.initiator_id);
      const friendStreakData = streakHistories.find(sh => sh.user_id === challenge.friend_id);
      
      // Generate visual streak calendar
      const initiatorStreakCalendar = generateStreakCalendar(initiatorStreakData?.history || []);
      const friendStreakCalendar = generateStreakCalendar(friendStreakData?.history || []);
      
      // Use public URL for links in emails
      const baseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL;
      
      try {
        // Send email to initiator
        const initiatorHtml = await ejs.renderFile(templatePath, {
          recipientEmail: challenge.initiator.email,
          partnerEmail: challenge.friend.email,
          habitDescription: challenge.habit_description,
          yourStreak: challenge.initiator_streak || 0,
          partnerStreak: challenge.friend_streak || 0,
          yourStreakCalendar: initiatorStreakCalendar,
          partnerStreakCalendar: friendStreakCalendar,
          challengeId: challenge.id,
          userId: challenge.initiator_id,
          date: today,
          baseUrl
        });
        
        // In development mode, log the email instead of sending if flag is set
        if (process.env.NODE_ENV === 'development' && process.env.LOG_EMAILS === 'true') {
          debug(`Daily check-in would be sent to ${challenge.initiator.email}`);
          continue;
        }
        
        await sgMail.send({
          to: challenge.initiator.email,
          from: process.env.EMAIL_FROM,
          subject: `Did you ${challenge.habit_description} today?`,
          html: initiatorHtml
        });
        
        debug(`Daily check-in sent to ${challenge.initiator.email}`);
        
        // Send email to friend
        const friendHtml = await ejs.renderFile(templatePath, {
          recipientEmail: challenge.friend.email,
          partnerEmail: challenge.initiator.email,
          habitDescription: challenge.habit_description,
          yourStreak: challenge.friend_streak || 0,
          partnerStreak: challenge.initiator_streak || 0,
          yourStreakCalendar: friendStreakCalendar,
          partnerStreakCalendar: initiatorStreakCalendar,
          challengeId: challenge.id,
          userId: challenge.friend_id,
          date: today,
          baseUrl
        });
        
        // In development mode, log the email instead of sending if flag is set
        if (process.env.NODE_ENV === 'development' && process.env.LOG_EMAILS === 'true') {
          debug(`Daily check-in would be sent to ${challenge.friend.email}`);
          continue;
        }
        
        await sgMail.send({
          to: challenge.friend.email,
          from: process.env.EMAIL_FROM,
          subject: `Did you ${challenge.habit_description} today?`,
          html: friendHtml
        });
        
        debug(`Daily check-in sent to ${challenge.friend.email}`);
      } catch (error) {
        debug('Error sending daily check-in emails:', error);
        if (error.response) {
          debug(error.response.body);
        }
      }
    }
  } catch (error) {
    debug('Error in sendDailyCheckIns:', error);
  }
}

// Generate a visual representation of streak history
function generateStreakCalendar(historyDates) {
  // This is a simple implementation - you can make it more sophisticated
  const lastSevenDays = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    const completed = historyDates.includes(dateString);
    
    lastSevenDays.push({
      date: dateString,
      completed
    });
  }
  
  return lastSevenDays;
}

// Send notification when streak is broken
async function sendStreakBrokenNotification(challengeId, userId) {
  try {
    // Get challenge with user information
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select(`
        *,
        initiator:initiator_id(id, email),
        friend:friend_id(id, email)
      `)
      .eq('id', challengeId)
      .single();
    
    if (error) {
      debug('Error fetching challenge:', error);
      return;
    }
    
    const isInitiator = userId === challenge.initiator_id;
    const user = isInitiator ? challenge.initiator : challenge.friend;
    const partner = isInitiator ? challenge.friend : challenge.initiator;
    const templatePath = path.join(__dirname, '../email_templates/streak-broken.ejs');
    
    // Notify both participants
    const userHtml = await ejs.renderFile(templatePath, {
      recipientEmail: user.email,
      partnerEmail: partner.email,
      habitDescription: challenge.habit_description,
      yourStreak: isInitiator ? challenge.initiator_streak : challenge.friend_streak,
      self: true
    });
    
    // In development mode, log the email instead of sending if flag is set
    if (process.env.NODE_ENV === 'development' && process.env.LOG_EMAILS === 'true') {
      debug(`Streak broken notification would be sent to ${user.email}`);
    } else {
      await sgMail.send({
        to: user.email,
        from: process.env.EMAIL_FROM,
        subject: `Your streak for ${challenge.habit_description} was broken`,
        html: userHtml
      });
      
      debug(`Streak broken notification sent to ${user.email}`);
    }
    
    const partnerHtml = await ejs.renderFile(templatePath, {
      recipientEmail: partner.email,
      partnerEmail: user.email,
      habitDescription: challenge.habit_description,
      partnerStreak: isInitiator ? challenge.initiator_streak : challenge.friend_streak,
      self: false
    });
    
    // In development mode, log the email instead of sending if flag is set
    if (process.env.NODE_ENV === 'development' && process.env.LOG_EMAILS === 'true') {
      debug(`Partner notification would be sent to ${partner.email}`);
    } else {
      await sgMail.send({
        to: partner.email,
        from: process.env.EMAIL_FROM,
        subject: `${user.email}'s streak for ${challenge.habit_description} was broken`,
        html: partnerHtml
      });
      
      debug(`Partner notification sent to ${partner.email}`);
    }
  } catch (error) {
    debug('Error sending streak broken notifications:', error);
    if (error.response) {
      debug(error.response.body);
    }
  }
}

// For development/testing: allows sending a simple test email
async function sendTestEmail(to, from = process.env.EMAIL_FROM) {
  try {
    debug('Attempting to send test email');
    debug(`To: ${to}`);
    debug(`From: ${from}`);
    debug(`Using API key: ${process.env.SENDGRID_API_KEY ? 'Yes (set)' : 'No (not set)'}`);
    
    const msg = {
      to,
      from,
      subject: 'Test Email from Habits App',
      text: 'If you received this, email sending is working correctly.',
      html: '<strong>If you received this, email sending is working correctly.</strong>'
    };
    
    await sgMail.send(msg);
    debug('Test email sent successfully');
    return { success: true, message: 'Test email sent successfully' };
  } catch (error) {
    debug('Error sending test email:', error);
    if (error.response) {
      debug(error.response.body);
    }
    return { 
      success: false, 
      message: 'Failed to send test email', 
      error: error.message,
      details: error.response?.body || '' 
    };
  }
}

module.exports = {
  sendInvitationEmail,
  sendAcceptanceNotification,
  sendDailyCheckIns,
  sendStreakBrokenNotification,
  sendTestEmail // Added for testing
};