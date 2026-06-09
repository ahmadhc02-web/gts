import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, Layout as LayoutIcon, Type as Font, Bot, Save, RefreshCw, Smartphone, 
  Monitor, Info, Check, Image as ImageIcon, Box, Zap, MousePointer, 
  Layers, Sliders, Settings2, Shield, User as UserIcon, Bell, MessageSquare, Type,
  Contact, ClipboardList, MapPin, Key, Phone, Package, MapPinned, ShieldAlert, Activity, FileSpreadsheet,
  TrendingUp, Users, CheckCircle2, Clock, ExternalLink, RotateCcw, Undo2, Redo2,
  Flame, BarChart3, PlusSquare, Map as MapIcon, Settings, CloudUpload, CreditCard
} from 'lucide-react';
import { BrandingConfig, UserProfile, Notification } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import Layout from './Layout';

interface EditorPanelProps {
  branding: BrandingConfig;
  onUpdate: (data: Partial<BrandingConfig>) => Promise<void>;
}

const MOCK_USER: UserProfile = {
  uid: 'preview-user',
  username: 'AdminPreview',
  password: 'password',
  role: 'super_admin',
  fullName: 'Super Administrator',
  lineCode: '001',
  companyName: 'Green Tech Services',
  dealerId: 'main',
  createdAt: Date.now(),
  lastActive: Date.now()
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'complaint_created',
    message: 'New registry protocol initiated for Node Alpha-7',
    authorName: 'System Bot',
    createdAt: Date.now() - 1000 * 60 * 5,
    details: { nodeId: 'A-7', status: 'pending' }
  },
  {
    id: 'n2',
    type: 'user_created',
    message: 'Operational partner authorized: Khalid Network',
    authorName: 'Admin',
    createdAt: Date.now() - 1000 * 60 * 30,
    details: { role: 'dealer' }
  }
];

const DEFAULT_BRANDING = {
  projectName: 'Green Tech Services',
  accentColor: '#3b82f6',
  themeColor: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 'md',
  cardStyle: 'elevated',
  enableAnimations: true,
  sidebarTheme: 'light',
  mascotPos: { x: 92, y: 85 },
  chatWelcomeMsg: 'Hello! I am your GTS assistant. How can I help you today?',
  dashboardSubtext: 'Operational Management System',
  logoUrl: '',
  tabNames: {},
  customNames: {},
  homeSections: [
    { id: 'stats', visible: true, order: 0 },
    { id: 'charts', visible: true, order: 1 },
    { id: 'registry', visible: true, order: 2 }
  ]
};

const FONT_FAMILIES = [
  { name: 'Inter (Modern Sans)', value: 'Inter, system-ui, sans-serif' },
  { name: 'Montserrat (Corporate)', value: 'Montserrat, sans-serif' },
  { name: 'Poppins (Smooth Business)', value: 'Poppins, sans-serif' },
  { name: 'Roboto (Standard)', value: 'Roboto, sans-serif' },
  { name: 'Lexend (Clean Business)', value: 'Lexend, sans-serif' },
  { name: 'Space Grotesk (Tech Business)', value: 'Space Grotesk, sans-serif' },
  { name: 'Sora (Modern Tech)', value: 'Sora, sans-serif' },
  { name: 'Be Vietnam Pro (Sharp)', value: 'Be Vietnam Pro, sans-serif' },
  { name: 'Archivo (Corporate Bold)', value: 'Archivo, sans-serif' },
  { name: 'Work Sans (Clear Professional)', value: 'Work Sans, sans-serif' },
  { name: 'Manrope (Modern UI)', value: 'Manrope, sans-serif' },
  { name: 'Outfit (Modern Business)', value: 'Outfit, sans-serif' },
  { name: 'Plus Jakarta Sans (Premium)', value: 'Plus Jakarta Sans, sans-serif' },
  { name: 'Syne (Avant Garde)', value: 'Syne, sans-serif' },
  { name: 'JetBrains Mono (Technical)', value: 'JetBrains Mono, monospace' }
];

const ACCENT_COLORS = [
  { name: 'Standard Blue', value: '#3b82f6' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Rose Red', value: '#f43f5e' },
  { name: 'Amber Orange', value: '#f59e0b' },
  { name: 'Violet Purple', value: '#8b5cf6' },
  { name: 'Cyan Tech', value: '#06b6d4' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Gold', value: '#eab308' }
];

const BORDER_RADII = [
  { name: 'Sharp', value: 'none' },
  { name: 'Small', value: 'sm' },
  { name: 'Default', value: 'md' },
  { name: 'Large', value: 'lg' },
  { name: 'Full', value: 'full' }
];

const CARD_STYLES = [
  { name: 'Minimal Flat', value: 'flat', description: 'Clean, no borders or shadows' },
  { name: 'Industrial Border', value: 'bordered', description: 'High-contrast stroked borders' },
  { name: 'Shadow Depth', value: 'elevated', description: 'Soft shadows for layering' },
  { name: 'Cyber Glass', value: 'glass', description: 'Frosted translucency' }
];

const PRESETS: Record<string, Partial<BrandingConfig>> = {
  modern_tech: {
    accentColor: '#3b82f6',
    fontFamily: 'Space Grotesk, sans-serif',
    borderRadius: 'lg',
    cardStyle: 'elevated',
    sidebarTheme: 'dark',
    glassOpacity: 10
  },
  corporate_clean: {
    accentColor: '#1e293b',
    fontFamily: 'Montserrat, sans-serif',
    borderRadius: 'none',
    cardStyle: 'bordered',
    sidebarTheme: 'light',
    glassOpacity: 5
  },
  premium_business: {
    accentColor: '#8b5cf6',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    borderRadius: 'full',
    cardStyle: 'glass',
    sidebarTheme: 'accent',
    glassOpacity: 15
  },
  functional_pro: {
    accentColor: '#10b981',
    fontFamily: 'Work Sans, sans-serif',
    borderRadius: 'md',
    cardStyle: 'flat',
    sidebarTheme: 'light',
    glassOpacity: 0
  }
};

export default function EditorPanel({ branding, onUpdate }: EditorPanelProps) {
  const [config, setConfigInternal] = useState<BrandingConfig>({ ...branding });
  const [past, setPast] = useState<BrandingConfig[]>([]);
  const [future, setFuture] = useState<BrandingConfig[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'identity' | 'visuals' | 'bot' | 'terminology' | 'layout'>('identity');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Custom setter that records history
  const setConfig = (newVal: BrandingConfig) => {
    setPast(prev => [...prev, config].slice(-20));
    setFuture([]);
    setConfigInternal(newVal);
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [config, ...prev]);
    setConfigInternal(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, config]);
    setConfigInternal(next);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Except if it's explicitly Cmd+Z/Y
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [past, future, config]);

  // Ensure config has new structures
  if (!config.tabNames) config.tabNames = {};
  if (!config.homeSections || config.homeSections.length === 0) {
    config.homeSections = [
      { id: 'stats', visible: true, order: 0 },
      { id: 'charts', visible: true, order: 1 },
      { id: 'registry', visible: true, order: 2 }
    ];
  }

  const sectionLabels: Record<string, string> = {
    stats: 'Dashboard Statistic Tiles',
    charts: 'Analytics Chart Modules',
    registry: 'Main Content / Registry Area'
  };

  const navTabDefinitions = [
    { id: 'complaints', label: 'Operations' },
    { id: 'dealers_data', label: 'Dealers Data' },
    { id: 'submit', label: 'Complain Reg' },
    { id: 'clients', label: 'User Details' },
    { id: 'nodes', label: 'Active Nodes' },
    { id: 'users', label: 'Link Access' },
    { id: 'dealers', label: 'Dealer Section' },
    { id: 'config', label: 'Workflow Config' },
    { id: 'settings', label: 'Security' },
    { id: 'integrations', label: 'Google Sheet Link' },
    { id: 'branding', label: 'Global Editor' }
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(config);
      toast.success('Website branding updated globally!', {
        description: 'Changes have been pushed to all active sessions.'
      });
    } catch (error) {
      toast.error('Failed to save branding config');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all design settings to default? This will wipe your current customizations.')) {
      const resetConfig = {
        ...config,
        ...DEFAULT_BRANDING
      };
      setConfig(resetConfig);
      setIsSaving(true);
      try {
        await onUpdate(resetConfig);
        toast.info('Design system reset to factory defaults.');
      } catch (error) {
        toast.error('Failed to reset defaults');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const inputClasses = "w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600";
  const labelClasses = "block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-2 tracking-[0.2em] ml-1";
  const sectionHeaderClasses = "text-xs font-black uppercase tracking-[0.2em] text-brand-accent border-b border-brand-accent/10 pb-4 mb-6 flex items-center gap-3";

  const getCardPreviewStyle = (style: BrandingConfig['cardStyle']) => {
    switch(style) {
      case 'bordered': return "border-2 border-slate-200 dark:border-slate-800";
      case 'elevated': return "shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800";
      case 'glass': return "bg-white/10 dark:bg-slate-900/10 backdrop-blur-md border border-white/20";
      default: return "border-none";
    }
  };

  return (
    <>
      {/* Full Screen Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 sm:p-10"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full h-full max-w-7xl bg-white dark:bg-slate-950 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl border border-white/10"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-4">
                  <Monitor className="text-brand-accent" size={24} />
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Enterprise Production Preview</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Simulated High-Fidelity Website Rendering</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="flex gap-2 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button 
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                          previewDevice === 'mobile' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        <Smartphone size={14} /> Android Simulation
                      </button>
                      <button 
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                          previewDevice === 'desktop' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        <Monitor size={14} /> Desktop View
                      </button>
                   </div>
                   <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-sm font-bold text-xl"
                   >
                     ×
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-4 sm:p-10 flex justify-center">
                <div 
                  className={cn(
                    "bg-white dark:bg-slate-950 transition-all duration-700 relative overflow-hidden scrollbar-hide",
                    previewDevice === 'mobile' 
                      ? "w-[360px] h-[740px] rounded-[3.5rem] border-[12px] border-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-y-auto" 
                      : "w-full min-h-[1200px] shadow-2xl rounded-t-[2.5rem]"
                  )}
                  style={{ 
                    fontFamily: config.fontFamily,
                    borderRadius: previewDevice === 'mobile' ? '3.5rem' : '2.5rem'
                  }}
                >
                  {/* Android specific top notch and indicators */}
                  {previewDevice === 'mobile' && (
                    <div className="sticky top-0 left-0 right-0 h-10 bg-black z-[60] flex items-center justify-between px-8 text-[9px] font-black text-white/50 tracking-widest uppercase">
                       <span>12:30 PM</span>
                       <div className="w-20 h-5 bg-slate-900 rounded-full flex items-center justify-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                       </div>
                       <div className="flex gap-2 items-center">
                          <div className="w-4 h-2.5 border border-white/20 rounded-[2px]" />
                          <RefreshCw size={10} className="animate-spin" />
                       </div>
                    </div>
                  )}
                  {/* Shared Website Content Structure */}
                  <div className="min-h-full">
                    <Layout
                      user={MOCK_USER}
                      users={[MOCK_USER]}
                      notifications={MOCK_NOTIFICATIONS}
                      branding={config}
                      isLoading={false}
                    >
                      <div className="space-y-8">
                        {/* Summary Tiles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {[
                            { label: config.tabNames?.total_registry || 'Total Inventory', val: '1,248', icon: Package, color: config.accentColor },
                            { label: config.tabNames?.pending_requests || 'Pending Tasks', val: '42', icon: Clock, color: '#f59e0b' },
                            { label: config.tabNames?.connection_complete || 'Deployed Units', val: '892', icon: CheckCircle2, color: '#10b981' }
                          ].map((stat, i) => (
                            <div key={'stat-'+i} className={cn("p-6 bg-white dark:bg-slate-950", getCardPreviewStyle(config.cardStyle))}>
                              <div className="flex justify-between items-start">
                                <div className="p-3 rounded-xl" style={{ backgroundColor: `${stat.color}10`, color: stat.color }}>
                                  <stat.icon size={24} />
                                </div>
                                <span className={cn("text-2xl font-black italic", config.sidebarTheme === 'default' || config.sidebarTheme === 'light' ? "text-slate-900" : "text-white")}>{stat.val}</span>
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">{stat.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Analytic Modules */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          <div className={cn("lg:col-span-8 p-8 bg-white dark:bg-slate-950", getCardPreviewStyle(config.cardStyle))}>
                             <div className="flex items-center justify-between mb-8">
                                <div>
                                   <h4 className={cn("text-lg font-black uppercase tracking-tight", config.sidebarTheme === 'default' || config.sidebarTheme === 'light' ? "text-slate-900" : "text-white")}>Operational Throughput</h4>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Data Stream Analysis</p>
                                </div>
                                <TrendingUp className="text-brand-accent" size={24} />
                             </div>
                             <div className="h-[300px] w-full flex items-end gap-3 px-4">
                                {[60, 40, 80, 55, 90, 70, 85, 45, 95, 65, 75, 50].map((h, i) => (
                                  <motion.div 
                                    key={'bar-'+i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: i * 0.05, duration: 1 }}
                                    className="flex-1 rounded-t-lg transition-all hover:opacity-80"
                                    style={{ backgroundColor: i % 2 === 0 ? config.accentColor : `${config.accentColor}80` }}
                                  />
                                ))}
                             </div>
                          </div>

                          <div className={cn("lg:col-span-4 p-8 bg-white dark:bg-slate-950", getCardPreviewStyle(config.cardStyle))}>
                             <div className="mb-8">
                                <h4 className={cn("text-lg font-black uppercase tracking-tight", config.sidebarTheme === 'default' || config.sidebarTheme === 'light' ? "text-slate-900" : "text-white")}>Network Users</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Partner Nodes</p>
                             </div>
                             <div className="space-y-4">
                                {[1,2,3,4,5].map(i => (
                                  <div key={'user-'+i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                        <Users size={14} />
                                      </div>
                                      <span className={cn("text-xs font-bold", config.sidebarTheme === 'default' || config.sidebarTheme === 'light' ? "text-slate-700" : "text-slate-200")}>Node_{i}52</span>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  </div>
                                ))}
                             </div>
                          </div>
                        </div>

                        {/* Recent Registry Information */}
                        <div className={cn("p-8 bg-white dark:bg-slate-950", getCardPreviewStyle(config.cardStyle))}>
                          <div className="flex items-center gap-3 mb-8">
                            <ClipboardList className="text-brand-accent" size={24} />
                            <div>
                              <h4 className={cn("text-lg font-black uppercase tracking-tight", config.sidebarTheme === 'default' || config.sidebarTheme === 'light' ? "text-slate-900" : "text-white")}>Recent Operational Logs</h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historical Event Persistence</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Origin</th>
                                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Protocol</th>
                                  <th className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {[1,2,3].map(i => (
                                  <tr key={'tr-'+i}>
                                    <td className="py-5 text-[10px] font-bold text-slate-500">12:30:4{i}</td>
                                    <td className="py-5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400"><MapPin size={10} /></div>
                                        <span className={cn("text-[10px] font-black uppercase", config.sidebarTheme === 'default' || config.sidebarTheme === 'light' ? "text-slate-700" : "text-slate-200")}>Sector {i}</span>
                                      </div>
                                    </td>
                                    <td className="py-5 text-[10px] font-bold text-slate-500">Inbound Data Verification</td>
                                    <td className="py-5">
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Active</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </Layout>
                  </div>

                  {/* Floating mascot in full screen */}
                  {!config.hideBot && (
                    <motion.div 
                      className="fixed pointer-events-none z-[100]"
                      style={{ 
                        left: `${config.mascotPos.x}%`, 
                        top: `${config.mascotPos.y}%`,
                        width: 'auto'
                      }}
                      animate={{ y: [0, -15, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div 
                        className="p-5 rounded-[2rem] shadow-2xl text-white flex flex-col items-center justify-center gap-3 border border-white/20"
                        style={{ 
                          backgroundColor: config.accentColor,
                        }}
                      >
                         <Bot size={32} />
                         <div className="px-4 py-1.5 rounded-full bg-black/20 text-[8px] font-black uppercase tracking-widest">
                           {config.chatWelcomeMsg ? 'Active' : 'Standby'}
                         </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Editor Controls */}
      <div className="lg:col-span-12 xl:col-span-8 space-y-6">
        {/* Header & Save Action */}
        <div className="business-card p-6 bg-white dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-accent/10 flex items-center justify-center text-brand-accent shadow-inner">
              <Palette size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Design System Engine</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tactical UI Personalization Infrastructure</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 mr-2 shadow-sm">
              <button
                onClick={undo}
                disabled={past.length === 0}
                className={cn(
                  "p-3 rounded-lg transition-all flex items-center justify-center gap-2",
                  past.length > 0 
                    ? "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" 
                    : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                )}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={20} />
                <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">Undo</span>
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
              <button
                onClick={redo}
                disabled={future.length === 0}
                className={cn(
                  "p-3 rounded-lg transition-all flex items-center justify-center gap-2",
                  future.length > 0 
                    ? "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" 
                    : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                )}
                title="Redo (Ctrl+Shift+Z)"
              >
                <span className="text-[9px] font-black uppercase tracking-widest hidden md:block">Redo</span>
                <Redo2 size={20} />
              </button>
            </div>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-700"
            >
              <RotateCcw size={16} />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-8 py-4 bg-slate-900 dark:bg-brand-accent text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              Synchronize Globally
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'identity', label: 'Identity', icon: Shield },
              { id: 'visuals', label: 'Visual Engineering', icon: Sliders },
              { id: 'layout', label: 'Layout & Navigation', icon: LayoutIcon },
              { id: 'bot', label: 'AI Mascot', icon: Bot },
              { id: 'terminology', label: 'Terminology', icon: Type }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeSubTab === tab.id
                    ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-2">Business Presets:</span>
            <div className="flex gap-2">
              {Object.keys(PRESETS).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    const preset = PRESETS[key];
                    setConfig({ ...config, ...preset });
                    toast.info(`Applied ${key.split('_').join(' ')} preset protocol.`);
                  }}
                  className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-700 hover:scale-125 transition-all shadow-sm"
                  style={{ backgroundColor: PRESETS[key].accentColor }}
                  title={`Apply ${key.split('_').join(' ')} style`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Form Sections */}
        <div className="space-y-6">
          {activeSubTab === 'identity' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="business-card p-8 bg-white dark:bg-slate-950 space-y-8">
              <h4 className={sectionHeaderClasses}><Shield size={18} /> Core Project Identity</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Primary Project Title</label>
                    <input
                      type="text"
                      value={config.projectName}
                      onChange={(e) => setConfig({ ...config, projectName: e.target.value })}
                      className={inputClasses}
                      placeholder="e.g. Matrix Operations"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClasses}>Operational Subtext</label>
                    <input
                      type="text"
                      value={config.dashboardSubtext || ''}
                      onChange={(e) => setConfig({ ...config, dashboardSubtext: e.target.value })}
                      className={inputClasses}
                      placeholder="e.g. Tactical Response Network"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className={labelClasses}>Global Logo URL (PNG/SVG)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={config.logoUrl || ''}
                        onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                        className={cn(inputClasses, "pl-11")}
                        placeholder="https://..."
                      />
                      <ImageIcon className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClasses}>Chat Greet Message</label>
                    <textarea
                      value={config.chatWelcomeMsg || ''}
                      onChange={(e) => setConfig({ ...config, chatWelcomeMsg: e.target.value })}
                      className={cn(inputClasses, "h-24 resize-none")}
                      placeholder="Welcome to the secure ops channel..."
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'visuals' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <h4 className={sectionHeaderClasses}><Sliders size={18} /> Color & Typography Matrix</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className={labelClasses}>Accent Engineering</label>
                      <div className="grid grid-cols-4 gap-3">
                        {ACCENT_COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setConfig({ ...config, accentColor: color.value })}
                            className={cn(
                              "w-full aspect-square rounded-2xl border-2 transition-all flex items-center justify-center shadow-sm",
                              config.accentColor === color.value 
                                ? "border-slate-900 dark:border-white ring-4 ring-brand-accent/20 scale-105" 
                                : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: color.value }}
                          >
                            {config.accentColor === color.value && <Check size={18} className="text-white drop-shadow-md" />}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                         <input 
                           type="color" 
                           value={config.accentColor}
                           onChange={(e) => setConfig({...config, accentColor: e.target.value})}
                           className="w-10 h-10 rounded-lg border-none bg-transparent cursor-pointer"
                         />
                         <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Custom HEX Code</p>
                            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{config.accentColor}</p>
                         </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className={labelClasses}>Typography Profile</label>
                      <div className="grid grid-cols-1 gap-2">
                        {FONT_FAMILIES.map((font) => (
                          <button
                            key={font.value}
                            onClick={() => setConfig({ ...config, fontFamily: font.value })}
                            className={cn(
                              "w-full px-5 py-4 rounded-xl border text-left text-sm font-bold transition-all flex justify-between items-center group",
                              config.fontFamily === font.value
                                ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent shadow-lg"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-accent/50"
                            )}
                            style={{ fontFamily: font.value }}
                          >
                            {font.name}
                            {config.fontFamily === font.value && <Check size={16} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                     <div className="space-y-4">
                       <label className={labelClasses}>Global Sidebar Theme</label>
                       <div className="grid grid-cols-3 gap-3">
                         {['light', 'dark', 'accent'].map((theme) => (
                           <button
                             key={theme}
                             onClick={() => setConfig({ ...config, sidebarTheme: theme as any })}
                             className={cn(
                               "px-4 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                               config.sidebarTheme === theme
                                 ? "bg-slate-900 dark:bg-brand-accent text-white border-slate-900 dark:border-brand-accent shadow-md scale-105"
                                 : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                             )}
                           >
                             {theme}
                           </button>
                         ))}
                       </div>
                     </div>

                     <div className="space-y-4">
                        <label className={labelClasses}>Border Radius Intelligence</label>
                        <div className="flex gap-2">
                          {BORDER_RADII.map((radius) => (
                            <button
                              key={radius.value}
                              onClick={() => setConfig({ ...config, borderRadius: radius.value as any })}
                              className={cn(
                                "flex-1 h-12 border-2 transition-all flex items-center justify-center",
                                config.borderRadius === radius.value
                                  ? "bg-slate-900 dark:bg-brand-accent border-slate-900 dark:border-brand-accent text-white shadow-md scale-105"
                                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                              )}
                              style={{ borderRadius: radius.value === 'none' ? '0' : radius.value === 'full' ? '9999px' : radius.value === 'sm' ? '0.125rem' : radius.value === 'md' ? '0.375rem' : '0.75rem' }}
                            >
                              <span className="text-[10px] font-black uppercase">{radius.name}</span>
                            </button>
                          ))}
                        </div>
                     </div>

                     <div className="space-y-4">
                        <label className={labelClasses}>Animation Dynamics</label>
                        <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
                          <div className="flex items-center gap-3 text-brand-accent">
                             <Zap size={20} className={config.enableAnimations ? "animate-pulse" : ""} />
                             <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Enable UI Motion</span>
                          </div>
                          <button
                            onClick={() => setConfig({ ...config, enableAnimations: !config.enableAnimations })}
                            className={cn(
                              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
                              config.enableAnimations ? "bg-brand-accent" : "bg-slate-300 dark:bg-slate-700"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm",
                                config.enableAnimations ? "translate-x-6" : "translate-x-1"
                              )}
                            />
                          </button>
                        </div>
                     </div>
                  </div>
                </div>
              </div>

              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <h4 className={sectionHeaderClasses}><Layers size={18} /> Surface & Card Engineering</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {CARD_STYLES.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setConfig({ ...config, cardStyle: style.value as any })}
                      className={cn(
                        "p-6 text-left rounded-2xl border-2 transition-all space-y-3 group",
                        config.cardStyle === style.value
                          ? "bg-slate-900 dark:bg-brand-accent border-slate-900 dark:border-brand-accent shadow-2xl scale-105"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        config.cardStyle === style.value ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500 group-hover:text-brand-accent"
                      )}>
                        {style.value === 'flat' && <Box size={20} />}
                        {style.value === 'bordered' && <LayoutIcon size={20} />}
                        {style.value === 'elevated' && <Layers size={20} />}
                        {style.value === 'glass' && <div className="w-5 h-5 rounded-full border-2 border-current blur-[1px]" />}
                      </div>
                      <div>
                        <p className={cn("text-xs font-black uppercase tracking-tight", config.cardStyle === style.value ? "text-white" : "text-slate-900 dark:text-white")}>{style.name}</p>
                        <p className={cn("text-[9px] font-bold uppercase tracking-widest", config.cardStyle === style.value ? "text-white/70" : "text-slate-400")}>{style.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {config.cardStyle === 'glass' && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-4">
                        <label className={labelClasses}>Glass Opacity Intensity</label>
                        <span className="text-xs font-mono font-bold text-brand-accent">{config.glassOpacity || 10}%</span>
                      </div>
                      <input 
                        type="range"
                        min="5"
                        max="80"
                        step="5"
                        value={config.glassOpacity || 10}
                        onChange={(e) => setConfig({ ...config, glassOpacity: Number(e.target.value) })}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-brand-accent"
                      />
                   </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeSubTab === 'bot' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="business-card p-8 bg-white dark:bg-slate-950 space-y-8">
              <h4 className={sectionHeaderClasses}><Bot size={18} /> Autonomous Agent Configuration</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Deployment Status</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Control bot presence in active viewport</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, hideBot: !config.hideBot })}
                      className={cn(
                        "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none shadow-sm",
                        !config.hideBot ? "bg-brand-accent" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md",
                          !config.hideBot ? "translate-x-7" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <label className={labelClasses}>Coordinate Position (X/Y Viewport %)</label>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">X Offset (Left %)</span>
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                           <input
                            type="number"
                            value={config.mascotPos.x}
                            onChange={(e) => setConfig({ ...config, mascotPos: { ...config.mascotPos, x: Number(e.target.value) } })}
                            className="w-full bg-transparent p-3 font-mono text-xs font-bold focus:outline-none"
                          />
                          <span className="pr-4 text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Y Offset (Top %)</span>
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                          <input
                            type="number"
                            value={config.mascotPos.y}
                            onChange={(e) => setConfig({ ...config, mascotPos: { ...config.mascotPos, y: Number(e.target.value) } })}
                            className="w-full bg-transparent p-3 font-mono text-xs font-bold focus:outline-none"
                          />
                          <span className="pr-4 text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                   <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
                      <div className="h-full w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center opacity-50">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.5em] rotate-90">Bot Viewport Matrix</p>
                      </div>
                      <motion.div 
                        initial={false}
                        animate={{ 
                          left: `${config.mascotPos.x}%`, 
                          top: `${config.mascotPos.y}%`,
                          scale: config.hideBot ? 0 : 1
                        }}
                        className="absolute w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-brand-accent/50 z-20"
                      >
                         <Bot size={24} />
                      </motion.div>
                   </div>
                   <div className="absolute bottom-6 right-6">
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex gap-4 max-w-[280px]">
                        <Info className="text-amber-600 shrink-0" size={16} />
                        <p className="text-[9px] font-bold text-amber-800 dark:text-amber-500 leading-relaxed uppercase tracking-widest">
                          Mobile viewports (width &lt; 640px) ignore these coordinates to prevent interface occlusion.
                        </p>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'layout' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <h4 className={sectionHeaderClasses}><LayoutIcon size={18} /> Homepage Section Organization</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 -mt-4">Define visibility and render order for dashboard modules</p>
                
                <div className="space-y-4">
                  {(config.homeSections || []).sort((a, b) => a.order - b.order).map((section, index) => (
                    <div key={section.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => {
                            if (index === 0) return;
                            const newSections = [...(config.homeSections || [])];
                            const prevIndex = newSections.findIndex(s => s.order === section.order - 1);
                            if (prevIndex !== -1) {
                              newSections[prevIndex].order += 1;
                              section.order -= 1;
                              setConfig({ ...config, homeSections: newSections });
                            }
                          }}
                          className="p-1 hover:text-brand-accent transition-colors disabled:opacity-20"
                          disabled={index === 0}
                        >
                          <RefreshCw size={12} className="rotate-180" />
                        </button>
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">{sectionLabels[section.id] || section.id}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Section Index: {section.order}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{section.visible ? 'Visible' : 'Hidden'}</span>
                        <button
                          onClick={() => {
                            const newSections = config.homeSections?.map(s => 
                              s.id === section.id ? { ...s, visible: !s.visible } : s
                            );
                            setConfig({ ...config, homeSections: newSections });
                          }}
                          className={cn(
                            "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
                            section.visible ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            section.visible ? "translate-x-5" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h4 className={cn(sectionHeaderClasses, "mb-1")}><LayoutIcon size={18} /> Left Side Icon Rail Customization</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Toggle which icons show up in the left-hand panel of icons on the desktop layout (Max 12)</p>
                  </div>
                  {(() => {
                    const allOpts = [
                      'complaints', 'nodes', 'dealers_data', 'submit', 'map', 
                      'clients', 'top10', 'users', 'dealers', 'config', 
                      'settings', 'integrations', 'branding', 'billing', 'chat', 'monitor'
                    ];
                    const activeCount = allOpts.filter(id => !(config.hiddenTabs || []).includes(id)).length;
                    const isAtLimit = activeCount >= 12;

                    return (
                      <div className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider self-start sm:self-center shrink-0",
                        isAtLimit 
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-sm" 
                          : "bg-blue-600/10 text-blue-600 border-blue-500/20"
                      )}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full animate-pulse", isAtLimit ? "bg-amber-500" : "bg-blue-600")} />
                          Active Icons:
                        </div>
                        <span className="text-sm font-extrabold">{activeCount} / 12</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { id: 'complaints', label: 'Operations & Registry', category: 'Main Operations', icon: ClipboardList },
                    { id: 'nodes', label: 'Active Nodes Status', category: 'Main Operations', icon: Flame },
                    { id: 'dealers_data', label: 'Dealers Aggregation Data', category: 'Main Operations', icon: BarChart3 },
                    { id: 'submit', label: 'Complain Registration Form', category: 'Main Operations', icon: PlusSquare },
                    { id: 'map', label: 'Live Network Map', category: 'Main Operations', icon: MapIcon },
                    { id: 'clients', label: 'User Details / Directory', category: 'Analytics & Users', icon: Contact },
                    { id: 'top10', label: 'Top 10 Complainer Analytics', category: 'Analytics & Users', icon: TrendingUp },
                    { id: 'users', label: 'Operational Login Profiles', category: 'Analytics & Users', icon: Users },
                    { id: 'dealers', label: 'Partner / Dealer Directory', category: 'Configurations', icon: ShieldAlert },
                    { id: 'config', label: 'Workflow Config Settings', category: 'Configurations', icon: Settings },
                    { id: 'settings', label: 'Security & Access Protocol', category: 'System Settings', icon: Shield },
                    { id: 'integrations', label: 'Google Sheets Integration', category: 'System Settings', icon: CloudUpload },
                    { id: 'branding', label: 'Design Customization Desk', category: 'System Settings', icon: Palette },
                    { id: 'billing', label: 'Billing Mod / Billing Desk', category: 'Quick Actions & Extras', icon: CreditCard },
                    { id: 'chat', label: 'AI Help Chat Quick Action', category: 'Quick Actions & Extras', icon: MessageSquare },
                    { id: 'monitor', label: 'Monitor Quick Action', category: 'Quick Actions & Extras', icon: Activity },
                  ].map((item) => {
                    const isHidden = (config.hiddenTabs || []).includes(item.id);
                    const allOpts = [
                      'complaints', 'nodes', 'dealers_data', 'submit', 'map', 
                      'clients', 'top10', 'users', 'dealers', 'config', 
                      'settings', 'integrations', 'branding', 'billing', 'chat', 'monitor'
                    ];
                    const activeCount = allOpts.filter(id => !(config.hiddenTabs || []).includes(id)).length;

                    return (
                      <div 
                        key={item.id} 
                        className={cn(
                          "p-4 rounded-xl transition-all duration-300 border flex items-center justify-between gap-4",
                          !isHidden 
                            ? "bg-slate-50/50 dark:bg-slate-900/30 border-blue-500/10 dark:border-blue-500/5 shadow-[0_4px_12px_rgba(59,130,246,0.02)]" 
                            : "bg-slate-100/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-900 opacity-60 hover:opacity-80"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn(
                            "p-2.5 rounded-xl border shrink-0 mt-0.5",
                            !isHidden 
                              ? "bg-blue-600/10 text-blue-600 border-blue-500/20" 
                              : "bg-slate-200 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                          )}>
                            <item.icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[8px] font-black uppercase text-brand-accent tracking-wider block mb-0.5">{item.category}</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{item.label}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const currentHidden = config.hiddenTabs || [];
                            
                            if (isHidden) {
                              // Trying to activate (remove from hidden)
                              if (activeCount >= 12) {
                                toast.error("Limits of 12 active icons reached! Please disable another icon first to maintain layout beauty.");
                                return;
                              }
                              
                              const nextHidden = currentHidden.filter(id => id !== item.id);
                              setConfig({ ...config, hiddenTabs: nextHidden });
                              toast.success(`"${item.label}" icon enabled perfectly on left rail!`);
                            } else {
                              // Deactivating (add to hidden)
                              const nextHidden = [...currentHidden, item.id];
                              setConfig({ ...config, hiddenTabs: nextHidden });
                              toast.success(`"${item.label}" icon hidden from left rail.`);
                            }
                          }}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 cursor-pointer shadow-inner",
                            !isHidden ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-850"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 shadow-md",
                            !isHidden ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <h4 className={sectionHeaderClasses}><Activity size={18} /> Dashboard Summary Tile Renaming</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { id: 'total_registry', label: 'Total Registry' },
                    { id: 'pending_requests', label: 'Pending Requests' },
                    { id: 'new_connection_pending', label: 'New Connection' },
                    { id: 'in_operation', label: 'In Operation' },
                    { id: 'finalized', label: 'Finalized' },
                    { id: 'connection_complete', label: 'Connection Complete' }
                  ].map((stat) => (
                    <div key={stat.id} className="space-y-1.5">
                      <label className={labelClasses}>{stat.label}</label>
                      <input
                        type="text"
                        value={config.tabNames?.[stat.id] || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          tabNames: {
                            ...(config.tabNames || {}),
                            [stat.id]: e.target.value
                          }
                        })}
                        className={cn(inputClasses, "py-2.5 text-xs")}
                        placeholder={`Rename to...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="business-card p-8 bg-white dark:bg-slate-950">
                <h4 className={sectionHeaderClasses}><ClipboardList size={18} /> Global Navigation Tab Renaming</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {navTabDefinitions.map((tab) => (
                    <div key={tab.id} className="space-y-1.5">
                      <label className={labelClasses}>{tab.label} (Original)</label>
                      <input
                        type="text"
                        value={config.tabNames?.[tab.id] || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          tabNames: {
                            ...(config.tabNames || {}),
                            [tab.id]: e.target.value
                          }
                        })}
                        className={cn(inputClasses, "py-2.5 text-xs")}
                        placeholder={`Rename to...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeSubTab === 'terminology' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="business-card p-8 bg-white dark:bg-slate-950">
              <h4 className={sectionHeaderClasses}><Font size={18} /> Enterprise Semantic Matrix</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[
                  { id: 'admin', label: 'Admin Designation', icon: Shield },
                  { id: 'member', label: 'Member Role', icon: UserIcon },
                  { id: 'client', label: 'User Label', icon: Contact },
                  { id: 'complaint', label: 'Action Type', icon: ClipboardList },
                  { id: 'zone', label: 'Space Label', icon: MapPin },
                  { id: 'username', label: 'Log ID', icon: Key },
                  { id: 'description', label: 'Detail Field', icon: MessageSquare },
                  { id: 'number', label: 'Comm. ID', icon: Phone },
                  { id: 'pkg', label: 'Package Key', icon: Package },
                  { id: 'nearby', label: 'Anchor Label', icon: MapPinned },
                  { id: 'panel', label: 'Module Key', icon: Layers },
                  { id: 'dealer', label: 'Partner Label', icon: ShieldAlert },
                  { id: 'category', label: 'Type Key', icon: Settings2 },
                  { id: 'priority', label: 'Urgency Key', icon: Zap },
                  { id: 'status', label: 'Stage Key', icon: RefreshCw },
                  { id: 'chats', label: 'Messaging', icon: MessageSquare }
                ].map((field) => (
                  <div key={field.id} className="space-y-1.5 group">
                    <label className={cn(labelClasses, "flex items-center gap-2 group-hover:text-brand-accent transition-colors")}>
                       <field.icon size={10} />
                       {field.label}
                    </label>
                    <input
                      type="text"
                      value={config.customNames?.[field.id] || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        customNames: {
                          ...(config.customNames || {}),
                          [field.id]: e.target.value
                        }
                      })}
                      className={cn(inputClasses, "py-2.5 text-xs")}
                      placeholder={`e.g. ${field.label.split(' ')[0]}`}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Real-time Preview Engine */}
      <div className="lg:col-span-12 xl:col-span-4 space-y-6">
        <div className="sticky top-24 space-y-6">
          <div className="business-card bg-slate-50 dark:bg-slate-900 border-2 border-brand-accent/20">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global Preview Stream</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                  <button 
                    onClick={() => setPreviewDevice('mobile')}
                    className={cn(
                      "p-1.5 px-3 rounded-lg transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest",
                      previewDevice === 'mobile' ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                    )}
                    title="Android Simulation Mode"
                  >
                    <Smartphone size={12} /> Android
                  </button>
                  <button 
                    onClick={() => setPreviewDevice('desktop')}
                    className={cn(
                      "p-1.5 px-3 rounded-lg transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest",
                      previewDevice === 'desktop' ? "bg-white dark:bg-slate-800 text-brand-accent shadow-sm border border-slate-200 dark:border-slate-700" : "text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                    )}
                    title="Desktop Preview Mode"
                  >
                    <Monitor size={12} /> Desktop
                  </button>
                </div>
                <button 
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 dark:bg-brand-accent text-white hover:scale-105 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg"
                >
                  <ExternalLink size={14} /> View Popup
                </button>
              </div>
            </div>
            
            <div 
              className={cn(
                "p-6 transition-all relative overflow-hidden mx-auto scrollbar-hide",
                previewDevice === 'mobile' ? "max-w-[280px] aspect-[9/16] border-[8px] border-slate-800 rounded-[2.5rem] my-4 shadow-2xl overflow-y-auto" : "w-full"
              )}
              style={{ 
                fontFamily: config.fontFamily,
                borderRadius: previewDevice === 'mobile' ? '2.5rem' : (config.borderRadius === 'full' ? '2.5rem' : config.borderRadius === 'lg' ? '1.5rem' : config.borderRadius === 'sm' ? '0.5rem' : config.borderRadius === 'none' ? '0' : '1rem')
              }}
            >
              {previewDevice === 'mobile' && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-800 rounded-full z-50">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-slate-700 rounded-full" />
                </div>
              )}
              {/* Proper Website Showcase Layout */}
              <div className="absolute inset-0 bg-white dark:bg-slate-950 -z-10" />
              
              {/* Actual Layout Simulation */}
              <div className="scale-[0.8] origin-top h-[150%] w-[125%] -ml-[12.5%] -mt-10 overflow-hidden pointer-events-none">
                 <Layout
                    user={MOCK_USER}
                    users={[MOCK_USER]}
                    notifications={MOCK_NOTIFICATIONS}
                    branding={config}
                    isLoading={false}
                 >
                    <div className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: config.tabNames?.total_registry || 'Logs', val: '432', icon: FileSpreadsheet, color: config.accentColor },
                            { label: 'Active', val: '24', icon: Activity, color: '#10b981' }
                          ].map((stat, i) => (
                            <div key={'s-'+i} className={cn("p-4 bg-white dark:bg-slate-950", getCardPreviewStyle(config.cardStyle))}>
                               <div className="flex justify-between items-center mb-2">
                                  <stat.icon size={14} className="text-brand-accent" />
                                  <span className="text-sm font-black italic">{stat.val}</span>
                               </div>
                               <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{stat.label}</p>
                            </div>
                          ))}
                       </div>

                       <div className={cn("p-6 bg-white dark:bg-slate-950 h-32", getCardPreviewStyle(config.cardStyle))}>
                          <div className="flex justify-between items-center mb-4">
                             <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                             <TrendingUp size={12} className="text-emerald-500" />
                          </div>
                          <div className="flex items-end gap-1 h-12">
                             {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                               <div key={'h-'+i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: config.accentColor }} />
                             ))}
                          </div>
                       </div>

                       <div className={cn("p-6 bg-white dark:bg-slate-950", getCardPreviewStyle(config.cardStyle))}>
                          <div className="space-y-2">
                             {[1,2,3].map(i => (
                               <div key={'l-'+i} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <div className="flex-1 h-2 bg-slate-50 dark:bg-slate-900 rounded" />
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </Layout>
              </div>

              {/* Float bot preview */}
              {!config.hideBot && (
                <motion.div 
                  className="absolute z-50 pointer-events-none"
                  style={{ 
                    left: `${config.mascotPos.x}%`, 
                    top: `${config.mascotPos.y}%`
                  }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div 
                    className="p-3 rounded-2xl shadow-2xl text-white flex items-center justify-center border border-white/20"
                    style={{ 
                      backgroundColor: config.accentColor,
                      borderRadius: config.borderRadius === 'full' ? '1.5rem' : '1rem'
                    }}
                  >
                    <Bot size={20} />
                  </div>
                </motion.div>
              )}

              {/* Bot Preview Shadow Layer */}
              <div className="pointer-events-none absolute bottom-6 right-6">
                 <div className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300 dark:text-slate-700">Preview Mode Only</div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 shadow-inner">
            <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-5 pl-1">Operational Diagnostics</h5>
            <div className="space-y-4">
              {[
                { label: 'Cloud Sync Engine', status: 'Optimal', color: 'emerald' },
                { label: 'Identity Integrity', status: 'Verified', color: 'blue' },
                { label: 'Asset Propagation', status: 'Synchronized', color: 'brand-accent' }
              ].map((item, i) => (
                <div key={'diag-'+i} className="flex justify-between items-center group">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", item.color === 'emerald' ? 'bg-emerald-500' : 'bg-brand-accent')} />
                    <span className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest", 
                      item.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-brand-accent/10 text-brand-accent'
                    )}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
}

