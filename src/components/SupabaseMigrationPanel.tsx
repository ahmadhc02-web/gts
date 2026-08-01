import React, { useState, useEffect } from 'react';
import { supabase, saveCustomSupabaseConfig, clearCustomSupabaseConfig } from '../lib/supabase';
const pb: any = null;
import { 
  Database, Play, CheckCircle, AlertCircle, Copy, Check, Info, RefreshCw, 
  HelpCircle, Server, FileText, ChevronRight, Layers, ArrowRightLeft, Terminal
} from 'lucide-react';

interface MigrationStatus {
  tableName: string;
  pbCount: number;
  status: 'idle' | 'loading' | 'migrating' | 'success' | 'error';
  progress: number;
  error?: string;
}

export default function SupabaseMigrationPanel() {
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isMigratingAll, setIsMigratingAll] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Custom connection settings state
  const [configUrl, setConfigUrl] = useState(() => localStorage.getItem('gts_custom_supabase_url') || '');
  const [configKey, setConfigKey] = useState(() => localStorage.getItem('gts_custom_supabase_anon_key') || '');
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);

  const [statuses, setStatuses] = useState<MigrationStatus[]>([
    { tableName: 'users', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'complaints', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'clients', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'chat_groups', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'chat_messages', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'notifications', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'monitor_targets', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'ledger_sheets', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'ledger_folders', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'branding_config', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'billing_months', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'billing_rows', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'categories_config', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'statuses_config', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'priority_config', pbCount: 0, status: 'idle', progress: 0 },
    { tableName: 'zone_config', pbCount: 0, status: 'idle', progress: 0 },
  ]);

  // SQL Schema to run in Supabase SQL Editor
  const schemaSQL = `-- SUPABASE TABLE SCHEMAS FOR GTS ISP MANAGEMENT SYSTEM
-- Copy and run this script in your Supabase SQL Editor inside your Hetzner-linked Supabase Dashboard.

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  dealer_id TEXT,
  line_code TEXT,
  created_by TEXT,
  created_by_name TEXT,
  company_name TEXT,
  status TEXT,
  profile_picture TEXT,
  email TEXT
);

-- 2. Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  complaint_id TEXT PRIMARY KEY,
  member_id TEXT,
  member_name TEXT,
  customer_name TEXT,
  customer_username TEXT,
  area TEXT,
  description TEXT,
  phone_number TEXT,
  status TEXT,
  category TEXT,
  priority TEXT,
  pkg_details TEXT,
  user_nearby TEXT,
  panel_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  remarks TEXT,
  remark_author_id TEXT,
  remark_author_name TEXT,
  customer_review TEXT,
  dealer_id TEXT,
  scheduled_at TEXT
);

-- 3. Clients table
CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  name TEXT,
  username TEXT,
  number TEXT,
  mobile_number TEXT,
  series_number TEXT,
  area TEXT,
  pkg_details TEXT,
  user_nearby TEXT,
  panel_details TEXT,
  rt TEXT,
  base_amount NUMERIC DEFAULT 0,
  billing_day TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dealer_id TEXT,
  lat TEXT,
  lng TEXT
);

-- 4. Chat Groups
CREATE TABLE IF NOT EXISTS chat_groups (
  group_id TEXT PRIMARY KEY,
  name TEXT,
  members JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dealer_id TEXT
);

-- 5. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  text TEXT,
  audio_url TEXT,
  type TEXT,
  recipient_id TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  duration NUMERIC,
  reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  seen_by JSONB,
  dealer_id TEXT
);

-- 6. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  type TEXT,
  message TEXT,
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  dealer_id TEXT,
  details JSONB
);

-- 7. Monitor Targets
CREATE TABLE IF NOT EXISTS monitor_targets (
  target_id TEXT PRIMARY KEY,
  domain TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dealer_id TEXT,
  lat TEXT,
  lng TEXT,
  label TEXT
);

-- 8. Ledger Sheets
CREATE TABLE IF NOT EXISTS ledger_sheets (
  id TEXT PRIMARY KEY,
  rec_officer TEXT,
  rec_officer_label TEXT,
  area TEXT,
  area_label TEXT,
  sheet_date TEXT,
  date_label TEXT,
  table1_rows JSONB,
  table2_rows JSONB,
  cash_received NUMERIC DEFAULT 0,
  sign TEXT,
  submitted BOOLEAN DEFAULT FALSE,
  cash_received_label TEXT,
  sign_label TEXT,
  submitted_label TEXT,
  footnote_left TEXT,
  footnote_right TEXT,
  dealer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  folder_id TEXT,
  sort TEXT,
  sheet_subtext TEXT
);

-- 8b. Ledger Folders
CREATE TABLE IF NOT EXISTS ledger_folders (
  id TEXT PRIMARY KEY,
  name TEXT,
  parent_id TEXT,
  tenant_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Branding Config
CREATE TABLE IF NOT EXISTS branding_config (
  config_type TEXT PRIMARY KEY,
  project_name TEXT,
  accent_color TEXT,
  secondary_color TEXT,
  theme_color TEXT,
  font_family TEXT,
  border_radius TEXT,
  card_style TEXT,
  glass_opacity TEXT,
  enable_animations BOOLEAN DEFAULT TRUE,
  logo_url TEXT,
  sidebar_theme TEXT,
  mascot_pos TEXT,
  hide_bot BOOLEAN DEFAULT FALSE,
  chat_welcome_msg TEXT,
  dashboard_subtext TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- 10. Billing Months
CREATE TABLE IF NOT EXISTS billing_months (
  month_id TEXT PRIMARY KEY,
  dealer_id TEXT,
  rows_data JSONB,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Billing Rows
CREATE TABLE IF NOT EXISTS billing_rows (
  id TEXT PRIMARY KEY,
  month_id TEXT,
  client_id TEXT,
  name TEXT,
  username TEXT,
  mobile_number TEXT,
  area TEXT,
  rt TEXT,
  base_amount NUMERIC DEFAULT 0,
  cr NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  billing_day TEXT,
  payment_received NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  comments TEXT,
  occ TEXT,
  ser_nam TEXT,
  pkg_details TEXT,
  sag TEXT,
  lai TEXT,
  connection_date TEXT,
  device_price TEXT,
  abl TEXT,
  network TEXT,
  dealer_id TEXT
);

-- 12. Categories Config
CREATE TABLE IF NOT EXISTS categories_config (
  id BIGSERIAL PRIMARY KEY,
  category TEXT,
  category_name TEXT,
  name TEXT,
  value TEXT,
  title TEXT,
  label TEXT,
  config_type TEXT,
  tenant_id TEXT DEFAULT 'main'
);

-- 13. Statuses Config
CREATE TABLE IF NOT EXISTS statuses_config (
  id BIGSERIAL PRIMARY KEY,
  status TEXT,
  status_name TEXT,
  name TEXT,
  value TEXT,
  title TEXT,
  label TEXT,
  config_type TEXT,
  tenant_id TEXT DEFAULT 'main'
);

-- 14. Priority Config
CREATE TABLE IF NOT EXISTS priority_config (
  id BIGSERIAL PRIMARY KEY,
  priority TEXT,
  priority_name TEXT,
  name TEXT,
  value TEXT,
  title TEXT,
  label TEXT,
  config_type TEXT,
  tenant_id TEXT DEFAULT 'main'
);

-- 15. Zone Config
CREATE TABLE IF NOT EXISTS zone_config (
  id BIGSERIAL PRIMARY KEY,
  zone TEXT,
  zone_name TEXT,
  name TEXT,
  value TEXT,
  title TEXT,
  label TEXT,
  config_type TEXT,
  tenant_id TEXT DEFAULT 'main'
);
`;

  useEffect(() => {
    // 1. Check Supabase connection
    const checkSupabase = async () => {
      try {
        const url = localStorage.getItem('gts_custom_supabase_url') || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';
        setSupabaseUrl(url);

        if (!supabase) {
          setSupabaseConnected(false);
          setErrorDetails('Supabase client is not initialized. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env configuration, or enter custom details below.');
          return;
        }

        // Test request to check if Supabase can be contacted
        const { error } = await supabase.from('users').select('uid').limit(1);
        if (error && error.code === 'PGRST116') {
          // Table users exists but is empty, which means connection is working!
          setSupabaseConnected(true);
          setErrorDetails('');
        } else if (error && error.message.includes('relation "users" does not exist')) {
          // Connected to Supabase, but schema hasn't been created yet.
          setSupabaseConnected(true);
          setErrorDetails('⚠️ Connected to Supabase! However, the tables do not exist in Supabase yet. Please copy and run the SQL Schema script below in your Supabase SQL Editor.');
        } else if (error) {
          setSupabaseConnected(false);
          setErrorDetails(`Supabase returned an error: ${error.message} (Code: ${error.code})`);
        } else {
          setSupabaseConnected(true);
          setErrorDetails('');
        }
      } catch (err: any) {
        setSupabaseConnected(false);
        setErrorDetails(`Failed to reach Supabase API: ${err?.message || err}`);
      }
    };

    // 2. Fetch record counts directly from Supabase
    const fetchCounts = async () => {
      if (!supabase) return;
      const updated = [...statuses];
      for (let i = 0; i < updated.length; i++) {
        const item = updated[i];
        try {
          const { count, error } = await supabase.from(item.tableName).select('*', { count: 'exact', head: true });
          if (!error && typeof count === 'number') {
            item.pbCount = count;
          } else {
            item.pbCount = 0;
          }
          item.status = 'idle';
        } catch (err) {
          item.pbCount = 0;
        }
      }
      setStatuses(updated);
    };

    checkSupabase();
    fetchCounts();
  }, []);

  const handleSaveConfig = () => {
    saveCustomSupabaseConfig(configUrl, configKey);
    setIsSavedSuccessfully(true);
    setTimeout(() => {
      setIsSavedSuccessfully(false);
      window.location.reload();
    }, 1500);
  };

  const handleClearConfig = () => {
    clearCustomSupabaseConfig();
    setConfigUrl('');
    setConfigKey('');
    setIsSavedSuccessfully(true);
    setTimeout(() => {
      setIsSavedSuccessfully(false);
      window.location.reload();
    }, 1500);
  };

  const copySchema = () => {
    navigator.clipboard.writeText(schemaSQL);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const addLog = (message: string) => {
    setLogMessages(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 99)]);
  };

  // Helper mapping function to safely format JSON properties
  const formatValueForSupabase = (val: any) => {
    if (val === undefined) return null;
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val);
    }
    return val;
  };

  const runMigration = async () => {
    if (!supabaseConnected || !supabase) {
      alert("Cannot start migration: Supabase connection is not verified yet.");
      return;
    }

    if (isMigratingAll) return;

    setIsMigratingAll(true);
    setOverallProgress(0);
    setLogMessages([]);
    addLog("🚀 Starting complete database synchronization to Supabase...");

    const updatedStatuses = statuses.map(s => ({ ...s, status: 'idle' as const, progress: 0, error: undefined }));
    setStatuses(updatedStatuses);

    let completedTables = 0;

    for (let idx = 0; idx < updatedStatuses.length; idx++) {
      const tableStatus = updatedStatuses[idx];
      tableStatus.status = 'migrating';
      setStatuses([...updatedStatuses]);
      addLog(`Syncing collection: "${tableStatus.tableName}"...`);

      try {
        // 1. Fetch all records
        addLog(`Fetching all records for "${tableStatus.tableName}"...`);
        const records = await pb.collection(tableStatus.tableName).getFullList({ requestKey: null });
        tableStatus.pbCount = records.length;
        
        if (records.length === 0) {
          tableStatus.status = 'success';
          tableStatus.progress = 100;
          setStatuses([...updatedStatuses]);
          addLog(`ℹ️ Table "${tableStatus.tableName}" has 0 records. Skipping.`);
          completedTables++;
          setOverallProgress(Math.round((completedTables / updatedStatuses.length) * 100));
          continue;
        }

        addLog(`Found ${records.length} records. Beginning upload to Supabase...`);

        // 2. Map row fields according to column styles (some use JSON strings, etc.)
        const mappedRecords = records.map(r => {
          const row: Record<string, any> = {};
          
          // Map properties based on typical table columns
          if (tableStatus.tableName === 'users') {
            row.uid = r.uid || r.id;
            row.username = r.username;
            row.password = r.password;
            row.role = r.role || 'dealer';
            row.full_name = r.full_name || r.fullName;
            row.created_at = r.created_at || r.created;
            row.last_active = r.last_active;
            row.dealer_id = r.dealer_id || r.dealerId;
            row.line_code = r.line_code || r.lineCode;
            row.created_by = r.created_by || r.createdBy;
            row.created_by_name = r.created_by_name || r.createdByName;
            row.company_name = r.company_name || r.companyName;
            row.status = r.status || 'active';
            row.profile_picture = r.profile_picture || r.profilePicture;
            row.email = r.email;
          } else if (tableStatus.tableName === 'complaints') {
            row.complaint_id = r.complaint_id || r.id;
            row.member_id = r.member_id || r.memberId;
            row.member_name = r.member_name || r.memberName;
            row.customer_name = r.customer_name || r.customerName;
            row.customer_username = r.customer_username || r.customerUsername;
            row.area = r.area;
            row.description = r.description;
            row.phone_number = r.phone_number || r.number;
            row.status = r.status;
            row.category = r.category;
            row.priority = r.priority;
            row.pkg_details = r.pkg_details || r.pkgDetails;
            row.user_nearby = r.user_nearby || r.userNearby;
            row.panel_details = r.panel_details || r.panelDetails;
            row.created_at = r.created_at || r.created;
            row.updated_at = r.updated_at || r.updated;
            row.remarks = r.remarks;
            row.remark_author_id = r.remark_author_id || r.remarkAuthorId;
            row.remark_author_name = r.remark_author_name || r.remarkAuthorName;
            row.customer_review = formatValueForSupabase(r.customer_review || r.reviews);
            row.dealer_id = r.dealer_id || r.dealerId;
            row.scheduled_at = r.scheduled_at;
          } else if (tableStatus.tableName === 'clients') {
            row.client_id = r.client_id || r.id;
            row.name = r.name;
            row.username = r.username;
            row.number = r.number;
            row.mobile_number = r.mobile_number || r.mobileNumber;
            row.series_number = r.series_number || r.seriesNumber;
            row.area = r.area;
            row.pkg_details = r.pkg_details || r.pkgDetails;
            row.user_nearby = r.user_nearby || r.userNearby;
            row.panel_details = r.panel_details || r.panelDetails;
            row.rt = r.rt;
            row.base_amount = Number(r.base_amount || r.baseAmount || 0);
            row.billing_day = r.billing_day || r.billingDay;
            row.created_by = r.created_by || r.createdBy;
            row.created_at = r.created_at || r.created;
            row.dealer_id = r.dealer_id || r.dealerId;
            row.lat = r.lat;
            row.lng = r.lng;
          } else if (tableStatus.tableName === 'chat_groups') {
            row.group_id = r.group_id || r.id;
            row.name = r.name;
            row.members = formatValueForSupabase(r.members);
            row.created_by = r.created_by || r.createdBy;
            row.created_at = r.created_at || r.created;
            row.dealer_id = r.dealer_id || r.dealerId;
          } else if (tableStatus.tableName === 'chat_messages') {
            row.message_id = r.message_id || r.id;
            row.sender_id = r.sender_id || r.senderId;
            row.sender_name = r.sender_name || r.senderName;
            row.text = r.text;
            row.audio_url = r.audio_url || r.audioUrl;
            row.type = r.type;
            row.recipient_id = r.recipient_id || r.recipientId;
            row.is_group = Boolean(r.is_group || r.isGroup);
            row.duration = Number(r.duration || 0);
            row.reply_to = r.reply_to || r.replyTo;
            row.created_at = r.created_at || r.created;
            row.seen_by = formatValueForSupabase(r.seen_by || r.seenBy);
            row.dealer_id = r.dealer_id || r.dealerId;
          } else if (tableStatus.tableName === 'notifications') {
            row.notification_id = r.notification_id || r.id;
            row.type = r.type;
            row.message = r.message;
            row.author_name = r.author_name || r.authorName;
            row.created_at = r.created_at || r.created;
            row.is_read = Boolean(r.is_read || r.isRead);
            row.dealer_id = r.dealer_id || r.dealerId;
            row.details = formatValueForSupabase(r.details);
          } else if (tableStatus.tableName === 'monitor_targets') {
            row.target_id = r.target_id || r.id;
            row.domain = r.domain;
            row.created_by = r.created_by || r.createdBy;
            row.created_at = r.created_at || r.created;
            row.dealer_id = r.dealer_id || r.dealerId;
            row.lat = r.lat;
            row.lng = r.lng;
            row.label = r.label;
          } else if (tableStatus.tableName === 'ledger_sheets') {
            row.id = r.id || r.sheet_id;
            row.rec_officer = r.rec_officer || r.recOfficer;
            row.rec_officer_label = r.rec_officer_label || r.recOfficerLabel;
            row.area = r.area;
            row.area_label = r.area_label || r.areaLabel;
            row.sheet_date = r.sheet_date || r.sheetDate;
            row.date_label = r.date_label || r.dateLabel;
            row.table1_rows = formatValueForSupabase(r.table1_rows || r.table1Rows);
            row.table2_rows = formatValueForSupabase(r.table2_rows || r.table2Rows);
            row.cash_received = Number(r.cash_received || r.cashReceived || 0);
            row.sign = r.sign;
            row.submitted = Boolean(r.submitted);
            row.cash_received_label = r.cash_received_label || r.cashReceivedLabel;
            row.sign_label = r.sign_label || r.signLabel;
            row.submitted_label = r.submitted_label || r.submittedLabel;
            row.footnote_left = r.footnote_left || r.footnoteLeft;
            row.footnote_right = r.footnote_right || r.footnoteRight;
            row.dealer_id = r.dealer_id || r.dealerId;
            row.created_at = r.created_at || r.created;
            row.folder_id = r.folder_id || r.folderId || 'folder_june';
            row.sort = r.sort || r.sortFolder || 'June';
          } else if (tableStatus.tableName === 'branding_config') {
            row.config_type = r.config_type || r.id;
            row.project_name = r.project_name || r.projectName;
            row.accent_color = r.accent_color || r.accentColor;
            row.secondary_color = r.secondary_color || r.secondaryColor;
            row.theme_color = r.theme_color || r.themeColor;
            row.font_family = r.font_family || r.fontFamily;
            row.border_radius = r.border_radius || r.borderRadius;
            row.card_style = r.card_style || r.cardStyle;
            row.glass_opacity = r.glass_opacity || r.glassOpacity;
            row.enable_animations = Boolean(r.enable_animations !== undefined ? r.enable_animations : r.enableAnimations);
            row.logo_url = r.logo_url || r.logoUrl;
            row.sidebar_theme = r.sidebar_theme || r.sidebarTheme;
            row.mascot_pos = r.mascot_pos || r.mascotPos;
            row.hide_bot = Boolean(r.hide_bot !== undefined ? r.hide_bot : r.hideBot);
            row.chat_welcome_msg = r.chat_welcome_msg || r.chatWelcomeMsg;
            row.dashboard_subtext = r.dashboard_subtext || r.dashboardSubtext;
            row.updated_at = r.updated_at || r.updated;
            row.updated_by = r.updated_by || r.updatedBy;
          } else if (tableStatus.tableName === 'billing_months') {
            row.id = r.id;
            row.name = r.name;
            row.created_at = r.created_at || r.created;
            row.dealer_id = r.dealer_id || r.dealerId;
          } else if (tableStatus.tableName === 'ledger_folders') {
            row.id = String(r.id || '');
            row.name = String(r.name || '');
            row.parent_id = String(r.parentId || r.parent_id || '');
            row.tenant_id = String(r.tenantId || r.tenant_id || 'main');
            row.created_at = r.createdAt || r.created_at || r.created;
          } else if (tableStatus.tableName === 'billing_rows') {
            row.id = r.id;
            row.month_id = r.month_id;
            row.client_id = r.client_id;
            row.name = r.name;
            row.username = r.username;
            row.mobile_number = r.mobile_number || r.mobileNumber;
            row.area = r.area;
            row.rt = r.rt;
            row.base_amount = Number(r.base_amount || 0);
            row.cr = Number(r.cr || 0);
            row.total_amount = Number(r.total_amount || 0);
            row.billing_day = r.billing_day;
            row.payment_received = Number(r.payment_received || 0);
            row.payment_status = r.payment_status;
            row.comments = r.comments;
            row.occ = r.occ;
            row.ser_nam = r.ser_nam;
            row.pkg_details = r.pkg_details;
            row.sag = r.sag;
            row.lai = r.lai;
            row.connection_date = r.connection_date;
            row.device_price = r.device_price;
            row.abl = r.abl;
            row.network = r.network;
            row.dealer_id = r.dealer_id;
          } else if (tableStatus.tableName === 'categories_config') {
            row.category = r.category || r.value || '';
            row.category_name = r.category_name || r.name || '';
            row.name = r.name || r.value || '';
            row.value = r.value || '';
            row.title = r.title || '';
            row.label = r.label || '';
            row.config_type = r.config_type || '';
            row.tenant_id = r.tenant_id || 'main';
          } else if (tableStatus.tableName === 'statuses_config') {
            row.status = r.status || r.value || '';
            row.status_name = r.status_name || r.name || '';
            row.name = r.name || r.value || '';
            row.value = r.value || '';
            row.title = r.title || '';
            row.label = r.label || '';
            row.config_type = r.config_type || '';
            row.tenant_id = r.tenant_id || 'main';
          } else if (tableStatus.tableName === 'priority_config') {
            row.priority = r.priority || r.value || '';
            row.priority_name = r.priority_name || r.name || '';
            row.name = r.name || r.value || '';
            row.value = r.value || '';
            row.title = r.title || '';
            row.label = r.label || '';
            row.config_type = r.config_type || '';
            row.tenant_id = r.tenant_id || 'main';
          } else if (tableStatus.tableName === 'zone_config') {
            row.zone = r.zone || r.value || '';
            row.zone_name = r.zone_name || r.name || '';
            row.name = r.name || r.value || '';
            row.value = r.value || '';
            row.title = r.title || '';
            row.label = r.label || '';
            row.config_type = r.config_type || '';
            row.tenant_id = r.tenant_id || 'main';
          }

          // Strip any fields that are empty strings but should be JSON or standard null values
          Object.keys(row).forEach(key => {
            if (row[key] === undefined) {
              row[key] = null;
            }
          });

          return row;
        });

        // 3. Batch upsert records to Supabase (limit batch size to avoid payload constraints)
        const batchSize = 100;
        let successfulInserts = 0;

        for (let k = 0; k < mappedRecords.length; k += batchSize) {
          const batch = mappedRecords.slice(k, k + batchSize);
          
          addLog(`Upserting batch ${Math.floor(k/batchSize) + 1} (${batch.length} rows) into Supabase "${tableStatus.tableName}"...`);
          
          const { error } = await supabase
            .from(tableStatus.tableName)
            .upsert(batch);

          if (error) {
            throw new Error(`Supabase upsert failure: ${error.message} (Code: ${error.code})`);
          }

          successfulInserts += batch.length;
          tableStatus.progress = Math.round((successfulInserts / mappedRecords.length) * 100);
          setStatuses([...updatedStatuses]);
        }

        tableStatus.status = 'success';
        tableStatus.progress = 100;
        setStatuses([...updatedStatuses]);
        addLog(`✅ Sync completed for "${tableStatus.tableName}". Saved ${mappedRecords.length} records.`);
        completedTables++;

      } catch (err: any) {
        tableStatus.status = 'error';
        tableStatus.error = err?.message || 'Unknown migration error';
        setStatuses([...updatedStatuses]);
        addLog(`❌ Sync failed for "${tableStatus.tableName}": ${err?.message || err}`);
      }

      setOverallProgress(Math.round((completedTables / updatedStatuses.length) * 100));
    }

    setIsMigratingAll(false);
    addLog("🏁 Migration process concluded! Please review table logs above.");
  };

  return (
    <div id="supabase-migration-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm text-left max-w-5xl mx-auto space-y-8">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-150 dark:border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <ArrowRightLeft size={24} />
            </span>
            <h2 className="text-xl font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Supabase Database & Connection Control Hub
            </h2>
          </div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Securely shift records to your custom Supabase DB hosted on Hetzner or cloud server limits.
          </p>
        </div>

        {/* Supabase Connection Status Badge */}
        <div className="flex flex-col items-start md:items-end gap-1.5">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-black uppercase tracking-widest ${
            supabaseConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
          }`}>
            <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {supabaseConnected ? 'Supabase Online' : 'Supabase Offline'}
          </div>
          {supabaseUrl && (
            <span className="text-[10px] font-mono text-slate-400 max-w-xs truncate" title={supabaseUrl}>
              Host URL: {supabaseUrl}
            </span>
          )}
        </div>
      </div>

      {/* Hetzner Server & Supabase Connection Portal */}
      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
              <Server size={16} />
            </span>
            <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Hetzner Server & Supabase Configuration Portal
            </h3>
          </div>
          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
            Self-Hosted Override
          </span>
        </div>

        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider">
          Link this application directly to your self-hosted Supabase instance (e.g., on Hetzner Cloud at <code className="text-blue-500 font-bold">167.233.41.7</code>) so that all operations bypass general cloud thresholds.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              SUPABASE URL (HETZNER PORTAL HOST)
            </label>
            <input
              type="text"
              value={configUrl}
              onChange={(e) => setConfigUrl(e.target.value)}
              placeholder="e.g. https://167.233.41.7.sslip.io"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              SUPABASE ANON KEY (PUBLIC CLIENT KEY)
            </label>
            <input
              type="password"
              value={configKey}
              onChange={(e) => setConfigKey(e.target.value)}
              placeholder="Enter your generated public/anon key..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-150 dark:border-white/5">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Info size={12} className="text-blue-500 shrink-0" />
            <span>Saves locally to your browser. Saving will refresh the page to apply connection keys.</span>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {localStorage.getItem('gts_custom_supabase_url') && (
              <button
                type="button"
                onClick={handleClearConfig}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl transition-all cursor-pointer"
              >
                Clear Custom Link
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSavedSuccessfully}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white rounded-xl transition-all cursor-pointer ${
                isSavedSuccessfully 
                  ? 'bg-emerald-500' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20'
              }`}
            >
              {isSavedSuccessfully ? 'Successfully Configured!' : 'Save & Link Hetzner Server'}
            </button>
          </div>
        </div>
      </div>

      {/* Warnings & Help Desk */}
      {errorDetails && (
        <div className={`p-4 rounded-2xl border flex gap-3 ${
          supabaseConnected 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-200'
        }`}>
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <div className="text-[11px] leading-relaxed uppercase tracking-wider font-bold">
            <p>{errorDetails}</p>
          </div>
        </div>
      )}

      {/* Migration Action Flow (Hetzner Guide) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Step 1: SQL Schema Instructions (Left column) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Terminal size={16} />
              Step 1: Create Supabase Tables
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider">
              Because Supabase is a relational PostgreSQL database, you must configure the tables before we can insert any data. Copy the script below, head over to your Supabase SQL Editor, paste and run it.
            </p>

            {/* SQL Display Box */}
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
              <div className="flex justify-between items-center px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-mono font-bold text-slate-500">gts-schema.sql</span>
                <button
                  onClick={copySchema}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md cursor-pointer transition-all"
                >
                  {copiedText ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copiedText ? 'Copied' : 'Copy Script'}
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-300 font-mono text-[10px] h-[210px] overflow-y-auto leading-relaxed select-all whitespace-pre-wrap text-left">
                {schemaSQL}
              </pre>
            </div>
          </div>
        </div>

        {/* Step 2: Trigger & Synchronizer (Right column) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-white/5 rounded-2xl p-5 space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-3">
              <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Play size={16} />
                Step 2: Start Migration
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider">
                Once tables have been deployed to your Supabase instance, click the button below. The hub will test and confirm connection, verify table structures, and synchronize live database rows.
              </p>
              
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-500 text-[11px] font-black uppercase tracking-wider">
                  <Server size={14} />
                  Hosting Alignments
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed uppercase tracking-wider">
                  Data transferred to Supabase will naturally fall under Hetzner DB limits, providing robust performance, real-time connectivity, and enterprise-grade safety.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              {/* Progress Indicator */}
              {isMigratingAll && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-500">
                    <span>Overall Syncing Progress</span>
                    <span>{overallProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={runMigration}
                disabled={isMigratingAll || !supabaseConnected}
                className={`w-full py-4 text-[12px] font-black uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isMigratingAll 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : !supabaseConnected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-700'
                }`}
              >
                {isMigratingAll ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Syncing Database Files...
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    Begin Sync to Supabase
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Granular Table Checklist */}
      <div className="space-y-4">
        <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Layers size={16} />
          Operational Schemas Inventory ({statuses.length} tables)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statuses.map((tbl) => (
            <div 
              key={tbl.tableName}
              className="p-4 bg-slate-50 dark:bg-slate-950/25 border border-slate-150 dark:border-white/5 rounded-2xl flex flex-col justify-between space-y-3 hover:border-blue-500/20 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {tbl.tableName}
                </span>
                
                {tbl.status === 'success' && (
                  <span className="text-emerald-500 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle size={12} /> Sync complete
                  </span>
                )}
                {tbl.status === 'migrating' && (
                  <span className="text-blue-500 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
                    <RefreshCw className="animate-spin" size={12} /> Syncing
                  </span>
                )}
                {tbl.status === 'error' && (
                  <span className="text-rose-500 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest" title={tbl.error}>
                    <AlertCircle size={12} /> Error
                  </span>
                )}
                {tbl.status === 'idle' && (
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Ready
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Database Rows Count:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{tbl.pbCount}</span>
              </div>

              {/* Individual Progress Bar */}
              {tbl.status === 'migrating' && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${tbl.progress}%` }}
                    />
                  </div>
                  <div className="text-[9px] font-black text-blue-500 text-right uppercase tracking-widest">
                    {tbl.progress}%
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sync Console Outputs / Logs */}
      {logMessages.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Migration Execution Console Output
          </h4>
          <div className="p-4 bg-slate-950 text-slate-300 font-mono text-[10px] rounded-2xl h-[200px] overflow-y-auto space-y-1.5 shadow-inner border border-slate-900 text-left">
            {logMessages.map((log, i) => (
              <div 
                key={i} 
                className={`leading-relaxed whitespace-pre-wrap ${
                  log.includes('❌') ? 'text-rose-400' :
                  log.includes('✅') ? 'text-emerald-400' :
                  log.includes('🚀') ? 'text-blue-400 font-bold' :
                  'text-slate-300'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
