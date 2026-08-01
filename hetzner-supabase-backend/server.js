import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabaseAdmin } from './config/supabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// 1. Health-check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 2. Test database endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    // Attempt to query a standard table to test connection
    // We query the "users" table, adjust if you have a different table
    const { data, error } = await supabaseAdmin
      .from('users') // change 'users' to a table that definitely exists
      .select('*')
      .limit(1);

    if (error) {
      console.error("Supabase Query Error:", error);
      return res.status(500).json({ success: false, error: error.message, details: error });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("Unexpected Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generic Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Supabase Admin Connection Ready`);
  console.log(`=================================`);
});
