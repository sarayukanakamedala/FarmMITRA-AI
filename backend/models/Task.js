const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
    stage: { type: String, required: true }, // e.g. "Nursery", "Transplanting"
    title: { type: String, required: true }, // e.g. "Apply first dose of fertilizer"
    details: { type: String, default: '' },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'done', 'overdue'], default: 'pending' },
    notifiedByEmail: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', TaskSchema);
