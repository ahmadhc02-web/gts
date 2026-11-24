import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  TrendingUp,
  Users,
  RotateCcw,
  UserX,
  Download,
  Printer,
  Calendar,
  Layers,
  HardDrive,
  Award,
  Sparkles
} from 'lucide-react';
import { RadiusUser, Payment } from './radiusStore';
import { VertixLandscapeCard } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface ReportsViewProps {
  store: any;
  isDarkMode: boolean;
  currencySymbol: string;
  currencyRate: number;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type DateRange = '7d' | '30d' | 'month' | 'all';

export default function ReportsView({
  store,
  isDarkMode,
  currencySymbol,
  currencyRate,
  addToast,
}: ReportsViewProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let cutoff = new Date(today);
    if (dateRange === '7d') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (dateRange === '30d') {
      cutoff.setDate(cutoff.getDate() - 30);
    } else if (dateRange === 'month') {
      cutoff = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      // all
      return store.payments as Payment[];
    }
    cutoff.setHours(0, 0, 0, 0);

    return (store.payments as Payment[]).filter(p => {
      const pDate = new Date(p.date);
      return !isNaN(pDate.getTime()) && pDate >= cutoff && pDate <= today;
    });
  }, [store.payments, dateRange]);

  // KPI calculations
  const totalRevenuePKR = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [filteredPayments]);

  const convertedRevenue = useMemo(() => {
    const converted = (currencySymbol.includes('Rs') || currencyRate === 1) ? totalRevenuePKR : (totalRevenuePKR / 280) * currencyRate;
    return `${currencySymbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }, [totalRevenuePKR, currencyRate, currencySymbol]);

  const renewalCount = useMemo(() => {
    return filteredPayments.filter(p => p.type === 'Renewal' || p.type === 'Voucher').length;
  }, [filteredPayments]);

  const activeSubscribersCount = useMemo(() => {
    return store.users.filter((u: RadiusUser) => u.status === 'Active').length;
  }, [store.users]);

  const churnCount = useMemo(() => {
    return store.users.filter((u: RadiusUser) => u.status === 'Expired').length;
  }, [store.users]);

  // Revenue per day breakdown (last 7 / 14 / 30 days)
  const dailyRevenueData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === 'month' ? 14 : dateRange === '30d' ? 14 : 10;
    const result: Array<{ dateStr: string; label: string; amount: number }> = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const sum = filteredPayments
        .filter(p => p.date === iso)
        .reduce((acc, p) => acc + (p.amount || 0), 0);
      result.push({ dateStr: iso, label, amount: sum });
    }
    return result;
  }, [filteredPayments, dateRange]);

  const maxDailyRevenue = useMemo(() => {
    const max = Math.max(...dailyRevenueData.map(d => d.amount), 1000);
    return max;
  }, [dailyRevenueData]);

  // Users by Status (for Donut Chart)
  const statusCounts = useMemo(() => {
    const total = Math.max(store.users.length, 1);
    const active = store.users.filter((u: RadiusUser) => u.status === 'Active' && !u.online).length;
    const online = store.users.filter((u: RadiusUser) => u.online).length;
    const expired = store.users.filter((u: RadiusUser) => u.status === 'Expired').length;
    const disabled = store.users.filter((u: RadiusUser) => u.status === 'Disabled').length;
    return {
      total: store.users.length,
      active,
      online,
      expired,
      disabled,
      pctOnline: Math.round((online / total) * 100),
      pctActive: Math.round((active / total) * 100),
      pctExpired: Math.round((expired / total) * 100),
      pctDisabled: Math.round((disabled / total) * 100),
    };
  }, [store.users]);

  // Revenue by Package breakdown
  const packageRevenue = useMemo(() => {
    const map: Record<string, { count: number; totalPKR: number }> = {};
    for (const pkg of store.packages) {
      map[pkg.name] = { count: 0, totalPKR: 0 };
    }
    for (const p of filteredPayments) {
      const pkgName = p.packageName || 'Standard 10M';
      if (!map[pkgName]) map[pkgName] = { count: 0, totalPKR: 0 };
      map[pkgName].count += 1;
      map[pkgName].totalPKR += p.amount || 0;
    }
    const list = Object.entries(map).map(([name, val]) => ({
      name,
      count: val.count,
      totalPKR: val.totalPKR,
    }));
    list.sort((a, b) => b.totalPKR - a.totalPKR);
    const highest = Math.max(...list.map(l => l.totalPKR), 1);
    return { list, highest };
  }, [store.packages, filteredPayments]);

  // Top 10 data users
  const top10Users = useMemo(() => {
    const copy = [...(store.users as RadiusUser[])];
    copy.sort((a, b) => (b.dataUsedGB || 0) - (a.dataUsedGB || 0));
    return copy.slice(0, 10);
  }, [store.users]);

  const maxDataGB = useMemo(() => {
    return Math.max(...top10Users.map(u => u.dataUsedGB || 0), 100);
  }, [top10Users]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value', 'Range'],
      ['Total Period Revenue PKR', totalRevenuePKR.toString(), dateRange],
      ['Total Payments Recorded', filteredPayments.length.toString(), dateRange],
      ['Subscribers Total', store.users.length.toString(), 'All'],
      ['Active Subscribers', activeSubscribersCount.toString(), 'All'],
      ['Expired Accounts', churnCount.toString(), 'All'],
      ['Aggregated Traffic (GB)', store.stats.totalDataGB.toString(), 'All'],
      [],
      ['Top 10 Bandwidth Consumers'],
      ['Rank', 'Username', 'Name', 'Package', 'Status', 'Data (GB)'],
      ...top10Users.map((u, i) => [
        (i + 1).toString(),
        u.username,
        u.name,
        u.package,
        u.status,
        (u.dataUsedGB || 0).toString(),
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vertix_radius_report_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Report CSV exported successfully', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  if (store.isLoading && store.users.length === 0 && store.payments.length === 0) {
    return <SkVertixSubView mode="charts" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <VertixLandscapeCard
          title="Period Collection"
          value={convertedRevenue}
          badge={`Rs. ${totalRevenuePKR.toLocaleString()}`}
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={TrendingUp}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Active Subscribers"
          value={activeSubscribersCount}
          badge={`${statusCounts.pctActive + statusCounts.pctOnline}% of base`}
          badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={Users}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Renewals In Range"
          value={renewalCount}
          badge="Invoiced"
          badgeColor="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={RotateCcw}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-violet-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Expired / Churned"
          value={churnCount}
          badge="Needs Action"
          badgeColor="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800"
          icon={UserX}
          iconBgGradient="bg-gradient-to-br from-rose-500 to-red-600"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* MAIN REPORT WORKSPACE CONTAINER */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        {/* Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#2d3648]">
          <div>
            <h3 className="text-base sm:text-lg font-black text-black dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>RADIUS Traffic, Revenue & Bandwidth Analytics</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Real-time PPPoE consumption metrics and subscriber revenue reconciliation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Date Range Selector */}
            <div
              className={`flex items-center p-1 rounded-full border shadow-xs ${
                isDarkMode ? 'bg-[#10141b] border-[#333d52]' : 'bg-slate-100 border-slate-300'
              }`}
            >
              {(
                [
                  { id: '7d', label: '7 Days' },
                  { id: '30d', label: '30 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map(range => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    dateRange === range.id
                      ? isDarkMode
                        ? 'bg-white text-black shadow-xs'
                        : 'bg-slate-950 text-white shadow-xs'
                      : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] hover:bg-[#1c2330] text-slate-100'
                  : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-900 shadow-xs'
              }`}
              title="Export Report CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                isDarkMode
                  ? 'bg-[#10141b] border-[#333d52] hover:bg-[#1c2330] text-slate-100'
                  : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-900 shadow-xs'
              }`}
              title="Print Clean Layout"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 2-COLUMN CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-5">
          {/* CHART 1: REVENUE PER DAY (Bar Chart with div bars) */}
          <div
            className={`lg:col-span-7 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black text-black dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>Revenue Collection Trend</span>
                </h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  Daily billings and renewals recorded in the radius ledger
                </p>
              </div>
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-700">
                Max: Rs. {maxDailyRevenue.toLocaleString()}
              </span>
            </div>

            {/* Plain Div Bar Chart */}
            <div className="h-44 sm:h-48 w-full flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2 border-b border-slate-300 dark:border-[#333d52]">
              {dailyRevenueData.map((bar, idx) => {
                const heightPct = Math.max(8, Math.round((bar.amount / maxDailyRevenue) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20 border border-slate-700">
                      Rs. {bar.amount.toLocaleString()} ({bar.label})
                    </div>
                    {/* Bar */}
                    <div className="w-full max-w-[28px] bg-slate-200 dark:bg-[#1c2330] rounded-t-md overflow-hidden flex flex-col justify-end h-full">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.14, delay: idx * 0.008 }}
                        className={`w-full rounded-t-md ${
                          bar.amount > 0
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                            : 'bg-slate-300 dark:bg-[#2d3648]'
                        }`}
                      />
                    </div>
                    {/* Label */}
                    <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">
                      {bar.label.split(' ')[1] || bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 mt-2 font-medium">
              <span>{dailyRevenueData[0]?.label || ''}</span>
              <span className="font-bold text-slate-950 dark:text-white">Daily Cash & Digital Flow</span>
              <span>Today</span>
            </div>
          </div>

          {/* CHART 2: USERS BY STATUS (SVG Donut Chart) */}
          <div
            className={`lg:col-span-5 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <h4 className="text-sm font-black text-black dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Subscriber Health Breakdown</span>
              </h4>
              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                Distribution across Online, Active, Expired, and Suspended
              </p>
            </div>

            {/* SVG Donut */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 my-3">
              <div className="relative w-32 h-32 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle cx="50" cy="50" r="38" strokeWidth="12" fill="none" stroke="currentColor" className="text-slate-200 dark:text-[#2d3648]" />
                  {/* Online Segment (Emerald) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    strokeWidth="12"
                    fill="none"
                    stroke="#10b981"
                    strokeDasharray={`${(statusCounts.online / Math.max(1, statusCounts.total)) * 238.76} 238.76`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  {/* Active Segment (Blue) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    strokeWidth="12"
                    fill="none"
                    stroke="#3b82f6"
                    strokeDasharray={`${(statusCounts.active / Math.max(1, statusCounts.total)) * 238.76} 238.76`}
                    strokeDashoffset={`-${(statusCounts.online / Math.max(1, statusCounts.total)) * 238.76}`}
                    strokeLinecap="round"
                  />
                  {/* Expired Segment (Rose) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    strokeWidth="12"
                    fill="none"
                    stroke="#f43f5e"
                    strokeDasharray={`${(statusCounts.expired / Math.max(1, statusCounts.total)) * 238.76} 238.76`}
                    strokeDashoffset={`-${((statusCounts.online + statusCounts.active) / Math.max(1, statusCounts.total)) * 238.76}`}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Donut Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-black dark:text-white leading-none">
                    {statusCounts.total}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-700 dark:text-slate-300 mt-0.5">Users</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex flex-col gap-2 text-xs font-semibold w-full sm:w-auto">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    Online Sessions
                  </span>
                  <span className="font-extrabold text-slate-950 dark:text-white">{statusCounts.online} ({statusCounts.pctOnline}%)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    Active (Offline)
                  </span>
                  <span className="font-extrabold text-slate-950 dark:text-white">{statusCounts.active} ({statusCounts.pctActive}%)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    Expired Accounts
                  </span>
                  <span className="font-extrabold text-slate-950 dark:text-white">{statusCounts.expired} ({statusCounts.pctExpired}%)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                    Disabled
                  </span>
                  <span className="font-extrabold text-slate-950 dark:text-white">{statusCounts.disabled} ({statusCounts.pctDisabled}%)</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium text-center">
              Target churn rate &lt; 5% per billing cycle
            </div>
          </div>
        </div>
        {/* 2-COLUMN LOWER SECTION: REVENUE BY PACKAGE & TOP 10 USERS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-5">
          {/* PACKAGE REVENUE (Horizontal bars) */}
          <div
            className={`lg:col-span-5 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div>
              <h4 className="text-sm font-black text-black dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-500" />
                <span>Revenue by Package Tier</span>
              </h4>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 mb-3">
                Financial contribution per broadband profile
              </p>
            </div>

            <div className="space-y-3 my-2">
              {packageRevenue.list.map((pkg, idx) => {
                const pct = Math.max(6, Math.round((pkg.totalPKR / packageRevenue.highest) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-950 dark:text-white">{pkg.name}</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">
                        Rs. {pkg.totalPKR.toLocaleString()} ({pkg.count} billings)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-[#1c2330] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.15, delay: idx * 0.01 }}
                        className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium mt-2">
              Ultra Fiber & Turbo tiers deliver 68% of gross margin
            </p>
          </div>

          {/* TOP 10 DATA USERS TABLE */}
          <div
            className={`lg:col-span-7 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
              isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-black text-black dark:text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Top 10 High Bandwidth Consumers</span>
                </h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  Subscribers with highest data volume usage in GB
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                Total: {store.stats.totalDataGB} GB
              </span>
            </div>

            {/* Scrollable table container */}
            <div className="overflow-x-auto no-scrollbar vertix-scroll-xy w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-[#2d3648] text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-200">
                    <th className="py-2 px-2">Rank</th>
                    <th className="py-2 px-2">Subscriber</th>
                    <th className="py-2 px-2">Package</th>
                    <th className="py-2 px-2">Data Consumed</th>
                    <th className="py-2 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648]">
                  {top10Users.map((u, idx) => {
                    const barPct = Math.round(((u.dataUsedGB || 0) / maxDataGB) * 100);
                    return (
                      <tr key={u.id} className="hover:bg-emerald-50/50 dark:hover:bg-[#1c2330] transition-colors">
                        <td className="py-2 px-2 font-bold text-slate-700 dark:text-slate-200">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td className="py-2 px-2">
                          <p className="font-extrabold text-slate-950 dark:text-white">{u.username}</p>
                          <p className="text-[10px] text-slate-700 dark:text-slate-300 truncate">{u.name}</p>
                        </td>
                        <td className="py-2 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                            {u.package}
                          </span>
                        </td>
                        <td className="py-2 px-2 min-w-[130px]">
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="text-slate-950 dark:text-white">{u.dataUsedGB} GB</span>
                            <span className="text-slate-600 dark:text-slate-300 text-[10px]">{barPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1c2330] rounded-full overflow-hidden">
                            <div
                              style={{ width: `${barPct}%` }}
                              className="h-full bg-gradient-to-r from-[#1f6b4f] to-[#14532d] rounded-full"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-block ${
                              u.online
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                                : u.status === 'Active'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                            }`}
                          >
                            {u.online ? 'Live' : u.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
