CREATE TABLE whatsapp_settings (
  id text PRIMARY KEY DEFAULT 'main',
  message_template text NOT NULL DEFAULT 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.',
  complaint_registered_template text DEFAULT 'Dear {{name}}, your complaint (#{{complaintId}}) regarding "{{category}}" has been registered. Our team will contact you soon. Thank you for your patience.',
  complaint_completed_template text DEFAULT 'Dear {{name}}, your complaint (#{{complaintId}}) has been resolved. Thank you for choosing us. Please contact us if the issue persists.',
  complaint_completed_status_value text DEFAULT 'Resolved',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  message text NOT NULL,
  status text NOT NULL, -- 'success' or 'failed'
  error_message text,
  sent_at timestamptz DEFAULT now()
);
