import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Star,
  Gift,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
  MessageSquare,
  Layers,
  ChevronDown,
  Sparkles,
  Wifi,
  Radio,
  Server
} from 'lucide-react';
import { Complaint, BrandingConfig } from '../types';

interface ModernChartAnalyticsDashboardProps {
  complaints?: Complaint[];
  stats?: {
    label: string;
    value: number;
    tooltip?: string;
    color?: string;
    textColor?: string;
    icon?: React.ReactNode;
    filter: any;
  }[];
  onTileClick?: (filter: any) => void;
  forcedStatus?: string | null;
  forcedPriority?: string | null;
  forcedCategory?: string | null;
  isDark?: boolean;
  branding?: BrandingConfig;
}

const ModernChartAnalyticsDashboard = React.memo(function ModernChartAnalyticsDashboard({
  complaints = [],
  stats,
  onTileClick,
  forcedStatus,
  forcedPriority,
  forcedCategory,
  isDark = false,
  branding
}: ModernChartAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<'WEEK' | 'MONTH' | 'YEAR'>('WEEK');

  // Extract counts for Quick Summary
  const isFallback = complaints.length === 0;
  const totalCount = isFallback ? 593 : complaints.length;
  const pendingCount = useMemo(() => {
    if (isFallback) return 4;
    return complaints.filter(c => {
      const s = (c.status || '').toLowerCase().trim();
      return s === 'pending' || s === 'open' || s === 'queued';
    }).length;
  }, [complaints, isFallback]);

  const inOperationCount = useMemo(() => {
    if (isFallback) return 2;
    return complaints.filter(c => {
      const s = (c.status || '').toLowerCase().trim();
      return s === 'in process' || s === 'in_process' || s === 'in operation' || s === 'active';
    }).length;
  }, [complaints, isFallback]);

  const completedCount = useMemo(() => {
    if (isFallback) return 583;
    return complaints.filter(c => {
      const s = (c.status || '').toLowerCase().trim();
      return s === 'complete' || s === 'completed' || s === 'resolved' || s === 'closed' || s === 'finalized';
    }).length;
  }, [complaints, isFallback]);

  const newConnCount = useMemo(() => {
    if (isFallback) return 18;
    return complaints.filter(c => {
      const cat = (c.category || '').toLowerCase();
      return cat.includes('new') || cat.includes('conn');
    }).length;
  }, [complaints, isFallback]);

  const reviewCount = useMemo(() => {
    if (isFallback) return 7;
    return complaints.filter(c => {
      const s = (c.status || '').toLowerCase().trim();
      return s.includes('review');
    }).length;
  }, [complaints, isFallback]);

  // Zone Breakdown for Key Data Visualizations Donut
  const zoneBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    complaints.forEach(c => {
      const z = (c.area || 'Unknown').trim();
      if (z) map[z] = (map[z] || 0) + 1;
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const topEntries = entries.slice(0, 5);
    const sumTop = topEntries.reduce((acc, curr) => acc + curr[1], 0);

    // Fallback if no complaints yet
    if (topEntries.length === 0) {
      return [
        { label: 'T9', percent: 38, count: 38, color: '#2563eb' },
        { label: 'CH18PP', percent: 23, count: 23, color: '#10b981' },
        { label: 'T34FF', percent: 19, count: 19, color: '#f59e0b' },
        { label: 'HC', percent: 13, count: 13, color: '#8b5cf6' },
        { label: 'EOK', percent: 9, count: 9, color: '#06b6d4' }
      ];
    }

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    return topEntries.map((item, idx) => ({
      label: item[0],
      count: item[1],
      percent: Math.max(1, Math.round((item[1] / (sumTop || 1)) * 100)),
      color: colors[idx % colors.length]
    }));
  }, [complaints]);

  // Category Breakdown for CATO. Donut
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    complaints.forEach(c => {
      const cat = (c.category || 'Other').trim().toUpperCase();
      map[cat] = (map[cat] || 0) + 1;
    });

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const topEntries = entries.slice(0, 6);
    const sumTop = topEntries.reduce((acc, curr) => acc + curr[1], 0);

    // Fallback if empty
    if (topEntries.length === 0) {
      return [
        { label: 'SLOW SPEED', percent: 28, count: 28, color: '#10b981' },
        { label: 'RED LIGHT', percent: 26, count: 26, color: '#ef4444' },
        { label: 'ROUTER CONFIG', percent: 15, count: 15, color: '#8b5cf6' },
        { label: 'OFFLINE', percent: 15, count: 15, color: '#f43f5e' },
        { label: 'NEW CONN.', percent: 11, count: 11, color: '#3b82f6' },
        { label: 'OTHER', percent: 7, count: 7, color: '#94a3b8' }
      ];
    }

    const colors = ['#10b981', '#ef4444', '#8b5cf6', '#f43f5e', '#3b82f6', '#94a3b8'];
    return topEntries.map((item, idx) => ({
      label: item[0],
      count: item[1],
      percent: Math.max(1, Math.round((item[1] / (sumTop || 1)) * 100)),
      color: colors[idx % colors.length]
    }));
  }, [complaints]);

  // Recent 5 complaints for Points/Activity History
  const recentActivities = useMemo(() => {
    if (complaints.length === 0) {
      return [
        { id: '1', title: 'Flight Ticket Booking', date: '15 Apr', points: '+1,206', icon: 'star', color: '#f43f5e' },
        { id: '2', title: 'Grocery Purchase', date: '14 Apr', points: '+1,004', icon: 'star', color: '#f97316' },
        { id: '3', title: 'Redeemed - Lounge pass', date: '11 Apr', points: '-2,500', icon: 'gift', color: '#6366f1' },
        { id: '4', title: 'Software License', date: '10 Apr', points: '+477', icon: 'star', color: '#ec4899' },
        { id: '5', title: 'Software License', date: '13 Apr', points: '-1587', icon: 'gift', color: '#a855f7' }
      ];
    }

    const sorted = [...complaints]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);

    const icons = ['star', 'gift', 'star', 'star', 'gift'];
    const colors = ['#f43f5e', '#f97316', '#6366f1', '#ec4899', '#a855f7'];

    return sorted.map((c, i) => {
      const dateStr = c.createdAt
        ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : 'Recent';
      const isResolved = (c.status || '').toLowerCase().includes('complete') || (c.status || '').toLowerCase().includes('resolved');
      return {
        id: c.id || `act-${i}`,
        title: c.customerName ? `${c.customerName} (${c.area || 'Zone'})` : c.category || 'Operational Ticket',
        date: dateStr,
        points: isResolved ? `+${(i + 1) * 350 + 400}` : `-${(i + 1) * 200 + 150}`,
        icon: icons[i % icons.length],
        color: colors[i % colors.length]
      };
    });
  }, [complaints]);

  // Days for the Large Analytical Chart X-Axis
  const chartDays = ['Mon 31/50', 'Tue 21/50', 'Wed 21/50', 'Thu 21/50', 'Fri 21/50'];

  return (
    <div className="w-full space-y-5 select-none font-sans">
      {/* 1. TITLE & SUBTITLE */}
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Chart Analytics
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Comprehensive operational data including status summaries, chart analytics, and registry logs.
        </p>
      </div>

      {/* 2. TOP GRID (LARGE ANALYTICAL CHART + QUICK SUMMARY & POINTS HISTORY) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: LARGE ANALYTICAL CHART (7 COLS ON LG, 8 ON XL) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div
            className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-xs transition-all ${
              isDark ? 'bg-[#1a202c] border-slate-700/60' : 'bg-white border-slate-200/80'
            }`}
          >
            {/* Header: Title + Period Pills */}
            <div className="flex items-center justify-between pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Large Analytical Chart
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase mt-0.5">
                  <Activity className="w-3 h-3 text-slate-400 stroke-[2.5]" />
                  <span>Activity Monitor</span>
                </div>
              </div>

              {/* Time Period Filter Pills */}
              <div
                className={`flex items-center p-1 rounded-full border text-xs font-semibold ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                {(['WEEK', 'MONTH', 'YEAR'] as const).map(p => {
                  const active = period === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                        active
                          ? isDark
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'bg-[#181a20] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Spline Area Chart Canvas */}
            <div className="mt-4 relative h-64 sm:h-72 w-full pt-4 pb-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 240" preserveAspectRatio="none">
                <defs>
                  {/* Purple/Blue Gradient for Wave 1 */}
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
                    <stop offset="70%" stopColor="#818cf8" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Teal/Green Gradient for Wave 2 */}
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                    <stop offset="70%" stopColor="#34d399" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Subtle Grid Pattern */}
                  <pattern id="chartGrid" width="600" height="45" patternUnits="userSpaceOnUse">
                    <line
                      x1="0"
                      y1="45"
                      x2="600"
                      y2="45"
                      stroke={isDark ? '#334155' : '#f1f5f9'}
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  </pattern>
                </defs>

                {/* Horizontal Guidelines */}
                <rect x="25" y="10" width="560" height="180" fill="url(#chartGrid)" />

                {/* Bottom Baseline */}
                <line x1="25" y1="195" x2="590" y2="195" stroke={isDark ? '#475569' : '#e2e8f0'} strokeWidth="1.5" />

                {/* WAVE 2: LOWER TEAL SPLINE (AREA + LINE) */}
                <path
                  d="M 30,175 C 90,185 130,190 170,185 C 210,180 230,150 250,90 C 270,140 290,190 330,195 C 370,198 400,195 440,195 C 480,195 530,190 575,195 L 575,195 L 30,195 Z"
                  fill="url(#tealGradient)"
                />
                <path
                  d="M 30,175 C 90,185 130,190 170,185 C 210,180 230,150 250,90 C 270,140 290,190 330,195 C 370,198 400,195 440,195 C 480,195 530,190 575,195"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* WAVE 1: UPPER PURPLE/BLUE SPLINE (AREA + LINE) */}
                <path
                  d="M 30,170 C 90,180 130,185 170,180 C 210,170 230,90 250,35 C 270,90 290,190 330,195 C 370,198 400,115 440,115 C 475,115 520,170 575,195 L 575,195 L 30,195 Z"
                  fill="url(#purpleGradient)"
                />
                <path
                  d="M 30,170 C 90,180 130,185 170,180 C 210,170 230,90 250,35 C 270,90 290,190 330,195 C 370,198 400,115 440,115 C 475,115 520,170 575,195"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Data Points (Dots on lines) */}
                <circle cx="30" cy="170" r="4.5" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                <circle cx="170" cy="180" r="4.5" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                <circle cx="250" cy="35" r="5" fill="#6366f1" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="330" cy="195" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                <circle cx="440" cy="115" r="4.5" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                <circle cx="575" cy="195" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />

                {/* Green dots on teal wave */}
                <circle cx="30" cy="175" r="3.5" fill="#10b981" />
                <circle cx="170" cy="185" r="3.5" fill="#10b981" />
                <circle cx="250" cy="90" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <circle cx="330" cy="195" r="3.5" fill="#10b981" />
                <circle cx="440" cy="195" r="3.5" fill="#10b981" />
                <circle cx="575" cy="195" r="3.5" fill="#10b981" />
              </svg>

              {/* Y-AXIS LABELS (LEFT) */}
              <div className="absolute left-1 top-2 bottom-9 flex flex-col justify-between text-[11px] font-semibold text-slate-400 select-none">
                <span>4</span>
                <span>3</span>
                <span>2</span>
                <span>1</span>
                <span>0</span>
              </div>

              {/* X-AXIS LABELS (BOTTOM) */}
              <div className="absolute bottom-1 left-7 right-4 flex justify-between text-[10px] sm:text-xs font-semibold text-slate-400 select-none">
                {chartDays.map((d, i) => (
                  <span key={i} className="text-center">{d}</span>
                ))}
              </div>

              {/* FLOATING CALLOUT BADGE 1 (PEAK) */}
              <div className="absolute top-1 left-[36%] -translate-x-1/2 pointer-events-none">
                <div className="px-2.5 py-1 rounded-full bg-[#fde8e8] dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-[10px] font-bold text-rose-700 dark:text-rose-300 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>PLAE 3: 37/10</span>
                </div>
              </div>

              {/* FLOATING CALLOUT BADGE 2 (SECOND PEAK) */}
              <div className="absolute top-[38%] left-[73%] -translate-x-1/2 pointer-events-none">
                <div className="px-2.5 py-1 rounded-full bg-[#e0f2fe] dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-[10px] font-bold text-sky-700 dark:text-sky-300 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                  <span>#2. COMPLAINS 18/10</span>
                </div>
              </div>

              {/* FLOATING CALLOUT BADGE 3 (BOTTOM RIGHT LEGEND) */}
              <div className="absolute bottom-8 right-6 pointer-events-none hidden sm:block">
                <div className="px-3 py-1 rounded-full bg-[#f1f5f9] dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300 shadow-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  <span>PLAE : COMPLAINTS ON Thu 19/10</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: QUICK SUMMARY + POINTS HISTORY (5 COLS ON LG, 4 ON XL) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Card: Quick Summary */}
          <div
            className={`p-5 rounded-[28px] sm:rounded-[32px] border shadow-xs transition-all ${
              isDark ? 'bg-[#1a202c] border-slate-700/60' : 'bg-white border-slate-200/80'
            }`}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Quick Summary
            </h3>

            {/* 4 Main Summary Values in Grid matching screenshot */}
            <div className="grid grid-cols-4 gap-2 text-center pb-2">
              {/* Total Registry */}
              <div
                onClick={() => onTileClick({ status: 'all', priority: 'all', category: 'all' })}
                className="cursor-pointer group hover:scale-105 transition-transform"
                title="Total Registry"
              >
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  Total Registry
                </p>
                <h4 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-white mt-1 group-hover:text-blue-600 transition-colors">
                  {totalCount.toString().padStart(2, '0')}
                </h4>
              </div>

              {/* Pending Requests */}
              <div
                onClick={() => onTileClick({ status: 'pending', priority: 'all', category: 'all' })}
                className="cursor-pointer group hover:scale-105 transition-transform"
                title="Pending Requests"
              >
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  Pending Requests
                </p>
                <h4 className="text-2xl sm:text-3xl font-extrabold text-[#e11d48] mt-1 group-hover:scale-110 transition-transform">
                  {pendingCount.toString().padStart(2, '0')}
                </h4>
              </div>

              {/* In Operation */}
              <div
                onClick={() => onTileClick({ status: 'in process', priority: 'all', category: 'all' })}
                className="cursor-pointer group hover:scale-105 transition-transform"
                title="In Operation"
              >
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  In Operation
                </p>
                <h4 className="text-2xl sm:text-3xl font-extrabold text-[#2563eb] mt-1 group-hover:scale-110 transition-transform">
                  {inOperationCount.toString().padStart(2, '0')}
                </h4>
              </div>

              {/* Completed */}
              <div
                onClick={() => onTileClick({ status: 'complete', priority: 'all', category: 'all' })}
                className="cursor-pointer group hover:scale-105 transition-transform"
                title="Completed"
              >
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  Completed
                </p>
                <h4 className="text-2xl sm:text-3xl font-extrabold text-[#059669] mt-1 group-hover:scale-110 transition-transform">
                  {completedCount.toString().padStart(2, '0')}
                </h4>
              </div>
            </div>

            {/* Sub-Pills for New Connection & Customer Review to complete the 6 metrics */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div
                onClick={() => onTileClick({ status: 'pending', priority: 'all', category: 'New Connection' })}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">New Conn.</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400">
                  {newConnCount.toString().padStart(2, '0')}
                </span>
              </div>
              <div
                onClick={() => onTileClick({ status: 'customer review', priority: 'all', category: 'all' })}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <span className="font-semibold text-slate-600 dark:text-slate-300 text-[11px]">Review</span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                  {reviewCount.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Points history (Recent Activity Logs Feed) */}
          <div
            className={`p-5 rounded-[28px] sm:rounded-[32px] border shadow-xs transition-all ${
              isDark ? 'bg-[#1a202c] border-slate-700/60' : 'bg-white border-slate-200/80'
            }`}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Points history
            </h3>

            {/* List of 5 items matching screenshot style */}
            <div className="space-y-3">
              {recentActivities.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.color}15`, color: item.color }}
                    >
                      {item.icon === 'star' ? (
                        <Star className="w-4 h-4 fill-current stroke-none" />
                      ) : (
                        <Gift className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.date}</p>
                    </div>
                  </div>
                  <span
                    className={`font-extrabold text-xs shrink-0 pl-2 ${
                      item.points.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM ROW: KEY DATA VISUALIZATIONS (ZONES DONUT) & CATEGORIES DONUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DONUT 1: KEY DATA VISUALIZATIONS (ZONES) */}
        <div
          className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-xs transition-all ${
            isDark ? 'bg-[#1a202c] border-slate-700/60' : 'bg-white border-slate-200/80'
          }`}
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Key Data Visualizations
          </h3>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* SVG Donut Chart with Leader Line Callouts */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
                {(() => {
                  let cumulativePercent = 0;
                  return zoneBreakdown.map((slice, i) => {
                    const strokeDasharray = `${slice.percent} ${100 - slice.percent}`;
                    const strokeDashoffset = -cumulativePercent;
                    cumulativePercent += slice.percent;
                    return (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r="36"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="18"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        pathLength="100"
                        className="transition-all duration-150 hover:opacity-85"
                      />
                    );
                  });
                })()}
              </svg>

              {/* Center Circle with "ZONES" text */}
              <div className="absolute inset-0 m-auto w-18 h-18 rounded-full bg-white dark:bg-[#1a202c] flex items-center justify-center shadow-inner pointer-events-none">
                <span className="text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                  ZONES
                </span>
              </div>
            </div>

            {/* Leader Tags & Legend */}
            <div className="space-y-2 w-full max-w-xs">
              {zoneBreakdown.map((z, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: z.color }} />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{z.label}</span>
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white">{z.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* DONUT 2: CATEGORIES (CATO.) */}
        <div
          className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-xs transition-all ${
            isDark ? 'bg-[#1a202c] border-slate-700/60' : 'bg-white border-slate-200/80'
          }`}
        >
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            CATEGORIES
          </h3>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* SVG Donut Chart with "CATO." in Center */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
                {(() => {
                  let cumulativePercent = 0;
                  return categoryBreakdown.map((slice, i) => {
                    const strokeDasharray = `${slice.percent} ${100 - slice.percent}`;
                    const strokeDashoffset = -cumulativePercent;
                    cumulativePercent += slice.percent;
                    return (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r="36"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="18"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        pathLength="100"
                        className="transition-all duration-150 hover:opacity-85"
                      />
                    );
                  });
                })()}
              </svg>

              {/* Center Circle with "CATO." text */}
              <div className="absolute inset-0 m-auto w-18 h-18 rounded-full bg-white dark:bg-[#1a202c] flex items-center justify-center shadow-inner pointer-events-none">
                <span className="text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                  CATO.
                </span>
              </div>
            </div>

            {/* Leader Tags & Legend */}
            <div className="space-y-1.5 w-full max-w-xs">
              {categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{cat.label}</span>
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white shrink-0">{cat.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ModernChartAnalyticsDashboard;
