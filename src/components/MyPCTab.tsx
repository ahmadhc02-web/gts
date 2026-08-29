import { useTheme } from "../hooks/useTheme";
import { getAvatarUrl } from '../utils/avatar';
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, UserPlus, Settings, Users, ClipboardList, Key, Shield, Trash2, FileSpreadsheet, ExternalLink, HardDriveDownload, Layers, ShieldAlert, CheckCircle, Ban, XCircle, X, Pencil, Check, Info, Copy, PlusSquare, CloudUpload, Zap, MapPin, Bell, Contact, MapPinned, Volume2, VolumeX, LogOut, Clock, TrendingUp, BarChart3, Mic, Activity, MessageSquare, Flame, Palette, AlertTriangle, AlertCircle, Globe, Printer, Coins, Percent, ArrowUpRight, Wallet, CreditCard, ChevronDown, ChevronUp, Monitor, Plus, FolderOpen, BarChart2, ShieldCheck, Cloud, Lock, Unlock, RotateCcw, CheckSquare, Square, RefreshCw, Database, Search, Server, CloudSun, Save, Loader2, Building2, User, Eye, EyeOff, UserCheck, UserX, MessageCircle } from 'lucide-react';
import { Complaint, ComplaintStatus, UserProfile, ComplaintPriority, ComplaintCategory, BrandingConfig, ComplaintReview } from '../types';
import ComplaintList from './ComplaintList';
import DealerDataViewer from './DealerDataViewer';
import ComplaintForm from './ComplaintForm';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { WhatsAppSendButton, WhatsAppConnectPanel, WhatsAppMessageTemplateBox } from '../whatsapp_data';
import { googleSheetsService } from '../services/googleSheetsService';
import { supabaseService as pocketbaseService, fromDb, globalTableCaches } from '../lib/supabaseService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { AppConfig } from '../constants';
import MicVisualizer from './MicVisualizer';
import { getCardStyle, getCleanErrorMessage } from '../lib/styleUtils';
import FiberLoading from './FiberLoading';
import RouteLoadingFallback from './RouteLoadingFallback';


const ClientManagement = lazy(() => import('./ClientManagement'));
const RealTimeMonitor = lazy(() => import('./RealTimeMonitor'));
const DistributionList = lazy(() => import('./DistributionList'));
const HighFrequencyNodes = lazy(() => import('./HighFrequencyNodes'));
const MapViewer = lazy(() => import('./MapViewer'));
const EditorPanel = lazy(() => import('./EditorPanel'));
const EntrySheet = lazy(() => import('./EntrySheet'));
const ReceiptManager = lazy(() => import('./ReceiptManager'));


const MYPC_FILE_TO_SLUG: Record<string, string> = {
  'nodes_view': 'active-nodes',
  'dealers_data_view': 'dealers-data',
  'submit_view': 'complain-reg',
  'map_view': 'network-map',
  'user_details': 'users-management',
  'top10_complainers': 'top10-complainer',
  'login_profiles': 'login-profiles',
  'dealers_view': 'dealer-section',
  'system_config': 'workflow-config',
  'settings_info': 'security',
  'integrations': 'google-sheet-link',
  'branding_panel': 'customization',
  'print_receipt_view': 'print',
  'complaints_view': 'complaints',
  'whatsapp_integration': 'whatsapp-integration',
};


interface MyPCTabProps {
  [key: string]: any;
}

export default function MyPCTab(props: MyPCTabProps) {
  const navigate = useNavigate();
    const {
    onNavigate,
    activeRows,
    activeTab,
    alertAuthorized,
    animateCellProgress,
    appConfig,
    billingAreaFilter,
    billingColWidths,
    billingKeyInput,
    billingMonths,
    billingPage,
    billingRowToDelete,
    billingScrollContainerRef,
    billingSearchQuery,
    billingStatusFilter,
    branding,
    complaints,
    currentMainPage,
    currentMonthId,
    currentUser,
    dcRowsList,
    dragActive,
    editCompanyName,
    editFullName,
    editLineCode,
    editPassword,
    editUserRole,
    editUsername,
    editingUserId,
    entrySheetOpenWithUserLedger,
    expandedRecycleItem,
    filteredRecycleItems,
    filteredRows,
    formError,
    formSuccess,
    getBillingSortIcon,
    googleTokens,
    handleAddMonth,
    handleBillingColResizeStart,
    handleBillingMouseLeave,
    handleBillingMouseMove,
    handleBillingSort,
    handleBulkExport,
    handleBulkPurge,
    handleBulkRestore,
    handleCancelEditUser,
    handleCopyText,
    handleCreateSheet,
    handleCreateUser,
    handleDeleteBillingMonth,
    handleDeleteBillingRow,
    handleDeletePortal,
    handleDownloadCSV,
    handleDrag,
    handleDrop,
    handleEmptyRecycleBin,
    handleExecuteRestore,
    handleFileChange,
    handleGenerateLocalBackup,
    handleGetBackup,
    handleGoogleConnect,
    handleManualSaveAllRows,
    handlePermanentDeleteSubscriber,
    handlePurgeAllBillingData,
    handlePurgeItem,
    handleRecheckUsers,
    handleReconciliationCheck,
    handleRecoveryCellKeyDown,
    handleResetAllCRToZero,
    handleRestoreItem,
    handleSaveMypc,
    handleSaveRangeSettings,
    handleSaveRowField,
    handleSaveSecurityKey,
    handleSaveSpreadsheetId,
    handleStartEditUser,
    handleTileClick,
    handleToggleSelect,
    handleToggleSelectAll,
    handleUnlockBilling,
    handleUpdateUser,
    handleUploadBackup,
    inputClasses,
    isAdvanceMode,
    isAudioMuted,
    isBatchPrintOpen,
    isBillingUnlocked,
    isBulkPurging,
    isBulkRestoring,
    isConfiguringNewMonth,
    isConnecting,
    isCreating,
    isCreatingSheet,
    isEditingSecurityKey,
    isEmptyRecycleBinModalOpen,
    isEntrySheetRouteOpen,
    isExporting,
    isGeneratingBackup,
    isLoading,
    isMicMuted,
    isNewConnectionCat,
    isPendingStatus,
    isRecycleLoading,
    isRestoringBackup,
    isSecurityWidgetExpanded,
    isSuspended,
    isUpdating,
    itemsPerPage,
    labelClasses,
    lastAutoBackupTime,
    mainSortedRows,
    masterClients,
    micAuthorized,
    mypcOpenedFile,
    newCompanyName,
    newFullName,
    newLineCode,
    newMonthName,
    newMonthYear,
    newPassword,
    newSecurityKeyInput,
    newUserRole,
    newUsername,
    onAuthorizeAlerts,
    onAuthorizeMic,
    onChangeAdminPass,
    onCreateUser,
    onDeleteComplaint,
    onDeleteUser,
    onLogout,
    onRegisterComplaint,
    onSoundTest,
    onToggleAudio,
    onToggleMic,
    onUpdateBranding,
    onUpdateComplaint,
    onUpdateComplaintStatus,
    onUpdateConfig,
    onUpdateRemarks,
    onUpdateUser,
    onUpdateUserStatus,
    paginatedRows,
    processSelectedFile,
    purgingItemId,
    recoveryRate,
    recycleConfirmPhrase,
    recycleSearchTerm,
    renderCellProgress,
    renderHomeSections,
    resetBillingColumnWidths,
    restoreFile,
    restoringItemId,
    saveBillingColumnWidths,
    saveBillingMonthTracked,
    savingMonthIds,
    selectedDealerForSubAccounts,
    selectedDealerId,
    selectedRecycleItemIds,
    setBillingAreaFilter,
    setBillingKeyInput,
    setBillingMonths,
    setBillingPage,
    setBillingRowToDelete,
    setBillingSearchQuery,
    setBillingStatusFilter,
    setDragActive,
    setEditCompanyName,
    setEditFullName,
    setEditLineCode,
    setEditPassword,
    setEditUserRole,
    setEditUsername,
    setEditingUserId,
    setExpandedRecycleItem,
    setFormError,
    setFormSuccess,
    setGoogleTokens,
    setIsAdvanceMode,
    setIsBatchPrintOpen,
    setIsBillingUnlocked,
    setIsBulkPurging,
    setIsBulkRestoring,
    setIsConfiguringNewMonth,
    setIsCreating,
    setIsCreatingSheet,
    setIsEditingSecurityKey,
    setIsEmptyRecycleBinModalOpen,
    setIsExporting,
    setIsGeneratingBackup,
    setIsRecycleLoading,
    setIsRestoringBackup,
    setIsSecurityWidgetExpanded,
    setIsUpdating,
    setMypcOpenedFile,
    setNewCompanyName,
    setNewFullName,
    setNewLineCode,
    setNewMonthName,
    setNewMonthYear,
    setNewPassword,
    setNewSecurityKeyInput,
    setNewUserRole,
    setNewUsername,
    setPurgingItemId,
    setRecycleConfirmPhrase,
    setRecycleSearchTerm,
    setRestoreFile,
    setRestoringItemId,
    setSelectedDealerForSubAccounts,
    setSelectedDealerId,
    setSelectedRecoveryRow,
    setSelectedRecycleItemIds,
    setSheetName,
    setSheetRange,
    setShowDcList,
    setSpreadsheetId,
    setUploadedBackupData,
    setUserToDelete,
    sheetName,
    sheetRange,
    showDcList,
    spreadsheetId,
    startBillingScrolling,
    startDeleteSheetWithProgress,
    startSheetLoading,
    stopBillingScrolling,
    syncRecoveryRowToMasterClient,
    totalBase,
    totalCr,
    totalDC,
    totalExpected,
    totalMainPages,
    totalOutstanding,
    totalPending,
    totalRecovered,
    totalTDC,
    triggerDeleteBillingRow,
    uploadedBackupData,
    users
  } = props;


  return (

          <div id="mypc-virtual-desktop" className="max-w-[115rem] mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
            {/* Virtual PC Views */}
            {!mypcOpenedFile && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 max-w-7xl mx-auto pt-2 pb-8">
                {[
                  { id: 'nodes_view', icon: Flame, title: 'Active Complainers', desc: 'Monitor dynamic hotspots' },
                  ...(currentUser?.role === 'super_admin' ? [{ id: 'dealers_data_view', icon: BarChart3, title: 'Dealers Data', desc: 'Audit dealer network metrics' }] : []),
                  { id: 'submit_view', icon: PlusSquare, title: branding?.tabNames?.submit || 'Complain Reg', desc: 'File fresh customer logs' },
                  { id: 'map_view', icon: MapPinned, title: 'Network Map', desc: 'Diagnostic geographic connection grid' },
                  { id: 'user_details', icon: Users, title: 'Users Management', desc: 'Manage logins & clearance level' },
                  ...(currentUser?.role !== 'dealer' ? [{ id: 'dealer_data_viewer', icon: Eye, title: 'Dealer Data', desc: 'View dealer records (read-only)' }] : []),
                  { id: 'top10_complainers', icon: BarChart2, title: 'Top 10 Complainer', desc: 'High frequency support identifiers' },
                  { id: 'login_profiles', icon: ShieldCheck, title: 'Login Profiles', desc: 'Active Credentials & Roles Overview' },
                  { id: 'dealers_view', icon: ShieldAlert, title: 'Dealer Section', desc: 'Authorized Dealers Registry Setup' },
                  { id: 'system_config', icon: Settings, title: 'Workflow Config', desc: 'Edit Categories & Active Zones' },
                  { id: 'settings_info', icon: Shield, title: 'Security', desc: 'Audio Matrix & Voice Protocols' },
                  { id: 'integrations', icon: CloudUpload, title: 'Google Sheet Link', desc: 'One-Time Enterprise Sync' },
                  { id: 'branding_panel', icon: Palette, title: 'CUSTOMIZATION', desc: 'Design aesthetics & app layouts' },
                  { id: 'print_receipt_view', icon: Printer, title: 'Print', desc: 'Receipt designer & template editor' },
                  { id: 'whatsapp_integration', icon: MessageCircle, title: 'WhatsApp', desc: 'Connect & manage automated messaging' }
                ].map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const slug = MYPC_FILE_TO_SLUG[item.id];
                      if (slug) {
                        navigate(`/mypc/${slug}`);
                      } else {
                        setMypcOpenedFile(item.id as any);
                      }
                    }}
                    className="group cursor-pointer p-5 sm:p-6 bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] rounded-[2rem] hover:shadow-[var(--neu-shadow-inset)] flex flex-col items-center sm:items-start text-center sm:text-left space-y-4 transition-all duration-300 relative overflow-hidden active:scale-95"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-300 -mr-12 -mt-12 pointer-events-none" />
                    
                    <div className="w-12 h-12 rounded-2xl bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-inset)] text-slate-600 dark:text-slate-400 flex items-center justify-center group-hover:text-blue-500 transition-all duration-300 z-10">
                      <item.icon size={22} strokeWidth={2} />
                    </div>
                    <div className="z-10 w-full flex flex-col items-center sm:items-start">
                      <h4 className="text-[11px] sm:text-[13px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors leading-tight mb-2">{item.title}</h4>
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            {mypcOpenedFile && (
              <div className="space-y-6 animate-fade-in text-left">
                <div className="flex items-center justify-between bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] px-5 py-4 rounded-2xl border border-[var(--neu-border)]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate('/mypc')}
                      className="px-4 py-2 text-[9px] font-black uppercase tracking-widest bg-[var(--neu-surface)] text-slate-600 dark:text-slate-300 hover:text-blue-500 rounded-xl border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] active:scale-95 cursor-pointer transition-all flex items-center gap-2"
                    >
                      <span>◀</span> Close Application
                    </button>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                        Running Frame: {
                          mypcOpenedFile === 'whatsapp_integration' ? 'WhatsApp Business Integration Console' :
                          mypcOpenedFile === 'dealer_data_viewer' ? 'Read-Only Dealer Data Viewer' :
                          mypcOpenedFile === 'user_details' ? 'Access List & Clearance Permissions Manager' :
                          mypcOpenedFile === 'print_receipt_view' ? 'Receipt Management & PDF Generator Console' :
                          mypcOpenedFile === 'top10_complainers' ? 'Hot-Frequency Support Request Registry' :
                          mypcOpenedFile === 'login_profiles' ? 'Active System Roles & Authentication Overview' :
                          mypcOpenedFile === 'system_config' ? 'Real-Time Tenant Parameters configuration' :
                          mypcOpenedFile === 'dealers_view' ? 'Authorized Dealers Setup Protocol' :
                          mypcOpenedFile === 'branding_panel' ? 'Theme Style & System Signage Configuration' :
                          mypcOpenedFile === 'settings_info' ? 'System Audio-Voice Matrix & Security' :
                          mypcOpenedFile === 'complaints_view' ? 'Real-Time Operational Support Request Console' :
                          mypcOpenedFile === 'nodes_view' ? 'Diagnostic Active Complainers & Hotspot Index' :
                          mypcOpenedFile === 'dealers_data_view' ? 'Dealers Network Intelligence Audit Matrix' :
                          mypcOpenedFile === 'submit_view' ? 'Operational Support Request Registration Console' :
                          mypcOpenedFile === 'map_view' ? 'Diagnostic Geographic Connection Map View' :
                          'Cloud Sheets Sync Nodes Proxy'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-1 min-h-[420px]">
                  {/* Subview 1: Client Infrastructure Directory */}
                  {mypcOpenedFile === 'user_details' && (
                    <div className="max-w-7xl mx-auto space-y-6 text-left">
                        <div className="animate-fade-in bg-[var(--neu-surface)] p-6 rounded-3xl border border-slate-200/60 dark:border-white/10 shadow-[var(--neu-shadow-raised-lg)]">
                          <ClientManagement 
                            appConfig={appConfig} 
                            isAdmin={true} 
                            currentUser={currentUser} 
                            currentUserName={users.find(u => u.uid === currentUser.uid)?.username || 'Admin'} 
                            isBillingUnlocked={isBillingUnlocked}
                          />
                        </div>
                    </div>
                  )}

                  {/* Subview 2: Top 10 Complainers */}
                  {mypcOpenedFile === 'top10_complainers' && (
                    <div className="max-w-4xl mx-auto">
                      <HighFrequencyNodes complaints={complaints} users={users} />
                    </div>
                  )}

                  {/* Subview 3: Login Profiles */}
                  {mypcOpenedFile === 'login_profiles' && (
                    <div className="max-w-7xl mx-auto space-y-6 text-left">
                      {/* Active Session & Core Profile */}
                      <div className={cn("p-8", getCardStyle(branding.cardStyle))}>
                        <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2.5 text-slate-900 dark:text-slate-50">
                          <ShieldCheck size={20} className="text-emerald-500 animate-pulse" />
                          Authorized Credentials & Session Dashboard
                        </h3>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-8">
                          Secure system registry listing current operators clearance and session credentials
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-5 rounded-xl border border-[var(--neu-border)] bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] space-y-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Logged Operator Account</p>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-[var(--neu-border)] shadow-[var(--neu-shadow-raised-sm)]">
                                <img 
                                  src={getAvatarUrl(currentUser.profilePicture)} 
                                  alt={currentUser.username} 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="flex flex-col">
                                <p className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">{currentUser.fullName || currentUser.username}</p>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">@{currentUser.username}</span>
                              </div>
                            </div>
                            <span className="inline-flex px-3 py-0.5 text-[8px] font-black rounded-full uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 select-none">
                              Active Secure Token
                            </span>
                          </div>
                          <div className="p-5 rounded-xl border border-[var(--neu-border)] bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] space-y-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono">Verified Clearance Clearance</p>
                            <p className="text-base font-black uppercase tracking-tight text-blue-500 dark:text-blue-400">{currentUser.role.replace('_', ' ')}</p>
                            <p className="text-[10px] text-slate-400/80 uppercase font-black tracking-widest font-mono">Tenant Mode Verified</p>
                          </div>
                        </div>
                      </div>

                      {/* Split Operator Directory Register layout shifted from user_details */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                        <div className="lg:col-span-1">
                          <div className={cn("p-8 bg-[var(--neu-surface)] border border-slate-200 dark:border-white/10", getCardStyle(branding.cardStyle))}>
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
                                  onChange={(e) => setNewUsername(e.target.value)}
                                  placeholder="e.g. john_doe"
                                  className={cn(inputClasses, "normal-case")}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Full Name</label>
                                <input
                                  type="text"
                                  value={newFullName}
                                  onChange={(e) => setNewFullName(e.target.value)}
                                  placeholder="e.g. John Doe"
                                  className={cn(inputClasses, "normal-case")}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Access Password</label>
                                <input
                                  type="password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="••••••••"
                                  className={cn(inputClasses, "normal-case")}
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
                                        ? "bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] text-slate-800 dark:text-slate-100 active:shadow-[var(--neu-shadow-btn-active)] border-slate-900 dark:border-brand-accent" 
                                        : "bg-slate-50 dark:bg-slate-900 border-[var(--neu-border)] text-slate-500"
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
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-[var(--neu-shadow-raised)] shadow-indigo-500/20" 
                                        : "bg-slate-50 dark:bg-slate-900 border-[var(--neu-border)] text-slate-500"
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
                                        ? "bg-blue-600 text-white border-blue-600 shadow-[var(--neu-shadow-raised)] shadow-blue-500/20" 
                                        : "bg-slate-50 dark:bg-slate-900 border-[var(--neu-border)] text-slate-500"
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
                                          ? "bg-rose-600 text-white border-rose-600 shadow-[var(--neu-shadow-raised)] shadow-rose-500/20" 
                                          : "bg-slate-50 dark:bg-slate-900 border-[var(--neu-border)] text-slate-500"
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
                                className="w-full py-4 rounded-lg bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] text-slate-800 dark:text-slate-100 active:shadow-[var(--neu-shadow-btn-active)] font-bold uppercase tracking-widest text-[11px] shadow-[var(--neu-shadow-raised-lg)] hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 transition-all"
                              >
                                {isCreating ? 'Processing Reg...' : 'Initialize Link Access Member'}
                              </button>
                            </form>
                          </div>
                        </div>

                        <div className="lg:col-span-2">
                          <div className={cn("overflow-hidden bg-[var(--neu-surface)]", getCardStyle(branding.cardStyle))}>
                            <div className="px-6 py-4 border-b border-[var(--neu-border)] bg-[var(--neu-surface)]">
                               <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Link Access Directory</h4>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-[var(--neu-surface)]">
                                <tr className="border-b border-[var(--neu-border)]">
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
                                    <td className="px-6 py-4 w-[400px]">
                                      {editingUserId === user.uid ? (
                                        <div className="space-y-2">
                                          <input
                                            type="text"
                                            value={editUsername}
                                            onChange={(e) => setEditUsername(e.target.value)}
                                            placeholder="Username"
                                            className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                          />
                                          <input
                                            type="text"
                                            value={editFullName}
                                            onChange={(e) => setEditFullName(e.target.value)}
                                            placeholder="Full Name"
                                            className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                          />
                                          <input
                                            type="text"
                                            value={editPassword}
                                            onChange={(e) => setEditPassword(e.target.value)}
                                            placeholder="New Password"
                                            className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                          />
                                          {currentUser.role === 'super_admin' && user.role === 'dealer' && (
                                            <input
                                              type="text"
                                              value={editLineCode}
                                              onChange={(e) => setEditLineCode(e.target.value)}
                                              placeholder="Line Code"
                                              className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                            />
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[var(--neu-border)] shadow-[var(--neu-shadow-raised-sm)]">
                                            <img 
                                              src={getAvatarUrl(user.profilePicture)} 
                                              alt={user.username} 
                                              className="w-full h-full object-cover" 
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                          <div className="flex flex-col text-[16px] w-[160px]">
                                            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{user.fullName || user.username}</span>
                                            {user.fullName && <span className="text-[10px] text-[#443838] font-bold uppercase tracking-widest">@{user.username}</span>}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      {editingUserId === user.uid && currentUser.role === 'super_admin' ? (
                                        <select
                                          value={editUserRole}
                                          onChange={(e) => setEditUserRole(e.target.value as any)}
                                          className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)] uppercase font-black"
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
                                          "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-[var(--neu-border)]"
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
                                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-[var(--neu-surface)] px-2 py-1 rounded border border-[var(--neu-border)]">
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
                                              className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                              title="Save Changes"
                                            >
                                              <Check size={16} />
                                            </button>
                                            <button
                                              onClick={handleCancelEditUser}
                                              className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-all border-none bg-transparent cursor-pointer"
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
                                                className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
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
                                                    className="p-2 text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                                    title="Approve Request"
                                                  >
                                                    <CheckCircle size={16} />
                                                  </button>
                                                )}
                                                {user.status !== 'blocked' ? (
                                                  <button
                                                    onClick={() => onUpdateUserStatus(user.uid, 'blocked')}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                                    title="Block User"
                                                  >
                                                    <Ban size={16} />
                                                  </button>
                                                ) : (
                                                  <button
                                                    onClick={() => onUpdateUserStatus(user.uid, 'active')}
                                                    className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                                    title="Unblock User"
                                                  >
                                                    <CheckCircle size={16} />
                                                  </button>
                                                )}
                                              </>
                                            )}
                                            <button
                                              onClick={() => handleStartEditUser(user)}
                                              className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                              title="Edit Credentials"
                                            >
                                              <Pencil size={16} />
                                            </button>
                                            {user.uid !== currentUser.uid && (
                                              <button
                                                onClick={() => setUserToDelete(user)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all border-none bg-transparent cursor-pointer"
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
                    </div>
                  )}

                  {/* Subview 4: System Configurations */}
                  {mypcOpenedFile === 'system_config' && (
                    <div className="max-w-7xl mx-auto space-y-8 text-left animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                        {/* Category Management */}
                        <div className={cn("p-6 bg-[var(--neu-surface)] border border-slate-200 dark:border-white/10", getCardStyle(branding.cardStyle))}>
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Service Categories</h4>
                            <Layers size={16} className="text-blue-500" />
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Add Category..." 
                                className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  const inputEl = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  if (inputEl) {
                                    const val = inputEl.value.trim();
                                    if (val && !appConfig.categories.includes(val)) {
                                      onUpdateConfig({ ...appConfig, categories: [...appConfig.categories, val] });
                                      inputEl.value = '';
                                    }
                                  }
                                }}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Plus size={14} /> Add
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
                              {appConfig.categories.map((cat, i) => (
                                <div key={`cat-sys-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-[var(--neu-surface)] rounded-lg border border-slate-205 dark:border-white/10 text-[10px] font-bold uppercase tracking-tight">
                                  <span className="text-slate-700 dark:text-slate-300 uppercase">{cat}</span>
                                  <button 
                                    onClick={() => {
                                      if (appConfig.categories.length > 1) {
                                        onUpdateConfig({ ...appConfig, categories: appConfig.categories.filter(c => c !== cat) });
                                      } else {
                                        toast.error('At least one category is required.');
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-500 opacity-100 transition-all cursor-pointer font-bold bg-transparent border-none p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Status Management */}
                        <div className={cn("p-6 bg-[var(--neu-surface)] border border-slate-200 dark:border-white/10", getCardStyle(branding.cardStyle))}>
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Workflow Statuses</h4>
                            <Activity size={16} className="text-amber-500" />
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Add Status..." 
                                className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  const inputEl = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  if (inputEl) {
                                    const val = inputEl.value.trim();
                                    if (val && !appConfig.statuses.includes(val)) {
                                      onUpdateConfig({ ...appConfig, statuses: [...appConfig.statuses, val] });
                                      inputEl.value = '';
                                    }
                                  }
                                }}
                                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Plus size={14} /> Add
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {appConfig.statuses.map((stat, i) => (
                                <div key={`stat-sys-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-[var(--neu-surface)] rounded-lg border border-slate-205 dark:border-white/10 text-[10px] font-bold uppercase tracking-tight">
                                  <span className="text-slate-700 dark:text-slate-300">{stat}</span>
                                  <button 
                                    onClick={() => {
                                      if (appConfig.statuses.length > 1) {
                                        onUpdateConfig({ ...appConfig, statuses: appConfig.statuses.filter(s => s !== stat) });
                                      } else {
                                        toast.error('At least one status is required.');
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-500 opacity-100 transition-all cursor-pointer font-bold bg-transparent border-none p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Priority Management */}
                        <div className={cn("p-6 bg-[var(--neu-surface)] border border-slate-200 dark:border-white/10", getCardStyle(branding.cardStyle))}>
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Priority Levels</h4>
                            <ShieldAlert size={16} className="text-rose-500" />
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Add Priority..." 
                                className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-900 dark:text-white"
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  const inputEl = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  if (inputEl) {
                                    const val = inputEl.value.trim();
                                    if (val && !appConfig.priorities.includes(val)) {
                                      onUpdateConfig({ ...appConfig, priorities: [...appConfig.priorities, val] });
                                      inputEl.value = '';
                                    }
                                  }
                                }}
                                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Plus size={14} /> Add
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {appConfig.priorities.map((pri, i) => (
                                <div key={`pri-sys-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-[var(--neu-surface)] rounded-lg border border-slate-205 dark:border-white/10 text-[10px] font-bold uppercase tracking-tight">
                                  <span className="text-slate-700 dark:text-slate-300">{pri}</span>
                                  <button 
                                    onClick={() => {
                                      if (appConfig.priorities.length > 1) {
                                        onUpdateConfig({ ...appConfig, priorities: appConfig.priorities.filter(p => p !== pri) });
                                      } else {
                                        toast.error('At least one priority level is required.');
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-500 opacity-100 transition-all cursor-pointer font-bold bg-transparent border-none p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Zone Management */}
                        <div className={cn("p-6 bg-[var(--neu-surface)] border border-slate-200 dark:border-white/10", getCardStyle(branding.cardStyle))}>
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Operation Zones</h4>
                            <MapPin size={16} className="text-emerald-500" />
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Add Zone..." 
                                className="flex-1 text-[11px] font-bold px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  const inputEl = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  if (inputEl) {
                                    const val = inputEl.value.trim();
                                    if (val && !appConfig.zones?.includes(val)) {
                                      onUpdateConfig({ ...appConfig, zones: [...(appConfig.zones || []), val] });
                                      inputEl.value = '';
                                    }
                                  }
                                }}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Plus size={14} /> Add
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
                              {appConfig.zones?.map((zone, i) => (
                                <div key={`zone-sys-${i}`} className="group relative flex items-center gap-2 px-3 py-1.5 bg-[var(--neu-surface)] rounded-lg border border-slate-205 dark:border-white/10 text-[10px] font-bold uppercase tracking-tight">
                                  <span className="text-slate-700 dark:text-slate-300">{zone}</span>
                                  <button 
                                    onClick={() => {
                                      if (appConfig.zones.length > 1) {
                                        onUpdateConfig({ ...appConfig, zones: appConfig.zones.filter(z => z !== zone) });
                                      } else {
                                        toast.error('At least one zone is required.');
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-500 opacity-100 transition-all cursor-pointer font-bold bg-transparent border-none p-1"
                                  >
                                    ✕
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

                  {/* Subview 5: Branding Customizer */}
                  {mypcOpenedFile === 'branding_panel' && (
                    <div className="max-w-7xl mx-auto w-full px-4">
                      <EditorPanel branding={branding} onUpdate={onUpdateBranding} />
                    </div>
                  )}

                  {/* Subview 6: Integrations Sync */}
                  {mypcOpenedFile === 'integrations' && (
                    <div className="max-w-4xl mx-auto space-y-6 text-left animate-in fade-in duration-300">
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
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-widest text-[10px] transition-all shadow-[var(--neu-shadow-raised-lg)] active:scale-95"
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
                                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-900 dark:bg-brand-accent hover:bg-black dark:hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-[var(--neu-shadow-raised-lg)] shadow-brand-accent/20 active:scale-95 disabled:opacity-50 border-none cursor-pointer"
                              >
                                <Zap size={14} className="text-amber-400" />
                                {isConnecting ? 'Linking Permanent...' : 'Connect Permanent Sync'}
                              </button>
                              <button
                                onClick={() => handleGoogleConnect('firebase')}
                                disabled={isConnecting}
                                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50 border-none cursor-pointer"
                              >
                                <ExternalLink size={14} />
                                {isConnecting ? 'Linking Firebase...' : 'Fast Connect (Firebase)'}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                              {googleTokens && !googleTokens.refresh_token ? (
                                <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 animate-pulse">
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
                                className="text-xs font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors py-2 px-3 hover:bg-rose-500/5 rounded-xl border border-transparent hover:border-rose-500/15 cursor-pointer bg-transparent"
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
                            <div className="space-y-3 font-semibold uppercase tracking-widest">
                              {[
                                'Real-time data propagation',
                                'Enterprise-grade CSV backups',
                                'Immutable audit logs'
                              ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-3 text-[10px] font-black text-slate-400">
                                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                  {feature}
                                </div>
                              ))}
                            </div>
                          </div>

                          {googleTokens && (
                            <div className="space-y-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-2xl border border-[var(--neu-border)]">
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
                                       className="px-4 rounded-xl bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center shrink-0 min-w-[100px] border-none cursor-pointer"
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
                                  className="w-full py-4 rounded-xl bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] text-slate-800 dark:text-slate-100 active:shadow-[var(--neu-shadow-btn-active)] font-black uppercase tracking-widest text-[11px] shadow-[var(--neu-shadow-raised-lg)] hover:shadow-brand-accent/20 transition-all active:scale-95 border-none cursor-pointer"
                                >
                                  Initialize Synchronization
                                </button>
                              </div>
                            </div>
                          )}

                          {!googleTokens && (
                            <div className="flex items-center justify-center p-8 border-2 border-dashed border-[var(--neu-border)] rounded-2xl">
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
                            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-[var(--neu-surface)] border border-slate-205 dark:border-white/10 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all shadow-[var(--neu-shadow-raised-sm)] cursor-pointer"
                          >
                            {isExporting ? 'Exporting...' : 'Perform Bulk System Export'}
                            <CloudUpload size={14} className={isExporting ? "animate-bounce" : ""} />
                          </button>
                          <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-[var(--neu-border)]/60 max-w-sm w-full text-center">
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
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 animate-pulse">
                                  LAST EXPORTED: <span className="font-mono text-emerald-600 dark:text-emerald-400">{new Date(lastAutoBackupTime).toLocaleTimeString()}</span>
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400/85 uppercase tracking-wider">
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
                      <div className={cn("p-8 sm:p-12 mt-6", getCardStyle(branding.cardStyle))}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 pb-8 border-b border-[var(--neu-border)]">
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
                            className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-xl bg-slate-900 dark:bg-brand-accent hover:bg-black dark:hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-[var(--neu-shadow-raised-lg)] shadow-brand-accent/10 active:scale-95 disabled:opacity-50 border-none cursor-pointer"
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
                                    : "border-slate-205 dark:border-white/10 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40"
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
                              <div className="p-6 bg-slate-50 dark:bg-slate-900/40 border border-[var(--neu-border)] rounded-2xl space-y-4">
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
                                    className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors border-none cursor-pointer"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                {uploadedBackupData && (
                                  <div className="p-3 bg-white/60 dark:bg-slate-950/40 rounded-xl space-y-1 text-[10px] border border-[var(--neu-border)]">
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
                                  className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-[var(--neu-shadow-raised-lg)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border-none cursor-pointer"
                                >
                                  {isRestoringBackup ? 'Rewriting Database...' : 'CONFIRM & RESTORE FULL SYSTEM'}
                                  <CheckCircle size={14} />
                                </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                  {/* Subview 7: Security & Audio Matrix settings_info */}
                  {mypcOpenedFile === 'settings_info' && (
                    <div className="max-w-2xl mx-auto space-y-8 text-left animate-in fade-in duration-300">
                      <div className="business-card p-10 bg-[var(--neu-surface)] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[var(--neu-shadow-raised-lg)]">
                        <div className="flex items-center gap-5 mb-10">
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[var(--neu-shadow-raised-sm)]">
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
                              <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-4 leading-relaxed uppercase tracking-widest text-center mt-1">
                                  Synthesizer and alert speakers are restricted by current policy.
                                </p>
                                <button
                                  type="button"
                                  onClick={onAuthorizeAlerts}
                                  className="w-full py-4 rounded-xl bg-amber-500 text-white font-black uppercase tracking-widest text-xs shadow-[var(--neu-shadow-raised-lg)] hover:bg-amber-600 transition-all border-none cursor-pointer"
                                >
                                  Initialize Speaker Matrix
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[var(--neu-border)]">
                                  <div className="flex items-center gap-3">
                                    {isAudioMuted ? <VolumeX className="text-rose-500" size={18} /> : <Volume2 className="text-emerald-500" size={18} />}
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Alert Audio</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{isAudioMuted ? 'Notifications Suspended' : 'Notifications Active'}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={onToggleAudio}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer",
                                      isAudioMuted ? "bg-emerald-500 text-white shadow-[var(--neu-shadow-raised-lg)]" : "bg-rose-500 text-white shadow-[var(--neu-shadow-raised-lg)]"
                                    )}
                                  >
                                    {isAudioMuted ? 'Turn On' : 'Turn Off'}
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={onSoundTest}
                                  className="w-full py-3 rounded-xl border border-[var(--neu-border)] text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-3 bg-transparent cursor-pointer"
                                >
                                  <Zap size={14} className="text-amber-500" />
                                  Execute Speaker Sync Test
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Microphone Section */}
                          <div className="space-y-4 pt-4 border-t border-[var(--neu-border)]">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tactical Voice Input</h4>
                            {!micAuthorized ? (
                              <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-center">
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 leading-relaxed uppercase tracking-widest text-center mt-1">
                                  Microphone capture protocols are currently offline.
                                </p>
                                <button
                                  type="button"
                                  onClick={onAuthorizeMic}
                                  className="w-full py-4 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs shadow-[var(--neu-shadow-raised-lg)] hover:bg-blue-700 transition-all border-none cursor-pointer"
                                >
                                  Authorize Mic Input
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[var(--neu-border)]">
                                  <div className="flex items-center gap-3">
                                    {isMicMuted ? <VolumeX className="text-rose-500" size={18} /> : <Mic className="text-blue-500" size={18} />}
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Tactical Mic</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{isMicMuted ? 'Capture Suppressed' : 'Capture Active'}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={onToggleMic}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer",
                                      isMicMuted ? "bg-emerald-500 text-white shadow-[var(--neu-shadow-raised-lg)]" : "bg-rose-500 text-white shadow-[var(--neu-shadow-raised-lg)]"
                                    )}
                                  >
                                    {isMicMuted ? 'Turn On' : 'Turn Off'}
                                  </button>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/10">
                                  <MicVisualizer isMuted={isMicMuted} isAuthorized={micAuthorized} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subview 8: Dealer Section dealers_view */}
                  {mypcOpenedFile === 'dealers_view' && (
                    currentUser.role === 'super_admin' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left animate-in fade-in duration-300">
                        {/* Dealer Setup Form */}
                        <div className="lg:col-span-1">
                          <div className={cn("p-8 border border-slate-200 dark:border-white/10 bg-[var(--neu-surface)]", getCardStyle(branding.cardStyle))}>
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
                            <form onSubmit={handleCreateUser} className="space-y-5">
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Dealer Name (Full Name)</label>
                                <input
                                  type="text"
                                  value={newFullName}
                                  onChange={(e) => setNewFullName(e.target.value)}
                                  placeholder="e.g. John Doe"
                                  className={cn(inputClasses, "normal-case")}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Dealer Username</label>
                                <input
                                  type="text"
                                  value={newUsername}
                                  onChange={(e) => setNewUsername(e.target.value)}
                                  placeholder="e.g. johndoe"
                                  className={cn(inputClasses, "normal-case")}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Dealer Passkey (Passkey / Password)</label>
                                <input
                                  type="text"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="e.g. Passkey123"
                                  className={cn(inputClasses, "normal-case")}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Dealer Line Code (Network VLAN Line Code)</label>
                                <input
                                  type="text"
                                  value={newLineCode}
                                  onChange={(e) => setNewLineCode(e.target.value)}
                                  placeholder="e.g. DLR-99"
                                  className={cn(inputClasses, "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10 normal-case")}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Dealer Company Name (Business Entity Name)</label>
                                <input
                                  type="text"
                                  value={newCompanyName}
                                  onChange={(e) => setNewCompanyName(e.target.value)}
                                  placeholder="e.g. Tech Solutions"
                                  className={cn(inputClasses, "normal-case")}
                                  required
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-3.5 mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] shadow-[var(--neu-shadow-raised-lg)] hover:shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer block min-h-[44px] border-none"
                              >
                                {isCreating ? 'Provisioning...' : 'Create Dealer Account'}
                              </button>
                            </form>
                          </div>
                        </div>

                        {/* Authorized Dealers Registry List */}
                        <div className="lg:col-span-2">
                          <div className="business-card overflow-hidden bg-[var(--neu-surface)] rounded-2xl border border-[var(--neu-border)] shadow-[var(--neu-shadow-raised-lg)]">
                            <div className="px-6 py-4 border-b border-[var(--neu-border)] bg-[var(--neu-surface)] flex justify-between items-center whitespace-normal break-words">
                              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Authorized Dealers Registry</h4>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-[var(--neu-surface)]">
                                  <tr className="border-b border-[var(--neu-border)]">
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
                                                className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                              />
                                              <input
                                                type="text"
                                                value={editCompanyName}
                                                onChange={(e) => setEditCompanyName(e.target.value)}
                                                placeholder="Company Name"
                                                className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                              />
                                              <input
                                                type="text"
                                                value={editPassword}
                                                onChange={(e) => setEditPassword(e.target.value)}
                                                placeholder="New Passkey"
                                                className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                              />
                                            </div>
                                          ) : (
                                            <div className="flex flex-col gap-2">
                                              <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-xs block">
                                                🏢 {dealer.companyName || 'No Company Set'}
                                              </span>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                                <div className="px-3 py-1.5 bg-[var(--neu-surface)] rounded-lg border border-[var(--neu-border)] flex flex-col justify-center min-w-[120px]">
                                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Login username</span>
                                                  <span className="text-[11px] font-extrabold text-slate-900 dark:text-indigo-400 select-all tracking-wide break-all">{dealer.username}</span>
                                                </div>
                                                <div className="px-3 py-1.5 bg-[var(--neu-surface)] rounded-lg border border-[var(--neu-border)] flex flex-col justify-center min-w-[120px]">
                                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Authentication Passkey</span>
                                                  <span className="text-[11px] font-extrabold text-[#00E5FF] select-all tracking-wide break-all font-mono">{dealer.password || '••••••••'}</span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-6 py-4">
                                          {editingUserId === dealer.uid ? (
                                            <input
                                              type="text"
                                              value={editLineCode}
                                              onChange={(e) => setEditLineCode(e.target.value)}
                                              className="w-full px-2 py-1 text-sm border rounded bg-[var(--neu-surface)]"
                                              placeholder="Line Code"
                                            />
                                          ) : (
                                            <div className="flex items-center gap-3">
                                              <span className="px-3 py-1 bg-[var(--neu-surface)] text-slate-800 dark:text-slate-200 text-[10px] font-black rounded border border-[var(--neu-border)] tracking-wider">
                                                {dealer.lineCode}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  const newStatus = dealer.status === 'blocked' ? 'active' : 'blocked';
                                                  try {
                                                    await onUpdateUserStatus(dealer.uid, newStatus);
                                                    toast.success(newStatus === 'blocked' ? '🚫 NODE SUSPENDED' : '✅ NODE ACTIVATED', {
                                                      description: `${dealer.companyName || dealer.username} has been ${newStatus === 'blocked' ? 'suspended' : 'activated'} in real-time.`
                                                    });
                                                  } catch (err: any) {
                                                    toast.error('Failed to change dealer status', { description: err.message });
                                                  }
                                                }}
                                                className={cn(
                                                  "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[var(--neu-shadow-raised-sm)] cursor-pointer border",
                                                  dealer.status === 'blocked'
                                                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-600 shadow-rose-500/10"
                                                    : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/10"
                                                )}
                                              >
                                                <span className={cn("w-1.5 h-1.5 rounded-full bg-white", dealer.status !== 'blocked' && "animate-pulse")} />
                                                <span>{dealer.status === 'blocked' ? 'OFF' : 'ON'}</span>
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-2">
                                            {dealer.status === 'blocked' ? (
                                              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30 rounded-lg flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                                SUSPENDED
                                              </span>
                                            ) : (
                                              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30 rounded-lg flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                ACTIVE
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-normal">
                                          <div className="flex justify-end items-center gap-2">
                                            {editingUserId === dealer.uid ? (
                                              <>
                                                <button
                                                  onClick={() => handleUpdateUser(dealer.uid)}
                                                  disabled={isUpdating}
                                                  className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all cursor-pointer bg-transparent border-none"
                                                  title="Save Changes"
                                                >
                                                  <Check size={16} />
                                                </button>
                                                <button
                                                  onClick={handleCancelEditUser}
                                                  className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-all cursor-pointer bg-transparent border-none"
                                                  title="Cancel"
                                                >
                                                  <X size={16} />
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => setSelectedDealerForSubAccounts(dealer)}
                                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg border border-indigo-100 dark:border-indigo-900/30 tracking-wider flex items-center gap-1.5 transition-all shadow-[var(--neu-shadow-raised-sm)] cursor-pointer mr-1"
                                                  title="View Sub Accounts"
                                                >
                                                  <Users size={12} />
                                                  SUB ACCOUNTS
                                                  <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center min-w-[16px] h-[16px]">
                                                    {users.filter(u => u.dealerId === dealer.uid && u.role !== 'dealer').length}
                                                  </span>
                                                </button>

                                                <button
                                                  onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('openChat', { detail: dealer.uid }));
                                                  }}
                                                  className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all cursor-pointer bg-transparent border-none"
                                                  title="Communicate with Dealer"
                                                >
                                                  <MessageSquare size={16} />
                                                </button>
                                                <button
                                                  onClick={() => handleStartEditUser(dealer)}
                                                  className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all cursor-pointer bg-transparent border-none"
                                                  title="Edit Dealer"
                                                >
                                                  <Pencil size={16} />
                                                </button>
                                                <button
                                                  onClick={() => setUserToDelete(dealer)}
                                                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all cursor-pointer bg-transparent border-none"
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
                    ) : (
                      <div className="max-w-xl mx-auto p-12 bg-[var(--neu-surface)] border border-rose-200/50 dark:border-rose-950/50 rounded-3xl text-center space-y-6">
                        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/20 text-rose-500 mx-auto rounded-full flex items-center justify-center">
                          <ShieldAlert size={40} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-lg font-black uppercase text-slate-900 dark:text-white">Access Denied</h4>
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest leading-relaxed">
                            Secured Admin Node. Your current role lacks super-admin credentials.
                          </p>
                        </div>
                      </div>
                    )
                  )}

                  {/* Subview 9: Complaints View complaints_view */}
                  {mypcOpenedFile === 'complaints_view' && (
                    <div className="max-w-7xl mx-auto space-y-6 text-left animate-in fade-in duration-300">
                      {renderHomeSections()}
                    </div>
                  )}

                  {/* Subview 10: Active Complainers nodes_view */}
                  {mypcOpenedFile === 'nodes_view' && (
                    <div className="max-w-4xl mx-auto text-left animate-in fade-in duration-300">
                      <HighFrequencyNodes complaints={complaints} users={users} />
                    </div>
                  )}

                  {/* Subview 11: Dealers Data dealers_data_view */}
                  {mypcOpenedFile === 'dealers_data_view' && (
                    currentUser.role === 'super_admin' ? (
                      <div className="space-y-8 text-left animate-in fade-in duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Dealer Intelligence</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Select an authorized dealer network to audit operational performance</p>
                          </div>
                          <div className="flex bg-slate-105 dark:bg-slate-900 p-1 rounded-xl border border-[var(--neu-border)]">
                            <button 
                              type="button"
                              onClick={() => setSelectedDealerId('all')}
                              className={cn(
                                "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                                selectedDealerId === 'all' ? "bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] text-slate-800 dark:text-slate-100 active:shadow-[var(--neu-shadow-btn-active)]" : "text-slate-500 hover:text-slate-900"
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
                                  navigate('/mypc/complaints');
                                }}
                                className={cn(
                                  "p-6 rounded-2xl border-2 transition-all cursor-pointer group",
                                  selectedDealerId === dealer.uid 
                                    ? "bg-[var(--neu-surface)] border border-[var(--neu-border)] shadow-[var(--neu-shadow-btn)] text-slate-800 dark:text-slate-100 active:shadow-[var(--neu-shadow-btn-active)] border-slate-950 dark:border-brand-accent" 
                                    : "bg-[var(--neu-surface)] border-[var(--neu-border)] hover:border-brand-accent/50"
                                )}
                              >
                                <div className="flex justify-between items-start mb-6">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                    selectedDealerId === dealer.uid ? "bg-white/10" : "bg-[var(--neu-surface)]"
                                  )}>
                                    <TrendingUp size={24} className={selectedDealerId === dealer.uid ? "text-white" : "text-brand-accent"} />
                                  </div>
                                  <div className={cn(
                                    "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                                    selectedDealerId === dealer.uid ? "bg-white/20 border-white/30" : "bg-[var(--neu-surface)] border-[var(--neu-border)] text-slate-500"
                                  )}>
                                    {dealer.lineCode}
                                  </div>
                                </div>
                                
                                <h4 className="text-lg font-black uppercase tracking-tight mb-1 truncate text-slate-950 dark:text-slate-100">{dealer.username}</h4>
                                <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-6", selectedDealerId === dealer.uid ? "text-white/60" : "text-slate-400")}>Authorized Dealer Network</p>
                                
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 dark:border-white/10">
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
                          <div className="p-12 text-center border-2 border-dashed border-[var(--neu-border)] rounded-3xl">
                            <div className="w-16 h-16 bg-[var(--neu-surface)] rounded-full flex items-center justify-center mx-auto mb-6">
                              <ShieldAlert size={32} className="text-slate-300" />
                            </div>
                            <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">No Active Dealer Networks</h4>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Authorize dealers in the "Dealer Section" to start auditing their data.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-xl mx-auto p-12 bg-[var(--neu-surface)] border border-rose-200/50 dark:border-rose-950/50 rounded-3xl text-center space-y-6">
                        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/20 text-rose-500 mx-auto rounded-full flex items-center justify-center">
                          <ShieldAlert size={40} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-lg font-black uppercase text-slate-900 dark:text-white">Access Denied</h4>
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-widest leading-relaxed">
                            Secured Admin Node. Your current role lacks super-admin credentials.
                          </p>
                        </div>
                      </div>
                    )
                  )}

                  {/* Subview 12: Complain Reg submit_view */}
                  {mypcOpenedFile === 'submit_view' && (
                    <div className="max-w-4xl mx-auto text-left animate-in fade-in duration-300">
                      <div className="text-center space-y-2 mb-10">
                        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">Field Operations</h2>
                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Capture and process enterprise support requests</p>
                      </div>
                      <div className="pt-2 pb-8 relative">
                        {isSuspended && (
                          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/70 backdrop-blur-md rounded-3xl border border-red-500/20 p-6 text-center animate-in fade-in duration-300">
                            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 border border-red-200/50">
                              <ShieldAlert size={28} className="animate-bounce" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
                              Identity Suspended
                            </h3>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase mt-1 max-w-xs leading-relaxed">
                              Your dealer network access has been deactivated. Complaint registration is frozen.
                            </p>
                          </div>
                        )}
                        <div className={cn(isSuspended && "blur-[3px] pointer-events-none select-none opacity-30")}>
                          <ComplaintForm 
                            onSubmit={async (data) => {
                              await onRegisterComplaint(data);
                              navigate('/mypc/complaints');
                            }} 
                            isLoading={isLoading || false} 
                            appConfig={appConfig}
                            currentUser={currentUser}
                            branding={branding}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subview 13: Network Map map_view */}
                  {mypcOpenedFile === 'map_view' && (
                    <MapViewer
                      isOpen={mypcOpenedFile === 'map_view'}
                      onClose={() => navigate('/mypc')}
                      user={currentUser}
                    />
                  )}

                  {/* Subview 14: Receipt print_receipt_view */}
                  {mypcOpenedFile === 'print_receipt_view' && (
                    <ReceiptManager
                      currentUser={currentUser}
                      branding={branding}
                    />
                  )}

                  {/* Subview 15: WhatsApp Integration whatsapp_integration */}
                  {mypcOpenedFile === 'whatsapp_integration' && (
                    <div className="max-w-5xl mx-auto space-y-6 text-left animate-in fade-in duration-300">
                      {/* Safety / Anti-Ban Warning Header Card */}
                      <div className="p-4 sm:p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 text-slate-800 dark:text-amber-200">
                        <div className="flex gap-3 items-start">
                          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Safe Sending Compliance Warning</h4>
                            <p className="text-[11px] font-bold mt-1 text-amber-700/95 dark:text-amber-400/90 leading-relaxed">
                              Avoid sending more than ~50-100 messages per hour to reduce ban risk. Always personalize messages. Personalized tags (like <span className="font-mono text-xs text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 px-1 py-0.5 rounded">{"{{name}}"}</span> or <span className="font-mono text-xs text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 px-1 py-0.5 rounded">{"{{amount}}"}</span>) are automatically substituted to maintain natural variations.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <WhatsAppConnectPanel onClose={() => setMypcOpenedFile(null)} />
                        <WhatsAppMessageTemplateBox />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>


  );
}

