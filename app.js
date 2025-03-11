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

app.use('/challenge', challengeRoutes);

// Schedule daily check-ins at 5am ET (which is 9am UTC if your server is on UTC time)
// Adjust the UTC hours based on your server's timezone and Daylight Saving Time if needed
cron.schedule('0 9 * * *', async () => {
  console.log('Sending daily check-ins...');
  await sendDailyCheckIns();
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
