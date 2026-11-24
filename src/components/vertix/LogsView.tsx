import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Download,
  ShieldCheck,
  CreditCard,
  UserCheck,
  Lock,
  Clock,
  Layers,
  AlertCircle
} from 'lucide-react';
import { LogEntry } from './radiusStore';
import { VertixLandscapeCard, ConfirmDeleteModal } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface LogsViewProps {
  store: any;
  isDarkMode: boolean;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type LogCategoryTab = 'All' | 'Authentication' | 'Accounting' | 'Admin';

export default function LogsView({ store, isDarkMode, addToast }: LogsViewProps) {
  const [activeTab, setActiveTab] = useState<LogCategoryTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7d'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedTime, setLastRefreshedTime] = useState(new Date().toLocaleTimeString());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Auto-refresh interval (5s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setLastRefreshedTime(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Derive log category
  const getLogCategory = (action: string): 'Authentication' | 'Accounting' | 'Admin' => {
    const act = action.toLowerCase();
    if (
      act.includes('auth') ||
      act.includes('session') ||
      act.includes('connect') ||
      act.includes('login') ||
      act.includes('pod') ||
      act.includes('coa')
    ) {
      return 'Authentication';
    }
    if (
      act.includes('payment') ||
      act.includes('renew') ||
      act.includes('voucher') ||
      act.includes('top-up') ||
      act.includes('balance') ||
      act.includes('invoiced')
    ) {
      return 'Accounting';
    }
    return 'Admin';
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return (store.logs as LogEntry[]).filter(log => {
      // Category Tab
      if (activeTab !== 'All') {
        const cat = getLogCategory(log.action);
        if (cat !== activeTab) return false;
      }

      // Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          log.action.toLowerCase().includes(q) ||
          log.target.toLowerCase().includes(q) ||
          log.actor.toLowerCase().includes(q) ||
          log.time.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [store.logs, activeTab, searchQuery, timeFilter, lastRefreshedTime]);

  // Derived counts for KPI cards
  const categoryCounts = useMemo(() => {
    let auth = 0;
    let acct = 0;
    let admin = 0;
    for (const l of store.logs as LogEntry[]) {
      const cat = getLogCategory(l.action);
      if (cat === 'Authentication') auth++;
      else if (cat === 'Accounting') acct++;
      else admin++;
    }
    return {
      total: store.logs.length,
      auth,
      acct,
      admin,
    };
  }, [store.logs]);

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['ID', 'Time', 'Actor', 'Category', 'Action', 'Target'],
      ...filteredLogs.map(l => [
        l.id,
        l.time,
        l.actor,
        getLogCategory(l.action),
        l.action,
        `"${l.target.replace(/"/g, '""')}"`,
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vertix_radius_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Audit logs exported to CSV', 'success');
  };

  // Clear Logs
  const handleClearLogs = () => {
    store.clearLogs();
    addToast('All audit and security logs cleared', 'info');
    setShowClearConfirm(false);
  };

  if (store.isLoading && store.logs.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <VertixLandscapeCard
          title="Total Audit Events"
          value={categoryCounts.total}
          badge="Live Journal"
          badgeColor="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-400 dark:border-slate-700"
          icon={ScrollText}
          iconBgGradient="bg-gradient-to-br from-indigo-500 to-slate-800"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="RADIUS Auth Logs"
          value={categoryCounts.auth}
          badge="Access-Request"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Lock}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Accounting Records"
          value={categoryCounts.acct}
          badge="Ledger Events"
          badgeColor="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={CreditCard}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-violet-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Admin Operations"
          value={categoryCounts.admin}
          badge="Management"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={ShieldCheck}
          iconBgGradient="bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* LOGS TABLE WORKSPACE */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Controls Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#2d3648]">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>RADIUS Security & System Audit Trail</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Real-time capture of PPP authentications, disconnects, manager float, and server operations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Auto-Refresh Status & Toggle */}
            <button
              onClick={() => {
                setAutoRefresh(!autoRefresh);
                addToast(autoRefresh ? 'Auto-refresh paused' : 'Auto-refresh active (5s interval)', 'info');
              }}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                autoRefresh
                  ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                  : isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] text-slate-200'
                  : 'bg-slate-100 border-slate-300 text-slate-800'
              }`}
              title="Toggle 5-second polling"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span>{autoRefresh ? 'Live (5s)' : 'Paused'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] hover:bg-[#1c2330] text-slate-100'
                  : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-900 shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Clear Logs */}
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Category Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 mb-3">
          {/* 4 Category Tabs */}
          <div
            className={`flex items-center p-1 rounded-full border shadow-xs overflow-x-auto no-scrollbar vertix-scroll-x max-w-full ${
              isDarkMode ? 'bg-[#10141b] border-[#333d52]' : 'bg-slate-100 border-slate-300'
            }`}
          >
            {(['All', 'Authentication', 'Accounting', 'Admin'] as const).map(tab => {
              const count =
                tab === 'All'
                  ? categoryCounts.total
                  : tab === 'Authentication'
                  ? categoryCounts.auth
                  : tab === 'Accounting'
                  ? categoryCounts.acct
                  : categoryCounts.admin;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab
                      ? isDarkMode
                        ? 'bg-white text-black shadow-xs'
                        : 'bg-slate-950 text-white shadow-xs'
                      : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      activeTab === tab
                        ? isDarkMode
                          ? 'bg-slate-200 text-black'
                          : 'bg-slate-800 text-white'
                        : 'bg-slate-200 dark:bg-[#1c2330] text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actions, targets, actors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`text-xs pl-8 pr-3 py-1.5 rounded-full border outline-none transition-all w-full sm:w-60 font-medium ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400 focus:border-emerald-500'
                  : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500 focus:border-emerald-500'
              }`}
            />
          </div>
        </div>

        {/* LOGS TABLE CONTAINER */}
        <div className="overflow-x-auto no-scrollbar vertix-scroll-xy w-full border border-slate-300 dark:border-[#2d3648] rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b text-[10px] font-extrabold uppercase ${
                  isDarkMode ? 'bg-[#10141b] border-[#2d3648] text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
                }`}
              >
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Action Event</th>
                <th className="py-2.5 px-3">Target Details</th>
                <th className="py-2.5 px-3 text-right">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648] font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-700 dark:text-slate-300">
                    <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-sm">No audit logs found</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Try altering search keywords or category filters</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const cat = getLogCategory(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-emerald-50/50 dark:hover:bg-[#1c2330] transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{log.time}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${
                            cat === 'Authentication'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                              : cat === 'Accounting'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                              : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                          }`}
                        >
                          {cat}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-extrabold text-slate-950 dark:text-white">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 font-mono text-[11px] max-w-md truncate">
                        {log.target}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-200 dark:bg-[#10141b] border border-slate-300 dark:border-[#333d52] text-slate-900 dark:text-slate-100">
                          {log.actor}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRM CLEAR LOGS MODAL */}
      <ConfirmDeleteModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearLogs}
        title="Clear Security & Audit Logs"
        message="Are you sure you want to purge all audit log records? This action cannot be reversed."
        subMessage="Audit records will be cleared immediately from system storage."
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
