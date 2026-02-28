const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────
//  connectDB
//  Called once in server.js before starting the HTTP server.
//  Uses the MONGODB_URI from .env file.
// ─────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options suppress deprecation warnings
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    // Exit the process — no point running without a database
    process.exit(1);
  }
};

module.exports = connectDB;
