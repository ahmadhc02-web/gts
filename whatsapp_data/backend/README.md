# WhatsApp Billing Service

This is a standalone Node.js service that runs the WhatsApp Baileys integration for the billing module.

## Setup Instructions for Hetzner Server

1. **Install Dependencies:**
   Make sure you have Node.js installed. Navigate to this `backend` directory and run:
   ```bash
   npm install
   ```

2. **Database:**
   Run the SQL command in `schema.sql` on your Supabase project to create the required table for the message template.

3. **Environment Variables:**
   Copy `.env.example` to `.env` and fill in your Supabase URL, Service Role Key, and the allowed origin (the URL where your frontend app is hosted).
   ```bash
   cp .env.example .env
   ```

4. **Running with PM2 (Recommended):**
   To keep the service running persistently on the server independently of the main website:
   ```bash
   npm install -g pm2
   pm2 start server.js --name whatsapp-service
   pm2 save
   pm2 startup
   ```

This service will listen on port 3001 (or whatever `PORT` you configure in `.env`). The WhatsApp session is saved to the `auth_session` directory automatically.
