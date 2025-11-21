const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointment');   // <-- FIXED (filename is lowercase)

/**
 * Simple `ai` logic:
 * - If message contains "book" or "schedule" -> try to extract slots and create appointment
 * - If "list" or "my appointments" -> return list
 * - If "availability" or "is there" -> check same date/time
 * - Otherwise return friendly fallback
 */

// Helper: naive slot extractor (very simple)
function extractSlots(text) {
  const res = {};

  // Name - look for "my name is NAME" or "I'm NAME"
  const nameMatch = text.match(/(?:my name is|i am|i'm)\s+([A-Z][a-zA-Z ]{1,50})/i);
  if (nameMatch) res.patientName = nameMatch[1].trim();

  // Date - YYYY-MM-DD or words like tomorrow / today or dd/mm/yyyy
  const isoDate = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoDate) res.date = isoDate[1];

  const dm = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (dm && !res.date) {
    const parts = dm[1].split('/');
    if (parts[2].length === 2) parts[2] = '20' + parts[2];
    res.date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  if (!res.date) {
    if (/\btomorrow\b/i.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      res.date = d.toISOString().slice(0, 10);
    } else if (/\btoday\b/i.test(text)) {
      res.date = new Date().toISOString().slice(0, 10);
    }
  }

  // Time - HH:MM or words like "at 3pm"
  const timeMatch = text.match(/\b(\d{1,2}:\d{2})\b/);
  if (timeMatch) res.time = timeMatch[1];

  const pmMatch = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (pmMatch && !res.time) {
    let hour = parseInt(pmMatch[1]);
    const part = pmMatch[2].toLowerCase();
    if (part === 'pm' && hour < 12) hour += 12;
    res.time = hour.toString().padStart(2, '0') + ':00';
  }

  // Reason
  const reasonMatch =
    text.match(/because (.+)$/i) ||
    text.match(/for (a|an|the)?\s*([a-zA-Z ]+)$/i);

  if (reasonMatch) res.reason = (reasonMatch[1] || reasonMatch[2]).trim();

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch) res.email = emailMatch[0];

  // Phone
  const phoneMatch = text.match(/(\+?\d{10,15})/);
  if (phoneMatch) res.phone = phoneMatch[1];

  return res;
}

router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message)
    return res.status(400).json({ reply: "Send me a message in the 'message' field." });

  const text = message.toLowerCase();

  try {
    // BOOKING INTENT
    if (/(book|schedule|make|reserve)/i.test(message)) {
      const slots = extractSlots(message);

      if (!slots.patientName || !slots.date || !slots.time) {
        const missing = [];
        if (!slots.patientName) missing.push('patient name');
        if (!slots.date) missing.push('date');
        if (!slots.time) missing.push('time');

        return res.json({
          reply: `To book your appointment, I still need: ${missing.join(', ')}.`,
          slots,
        });
      }

      // Check slot availability (max 5 per slot)
      const count = await Appointment.countDocuments({
        date: slots.date,
        time: slots.time,
      });

      if (count >= 5)
        return res.json({
          reply: `Sorry, ${slots.date} at ${slots.time} is fully booked.`,
        });

      const appt = new Appointment({
        patientName: slots.patientName,
        email: slots.email,
        phone: slots.phone,
        date: slots.date,
        time: slots.time,
        reason: slots.reason || 'General',
      });

      await appt.save();

      return res.json({
        reply: `Appointment confirmed for ${slots.patientName} on ${slots.date} at ${slots.time}.`,
        appointment: appt,
      });
    }

    // LIST APPOINTMENTS
    if (/(list|show|appointments|my appointments)/i.test(message)) {
      const slots = extractSlots(message);

      let appts = [];

      if (slots.email)
        appts = await Appointment.find({ email: slots.email }).sort({ date: 1 });
      else if (slots.patientName)
        appts = await Appointment.find({
          patientName: new RegExp(slots.patientName, 'i'),
        }).sort({ date: 1 });
      else
        appts = await Appointment.find().sort({ date: 1 }).limit(10);

      if (appts.length === 0)
        return res.json({ reply: 'No appointments found.' });

      return res.json({
        reply: `Found ${appts.length} appointment(s).`,
        appointments: appts,
      });
    }

    // AVAILABILITY
    if (/(available|availability|is there|free)/i.test(message)) {
      const slots = extractSlots(message);

      if (!slots.date || !slots.time) {
        return res.json({
          reply: 'Tell me a date & time to check (e.g., "Is 2025-11-20 at 14:00 available?").',
          slots,
        });
      }

      const count = await Appointment.countDocuments({
        date: slots.date,
        time: slots.time,
      });

      if (count >= 5)
        return res.json({
          reply: `No — ${slots.date} at ${slots.time} is full.`,
        });

      return res.json({
        reply: `Yes — ${slots.date} at ${slots.time} has availability.`,
      });
    }

    // DEFAULT
    return res.json({
      reply:
        "Hi! I can help you book appointments, check availability or list your appointments.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ reply: 'Server error.' });
  }
});

// REST ENDPOINTS
router.get('/appointments', async (req, res) => {
  const appts = await Appointment.find().sort({ date: 1 });
  res.json(appts);
});

router.get('/appointments/:id', async (req, res) => {
  const appt = await Appointment.findById(req.params.id);
  if (!appt) return res.status(404).json({ message: 'Not found' });
  res.json(appt);
});

module.exports = router;
