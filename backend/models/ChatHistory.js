const mongoose = require('mongoose');

const ChatHistorySchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', default: null },
    queryText: { type: String, required: true },
    queryType: { type: String, enum: ['market', 'disease', 'general'], default: 'general' },
    responseText: { type: String, required: true },
    audioResponseUrl: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);
