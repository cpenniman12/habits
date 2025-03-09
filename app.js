require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');

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

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.use('/challenge', challengeRoutes);

// Schedule daily check-ins at 9pm
cron.schedule('0 21 * * *', async () => {
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