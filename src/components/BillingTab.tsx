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


interface BillingTabProps {
  [key: string]: any;
}

export default function BillingTab(props: BillingTabProps) {
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

          <div className="max-w-[115rem] mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Configure New Month Popup-card Block */}
            <AnimatePresence>
              {isConfiguringNewMonth && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn("p-6 rounded-2xl border space-y-4 max-w-lg mb-4", getCardStyle(branding.cardStyle))}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-white/10">
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
                        className="w-full px-4 py-3 text-xs uppercase font-black tracking-widest bg-[var(--neu-surface)] border border-[var(--neu-border)] rounded-xl focus:border-blue-500 select-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Year Tag</label>
                      <select
                        value={newMonthYear}
                        onChange={(e) => setNewMonthYear(e.target.value)}
                        className="w-full px-4 py-3 text-xs font-mono font-bold bg-[var(--neu-surface)] border border-[var(--neu-border)] rounded-xl focus:border-blue-500"
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
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors shadow-[var(--neu-shadow-raised-lg)] shadow-blue-500/10"
                    >
                      Launch Recovery Cycle
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>



            {/* FLOATING CORNER SECURITY SHIELD */}
            <div className="fixed bottom-6 left-4 lg:left-[88px] z-[90] flex items-end">
              <motion.div 
                layout
                initial={{ borderRadius: 9999 }}
                animate={{ 
                  width: isSecurityWidgetExpanded ? 'auto' : '48px',
                  borderRadius: isSecurityWidgetExpanded ? 20 : 9999
                }}
                className={cn(
                  "overflow-hidden shadow-[var(--neu-shadow-raised-lg)] border transition-colors flex items-center h-12",
                  isBillingUnlocked 
                    ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500/30 backdrop-blur-md" 
                    : "bg-amber-50 dark:bg-slate-900 border-amber-500/30 backdrop-blur-md",
                  !isSecurityWidgetExpanded && "cursor-pointer hover:scale-105"
                )}
                onClick={() => {
                  if (!isSecurityWidgetExpanded) setIsSecurityWidgetExpanded(true);
                }}
              >
                {/* Always visible Icon */}
                <div 
                  className={cn("w-12 h-12 shrink-0 flex items-center justify-center cursor-pointer transition-colors")}
                  onClick={(e) => {
                    if (isSecurityWidgetExpanded) {
                      e.stopPropagation();
                      setIsSecurityWidgetExpanded(false);
                    }
                  }}
                  title={isSecurityWidgetExpanded ? "Collapse Widget" : "Open Security Shield"}
                >
                  {isBillingUnlocked ? <Unlock size={20} className="text-emerald-600 dark:text-emerald-400" fill="currentColor" /> : <Lock size={20} className="text-amber-600 dark:text-amber-400" fill="currentColor" />}
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isSecurityWidgetExpanded && (
                    <motion.div 
                      key="content"
                      initial={{ opacity: 0, x: -10, width: 0 }}
                      animate={{ opacity: 1, x: 0, width: 'auto' }}
                      exit={{ opacity: 0, x: -10, width: 0 }}
                      className="flex items-center gap-3 pr-2 lg:pr-4 whitespace-nowrap overflow-hidden"
                    >
                      <div className="flex flex-col border-l border-slate-200 dark:border-slate-700/50 pl-3 mr-1 py-1">
                        <span className={cn("text-[9px] font-black tracking-widest uppercase leading-none mb-0.5",
                          isBillingUnlocked ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {isBillingUnlocked ? "UNLOCKED & ACTIVE" : "SECURED / VIEW-ONLY"}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                          {isBillingUnlocked ? "Write Privileges Enabled" : "Access Key Required"}
                        </span>
                      </div>

                      {!isBillingUnlocked ? (
                        <div className="flex items-center gap-1.5 ml-1">
                          <input
                            type="password"
                            value={billingKeyInput}
                            onChange={(e) => setBillingKeyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUnlockBilling();
                            }}
                            placeholder="INPUT PASSKEY..."
                            className="px-3 py-1.5 text-[10px] font-mono font-black tracking-widest bg-[var(--neu-surface)] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500/50 w-32 md:w-40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlockBilling();
                            }}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[9px] rounded-lg transition-colors shadow-[var(--neu-shadow-raised-sm)] shrink-0"
                          >
                            Verify
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5 ml-1">
                          {isEditingSecurityKey ? (
                            <div className="flex items-center gap-1.5 bg-white/50 dark:bg-slate-950/30 p-1 rounded-lg border border-emerald-500/20">
                              <input
                                type="text"
                                value={newSecurityKeyInput}
                                onChange={(e) => setNewSecurityKeyInput(e.target.value)}
                                placeholder="NEW KEY..."
                                className="px-2 py-1 text-[10px] font-mono font-black tracking-widest bg-[var(--neu-surface)] border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/30 w-28 text-slate-900 dark:text-slate-100"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveSecurityKey();
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-md transition-colors"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsEditingSecurityKey(false);
                                }}
                                className="px-2 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[9px] font-black uppercase tracking-widest transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewSecurityKeyInput(appConfig.billingSecurityKey || '1239870');
                                  setIsEditingSecurityKey(true);
                                }}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[9px] rounded-lg transition-colors flex items-center gap-1.5 shadow-[var(--neu-shadow-raised-sm)]"
                              >
                                Edit Key
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsBillingUnlocked(false);
                                  sessionStorage.removeItem('gts_billing_unlocked');
                                  window.dispatchEvent(new CustomEvent('gts-billing-unlocked-changed', { detail: false }));
                                  setBillingKeyInput('');
                                  toast.success("Billing spreadsheet re-locked successfully.");
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-450 border border-rose-200 dark:border-rose-900/30 font-black uppercase tracking-widest text-[9px] rounded-lg transition-colors shadow-[var(--neu-shadow-raised-sm)]"
                              >
                                Relock
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {currentMonthId ? (
              <>
                {/* Advanced Bento-Style Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    {
                      label: "Expected Revenue",
                      val: `PKR ${(totalExpected).toLocaleString()}`,
                      desc: `Base Amount: PKR ${(totalBase).toLocaleString()}`
                    },
                    {
                      label: "CR Payments",
                      val: `PKR ${(totalCr).toLocaleString()}`,
                      desc: `Arrears/Credit Recoveries`
                    },
                    {
                      label: "Fees Recovered",
                      val: `PKR ${(totalRecovered).toLocaleString()}`,
                      desc: `Actual payments received`
                    },
                    {
                      label: "Outstanding Balances",
                      val: `PKR ${(totalOutstanding).toLocaleString()}`,
                      desc: "Pending subscriber fees"
                    },
                    {
                      label: "Recovery Rate",
                      val: `${(recoveryRate).toFixed(1)}%`,
                      desc: "In-cycle performance index"
                    },
                    {
                      label: "Subscribers Active",
                      val: `${activeRows.length} Nodes`,
                      desc: `TDC: ${totalTDC} | DC: ${totalDC} | Unpaid: ${totalPending}`
                    }
                  ].map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: i * 0.05
                      }}
                      className="group relative p-3 sm:p-4 bg-[var(--neu-surface)]/90 rounded-xl border border-[var(--neu-border)] border-l-4 border-l-slate-800 dark:border-l-slate-400 flex flex-col justify-between overflow-hidden shadow-[var(--neu-shadow-raised-sm)] hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-300 cursor-default"
                    >
                      <div className="space-y-2 relative z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none">
                            {card.label}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-tight font-sans text-slate-900 dark:text-white leading-none" title={card.val}>
                            {card.val}
                          </div>
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-relaxed whitespace-pre-wrap" title={card.desc}>
                            {card.desc}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Filters, Search and Real-Time Grid section */}
                <div className={cn("p-6 sm:p-8", getCardStyle(branding.cardStyle), "space-y-6")}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                      <Layers size={16} className="text-blue-500" />
                      Recovery Rows ({filteredRows.length} listed)
                      
                      {/* Header Save Changes Button */}
                      <AnimatePresence>
                      </AnimatePresence>

                      <motion.button
                        layout
                        whileHover={{ 
                          scale: 1.05, 
                          boxShadow: isAdvanceMode 
                            ? "0px 0px 15px rgba(59, 130, 246, 0.5)" 
                            : "0px 0px 10px rgba(148, 163, 184, 0.25)"
                        }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        onClick={() => setIsAdvanceMode(!isAdvanceMode)}
                        className={cn(
                          "ml-2 text-[9.5px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl cursor-pointer transition-all duration-300 inline-flex items-center gap-1.5 shrink-0 border relative overflow-hidden",
                          isAdvanceMode
                            ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white border-blue-400 font-sans font-black shadow-[var(--neu-shadow-raised-lg)]"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 font-sans font-black"
                        )}
                        title="Toggle view of advanced business parameters"
                      >
                        {isAdvanceMode && (
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        )}
                        <Zap size={12} className={cn(isAdvanceMode ? "text-amber-300 fill-amber-300 animate-bounce" : "text-blue-500 animate-pulse")} />
                        <span>{isAdvanceMode ? "★ Advance Details ON" : "⚡ Advance Details"}</span>
                      </motion.button>
                    </h4>

                    {/* Filters block */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Search box */}
                      <input
                        type="text"
                        value={billingSearchQuery}
                        onChange={(e) => setBillingSearchQuery(e.target.value)}
                        placeholder="Search Name, User ID, PPPoE..."
                        className="px-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-[var(--neu-border)] rounded-xl focus:border-blue-500 w-full sm:w-64"
                      />

                      {/* Status selector */}
                      <select
                        value={billingStatusFilter}
                        onChange={(e) => setBillingStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-[var(--neu-border)] rounded-xl focus:border-blue-500 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                      >
                        <option value="all">ALL PAYMENT FLAGS</option>
                        <option value="paid">PAID</option>
                        <option value="partial">PARTIAL</option>
                        <option value="unpaid">UNPAID</option>
                        <option value="tdc">TDC (SUSPENDED)</option>
                        <option value="dc">DC (DISCONNECTED)</option>
                        <option value="extra">EXTRA (UNSPECIFIED / EXPENSE)</option>
                      </select>

                      {/* Area selector */}
                      <select
                        value={billingAreaFilter}
                        onChange={(e) => setBillingAreaFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-[var(--neu-border)] rounded-xl focus:border-blue-500 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                      >
                        <option value="all">ALL AREAS</option>
                        {Array.from(new Set(activeRows.map((r: any) => r.area).filter(Boolean))).map((areaName: any, idx) => (
                          <option key={`area-${areaName}-${idx}`} value={areaName}>{areaName}</option>
                        ))}
                      </select>
                      <button
                        onClick={resetBillingColumnWidths}
                        className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5"
                        title="Reset Column Widths"
                      >
                        <RotateCcw size={14} />
                        <span className="hidden xl:inline">Reset Widths</span>
                      </button>
  
                    </div>
                  </div>

                  {/* Absolute Google Sheets Spreadsheet Emulator Layout (Horizontal Scroll single row grid) */}
                  <div className="border border-[var(--neu-border)] rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-inner hidden md:block">
                    <div 
                      ref={billingScrollContainerRef}
                      onMouseMove={handleBillingMouseMove}
                      onMouseLeave={handleBillingMouseLeave}
                      className="overflow-x-auto"
                    >
                      <table id="billing-spreadsheet-table" className="w-full border-collapse text-left text-xs text-slate-950 dark:text-slate-100">
                        <thead>
                          <tr className="bg-[var(--neu-surface)] border-b border-slate-200 dark:border-white/10 font-extrabold uppercase text-[10px] tracking-wider text-slate-950 dark:text-slate-100 font-sans select-none whitespace-nowrap">

                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.sr}px`, minWidth: `${billingColWidths.sr}px`, maxWidth: `${billingColWidths.sr}px` }}
                              onClick={() => handleBillingSort('sr')}
                            >
                              <div className="flex items-center justify-center">
                                Sr#{getBillingSortIcon('sr')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'sr')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.name}px`, minWidth: `${billingColWidths.name}px`, maxWidth: `${billingColWidths.name}px` }}
                              onClick={() => handleBillingSort('name')}
                            >
                              <div className="flex items-center justify-start">
                                FULL NAME{getBillingSortIcon('name')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'name')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.username}px`, minWidth: `${billingColWidths.username}px`, maxWidth: `${billingColWidths.username}px` }}
                              onClick={() => handleBillingSort('username')}
                            >
                              <div className="flex items-center justify-start">
                                USER ID (PPPoE){getBillingSortIcon('username')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'username')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.mobile}px`, minWidth: `${billingColWidths.mobile}px`, maxWidth: `${billingColWidths.mobile}px` }}
                              onClick={() => handleBillingSort('mobileNumber')}
                            >
                              <div className="flex items-center justify-start">
                                MOBILE #{getBillingSortIcon('mobileNumber')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'mobile')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.panelDetails}px`, minWidth: `${billingColWidths.panelDetails}px`, maxWidth: `${billingColWidths.panelDetails}px` }}
                              onClick={() => handleBillingSort('panelDetails')}
                            >
                              <div className="flex items-center justify-start">
                                PANEL DETAILS{getBillingSortIcon('panelDetails')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'panelDetails')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.area}px`, minWidth: `${billingColWidths.area}px`, maxWidth: `${billingColWidths.area}px` }}
                              onClick={() => handleBillingSort('area')}
                            >
                              <div className="flex items-center justify-center">
                                AREA{getBillingSortIcon('area')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'area')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.rt}px`, minWidth: `${billingColWidths.rt}px`, maxWidth: `${billingColWidths.rt}px` }}
                              onClick={() => handleBillingSort('rt')}
                            >
                              <div className="flex items-center justify-center">
                                RT{getBillingSortIcon('rt')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'rt')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.baseAmount}px`, minWidth: `${billingColWidths.baseAmount}px`, maxWidth: `${billingColWidths.baseAmount}px` }}
                              onClick={() => handleBillingSort('baseAmount')}
                            >
                              <div className="flex items-center justify-end">
                                B. AMOUNT{getBillingSortIcon('baseAmount')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'baseAmount')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.cr}px`, minWidth: `${billingColWidths.cr}px`, maxWidth: `${billingColWidths.cr}px` }}
                              onClick={() => handleBillingSort('cr')}
                            >
                              <div className="flex items-center justify-end">
                                CR. (ARREARS){getBillingSortIcon('cr')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'cr')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors bg-slate-100/50 dark:bg-slate-900/50" 
                              style={{ width: `${billingColWidths.totalAmount}px`, minWidth: `${billingColWidths.totalAmount}px`, maxWidth: `${billingColWidths.totalAmount}px` }}
                              onClick={() => handleBillingSort('totalAmount')}
                            >
                              <div className="flex items-center justify-end">
                                T. AMOUNT{getBillingSortIcon('totalAmount')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'totalAmount')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.billingDay}px`, minWidth: `${billingColWidths.billingDay}px`, maxWidth: `${billingColWidths.billingDay}px` }}
                              onClick={() => handleBillingSort('billingDay')}
                            >
                              <div className="flex items-center justify-center">
                                BD{getBillingSortIcon('billingDay')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'billingDay')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-right cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600" 
                              style={{ width: `${billingColWidths.paymentReceived}px`, minWidth: `${billingColWidths.paymentReceived}px`, maxWidth: `${billingColWidths.paymentReceived}px` }}
                              onClick={() => handleBillingSort('paymentReceived')}
                            >
                              <div className="flex items-center justify-end">
                                RECOVERY{getBillingSortIcon('paymentReceived')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'paymentReceived')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.paymentStatus}px`, minWidth: `${billingColWidths.paymentStatus}px`, maxWidth: `${billingColWidths.paymentStatus}px` }}
                              onClick={() => handleBillingSort('paymentStatus')}
                            >
                              <div className="flex items-center justify-center">
                                STATUS{getBillingSortIcon('paymentStatus')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'paymentStatus')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            {isAdvanceMode && (
                              <>

                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors " 
                              style={{ width: `${billingColWidths.comments}px`, minWidth: `${billingColWidths.comments}px`, maxWidth: `${billingColWidths.comments}px` }}
                              onClick={() => handleBillingSort('comments')}
                            >
                              <div className="flex items-center justify-start">
                                COMMENTS{getBillingSortIcon('comments')}
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'comments')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left  " 
                              style={{ width: `${billingColWidths.occupation}px`, minWidth: `${billingColWidths.occupation}px`, maxWidth: `${billingColWidths.occupation}px` }}
                              
                            >
                              <div className="flex items-center justify-start">
                                OCCUPATION
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'occupation')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-left  " 
                              style={{ width: `${billingColWidths.pkg}px`, minWidth: `${billingColWidths.pkg}px`, maxWidth: `${billingColWidths.pkg}px` }}
                              
                            >
                              <div className="flex items-center justify-start">
                                PKG DETAILS
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'pkg')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center  " 
                              style={{ width: `${billingColWidths.date}px`, minWidth: `${billingColWidths.date}px`, maxWidth: `${billingColWidths.date}px` }}
                              
                            >
                              <div className="flex items-center justify-center">
                                DATE
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'date')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-right  " 
                              style={{ width: `${billingColWidths.device}px`, minWidth: `${billingColWidths.device}px`, maxWidth: `${billingColWidths.device}px` }}
                              
                            >
                              <div className="flex items-center justify-end">
                                DEVICE
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'device')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-right  " 
                              style={{ width: `${billingColWidths.abl}px`, minWidth: `${billingColWidths.abl}px`, maxWidth: `${billingColWidths.abl}px` }}
                              
                            >
                              <div className="flex items-center justify-end">
                                ABL
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'abl')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                              </>
                            )}

                            <th 
                              className="relative py-2 px-1.5 border-r border-slate-200 dark:border-white/10 text-center  " 
                              style={{ width: `${billingColWidths.act}px`, minWidth: `${billingColWidths.act}px`, maxWidth: `${billingColWidths.act}px` }}
                              
                            >
                              <div className="flex items-center justify-center">
                                ACT
                              </div>
                              <div
                                onMouseDown={(e) => handleBillingColResizeStart(e, 'act')}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </th>
                          </tr>
</thead>
                        <tbody 
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '500px' }}
                          className={cn(
                            "divide-y divide-slate-200 dark:divide-slate-800 font-sans text-[13.5px] font-black text-slate-950 dark:text-zinc-50",
                            !isBillingUnlocked && "[&_input:disabled]:pointer-events-none [&_select:disabled]:pointer-events-none [&_button:disabled]:pointer-events-none"
                          )}>
                          {paginatedRows.map((rowRef, localIdx) => {
                            // Find corresponding absolute row index in full month rows array
                            const globalRowIdx = rowRef._originalIndex;
                            if (globalRowIdx === undefined || globalRowIdx === -1) return null;
                            
                            const outstandingCr = parseFloat(rowRef.cr) || 0;
                            const isPaid = rowRef.paymentStatus === 'paid';
                            const isPartial = rowRef.paymentStatus === 'partial';
                            const isUnpaid = rowRef.paymentStatus === 'unpaid';
                            const isTdc = rowRef.paymentStatus === 'tdc';
                            const isDc = rowRef.paymentStatus === 'dc';
                            const isExtra = rowRef.paymentStatus === 'extra' || rowRef.name === 'Unspecified Entry';

                            return (
                              <tr
                                key={`${rowRef.clientId || rowRef.username || 'row'}-${localIdx}`}
                                className={cn(
                                  "hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap",
                                  !isBillingUnlocked && "cursor-pointer",
                                  isTdc && "bg-rose-500/5 text-rose-500",
                                  isDc && "bg-neutral-500/10 text-neutral-500"
                                )}
                                onClick={(e) => {
                                  if (!isBillingUnlocked) {
                                    setSelectedRecoveryRow(rowRef);
                                  }
                                }}
                              >
                                {/* Sr# */}
                                <td className="py-1 px-1 border-r border-[var(--neu-border)] text-center select-none font-sans text-[11px] font-bold">
                                  <div className="flex items-center justify-center gap-1">
                                    <span>{localIdx + 1}</span>
                                  </div>
                                </td>
                                <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-[13.5px] font-black">
                                  {renderCellProgress(globalRowIdx, 'name')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_name`}
                                    type="text"
                                    value={rowRef.name || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value)}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'name', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value, true)}
                                    className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[13.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                    placeholder="Enter full name"
                                  />
                                </td>

                                {/* User ID / Username */}
                                <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-[13.5px] font-black text-black dark:text-white">
                                  {renderCellProgress(globalRowIdx, 'username')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_username`}
                                    type="text"
                                    value={rowRef.username || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value)}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'username', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value, true)}
                                    className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[13.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-sans font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                  />
                                </td>

                                {/* Mobile */}
                                <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-[13px] font-black text-black dark:text-white ">
                                  {renderCellProgress(globalRowIdx, 'mobileNumber')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_mobileNumber`}
                                    type="text"
                                    value={rowRef.mobileNumber || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'mobileNumber', e.target.value)}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'mobileNumber', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'mobileNumber', e.target.value, true)}
                                    className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[13px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-sans font-black tracking-tight whitespace-nowrap overflow-visible hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                    placeholder="03XXXXXXXXX"
                                  />
                                </td>

                                {/* Panel Details */}
                                <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-[13px] font-black text-black dark:text-white ">
                                  {renderCellProgress(globalRowIdx, 'panelDetails')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_panelDetails`}
                                    type="text"
                                    value={rowRef.panelDetails || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'panelDetails', e.target.value.toUpperCase())}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'panelDetails', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'panelDetails', e.target.value.toUpperCase(), true)}
                                    className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[13px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-sans font-black tracking-tight whitespace-nowrap hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                    placeholder="Panel Details"
                                  />
                                </td>

                                {/* Area */}
                                <td className="relative py-1 px-1 border-r border-[var(--neu-border)]/80 text-center font-sans">
                                  {renderCellProgress(globalRowIdx, 'area')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_area`}
                                    type="text"
                                    value={rowRef.area || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'area', e.target.value)}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'area', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'area', e.target.value, true)}
                                    className="w-full min-w-0 text-center bg-transparent px-1 py-0.5 border-none rounded text-[13px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black uppercase hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                  />
                                </td>

                                {/* RT */}
                                <td className="relative py-1 px-1 border-r border-[var(--neu-border)]/80 text-center font-sans">
                                  {renderCellProgress(globalRowIdx, 'rt')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_rt`}
                                    type="text"
                                    value={rowRef.rt || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'rt', e.target.value)}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'rt', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'rt', e.target.value, true)}
                                    className="w-full min-w-0 text-center bg-transparent px-1 py-0.5 border-none rounded text-[13px] focus:ring-1 focus:ring-blue-500/30 font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-blue-900 dark:disabled:text-blue-300 disabled:opacity-100"
                                  />
                                </td>

                                {/* Base Amount */}
                                <td className="relative py-1 px-1 border-r border-[var(--neu-border)]/80 text-right font-sans">
                                  {renderCellProgress(globalRowIdx, 'baseAmount')}
                                  <div className="flex items-center justify-end font-black text-black">
                                    <span className="text-black dark:text-zinc-200 mr-0.5 font-black text-[11px]">PKR</span>
                                    <input
                                      id={`rec_cell_${globalRowIdx}_baseAmount`}
                                      type="number"
                                      value={isTdc || isDc ? 0 : (rowRef.baseAmount ?? '')}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'baseAmount', activeRows.length)}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', parseFloat(e.target.value) || 0, true)}
                                      className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100 text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                </td>

                                {/* Cr. Arrears */}
                                <td className="relative py-1 px-1 border-r border-[var(--neu-border)]/80 text-right font-sans">
                                  {renderCellProgress(globalRowIdx, 'cr')}
                                  <div className="flex items-center justify-end">
                                    <span className={cn("mr-0.5 font-black text-[11px]", outstandingCr > 0 ? "text-rose-750 dark:text-rose-450" : "text-black dark:text-zinc-200")}>PKR</span>
                                    <input
                                      id={`rec_cell_${globalRowIdx}_cr`}
                                      type="number"
                                      value={isDc ? 0 : (rowRef.cr ?? '')}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'cr', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'cr', activeRows.length)}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'cr', parseFloat(e.target.value) || 0, true)}
                                      className={cn(
                                        "w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                        outstandingCr > 0 ? "text-rose-750 dark:text-rose-450 font-black disabled:text-rose-750 dark:disabled:text-rose-450 disabled:opacity-100" : "text-black dark:text-white font-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      )}
                                    />
                                  </div>
                                </td>

                                {/* Total Amount */}
                                <td className="py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-right text-black dark:text-white bg-slate-100/50 dark:bg-slate-900/50 select-none font-black text-[13.5px] font-sans">
                                  PKR {isDc ? 0 : (isTdc ? (rowRef.cr || 0) : (rowRef.totalAmount || 0)).toLocaleString()}
                                </td>

                                {/* BD (Billing Day) */}
                                <td className="relative py-1 px-0 border-r border-[var(--neu-border)]/80 text-center select-all font-sans  ">
                                  {renderCellProgress(globalRowIdx, 'billingDay')}
                                  <input
                                    id={`rec_cell_${globalRowIdx}_billingDay`}
                                    type="text"
                                    maxLength={2}
                                    value={rowRef.billingDay || ''}
                                    disabled={false}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'billingDay', e.target.value.slice(0, 2))}
                                    onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'billingDay', activeRows.length)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'billingDay', e.target.value.slice(0, 2), true)}
                                    className="w-full min-w-0 flex-1 text-center bg-transparent px-0 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[12px] disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                  />
                                </td>

                                {/* Monthly Paid Recovery */}
                                <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)] bg-emerald-500/5 dark:bg-emerald-500/15 text-right text-emerald-950 dark:text-emerald-100 font-sans">
                                  {renderCellProgress(globalRowIdx, 'paymentReceived')}
                                  <div className="flex items-center justify-end">
                                    <span className="text-emerald-900 dark:text-emerald-400 mr-0.5 font-black text-[11px]">PKR</span>
                                    <input
                                      id={`rec_cell_${globalRowIdx}_paymentReceived`}
                                      type="number"
                                      value={isDc ? 0 : (rowRef.paymentReceived ?? '')}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'paymentReceived', activeRows.length)}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', parseFloat(e.target.value) || 0, true)}
                                      className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans font-black text-emerald-950 dark:text-emerald-100 hover:bg-white/20 dark:hover:bg-black/15 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-emerald-950 dark:disabled:text-emerald-100 disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-center font-sans">
                                  {renderCellProgress(globalRowIdx, 'paymentStatus')}
                                  <select
                                    id={`rec_cell_${globalRowIdx}_paymentStatus`}
                                    value={rowRef.paymentStatus}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentStatus', e.target.value, true)}
                                    className={cn(
                                      "px-2 py-0.5 text-[12px] font-black uppercase text-center rounded-lg border focus:ring-1 focus:ring-blue-500/30 w-full min-w-0 bg-[var(--neu-surface)] disabled:opacity-100  font-sans",
                                      isPaid && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200 dark:border-emerald-900/30 font-black",
                                      isPartial && "bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-200 dark:border-amber-900/30 font-black",
                                      isUnpaid && "bg-slate-200 dark:bg-slate-800 text-black dark:text-white border-slate-400 dark:border-slate-600 font-black",
                                      isTdc && "bg-rose-100 dark:bg-rose-950/50 text-rose-700 border-rose-200 dark:border-rose-900/50 font-black",
                                      isDc && "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 font-black",
                                      isExtra && "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200 dark:border-purple-900/30 font-black"
                                    )}
                                  >
                                    <option value="unpaid">UNPAID</option>
                                    <option value="paid">PAID</option>
                                    <option value="partial">PARTIAL</option>
                                    <option value="tdc">TDC</option>
                                    <option value="dc">DC</option>
                                    <option value="extra">EXTRA</option>
                                  </select>
                                </td>
                                {/* Comments & other advance columns */}
                                {isAdvanceMode && (
                                  <>
                                    {/* Comments */}
                                    <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans">
                                      {renderCellProgress(globalRowIdx, 'comments')}
                                      <input
                                        id={`rec_cell_${globalRowIdx}_comments`}
                                        type="text"
                                        value={rowRef.comments || ''}
                                        disabled={!isBillingUnlocked}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'comments', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value, true)}
                                        className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      />
                                    </td>
                                    {/* Occupation */}
                                    <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans">
                                      {renderCellProgress(globalRowIdx, 'occ')}
                                      <input
                                        id={`rec_cell_${globalRowIdx}_occ`}
                                        type="text"
                                        value={rowRef.occ || rowRef.occupation || ''}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'occ', e.target.value)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'occ', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'occ', e.target.value, true)}
                                        className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      />
                                    </td>
                                    {/* PKG Details */}
                                    <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans">
                                      {renderCellProgress(globalRowIdx, 'pkgDetails')}
                                      <input
                                        id={`rec_cell_${globalRowIdx}_pkgDetails`}
                                        type="text"
                                        value={rowRef.pkgDetails || ''}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'pkgDetails', e.target.value)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'pkgDetails', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'pkgDetails', e.target.value, true)}
                                        className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      />
                                    </td>
                                    {/* Date */}
                                    <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-center">
                                      {renderCellProgress(globalRowIdx, 'connectionDate')}
                                      <input
                                        id={`rec_cell_${globalRowIdx}_connectionDate`}
                                        type="text"
                                        value={rowRef.connectionDate || ''}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'connectionDate', e.target.value)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'connectionDate', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'connectionDate', e.target.value, true)}
                                        className="w-full min-w-0 text-center bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      />
                                    </td>
                                    {/* Device Price */}
                                    <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-right">
                                      {renderCellProgress(globalRowIdx, 'devicePrice')}
                                      <div className="flex items-center justify-end">
                                        <span className="text-slate-400 mr-0.5 font-black text-[11px]">PKR</span>
                                        <input
                                          id={`rec_cell_${globalRowIdx}_devicePrice`}
                                          type="number"
                                          value={rowRef.devicePrice ?? ''}
                                          disabled={!isBillingUnlocked}
                                          onChange={(e) => handleSaveRowField(globalRowIdx, 'devicePrice', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                          onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'devicePrice', activeRows.length)}
                                          onBlur={(e) => handleSaveRowField(globalRowIdx, 'devicePrice', parseFloat(e.target.value) || 0, true)}
                                          className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-black dark:disabled:text-white disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                    </td>
                                    {/* ABL */}
                                    <td className="py-1 px-1.5 border-r border-slate-200/50 dark:border-white/10/50 bg-slate-100/30 dark:bg-slate-900/30 text-right font-sans">
                                      {renderCellProgress(globalRowIdx, 'abl')}
                                      <div className="flex items-center justify-end">
                                        <span className="text-slate-400 mr-0.5 font-black text-[11px]">PKR</span>
                                        <input
                                          id={`rec_cell_${globalRowIdx}_abl`}
                                          type="number"
                                          value={rowRef.abl ?? ''}
                                          disabled={!isBillingUnlocked}
                                          onChange={(e) => handleSaveRowField(globalRowIdx, 'abl', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                          onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'abl', activeRows.length)}
                                          onBlur={(e) => handleSaveRowField(globalRowIdx, 'abl', parseFloat(e.target.value) || 0, true)}
                                          className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-black dark:disabled:text-white disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                    </td>
                                  </>
                                )}
                                {/* Action Column (Delete Row) */}
                                <td 
                                  className="py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-center font-sans"
                                  style={{ width: `${billingColWidths.act}px`, minWidth: `${billingColWidths.act}px`, maxWidth: `${billingColWidths.act}px`, overflow: 'hidden' }}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                      <WhatsAppSendButton
                                        name={rowRef.name || ''}
                                        mobileNumber={rowRef.mobileNumber || rowRef.phone || rowRef.number || ''}
                                        totalAmount={rowRef.totalAmount}
                                        baseAmount={rowRef.baseAmount}
                                        paymentStatus={rowRef.paymentStatus || 'unpaid'}
                                        username={rowRef.username || rowRef.clientId || ''}
                                        area={rowRef.area || ''}
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          triggerDeleteBillingRow(globalRowIdx);
                                        }}
                                        disabled={!isBillingUnlocked}
                                        className="p-1 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                                        title="Delete Row"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-[var(--neu-surface)] sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t-2 border-slate-300 dark:border-slate-700">
                          <tr>
                            <td colSpan={7} className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-widest bg-slate-100 dark:bg-slate-900 shadow-inner">
                              Current Page Totals
                            </td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black bg-slate-200/60 dark:bg-slate-800/60 text-black dark:text-white">
                              PKR {Math.round(paginatedRows.reduce((a, r) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.baseAmount) || 0)), 0)).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black bg-rose-500/10 text-rose-700 dark:text-rose-400">
                              PKR {Math.round(paginatedRows.reduce((a, r) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.cr) || 0)), 0)).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black bg-slate-200/60 dark:bg-slate-800/60 text-black dark:text-white">
                              PKR {Math.round(paginatedRows.reduce((a, r) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.totalAmount) || 0)), 0)).toLocaleString()}
                            </td>
                            <td className="py-4 px-3 border-r border-slate-200/50 dark:border-white/10/50 bg-slate-50 dark:bg-slate-950/30"></td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black text-lg text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 shadow-inner">
                              PKR {Math.round(paginatedRows.reduce((a, r) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.paymentReceived) || 0)), 0)).toLocaleString()}
                            </td>
                            <td colSpan={isAdvanceMode ? 8 : 2} className="py-4 px-4 border-slate-200/50 dark:border-white/10/50 text-left font-sans text-[10px] text-black dark:text-zinc-200 font-extrabold uppercase tracking-widest bg-slate-50 dark:bg-slate-950/30">
                              (Current Page)
                            </td>
                          </tr>
                          {/* Grand Total Row */}
                          <tr className="border-t border-slate-300 dark:border-slate-700">
                            <td colSpan={7} className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black text-slate-800 dark:text-slate-200 text-sm uppercase tracking-widest bg-slate-100 dark:bg-slate-900 shadow-inner">
                              Grand Total (All Pages)
                            </td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black bg-slate-200/60 dark:bg-slate-800/60 text-black dark:text-white">
                              PKR {Math.round(mainSortedRows.reduce((a: number, r: any) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.baseAmount) || 0)), 0)).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black bg-rose-500/10 text-rose-700 dark:text-rose-400">
                              PKR {Math.round(mainSortedRows.reduce((a: number, r: any) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.cr) || 0)), 0)).toLocaleString()}
                            </td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black bg-slate-200/60 dark:bg-slate-800/60 text-black dark:text-white">
                              PKR {Math.round(mainSortedRows.reduce((a: number, r: any) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.totalAmount) || 0)), 0)).toLocaleString()}
                            </td>
                            <td className="py-4 px-3 border-r border-slate-200/50 dark:border-white/10/50 bg-slate-50 dark:bg-slate-950/30"></td>
                            <td className="py-4 px-4 border-r border-slate-200/50 dark:border-white/10/50 text-right font-sans font-black text-lg text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 shadow-inner">
                              PKR {Math.round(mainSortedRows.reduce((a: number, r: any) => a + (r.paymentStatus === 'dc' ? 0 : (parseFloat(r.paymentReceived) || 0)), 0)).toLocaleString()}
                            </td>
                            <td colSpan={isAdvanceMode ? 8 : 2} className="py-4 px-4 border-slate-200/50 dark:border-white/10/50 text-left font-sans text-[10px] text-black dark:text-zinc-200 font-extrabold uppercase tracking-widest bg-slate-50 dark:bg-slate-950/30">
                              (Cumulative total of {mainSortedRows.length} active rows)
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Premium Pagination controls */}
                    {totalMainPages > 1 && (
                      <div className="flex items-center justify-between border-t border-[var(--neu-border)] bg-slate-50 dark:bg-slate-900/60 p-3 sm:px-6 select-none flex-wrap gap-3">
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-sans font-bold uppercase tracking-wider">
                          Showing <span className="text-slate-600 dark:text-slate-400 font-sans">{((currentMainPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-600 dark:text-slate-400 font-sans">{Math.min(currentMainPage * itemsPerPage, mainSortedRows.length)}</span> of <span className="text-slate-600 dark:text-slate-400 font-sans">{mainSortedRows.length}</span> rows
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            disabled={currentMainPage === 1}
                            onClick={() => {
                              setBillingPage(1);
                              const tbl = document.getElementById('billing-spreadsheet-table');
                              if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }}
                            className="p-1 px-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] dark:hover:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                            title="First Page"
                          >
                            « First
                          </button>
                          <button
                            type="button"
                            disabled={currentMainPage === 1}
                            onClick={() => {
                              setBillingPage(prev => Math.max(prev - 1, 1));
                              const tbl = document.getElementById('billing-spreadsheet-table');
                              if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }}
                            className="p-1 px-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] dark:hover:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                          >
                            ◀ Prev
                          </button>
                          
                          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/30 font-sans">
                            Page {currentMainPage} of {totalMainPages}
                          </div>

                          <button
                            type="button"
                            disabled={currentMainPage === totalMainPages}
                            onClick={() => {
                              setBillingPage(prev => Math.min(prev + 1, totalMainPages));
                              const tbl = document.getElementById('billing-spreadsheet-table');
                              if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }}
                            className="p-1 px-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] dark:hover:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                          >
                            Next ▶
                          </button>
                          <button
                            type="button"
                            disabled={currentMainPage === totalMainPages}
                            onClick={() => {
                              setBillingPage(totalMainPages);
                              const tbl = document.getElementById('billing-spreadsheet-table');
                              if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }}
                            className="p-1 px-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] dark:hover:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
                            title="Last Page"
                          >
                            Last »
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compact ultra-premium responsive Mobile Frames view for Android/mobile screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: '500px' }}>
                    {paginatedRows.map((rowRef, localIdx) => {
                      const globalRowIdx = rowRef._originalIndex;
                      if (globalRowIdx === undefined || globalRowIdx === -1) return null;
                      
                      const outstandingCr = parseFloat(rowRef.cr) || 0;
                      const isPaid = rowRef.paymentStatus === 'paid';
                      const isPartial = rowRef.paymentStatus === 'partial';
                      const isUnpaid = rowRef.paymentStatus === 'unpaid';
                      const isTdc = rowRef.paymentStatus === 'tdc';
                      const isDc = rowRef.paymentStatus === 'dc';
                      const isExtra = rowRef.paymentStatus === 'extra' || rowRef.name === 'Unspecified Entry';

                      return (
                        <motion.div 
                          key={`mobile-billing-frame-${rowRef.clientId || rowRef.username || 'idx'}-${localIdx}`}
                          initial={false}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          whileHover={{ scale: 1.01 }}
                          transition={{ duration: 0.15 }}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '200px' }}
                          onClick={(e) => {
                            if (!isBillingUnlocked) {
                              setSelectedRecoveryRow(rowRef);
                            }
                          }}
                          className={cn(
                            "p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-[var(--neu-shadow-raised-sm)]",
                            !isBillingUnlocked && "cursor-pointer [&_input:disabled]:pointer-events-none [&_select:disabled]:pointer-events-none [&_button:disabled]:pointer-events-none",
                            isTdc 
                              ? "bg-rose-500/5 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-450" 
                              : isDc
                              ? "bg-neutral-500/5 dark:bg-neutral-900/40 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                              : isPaid 
                              ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-100" 
                              : isPartial 
                              ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-100" 
                              : "bg-[var(--neu-surface)]/95 border-[var(--neu-border)] text-slate-800 dark:text-slate-100"
                          )}
                        >
                          {/* Top bar */}
                          <div className="flex items-start justify-between gap-2 border-b border-dotted border-[var(--neu-border)] pb-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[9px] bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] text-slate-700 dark:text-slate-300 font-black px-1.5 py-0.5 rounded shrink-0">
                                #{globalRowIdx + 1}
                              </span>
                              {isBillingUnlocked && (
                                <div className="flex items-center gap-1">
                                  <WhatsAppSendButton
                                    name={rowRef.name || ""}
                                    mobileNumber={rowRef.mobileNumber || rowRef.phone || rowRef.number || ""}
                                    totalAmount={rowRef.totalAmount}
                                    baseAmount={rowRef.baseAmount}
                                    paymentStatus={rowRef.paymentStatus || "unpaid"}
                                    username={rowRef.username || rowRef.clientId || ""}
                                    area={rowRef.area || ""}
                                  />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerDeleteBillingRow(globalRowIdx);
                                  }}
                                  className="p-1 rounded text-rose-600 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-950/40 shrink-0 cursor-pointer"
                                  title="Delete Row"
                                >
                                  <Trash2 size={13} />
                                </button>
                                </div>
                              )}
                              <div className="min-w-0">
                                <input
                                  type="text"
                                  value={rowRef.name || ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value)}
                                  onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'name', activeRows.length)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value, true)}
                                  className="w-full bg-transparent border-none p-0 text-[12.5px] font-black focus:ring-0 text-black dark:text-white"
                                  placeholder="Full Name"
                                />
                                <input
                                  type="text"
                                  value={rowRef.username || rowRef.clientId || ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value)}
                                  onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'username', activeRows.length)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value, true)}
                                  className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-slate-500 focus:ring-0 uppercase tracking-wide"
                                  placeholder="USER ID"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <select
                                value={rowRef.paymentStatus}
                                disabled={!isBillingUnlocked}
                                onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentStatus', e.target.value, true)}
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-black uppercase text-center rounded border focus:ring-0  font-sans",
                                  isPaid && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200 dark:border-emerald-900/30",
                                  isPartial && "bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-200 dark:border-amber-900/30",
                                  isUnpaid && "bg-slate-200 dark:bg-slate-800 text-black dark:text-white border-slate-400 dark:border-slate-600",
                                  isTdc && "bg-rose-100 dark:bg-rose-950/50 text-rose-700 border-rose-200 dark:border-rose-900/50",
                                  isDc && "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700",
                                  isExtra && "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200 dark:border-purple-900/30"
                                )}
                              >
                                <option value="unpaid">UNPAID</option>
                                <option value="paid">PAID</option>
                                <option value="partial">PARTIAL</option>
                                <option value="tdc">TDC</option>
                                <option value="dc">DC</option>
                                <option value="extra">EXTRA</option>
                              </select>
                              <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                <Phone size={8} /> {rowRef.mobileNumber || rowRef.phone || rowRef.number || 'NO PHONE'}
                              </div>
                            </div>
                          </div>

                          {/* Amounts */}
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-[var(--neu-surface)] border border-[var(--neu-border)] p-2 rounded-xl flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Dues</span>
                              <div className="flex items-center text-[13px] font-black text-black dark:text-white">
                                <span className="text-[9px] mr-1 opacity-60">PKR</span>
                                {(isTdc ? outstandingCr : (rowRef.totalAmount || 0)).toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl flex flex-col justify-center relative overflow-hidden">
                              <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Paid</span>
                              <div className="flex items-center text-[14px] font-black text-emerald-900 dark:text-emerald-300">
                                <span className="text-[9px] mr-1 opacity-60">PKR</span>
                                <input
                                  type="number"
                                  value={rowRef.paymentReceived ?? ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', parseFloat(e.target.value) || 0, true)}
                                  className="w-full bg-transparent border-none p-0 text-[14px] font-black text-emerald-900 dark:text-emerald-300 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Arrears and Package */}
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arrears</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={rowRef.cr ?? ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'cr', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'cr', parseFloat(e.target.value) || 0, true)}
                                  className={cn(
                                    "w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-[var(--neu-border)] rounded text-left font-sans text-black dark:text-white text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    outstandingCr > 0 && "text-rose-600 dark:text-rose-450 font-black border-rose-200 dark:border-rose-900/40"
                                  )}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Pkg</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={rowRef.baseAmount ?? ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', parseFloat(e.target.value) || 0, true)}
                                  className="w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-[var(--neu-border)] rounded text-right font-sans text-black dark:text-white text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Extra advanced fields toggleable */}
                          {isAdvanceMode && (
                            <div className="mt-2 pt-2 border-t border-[var(--neu-border)]/50">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Comments</span>
                                  <input
                                    type="text"
                                    value={rowRef.comments || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value, true)}
                                    className="w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-white/10 rounded text-[11px] font-sans text-black dark:text-white"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">ABL</span>
                                  <input
                                    type="number"
                                    value={rowRef.abl ?? ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'abl', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'abl', parseFloat(e.target.value) || 0, true)}
                                    className="w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-white/10 rounded text-right font-sans text-black dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    
                    {mainSortedRows.length === 0 && (
                      <div className="col-span-full py-12 text-center text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-[var(--neu-surface)] rounded-2xl border border-dashed border-[var(--neu-border)] font-sans">
                        No active billing records.
                      </div>
                    )}

                    {/* Compact Pagination for mobile cards */}
                    {totalMainPages > 1 && (
                      <div className="col-span-full flex items-center justify-between py-2 border-t border-slate-200/50 dark:border-white/10/50 mt-1 select-none flex-wrap gap-2">
                        <div className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                          Page {currentMainPage} of {totalMainPages} ({mainSortedRows.length} active total)
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={currentMainPage === 1}
                            onClick={() => {
                              setBillingPage(1);
                            }}
                            className="p-1 px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] rounded-lg bg-[var(--neu-surface)] cursor-pointer font-sans"
                          >
                            « First
                          </button>
                          <button
                            type="button"
                            disabled={currentMainPage === 1}
                            onClick={() => {
                              setBillingPage(prev => Math.max(prev - 1, 1));
                            }}
                            className="p-1 px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] rounded-lg bg-[var(--neu-surface)] cursor-pointer font-sans"
                          >
                            ◀ Prev
                          </button>
                          <button
                            type="button"
                            disabled={currentMainPage === totalMainPages}
                            onClick={() => {
                              setBillingPage(prev => Math.min(prev + 1, totalMainPages));
                            }}
                            className="p-1 px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] rounded-lg bg-[var(--neu-surface)] cursor-pointer font-sans"
                          >
                            Next ▶
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DC Users Toggle Button */}
                  <div className="flex justify-center mt-6 mb-2">
                    <button 
                      onClick={() => setShowDcList(!showDcList)}
                      className="w-full max-w-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/50 dark:hover:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 font-bold font-sans uppercase tracking-widest text-xs py-3 px-6 rounded-xl border border-neutral-200 dark:border-neutral-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      DC Users List ({dcRowsList.length})
                      <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        {showDcList ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </div>
                  
                  {showDcList && (
                    <div className="mb-6 border border-neutral-200/60 dark:border-white/10 rounded-xl bg-neutral-50/50 dark:bg-neutral-950/20 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                         <h3 className="font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-400 text-[11px] font-sans">Disconnected / Dead Clients</h3>
                      </div>
                      
                      {/* Desktop DC Table */}
                      <div className="hidden md:block overflow-x-auto relative">
                        <table className="w-full text-left table-fixed whitespace-nowrap">
                          {/* We don't have thead easily accessible, let's copy it from earlier */}
                          <thead className="bg-[var(--neu-surface)] shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)] border-b-2 border-slate-300 dark:border-slate-700">
                            <tr>
                              <th className="py-2 px-1 border-r border-[var(--neu-border)] text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[40px]">
                                Sr#
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[160px] min-w-[140px] max-w-[200px]">
                                Name
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[130px]">
                                User ID
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[110px]">
                                Phone
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[70px]">
                                Pkg/Mbps
                              </th>
                              <th className="py-2 px-1 border-r border-[var(--neu-border)]/80 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] min-w-[90px]">
                                Base
                              </th>
                              <th className="py-2 px-1 border-r border-[var(--neu-border)]/80 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-[100px] min-w-[90px]">
                                Arrears
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-[110px] min-w-[100px] bg-slate-100/50 dark:bg-slate-900/50">
                                Total
                              </th>
                              <th className="py-2 px-0 border-r border-[var(--neu-border)]/80 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[40px]">
                                BD
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)] text-right text-[10px] font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest w-[110px] min-w-[100px] bg-emerald-500/5 dark:bg-emerald-500/10">
                                Paid
                              </th>
                              <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[110px]">
                                Status
                              </th>
                              {isAdvanceMode && (
                                <>
                                  <th className="py-2 px-1.5 border-r border-[var(--neu-border)]/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[140px]">
                                    Comments
                                  </th>
                                  <th className="py-2 px-1.5 border-r border-slate-200/50 dark:border-white/10/50 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest w-[90px] bg-slate-100/30 dark:bg-slate-900/30">
                                    ABL
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody 
                            className={cn("divide-y divide-slate-200 dark:divide-slate-800 font-sans text-[13.5px] font-black text-slate-950 dark:text-zinc-50", !isBillingUnlocked && "[&_input:disabled]:pointer-events-none [&_select:disabled]:pointer-events-none [&_button:disabled]:pointer-events-none")}
                          >
                            {/* Insert desktop_map_str here with dcRowsList */}

{dcRowsList.map((rowRef, localIdx) => {
                              const globalRowIdx = rowRef._originalIndex;
                              if (globalRowIdx === undefined || globalRowIdx === -1) return null;
                              
                              const outstandingCr = parseFloat(rowRef.cr) || 0;
                              const isPaid = rowRef.paymentStatus === 'paid';
                              const isPartial = rowRef.paymentStatus === 'partial';
                              const isUnpaid = rowRef.paymentStatus === 'unpaid';
                              const isTdc = rowRef.paymentStatus === 'tdc';
                              const isDc = rowRef.paymentStatus === 'dc';
                              const isExtra = rowRef.paymentStatus === 'extra' || rowRef.name === 'Unspecified Entry';

                              return (
                                <tr
                                  key={`${rowRef.clientId || rowRef.username || 'row'}-${localIdx}`}
                                  className={cn(
                                    "hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap",
                                    !isBillingUnlocked && "cursor-pointer",
                                    isTdc && "bg-rose-500/5 text-rose-500",
                                    isDc && "bg-neutral-500/10 text-neutral-500"
                                  )}
                                  onClick={(e) => {
                                    if (!isBillingUnlocked) {
                                      setSelectedRecoveryRow(rowRef);
                                    }
                                  }}
                                >
                                  {/* Sr# */}
                                  <td className="py-1 px-1 border-r border-[var(--neu-border)] text-center select-none font-sans text-[11px] font-bold">
                                    <div className="flex items-center justify-center gap-1">
                                      <span>{globalRowIdx + 1}</span>
                                    </div>
                                  </td>
                                  <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-[13.5px] font-black">
                                    {renderCellProgress(globalRowIdx, 'name')}
                                    <input
                                      id={`rec_cell_${globalRowIdx}_name`}
                                      type="text"
                                      value={rowRef.name || ''}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value)}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'name', activeRows.length)}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value, true)}
                                      className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[13.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      placeholder="Enter full name"
                                    />
                                  </td>

                                  {/* User ID / Username */}
                                  <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-[13.5px] font-black text-black dark:text-white">
                                    {renderCellProgress(globalRowIdx, 'username')}
                                    <input
                                      id={`rec_cell_${globalRowIdx}_username`}
                                      type="text"
                                      value={rowRef.username || rowRef.clientId || ''}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value)}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'username', activeRows.length)}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value, true)}
                                      className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[13px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-bold hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100 tracking-wide"
                                    />
                                  </td>

                                  {/* Phone */}
                                  <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-center font-sans text-[13.5px] text-black dark:text-white font-black">
                                    {renderCellProgress(globalRowIdx, 'phone')}
                                    <input
                                      id={`rec_cell_${globalRowIdx}_phone`}
                                      type="text"
                                      value={rowRef.mobileNumber || rowRef.phone || rowRef.number || ''}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => {
                                        handleSaveRowField(globalRowIdx, 'phone', e.target.value);
                                        handleSaveRowField(globalRowIdx, 'mobileNumber', e.target.value);
                                      }}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'phone', activeRows.length)}
                                      onBlur={(e) => {
                                        handleSaveRowField(globalRowIdx, 'phone', e.target.value, true);
                                        handleSaveRowField(globalRowIdx, 'mobileNumber', e.target.value, true);
                                      }}
                                      className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-center text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                      placeholder="03XXXXXXXXX"
                                    />
                                  </td>

                                  {/* Package Mbps */}
                                  <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-center font-sans">
                                    {renderCellProgress(globalRowIdx, 'packageMbps')}
                                    <div className="flex items-center justify-center">
                                      <input
                                        id={`rec_cell_${globalRowIdx}_packageMbps`}
                                        type="number"
                                        value={rowRef.packageMbps ?? ''}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'packageMbps', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'packageMbps', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'packageMbps', parseFloat(e.target.value) || 0, true)}
                                        className="w-12 min-w-0 text-center bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-black dark:disabled:text-white disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="text-[10px] text-slate-500 font-bold ml-0.5">M</span>
                                    </div>
                                  </td>

                                  {/* Base Package */}
                                  <td className="relative py-1 px-1 border-r border-[var(--neu-border)]/80 text-right font-sans">
                                    {renderCellProgress(globalRowIdx, 'baseAmount')}
                                    <div className="flex items-center justify-end">
                                      <span className="text-black dark:text-zinc-200 mr-0.5 font-black text-[11px]">PKR</span>
                                      <input
                                        id={`rec_cell_${globalRowIdx}_baseAmount`}
                                        type="number"
                                        value={isDc ? 0 : (rowRef.baseAmount ?? '')}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'baseAmount', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', parseFloat(e.target.value) || 0, true)}
                                        className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100 text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </div>
                                  </td>

                                  {/* Cr. Arrears */}
                                  <td className="relative py-1 px-1 border-r border-[var(--neu-border)]/80 text-right font-sans">
                                    {renderCellProgress(globalRowIdx, 'cr')}
                                    <div className="flex items-center justify-end">
                                      <span className={cn("mr-0.5 font-black text-[11px]", outstandingCr > 0 ? "text-rose-750 dark:text-rose-450" : "text-black dark:text-zinc-200")}>PKR</span>
                                      <input
                                        id={`rec_cell_${globalRowIdx}_cr`}
                                        type="number"
                                        value={isDc ? 0 : (rowRef.cr ?? '')}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'cr', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'cr', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'cr', parseFloat(e.target.value) || 0, true)}
                                        className={cn(
                                          "w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                          outstandingCr > 0 ? "text-rose-750 dark:text-rose-450 font-black disabled:text-rose-750 dark:disabled:text-rose-450 disabled:opacity-100" : "text-black dark:text-white font-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                        )}
                                      />
                                    </div>
                                  </td>

                                  {/* Total Amount */}
                                  <td className="py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-right text-black dark:text-white bg-slate-100/50 dark:bg-slate-900/50 select-none font-black text-[13.5px] font-sans">
                                    PKR {isDc ? 0 : (isTdc ? (rowRef.cr || 0) : (rowRef.totalAmount || 0)).toLocaleString()}
                                  </td>

                                  {/* BD (Billing Day) */}
                                  <td className="relative py-1 px-0 border-r border-[var(--neu-border)]/80 text-center select-all font-sans  ">
                                    {renderCellProgress(globalRowIdx, 'billingDay')}
                                    <input
                                      id={`rec_cell_${globalRowIdx}_billingDay`}
                                      type="text"
                                      maxLength={2}
                                      value={rowRef.billingDay || ''}
                                      disabled={false}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'billingDay', e.target.value.slice(0, 2))}
                                      onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'billingDay', activeRows.length)}
                                      onBlur={(e) => handleSaveRowField(globalRowIdx, 'billingDay', e.target.value.slice(0, 2), true)}
                                      className="w-full min-w-0 flex-1 text-center bg-transparent px-0 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[12px] disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                    />
                                  </td>

                                  {/* Monthly Paid Recovery */}
                                  <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)] bg-emerald-500/5 dark:bg-emerald-500/15 text-right text-emerald-950 dark:text-emerald-100 font-sans">
                                    {renderCellProgress(globalRowIdx, 'paymentReceived')}
                                    <div className="flex items-center justify-end">
                                      <span className="text-emerald-900 dark:text-emerald-400 mr-0.5 font-black text-[11px]">PKR</span>
                                      <input
                                        id={`rec_cell_${globalRowIdx}_paymentReceived`}
                                        type="number"
                                        value={isDc ? 0 : (rowRef.paymentReceived ?? '')}
                                        disabled={!isBillingUnlocked}
                                        onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'paymentReceived', activeRows.length)}
                                        onBlur={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', parseFloat(e.target.value) || 0, true)}
                                        className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans font-black text-emerald-950 dark:text-emerald-100 hover:bg-white/20 dark:hover:bg-black/15 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-emerald-950 dark:disabled:text-emerald-100 disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 text-center font-sans">
                                    {renderCellProgress(globalRowIdx, 'paymentStatus')}
                                    <select
                                      id={`rec_cell_${globalRowIdx}_paymentStatus`}
                                      value={rowRef.paymentStatus}
                                      disabled={!isBillingUnlocked}
                                      onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentStatus', e.target.value, true)}
                                      className={cn(
                                        "px-2 py-0.5 text-[12px] font-black uppercase text-center rounded-lg border focus:ring-1 focus:ring-blue-500/30 w-full min-w-0 bg-[var(--neu-surface)] disabled:opacity-100  font-sans",
                                        isPaid && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200 dark:border-emerald-900/30 font-black",
                                        isPartial && "bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-200 dark:border-amber-900/30 font-black",
                                        isUnpaid && "bg-slate-200 dark:bg-slate-800 text-black dark:text-white border-slate-400 dark:border-slate-600 font-black",
                                        isTdc && "bg-rose-100 dark:bg-rose-950/50 text-rose-700 border-rose-200 dark:border-rose-900/50 font-black",
                                        isDc && "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 font-black",
                                        isExtra && "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200 dark:border-purple-900/30 font-black"
                                      )}
                                    >
                                      <option value="unpaid">UNPAID</option>
                                      <option value="paid">PAID</option>
                                      <option value="partial">PARTIAL</option>
                                      <option value="tdc">TDC</option>
                                      <option value="dc">DC</option>
                                      <option value="extra">EXTRA</option>
                                    </select>
                                  </td>
                                  
                                  {/* Comments & other advance columns */}
                                  {isAdvanceMode && (
                                    <>
                                      {/* Comments */}
                                      <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans">
                                        {renderCellProgress(globalRowIdx, 'comments')}
                                        <input
                                          id={`rec_cell_${globalRowIdx}_comments`}
                                          type="text"
                                          value={rowRef.comments || ''}
                                          disabled={!isBillingUnlocked}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value)}
                                          onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'comments', activeRows.length)}
                                          onBlur={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value, true)}
                                          className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                        />
                                      </td>
                                      {/* Occupation */}
                                      <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans">
                                        {renderCellProgress(globalRowIdx, 'occ')}
                                        <input
                                          id={`rec_cell_${globalRowIdx}_occ`}
                                          type="text"
                                          value={rowRef.occ || rowRef.occupation || ''}
                                          disabled={!isBillingUnlocked}
                                          onChange={(e) => handleSaveRowField(globalRowIdx, 'occ', e.target.value)}
                                          onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'occ', activeRows.length)}
                                          onBlur={(e) => handleSaveRowField(globalRowIdx, 'occ', e.target.value, true)}
                                          className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                        />
                                      </td>
                                      {/* PKG Details */}
                                      <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans">
                                        {renderCellProgress(globalRowIdx, 'pkgDetails')}
                                        <input
                                          id={`rec_cell_${globalRowIdx}_pkgDetails`}
                                          type="text"
                                          value={rowRef.pkgDetails || ''}
                                          disabled={!isBillingUnlocked}
                                          onChange={(e) => handleSaveRowField(globalRowIdx, 'pkgDetails', e.target.value)}
                                          onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'pkgDetails', activeRows.length)}
                                          onBlur={(e) => handleSaveRowField(globalRowIdx, 'pkgDetails', e.target.value, true)}
                                          className="w-full min-w-0 bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                        />
                                      </td>
                                      {/* Date */}
                                      <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-center">
                                        {renderCellProgress(globalRowIdx, 'connectionDate')}
                                        <input
                                          id={`rec_cell_${globalRowIdx}_connectionDate`}
                                          type="text"
                                          value={rowRef.connectionDate || ''}
                                          disabled={!isBillingUnlocked}
                                          onChange={(e) => handleSaveRowField(globalRowIdx, 'connectionDate', e.target.value)}
                                          onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'connectionDate', activeRows.length)}
                                          onBlur={(e) => handleSaveRowField(globalRowIdx, 'connectionDate', e.target.value, true)}
                                          className="w-full min-w-0 text-center bg-transparent px-1 py-0.5 border-none rounded text-[12.5px] focus:ring-1 focus:ring-blue-500/30 text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black disabled:text-black dark:disabled:text-white disabled:opacity-100"
                                        />
                                      </td>
                                      {/* Device Price */}
                                      <td className="relative py-1 px-1.5 border-r border-[var(--neu-border)]/80 font-sans text-right">
                                        {renderCellProgress(globalRowIdx, 'devicePrice')}
                                        <div className="flex items-center justify-end">
                                          <span className="text-slate-400 mr-0.5 font-black text-[11px]">PKR</span>
                                          <input
                                            id={`rec_cell_${globalRowIdx}_devicePrice`}
                                            type="number"
                                            value={rowRef.devicePrice ?? ''}
                                            disabled={!isBillingUnlocked}
                                            onChange={(e) => handleSaveRowField(globalRowIdx, 'devicePrice', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'devicePrice', activeRows.length)}
                                            onBlur={(e) => handleSaveRowField(globalRowIdx, 'devicePrice', parseFloat(e.target.value) || 0, true)}
                                            className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-black dark:disabled:text-white disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          />
                                        </div>
                                      </td>
                                      {/* ABL */}
                                      <td className="py-1 px-1.5 border-r border-slate-200/50 dark:border-white/10/50 bg-slate-100/30 dark:bg-slate-900/30 text-right font-sans">
                                        {renderCellProgress(globalRowIdx, 'abl')}
                                        <div className="flex items-center justify-end">
                                          <span className="text-slate-400 mr-0.5 font-black text-[11px]">PKR</span>
                                          <input
                                            id={`rec_cell_${globalRowIdx}_abl`}
                                            type="number"
                                            value={rowRef.abl ?? ''}
                                            disabled={!isBillingUnlocked}
                                            onChange={(e) => handleSaveRowField(globalRowIdx, 'abl', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'abl', activeRows.length)}
                                            onBlur={(e) => handleSaveRowField(globalRowIdx, 'abl', parseFloat(e.target.value) || 0, true)}
                                            className="w-full min-w-0 flex-1 text-right bg-transparent px-1 py-0.5 border-none rounded focus:ring-1 focus:ring-blue-500/30 font-sans text-black dark:text-white font-black hover:bg-white/40 dark:hover:bg-black/10 focus:bg-white dark:focus:bg-black text-[13px] disabled:text-black dark:disabled:text-white disabled:opacity-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          />
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile DC Grid */}
                      <div className="p-4 md:hidden bg-slate-50/50 dark:bg-slate-950/20">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Compact ultra-premium responsive Mobile Frames view for Android/mobile screens */}
                  
                    {dcRowsList.map((rowRef, localIdx) => {
                      const globalRowIdx = rowRef._originalIndex;
                      if (globalRowIdx === undefined || globalRowIdx === -1) return null;
                      
                      const outstandingCr = parseFloat(rowRef.cr) || 0;
                      const isPaid = rowRef.paymentStatus === 'paid';
                      const isPartial = rowRef.paymentStatus === 'partial';
                      const isUnpaid = rowRef.paymentStatus === 'unpaid';
                      const isTdc = rowRef.paymentStatus === 'tdc';
                      const isDc = rowRef.paymentStatus === 'dc';
                      const isExtra = rowRef.paymentStatus === 'extra' || rowRef.name === 'Unspecified Entry';

                      return (
                        <motion.div 
                          key={`mobile-billing-frame-${rowRef.clientId || rowRef.username || 'idx'}-${localIdx}`}
                          initial={false}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          whileHover={{ scale: 1.01 }}
                          transition={{ duration: 0.15 }}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '200px' }}
                          onClick={(e) => {
                            if (!isBillingUnlocked) {
                              setSelectedRecoveryRow(rowRef);
                            }
                          }}
                          className={cn(
                            "p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-[var(--neu-shadow-raised-sm)]",
                            !isBillingUnlocked && "cursor-pointer [&_input:disabled]:pointer-events-none [&_select:disabled]:pointer-events-none [&_button:disabled]:pointer-events-none",
                            isTdc 
                              ? "bg-rose-500/5 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-450" 
                              : isDc
                              ? "bg-neutral-500/5 dark:bg-neutral-900/40 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                              : isPaid 
                              ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-100" 
                              : isPartial 
                              ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-100" 
                              : "bg-[var(--neu-surface)]/95 border-[var(--neu-border)] text-slate-800 dark:text-slate-100"
                          )}
                        >
                          {/* Top bar */}
                          <div className="flex items-start justify-between gap-2 border-b border-dotted border-[var(--neu-border)] pb-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[9px] bg-[var(--neu-surface)] shadow-[var(--neu-shadow-inset)] text-slate-700 dark:text-slate-300 font-black px-1.5 py-0.5 rounded shrink-0">
                                #{globalRowIdx + 1}
                              </span>
                              {isBillingUnlocked && (
                                <div className="flex items-center gap-1">
                                  <WhatsAppSendButton
                                    name={rowRef.name || ""}
                                    mobileNumber={rowRef.mobileNumber || rowRef.phone || rowRef.number || ""}
                                    totalAmount={rowRef.totalAmount}
                                    baseAmount={rowRef.baseAmount}
                                    paymentStatus={rowRef.paymentStatus || "unpaid"}
                                    username={rowRef.username || rowRef.clientId || ""}
                                    area={rowRef.area || ""}
                                  />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerDeleteBillingRow(globalRowIdx);
                                  }}
                                  className="p-1 rounded text-rose-600 dark:text-rose-450 hover:bg-rose-100 dark:hover:bg-rose-950/40 shrink-0 cursor-pointer"
                                  title="Delete Row"
                                >
                                  <Trash2 size={13} />
                                </button>
                                </div>
                              )}
                              <div className="min-w-0">
                                <input
                                  type="text"
                                  value={rowRef.name || ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value)}
                                  onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'name', activeRows.length)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'name', e.target.value, true)}
                                  className="w-full bg-transparent border-none p-0 text-[12.5px] font-black focus:ring-0 text-black dark:text-white"
                                  placeholder="Full Name"
                                />
                                <input
                                  type="text"
                                  value={rowRef.username || rowRef.clientId || ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value)}
                                  onKeyDown={(e) => handleRecoveryCellKeyDown(e, globalRowIdx, 'username', activeRows.length)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'username', e.target.value, true)}
                                  className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-slate-500 focus:ring-0 uppercase tracking-wide"
                                  placeholder="USER ID"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <select
                                value={rowRef.paymentStatus}
                                disabled={!isBillingUnlocked}
                                onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentStatus', e.target.value, true)}
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-black uppercase text-center rounded border focus:ring-0  font-sans",
                                  isPaid && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200 dark:border-emerald-900/30",
                                  isPartial && "bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-200 dark:border-amber-900/30",
                                  isUnpaid && "bg-slate-200 dark:bg-slate-800 text-black dark:text-white border-slate-400 dark:border-slate-600",
                                  isTdc && "bg-rose-100 dark:bg-rose-950/50 text-rose-700 border-rose-200 dark:border-rose-900/50",
                                  isDc && "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700",
                                  isExtra && "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200 dark:border-purple-900/30"
                                )}
                              >
                                <option value="unpaid">UNPAID</option>
                                <option value="paid">PAID</option>
                                <option value="partial">PARTIAL</option>
                                <option value="tdc">TDC</option>
                                <option value="dc">DC</option>
                                <option value="extra">EXTRA</option>
                              </select>
                              <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                <Phone size={8} /> {rowRef.mobileNumber || rowRef.phone || rowRef.number || 'NO PHONE'}
                              </div>
                            </div>
                          </div>

                          {/* Amounts */}
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-[var(--neu-surface)] border border-[var(--neu-border)] p-2 rounded-xl flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Dues</span>
                              <div className="flex items-center text-[13px] font-black text-black dark:text-white">
                                <span className="text-[9px] mr-1 opacity-60">PKR</span>
                                {(isTdc ? outstandingCr : (rowRef.totalAmount || 0)).toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl flex flex-col justify-center relative overflow-hidden">
                              <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Paid</span>
                              <div className="flex items-center text-[14px] font-black text-emerald-900 dark:text-emerald-300">
                                <span className="text-[9px] mr-1 opacity-60">PKR</span>
                                <input
                                  type="number"
                                  value={rowRef.paymentReceived ?? ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'paymentReceived', parseFloat(e.target.value) || 0, true)}
                                  className="w-full bg-transparent border-none p-0 text-[14px] font-black text-emerald-900 dark:text-emerald-300 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Arrears and Package */}
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arrears</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={rowRef.cr ?? ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'cr', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'cr', parseFloat(e.target.value) || 0, true)}
                                  className={cn(
                                    "w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-[var(--neu-border)] rounded text-left font-sans text-black dark:text-white text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    outstandingCr > 0 && "text-rose-600 dark:text-rose-450 font-black border-rose-200 dark:border-rose-900/40"
                                  )}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Pkg</span>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  value={rowRef.baseAmount ?? ''}
                                  disabled={!isBillingUnlocked}
                                  onChange={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                  onBlur={(e) => handleSaveRowField(globalRowIdx, 'baseAmount', parseFloat(e.target.value) || 0, true)}
                                  className="w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-[var(--neu-border)] rounded text-right font-sans text-black dark:text-white text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Extra advanced fields toggleable */}
                          {isAdvanceMode && (
                            <div className="mt-2 pt-2 border-t border-[var(--neu-border)]/50">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Comments</span>
                                  <input
                                    type="text"
                                    value={rowRef.comments || ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'comments', e.target.value, true)}
                                    className="w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-white/10 rounded text-[11px] font-sans text-black dark:text-white"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">ABL</span>
                                  <input
                                    type="number"
                                    value={rowRef.abl ?? ''}
                                    disabled={!isBillingUnlocked}
                                    onChange={(e) => handleSaveRowField(globalRowIdx, 'abl', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                    onBlur={(e) => handleSaveRowField(globalRowIdx, 'abl', parseFloat(e.target.value) || 0, true)}
                                    className="w-full bg-slate-100/30 dark:bg-slate-950 px-2 py-0.5 border border-slate-200/50 dark:border-white/10 rounded text-right font-sans text-black dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    
                    {mainSortedRows.length === 0 && (
                      <div className="col-span-full py-12 text-center text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-[var(--neu-surface)] rounded-2xl border border-dashed border-[var(--neu-border)] font-sans">
                        No active billing records.
                      </div>
                    )}

                    {/* Compact Pagination for mobile cards */}
                    {totalMainPages > 1 && (
                      <div className="col-span-full flex items-center justify-between py-2 border-t border-slate-200/50 dark:border-white/10/50 mt-1 select-none flex-wrap gap-2">
                        <div className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                          Page {currentMainPage} of {totalMainPages} ({mainSortedRows.length} active total)
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={currentMainPage === 1}
                            onClick={() => {
                              setBillingPage(1);
                            }}
                            className="p-1 px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] rounded-lg bg-[var(--neu-surface)] cursor-pointer font-sans"
                          >
                            « First
                          </button>
                          <button
                            type="button"
                            disabled={currentMainPage === 1}
                            onClick={() => {
                              setBillingPage(prev => Math.max(prev - 1, 1));
                            }}
                            className="p-1 px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] rounded-lg bg-[var(--neu-surface)] cursor-pointer font-sans"
                          >
                            ◀ Prev
                          </button>
                          <button
                            type="button"
                            disabled={currentMainPage === totalMainPages}
                            onClick={() => {
                              setBillingPage(prev => Math.min(prev + 1, totalMainPages));
                            }}
                            className="p-1 px-2.5 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-blue-500 disabled:opacity-40  border border-[var(--neu-border)] rounded-lg bg-[var(--neu-surface)] cursor-pointer font-sans"
                          >
                            Next ▶
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
</div></div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-[var(--neu-border)]">
                    <div>
                      Month: <span className="text-slate-700 dark:text-slate-300 font-sans">{currentMonthId}</span> | 
                      Master clients in pool: <span className="text-slate-700 dark:text-slate-300 font-sans">{masterClients.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Auto-saving local edits
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-500 font-bold uppercase text-sm border border-dashed border-slate-300 rounded-xl">
                Please select or configure a billing month.
              </div>
            )}
            </div>


  );
}

