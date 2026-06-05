import { createClient } from '@supabase/supabase-js';
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './firebase';
import { supabase as defaultSupabase } from '../../supabaseClient';

/**
 * ------------------------------------------------------------------
 * 🚀 GT-ISP SUPABASE INTEGRATION & LIVE CLIENT AGENT
 * ------------------------------------------------------------------
 * This service provides the Supabase client initialization wrapper
 * and high-speed, direct browser-to-browser migration routines.
 */

export interface SupabaseConfigProps {
  url: string;
  serviceKey: string;
}

// Global cached client instance
let supabaseClientInstance: ReturnType<typeof createClient> | null = null;

/**
 * Lazy initialize or retrieve private/service Supabase client
 */
export function getSupabaseClient(config?: SupabaseConfigProps) {
  if (config) {
    supabaseClientInstance = createClient(config.url, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseClientInstance;
}

/**
 * Auto-generate clean PostgreSQL schema commands to run in Supabase SQL Editor
 */
export function generateSupabaseMigrationSQL(data: {
  users: any[];
  complaints: any[];
  clients: any[];
  chatGroups: any[];
  chatMessages: any[];
  notifications: any[];
  monitorTargets: any[];
  ledgerSheets: any[];
  branding: any;
  usersData?: any[];
}): string {
  
  const escapeSQL = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (val.seconds !== undefined) return String(val.seconds * 1000); // timestamp conv
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    }
    let str = String(val).replace(/'/g, "''");
    return `'${str}'`;
  };

  let sql = `-- ===============================================================
-- 🚀 SUPABASE ONE-CLICK SQL MIGRATION MATRIX
-- GreenTech WiFi Complain & Ledger Management Console
-- Generated: ${new Date().toLocaleString()} (In-Browser Premium compiler)
-- ===============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. DATABASE SCHEMA PROVISIONING
-- ---------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS public.chat_groups (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  members JSONB DEFAULT '[]'::jsonb,
  created_by VARCHAR(255),
  created_at BIGINT,
  dealer_id VARCHAR(255)
);

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

CREATE TABLE IF NOT EXISTS public.users_data (
  id VARCHAR(255) PRIMARY KEY,
  month_id VARCHAR(100) NOT NULL,
  client_id VARCHAR(255),
  name VARCHAR(255),
  username VARCHAR(255),
  mobile_number VARCHAR(100),
  area VARCHAR(255),
  rt VARCHAR(100),
  base_amount NUMERIC DEFAULT 0,
  cr NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  billing_day VARCHAR(50),
  payment_received NUMERIC DEFAULT 0,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  comments TEXT,
  occ VARCHAR(100),
  ser_nam VARCHAR(255),
  pkg_details TEXT,
  sag VARCHAR(100),
  lai VARCHAR(100),
  connection_date VARCHAR(100),
  device_price VARCHAR(100),
  abl VARCHAR(100),
  network VARCHAR(100),
  dealer_id VARCHAR(255) DEFAULT 'main',
  updated_at BIGINT
);

-- Row Level Security (RLS) policies activation
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_data ENABLE ROW LEVEL SECURITY;

-- Dynamic bypass security policy bindings for fast frontend onboarding
DROP POLICY IF EXISTS "Public access policy usr_data" ON public.users_data;
CREATE POLICY "Public access policy usr_data" ON public.users_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy usr" ON public.users;
CREATE POLICY "Public access policy usr" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy cmp" ON public.complaints;
CREATE POLICY "Public access policy cmp" ON public.complaints FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy clt" ON public.clients;
CREATE POLICY "Public access policy clt" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy cg" ON public.chat_groups;
CREATE POLICY "Public access policy cg" ON public.chat_groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy msg" ON public.chat_messages;
CREATE POLICY "Public access policy msg" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy notif" ON public.notifications;
CREATE POLICY "Public access policy notif" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy mon" ON public.monitor_targets;
CREATE POLICY "Public access policy mon" ON public.monitor_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy ldg" ON public.ledger_sheets;
CREATE POLICY "Public access policy ldg" ON public.ledger_sheets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy brand" ON public.branding_config;
CREATE POLICY "Public access policy brand" ON public.branding_config FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------
-- 2. FIREBASE MIGRATED RECORD ROWS
-- ---------------------------------------------------------------
`;

  // === A: Users ===
  if (data.users.length > 0) {
    sql += `\n-- Insert user records:\n`;
    sql += `INSERT INTO public.users (uid, username, password, role, full_name, created_at, last_active, dealer_id, line_code, created_by, created_by_name, company_name, status, profile_picture, email) VALUES\n`;
    sql += data.users.map(u => {
      return `  (${escapeSQL(u.uid)}, ${escapeSQL(u.username)}, ${escapeSQL(u.password)}, ${escapeSQL(u.role)}, ${escapeSQL(u.fullName)}, ${escapeSQL(u.createdAt)}, ${escapeSQL(u.lastActive)}, ${escapeSQL(u.dealerId)}, ${escapeSQL(u.lineCode)}, ${escapeSQL(u.createdBy)}, ${escapeSQL(u.createdByName)}, ${escapeSQL(u.companyName)}, ${escapeSQL(u.status)}, ${escapeSQL(u.profilePicture)}, ${escapeSQL(u.email)})`;
    }).join(',\n') + `\nON CONFLICT (uid) DO UPDATE SET\n  username=EXCLUDED.username, password=EXCLUDED.password, role=EXCLUDED.role, full_name=EXCLUDED.full_name, last_active=EXCLUDED.last_active, status=EXCLUDED.status;\n`;
  }

  // === B: Complaints ===
  if (data.complaints.length > 0) {
    sql += `\n-- Insert complaint records:\n`;
    sql += `INSERT INTO public.complaints (id, member_id, member_name, customer_name, customer_username, area, description, phone_number, status, category, priority, pkg_details, user_nearby, panel_details, created_at, updated_at, remarks, remark_author_id, remark_author_name, customer_review, dealer_id) VALUES\n`;
    sql += data.complaints.map(c => {
      return `  (${escapeSQL(c.id)}, ${escapeSQL(c.memberId)}, ${escapeSQL(c.memberName)}, ${escapeSQL(c.customerName)}, ${escapeSQL(c.customerUsername)}, ${escapeSQL(c.area)}, ${escapeSQL(c.description)}, ${escapeSQL(c.number)}, ${escapeSQL(c.status)}, ${escapeSQL(c.category)}, ${escapeSQL(c.priority)}, ${escapeSQL(c.pkgDetails)}, ${escapeSQL(c.userNearby)}, ${escapeSQL(c.panelDetails)}, ${escapeSQL(c.createdAt)}, ${escapeSQL(c.updatedAt)}, ${escapeSQL(c.remarks)}, ${escapeSQL(c.remarkAuthorId)}, ${escapeSQL(c.remarkAuthorName)}, ${escapeSQL(c.customerReview)}, ${escapeSQL(c.dealerId)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  status=EXCLUDED.status, updated_at=EXCLUDED.updated_at, remarks=EXCLUDED.remarks;\n`;
  }

  // === C: Clients ===
  if (data.clients.length > 0) {
    sql += `\n-- Insert client records:\n`;
    sql += `INSERT INTO public.clients (id, name, username, number, mobile_number, series_number, area, pkg_details, user_nearby, panel_details, created_by, created_at, dealer_id, lat, lng) VALUES\n`;
    sql += data.clients.map(cl => {
      return `  (${escapeSQL(cl.id)}, ${escapeSQL(cl.name)}, ${escapeSQL(cl.username)}, ${escapeSQL(cl.number)}, ${escapeSQL(cl.mobileNumber)}, ${escapeSQL(cl.seriesNumber)}, ${escapeSQL(cl.area)}, ${escapeSQL(cl.pkgDetails)}, ${escapeSQL(cl.userNearby)}, ${escapeSQL(cl.panelDetails)}, ${escapeSQL(cl.createdBy)}, ${escapeSQL(cl.createdAt)}, ${escapeSQL(cl.dealerId)}, ${escapeSQL(cl.lat)}, ${escapeSQL(cl.lng)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  name=EXCLUDED.name, username=EXCLUDED.username, mobile_number=EXCLUDED.mobile_number, area=EXCLUDED.area;\n`;
  }

  // === D: Chat Groups ===
  if (data.chatGroups.length > 0) {
    sql += `\n-- Insert chat group records:\n`;
    sql += `INSERT INTO public.chat_groups (id, name, members, created_by, created_at, dealer_id) VALUES\n`;
    sql += data.chatGroups.map(cg => {
      return `  (${escapeSQL(cg.id)}, ${escapeSQL(cg.name)}, ${escapeSQL(cg.members)}, ${escapeSQL(cg.createdBy)}, ${escapeSQL(cg.createdAt)}, ${escapeSQL(cg.dealerId)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  name=EXCLUDED.name, members=EXCLUDED.members;\n`;
  }

  // === E: Chat Messages ===
  if (data.chatMessages.length > 0) {
    sql += `\n-- Insert chat records:\n`;
    sql += `INSERT INTO public.chat_messages (id, sender_id, sender_name, text, audio_url, type, recipient_id, is_group, duration, reply_to, created_at, seen_by, dealer_id) VALUES\n`;
    sql += data.chatMessages.map(cm => {
      return `  (${escapeSQL(cm.id)}, ${escapeSQL(cm.senderId)}, ${escapeSQL(cm.senderName)}, ${escapeSQL(cm.text)}, ${escapeSQL(cm.audioUrl)}, ${escapeSQL(cm.type)}, ${escapeSQL(cm.recipientId)}, ${escapeSQL(cm.isGroup)}, ${escapeSQL(cm.duration)}, ${escapeSQL(cm.replyTo)}, ${escapeSQL(cm.createdAt)}, ${escapeSQL(cm.seenBy)}, ${escapeSQL(cm.dealerId)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO NOTHING;\n`;
  }

  // === F: Notifications ===
  if (data.notifications.length > 0) {
    sql += `\n-- Insert notifications records:\n`;
    sql += `INSERT INTO public.notifications (id, type, message, author_name, created_at, is_read, dealer_id, details) VALUES\n`;
    sql += data.notifications.map(n => {
      return `  (${escapeSQL(n.id)}, ${escapeSQL(n.type)}, ${escapeSQL(n.message)}, ${escapeSQL(n.authorName)}, ${escapeSQL(n.createdAt)}, ${escapeSQL(n.isRead)}, ${escapeSQL(n.dealerId)}, ${escapeSQL(n.details)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  is_read=EXCLUDED.is_read;\n`;
  }

  // === G: Monitor Targets ===
  if (data.monitorTargets.length > 0) {
    sql += `\n-- Insert latency monitoring target records:\n`;
    sql += `INSERT INTO public.monitor_targets (id, domain, created_by, created_at, dealer_id, lat, lng, label) VALUES\n`;
    sql += data.monitorTargets.map(mt => {
      return `  (${escapeSQL(mt.id)}, ${escapeSQL(mt.domain)}, ${escapeSQL(mt.createdBy)}, ${escapeSQL(mt.createdAt)}, ${escapeSQL(mt.dealerId)}, ${escapeSQL(mt.lat)}, ${escapeSQL(mt.lng)}, ${escapeSQL(mt.label)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  domain=EXCLUDED.domain, label=EXCLUDED.label;\n`;
  }

  // === H: Ledger Sheets ===
  if (data.ledgerSheets.length > 0) {
    sql += `\n-- Insert ledger registry sheets:\n`;
    sql += `INSERT INTO public.ledger_sheets (id, rec_officer, rec_officer_label, area, area_label, sheet_date, date_label, table1_rows, table2_rows, cash_received, sign, submitted, cash_received_label, sign_label, submitted_label, footnote_left, footnote_right, dealer_id, created_at) VALUES\n`;
    sql += data.ledgerSheets.map(ls => {
      return `  (${escapeSQL(ls.id)}, ${escapeSQL(ls.recOfficer)}, ${escapeSQL(ls.recOfficerLabel)}, ${escapeSQL(ls.area)}, ${escapeSQL(ls.areaLabel)}, ${escapeSQL(ls.sheetDate)}, ${escapeSQL(ls.dateLabel)}, ${escapeSQL(ls.table1Rows)}, ${escapeSQL(ls.table2Rows)}, ${escapeSQL(ls.cashReceived)}, ${escapeSQL(ls.sign)}, ${escapeSQL(ls.submitted)}, ${escapeSQL(ls.cashReceivedLabel)}, ${escapeSQL(ls.signLabel)}, ${escapeSQL(ls.submittedLabel)}, ${escapeSQL(ls.footnoteLeft)}, ${escapeSQL(ls.footnoteRight)}, ${escapeSQL(ls.dealerId)}, ${escapeSQL(ls.createdAt)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  table1_rows=EXCLUDED.table1_rows, table2_rows=EXCLUDED.table2_rows, cash_received=EXCLUDED.cash_received;\n`;
  }

  // === I: Branding Config ===
  if (data.branding) {
    sql += `\n-- Insert global console branding attributes:\n`;
    const b = data.branding;
    sql += `INSERT INTO public.branding_config (id, project_name, accent_color, secondary_color, theme_color, font_family, border_radius, card_style, glass_opacity, enable_animations, logo_url, sidebar_theme, mascot_pos, hide_bot, chat_welcome_msg, dashboard_subtext, updated_at, updated_by) VALUES\n`;
    sql += `  ('branding', ${escapeSQL(b.projectName || 'GreenTech WiFi Complain Management')}, ${escapeSQL(b.accentColor || '#3b82f6')}, ${escapeSQL(b.secondaryColor || '#1e293b')}, ${escapeSQL(b.themeColor || '#1e293b')}, ${escapeSQL(b.fontFamily || 'Inter')}, ${escapeSQL(b.borderRadius || 'lg')}, ${escapeSQL(b.cardStyle || 'bordered')}, ${escapeSQL(b.glassOpacity || 0.2)}, ${escapeSQL(b.enableAnimations !== false)}, ${escapeSQL(b.logoUrl || '')}, ${escapeSQL(b.sidebarTheme || 'dark')}, ${escapeSQL(b.mascotPos)}, ${escapeSQL(b.hideBot || false)}, ${escapeSQL(b.chatWelcomeMsg || '')}, ${escapeSQL(b.dashboardSubtext || '')}, ${escapeSQL(b.updatedAt || Date.now())}, ${escapeSQL(b.updatedBy || 'admin')})\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET\n  project_name=EXCLUDED.project_name, accent_color=EXCLUDED.accent_color, secondary_color=EXCLUDED.secondary_color, theme_color=EXCLUDED.theme_color, updated_at=EXCLUDED.updated_at;\n`;
  }

  // === J: Users Data (Billing Monthly Rows) ===
  const usersDataRows = data.usersData || [];
  if (usersDataRows.length > 0) {
    sql += `\n-- Insert user billing recovery records:\n`;
    sql += `INSERT INTO public.users_data (id, month_id, client_id, name, username, mobile_number, area, rt, base_amount, cr, total_amount, billing_day, payment_received, payment_status, comments, occ, ser_nam, pkg_details, sag, lai, connection_date, device_price, abl, network, dealer_id, updated_at) VALUES\n`;
    sql += usersDataRows.map(ud => {
      return `  (${escapeSQL(ud.id)}, ${escapeSQL(ud.month_id)}, ${escapeSQL(ud.client_id)}, ${escapeSQL(ud.name)}, ${escapeSQL(ud.username)}, ${escapeSQL(ud.mobile_number)}, ${escapeSQL(ud.area)}, ${escapeSQL(ud.rt)}, ${escapeSQL(ud.base_amount)}, ${escapeSQL(ud.cr)}, ${escapeSQL(ud.total_amount)}, ${escapeSQL(ud.billing_day)}, ${escapeSQL(ud.payment_received)}, ${escapeSQL(ud.payment_status)}, ${escapeSQL(ud.comments)}, ${escapeSQL(ud.occ)}, ${escapeSQL(ud.ser_nam)}, ${escapeSQL(ud.pkg_details)}, ${escapeSQL(ud.sag)}, ${escapeSQL(ud.lai)}, ${escapeSQL(ud.connection_date)}, ${escapeSQL(ud.device_price)}, ${escapeSQL(ud.abl)}, ${escapeSQL(ud.network)}, ${escapeSQL(ud.dealer_id)}, ${escapeSQL(ud.updated_at)})`;
    }).join(',\n') + `\nON CONFLICT (id) DO UPDATE SET\n  name=EXCLUDED.name, username=EXCLUDED.username, payment_status=EXCLUDED.payment_status, payment_received=EXCLUDED.payment_received, cr=EXCLUDED.cr, total_amount=EXCLUDED.total_amount, comments=EXCLUDED.comments, updated_at=EXCLUDED.updated_at;\n`;
  }

  sql += `\nCOMMIT;\n`;
  return sql;
}

/**
 * Fetch and extract all Firestore documents to JSON arrays for client download or live integration pushes.
 */
export async function extractFirebaseCollections(onProgress?: (colName: string, count: number) => void) {
  const result: {
    users: any[];
    complaints: any[];
    clients: any[];
    chatGroups: any[];
    chatMessages: any[];
    notifications: any[];
    monitorTargets: any[];
    ledgerSheets: any[];
    branding: any | null;
    usersData: any[];
  } = {
    users: [],
    complaints: [],
    clients: [],
    chatGroups: [],
    chatMessages: [],
    notifications: [],
    monitorTargets: [],
    ledgerSheets: [],
    branding: null,
    usersData: []
  };

  const targets = [
    { key: 'users', path: 'users' },
    { key: 'complaints', path: 'complaints' },
    { key: 'clients', path: 'clients' },
    { key: 'chatGroups', path: 'chat_groups' },
    { key: 'chatMessages', path: 'chat_messages' },
    { key: 'notifications', path: 'notifications' },
    { key: 'monitorTargets', path: 'monitor' },
    { key: 'ledgerSheets', path: 'ledger_sheets' }
  ];

  for (const t of targets) {
    try {
      if (onProgress) onProgress(t.key, -1); // Loading state
      const snap = await getDocs(collection(getDb(), t.path));
      const list = snap.docs.map(docSnap => ({ ...docSnap.data() as any, id: docSnap.id }));
      (result as any)[t.key] = list;
      if (onProgress) onProgress(t.key, list.length);
    } catch (e) {
      console.warn(`Extraction info: Unable to read Firestore collection [${t.path}]. Continuing compilation.`, e);
      if (onProgress) onProgress(t.key, 0);
    }
  }

  // Handle single doc configurations
  try {
    const configSnap = await getDocs(collection(getDb(), 'config'));
    const brandingDoc = configSnap.docs.find(d => d.id === 'branding');
    if (brandingDoc) {
      result.branding = brandingDoc.data();
    }
  } catch (e) {
    console.warn("Unable to fetch configuration doc:", e);
  }

  // Extract all billing month sheets, parse and flatten them to usersData for migration
  try {
    if (onProgress) onProgress('usersData', -1);
    const { data: bData, error } = await defaultSupabase
      .from('branding_config')
      .select('*');

    if (!error && bData) {
      bData.forEach(item => {
        if (item.id.startsWith('billing_month_')) {
          try {
            const parsedRows = JSON.parse(item.dashboard_subtext || '[]');
            const displayId = item.id.replace('billing_month_', '');
            const dealerId = item.id.includes('billing_month_') && item.id.split('_').length > 3 ? item.id.split('_')[2] : 'main';
            if (Array.isArray(parsedRows)) {
              parsedRows.forEach((r: any, idx: number) => {
                const uniqueId = `bm_${displayId}_${r.clientId || r.username || idx}`;
                result.usersData.push({
                  id: uniqueId,
                  month_id: displayId,
                  client_id: r.clientId || null,
                  name: r.name || null,
                  username: r.username || null,
                  mobile_number: r.mobileNumber || null,
                  area: r.area || null,
                  rt: r.rt || null,
                  base_amount: Number(r.baseAmount) || 0,
                  cr: Number(r.cr) || 0,
                  total_amount: Number(r.totalAmount) || 0,
                  billing_day: r.billingDay || '5',
                  payment_received: Number(r.paymentReceived) || 0,
                  payment_status: r.paymentStatus || 'unpaid',
                  comments: r.comments || null,
                  occ: r.occ || null,
                  ser_nam: r.serNam || null,
                  pkg_details: r.pkgDetails || null,
                  sag: r.sag || null,
                  lai: r.lai || null,
                  connection_date: r.connectionDate || null,
                  device_price: r.devicePrice || null,
                  abl: r.abl || null,
                  network: r.network || null,
                  dealer_id: dealerId,
                  updated_at: item.updated_at || Date.now()
                });
              });
            }
          } catch (e) {
            console.warn("Error parsing billing month for migration:", e);
          }
        }
      });
    }
    if (onProgress) onProgress('usersData', result.usersData.length);
  } catch (e) {
    console.warn("Unable to fetch billing months for migration flattening:", e);
    if (onProgress) onProgress('usersData', 0);
  }

  return result;
}

/**
 * High-speed Live Direct Migrator over supabase REST endpoint or supabase-js
 */
export async function pushCollectionsToSupabase(
  client: ReturnType<typeof createClient>,
  data: any,
  onStatusUpdate: (msg: string, status: 'info' | 'success' | 'error') => void
) {
  const mapTableData = [
    { key: 'users', table: 'users' },
    { key: 'complaints', table: 'complaints' },
    { key: 'clients', table: 'clients' },
    { key: 'chatGroups', table: 'chat_groups' },
    { key: 'chatMessages', table: 'chat_messages' },
    { key: 'notifications', table: 'notifications' },
    { key: 'monitorTargets', table: 'monitor_targets' },
    { key: 'ledgerSheets', table: 'ledger_sheets' },
    { key: 'usersData', table: 'users_data' }
  ];

  for (const item of mapTableData) {
    const rows = data[item.key] || [];
    if (rows.length === 0) {
      onStatusUpdate(`Collection '${item.key}' is empty. Skipping live row push.`, 'info');
      continue;
    }

    onStatusUpdate(`Pulsing collection '${item.key}' (${rows.length} records) straight into Supabase table '${item.table}'...`, 'info');

    // Filter and sanitize keys
    const sanitizedRows = rows.map((r: any) => {
      const copy = { ...r };
      
      // Map properties matching DB structure
      if (item.key === 'users') {
        copy.full_name = copy.fullName || null;
        copy.created_at = copy.createdAt || null;
        copy.last_active = copy.lastActive || null;
        copy.dealer_id = copy.dealerId || null;
        copy.line_code = copy.lineCode || null;
        copy.created_by = copy.createdBy || null;
        copy.created_by_name = copy.createdByName || null;
        copy.company_name = copy.companyName || null;
        copy.profile_picture = copy.profilePicture || null;
      }
      if (item.key === 'complaints') {
        copy.member_id = copy.memberId || null;
        copy.member_name = copy.memberName || null;
        copy.customer_name = copy.customerName || null;
        copy.customer_username = copy.customerUsername || null;
        copy.phone_number = copy.number || null;
        copy.pkg_details = copy.pkgDetails || null;
        copy.user_nearby = copy.userNearby || null;
        copy.panel_details = copy.panelDetails || null;
        copy.created_at = copy.createdAt || null;
        copy.updated_at = copy.updatedAt || null;
        copy.remark_author_id = copy.remarkAuthorId || null;
        copy.remark_author_name = copy.remarkAuthorName || null;
        copy.customer_review = copy.customerReview || null;
        copy.dealer_id = copy.dealerId || null;
      }
      if (item.key === 'clients') {
        copy.mobile_number = copy.mobileNumber || null;
        copy.series_number = copy.seriesNumber || null;
        copy.pkg_details = copy.pkgDetails || null;
        copy.user_nearby = copy.userNearby || null;
        copy.panel_details = copy.panelDetails || null;
        copy.created_by = copy.createdBy || null;
        copy.created_at = copy.createdAt || null;
        copy.dealer_id = copy.dealerId || null;
      }
      if (item.key === 'chatGroups') {
        copy.created_by = copy.createdBy || null;
        copy.created_at = copy.createdAt || null;
        copy.dealer_id = copy.dealerId || null;
      }
      if (item.key === 'chatMessages') {
        copy.sender_id = copy.senderId || null;
        copy.sender_name = copy.senderName || null;
        copy.audio_url = copy.audioUrl || null;
        copy.recipient_id = copy.recipientId || null;
        copy.is_group = copy.isGroup || false;
        copy.reply_to = copy.replyTo || null;
        copy.created_at = copy.createdAt || null;
        copy.seen_by = copy.seenBy || null;
        copy.dealer_id = copy.dealerId || null;
      }
      if (item.key === 'notifications') {
        copy.author_name = copy.authorName || null;
        copy.created_at = copy.createdAt || null;
        copy.is_read = copy.isRead || false;
        copy.dealer_id = copy.dealerId || null;
      }
      if (item.key === 'monitorTargets') {
        copy.created_by = copy.createdBy || null;
        copy.created_at = copy.createdAt || null;
        copy.dealer_id = copy.dealerId || null;
      }
      if (item.key === 'ledgerSheets') {
        copy.rec_officer = copy.recOfficer || null;
        copy.rec_officer_label = copy.recOfficerLabel || null;
        copy.area_label = copy.areaLabel || null;
        copy.sheet_date = copy.sheetDate || null;
        copy.date_label = copy.dateLabel || null;
        copy.table1_rows = copy.table1Rows || [];
        copy.table2_rows = copy.table2Rows || [];
        copy.cash_received = copy.cashReceived || null;
        copy.submitted = copy.submitted || null;
        copy.cash_received_label = copy.cashReceivedLabel || null;
        copy.sign_label = copy.signLabel || null;
        copy.submitted_label = copy.submittedLabel || null;
        copy.footnote_left = copy.footnoteLeft || null;
        copy.footnote_right = copy.footnoteRight || null;
        copy.dealer_id = copy.dealerId || null;
        copy.created_at = copy.createdAt || null;
      }

      // Drop original nested fields to avoid mismatch
      delete copy.fullName;
      delete copy.createdAt;
      delete copy.lastActive;
      delete copy.dealerId;
      delete copy.lineCode;
      delete copy.createdBy;
      delete copy.createdByName;
      delete copy.companyName;
      delete copy.profilePicture;
      delete copy.memberId;
      delete copy.memberName;
      delete copy.customerName;
      delete copy.customerUsername;
      delete copy.number;
      delete copy.pkgDetails;
      delete copy.userNearby;
      delete copy.panelDetails;
      delete copy.updatedAt;
      delete copy.remarkAuthorId;
      delete copy.remarkAuthorName;
      delete copy.customerReview;
      delete copy.mobileNumber;
      delete copy.seriesNumber;
      delete copy.senderId;
      delete copy.senderName;
      delete copy.audioUrl;
      delete copy.recipientId;
      delete copy.isGroup;
      delete copy.replyTo;
      delete copy.seenBy;
      delete copy.authorName;
      delete copy.isRead;
      delete copy.recOfficer;
      delete copy.recOfficerLabel;
      delete copy.areaLabel;
      delete copy.sheetDate;
      delete copy.dateLabel;
      delete copy.table1Rows;
      delete copy.table2Rows;
      delete copy.cashReceived;
      delete copy.cashReceivedLabel;
      delete copy.signLabel;
      delete copy.submittedLabel;
      delete copy.footnoteLeft;
      delete copy.footnoteRight;
      
      return copy;
    });

    // Write to Supabase using upsert
    const chunkArray = (arr: any[], size: number) => {
      const resp = [];
      for (let i = 0; i < arr.length; i += size) {
        resp.push(arr.slice(i, i + size));
      }
      return resp;
    };

    const batches = chunkArray(sanitizedRows, 50);
    let successCount = 0;
    
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      const { error } = await client
        .from(item.table)
        .upsert(batch, { onConflict: (item.key === 'users') ? 'uid' : 'id' });

      if (error) {
        onStatusUpdate(`❌ Error pushing batch ${index+1}/${batches.length} of ${item.table}: ${error.message} - Code: ${error.code}`, 'error');
      } else {
        successCount += batch.length;
      }
    }

    if (successCount > 0) {
      onStatusUpdate(`✅ Successfully populated ${successCount} entries into Supabase public.${item.table}!`, 'success');
    }
  }

  // Push branding single row
  if (data.branding) {
    onStatusUpdate(`Pulsing branding config into Supabase...`, 'info');
    const b = data.branding;
    const bPayload = {
      id: 'branding',
      project_name: b.projectName || 'GreenTech WiFi Complain Management',
      accent_color: b.accentColor || '#3b82f6',
      secondary_color: b.secondaryColor || '#1e293b',
      theme_color: b.themeColor || '#1e293b',
      font_family: b.fontFamily || 'Inter',
      border_radius: b.borderRadius || 'lg',
      card_style: b.cardStyle || 'bordered',
      glass_opacity: b.glassOpacity || 0.2,
      enable_animations: b.enableAnimations !== false,
      logo_url: b.logoUrl || '',
      sidebar_theme: b.sidebarTheme || 'dark',
      mascot_pos: b.mascotPos || { x: 0, y: 0 },
      hide_bot: b.hideBot || false,
      chat_welcome_msg: b.chatWelcomeMsg || '',
      dashboard_subtext: b.dashboardSubtext || '',
      updated_at: b.updatedAt || Date.now(),
      updated_by: b.updatedBy || 'admin'
    };

    const { error } = await client
      .from('branding_config')
      .upsert(bPayload as any, { onConflict: 'id' });

    if (error) {
      onStatusUpdate(`❌ Error updating branding_config: ${error.message}`, 'error');
    } else {
      onStatusUpdate(`🎉 Supabase database live migration complete!`, 'success');
    }
  }
}
