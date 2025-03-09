require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const debug = require('debug')('habits:app');

// Import supabase client
const supabase = require('./services/supabaseClient');

const challengeRoutes = require('./controllers/challengeController');
const { sendDailyCheckIns, sendTestEmail } = require('./services/emailService');

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
    debug('Checking Supabase connection...');
    debug(`URL: ${process.env.SUPABASE_URL}`);
    debug(`KEY: ${process.env.SUPABASE_KEY ? 'Key exists' : 'Key missing'}`);
    
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
      const recipient = process.env.TEST_RECIPIENT || 'test@example.com';
      debug(`Sending test email to ${recipient}`);
      
      const result = await sendTestEmail(recipient);
      
      if (result.success) {
        res.send(`Test email sent successfully to ${recipient}`);
      } else {
        res.status(500).send(`Error sending test email: ${result.message}<br>Details: ${result.details}`);
      }
    } catch (error) {
      debug('Test email error:', error);
      res.status(500).send('Error sending test email: ' + error.message);
    }
  });
  
  app.get('/env-check', (req, res) => {
    res.send(`
      <h1>Environment Check</h1>
      <p>NODE_ENV: ${process.env.NODE_ENV}</p>
      <p>PORT: ${process.env.PORT}</p>
      <p>APP_URL: ${process.env.APP_URL}</p>
      <p>PUBLIC_APP_URL: ${process.env.PUBLIC_APP_URL}</p>
      <p>SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'Set (begins with: ' + process.env.SENDGRID_API_KEY.substring(0, 5) + '...)' : 'Not set'}</p>
      <p>EMAIL_FROM: ${process.env.EMAIL_FROM}</p>
      <p>SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'Not set'}</p>
      <p>SUPABASE_KEY: ${process.env.SUPABASE_KEY ? 'Set (truncated for security)' : 'Not set'}</p>
    `);
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
