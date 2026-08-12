require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getBaileysStatus, getBaileysQr, sendMessage, initBaileys, logoutBaileys } = require('./baileysClient');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Setup Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

// Init Baileys
initBaileys();

app.get('/status', (req, res) => {
  res.json(getBaileysStatus());
});

app.get('/qr', async (req, res) => {
  const qrBase64 = await getBaileysQr();
  if (!qrBase64) {
    return res.json({ qr: null });
  }
  res.json({ qr: qrBase64 });
});

app.post('/disconnect', async (req, res) => {
  await logoutBaileys();
  res.json({ success: true });
});

app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    // Normalize Pakistani number
    let normalizedPhone = phone.replace(/[\s-]/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '92' + normalizedPhone.substring(1);
    } else if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    } else if (normalizedPhone.startsWith('3')) {
      normalizedPhone = '92' + normalizedPhone;
    }

    const result = await sendMessage(normalizedPhone, message);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to send message' });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/template', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('message_template')
      .eq('id', 'main')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Default fallback
    const template = data?.message_template || 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.';
    res.json({ template });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/template', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { template } = req.body;
    if (!template) return res.status(400).json({ error: 'Template is required' });

    const { error } = await supabase
      .from('whatsapp_settings')
      .upsert({ id: 'main', message_template: template, updated_at: new Date().toISOString() });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Save template error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp Baileys service listening on port ${PORT}`);
});
