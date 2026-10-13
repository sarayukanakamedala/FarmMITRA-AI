require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const farmerRoutes = require('./routes/farmerRoutes');
const queryRoutes = require('./routes/queryRoutes');
const diseaseRoutes = require('./routes/diseaseRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const notifyRoutes = require('./routes/notifyRoutes');
const marketRoutes = require('./routes/marketRoutes');

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get('/', (req, res) => {
  res.json({ status: 'FarmMitra AI backend running' });
});

// Diagnostic: shows which services are configured. Open http://localhost:5000/api/health
app.get('/api/health', async (req, res) => {
  const has = (k) => Boolean(process.env[k] && process.env[k].trim());
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const diseaseUrl = (process.env.DISEASE_SERVICE_URL || 'http://localhost:8000/predict').replace(/\/predict\/?$/, '/health');

  let diseaseService = 'not running (demo results will be used)';
  try {
    const r = await axios.get(diseaseUrl, { timeout: 2000 });
    diseaseService = r.data && r.data.mode === 'mock' ? 'running, model not trained yet (mock mode)' : 'running, model loaded';
  } catch (e) {
    /* leave default */
  }

  res.json({
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    keys: {
      SARVAM_API_KEY: has('SARVAM_API_KEY'),
      OPENAI_API_KEY: has('OPENAI_API_KEY'),
      AGMARKNET_API_KEY: has('AGMARKNET_API_KEY'),
      OPENWEATHER_API_KEY: has('OPENWEATHER_API_KEY'),
      RESEND_API_KEY: has('RESEND_API_KEY'),
    },
    diseaseService,
  });
});

app.use('/api/farmers', farmerRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/disease', diseaseRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notify', notifyRoutes);
app.use('/api/market', marketRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`FarmMitra AI backend running on port ${PORT}`));