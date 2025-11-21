// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/patient_chatbot');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1) serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// 2) API routes MUST come AFTER static but BEFORE the wildcard fallback
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// 3) SPA fallback (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
