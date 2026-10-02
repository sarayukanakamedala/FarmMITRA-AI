const mongoose = require('mongoose');

const FarmerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, default: null },
    preferredLanguage: { type: String, default: 'te-IN' }, // e.g. te-IN, hi-IN, en-IN
    state: { type: String, required: true },
    district: { type: String, required: true },

    // Paddy crop details
    cropName: { type: String, default: 'Paddy' },
    plantingDate: { type: Date, required: true },
    soilType: {
      type: String,
      enum: ['clay', 'loamy', 'sandy'],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Farmer', FarmerSchema);
