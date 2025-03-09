const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const Challenge = require('../models/Challenge');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

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
    from: process.env.EMAIL_FROM,
    to: friendEmail,
    subject: `${initiatorEmail} challenged you to build a new habit!`,
    html
  };
  
  return transporter.sendMail(mailOptions);
}

// Send acceptance notification to the initiator
async function sendAcceptanceNotification(initiatorEmail, friendEmail, habitDescription) {
  const templatePath = path.join(__dirname, '../email_templates/acceptance.ejs');
  
  const html = await ejs.renderFile(templatePath, {
    friendEmail,
    habitDescription
  });
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: initiatorEmail,
    subject: `${friendEmail} accepted your habit challenge!`,
    html
  };
  
  return transporter.sendMail(mailOptions);
}

// Send daily check-in emails to both participants
async function sendDailyCheckIns() {
  const activeChallenges = await Challenge.find({ status: 'active' })
    .populate('initiator')
    .populate('friend');
  
  const templatePath = path.join(__dirname, '../email_templates/daily-checkin.ejs');
  
  for (const challenge of activeChallenges) {
    const today = new Date().toISOString().split('T')[0];
    
    // Generate visual streak calendar
    const initiatorStreakCalendar = generateStreakCalendar(challenge.streaks.initiator.history);
    const friendStreakCalendar = generateStreakCalendar(challenge.streaks.friend.history);
    
    // Send email to initiator
    const initiatorHtml = await ejs.renderFile(templatePath, {
      recipientEmail: challenge.initiator.email,
      partnerEmail: challenge.friend.email,
      habitDescription: challenge.habitDescription,
      yourStreak: challenge.streaks.initiator.count,
      partnerStreak: challenge.streaks.friend.count,
      yourStreakCalendar: initiatorStreakCalendar,
      partnerStreakCalendar: friendStreakCalendar,
      challengeId: challenge._id,
      userId: challenge.initiator._id,
      date: today
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: challenge.initiator.email,
      subject: `Did you ${challenge.habitDescription} today?`,
      html: initiatorHtml
    });
    
    // Send email to friend
    const friendHtml = await ejs.renderFile(templatePath, {
      recipientEmail: challenge.friend.email,
      partnerEmail: challenge.initiator.email,
      habitDescription: challenge.habitDescription,
      yourStreak: challenge.streaks.friend.count,
      partnerStreak: challenge.streaks.initiator.count,
      yourStreakCalendar: friendStreakCalendar,
      partnerStreakCalendar: initiatorStreakCalendar,
      challengeId: challenge._id,
      userId: challenge.friend._id,
      date: today
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: challenge.friend.email,
      subject: `Did you ${challenge.habitDescription} today?`,
      html: friendHtml
    });
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
async function sendStreakBrokenNotification(challenge, userType) {
  const templatePath = path.join(__dirname, '../email_templates/streak-broken.ejs');
  
  const isInitiator = userType === 'initiator';
  const user = isInitiator ? challenge.initiator : challenge.friend;
  const partner = isInitiator ? challenge.friend : challenge.initiator;
  
  // Notify both participants
  const userHtml = await ejs.renderFile(templatePath, {
    recipientEmail: user.email,
    partnerEmail: partner.email,
    habitDescription: challenge.habitDescription,
    yourStreak: isInitiator ? challenge.streaks.initiator.count : challenge.streaks.friend.count,
    self: true
  });
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `Your streak for ${challenge.habitDescription} was broken`,
    html: userHtml
  });
  
  const partnerHtml = await ejs.renderFile(templatePath, {
    recipientEmail: partner.email,
    partnerEmail: user.email,
    habitDescription: challenge.habitDescription,
    partnerStreak: isInitiator ? challenge.streaks.initiator.count : challenge.streaks.friend.count,
    self: false
  });
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: partner.email,
    subject: `${user.email}'s streak for ${challenge.habitDescription} was broken`,
    html: partnerHtml
  });
}

module.exports = {
  sendInvitationEmail,
  sendAcceptanceNotification,
  sendDailyCheckIns,
  sendStreakBrokenNotification
};