require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getBaileysStatus, getBaileysQr, sendMessage, initBaileys, logoutBaileys, registerMessageLogCallback } = require('./baileysClient');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Setup Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Register Logging Callback to Supabase
if (supabase) {
  registerMessageLogCallback(async (recipient, message, status, errorMessage) => {
    try {
      console.log(`[Database Log] Recipient: ${recipient}, Status: ${status}`);
      const { error } = await supabase
        .from('whatsapp_message_log')
        .insert({
          recipient,
          message,
          status,
          error_message: errorMessage,
          sent_at: new Date().toISOString()
        });
      if (error) {
        console.error('Error inserting log into whatsapp_message_log:', error);
      }
    } catch (e) {
      console.error('Exception during database logging:', e);
    }
  });
}

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
      .select('message_template, complaint_registered_template, complaint_completed_template, complaint_completed_status_value')
      .eq('id', 'main')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Default fallback
    const template = data?.message_template || 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.';
    const complaintRegisteredTemplate = data?.complaint_registered_template || 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.';
    const complaintCompletedTemplate = data?.complaint_completed_template || 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.';
    const completedStatusValue = data?.complaint_completed_status_value || 'Resolved';

    res.json({ template, complaintRegisteredTemplate, complaintCompletedTemplate, completedStatusValue });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/template', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { template, complaintRegisteredTemplate, complaintCompletedTemplate, completedStatusValue } = req.body;
    
    // Fetch existing data first to do a partial update if some fields are missing
    const { data: existingData } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('id', 'main')
      .single();

    const updateData = {
      id: 'main',
      updated_at: new Date().toISOString()
    };
    
    if (template !== undefined) updateData.message_template = template;
    else if (existingData?.message_template) updateData.message_template = existingData.message_template;
    else updateData.message_template = 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.';

    if (complaintRegisteredTemplate !== undefined) updateData.complaint_registered_template = complaintRegisteredTemplate;
    if (complaintCompletedTemplate !== undefined) updateData.complaint_completed_template = complaintCompletedTemplate;
    if (completedStatusValue !== undefined) updateData.complaint_completed_status_value = completedStatusValue;

    const { error } = await supabase
      .from('whatsapp_settings')
      .upsert(updateData);

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
