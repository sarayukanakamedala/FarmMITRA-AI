require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const farmerRoutes = require('./routes/farmerRoutes');
const queryRoutes = require('./routes/queryRoutes');
const diseaseRoutes = require('./routes/diseaseRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const notifyRoutes = require('./routes/notifyRoutes');

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get('/', (req, res) => {
  res.json({ status: 'FarmMitra AI backend running' });
});

app.use('/api/farmers', farmerRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/disease', diseaseRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notify', notifyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`FarmMitra AI backend running on port ${PORT}`));
