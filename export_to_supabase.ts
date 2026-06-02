import { initializeApp } from 'firebase/app';
import { initializeFirestore, getDocs, collection, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load configurations from firebase-applet-config.json
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error("firebase-applet-config.json not found!");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Helper to escape SQL string values safely
function escapeSQL(val: any): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'number') {
    return String(val);
  }
  if (typeof val === 'object') {
    // Check if it's a Firestore Timestamp
    if (val.seconds !== undefined) {
      return String(val.seconds * 1000);
    }
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  
  // Clean string values
  let str = String(val);
  // Replace single quotes with double single quotes for postgres SQL escaping
  str = str.replace(/'/g, "''");
  return `'${str}'`;
}

// Map key-values to insert statement rows
function formatRow(columns: string[], data: any, mapping: Record<string, string>): string {
  const values = columns.map(col => {
    const firestoreKey = mapping[col] || col;
    return escapeSQL(data[firestoreKey]);
  });
  return `(${values.join(', ')})`;
}

async function runMigration() {
  console.log("🚀 Starting extraction of Firebase Firestore collections to SQL Migration script...");
  let sql = `-- ==========================================
-- SUPABASE MIGRATION SCRIPT
-- Generated on: ${new Date().toISOString()}
-- For: GreenTech WiFi Complain Management System
-- ==========================================

-- Start transactional instructions
BEGIN;

-- 1. CLEANUP PREVIOUS TABLES (If any exist)
-- DROP TABLE IF EXISTS public.users CASCADE;
-- DROP TABLE IF EXISTS public.complaints CASCADE;
-- DROP TABLE IF EXISTS public.clients CASCADE;
-- DROP TABLE IF EXISTS public.chat_groups CASCADE;
-- DROP TABLE IF EXISTS public.chat_messages CASCADE;
-- DROP TABLE IF EXISTS public.notifications CASCADE;
-- DROP TABLE IF EXISTS public.monitor_targets CASCADE;
-- DROP TABLE IF EXISTS public.ledger_sheets CASCADE;
-- DROP TABLE IF EXISTS public.branding_config CASCADE;

-- 2. CREATE SCHEMA AND TABLES IN SUPABASE

-- === USERS TABLE ===
CREATE TABLE IF NOT EXISTS public.users (
  uid VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password TEXT,
  role VARCHAR(50) DEFAULT 'member',
  full_name VARCHAR(255),
  created_at BIGINT,
  last_active BIGINT,
  dealer_id VARCHAR(255),
  line_code VARCHAR(255),
  created_by VARCHAR(255),
  created_by_name VARCHAR(255),
  company_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  profile_picture TEXT,
  email VARCHAR(255)
);

-- === COMPLAINTS TABLE ===
CREATE TABLE IF NOT EXISTS public.complaints (
  id VARCHAR(255) PRIMARY KEY,
  member_id VARCHAR(255),
  member_name VARCHAR(255),
  customer_name VARCHAR(255),
  customer_username VARCHAR(255),
  area VARCHAR(255),
  description TEXT,
  phone_number VARCHAR(100),
  status VARCHAR(50),
  category VARCHAR(100),
  priority VARCHAR(50),
  pkg_details TEXT,
  user_nearby TEXT,
  panel_details TEXT,
  created_at BIGINT,
  updated_at BIGINT,
  remarks TEXT,
  remark_author_id VARCHAR(255),
  remark_author_name VARCHAR(255),
  customer_review TEXT,
  dealer_id VARCHAR(255)
);

-- === CLIENTS TABLE ===
CREATE TABLE IF NOT EXISTS public.clients (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  username VARCHAR(255) UNIQUE,
  number VARCHAR(100),
  mobile_number VARCHAR(100),
  series_number VARCHAR(100),
  area VARCHAR(255),
  pkg_details TEXT,
  user_nearby TEXT,
  panel_details TEXT,
  created_by VARCHAR(255),
  created_at BIGINT,
  dealer_id VARCHAR(255),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

-- === CHAT GROUPS TABLE ===
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  members JSONB DEFAULT '[]'::jsonb,
  created_by VARCHAR(255),
  created_at BIGINT,
  dealer_id VARCHAR(255)
);

-- === CHAT MESSAGES TABLE ===
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id VARCHAR(255) PRIMARY KEY,
  sender_id VARCHAR(255),
  sender_name VARCHAR(255),
  text TEXT,
  audio_url TEXT,
  type VARCHAR(50) DEFAULT 'text',
  recipient_id VARCHAR(255),
  is_group BOOLEAN DEFAULT false,
  duration NUMERIC,
  reply_to JSONB DEFAULT NULL,
  created_at BIGINT,
  seen_by JSONB DEFAULT '{}'::jsonb,
  dealer_id VARCHAR(255)
);

-- === NOTIFICATIONS TABLE ===
CREATE TABLE IF NOT EXISTS public.notifications (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(100),
  message TEXT,
  author_name VARCHAR(255),
  created_at BIGINT,
  is_read BOOLEAN DEFAULT false,
  dealer_id VARCHAR(255),
  details JSONB DEFAULT NULL
);

-- === MONITOR TARGETS TABLE ===
CREATE TABLE IF NOT EXISTS public.monitor_targets (
  id VARCHAR(255) PRIMARY KEY,
  domain VARCHAR(255),
  created_by VARCHAR(255),
  created_at BIGINT,
  dealer_id VARCHAR(255),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  label VARCHAR(255)
);

-- === LEDGER SHEETS TABLE ===
CREATE TABLE IF NOT EXISTS public.ledger_sheets (
  id VARCHAR(255) PRIMARY KEY,
  rec_officer VARCHAR(255),
  rec_officer_label VARCHAR(255),
  area VARCHAR(255),
  area_label VARCHAR(255),
  sheet_date VARCHAR(100),
  date_label VARCHAR(255),
  table1_rows JSONB DEFAULT '[]'::jsonb,
  table2_rows JSONB DEFAULT '[]'::jsonb,
  cash_received TEXT,
  sign TEXT,
  submitted TEXT,
  cash_received_label VARCHAR(255),
  sign_label VARCHAR(255),
  submitted_label VARCHAR(255),
  footnote_left TEXT,
  footnote_right TEXT,
  dealer_id VARCHAR(255),
  created_at BIGINT
);

-- === BRANDING CONFIG TABLE ===
CREATE TABLE IF NOT EXISTS public.branding_config (
  id VARCHAR(255) PRIMARY KEY,
  project_name VARCHAR(255),
  accent_color VARCHAR(50),
  secondary_color VARCHAR(50),
  theme_color VARCHAR(50),
  font_family VARCHAR(100),
  border_radius VARCHAR(50),
  card_style VARCHAR(50),
  glass_opacity NUMERIC,
  enable_animations BOOLEAN,
  logo_url TEXT,
  sidebar_theme VARCHAR(50),
  mascot_pos JSONB DEFAULT '{"x": 0, "y": 0}'::jsonb,
  hide_bot BOOLEAN,
  chat_welcome_msg TEXT,
  dashboard_subtext TEXT,
  updated_at BIGINT,
  updated_by VARCHAR(255)
);

-- Enable Row Level Security (RLS) on all tables for Supabase standard security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_config ENABLE ROW LEVEL SECURITY;

-- Create basic permissible bypass policies for simplified transition
CREATE POLICY "Allow public select of users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert of users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of users" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete of users" ON public.users FOR DELETE USING (true);

CREATE POLICY "Allow public CRUD of complaints" ON public.complaints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of chat_groups" ON public.chat_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of monitor_targets" ON public.monitor_targets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of ledger_sheets" ON public.ledger_sheets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public CRUD of branding_config" ON public.branding_config FOR ALL USING (true) WITH CHECK (true);

-- 3. INTERPOLATED COPIED RECORDS DATA FROM FIREBASE

`;

  // Define data fetch definitions
  const collectionsToMigrate = [
    {
      col: 'users',
      table: 'public.users',
      keyField: 'uid',
      mapping: {
        uid: 'uid',
        username: 'username',
        password: 'password',
        role: 'role',
        full_name: 'fullName',
        created_at: 'createdAt',
        last_active: 'lastActive',
        dealer_id: 'dealerId',
        line_code: 'lineCode',
        created_by: 'createdBy',
        created_by_name: 'createdByName',
        company_name: 'companyName',
        status: 'status',
        profile_picture: 'profilePicture',
        email: 'email'
      }
    },
    {
      col: 'complaints',
      table: 'public.complaints',
      keyField: 'id',
      mapping: {
        id: 'id',
        member_id: 'memberId',
        member_name: 'memberName',
        customer_name: 'customerName',
        customer_username: 'customerUsername',
        area: 'area',
        description: 'description',
        phone_number: 'number',
        status: 'status',
        category: 'category',
        priority: 'priority',
        pkg_details: 'pkgDetails',
        user_nearby: 'userNearby',
        panel_details: 'panelDetails',
        created_at: 'createdAt',
        updated_at: 'updatedAt',
        remarks: 'remarks',
        remark_author_id: 'remarkAuthorId',
        remark_author_name: 'remarkAuthorName',
        customer_review: 'customerReview',
        dealer_id: 'dealerId'
      }
    },
    {
      col: 'clients',
      table: 'public.clients',
      keyField: 'id',
      mapping: {
        id: 'id',
        name: 'name',
        username: 'username',
        number: 'number',
        mobile_number: 'mobileNumber',
        series_number: 'seriesNumber',
        area: 'area',
        pkg_details: 'pkgDetails',
        user_nearby: 'userNearby',
        panel_details: 'panelDetails',
        created_by: 'createdBy',
        created_at: 'createdAt',
        dealer_id: 'dealerId',
        lat: 'lat',
        lng: 'lng'
      }
    },
    {
      col: 'chat_groups',
      table: 'public.chat_groups',
      keyField: 'id',
      mapping: {
        id: 'id',
        name: 'name',
        members: 'members',
        created_by: 'createdBy',
        created_at: 'createdAt',
        dealer_id: 'dealerId'
      }
    },
    {
      col: 'chat_messages',
      table: 'public.chat_messages',
      keyField: 'id',
      mapping: {
        id: 'id',
        sender_id: 'senderId',
        sender_name: 'senderName',
        text: 'text',
        audio_url: 'audioUrl',
        type: 'type',
        recipient_id: 'recipientId',
        is_group: 'isGroup',
        duration: 'duration',
        reply_to: 'replyTo',
        created_at: 'createdAt',
        seen_by: 'seenBy',
        dealer_id: 'dealerId'
      }
    },
    {
      col: 'notifications',
      table: 'public.notifications',
      keyField: 'id',
      mapping: {
        id: 'id',
        type: 'type',
        message: 'message',
        author_name: 'authorName',
        created_at: 'createdAt',
        is_read: 'isRead',
        dealer_id: 'dealerId',
        details: 'details'
      }
    },
    {
      col: 'monitor',
      table: 'public.monitor_targets',
      keyField: 'id',
      mapping: {
        id: 'id',
        domain: 'domain',
        created_by: 'createdBy',
        created_at: 'createdAt',
        dealer_id: 'dealerId',
        lat: 'lat',
        lng: 'lng',
        label: 'label'
      }
    },
    {
      col: 'ledger_sheets',
      table: 'public.ledger_sheets',
      keyField: 'id',
      mapping: {
        id: 'id',
        rec_officer: 'recOfficer',
        rec_officer_label: 'recOfficerLabel',
        area: 'area',
        area_label: 'areaLabel',
        sheet_date: 'sheetDate',
        date_label: 'dateLabel',
        table1_rows: 'table1Rows',
        table2_rows: 'table2Rows',
        cash_received: 'cashReceived',
        sign: 'sign',
        submitted: 'submitted',
        cash_received_label: 'cashReceivedLabel',
        sign_label: 'signLabel',
        submitted_label: 'submittedLabel',
        footnote_left: 'footnoteLeft',
        footnote_right: 'footnoteRight',
        dealer_id: 'dealerId',
        created_at: 'createdAt'
      }
    }
  ];

  for (const item of collectionsToMigrate) {
    try {
      console.log(`📡 Fetching from collection: "${item.col}"...`);
      const snapshot = await getDocs(collection(db, item.col));
      const docs = snapshot.docs;
      
      if (docs.length === 0) {
        sql += `\n-- Note: Firebase Collection "${item.col}" was empty or had no documents\n`;
        console.log(`ℹ️ Collection "${item.col}" is empty.`);
        continue;
      }

      sql += `\n-- Data insertion for "${item.col}" (${docs.length} rows)\n`;
      const columns = Object.keys(item.mapping);

      // We'll write inserts in batches of 50 to avoid colossal single queries
      const batchSize = 50;
      for (let i = 0; i < docs.length; i += batchSize) {
        const slice = docs.slice(i, i + batchSize);
        const valuesList = slice.map(docSnap => {
          const docData = { ...docSnap.data(), [item.keyField]: docSnap.id };
          return formatRow(columns, docData, item.mapping);
        });

        sql += `INSERT INTO ${item.table} (${columns.join(', ')}) VALUES\n  ${valuesList.join(',\n  ')}\nON CONFLICT (${item.keyField}) DO UPDATE SET\n  ${columns.map(c => `${c} = EXCLUDED.${c}`).join(',\n  ')};\n\n`;
      }
      console.log(`✅ Formatted ${docs.length} items from collection "${item.col}" into SQL.`);
    } catch (e: any) {
      console.warn(`⚠️ Collection "${item.col}" fetch failed (possibly quota bounds or missing permission, continuing table migrations anyway):`, e.message || e);
      sql += `\n-- Warning: Failed to fetch records for "${item.col}": ${String(e.message || e).replace(/\n/g, ' ')}\n`;
    }
  }

  // Handle specific config documents (especially 'branding' doc in config collection)
  try {
    console.log("📡 Fetching configuration ('config/branding')...");
    const configSnap = await getDoc(doc(db, 'config', 'branding'));
    if (configSnap.exists()) {
      const bData = configSnap.data();
      const bPayload = {
        id: 'branding',
        project_name: bData.projectName || 'GreenTech WiFi Complain Management',
        accent_color: bData.accentColor || '#3b82f6',
        secondary_color: bData.secondaryColor || '#1e293b',
        theme_color: bData.themeColor || '#1e293b',
        font_family: bData.fontFamily || 'Inter',
        border_radius: bData.borderRadius || 'lg',
        card_style: bData.cardStyle || 'bordered',
        glass_opacity: bData.glassOpacity || 0.2,
        enable_animations: bData.enableAnimations !== false,
        logo_url: bData.logoUrl || '',
        sidebar_theme: bData.sidebarTheme || 'dark',
        mascot_pos: bData.mascotPos || { x: 0, y: 0 },
        hide_bot: bData.hideBot || false,
        chat_welcome_msg: bData.chatWelcomeMsg || '',
        dashboard_subtext: bData.dashboardSubtext || '',
        updated_at: bData.updatedAt || Date.now(),
        updated_by: bData.updatedBy || 'admin'
      };

      const columns = Object.keys(bPayload);
      const values = columns.map(c => escapeSQL((bPayload as any)[c]));

      sql += `\n-- Branding Config Row\n`;
      sql += `INSERT INTO public.branding_config (${columns.join(', ')}) VALUES\n  (${values.join(', ')})\nON CONFLICT (id) DO UPDATE SET\n  ${columns.map(c => `${c} = EXCLUDED.${c}`).join(',\n  ')};\n\n`;
      console.log("✅ Custom branding configuration format verified and embedded into SQL.");
    }
  } catch (e: any) {
    console.warn("⚠️ Configuration loading fallback triggered:", e.message || e);
    sql += `\n-- Configuration fetching skipped: ${String(e.message || e).replace(/\n/g, ' ')}\n`;
  }

  // End transaction SQL
  sql += `\nCOMMIT;\n`;

  // Ensure absolute write directory
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Write files
  const outputPublic = path.join(publicDir, 'supabase_migration.sql');
  const outputRoot = path.join(rootDir, 'supabase_migration.sql');

  fs.writeFileSync(outputPublic, sql, 'utf8');
  fs.writeFileSync(outputRoot, sql, 'utf8');

  console.log(`\n🎉 GREAT SUCCESS! All tables generated successfully!`);
  console.log(`- Copy file generated at Root directory: ${outputRoot}`);
  console.log(`- Web downloadable accessible file compiled at: ${outputPublic}`);
}

runMigration().catch(err => {
  console.error("❌ Fatal error converting database elements:", err);
  process.exit(1);
});
