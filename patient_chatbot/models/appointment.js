const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  date: { type: String, required: true },    // use 'YYYY-MM-DD'
  time: { type: String, required: true },    // use 'HH:mm' or free text
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
