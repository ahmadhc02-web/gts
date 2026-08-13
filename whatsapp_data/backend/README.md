# WhatsApp Billing Service

This is a standalone Node.js service that runs the WhatsApp Baileys integration for the billing module.

## Frontend Configuration Requirement

> [!CRITICAL]
> Since Vite environment variables are baked into the built JS bundle at **BUILD TIME**, you must ensure that **`VITE_WHATSAPP_SERVICE_URL`** is set correctly in the production build's `.env` file (e.g., `VITE_WHATSAPP_SERVICE_URL=https://yourdomain.com:3001` or a reverse-proxied path like `https://yourdomain.com/whatsapp-api`). If not configured before building, the frontend will default to `http://localhost:3001` in the visitor's browser, failing to connect to the server's WhatsApp service.

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
   To keep the service running persistently on the server independently of the main website and prevent crash-looping from hammering WhatsApp's servers, use the following commands:
   ```bash
   npm install -g pm2
   pm2 start server.js --name whatsapp-service --max-restarts 10 --min-uptime 30000
   pm2 save
   pm2 startup
   ```

This service will listen on port 3001 (or whatever `PORT` you configure in `.env`). The WhatsApp session is saved to the `auth_session` directory automatically.
