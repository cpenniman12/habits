const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const supabase = require('./supabaseClient');

// Create test account for development
async function createTestAccount() {
  const testAccount = await nodemailer.createTestAccount();
  
  // Create a testing transporter using Ethereal
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

// Configure nodemailer
let transporter;
(async function() {
  // For development, use Ethereal (fake emails with preview)
  if (process.env.NODE_ENV !== 'production') {
    transporter = await createTestAccount();
    console.log('Using Ethereal test account for email testing');
  } else {
    // For production, use real email service
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
})();

// Send invitation email to friend
async function sendInvitationEmail(friendEmail, initiatorEmail, habitDescription, token) {
  const templatePath = path.join(__dirname, '../email_templates/invitation.ejs');
  const inviteUrl = `${process.env.APP_URL}/challenge/accept/${token}`;
  
  const html = await ejs.renderFile(templatePath, {
    initiatorEmail,
    habitDescription,
    inviteUrl
  });
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'habits@example.com',
    to: friendEmail,
    subject: `${initiatorEmail} challenged you to build a new habit!`,
    html
  };
  
  // Ensure transporter is initialized
  if (!transporter) {
    transporter = await createTestAccount();
  }
  
  const info = await transporter.sendMail(mailOptions);
  
  // Log preview URL for development environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
  
  return info;
}

// Send acceptance notification to the initiator
async function sendAcceptanceNotification(initiatorEmail, friendEmail, habitDescription) {
  const templatePath = path.join(__dirname, '../email_templates/acceptance.ejs');
  
  const html = await ejs.renderFile(templatePath, {
    friendEmail,
    habitDescription
  });
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'habits@example.com',
    to: initiatorEmail,
    subject: `${friendEmail} accepted your habit challenge!`,
    html
  };
  
  // Ensure transporter is initialized
  if (!transporter) {
    transporter = await createTestAccount();
  }
  
  const info = await transporter.sendMail(mailOptions);
  
  // Log preview URL for development environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
  
  return info;
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
  
  // Ensure transporter is initialized
  if (!transporter) {
    transporter = await createTestAccount();
  }
  
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
      date: today
    });
    
    const initiatorInfo = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'habits@example.com',
      to: challenge.initiator.email,
      subject: `Did you ${challenge.habit_description} today?`,
      html: initiatorHtml
    });
    
    // Log preview URL for development environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(initiatorInfo));
    }
    
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
      date: today
    });
    
    const friendInfo = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'habits@example.com',
      to: challenge.friend.email,
      subject: `Did you ${challenge.habit_description} today?`,
      html: friendHtml
    });
    
    // Log preview URL for development environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(friendInfo));
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
  
  // Ensure transporter is initialized
  if (!transporter) {
    transporter = await createTestAccount();
  }
  
  // Notify both participants
  const userHtml = await ejs.renderFile(templatePath, {
    recipientEmail: user.email,
    partnerEmail: partner.email,
    habitDescription: challenge.habit_description,
    yourStreak: isInitiator ? challenge.initiator_streak : challenge.friend_streak,
    self: true
  });
  
  const userInfo = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'habits@example.com',
    to: user.email,
    subject: `Your streak for ${challenge.habit_description} was broken`,
    html: userHtml
  });
  
  // Log preview URL for development environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(userInfo));
  }
  
  const partnerHtml = await ejs.renderFile(templatePath, {
    recipientEmail: partner.email,
    partnerEmail: user.email,
    habitDescription: challenge.habit_description,
    partnerStreak: isInitiator ? challenge.initiator_streak : challenge.friend_streak,
    self: false
  });
  
  const partnerInfo = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'habits@example.com',
    to: partner.email,
    subject: `${user.email}'s streak for ${challenge.habit_description} was broken`,
    html: partnerHtml
  });
  
  // Log preview URL for development environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('Email Preview URL: %s', nodemailer.getTestMessageUrl(partnerInfo));
  }
}

module.exports = {
  sendInvitationEmail,
  sendAcceptanceNotification,
  sendDailyCheckIns,
  sendStreakBrokenNotification
};