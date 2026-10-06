require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const ws = require('ws');
const { getBaileysStatus, getBaileysQr, sendMessage, initBaileys, logoutBaileys, resetBaileysSession, registerMessageLogCallback, normalizePakistaniPhone } = require('./baileysClient.cjs');
const { createClient } = require('@supabase/supabase-js');

let admin = null;
let firebaseApp = null;
const serviceAccountPath = path.join(__dirname, "firebase-service-account.json");
if (fs.existsSync(serviceAccountPath)) {
  try {
    admin = require("firebase-admin");
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("[Firebase] Admin initialized successfully");
  } catch (e) {
    console.log("[Firebase] Service account found but initialization skipped:", e.message);
  }
} else {
  // Silent fallback when firebase-service-account.json is not present
  console.log("[Firebase] No firebase-service-account.json detected. Push notifications will use direct/fallback paths.");
}

const app = express();
const PORT = process.env.WHATSAPP_PORT || 3001;

// Setup Supabase with Node.js 20 Realtime WebSocket Transport Fix & Auth Headers
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://167.233.41.7.sslip.io';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1NDk5NzQ3LCJleHAiOjIxMDA4NTk3NDd9.lX7sriVJBtEBVeE5LDiBl6OZgpjAw4ZRBNkegBH7uFo';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  },
  realtime: {
    transport: ws,
  },
}) : null;

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

const { init: initLeadProcessor, processReminderLead, resumeInterruptedLeads } = require('./leadProcessor.cjs');
if (supabase) {
  initLeadProcessor(supabase);
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

app.post('/reset-session', async (req, res) => {
  try {
    const result = await resetBaileysSession();
    res.json(result);
  } catch (err) {
    console.error('Failed to reset session:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to reset session' });
  }
});

app.post('/send-push', async (req, res) => {
  try {
    const { tokens, title, body, data } = req.body;
    if (!firebaseApp || !admin) {
      return res.status(503).json({ success: false, error: 'Firebase not configured on server' });
    }
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or invalid tokens' });
    }
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Missing title or body' });
    }

    const messagePayload = {
      notification: { title, body },
      data: data || {},
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(messagePayload);
    
    res.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map(r => ({ success: r.success, error: r.error ? r.error.message : null }))
    });
  } catch (err) {
    console.error('Failed to send push notifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    const normalizedPhone = normalizePakistaniPhone(phone);
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

app.post('/create-lead', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { name, dealerId, lineCode, monthId, dueDateStart, dueDateEnd, waitSeconds, items } = req.body;
    
    // 1. Insert lead using Service Role client (bypasses RLS)
    const { data: leadRow, error: leadErr } = await supabase
      .from('reminder_leads')
      .insert({
        name: name || 'Reminder Lead',
        dealer_id: dealerId || 'main',
        line_code: lineCode || null,
        month_id: monthId,
        due_date_start: dueDateStart,
        due_date_end: dueDateEnd,
        wait_seconds: waitSeconds || 30,
        status: 'pending',
        total_count: Array.isArray(items) ? items.length : 0,
        success_count: 0,
        failed_count: 0
      })
      .select('id')
      .single();

    if (leadErr) throw leadErr;
    const leadId = leadRow.id;

    // 2. Insert lead items
    if (Array.isArray(items) && items.length > 0) {
      const itemRows = items.map((item, idx) => ({
        lead_id: leadId,
        client_id: String(item.clientId || ''),
        name: String(item.name || ''),
        mobile_number: String(item.mobileNumber || ''),
        message: item.message || null,
        status: 'pending',
        sort_order: idx
      }));

      const { error: itemsErr } = await supabase
        .from('reminder_lead_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;
    }

    res.json({ success: true, leadId });
  } catch (err) {
    console.error('Failed to create lead on server:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/start-lead', async (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured on WhatsApp backend' });
  // Fire-and-forget: respond immediately, keep processing in background
  processReminderLead(leadId).catch(err => console.error('[Server] Lead processing error:', err));
  res.json({ started: true, leadId });
});

const TEMPLATES_FILE = path.join(__dirname, 'templates.json');

function readLocalTemplates() {
  try {
    if (fs.existsSync(TEMPLATES_FILE)) {
      const content = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('[Server] Error reading local templates.json:', e);
  }
  return null;
}

function writeLocalTemplates(data) {
  try {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Server] Error writing local templates.json:', e);
  }
}

app.get('/template', async (req, res) => {
  const localData = readLocalTemplates();
  let dbData = null;

  if (supabase) {
    try {
      const { data } = await supabase
        .from('branding_config')
        .select('*')
        .eq('config_type', 'whatsapp_templates')
        .limit(1);

      if (data && data.length > 0 && data[0].branding_data) {
        const parsed = typeof data[0].branding_data === 'string' ? JSON.parse(data[0].branding_data) : data[0].branding_data;
        if (parsed && (parsed.template || parsed.message_template)) {
          dbData = {
            message_template: parsed.template || parsed.message_template,
            complaint_registered_template: parsed.complaintRegisteredTemplate || parsed.complaint_registered_template,
            complaint_completed_template: parsed.complaintCompletedTemplate || parsed.complaint_completed_template,
            complaint_completed_status_value: parsed.completedStatusValue || parsed.complaint_completed_status_value
          };
        }
      }
    } catch (_) {}

    if (!dbData) {
      try {
        const { data, error } = await supabase
          .from('whatsapp_settings')
          .select('message_template, complaint_registered_template, complaint_completed_template, complaint_completed_status_value')
          .eq('id', 'main')
          .single();

        if (!error && data) {
          dbData = data;
        }
      } catch (err) {
        console.warn('[Server] Supabase get template warning (using fallback):', err.message);
      }
    }
  }

  // Default fallback
  const template = dbData?.message_template || localData?.template || 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.';
  const complaintRegisteredTemplate = dbData?.complaint_registered_template || localData?.complaintRegisteredTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.';
  const complaintCompletedTemplate = dbData?.complaint_completed_template || localData?.complaintCompletedTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.';
  const completedStatusValue = dbData?.complaint_completed_status_value || localData?.completedStatusValue || 'Resolved';

  res.json({ template, complaintRegisteredTemplate, complaintCompletedTemplate, completedStatusValue });
});

app.post('/template', async (req, res) => {
  try {
    const { template, complaintRegisteredTemplate, complaintCompletedTemplate, completedStatusValue } = req.body;
    
    const existingLocal = readLocalTemplates() || {};
    const localToSave = {
      template: template !== undefined ? template : (existingLocal.template || 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.'),
      complaintRegisteredTemplate: complaintRegisteredTemplate !== undefined ? complaintRegisteredTemplate : (existingLocal.complaintRegisteredTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.'),
      complaintCompletedTemplate: complaintCompletedTemplate !== undefined ? complaintCompletedTemplate : (existingLocal.complaintCompletedTemplate || 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.'),
      completedStatusValue: completedStatusValue !== undefined ? completedStatusValue : (existingLocal.completedStatusValue || 'Resolved'),
      updated_at: new Date().toISOString()
    };

    // Always persist to local disk first
    writeLocalTemplates(localToSave);

    if (supabase) {
      try {
        await supabase
          .from('branding_config')
          .upsert({
            config_type: 'whatsapp_templates',
            branding_data: JSON.stringify(localToSave),
            updated_at: localToSave.updated_at
          }, { onConflict: 'config_type' });
      } catch (_) {}

      try {
        const updateData = {
          id: 'main',
          message_template: localToSave.template,
          complaint_registered_template: localToSave.complaintRegisteredTemplate,
          complaint_completed_template: localToSave.complaintCompletedTemplate,
          complaint_completed_status_value: localToSave.completedStatusValue,
          updated_at: localToSave.updated_at
        };

        const { error } = await supabase
          .from('whatsapp_settings')
          .upsert(updateData);

        if (error) {
          console.warn('[Server] Supabase save warning (fallback saved locally):', error.message);
        }
      } catch (dbErr) {
        console.warn('[Server] Supabase upsert error (saved locally):', dbErr.message);
      }
    }

    res.json({ success: true, template: localToSave.template });
  } catch (err) {
    console.error('Save template error:', err);
    res.json({ success: true, warning: err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`WhatsApp Baileys service listening on port ${PORT}`);
  // Resume any interrupted running leads after Baileys has initialized
  setTimeout(() => {
    if (supabase) {
      resumeInterruptedLeads();
    }
  }, 15000);
});

server.on('error', (err) => {
  console.warn(`[WhatsApp Service] Port ${PORT} listen notice:`, err.message);
});