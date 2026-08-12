CREATE TABLE whatsapp_settings (
  id text PRIMARY KEY DEFAULT 'main',
  message_template text NOT NULL DEFAULT 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.',
  updated_at timestamptz DEFAULT now()
);
