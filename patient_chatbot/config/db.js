// config/db.js
const mongoose = require('mongoose');

const connectDB = async (mongoUri) => {
  try {
    const uri = mongoUri || process.env.MONGO_URI || 'mongodb://localhost:27017/patient_chatbot';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected:', uri);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // exit the process so supervisor (nodemon) can restart or you can notice the failure
    process.exit(1);
  }
};

module.exports = connectDB;
