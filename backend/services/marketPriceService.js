const axios = require('axios');

const BASE_URL = 'https://api.data.gov.in/resource';

/**
 * Fetch mandi prices for a commodity in a given state/district.
 * Falls back to state-wide data if no records exist for the exact district
 * (mandi data isn't reported by every market every day).
 */
async function getMandiPrices({ commodity = 'Paddy', state, district }) {
  const url = `${BASE_URL}/${process.env.AGMARKNET_RESOURCE_ID}`;
  const baseParams = {
    'api-key': process.env.AGMARKNET_API_KEY,
    format: 'json',
    limit: 20,
    'filters[commodity]': commodity,
    'filters[state]': state,
  };

  try {
    // 1. Try exact district match first
    const districtResp = await axios.get(url, {
      params: { ...baseParams, 'filters[district]': district },
    });

    if (districtResp.data.records && districtResp.data.records.length > 0) {
      return formatResult(districtResp.data.records, 'district');
    }

    // 2. Fallback: widen to state-level data
    const stateResp = await axios.get(url, { params: baseParams });

    if (stateResp.data.records && stateResp.data.records.length > 0) {
      return formatResult(stateResp.data.records, 'state');
    }

    return {
      found: false,
      message: `No mandi price data available for ${commodity} in ${state} today.`,
    };
  } catch (error) {
    console.error('Agmarknet API error:', error.message);
    return { found: false, message: 'Could not fetch market prices right now.' };
  }
}

function formatResult(records, matchLevel) {
  return {
    found: true,
    matchLevel, // 'district' or 'state' (fallback)
    records: records.map((r) => ({
      market: r.market,
      district: r.district,
      state: r.state,
      commodity: r.commodity,
      variety: r.variety,
      minPrice: r.min_price,
      maxPrice: r.max_price,
      modalPrice: r.modal_price,
      arrivalDate: r.arrival_date,
    })),
  };
}

module.exports = { getMandiPrices };
