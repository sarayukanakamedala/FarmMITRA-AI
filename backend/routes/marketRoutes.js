const express = require('express');
const router = express.Router();

const Farmer = require('../models/Farmer');
const { getMandiPrices } = require('../services/marketPriceService');
const { getWeatherForecast } = require('../services/weatherService');

/**
 * GET /api/market/snapshot/:phone
 * Live mandi prices + weather forecast for the farmer's own district.
 * Powers the dashboard and the Market & Weather page.
 */
router.get('/snapshot/:phone', async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ phone: req.params.phone });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found.' });

    const [prices, weather] = await Promise.all([
      getMandiPrices({ commodity: req.query.commodity || 'Paddy(Dhan)(Common)', state: farmer.state, district: farmer.district }),
      getWeatherForecast(farmer.district || farmer.state),
    ]);

    res.json({
      location: { state: farmer.state, district: farmer.district },
      prices,
      weather,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load market snapshot.' });
  }
});

module.exports = router;