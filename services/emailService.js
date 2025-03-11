const sgMail = require('@sendgrid/mail');
const ejs = require('ejs');
const path = require('path');
const supabase = require('./supabaseClient');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Send invitation email to friend
async function sendInvitationEmail(friendEmail, initiatorEmail, habitDescription, token) {
  const templatePath = path.join(__dirname, '../email_templates/invitation.ejs');
  
  // Use the PUBLIC_APP_URL for links in emails (this should be a publicly accessible URL)
  const publicUrl = process.env.PUBLIC_APP_URL || 'https://your-app-domain.com';
  const inviteUrl = `${publicUrl}/challenge/accept/${token}`;
  
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
  
  try {
    await sgMail.send(msg);
    console.log(`Invitation email sent to ${friendEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

// Send acceptance notification to the initiator
async function sendAcceptanceNotification(initiatorEmail, friendEmail, habitDescription) {
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
  
  try {
    await sgMail.send(msg);
    console.log(`Acceptance notification sent to ${initiatorEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending acceptance notification:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}

// Send daily check-in emails to both participants
async function sendDailyCheckIns() {
  // Get all active challenges with user information
  const { data: activeChallenges, error } = await supabase
    .from('challenges')
    .select(`
      *,
      initiator:initiator_id(id, email),
      friend:friend_id(id, email)
    `)
    .eq('status', 'active');
  
  if (error || !activeChallenges.length) {
    console.log('No active challenges found or error:', error);
    return;
  }
  
  const templatePath = path.join(__dirname, '../email_templates/daily-checkin.ejs');
  
  // Ensure we have a valid public URL for the links
  // This is critical for email links to work properly
  const publicUrl = process.env.PUBLIC_APP_URL;
  if (!publicUrl) {
    console.error('PUBLIC_APP_URL is not set in environment variables! Email links will not work correctly.');
  }
  
  // Use a fallback domain if PUBLIC_APP_URL is not set
  const baseUrl = publicUrl || 'https://your-app-domain.com';
  console.log(`Using base URL for email links: ${baseUrl}`);
  
  for (const challenge of activeChallenges) {
    const today = new Date().toISOString().split('T')[0];
    
    // Get streak history for both users
    const { data: streakHistories, error: streakError } = await supabase
      .from('streak_history')
      .select('*')
      .in('user_id', [challenge.initiator_id, challenge.friend_id])
      .eq('challenge_id', challenge.id);
    
    if (streakError) {
      console.error('Error fetching streak histories:', streakError);
      continue;
    }
    
    const initiatorStreakData = streakHistories.find(sh => sh.user_id === challenge.initiator_id);
    const friendStreakData = streakHistories.find(sh => sh.user_id === challenge.friend_id);
    
    // Generate visual streak calendar
    const initiatorStreakCalendar = generateStreakCalendar(initiatorStreakData?.history || []);
    const friendStreakCalendar = generateStreakCalendar(friendStreakData?.history || []);
    
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
        baseUrl // Pass the public URL to the template
      });
      
      await sgMail.send({
        to: challenge.initiator.email,
        from: process.env.EMAIL_FROM,
        subject: `Did you ${challenge.habit_description} today?`,
        html: initiatorHtml
      });
      
      console.log(`Daily check-in sent to ${challenge.initiator.email}`);
      
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
        baseUrl // Pass the public URL to the template
      });
      
      await sgMail.send({
        to: challenge.friend.email,
        from: process.env.EMAIL_FROM,
        subject: `Did you ${challenge.habit_description} today?`,
        html: friendHtml
      });
      
      console.log(`Daily check-in sent to ${challenge.friend.email}`);
    } catch (error) {
      console.error('Error sending daily check-in emails:', error);
      if (error.response) {
        console.error(error.response.body);
      }
    }
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
    console.error('Error fetching challenge:', error);
    return;
  }
  
  const isInitiator = userId === challenge.initiator_id;
  const user = isInitiator ? challenge.initiator : challenge.friend;
  const partner = isInitiator ? challenge.friend : challenge.initiator;
  const templatePath = path.join(__dirname, '../email_templates/streak-broken.ejs');
  
  try {
    // Notify both participants
    const userHtml = await ejs.renderFile(templatePath, {
      recipientEmail: user.email,
      partnerEmail: partner.email,
      habitDescription: challenge.habit_description,
      yourStreak: isInitiator ? challenge.initiator_streak : challenge.friend_streak,
      self: true
    });
    
    await sgMail.send({
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: `Your streak for ${challenge.habit_description} was broken`,
      html: userHtml
    });
    
    console.log(`Streak broken notification sent to ${user.email}`);
    
    const partnerHtml = await ejs.renderFile(templatePath, {
      recipientEmail: partner.email,
      partnerEmail: user.email,
      habitDescription: challenge.habit_description,
      partnerStreak: isInitiator ? challenge.initiator_streak : challenge.friend_streak,
      self: false
    });
    
    await sgMail.send({
      to: partner.email,
      from: process.env.EMAIL_FROM,
      subject: `${user.email}'s streak for ${challenge.habit_description} was broken`,
      html: partnerHtml
    });
    
    console.log(`Partner notification sent to ${partner.email}`);
  } catch (error) {
    console.error('Error sending streak broken notifications:', error);
    if (error.response) {
      console.error(error.response.body);
    }
  }
}

module.exports = {
  sendInvitationEmail,
  sendAcceptanceNotification,
  sendDailyCheckIns,
  sendStreakBrokenNotification
};