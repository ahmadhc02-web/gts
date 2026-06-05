import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Settings, Users, ClipboardList, Key, Shield, Trash2, FileSpreadsheet, ExternalLink, HardDriveDownload, Layers, ShieldAlert, CheckCircle, Ban, XCircle, X, Pencil, Check, Info, Copy, PlusSquare, CloudUpload, Zap, MapPin, Bell, Contact, MapPinned, Volume2, VolumeX, LogOut, Clock, TrendingUp, BarChart3, Mic, Activity, MessageSquare, Flame, Palette, AlertTriangle, Globe, Printer, Coins, Percent, ArrowUpRight, Wallet, CreditCard } from 'lucide-react';
import { Complaint, ComplaintStatus, UserProfile, ComplaintPriority, ComplaintCategory, BrandingConfig } from '../types';
import ComplaintList from './ComplaintList';
import ComplaintForm from './ComplaintForm';
import ClientManagement from './ClientManagement';
import RealTimeMonitor from './RealTimeMonitor';
import DistributionList from './DistributionList';
import HighFrequencyNodes from './HighFrequencyNodes';
import EditorPanel from './EditorPanel';
import { googleSheetsService } from '../services/googleSheetsService';
import { firebaseService } from '../lib/firebaseService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { AppConfig } from '../constants';
import MicVisualizer from './MicVisualizer';
import { getCardStyle, getCleanErrorMessage } from '../lib/styleUtils';
import FiberLoading from './FiberLoading';
import EntrySheet from './EntrySheet';
import BatchPrintModal from './BatchPrintModal';
import GmailPanel from './GmailPanel';
import { extractFirebaseCollections, generateSupabaseMigrationSQL, pushCollectionsToSupabase, getSupabaseClient } from '../lib/supabaseService';

interface AdminPanelProps {
  complaints: Complaint[];
  users: UserProfile[];
  currentUser: UserProfile;
  onDeleteComplaint: (id: string) => Promise<void>;
  onUpdateComplaintStatus: (id: string, status: ComplaintStatus, remarks?: string, customerReview?: string) => Promise<void>;
  onUpdateRemarks: (id: string, remarks: string) => Promise<void>;
  onUpdateComplaint: (id: string, data: Partial<Complaint>) => Promise<void>;
  onCreateUser: (username: string, pass: string, role: UserProfile['role'], dealerId?: string, lineCode?: string, companyName?: string) => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
  onUpdateUser: (uid: string, username: string, pass: string, lineCode?: string, companyName?: string, fullName?: string, role?: UserProfile['role']) => Promise<void>;
  onRegisterComplaint: (data: {
    customerName: string;
    customerUsername: string;
    area: string;
    description: string;
    number: string;
    status: ComplaintStatus;
    category: ComplaintCategory;
    priority: ComplaintPriority;
    pkgDetails?: string;
    userNearby?: string;
  }) => Promise<void>;
  onChangeAdminPass: (newPass: string) => Promise<void>;
  appConfig: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  isLoading?: boolean;
  alertAuthorized: boolean;
  onAuthorizeAlerts: () => Promise<void>;
  onSoundTest: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  onLogout: () => void;
  micAuthorized: boolean;
  onAuthorizeMic: () => Promise<void>;
  isMicMuted: boolean;
  onToggleMic: () => void;
  onChatUser?: (uid: string) => void;
  branding: BrandingConfig;
  onUpdateBranding: (data: Partial<BrandingConfig>) => Promise<void>;
  onUpdateUserStatus: (uid: string, status: UserProfile['status']) => Promise<void>;
  activeTab?: string;
  onNavigate?: (id: string) => void;
}

export default function AdminPanel({
  complaints,
  users,
  currentUser,
  onDeleteComplaint,
  onUpdateComplaintStatus,
  onUpdateRemarks,
  onUpdateComplaint,
  onCreateUser,
  onDeleteUser,
  onUpdateUser,
  onRegisterComplaint,
  onChangeAdminPass,
  appConfig,
  onUpdateConfig,
  isLoading,
  alertAuthorized,
  onAuthorizeAlerts,
  onSoundTest,
  isAudioMuted,
  onToggleAudio,
  onLogout,
  micAuthorized,
  onAuthorizeMic,
  isMicMuted,
  onToggleMic,
  onChatUser,
  branding,
  onUpdateBranding,
  onUpdateUserStatus,
  activeTab: activeTabProp,
  onNavigate: onNavigateProp
}: AdminPanelProps) {
  const [localActiveTab, setLocalActiveTab] = useState<'complaints' | 'users' | 'settings' | 'integrations' | 'submit' | 'critical' | 'config' | 'clients' | 'monitor' | 'dealers' | 'branding' | 'dealers_data' | 'nodes' | 'top10' | 'billing'>('complaints');
  const activeTab = activeTabProp !== undefined ? activeTabProp as any : localActiveTab;
  const setActiveTab = (tabId: 'complaints' | 'users' | 'settings' | 'integrations' | 'submit' | 'critical' | 'config' | 'clients' | 'monitor' | 'dealers' | 'branding' | 'dealers_data' | 'nodes' | 'top10' | 'billing') => {
    if (onNavigateProp) {
      onNavigateProp(tabId);
    } else {
      setLocalActiveTab(tabId);
    }
  };
  const customNames = branding.customNames || {};
  const [isFormVisible, setIsFormVisible] = useState(true);
  const [isChartsVisible, setIsChartsVisible] = useState(true);
  
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newLineCode, setNewLineCode] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserProfile['role']>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState<string | 'all'>('all');
  
  // User editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserProfile['role']>('member');
  const [editLineCode, setEditLineCode] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminNewPass, setAdminNewPass] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // --- Google Connect Multi-Browser Helper State ---
  const [showGoogleConnectModal, setShowGoogleConnectModal] = useState(false);
  const [googleConnectUrl, setGoogleConnectUrl] = useState('');

  // --- Local Enterprise Backup & Restore state ---
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [uploadedBackupData, setUploadedBackupData] = useState<any | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // --- Supabase Client Integration and live Migration Console state ---
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('gts_supabase_url') || '');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState(() => localStorage.getItem('gts_supabase_service_key') || '');
  const [isExportingSql, setIsExportingSql] = useState(false);
  const [isMigratingLive, setIsMigratingLive] = useState(false);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migratedStatusSummary, setMigratedStatusSummary] = useState<{ col: string; count: number }[]>([]);

  const handleGenerateLocalBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const backupData = await firebaseService.getFullSystemBackup(currentUser?.username || 'admin');
      
      // Embed exact date and time details inside both metadata and filename
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      
      const dateStr = `${YYYY}-${MM}-${DD}_${hh}-${mm}-${ss}`;
      const fileName = `wifi_system_backup_${dateStr}.json`;
      
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('BACKUP GENERATED!', {
        description: `Successfully compiled and downloaded offline snapshot: ${fileName}`
      });
    } catch (err: any) {
      console.error(err);
      toast.error('Backup generation failed', {
        description: err.message || 'Unknown error occurred while compiling data.'
      });
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      toast.error("Unsupported file format", { description: "You must supply a premium compiled JSON backup package (.json)." });
      return;
    }
    
    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const pkg = JSON.parse(event.target?.result as string);
        if (pkg.version !== "2.0-full" || !pkg.data) {
          toast.error("Format mismatch", { description: "The uploaded file is not compatible with our premium console restore system." });
          setRestoreFile(null);
          setUploadedBackupData(null);
          return;
        }
        setUploadedBackupData(pkg);
        toast.info("Validation Complete!", {
          description: `Backup verified. Original compilation date: ${new Date(pkg.exportedAt).toLocaleString()}`
        });
      } catch (err) {
        toast.error("Compilation error", { description: "Failed to parse the backup file. File might be truncated or corrupted." });
        setRestoreFile(null);
        setUploadedBackupData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteRestore = async () => {
    if (!uploadedBackupData) return;
    
    const confirmChoice = confirm("⚠️ CRITICAL SYSTEM RESTORE REQUESTED!\n\nThis will purge and rewrite your complaints history, registered users, brand theme configuration alignments, system logs, everything.\n\nAre you sure you want to completely overwrite current database configurations?");
    if (!confirmChoice) return;

    setIsRestoringBackup(true);
    try {
      await firebaseService.restoreFullSystemBackup(uploadedBackupData, currentUser?.username || 'admin');
      
      toast.success("SYSTEM SYNCHRONIZATION SUCCESSFUL", {
        description: "Entire panel data restored perfectly to standard! Rebooting workspace console..."
      });
      
      setRestoreFile(null);
      setUploadedBackupData(null);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error("Database Restoration Failed", {
        description: err.message || "An unexpected error occurred during bulk database replacement."
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleDownloadSupabaseSQL = async () => {
    setIsExportingSql(true);
    const toastId = toast.loading("Compiling Supabase SQL Migration Package...");
    try {
      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Starting extraction of Firebase Firestore collections...`]);
      const data = await extractFirebaseCollections((col, count) => {
        if (count === -1) {
          setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Querying collection: ${col}...`]);
        } else {
          setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Extracted ${count} records from schema collection: ${col}.`]);
        }
      });

      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Structuring SQL tables and security constraints...`]);
      const sqlContent = generateSupabaseMigrationSQL(data);
      
      const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `supabase_migration_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Successfully exported and triggered browser download!`]);
      toast.success("SQL migration file created successfully!", {
        id: toastId,
        description: "Copy-paste this file directly in Supabase SQL Editor."
      });
    } catch (err: any) {
      console.error(err);
      setMigrationLogs(prev => [...prev, `[ERROR] SQL generation failed: ${err.message || err}`]);
      toast.error("SQL Extraction Failed", {
        id: toastId,
        description: getCleanErrorMessage(err)
      });
    } finally {
      setIsExportingSql(false);
    }
  };

  const handleLiveSupabaseMigration = async () => {
    if (!supabaseUrl || !supabaseServiceKey) {
      toast.error("Required parameter missing", {
        description: "Please specify both Supabase URL & Service Role key."
      });
      return;
    }

    // Save fields in cache
    localStorage.setItem('gts_supabase_url', supabaseUrl);
    localStorage.setItem('gts_supabase_service_key', supabaseServiceKey);

    setIsMigratingLive(true);
    setMigrationLogs([]);
    const toastId = toast.loading("Executing live Supabase synchronization...");

    try {
      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Instantiating Supabase client object...`]);
      const client = getSupabaseClient({ url: supabaseUrl, serviceKey: supabaseServiceKey });
      if (!client) {
        throw new Error("Unable to construct Supabase Client instance.");
      }

      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Fetching all document data from Firestore collections...`]);
      const data = await extractFirebaseCollections((col, count) => {
        if (count === -1) {
          setMigrationLogs(prev => [...prev, `[INFO] Parsing Firebase records in: ${col}`]);
        } else {
          setMigrationLogs(prev => [...prev, `[INFO] Completed: fetched ${count} records from ${col}`]);
        }
      });

      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Initializing live Supabase REST API bulk write pipeline...`]);
      
      await pushCollectionsToSupabase(client, data, (msg, status) => {
        const time = new Date().toLocaleTimeString();
        if (status === 'success') {
          setMigrationLogs(prev => [...prev, `[SUCCESS ${time}] ${msg}`]);
        } else if (status === 'error') {
          setMigrationLogs(prev => [...prev, `[ERROR ${time}] ${msg}`]);
        } else {
          setMigrationLogs(prev => [...prev, `[${time}] ${msg}`]);
        }
      });

      toast.success("Supabase live direct sync successfully executed!", {
        id: toastId,
        description: "Check your Supabase console to view your imported datasets."
      });
    } catch (err: any) {
      console.error(err);
      const errMsg = getCleanErrorMessage(err);
      setMigrationLogs(prev => [...prev, `[FATAL] Direct update failed: ${errMsg}`]);
      toast.error("Migration Aborted", {
        id: toastId,
        description: errMsg
      });
    } finally {
      setIsMigratingLive(false);
    }
  };


  // Filter state controlled by status tiles
  const [forcedStatus, setForcedStatus] = useState<ComplaintStatus | 'all'>('all');
  const [forcedPriority, setForcedPriority] = useState<ComplaintPriority | 'all'>('all');
  const [forcedCategory, setForcedCategory] = useState<ComplaintCategory | 'all'>('all');

  // --- Advanced Enterprise Billing & Recovery Module states ---
  const [masterClients, setMasterClients] = useState<any[]>([]);
  const [billingMonths, setBillingMonths] = useState<any[]>([]);
  const [currentMonthId, setCurrentMonthId] = useState<string>('');
  const [isConfiguringNewMonth, setIsConfiguringNewMonth] = useState(false);
  const [isDeleteSheetModalOpen, setIsDeleteSheetModalOpen] = useState(false);
  const [sheetIdToDelete, setSheetIdToDelete] = useState('');
  const [newMonthName, setNewMonthName] = useState('');
  const [newMonthYear, setNewMonthYear] = useState('26');
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [billingStatusFilter, setBillingStatusFilter] = useState<string>('all');
  const [billingAreaFilter, setBillingAreaFilter] = useState<string>('all');
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isEntrySheetOpen, setIsEntrySheetOpen] = useState(false);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);

  // --- Spreadsheet loading optimization states ---
  const [isSheetLoaded, setIsSheetLoaded] = useState(false);
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [sheetLoadingProgress, setSheetLoadingProgress] = useState(0);

  const startSheetLoading = () => {
    setIsSheetLoading(true);
    setSheetLoadingProgress(0);
    const interval = setInterval(() => {
      setSheetLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSheetLoaded(true);
          setIsSheetLoading(false);
          return 100;
        }
        const increment = Math.floor(Math.random() * 14) + 8;
        return Math.min(100, prev + increment);
      });
    }, 60);
  };

  // --- Billing Security Key States and Controls ---
  const [isBillingUnlocked, setIsBillingUnlocked] = useState(() => {
    return sessionStorage.getItem('gts_billing_unlocked') === 'true';
  });
  const [billingKeyInput, setBillingKeyInput] = useState('');
  const [isEditingSecurityKey, setIsEditingSecurityKey] = useState(false);
  const [newSecurityKeyInput, setNewSecurityKeyInput] = useState('');

  const isDealerTied = currentUser.role === 'dealer' || (currentUser.dealerId && currentUser.dealerId !== 'main');
  const activeDealerId = isDealerTied ? firebaseService.getTenantId(currentUser) : undefined;

  const handleUnlockBilling = () => {
    const requiredKey = (isDealerTied && currentUser.password) ? currentUser.password : (appConfig.billingSecurityKey || '786786');
    if (billingKeyInput === requiredKey) {
      setIsBillingUnlocked(true);
      sessionStorage.setItem('gts_billing_unlocked', 'true');
      // Dispatch custom event to notify rest of components in real-time
      window.dispatchEvent(new CustomEvent('gts-billing-unlocked-changed', { detail: true }));
      toast.success("🔑 ACCESS GRANTED", { description: "WiFi Billing sheet controls have been successfully unlocked for editing." });
    } else {
      toast.error("🔒 ACCESS DENIED", { description: "Incorrect or invalid Billing Security Key." });
    }
  };

  const handleSaveSecurityKey = async () => {
    const trimmedKey = newSecurityKeyInput.trim();
    if (!trimmedKey) {
      toast.error("Invalid Key", { description: "Security Key cannot be empty." });
      return;
    }
    
    try {
      const updatedConfig = {
        ...appConfig,
        billingSecurityKey: trimmedKey
      };
      
      onUpdateConfig(updatedConfig);
      setIsEditingSecurityKey(false);
      toast.success("🔑 KEY UPDATED SUCCESSFULLY", { description: `Billing Security Key successfully updated.` });
    } catch (err: any) {
      toast.error("Failed to update security key", { description: err.message });
    }
  };

  // Real-time sub for master clients (scoped to tenant)
  useEffect(() => {
    const tenantId = firebaseService.getReadTenantId(currentUser);
    const unsubscribe = firebaseService.subscribeClients((data) => {
      setMasterClients(data);
    }, tenantId);
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const handleClientsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setMasterClients(customEvent.detail);
      }
    };
    window.addEventListener('supabase-clients-updated', handleClientsUpdated);
    return () => {
      window.removeEventListener('supabase-clients-updated', handleClientsUpdated);
    };
  }, []);

  // Synchronise lock status across workspace modules in real-time
  useEffect(() => {
    const handleUnlockChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== undefined) {
        setIsBillingUnlocked(customEvent.detail);
      }
    };
    window.addEventListener('gts-billing-unlocked-changed', handleUnlockChanged);
    return () => {
      window.removeEventListener('gts-billing-unlocked-changed', handleUnlockChanged);
    };
  }, []);

  // Real-time sub for billing months (subscribes only once)
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeBillingMonths((data) => {
      const sorted = [...data].sort((a, b) => {
        // Sort newest first by parsing e.g. "MAY-26" or using epoch createdAt
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setBillingMonths(sorted);
      setCurrentMonthId(prev => {
        if (!prev && sorted.length > 0) {
          return sorted[0].id;
        }
        return prev;
      });
    }, activeDealerId);
    return () => unsubscribe();
  }, [currentUser, activeDealerId]);

  // Automatic background synchronization:
  // Detects newly created/updated master clients and automatically incorporates them or updates their details in the active billing sheet
  useEffect(() => {
    if (!currentMonthId || masterClients.length === 0 || billingMonths.length === 0) return;
    const activeDoc = billingMonths.find(m => m.id === currentMonthId);
    if (!activeDoc) return;

    const existingRows = activeDoc.rows ? [...activeDoc.rows] : [];
    let isChanged = false;
    let newCount = 0;
    let updatedCount = 0;

    masterClients.forEach((c) => {
      const existingIdx = existingRows.findIndex((r: any) => r.clientId === c.id || r.username === c.username);

      let targetBase = 1000;
      if (c.pkgDetails) {
        const digitsMatch = c.pkgDetails.match(/\d{3,5}/g);
        if (digitsMatch && digitsMatch.length > 0) {
          targetBase = parseInt(digitsMatch[digitsMatch.length - 1], 10);
        } else {
          const lowDigits = c.pkgDetails.replace(/[^0-9]/g, '');
          if (lowDigits && lowDigits.length >= 3) {
            targetBase = parseInt(lowDigits, 10);
          }
        }
      }

      if (existingIdx === -1) {
        // Add missing client
        existingRows.push({
          clientId: c.id,
          name: c.name || 'Anonymous client',
          username: c.username,
          mobileNumber: c.mobileNumber || c.number || '',
          area: c.area || '',
          rt: 'BILL',
          baseAmount: targetBase,
          cr: 0,
          totalAmount: targetBase,
          billingDay: '5',
          paymentReceived: 0,
          paymentStatus: 'unpaid',
          comments: '',
          occ: 'personal',
          serNam: c.username,
          pkgDetails: c.pkgDetails || '8Mb',
          sag: '0',
          lai: 'GN',
          connectionDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '01/01/26',
          devicePrice: '0',
          abl: '0',
          network: 'GN CITY'
        });
        isChanged = true;
        newCount++;
      } else {
        // Double check details and update if changed
        const row = { ...existingRows[existingIdx] };
        let rowChanged = false;
        if (row.name !== c.name) { row.name = c.name; rowChanged = true; }
        if (row.mobileNumber !== (c.mobileNumber || c.number || '')) { row.mobileNumber = c.mobileNumber || c.number || ''; rowChanged = true; }
        if (row.area !== c.area) { row.area = c.area; rowChanged = true; }
        if (row.pkgDetails !== c.pkgDetails) {
          row.pkgDetails = c.pkgDetails;
          row.baseAmount = targetBase;
          row.totalAmount = targetBase + (parseFloat(row.cr) || 0);
          rowChanged = true;
        }
        if (rowChanged) {
          existingRows[existingIdx] = row;
          isChanged = true;
          updatedCount++;
        }
      }
    });

    if (isChanged) {
      console.log(`[Auto billingsync] Active billing sheet is out of sync. Synchronizing ${newCount} additions and ${updatedCount} updates...`);
      const saveSync = async () => {
        try {
          await firebaseService.saveBillingMonth(currentMonthId, existingRows, 'System Sync', activeDealerId);
          if (newCount > 0 || updatedCount > 0) {
            toast.success("Billing Sheet Reconciled", {
              description: `Synced ${newCount} new clients and ${updatedCount} client profile updates instantly.`
            });
          }
        } catch (err) {
          console.error("Auto billing sync save failed:", err);
        }
      };
      
      saveSync();
    }
  }, [masterClients, currentMonthId, billingMonths]);

  const handleAddMonth = async () => {
    if (!isBillingUnlocked) {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to unlock billing sheet creation." });
      return;
    }
    const monthClean = newMonthName.trim().toUpperCase();
    if (!monthClean) {
      toast.error("Invalid month ID", { description: "Please enter a valid month label (e.g., MAY, JUN, DEC)." });
      return;
    }
    const monthId = `${monthClean}-${newMonthYear}`;
    
    if (billingMonths.some(m => m.id === monthId)) {
      toast.error("Duplicate month detected", { description: `A billing directory sheet for ${monthId} already exists.` });
      return;
    }

    try {
      // Build rows for all current master clients
      const rows = masterClients.map((c, i) => {
        // Core heuristics to extract numeric fee from package details (e.g., "12Mb @ 2000" -> 2000)
        let cleanBase = 1000;
        if (c.pkgDetails) {
          const digitsMatch = c.pkgDetails.match(/\d{3,5}/g);
          if (digitsMatch && digitsMatch.length > 0) {
            cleanBase = parseInt(digitsMatch[digitsMatch.length - 1], 10);
          } else {
            const lowDigits = c.pkgDetails.replace(/[^0-9]/g, '');
            if (lowDigits && lowDigits.length >= 3) {
              cleanBase = parseInt(lowDigits, 10);
            }
          }
        }
        
        return {
          clientId: c.id,
          name: c.name || 'Anonymous client',
          username: c.username || `client_${i}`,
          mobileNumber: c.mobileNumber || c.number || '',
          area: c.area || '',
          rt: 'BILL', // default Route/Type
          baseAmount: cleanBase,
          cr: 0,
          totalAmount: cleanBase,
          billingDay: '5', // Default 5th of the month
          paymentReceived: 0,
          paymentStatus: 'unpaid',
          comments: '',
          occ: 'personal',
          serNam: c.username || '',
          pkgDetails: c.pkgDetails || '8Mb',
          sag: '0',
          lai: 'GN',
          connectionDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '01/01/26',
          devicePrice: '0',
          abl: '0',
          network: 'GN CITY'
        };
      });

      await firebaseService.createBillingMonth(monthId, rows, currentUser.username || 'admin', activeDealerId);
      
      toast.success("MONTH CREATED SUCCESSFULLY", {
        description: `Successfully loaded wifi billing sheet ${monthId} with ${rows.length} master clients.`
      });
      
      setCurrentMonthId(monthId);
      setIsConfiguringNewMonth(false);
      setNewMonthName('');
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create billing month", {
        description: getCleanErrorMessage(err)
      });
    }
  };

  const handleRecheckUsers = async () => {
    if (!isBillingUnlocked) {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to unlock user recheck operation." });
      return;
    }
    if (!currentMonthId) return;
    const activeDoc = billingMonths.find(m => m.id === currentMonthId);
    if (!activeDoc) return;

    try {
      const existingRows = [...(activeDoc.rows || [])];
      let newCount = 0;
      let updatedCount = 0;

      masterClients.forEach((c) => {
        const existingIdx = existingRows.findIndex(r => r.clientId === c.id || r.username === c.username);
        
        let targetBase = 1000;
        if (c.pkgDetails) {
          const digitsMatch = c.pkgDetails.match(/\d{3,5}/g);
          if (digitsMatch && digitsMatch.length > 0) {
            targetBase = parseInt(digitsMatch[digitsMatch.length - 1], 10);
          } else {
            const lowDigits = c.pkgDetails.replace(/[^0-9]/g, '');
            if (lowDigits && lowDigits.length >= 3) {
              targetBase = parseInt(lowDigits, 10);
            }
          }
        }

        if (existingIdx === -1) {
          // Add missing client
          existingRows.push({
            clientId: c.id,
            name: c.name || 'Anonymous client',
            username: c.username,
            mobileNumber: c.mobileNumber || c.number || '',
            area: c.area || '',
            rt: 'BILL',
            baseAmount: targetBase,
            cr: 0,
            totalAmount: targetBase,
            billingDay: '5',
            paymentReceived: 0,
            paymentStatus: 'unpaid',
            comments: '',
            occ: 'personal',
            serNam: c.username,
            pkgDetails: c.pkgDetails || '8Mb',
            sag: '0',
            lai: 'GN',
            connectionDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '01/01/26',
            devicePrice: '0',
            abl: '0',
            network: 'GN CITY'
          });
          newCount++;
        } else {
          // Sync client's master profile details
          const row = { ...existingRows[existingIdx] };
          let changed = false;
          if (row.name !== c.name) { row.name = c.name; changed = true; }
          if (row.mobileNumber !== (c.mobileNumber || c.number || '')) { row.mobileNumber = c.mobileNumber || c.number || ''; changed = true; }
          if (row.area !== c.area) { row.area = c.area; changed = true; }
          if (row.pkgDetails !== c.pkgDetails) { 
            row.pkgDetails = c.pkgDetails; 
            row.baseAmount = targetBase; 
            row.totalAmount = targetBase + (parseFloat(row.cr) || 0); 
            changed = true; 
          }
          if (changed) {
            existingRows[existingIdx] = row;
            updatedCount++;
          }
        }
      });

      await firebaseService.saveBillingMonth(currentMonthId, existingRows, currentUser.username || 'admin', activeDealerId);
      
      toast.success("USER LIST RECHECKED PERFECTLY!", {
        description: `Linked ${newCount} new registered users and updated info for ${updatedCount} profiles in this month's recovery sheet.`
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Recheck user list failed", { description: getCleanErrorMessage(err) });
    }
  };

  const handleSaveRowField = async (rowIndex: number, field: string, val: any) => {
    if (!isBillingUnlocked) {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to edit billing information." });
      return;
    }
    const activeDoc = billingMonths.find(m => m.id === currentMonthId);
    if (!activeDoc) return;

    try {
      const updatedRows = [...(activeDoc.rows || [])];
      const targetRow = { ...updatedRows[rowIndex] };

      targetRow[field] = val;

      if (field === 'cr') {
        const crVal = parseFloat(val) || 0;
        targetRow._originalCr = crVal;
        targetRow.cr = crVal;
        const base = parseFloat(targetRow.baseAmount) || 0;
        targetRow.totalAmount = base + crVal;
      } else if (field === 'baseAmount') {
        const baseVal = parseFloat(val) || 0;
        const crVal = parseFloat(targetRow.cr) || 0;
        targetRow.totalAmount = baseVal + crVal;
      } else if (field === 'paymentReceived') {
        const received = parseFloat(val) || 0;
        if (targetRow._originalCr === undefined) {
          targetRow._originalCr = parseFloat(targetRow.cr) || 0;
        }
        const origCr = parseFloat(targetRow._originalCr) || 0;
        const base = parseFloat(targetRow.baseAmount) || 0;
        
        targetRow.cr = Math.max(0, origCr - received);
        targetRow.totalAmount = base + targetRow.cr;
      }

      // Automatically calculate payment status
      if (field === 'paymentReceived' || field === 'baseAmount' || field === 'cr') {
        const received = parseFloat(targetRow.paymentReceived) || 0;
        const total = parseFloat(targetRow.totalAmount) || 0;
        
        if (targetRow.paymentStatus !== 'tdc') {
          if (received === 0) {
            targetRow.paymentStatus = 'unpaid';
          } else if (received >= total) {
            targetRow.paymentStatus = 'paid';
          } else {
            targetRow.paymentStatus = 'partial';
          }
        }
      }

      updatedRows[rowIndex] = targetRow;
      await firebaseService.saveBillingMonth(currentMonthId, updatedRows, currentUser.username || 'admin', activeDealerId);
    } catch (err: any) {
      console.error("Failed to persist billing cell edit:", err);
      toast.error("Cell auto-save issue", { description: getCleanErrorMessage(err) });
    }
  };

  const handleDeleteBillingRow = async (rowIndex: number) => {
    if (!isBillingUnlocked) {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to delete rows from billing sheets." });
      return;
    }
    const activeDoc = billingMonths.find(m => m.id === currentMonthId);
    if (!activeDoc) return;
    
    if (!confirm("Discard this subscriber row from this month's sheet?\n\n(This will not remove them from the Main Clients Directory)")) return;

    try {
      const updatedRows = [...(activeDoc.rows || [])];
      updatedRows.splice(rowIndex, 1);
      await firebaseService.saveBillingMonth(currentMonthId, updatedRows, currentUser.username || 'admin', activeDealerId);
      toast.success("Recovery row removed from current month's sheet.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to remove row", { description: getCleanErrorMessage(err) });
    }
  };

  const handleDeleteBillingMonth = async (selectedMonthId: string) => {
    if (!isBillingUnlocked) {
      toast.error("🔒 ACCESS PROTECTED", { description: "Please enter the Security Key to delete entire billing sheets." });
      return;
    }
    if (!selectedMonthId) {
      toast.error("Please select a recovery sheet to delete.");
      return;
    }
    if (!confirm(`⚠️ WARNING: Complete deletion selected!\n\nAre you sure you want to permanently delete the entire ${selectedMonthId} monthly recovery sheet database?\n\nThis will destroy all payments entered for this month.`)) return;

    try {
      await firebaseService.deleteBillingMonth(selectedMonthId, activeDealerId);
      toast.success(`${selectedMonthId} recovery sheet was deleted from database successfully.`);
      if (currentMonthId === selectedMonthId) {
        setCurrentMonthId('');
      }
      setIsDeleteSheetModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Purge month failed", { description: getCleanErrorMessage(err) });
    }
  };

  const stats = [
    { label: branding.tabNames?.total_registry || 'Total Registry', value: complaints.length, tooltip: 'Total volume of operational records currently stored in the central database.', color: 'border-slate-900 dark:border-brand-accent', textColor: 'text-slate-900 dark:text-white', icon: <Layers size={18} />, filter: { status: 'all', priority: 'all', category: 'all' } },
    { label: branding.tabNames?.pending_requests || 'Pending Requests', value: complaints.filter(c => c.status === 'pending').length, tooltip: 'Operations currently in the queue awaiting technician dispatch or initial resource allocation.', color: 'border-amber-500', textColor: 'text-amber-500', icon: <Clock size={18} />, filter: { status: 'pending', priority: 'all', category: 'all' } },
    { label: branding.tabNames?.new_connection_pending || 'New Connection', value: complaints.filter(c => c.category === 'New Connection' && c.status === 'pending').length, tooltip: 'Newly registered connection requests awaiting initial infrastructure deployment.', color: 'border-brand-accent', textColor: 'text-brand-accent', icon: <Zap size={18} />, filter: { status: 'pending', priority: 'all', category: 'New Connection' } },
    { label: branding.tabNames?.in_operation || 'In Operation', value: complaints.filter(c => c.status === 'in process').length, tooltip: 'Active logistics: Tasks currently under execution by on-site technicians.', color: 'border-blue-600', textColor: 'text-blue-600', icon: <TrendingUp size={18} />, filter: { status: 'in process', priority: 'all', category: 'all' } },
    { label: branding.tabNames?.finalized || 'Finalized', value: complaints.filter(c => c.status === 'complete' && c.category !== 'New Connection').length, tooltip: 'Service successfully restored and verified according to enterprise protocols.', color: 'border-emerald-500', textColor: 'text-emerald-500', icon: <CheckCircle size={18} />, filter: { status: 'complete', priority: 'all', category: 'all' } },
    { label: branding.tabNames?.connection_complete || 'Connection Complete', value: complaints.filter(c => c.category === 'New Connection' && c.status === 'complete').length, tooltip: 'Newly registered connection requests that have been successfully deployed.', color: 'border-cyan-500', textColor: 'text-cyan-500', icon: <Zap size={18} />, filter: { status: 'complete', priority: 'all', category: 'New Connection' } },
  ];

  const handleTileClick = (filter: any) => {
    setForcedStatus(filter.status || 'all');
    setForcedPriority(filter.priority || 'all');
    setForcedCategory(filter.category || 'all');
    setActiveTab('complaints');
    // Smooth scroll to list
    const listElement = document.getElementById('operations-registry');
    if (listElement) {
      listElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const [googleTokens, setGoogleTokens] = useState(googleSheetsService.getTokens());
  
  useEffect(() => {
    const handleAdminNav = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
        // If switching to complaints, reset filters to 'all'
        if (e.detail === 'complaints') {
          setForcedStatus('all');
          setForcedPriority('all');
          setForcedCategory('all');
        }
      }
    };
    window.addEventListener('admin-nav', handleAdminNav);
    return () => window.removeEventListener('admin-nav', handleAdminNav);
  }, []);

  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setGoogleTokens(e.detail);
    };
    window.addEventListener('google-auth-changed', handleAuthChange);
    return () => window.removeEventListener('google-auth-changed', handleAuthChange);
  }, []);

  const [lastAutoBackupTime, setLastAutoBackupTime] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = googleSheetsService.subscribeGoogleSheetsConfig((data) => {
      if (data) {
        if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
        if (data.sheetName) setSheetName(data.sheetName);
        if (data.sheetRange) setSheetRange(data.sheetRange);
        if (data.lastAutoBackupTime) setLastAutoBackupTime(data.lastAutoBackupTime);
      }
    });
    return () => unsubscribe();
  }, []);

  const [spreadsheetId, setSpreadsheetId] = useState(googleSheetsService.getSpreadsheetId() || '');
  const [sheetName, setSheetName] = useState(googleSheetsService.getSheetName());
  const [sheetRange, setSheetRange] = useState(googleSheetsService.getSheetRange());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success('Copied successfully!', {
      description: `${label} copied to clipboard.`
    });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleGoogleConnect = async (mode: 'server' | 'firebase') => {
    setIsConnecting(true);
    
    if (mode === 'server') {
      const oauthUrl = googleSheetsService.getOAuthUrl();
      setGoogleConnectUrl(oauthUrl);
      setShowGoogleConnectModal(true);
      try {
        window.open(oauthUrl, '_blank');
      } catch (browserErr) {
        console.warn("Auto browser redirect blocked by system/popup policy:", browserErr);
      }
    }

    try {
      const tokens = mode === 'server'
        ? await googleSheetsService.initiateAuth()
        : await googleSheetsService.initiateFirebaseAuth();
      setGoogleTokens(tokens);
      if (mode === 'firebase') {
        toast.success('Connected via Firebase Google Login!', {
          description: 'Note: This fast connection will expire in 1 hour. Use Permanent connection for 24/7 background sync.'
        });
      } else {
        setShowGoogleConnectModal(false);
        toast.success('Connected via Permanent Google Sync!', {
          description: 'Secure background credentials generated. High-integrity data stream is now persistent 24/7!'
        });
      }
    } catch (err: any) {
      console.error(err instanceof Error ? err.message : String(err));
      if (err.message && (err.message.includes('closed') || err.message.includes('cancel'))) {
        toast.error('Authentication cancelled', {
          description: 'Please keep the window open until the process completes.'
        });
      } else {
        toast.error(err.message || 'Failed to connect to Google Account.');
      }
    } finally {
      setIsConnecting(false);
      setShowGoogleConnectModal(false);
    }
  };

  const handleBulkExport = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch any data not already in props (like Clients and Config)
      const clients = await firebaseService.getClients();
      
      // 2. Prepare full system data
      const backupData = {
        complaints: complaints,
        users: users,
        clients: clients,
        config: appConfig || {},
        branding: branding || {}
      };

      await googleSheetsService.performBulkSystemBackup(backupData);
      toast.success('Full System Export Successful!', {
        description: 'All users, operational logs, clients, and configurations have been backed up to Google Sheets.'
      });
    } catch (err: any) {
      console.error('Bulk Export error:', err);
      toast.error(err.message || 'Bulk Synchronization failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveSpreadsheetId = () => {
    googleSheetsService.saveSpreadsheetId(spreadsheetId);
    toast.success('Spreadsheet ID saved successfully!');
  };

  const handleSaveRangeSettings = () => {
    googleSheetsService.saveSheetName(sheetName);
    googleSheetsService.saveSheetRange(sheetRange);
    toast.success('Sheet range settings saved successfully!');
  };

  const handleCreateSheet = async () => {
    setIsCreatingSheet(true);
    try {
      const title = `WiFi Operational Logs - ${new Date().toLocaleDateString()}`;
      const result = await googleSheetsService.createNewSpreadsheet(title);
      setSpreadsheetId(result.spreadsheetId);
      toast.success('New Spreadsheet Created!', {
        description: `ID: ${result.spreadsheetId}`
      });
    } catch (err: any) {
      toast.error(err.message || 'Creation failed.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = newUsername.trim();
    if (!trimmedName || !newPassword.trim()) {
      setFormError('Username and password are required.');
      return;
    }

    if (users.some(u => u.username.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError('This username is already taken.');
      return;
    }

    if (trimmedName.toLowerCase() === newPassword.toLowerCase()) {
      setFormError('Security Error: Password cannot match username.');
      return;
    }

    setIsCreating(true);
    try {
      if (activeTab === 'dealers') {
        if (!newLineCode.trim()) {
          setFormError('Line Code is required for Dealer accounts.');
          setIsCreating(false);
          return;
        }
        await onCreateUser(trimmedName, newPassword, 'dealer', undefined, newLineCode.trim(), newCompanyName.trim());
        setFormSuccess(`Dealer account "${trimmedName}" created with Line Code: ${newLineCode}`);
        setNewLineCode('');
        setNewCompanyName('');
      } else {
        // Correctly associate the new user with the dealer if the current user is a dealer or a dealer's admin
        const effectiveDealerId = currentUser.role === 'dealer' ? currentUser.uid : currentUser.dealerId;
        // @ts-ignore - fullName is added to user management
        await onCreateUser(trimmedName, newPassword, newUserRole, effectiveDealerId, undefined, undefined, newFullName.trim());
        setFormSuccess(`${newUserRole.charAt(0).toUpperCase() + newUserRole.slice(1)} account "${trimmedName}" created!`);
      }
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setNewUserRole('member');
      setTimeout(() => setFormSuccess(null), 5000); 
    } catch (err) {
      setFormError('Critical Error: Could not save account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEditUser = (user: UserProfile) => {
    setEditingUserId(user.uid);
    setEditUsername(user.username);
    setEditFullName(user.fullName || '');
    setEditPassword(user.password || '');
    setEditUserRole(user.role);
    setEditLineCode(user.lineCode || '');
    setEditCompanyName(user.companyName || '');
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
    setEditUsername('');
    setEditFullName('');
    setEditPassword('');
    setEditLineCode('');
    setEditCompanyName('');
  };

  const handleUpdateUser = async (uid: string) => {
    if (!editUsername.trim() || !editPassword.trim()) {
      toast.error('Username and password are required');
      return;
    }
    
    setIsUpdating(true);
    try {
      // @ts-ignore - fullName is added to user management
      await onUpdateUser(uid, editUsername.trim(), editPassword.trim(), editLineCode.trim() || undefined, editCompanyName.trim() || undefined, editFullName.trim(), editUserRole);
      setEditingUserId(null);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetAppData = () => {
    if (confirm('WARNING: This will delete ALL local accounts and complaints permanently. Are you absolutely sure?')) {
      try {
        localStorage.removeItem('gts_users');
        localStorage.removeItem('gts_complaints');
      } catch (e) {
        console.warn("Could not clear local caches under current sandbox security:", e);
      }
      window.location.reload();
    }
  };

  const handleChangeAdminPass = async (e: React.FormEvent) => {
    e.preventDefault();
    await onChangeAdminPass(adminNewPass);
    setAdminNewPass('');
  };

  const renderHomeSections = () => {
    const sections = Array.isArray(branding.homeSections) && branding.homeSections.length > 0 
      ? branding.homeSections 
      : [
          { id: 'stats', visible: true, order: 0 },
          { id: 'charts', visible: true, order: 1 },
          { id: 'registry', visible: true, order: 2 }
        ];

    return [...sections].sort((a, b) => a.order - b.order).map(section => {
      if (!section.visible) return null;

      switch(section.id) {
        case 'stats':
          return (
            <div key={`section-${section.id}`} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
              {stats.map((stat, idx) => (
                <motion.div
                  key={`stat-tile-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3, ease: "easeOut" }}
                  whileHover={{ 
                    y: -6, 
                    scale: 1.025,
                    boxShadow: "0 25px 45px -10px rgba(0, 0, 0, 0.08), 0 10px 20px -8px rgba(0, 0, 0, 0.04)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTileClick(stat.filter)}
                  title={stat.tooltip}
                  className={cn(
                    "p-3 sm:p-6 bg-white dark:bg-slate-950 rounded-xl sm:rounded-2xl border-l-4 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.03),0_4px_12px_-3px_rgba(0,0,0,0.01)] dark:shadow-[0_15px_45px_-10px_rgba(0,0,0,0.35),0_6px_20px_-6px_rgba(0,0,0,0.2)] border-slate-100 dark:border-slate-900 flex flex-col justify-between transition-all duration-300 group cursor-pointer",
                    stat.color,
                    (forcedStatus === stat.filter.status && forcedPriority === stat.filter.priority && stat.label !== 'Total Registry') ? "ring-2 ring-brand-accent scale-105" : ""
                  )}
                >
                  <div className="flex justify-between items-start mb-2 sm:mb-4">
                    <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors leading-tight">
                      {stat.label}
                    </span>
                    <div className={cn("p-1.5 sm:p-2 rounded-lg transition-all duration-300 shrink-0 group-hover:scale-110 group-hover:rotate-6", 
                      stat.textColor === 'text-rose-500' ? "bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20" :
                      stat.textColor === 'text-blue-600' ? "bg-blue-600/10 text-blue-600 group-hover:bg-blue-600/20" :
                      stat.textColor === 'text-emerald-500' ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20" :
                      stat.textColor === 'text-brand-accent' ? "bg-brand-accent/10 text-brand-accent group-hover:bg-brand-accent/20" :
                      stat.textColor === 'text-cyan-500' ? "bg-cyan-500/10 text-cyan-500 group-hover:bg-cyan-500/20" :
                      stat.textColor === 'text-amber-500' ? "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20 animate-pulse" :
                      "bg-slate-100 dark:bg-slate-900 group-hover:bg-slate-200 dark:group-hover:bg-slate-800"
                    )}>
                      {React.cloneElement(stat.icon as React.ReactElement, { size: window.innerWidth < 640 ? 14 : 18 })}
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className={cn("text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight leading-none transition-transform duration-300 group-hover:scale-105 origin-left", stat.textColor)}>
                      {stat.value.toString().padStart(2, '0')}
                    </div>
                    {/* Micro Sparklines matching the uploaded mockup dashboard design perfectly */}
                    {(stat.label === 'New Connection' || stat.label === branding.tabNames?.new_connection_pending) && (
                      <div className="w-[60px] sm:w-[80px] h-6 pb-0.5 opacity-80 shrink-0">
                        <svg viewBox="0 0 80 30" width="100%" height="100%" className="overflow-visible">
                          <path
                            d="M 0,22 Q 15,4 32,18 T 64,8 T 80,12"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <circle cx="80" cy="12" r="3" fill="#3b82f6" className="animate-pulse" />
                        </svg>
                      </div>
                    )}
                    {(stat.label === 'In Operation' || stat.label === branding.tabNames?.in_operation) && (
                      <div className="w-[60px] sm:w-[80px] h-6 pb-0.5 opacity-80 shrink-0">
                        <svg viewBox="0 0 80 30" width="100%" height="100%" className="overflow-visible">
                          <path
                            d="M 0,20 Q 12,28 28,10 T 56,18 T 80,4"
                            fill="none"
                            stroke="#1d4ed8"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <circle cx="80" cy="4" r="3" fill="#1d4ed8" className="animate-pulse" />
                        </svg>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          );
        case 'charts':
          return (
            <div key={`section-${section.id}`} className="space-y-6">
              <div 
                className="text-center space-y-2 mb-10 cursor-pointer select-none group"
                onDoubleClick={() => setIsChartsVisible(!isChartsVisible)}
                title="Double-click to toggle analytics"
              >
                <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 group-hover:scale-105 transition-transform duration-500">Chart Analytics</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Real-time operational data visualization</p>
              </div>

              <AnimatePresence mode="wait">
                {isChartsVisible && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)', y: 20 }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0.8, 
                      x: -400, 
                      y: -100, 
                      rotate: -15, 
                      skewX: -40, 
                      filter: 'blur(50px)',
                      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
                    }}
                    transition={{ 
                      duration: 0.4, 
                      ease: [0.16, 1, 0.3, 1] 
                    }}
                    className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6 origin-right"
                  >
                    <div className="h-[300px] sm:h-[400px] transition-all duration-300">
                      <DistributionList complaints={complaints} chartType="area" />
                    </div>
                    <div className="h-[300px] sm:h-[400px] md:col-span-1 lg:col-span-2 xl:col-span-1 transition-all duration-300">
                      <RealTimeMonitor complaints={complaints} />
                    </div>
                    <div className="h-[300px] sm:h-[400px] transition-all duration-300">
                      <DistributionList complaints={complaints} chartType="category" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        case 'registry':
          return (activeTab === 'complaints') ? (
            <div key={`section-${section.id}`} className="space-y-12">
              <motion.div
                key="complaints-list"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                id="operations-registry"
              >
                <div className="space-y-6">
                  {selectedDealerId !== 'all' && (
                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                          <BarChart3 size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Active Dealer Audit Filter</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Viewing data for: {users.find(u => u.uid === selectedDealerId)?.username || 'Selected Dealer'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedDealerId('all')}
                        className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-800 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                      >
                        Clear Filter
                      </button>
                    </div>
                  )}
                  <ComplaintList
                    complaints={selectedDealerId === 'all' ? complaints : complaints.filter(c => c.dealerId === selectedDealerId)}
                    onDelete={onDeleteComplaint}
                    onStatusChange={onUpdateComplaintStatus}
                    onUpdateRemarks={onUpdateRemarks}
                    onEdit={onUpdateComplaint}
                    isAdmin={true}
                    currentUser={currentUser}
                    forcedStatusFilter={forcedStatus}
                    forcedPriorityFilter={forcedPriority}
                    forcedCategoryFilter={forcedCategory}
                    appConfig={appConfig}
                    branding={branding}
                  />
                </div>
              </motion.div>
            </div>
          ) : null;
        default:
          return null;
      }
    });
  };

  // --- Billing Computed Statistics and Formulas ---
  const activeMonthDoc = useMemo(() => {
    return billingMonths.find(m => m.id === currentMonthId);
  }, [billingMonths, currentMonthId]);

  const activeRows = useMemo(() => {
    return activeMonthDoc?.rows || [];
  }, [activeMonthDoc]);

  const filteredRows = useMemo(() => {
    const query = billingSearchQuery.toLowerCase().trim();
    return activeRows.filter((row: any) => {
      const matchesSearch = 
        !query ||
        row.name?.toLowerCase().includes(query) || 
        row.username?.toLowerCase().includes(query) || 
        row.mobileNumber?.includes(query) ||
        row.serNam?.toLowerCase().includes(query);
      
      const matchesStatus = billingStatusFilter === 'all' || row.paymentStatus === billingStatusFilter;
      const matchesArea = billingAreaFilter === 'all' || row.area === billingAreaFilter;
      
      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [activeRows, billingSearchQuery, billingStatusFilter, billingAreaFilter]);

  const { totalExpected, totalBase, totalCr, totalRecovered, totalOutstanding, totalTDC, totalPending, recoveryRate } = useMemo(() => {
    const expected = activeRows.reduce((acc: number, r: any) => acc + (parseFloat(r.totalAmount) || 0), 0);
    const base = activeRows.reduce((acc: number, r: any) => acc + (parseFloat(r.baseAmount) || 0), 0);
    const arrears = activeRows.reduce((acc: number, r: any) => {
      if (r.paymentStatus === 'paid') return acc;
      const overdue = (parseFloat(r.totalAmount) || 0) - (parseFloat(r.paymentReceived) || 0);
      const unpaidCr = Math.min(parseFloat(r.cr) || 0, Math.max(0, overdue));
      return acc + unpaidCr;
    }, 0);
    const recovered = activeRows.reduce((acc: number, r: any) => acc + (parseFloat(r.paymentReceived) || 0), 0);
    const outstanding = expected - recovered;
    const tdc = activeRows.filter((r: any) => r.paymentStatus === 'tdc').length;
    const pending = activeRows.filter((r: any) => r.paymentStatus === 'unpaid').length;
    const rate = expected > 0 ? (recovered / expected) * 100 : 0;

    return {
      totalExpected: expected,
      totalBase: base,
      totalCr: arrears,
      totalRecovered: recovered,
      totalOutstanding: outstanding,
      totalTDC: tdc,
      totalPending: pending,
      recoveryRate: rate
    };
  }, [activeRows]);

  const handleDownloadCSV = () => {
    if (!currentMonthId || !activeRows.length) return;
    const headers = [
      "Sr#", "NAME", "USER ID", "MOBILE #", "AREA", "RT", "B. AMOUNT", "CR.", "T. AMOUNT", 
      "BD", "MAY RECOVERY", "STATUS", "COMMENTS", "OCC.", "SER NAM", "PKG", "DATE", 
      "DEVICE PRICE", "ABL CHARGES", "NETWORK"
    ];
    
    const csvRows = [headers.join(",")];
    
    activeRows.forEach((r: any, idx: number) => {
      const rowData = [
        idx + 1,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.username || ''}"`,
        `"${r.mobileNumber || ''}"`,
        `"${r.area || ''}"`,
        `"${r.rt || ''}"`,
        r.baseAmount || 0,
        r.cr || 0,
        r.totalAmount || 0,
        `"${r.billingDay || ''}"`,
        r.paymentReceived || 0,
        `"${r.paymentStatus || ''}"`,
        `"${(r.comments || '').replace(/"/g, '""')}"`,
        `"${r.occ || ''}"`,
        `"${r.serNam || ''}"`,
        `"${r.pkgDetails || ''}"`,
        `"${r.connectionDate || ''}"`,
        r.devicePrice || 0,
        r.abl || 0,
        `"${r.network || ''}"`
      ];
      csvRows.push(rowData.join(","));
    });
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `WIFI_BILLING_${currentMonthId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputClasses = "w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400 uppercase placeholder:normal-case";
  const labelClasses = "block text-xs font-black uppercase text-slate-600 dark:text-slate-300 mb-2 tracking-widest ml-1";

  return (
    <>
      <AnimatePresence>
        {isDeleteSheetModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteSheetModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-500/30 overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 animate-pulse">
                      <Trash2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Delete Recovery Sheet</h3>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Permanent Database Purge</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDeleteSheetModalOpen(false)}
                    className="p-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClasses}>Select Monthly Sheet</label>
                    {billingMonths.length === 0 ? (
                      <div className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                        No Sheets Found in Database
                      </div>
                    ) : (
                      <select
                        value={sheetIdToDelete}
                        onChange={(e) => setSheetIdToDelete(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 font-medium"
                      >
                        <option value="">-- Choose Sheet --</option>
                        {billingMonths.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} (Contains {m.rows?.length || 0} Clients)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider">
                    <p className="font-extrabold text-rose-600 dark:text-rose-400">⚠️ CRITICAL NOTICE:</p>
                    <p>Deleting a billing recovery sheet is completely irreversible. All collection logs, customer payment statuses, and specific arrears references for the chosen period will be deleted from the database permanently.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteSheetModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!sheetIdToDelete}
                    onClick={() => handleDeleteBillingMonth(sheetIdToDelete)}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-rose-500/15"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showGoogleConnectModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowGoogleConnectModal(false);
                setIsConnecting(false);
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-500/30 overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Zap size={20} className="animate-bounce" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Google Sheet Connection</h3>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Permanent Background Sync</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGoogleConnectModal(false);
                      setIsConnecting(false);
                    }}
                    className="p-1 rounded-full text-slate-450 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 bg-transparent border-none transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Explanatory notes */}
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                    <p className="font-extrabold text-amber-600 dark:text-amber-400 mb-1">ℹ️ Google Webview Security Notice:</p>
                    Google blocks direct login within specialized embedded web frame panels or Electron custom wrappers with <strong className="text-rose-500 font-bold">"This browser or app may not be secure"</strong>.
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 space-y-3">
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-extrabold leading-relaxed text-right font-sans">
                      برائے مہربانی نیچے دیے گئے بٹن پر کلک کر کے گوگل لاگ ان پیج کو اپنے اصل کمپیوٹر براؤزر (جیسے کروم، برائیو، یا ایج) میں کھولیں اور وہاں سے لاگ ان کریں:
                    </p>
                    
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          window.open(googleConnectUrl, '_blank');
                        } catch (e) {
                          toast.error("Failed to trigger browser window automatically. Please copy the link manually.");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-550 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-black uppercase tracking-widest text-[9px] transition-all shadow-md shadow-brand-accent/5 cursor-pointer"
                    >
                      <Globe size={13} />
                      Open in Default Browser / کروم / ڈیفالٹ براؤزر میں کھولیں
                    </button>
                  </div>

                  {/* Manual link copying as robust fallback */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-450 ml-1">Or Copy Direct Authorization Link:</label>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-250/30 dark:border-slate-850 focus-within:ring-2 focus-within:ring-amber-500/30 transition-all">
                      <input
                        type="text"
                        readOnly
                        value={googleConnectUrl}
                        className="flex-1 bg-transparent border-none text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyText(googleConnectUrl, 'Google Auth Link')}
                        className="py-1.5 px-3 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 cursor-pointer"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>

                  {/* Live sync pulse status */}
                  <div className="flex items-center justify-center gap-3 py-3 border-t border-slate-50 dark:border-slate-850/50 text-[10px] uppercase font-bold tracking-widest text-slate-450 dark:text-slate-500">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span>Waiting for your desktop browser authorization...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {userToDelete && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-rose-500/30 overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
                  <ShieldAlert size={40} className="text-rose-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Security Protocol</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose text-center">
                    Are you sure you want to permanently terminate user <span className="text-rose-500 font-black">@{userToDelete.username}</span> from the network?
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={async () => {
                      if (userToDelete) {
                        try {
                          await onDeleteUser(userToDelete.uid);
                          setUserToDelete(null);
                          toast.success(`User ${userToDelete.username} terminated`);
                        } catch (err) {
                          toast.error('Termination failed: Insufficient clearance');
                        }
                      }
                    }}
                    className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95"
                  >
                    Confirm Termination
                  </button>
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="w-full py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-500 font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                  >
                    Abort Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="space-y-12">
      {activeTab === 'complaints' ? (
        renderHomeSections()
      ) : (
        <>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'dealers_data' && currentUser.role === 'super_admin' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-black uppercase tracking-tight">Dealer Intelligence</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select an authorized dealer network to audit operational performance</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button 
                  onClick={() => setSelectedDealerId('all')}
                  className={cn(
                    "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    selectedDealerId === 'all' ? "bg-slate-950 dark:bg-brand-accent text-white" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Global View
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {users.filter(u => u.role === 'dealer').map((dealer, i) => {
                const dealerComplaints = complaints.filter(c => c.dealerId === dealer.uid);
                const pending = dealerComplaints.filter(c => c.status === 'pending').length;
                const completed = dealerComplaints.filter(c => c.status === 'complete').length;
                
                return (
                  <motion.div
                    key={`${dealer.uid}-${i}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedDealerId(dealer.uid);
                      setActiveTab('complaints');
                    }}
                    className={cn(
                      "p-6 rounded-2xl border-2 transition-all cursor-pointer group",
                      selectedDealerId === dealer.uid 
                        ? "bg-slate-950 dark:bg-brand-accent text-white border-slate-950 dark:border-brand-accent" 
                        : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-brand-accent/50"
                    )}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        selectedDealerId === dealer.uid ? "bg-white/10" : "bg-slate-100 dark:bg-slate-900"
                      )}>
                        <TrendingUp size={24} className={selectedDealerId === dealer.uid ? "text-white" : "text-brand-accent"} />
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                        selectedDealerId === dealer.uid ? "bg-white/20 border-white/30" : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                      )}>
                        {dealer.lineCode}
                      </div>
                    </div>
                    
                    <h4 className="text-lg font-black uppercase tracking-tight mb-1 truncate">{dealer.username}</h4>
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-6", selectedDealerId === dealer.uid ? "text-white/60" : "text-slate-400")}>Authorized Dealer Network</p>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 dark:border-slate-800">
                      <div>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedDealerId === dealer.uid ? "text-white/40" : "text-slate-500")}>Operations</p>
                        <p className="text-xl font-black tracking-tighter">{dealerComplaints.length}</p>
                      </div>
                      <div>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedDealerId === dealer.uid ? "text-white/40" : "text-slate-500")}>Pending</p>
                        <p className="text-xl font-black tracking-tighter text-amber-500">{pending}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {users.filter(u => u.role === 'dealer').length === 0 && (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert size={32} className="text-slate-300" />
                </div>
                <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">No Active Dealer Networks</h4>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Authorize dealers in the "Dealer Section" to start auditing their data.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'submit' && (
          <div className="max-w-4xl mx-auto">
            <div 
              className="text-center space-y-2 mb-10 cursor-pointer select-none group"
              onDoubleClick={() => setIsFormVisible(!isFormVisible)}
              title="Double-click to toggle form"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 group-hover:scale-105 transition-transform duration-500">Field Operations</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Capture and process enterprise support requests</p>
            </div>
            
            <AnimatePresence mode="wait">
              {isFormVisible && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)', y: 20 }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                  exit={{ 
                    opacity: 0, 
                    scale: 0.8, 
                    x: 400, 
                    y: -100, 
                    rotate: 15, 
                    skewX: 40, 
                    filter: 'blur(50px)',
                    transition: { duration: 1.2, ease: [0.4, 0, 0.2, 1] }
                  }}
                  transition={{ 
                    duration: 0.8, 
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="origin-left"
                >
                  <div className="pt-2 pb-8">
                    <ComplaintForm 
                      onSubmit={async (data) => {
                        await onRegisterComplaint(data);
                        setActiveTab('complaints');
                      }} 
                      isLoading={isLoading || false} 
                      appConfig={appConfig}
                      currentUser={currentUser}
                      branding={branding}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'clients' && (
          <ClientManagement 
            appConfig={appConfig} 
            isAdmin={true} 
            currentUser={currentUser} 
            currentUserName={users.find(u => u.uid === currentUser.uid)?.username || 'Admin'} 
            isBillingUnlocked={isBillingUnlocked}
          />
        )}

        {activeTab === 'top10' && (
          <div className="max-w-4xl mx-auto business-card p-8 bg-white dark:bg-slate-950">
             <div className="text-center space-y-2 mb-10">
                <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">Top 10 Complainers</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Highest frequency support request identifiers</p>
             </div>
             <div className="space-y-4">
                {Object.entries(
                  complaints.reduce((acc, curr) => {
                    const key = curr.customerUsername || curr.customerName;
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count], i) => (
                  <div key={`top10-${name}-${i}`} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 group hover:border-brand-accent transition-all">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                        i === 0 ? "bg-amber-500 text-white" : 
                        i === 1 ? "bg-slate-400 text-white" :
                        i === 2 ? "bg-amber-700 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      )}>
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-tight">{name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Node Identity</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black text-brand-accent tracking-tighter">{count}</p>
                       <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Total Tickets</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div className="max-w-4xl mx-auto">
            <HighFrequencyNodes complaints={complaints} />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
            <div className={cn("p-8", getCardStyle(branding.cardStyle))}>
                <h3 className="text-lg font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                  <UserPlus size={20} className="text-brand-accent" />
                  Link Access
                </h3>
                {formError && (
                  <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    {formSuccess}
                  </div>
                )}
                <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Employee Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toUpperCase())}
                      placeholder="e.g. john_doe"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Full Name</label>
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value.toUpperCase())}
                      placeholder="e.g. John Doe"
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Access Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Clearance Level</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewUserRole('member')}
                        className={cn(
                          "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                          newUserRole === 'member' 
                            ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent" 
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
                        )}
                      >
                        Field Agent
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUserRole('liteadmin')}
                        className={cn(
                          "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                          newUserRole === 'liteadmin' 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20" 
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
                        )}
                      >
                        Lite Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUserRole('admin')}
                        className={cn(
                          "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                          newUserRole === 'admin' 
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20" 
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
                        )}
                      >
                        Supervisor
                      </button>
                      {currentUser.role === 'super_admin' && (
                        <button
                          type="button"
                          onClick={() => setNewUserRole('super_admin')}
                          className={cn(
                            "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border col-span-2 sm:col-span-1",
                            newUserRole === 'super_admin' 
                              ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20" 
                              : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
                          )}
                        >
                          Super Admin
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-4 rounded-lg bg-slate-900 dark:bg-brand-accent text-white font-bold uppercase tracking-widest text-[11px] shadow-lg hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-all"
                  >
                    {isCreating ? 'Processing Reg...' : 'Initialize Link Access Member'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="business-card overflow-hidden bg-white dark:bg-slate-950">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                   <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Link Access Directory</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Clearance</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Created From</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Registry Date</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {users
                      .filter(u => {
                        const isNotDealer = u.role !== 'dealer';
                        const isNotSelfSuperAdmin = u.role !== 'super_admin' || u.uid === currentUser.uid;
                        
                        // Show all users to super_admin and admin, but for dealers only show their own network.
                        const belongsToMyTenant = currentUser.role === 'super_admin' || currentUser.role === 'admin' || u.dealerId === currentUser.uid;
                        
                        return isNotDealer && isNotSelfSuperAdmin && belongsToMyTenant;
                      })
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((user, idx) => (
                      <tr key={`${user.uid}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4">
                          {editingUserId === user.uid ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                placeholder="Username"
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                              />
                              <input
                                type="text"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                placeholder="Full Name"
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                              />
                              <input
                                type="text"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                              />
                              {currentUser.role === 'super_admin' && user.role === 'dealer' && (
                                <input
                                  type="text"
                                  value={editLineCode}
                                  onChange={(e) => setEditLineCode(e.target.value)}
                                  placeholder="Line Code"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{user.fullName || user.username}</span>
                              {user.fullName && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">@{user.username}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingUserId === user.uid && currentUser.role === 'super_admin' ? (
                            <select
                              value={editUserRole}
                              onChange={(e) => setEditUserRole(e.target.value as any)}
                              className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900 uppercase font-black"
                            >
                              <option value="member">Member</option>
                              <option value="liteadmin">Lite Admin</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                              <option value="dealer">Dealer</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "px-2.5 py-1 rounded text-xs font-black uppercase tracking-widest border",
                              user.role === 'super_admin' ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/30" :
                              user.role === 'admin' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30" :
                              user.role === 'liteadmin' ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30" :
                              user.role === 'dealer' ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30" :
                              "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                            )}>
                              {user.role}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn(
                             "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border",
                             user.status === 'pending' ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30 animate-pulse" :
                             user.status === 'blocked' ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30" :
                             "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                           )}>
                             {user.status || 'active'}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                            {user.createdByName || (user.createdBy === 'system' ? 'System' : 'Unknown Agent')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-medium text-slate-400 uppercase tracking-tighter">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {editingUserId === user.uid ? (
                              <>
                                <button
                                  onClick={() => handleUpdateUser(user.uid)}
                                  disabled={isUpdating}
                                  className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                  title="Save Changes"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={handleCancelEditUser}
                                  className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-all"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                {user.uid !== currentUser.uid && (
                                  <button
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('openChat', { detail: user.uid }));
                                    }}
                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                    title="Private Message"
                                  >
                                    <MessageSquare size={16} />
                                  </button>
                                )}
                                {user.uid !== currentUser.uid && currentUser.role === 'super_admin' && (
                                  <>
                                    {user.status === 'pending' && (
                                      <button
                                        onClick={() => onUpdateUserStatus(user.uid, 'active')}
                                        className="p-2 text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                        title="Approve Request"
                                      >
                                        <CheckCircle size={16} />
                                      </button>
                                    )}
                                    {user.status !== 'blocked' ? (
                                      <button
                                        onClick={() => onUpdateUserStatus(user.uid, 'blocked')}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Block User"
                                      >
                                        <Ban size={16} />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => onUpdateUserStatus(user.uid, 'active')}
                                        className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                        title="Unblock User"
                                      >
                                        <CheckCircle size={16} />
                                      </button>
                                    )}
                                  </>
                                )}
                                <button
                                  onClick={() => handleStartEditUser(user)}
                                  className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                  title="Edit Credentials"
                                >
                                  <Pencil size={16} />
                                </button>
                                {user.uid !== currentUser.uid && (
                                  <button
                                    onClick={() => setUserToDelete(user)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Revoke Access"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gmail' && (
          <GmailPanel
            currentUser={currentUser}
            appConfig={appConfig}
            complaints={complaints}
          />
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <div className="business-card p-10 bg-white dark:bg-slate-950">
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
                  <Volume2 size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">System Audio & Matrix</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Notification Matrix & Hardware Control</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Audio Matrix Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Audio & Speaker Hub</h4>
                  {!alertAuthorized ? (
                    <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-4 leading-relaxed uppercase tracking-widest text-center">
                        Synthesizer and alert speakers are restricted by current policy.
                      </p>
                      <button
                        onClick={onAuthorizeAlerts}
                        className="w-full py-4 rounded-xl bg-amber-500 text-white font-black uppercase tracking-widest text-xs shadow-lg hover:bg-amber-600 transition-all"
                      >
                        Initialize Speaker Matrix
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          {isAudioMuted ? <VolumeX className="text-rose-500" size={18} /> : <Volume2 className="text-emerald-500" size={18} />}
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Alert Audio</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{isAudioMuted ? 'Notifications Suspended' : 'Notifications Active'}</p>
                          </div>
                        </div>
                        <button
                          onClick={onToggleAudio}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            isAudioMuted ? "bg-emerald-500 text-white shadow-lg" : "bg-rose-500 text-white shadow-lg"
                          )}
                        >
                          {isAudioMuted ? 'Turn On' : 'Turn Off'}
                        </button>
                      </div>

                      <button
                        onClick={onSoundTest}
                        className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-3"
                      >
                        <Zap size={14} className="text-amber-500" />
                        Execute Speaker Sync Test
                      </button>
                    </div>
                  )}
                </div>

                {/* Microphone Section */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tactical Voice Input</h4>
                  {!micAuthorized ? (
                    <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 leading-relaxed uppercase tracking-widest text-center">
                        Microphone capture protocols are currently offline.
                      </p>
                      <button
                        onClick={onAuthorizeMic}
                        className="w-full py-4 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs shadow-lg hover:bg-blue-700 transition-all"
                      >
                        Authorize Mic Input
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          {isMicMuted ? <VolumeX className="text-rose-500" size={18} /> : <Mic className="text-blue-500" size={18} />}
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Tactical Mic</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{isMicMuted ? 'Capture Suppressed' : 'Capture Active'}</p>
                          </div>
                        </div>
                        <button
                          onClick={onToggleMic}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            isMicMuted ? "bg-emerald-500 text-white shadow-lg" : "bg-rose-500 text-white shadow-lg"
                          )}
                        >
                          {isMicMuted ? 'Turn On' : 'Turn Off'}
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <MicVisualizer isMuted={isMicMuted} isAuthorized={micAuthorized} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={onLogout}
                    className="w-full py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                  >
                    <LogOut size={16} />
                    Sign Out Session
                  </button>
                </div>
              </div>
            </div>

            {currentUser.role === 'super_admin' && (
              <div className="space-y-8">
                <div className="business-card p-10 bg-white dark:bg-slate-950">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-900 dark:text-brand-accent shadow-sm">
                      <Shield size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Security Hardening</h3>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Personnel Authorization Management</p>
                    </div>
                  </div>

                  <form onSubmit={handleChangeAdminPass} className="space-y-8">
                    <div className="space-y-2">
                      <label className={labelClasses}>New Supervisor Passkey</label>
                      <div className="relative">
                        <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="password"
                          value={adminNewPass}
                          onChange={(e) => setAdminNewPass(e.target.value)}
                          placeholder="Initialize secure passkey replacement"
                          className={inputClasses}
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="px-8 py-4 rounded-lg bg-slate-900 dark:bg-brand-accent text-white font-bold uppercase tracking-widest text-xs shadow-lg hover:bg-black dark:hover:bg-blue-700 transition-all"
                    >
                      Confirm Passkey Revision
                    </button>
                  </form>
                </div>

                <div className={cn("p-8 bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30", getCardStyle(branding.cardStyle))}>
                  <h3 className="text-lg font-black uppercase tracking-tight text-rose-600 mb-2">Protocol Reset</h3>
                  <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">WARNING: Initiating a factory reset will terminate all existing operations, registries, and login accounts. This action is final and non-reversible.</p>
                  <button
                    onClick={handleResetAppData}
                    className="px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] uppercase font-black tracking-widest transition-all shadow-xl shadow-rose-500/20"
                  >
                    Execute Global Purge
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'dealers' && currentUser.role === 'super_admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className={cn("p-8 border-emerald-500/20 ring-1 ring-emerald-500/10", getCardStyle(branding.cardStyle))}>
                <h3 className="text-lg font-black uppercase tracking-tight mb-8 flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                  <ShieldAlert size={20} />
                  Dealer Setup
                </h3>
                {formError && (
                  <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    {formSuccess}
                  </div>
                )}
                <form onSubmit={handleCreateUser} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Dealer Name</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toUpperCase())}
                      placeholder="e.g. John Doe"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Dealer Passkey</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Dealer Line Code</label>
                    <input
                      type="text"
                      value={newLineCode}
                      onChange={(e) => setNewLineCode(e.target.value.toUpperCase())}
                      placeholder="e.g. DLR-99"
                      className={cn(inputClasses, "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10")}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Leader Company Name</label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value.toUpperCase())}
                      placeholder="e.g. Tech Solutions"
                      className={inputClasses}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-4 rounded-lg bg-emerald-600 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-emerald-500/20"
                  >
                    {isCreating ? 'Provisioning...' : 'Authorize New Dealer Account'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="business-card overflow-hidden bg-white dark:bg-slate-950">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                   <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Authorized Dealers Registry</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity / Company</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Line Code</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Node Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Protocol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {users.filter(u => u.role === 'dealer').length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 uppercase font-black tracking-widest text-xs">No Dealers Authorized in Registry</td>
                      </tr>
                    ) : (
                      users.filter(u => u.role === 'dealer').map((dealer, i) => (
                         <tr key={`${dealer.uid}-${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-4">
                            {editingUserId === dealer.uid ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value)}
                                  placeholder="Dealer Name"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="text"
                                  value={editCompanyName}
                                  onChange={(e) => setEditCompanyName(e.target.value)}
                                  placeholder="Company Name"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="text"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="New Passkey"
                                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{dealer.username}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{dealer.companyName || 'No Company Set'}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editingUserId === dealer.uid ? (
                              <input
                                type="text"
                                value={editLineCode}
                                onChange={(e) => setEditLineCode(e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900"
                                placeholder="Line Code"
                              />
                            ) : (
                              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded border border-emerald-200 dark:border-emerald-800/50">
                                {dealer.lineCode}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] font-black text-slate-400 uppercase">Operational</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               {editingUserId === dealer.uid ? (
                                 <>
                                   <button
                                     onClick={() => handleUpdateUser(dealer.uid)}
                                     disabled={isUpdating}
                                     className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                     title="Save Changes"
                                   >
                                     <Check size={16} />
                                   </button>
                                   <button
                                     onClick={handleCancelEditUser}
                                     className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-all"
                                     title="Cancel"
                                   >
                                     <X size={16} />
                                   </button>
                                 </>
                               ) : (
                                 <>
                                   <button
                                     onClick={() => {
                                       window.dispatchEvent(new CustomEvent('openChat', { detail: dealer.uid }));
                                     }}
                                     className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                     title="Communicate with Dealer"
                                   >
                                     <MessageSquare size={16} />
                                   </button>
                                   <button
                                      onClick={() => handleStartEditUser(dealer)}
                                      className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                      title="Edit Dealer"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => setUserToDelete(dealer)}
                                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                      title="Revoke Permission"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                 </>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'dealer') && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
              {/* Category Management */}
              <div className={cn("p-6", getCardStyle(branding.cardStyle))}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Service Categories</h4>
                  <Layers size={16} className="text-blue-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Category..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.categories.includes(val)) {
                            onUpdateConfig({ ...appConfig, categories: [...appConfig.categories, val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {appConfig.categories.map((cat, i) => (
                      <div key={`cat-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300 uppercase">{cat}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.categories.length > 1) {
                              onUpdateConfig({ ...appConfig, categories: appConfig.categories.filter(c => c !== cat) });
                            } else {
                              toast.error('At least one category is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Management */}
              <div className={cn("p-6", getCardStyle(branding.cardStyle))}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Workflow Statuses</h4>
                  <Activity size={16} className="text-amber-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Status..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.statuses.includes(val)) {
                            onUpdateConfig({ ...appConfig, statuses: [...appConfig.statuses, val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {appConfig.statuses.map((stat, i) => (
                      <div key={`stat-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300">{stat}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.statuses.length > 1) {
                              onUpdateConfig({ ...appConfig, statuses: appConfig.statuses.filter(s => s !== stat) });
                            } else {
                              toast.error('At least one status is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Priority Management */}
              <div className={cn("p-6", getCardStyle(branding.cardStyle))}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Priority Levels</h4>
                  <ShieldAlert size={16} className="text-rose-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Priority..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.priorities.includes(val)) {
                            onUpdateConfig({ ...appConfig, priorities: [...appConfig.priorities, val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {appConfig.priorities.map((pri, i) => (
                      <div key={`pri-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300">{pri}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.priorities.length > 1) {
                              onUpdateConfig({ ...appConfig, priorities: appConfig.priorities.filter(p => p !== pri) });
                            } else {
                              toast.error('At least one priority level is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Zone Management */}
              <div className={cn("p-6", getCardStyle(branding.cardStyle))}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Operation Zones</h4>
                  <MapPin size={16} className="text-emerald-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add Zone..." 
                      className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !appConfig.zones?.includes(val)) {
                            onUpdateConfig({ ...appConfig, zones: [...(appConfig.zones || []), val] });
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {appConfig.zones?.map((zone, i) => (
                      <div key={`zone-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-tight">
                        <span className="text-slate-700 dark:text-slate-300">{zone}</span>
                        <button 
                          onClick={() => {
                            if (appConfig.zones.length > 1) {
                              onUpdateConfig({ ...appConfig, zones: appConfig.zones.filter(z => z !== zone) });
                            } else {
                              toast.error('At least one zone is required.');
                            }
                          }}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
              <Info className="text-blue-600 mt-0.5" size={16} />
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-widest">
                System configuration shifts are propagated in real-time to all members. Changes to categories, statuses, and zones will immediately reflect in the submission and auditing forms.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (currentUser.role === 'super_admin' || currentUser.role === 'editor') && (
          <EditorPanel branding={branding} onUpdate={onUpdateBranding} />
        )}

        {/* Cloud Sync Tab */}
        {activeTab === 'integrations' && (currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className={cn("p-8 sm:p-12", getCardStyle(branding.cardStyle))}>
              {window.self !== window.top && !googleTokens && (
                <div className="mb-8 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-800 dark:text-slate-200">
                  <div className="flex gap-4 items-start">
                    <span className="text-2xl mt-0.5">⚠️</span>
                    <div className="space-y-2">
                      <h4 className="text-sm font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                        Running Inside iframe / Hugging Face
                      </h4>
                      <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                        Hugging Face runs this app inside a sandboxed iframe, which blocks Google login popups. 
                        To authorize your Google account smoothly without any blockers, click the button below to open this app directly in a separate browser tab:
                      </p>
                      <div className="pt-2">
                        <a
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95"
                        >
                          Open in Direct Tab
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-emerald-600">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Google Sheets Sync</h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">One-Time Enterprise Synchronization</p>
                  </div>
                </div>

                {!googleTokens ? (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => handleGoogleConnect('server')}
                      disabled={isConnecting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-900 dark:bg-brand-accent hover:bg-black dark:hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-xl shadow-brand-accent/20 active:scale-95 disabled:opacity-50"
                    >
                      <Zap size={14} className="text-amber-400" />
                      {isConnecting ? 'Linking Permanent...' : 'Connect Permanent Sync'}
                    </button>
                    <button
                      onClick={() => handleGoogleConnect('firebase')}
                      disabled={isConnecting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <ExternalLink size={14} />
                      {isConnecting ? 'Linking Firebase...' : 'Fast Connect (Firebase)'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {googleTokens && !googleTokens.refresh_token ? (
                      <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          Reconnect Required for Background Sync
                        </span>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Sync Active</span>
                      </div>
                    )}
                    <button 
                      onClick={() => { googleSheetsService.clearAuth(); setGoogleTokens(null); }} 
                      className="text-xs font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors py-2 px-3 hover:bg-rose-500/5 rounded-xl border border-transparent hover:border-rose-500/15"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Zap size={16} className="text-brand-accent" />
                    How it works
                  </h4>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    Once authorized, every operational log will be mirrored to your chosen Google Spreadsheet in real-time. This provides an immutable enterprise backup outside the main database.
                  </p>
                  <div className="space-y-3">
                    {[
                      'Real-time data propagation',
                      'Enterprise-grade CSV backups',
                      'Immutable audit logs'
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                {googleTokens && (
                  <div className="space-y-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="space-y-4">
                      <div className="space-y-2">
                         <label className={labelClasses}>Spreadsheet ID</label>
                         <div className="flex gap-2">
                           <input 
                             type="text" 
                             value={spreadsheetId} 
                             onChange={(e) => setSpreadsheetId(e.target.value)} 
                             className={inputClasses} 
                             placeholder="Paste Spreadsheet ID here" 
                           />
                           <button 
                             onClick={handleCreateSheet}
                             disabled={isCreatingSheet}
                             className="px-4 rounded-xl bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center shrink-0 min-w-[100px]"
                           >
                             {isCreatingSheet ? 'Creating...' : 'Create New'}
                           </button>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <label className={labelClasses}>Tab Name</label>
                            <input type="text" value={sheetName} onChange={(e) => setSheetName(e.target.value)} className={inputClasses} placeholder="Sheet1" />
                         </div>
                         <div className="space-y-2">
                            <label className={labelClasses}>Range</label>
                            <input type="text" value={sheetRange} onChange={(e) => setSheetRange(e.target.value)} className={inputClasses} placeholder="A1" />
                         </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          handleSaveSpreadsheetId();
                          handleSaveRangeSettings();
                        }} 
                        className="w-full py-4 rounded-xl bg-slate-900 dark:bg-brand-accent text-white font-black uppercase tracking-widest text-[11px] shadow-lg hover:shadow-brand-accent/20 transition-all active:scale-95"
                      >
                        Initialize Synchronization
                      </button>
                    </div>
                  </div>
                )}

                {!googleTokens && (
                  <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center leading-relaxed">
                      Please link your Google account<br/>to reveal mirroring parameters
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {googleTokens && (
              <div className="flex flex-col items-center gap-4 mt-2">
                 <button
                  onClick={handleBulkExport}
                  disabled={isExporting}
                  className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all shadow-sm"
                >
                  {isExporting ? 'Exporting...' : 'Perform Bulk System Export'}
                  <CloudUpload size={14} className={isExporting ? "animate-bounce" : ""} />
                </button>
                <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 max-w-sm w-full text-center">
                  {googleTokens && !googleTokens.refresh_token ? (
                    <>
                      <div className="flex items-center gap-2 mb-1 justify-center">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Background Auto Sync: Idle
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Automatic background backup is currently paused because your account has not been granted offline refresh permissions yet. Please disconnect and reconnect your Google Account to automatically sync.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1 justify-center">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Background Auto Sync: Active
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        Saves full system logs, users, clients, and configuration automatically to Google Sheets every 10 minutes.
                      </p>
                    </>
                  )}
                  {lastAutoBackupTime ? (
                    <div className="mt-3 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        LAST EXPORTED: <span className="font-mono text-emerald-600 dark:text-emerald-400">{new Date(lastAutoBackupTime).toLocaleTimeString()}</span>
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400/80 uppercase tracking-wider">
                        ({new Date(lastAutoBackupTime).toLocaleDateString()})
                      </span>
                    </div>
                  ) : (
                    <span className="mt-3 font-mono text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded">
                      Pending Initial Sync
                    </span>
                  )}
                </div>
              </div>
            )}



            {/* Real Offline A to Z Local Backup and Restore Panel */}
            <div className={cn("p-8 sm:p-12", getCardStyle(branding.cardStyle))}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
                    <HardDriveDownload size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Enterprise Backup & Restore</h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">A to Z Absolute Database Preservation</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleGenerateLocalBackup}
                  disabled={isGeneratingBackup}
                  className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-xl bg-slate-900 dark:bg-brand-accent hover:bg-black dark:hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-xl shadow-brand-accent/10 active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingBackup ? 'Compiling Archive...' : 'Download Full System Backup'}
                  <HardDriveDownload size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-6">
                <div className="space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Info size={16} className="text-brand-accent" />
                    Absolute Backups Include
                  </h4>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    Downloads an instant local Snapshot containing every complaint logged, and all corresponding timestamps, details, custom brand definitions, profiles configurations, registered client details and offline structures safely.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    {[
                      'Complaints with date & time',
                      'Registered panel users',
                      'Skins & branding configuration',
                      'Operational logs / activity stream',
                      'Clients registry profiles',
                      'System matrices and maps data'
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <CloudUpload size={16} className="text-brand-accent" />
                    Power System Restoration
                  </h4>

                  {/* Drag and Drop Region */}
                  {!restoreFile ? (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={cn(
                        "p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[160px]",
                        dragActive 
                          ? "border-brand-accent bg-brand-accent/10" 
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      )}
                      onClick={() => document.getElementById('restore-file-input2')?.click()}
                    >
                      <input
                        id="restore-file-input2"
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <CloudUpload size={32} className="text-slate-400 mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        Drag & Drop Backup File (.json)
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        or click to select file
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                            {restoreFile.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium font-mono">
                            {(restoreFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setRestoreFile(null); setUploadedBackupData(null); }}
                          className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {uploadedBackupData && (
                        <div className="p-3 bg-white/60 dark:bg-slate-950/40 rounded-xl space-y-1 text-[10px] border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between font-bold text-slate-500 uppercase tracking-wider">
                            <span>Compiled On:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-300 text-right">
                              {new Date(uploadedBackupData.exportedAt).toLocaleDateString()} {new Date(uploadedBackupData.exportedAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-500 uppercase tracking-wider flex-wrap gap-1">
                            <span>Exporter:</span>
                            <span className="font-mono text-slate-800 dark:text-slate-300 break-all text-right max-w-[150px] truncate">
                              {uploadedBackupData.metadata?.exportedBy || "Anonymous"}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-500 uppercase tracking-wider text-right">
                            <span>Records volume:</span>
                            <span className="font-mono text-brand-accent text-right">
                              {uploadedBackupData.data?.complaints?.length || 0} complaints, {uploadedBackupData.data?.clients?.length || 0} clients
                            </span>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleExecuteRestore}
                        disabled={isRestoringBackup}
                        className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isRestoringBackup ? 'Rewriting Database...' : 'CONFIRM & RESTORE FULL SYSTEM'}
                        <CheckCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Supabase Link & Live Migration Console */}
            <div className={cn("p-8 sm:p-12 mt-6", getCardStyle(branding.cardStyle))}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                    <CloudUpload size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Supabase Migration & Link</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Direct Browser Database Switcher Matrix</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadSupabaseSQL}
                    disabled={isExportingSql || isMigratingLive}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                  >
                    {isExportingSql ? 'Generating SQL...' : 'Download Supabase SQL Script'}
                    <HardDriveDownload size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-blue-500">
                    <Info size={16} />
                    Live Browser Migration
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed">
                    By entering your Supabase API credentials below, our frontend migration engine will fetch all current collections directly and sync/upload them automatically to your PostgreSQL public schema in parallel batches.
                  </p>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-2">
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Zap size={12} className="text-amber-400" />
                      Automatic Bypass Setup
                    </h5>
                    <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      The generated SQL script provisions tables and temporarily activates relaxed Row Level Security (RLS) bypass rules so your frontend can communicate with Supabase seamlessly without requiring server proxies.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://your-project.supabase.co"
                      style={{ color: 'inherit' }}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-1 focus:ring-brand-accent focus:border-brand-accent transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Supabase Service Role API Key (service_role)
                    </label>
                    <input
                      type="password"
                      value={supabaseServiceKey}
                      onChange={(e) => setSupabaseServiceKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      style={{ color: 'inherit' }}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs focus:ring-1 focus:ring-brand-accent focus:border-brand-accent transition-all placeholder:text-slate-400"
                    />
                    <p className="text-[9px] font-semibold text-slate-400/85">
                      💡 Use the <strong className="text-slate-500 dark:text-slate-300">service_role</strong> secret API key instead of anon key to bypass Postgres rate limits/write constraints.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLiveSupabaseMigration}
                    disabled={isMigratingLive || isExportingSql || !supabaseUrl || !supabaseServiceKey}
                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isMigratingLive ? 'Synchronizing Datasets...' : 'EXECUTE DIRECT API MIGRATION'}
                    <Zap size={14} className="text-amber-400 animate-pulse" />
                  </button>
                </div>
              </div>

              {migrationLogs.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Migration Console Terminal Logs
                    </span>
                    <button
                      onClick={() => setMigrationLogs([])}
                      className="text-[9px] font-black uppercase tracking-widest text-rose-500 shrink-0 hover:underline cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-400 bg-slate-950 p-5 rounded-xl max-h-60 overflow-y-auto space-y-1 border border-slate-900 shadow-inner scrollbar-thin">
                    {migrationLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed whitespace-pre-wrap font-mono">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="max-w-[115rem] mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
            {/* Advanced Billing Recovery Header and Config Controls */}
            <div className={cn("p-8 sm:p-10", getCardStyle(branding.cardStyle), "space-y-6")}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-sm">
                    <FileSpreadsheet size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">WiFi Billing & Recovery</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Enterprise Recovery Ledger & User Recheck Console</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEntrySheetOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-accent hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-md shadow-brand-accent/20"
                  >
                    <ClipboardList size={14} />
                    Entry Sheet
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBatchPrintOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:opacity-95 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-md shadow-blue-500/10"
                  >
                    <Printer size={14} />
                    Batch Print
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfiguringNewMonth(true)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700/80 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-md"
                  >
                    <PlusSquare size={14} />
                    New Billing Month
                  </button>

                  {currentMonthId && (
                    <>
                      <button
                        type="button"
                        onClick={handleRecheckUsers}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                        title="Search for newly added client registries in the system and incorporate them instantly into this spreadsheet cycle"
                      >
                        <Users size={14} />
                        Recheck User List
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadCSV}
                        disabled={!activeRows.length}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50 border border-slate-200 dark:border-slate-700"
                      >
                        <HardDriveDownload size={14} />
                        Download Sheets CSV
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSheetIdToDelete(currentMonthId || (billingMonths[0]?.id || ''));
                          setIsDeleteSheetModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all active:scale-95 border border-rose-100 dark:border-rose-900/20"
                        title="Purge / delete monthly recovery sheets"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Configure New Month Popup-card Block */}
              <AnimatePresence>
                {isConfiguringNewMonth && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-w-lg"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-800">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Establish Monthly Recovery Cycle</span>
                      <button type="button" onClick={() => setIsConfiguringNewMonth(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Month Label</label>
                        <input
                          type="text"
                          value={newMonthName}
                          onChange={(e) => setNewMonthName(e.target.value)}
                          placeholder="e.g. JUN, JUL, OCT"
                          className="w-full px-4 py-3 text-xs uppercase font-black tracking-widest bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-blue-500 select-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Year Tag</label>
                        <select
                          value={newMonthYear}
                          onChange={(e) => setNewMonthYear(e.target.value)}
                          className="w-full px-4 py-3 text-xs font-mono font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-blue-500"
                        >
                          <option value="25">2025</option>
                          <option value="26">2026</option>
                          <option value="27">2027</option>
                          <option value="28">2028</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider">
                      Note: This will deploy a new billing sheet initialized with all current {masterClients.length} clients registered in the database, with calculated defaults based on their customized bandwidth packages.
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsConfiguringNewMonth(false)}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddMonth}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors shadow-lg shadow-blue-500/10"
                      >
                        Launch Recovery Cycle
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Months Folder Tabs - Google Sheet style at top */}
              {billingMonths.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-2">Recovery Sheets:</span>
                  {billingMonths.map((m) => {
                    const isSelected = m.id === currentMonthId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCurrentMonthId(m.id)}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg border",
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                      >
                        {m.id}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  No active sheets found. Click "New Billing Month" to initiate your connection recovery logs.
                </div>
              )}
            </div>

            {/* CENTRAL SECURITY CLEARANCE CONSOLE */}
            <div className={cn("p-6 sm:p-8", getCardStyle(branding.cardStyle), isBillingUnlocked ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10" : "border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/15", "space-y-4 rounded-2xl shadow-sm border")}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm transition-colors shrink-0", 
                    isBillingUnlocked 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                      : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  )}>
                    {isBillingUnlocked ? <Shield size={22} /> : <ShieldAlert size={22} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                      Billing Sheet Security Shield
                      <span className={cn("px-2.5 py-0.5 text-[9px] font-black tracking-widest uppercase rounded-full border shadow-sm",
                        isBillingUnlocked 
                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30" 
                          : "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
                      )}>
                        {isBillingUnlocked ? "UNLOCKED & ACTIVE" : "SECURED / VIEW-ONLY"}
                      </span>
                    </h4>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">
                      {isBillingUnlocked 
                        ? "You currently have administrative clearance to override recovery, edit amounts, sync tables, or discard rows."
                        : "Spreadsheet cell modification and administrative actions are disabled. Enter your Security Access Key to unlock write privileges."
                      }
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!isBillingUnlocked ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="password"
                        value={billingKeyInput}
                        onChange={(e) => setBillingKeyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUnlockBilling();
                        }}
                        placeholder="INPUT PASSKEY (e.g. 786786)..."
                        className="px-4 py-2.5 text-xs font-mono font-black tracking-widest bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-48 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleUnlockBilling}
                        className="px-5 py-3 bg-amber-500 hover:bg-amber-600 dark:bg-brand-accent dark:hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-md shrink-0 animate-pulse"
                      >
                        Verify Key
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {isEditingSecurityKey ? (
                        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80">
                          <input
                            type="text"
                            value={newSecurityKeyInput}
                            onChange={(e) => setNewSecurityKeyInput(e.target.value)}
                            placeholder="NEW KEY (e.g. 786786)..."
                            className="px-3 py-1.5 text-xs font-mono font-black tracking-widest bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 w-36 text-slate-900 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={handleSaveSecurityKey}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors border-none"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingSecurityKey(false)}
                            className="px-2.5 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[9px] font-black uppercase tracking-widest transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setNewSecurityKeyInput(appConfig.billingSecurityKey || '786786');
                              setIsEditingSecurityKey(true);
                            }}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Key size={12} className="text-blue-550" />
                            Edit Security Key
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setIsBillingUnlocked(false);
                              sessionStorage.removeItem('gts_billing_unlocked');
                              // Dispatch custom event to notify rest of components in real-time
                              window.dispatchEvent(new CustomEvent('gts-billing-unlocked-changed', { detail: false }));
                              setBillingKeyInput('');
                              toast.success("Billing spreadsheet re-locked successfully.");
                            }}
                            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-450 font-black uppercase tracking-widest text-[10px] rounded-xl transition-colors border border-rose-100 dark:border-rose-900/20 shadow-sm"
                          >
                            Relock Console
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentMonthId ? (
              <>
                {/* Advanced Bento-Style Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    {
                      label: "Expected Revenue",
                      val: `PKR ${(totalExpected).toLocaleString()}`,
                      desc: `Base Amount: PKR ${(totalBase).toLocaleString()}`,
                      borderColor: "border-l-indigo-500 dark:border-l-indigo-400",
                      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
                      glowColor: "group-hover:shadow-[0_15px_30px_rgba(99,102,241,0.15)]",
                      icon: <BarChart3 size={20} className="stroke-[2.5]" />
                    },
                    {
                      label: "CR Payments",
                      val: `PKR ${(totalCr).toLocaleString()}`,
                      desc: `Arrears/Credit Recoveries`,
                      borderColor: "border-l-fuchsia-500 dark:border-l-fuchsia-400",
                      badgeColor: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20",
                      glowColor: "group-hover:shadow-[0_15px_30px_rgba(217,70,239,0.15)]",
                      icon: <Coins size={20} className="stroke-[2.5]" />
                    },
                    {
                      label: "Fees Recovered",
                      val: `PKR ${(totalRecovered).toLocaleString()}`,
                      desc: `Actual payments received`,
                      borderColor: "border-l-emerald-500 dark:border-l-emerald-400",
                      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                      glowColor: "group-hover:shadow-[0_15px_30px_rgba(16,185,129,0.15)]",
                      icon: <CheckCircle size={20} className="stroke-[2.5]" />
                    },
                    {
                      label: "Outstanding Balances",
                      val: `PKR ${(totalOutstanding).toLocaleString()}`,
                      desc: "Pending subscriber fees",
                      borderColor: "border-l-amber-500 dark:border-l-amber-400",
                      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                      glowColor: "group-hover:shadow-[0_15px_30px_rgba(245,158,11,0.15)]",
                      icon: <AlertTriangle size={20} className="stroke-[2.5]" />
                    },
                    {
                      label: "Recovery Rate",
                      val: `${(recoveryRate).toFixed(1)}%`,
                      desc: "In-cycle performance index",
                      borderColor: "border-l-purple-500 dark:border-l-purple-400",
                      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                      glowColor: "group-hover:shadow-[0_15px_30px_rgba(139,92,246,0.15)]",
                      icon: <TrendingUp size={20} className="stroke-[2.5]" />
                    },
                    {
                      label: "Subscribers Active",
                      val: `${activeRows.length} Nodes`,
                      desc: `TDC: ${totalTDC} | Unpaid: ${totalPending}`,
                      borderColor: "border-l-sky-500 dark:border-l-sky-400",
                      badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                      glowColor: "group-hover:shadow-[0_15px_30px_rgba(14,165,233,0.15)]",
                      icon: <Users size={20} className="stroke-[2.5]" />
                    }
                  ].map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -6, scale: 1.02 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                        delay: i * 0.08
                      }}
                      className={cn(
                        "group relative p-5 sm:p-6 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-150 dark:border-slate-800 border-l-4",
                        card.borderColor,
                        "flex flex-col justify-between overflow-hidden shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 cursor-default",
                        card.glowColor
                      )}
                    >
                      {/* Subtle hover background accent glow */}
                      <div className="absolute inset-0 bg-transparent group-hover:bg-slate-50/25 dark:group-hover:bg-slate-800/20 transition-colors pointer-events-none" />

                      <div className="space-y-4 relative z-10">
                        {/* Header: Label and Icon */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 leading-none">
                            {card.label}
                          </span>
                          <div className={cn("p-1.5 sm:p-2 rounded-xl transition-transform duration-300 group-hover:scale-110 shrink-0", card.badgeColor)}>
                            {card.icon}
                          </div>
                        </div>

                        {/* Value and Stat */}
                        <div className="space-y-1.5">
                          <div className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight font-sans text-slate-900 dark:text-white leading-none" title={card.val}>
                            {card.val}
                          </div>
                          <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-relaxed whitespace-pre-wrap" title={card.desc}>
                            {card.desc}
                          </p>
                        </div>
                      </div>

                      {/* Glowing particle/indicator decoration inside card */}
                      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-slate-400 dark:bg-slate-600" />
                    </motion.div>
                  ))}
                </div>

                {/* Filters, Search and Real-Time Grid section */}
                <div className={cn("p-6 sm:p-8", getCardStyle(branding.cardStyle), "space-y-6")}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                      <Layers size={16} className="text-blue-500" />
                      Recovery Rows ({filteredRows.length} listed)
                      {isSheetLoaded && (
                        <button
                          onClick={() => setIsSheetLoaded(false)}
                          className="ml-2 text-[8.5px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 px-2 py-0.5 rounded-md bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 cursor-pointer transition-all inline-flex items-center gap-1 shrink-0"
                          title="Click to release sheet and free memory for ultimate speed"
                        >
                          🔒 Standby Mode
                        </button>
                      )}
                    </h4>

                    {/* Filters block */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Search box */}
                      <input
                        type="text"
                        value={billingSearchQuery}
                        onChange={(e) => setBillingSearchQuery(e.target.value)}
                        placeholder="Search Name, User ID, PPPoE..."
                        className="px-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-blue-500 w-full sm:w-64"
                      />

                      {/* Status selector */}
                      <select
                        value={billingStatusFilter}
                        onChange={(e) => setBillingStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-blue-500 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                      >
                        <option value="all">ALL PAYMENT FLAGS</option>
                        <option value="paid">PAID</option>
                        <option value="partial">PARTIAL</option>
                        <option value="unpaid">UNPAID</option>
                        <option value="tdc">TDC (SUSPENDED)</option>
                      </select>

                      {/* Area selector */}
                      <select
                        value={billingAreaFilter}
                        onChange={(e) => setBillingAreaFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-blue-500 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                      >
                        <option value="all">ALL AREAS</option>
                        {Array.from(new Set(activeRows.map((r: any) => r.area).filter(Boolean))).map((areaName: any) => (
                          <option key={areaName} value={areaName}>{areaName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Absolute Google Sheets Spreadsheet Emulator Layout (Horizontal Scroll single row grid) */}
                  {!isSheetLoaded ? (
                    <div className="border border-dashed border-blue-500/30 rounded-2xl bg-slate-50/50 dark:bg-slate-900/10 p-8 text-center flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden shadow-inner w-full">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      {isSheetLoading ? (
                        <div className="space-y-4 max-w-md w-full relative z-10 p-4">
                          <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5 font-sans font-extrabold text-blue-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                              Initializing Smooth Grid DOM...
                            </span>
                            <span className="font-mono text-blue-500">{sheetLoadingProgress}%</span>
                          </div>
                          
                          {/* Progress bar line */}
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner font-sans">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-75"
                              style={{ width: `${sheetLoadingProgress}%` }}
                            />
                          </div>
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest text-center animate-pulse">
                            {sheetLoadingProgress < 30 ? "⚡ Locking background processes..." :
                             sheetLoadingProgress < 65 ? "💾 Compiling memory structures..." :
                             sheetLoadingProgress < 90 ? "🚀 Mapping reactive user matrices..." :
                             "✨ Finalizing lag-free render..."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4 max-w-xl relative z-10">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-500/10 animate-pulse">
                              🚀 High Performance standby active
                            </span>
                          </div>
                          <div className="space-y-1">
                            <h5 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 font-sans">
                              <Layers size={14} className="text-blue-500 animate-pulse" />
                              Recovery Rows Spreadsheet Locked for speed
                            </h5>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-bold max-w-sm mx-auto uppercase">
                              Click below to initialize and render the reactive {filteredRows.length} billing registers instantly with 100% smooth scrolling.
                            </p>
                          </div>
                          
                          <motion.button
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={startSheetLoading}
                            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md shadow-blue-500/15 flex items-center gap-2 mx-auto cursor-pointer border border-blue-400/20"
                          >
                            <Layers size={12} />
                            <span>Load Live Recovery spreadsheet ({filteredRows.length} rows)</span>
                          </motion.button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-inner">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs text-slate-700 dark:text-slate-300">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-black uppercase text-[10px] tracking-wider text-slate-600 dark:text-slate-400 font-sans select-none whitespace-nowrap">
                            <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[50px] text-center">Sr#</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[200px]">NAME (EDIT)</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[140px]">USER ID (PPPoE)</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[150px]">MOBILE #</th>
                            <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[80px] text-center">AREA</th>
                            <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[80px] text-center">RT</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[110px] text-right">B. AMOUNT</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[110px] text-right">CR. (ARREARS)</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[120px] text-right bg-slate-100/50 dark:bg-slate-900/50">T. AMOUNT</th>
                            <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[80px] text-center">BD</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[120px] text-right bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600">RECOVERY</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[120px] text-center">STATUS</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[240px]">COMMENTS</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[120px]">OCCUPATION</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[140px]">SER NAM</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[110px]">PKG DETAILS</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[110px] text-center">DATE</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[100px] text-right">DEVICE</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[100px] text-right">ABL</th>
                            <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 min-w-[110px]">NETWORK</th>
                            <th className="py-3 px-3 text-center min-w-[60px]">ACT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px] font-bold">
                          {filteredRows.map((rowRef, localIdx) => {
                            // Find corresponding absolute row index in full month rows array
                            const globalRowIdx = activeRows.findIndex((r: any) => r.clientId === rowRef.clientId || r.username === rowRef.username);
                            if (globalRowIdx === -1) return null;
                            
                            const outstandingCr = parseFloat(rowRef.cr) || 0;
                            const isPaid = rowRef.paymentStatus === 'paid';
                            const isPartial = rowRef.paymentStatus === 'partial';
                            const isUnpaid = rowRef.paymentStatus === 'unpaid';
                            const isTdc = rowRef.paymentStatus === 'tdc';

                            return (
                              <tr
                                key={`${rowRef.clientId || rowRef.username || 'row'}-${localIdx}`}
                                className={cn(
                                  "hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap",
                                  isTdc && "bg-rose-500/5 text-rose-500"
                                )}
                              >
                                {/* Sr */}
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center text-slate-400 font-mono text-[10px]">
                                  {globalRowIdx + 1}
                                </td>

                                {/* Name */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans text-xs font-bold font-semibold">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.name}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded text-xs focus:ring-1 focus:ring-blue-500/30 text-slate-900 dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                    placeholder="Enter full name"
                                  />
                                </td>

                                {/* User ID / Username */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-slate-500">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.username}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 text-slate-500 dark:text-slate-400 font-mono hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Mobile */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-mono">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.mobileNumber}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'mobileNumber', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 text-slate-800 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Area */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-center font-sans">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.area}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'area', e.target.value)}
                                    className="w-full text-center bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-bold uppercase hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* RT */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-center">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.rt}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'rt', e.target.value)}
                                    className="w-full text-center bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-bold uppercase tracking-wider text-blue-500 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Base Amount */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-right">
                                  <div className="flex items-center justify-end">
                                    <span className="text-slate-400 mr-0.5">PKR</span>
                                    <input
                                      type="number"
                                      key={`${rowRef.clientId || rowRef.username}-baseAmount-${rowRef.baseAmount}`}
                                      defaultValue={rowRef.baseAmount}
                                      disabled={!isBillingUnlocked}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', parseFloat(e.target.value) || 0)}
                                      className="w-16 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono text-slate-800 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                </td>

                                {/* Cr. Arrears */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-right font-mono">
                                  <div className="flex items-center justify-end">
                                    <span className={cn("mr-0.5", outstandingCr > 0 ? "text-rose-500" : "text-slate-400")}>PKR</span>
                                    <input
                                      type="number"
                                      key={`${rowRef.clientId || rowRef.username}-cr-${rowRef.cr}`}
                                      defaultValue={rowRef.cr}
                                      disabled={!isBillingUnlocked}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'cr', parseFloat(e.target.value) || 0)}
                                      className={cn(
                                        "w-16 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                        outstandingCr > 0 && "text-rose-600 dark:text-rose-500 font-bold"
                                      )}
                                    />
                                  </div>
                                </td>

                                {/* Total Amount */}
                                <td className="py-2.5 px-4 border-r border-slate-200 dark:border-slate-800/80 text-right text-slate-900 dark:text-slate-200 bg-slate-100/30 dark:bg-slate-900/30 select-none">
                                  PKR {(rowRef.totalAmount || 0).toLocaleString()}
                                </td>

                                {/* BD (Billing Day) */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-center select-all">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.billingDay}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'billingDay', e.target.value)}
                                    className="w-10 text-center bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Monthly Paid Recovery */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 bg-emerald-500/5 dark:bg-emerald-500/15 text-right text-emerald-600 font-bold">
                                  <div className="flex items-center justify-end">
                                    <span className="text-emerald-500/70 mr-0.5">PKR</span>
                                    <input
                                      type="number"
                                      key={`${rowRef.clientId || rowRef.username}-paymentReceived-${rowRef.paymentReceived}`}
                                      defaultValue={rowRef.paymentReceived}
                                      disabled={!isBillingUnlocked}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', parseFloat(e.target.value) || 0)}
                                      className="w-16 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:bg-white/20 dark:hover:bg-black/15 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center">
                                  <select
                                    value={rowRef.paymentStatus}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentStatus', e.target.value)}
                                    className={cn(
                                      "px-2.5 py-1 text-[10px] font-black uppercase text-center rounded-lg border focus:ring-1 focus:ring-blue-500/30 w-full bg-slate-100 dark:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed",
                                      isPaid && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-900/30",
                                      isPartial && "bg-amber-100 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-900/30",
                                      isUnpaid && "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
                                      isTdc && "bg-rose-100 dark:bg-rose-950/50 text-rose-600 border-rose-200 dark:border-rose-900/50"
                                    )}
                                  >
                                    <option value="unpaid">UNPAID</option>
                                    <option value="paid">PAID</option>
                                    <option value="partial">PARTIAL</option>
                                    <option value="tdc">TDC</option>
                                  </select>
                                </td>

                                {/* Comments */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans font-medium">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.comments}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded text-[11px] focus:ring-1 focus:ring-blue-500/30 text-slate-600 dark:text-slate-400 font-bold hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                    placeholder="Add comment..."
                                  />
                                </td>

                                {/* Occupation */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.occ}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'occ', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded text-slate-500 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Serial / PPPoE Username */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-slate-500 font-mono text-[10px]">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.serNam}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'serNam', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* PKG details */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 text-blue-600 font-black">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.pkgDetails}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'pkgDetails', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Connection Date */}
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono text-[10px] text-slate-400 select-none">
                                  {rowRef.connectionDate}
                                </td>

                                {/* Device Price */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-right">
                                  <input
                                    type="number"
                                    defaultValue={rowRef.devicePrice}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'devicePrice', parseFloat(e.target.value) || 0)}
                                    className="w-14 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>

                                {/* ABL charges */}
                                <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800/80 text-right">
                                  <input
                                    type="number"
                                    defaultValue={rowRef.abl}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'abl', parseFloat(e.target.value) || 0)}
                                    className="w-14 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-mono hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>

                                {/* Network name */}
                                <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800/80 font-sans text-[10px]">
                                  <input
                                    type="text"
                                    defaultValue={rowRef.network}
                                    disabled={!isBillingUnlocked}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'network', e.target.value)}
                                    className="w-full bg-transparent px-1.5 py-0.5 border-none rounded text-slate-400 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:cursor-not-allowed disabled:text-slate-400"
                                  />
                                </td>

                                {/* Actions */}
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    disabled={!isBillingUnlocked}
                                    onClick={() => handleDeleteBillingRow(globalRowIdx)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-450 disabled:hover:bg-transparent"
                                    title={isBillingUnlocked ? "Exclude row from current month's sheet" : "Unlock billing sheet to discard registers"}
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {filteredRows.length === 0 && (
                            <tr>
                              <td colSpan={21} className="py-12 text-center text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                                No billing records aligned with search filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850">
                    <div>
                      Month: <span className="text-slate-700 dark:text-slate-300 font-sans">{currentMonthId}</span> | 
                      Master clients in pool: <span className="text-slate-700 dark:text-slate-300 font-sans">{masterClients.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      Auto-saving local edits to secure real-time cloud registry
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={cn("p-12 text-center", getCardStyle(branding.cardStyle), "space-y-4 shadow-sm border")}>
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-500 flex items-center justify-center mx-auto text-2xl">
                  <FileSpreadsheet size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-100">Setup Billing Cycle Database</h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed max-w-md mx-auto">
                    You do not have any billing months created for your WiFi ISP. Create a monthly sheet (e.g. MAY-26 or JUN-26) to generate recovery spreadsheets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfiguringNewMonth(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/10 inline-flex items-center gap-2"
                >
                  <PlusSquare size={14} />
                  Deploy First Recovery Sheet
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
        </>
      )}

      {/* Interactive A4 Ledger Entry Sheet Modal overlay */}
      <EntrySheet
        isOpen={isEntrySheetOpen}
        onClose={() => setIsEntrySheetOpen(false)}
        currentUser={currentUser}
        activeRows={activeRows}
        currentMonthId={currentMonthId}
        isBillingUnlocked={isBillingUnlocked}
        appConfig={appConfig}
      />

      {/* Batch Print Multi-month Dialog Overlay */}
      <BatchPrintModal
        isOpen={isBatchPrintOpen}
        onClose={() => setIsBatchPrintOpen(false)}
        billingMonths={billingMonths}
      />
    </div>
    </>
  );
}
