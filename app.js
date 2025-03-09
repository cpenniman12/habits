require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const debug = require('debug')('habits:app');

// Import supabase client
const supabase = require('./services/supabaseClient');

const challengeRoutes = require('./controllers/challengeController');
const { sendDailyCheckIns } = require('./services/emailService');

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
    debug('Connected to Supabase successfully');
  } catch (err) {
    debug('Could not connect to Supabase:', err);
  }
})();

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.use('/challenge', challengeRoutes);

// Environment check
const isDev = process.env.NODE_ENV === 'development';

// Schedule daily check-ins at 9pm
// In development, only run if explicitly enabled
if (!isDev || (isDev && process.env.ENABLE_CRON === 'true')) {
  debug('Scheduling daily check-ins at 9pm');
  cron.schedule('0 21 * * *', async () => {
    debug('Sending daily check-ins...');
    await sendDailyCheckIns();
  });
} else {
  debug('Scheduled tasks are disabled in development mode');
}

// Test endpoint for development
if (isDev) {
  debug('Adding development test endpoints');
  app.get('/test-email', async (req, res) => {
    try {
      debug('Test email endpoint called');
      // Import the email service
      const { sendInvitationEmail } = require('./services/emailService');
      
      // Send a test email
      await sendInvitationEmail(
        process.env.TEST_RECIPIENT || 'your-test-email@example.com', 
        'test-initiator@example.com',
        'Test habit description',
        'test-token-123'
      );
      
      res.send('Test email sent successfully. Check your logs.');
    } catch (error) {
      debug('Test email error:', error);
      res.status(500).send('Error sending test email: ' + error.message);
    }
  });
}

// Error handler
app.use((err, req, res, next) => {
  debug(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  debug(`Server running on port ${PORT} in ${isDev ? 'development' : 'production'} mode`);
  debug(`App URL: ${process.env.APP_URL}`);
  debug(`Public App URL: ${process.env.PUBLIC_APP_URL || process.env.APP_URL}`);
});
