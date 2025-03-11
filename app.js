require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');

// Import supabase client
const supabase = require('./services/supabaseClient');

const challengeRoutes = require('./controllers/challengeController');
const { sendDailyCheckIns } = require('./services/emailService');
const Dashboard = require('./models/Dashboard');
const { generateDashboardSVG } = require('./utils/dashboardGenerator');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Database connection check
(async () => {
  try {
    const { data, error } = await supabase.from('challenges').select('count');
    if (error) throw error;
    console.log('Connected to Supabase successfully');
  } catch (err) {
    console.error('Could not connect to Supabase:', err);
  }
})();

// Routes
app.get('/', async (req, res) => {
  try {
    // Get active streaks for the dashboard
    const activeStreaks = await Dashboard.getActiveStreaks();
    const topStreaks = await Dashboard.getTopStreaks();
    
    // Generate SVG dashboard visualization
    const dashboardSVG = generateDashboardSVG(activeStreaks);
    
    res.render('index', { 
      activeStreaks,
      topStreaks,
      dashboardSVG,
      hasStreaks: activeStreaks.length > 0 || topStreaks.length > 0
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.render('index', { 
      activeStreaks: [],
      topStreaks: [],
      dashboardSVG: '',
      hasStreaks: false,
      error: 'Could not load active challenges'
    });
  }
});

// Add a manual trigger route for sending check-in emails (admin use)
app.get('/admin/trigger-checkins', async (req, res) => {
  try {
    console.log('Manually triggering daily check-ins...');
    await sendDailyCheckIns();
    res.send('Daily check-ins triggered successfully');
  } catch (error) {
    console.error('Error sending check-ins:', error);
    res.status(500).send('Error sending check-ins: ' + error.message);
  }
});

app.use('/challenge', challengeRoutes);

// Schedule daily check-ins at 5am ET (which is 9am UTC if your server is on UTC time)
// Adjust the UTC hours based on your server's timezone and Daylight Saving Time if needed
const dailyCheckInJob = cron.schedule('0 9 * * *', async () => {
  const now = new Date();
  console.log(`Running scheduled daily check-ins at ${now.toISOString()}...`);
  try {
    await sendDailyCheckIns();
    console.log(`Successfully sent check-ins at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Failed to send daily check-ins:', error);
  }
}, {
  scheduled: true,
  timezone: "UTC" // Explicitly set timezone to UTC
});

// Make sure the cron job is started
dailyCheckInJob.start();
console.log('Daily check-in cron job is active and scheduled for 9:00 AM UTC');

// Optional: Send check-ins on startup if it's the right time of day
// This helps ensure emails are sent even if the server was down during the scheduled time
(async () => {
  const now = new Date();
  const hour = now.getUTCHours();
  
  // If it's between 9am and 10am UTC, send check-ins on startup
  if (hour >= 9 && hour < 10) {
    console.log('Current time is between 9-10am UTC, sending check-ins on startup...');
    try {
      await sendDailyCheckIns();
      console.log('Successfully sent check-ins on startup');
    } catch (error) {
      console.error('Failed to send check-ins on startup:', error);
    }
  } else {
    console.log(`Current UTC hour is ${hour}, not sending check-ins on startup`);
  }
})();

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
