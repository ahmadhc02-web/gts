import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Zap,
  ShieldCheck,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Smartphone,
  Shield,
  QrCode,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ReminderLead, ReminderLeadItem, UserProfile } from '../types';
import {
  subscribeReminderLeads,
  subscribeReminderLeadItems,
  createReminderLead,
  updateReminderLead,
  deleteReminderLead,
  getReminderLeads
} from '../lib/supabaseService';
import { getTemplate, startReminderLead, buildReminderMessage, WhatsAppConnectPanel } from '../whatsapp_data';
import { getStatus } from '../whatsapp_data/whatsappApi';
import { cn } from '../lib/utils';

interface ConversationTabProps {
  isOpen: boolean;
  onClose: () => void;
  dealerId?: string;
  currentMonthId?: string;
  billingMonths?: any[];
  currentUser?: UserProfile;
  users?: UserProfile[];
  masterClients?: any[];
}

function formatDuration(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return '—';
  }
}

// Sub-component for individual lead row's expanded items
function LeadItemsList({
  leadId,
  defaultWaitSeconds = 30,
  isLeadRunning = false
}: {
  leadId: string;
  defaultWaitSeconds?: number;
  isLeadRunning?: boolean;
}) {
  const [items, setItems] = useState<ReminderLeadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Real-time 1-second ticking timer for live delay countdown/countup
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeReminderLeadItems(leadId, (freshItems) => {
      setItems(freshItems || []);
      setIsLoading(false);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [leadId]);

  if (isLoading && items.length === 0) {
    return (
      <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 size={16} className="animate-spin text-blue-500" />
        <span>Loading lead recipient items...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-slate-400 italic">
        No recipients registered in this lead.
      </div>
    );
  }

  const waitSec = Math.max(1, Number(defaultWaitSeconds) || 30);
  
  // Find index of the most recently processed item (sent or failed)
  const lastProcessedIdx = items.reduce(
    (last, item, idx) => (item.status === 'sent' || item.status === 'failed' ? idx : last),
    -1
  );

  // Check if there are remaining pending items in the queue
  const hasRemainingPending = items.some((item, idx) => idx > lastProcessedIdx && item.status === 'pending');

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-900/60 p-2 shadow-inner">
      <table className="w-full text-left text-xs font-lexend">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <th className="py-2 px-3">#</th>
            <th className="py-2 px-3">Customer Name</th>
            <th className="py-2 px-3">Customer ID</th>
            <th className="py-2 px-3">Mobile Number</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Sent Time</th>
            <th className="py-2 px-3">Wait Delay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
          {items.map((item, idx) => {
            const isSent = item.status === 'sent';
            const isFailed = item.status === 'failed';
            const isPending = item.status === 'pending';
            const isLastLeadItem = (idx === items.length - 1);

            const customerUsername = (
              item.username ||
              (item.message ? (item.message.match(/Your Id\.?\s*([^\s,]+)/i)?.[1] || null) : null) ||
              item.clientId ||
              '—'
            );

            // Calculate live elapsed seconds for the currently active item
            let elapsedSec = 1;
            if (item.sentAt) {
              const sentTime = new Date(item.sentAt).getTime();
              if (!isNaN(sentTime) && sentTime > 0) {
                elapsedSec = Math.max(1, Math.floor((now - sentTime) / 1000));
              }
            }

            // An item is actively counting delay if:
            // 1. The campaign is currently running
            // 2. There are still pending recipients left to process
            // 3. This item was the one most recently dispatched (sent or failed)
            const isActivelyCountingDelay = (
              isLeadRunning &&
              hasRemainingPending &&
              idx === lastProcessedIdx
            );

            const displayCount = Math.min(waitSec, elapsedSec);

            return (
              <tr
                key={item.id || idx}
                className="hover:bg-white/80 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-2 px-3 tabular-nums font-bold text-slate-400 font-lexend">
                  {item.sortOrder !== undefined ? item.sortOrder + 1 : idx + 1}
                </td>
                <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                  {item.name || 'Unnamed Client'}
                </td>
                <td className="py-2 px-3 tabular-nums font-bold text-blue-600 dark:text-blue-400 font-lexend">
                  {customerUsername}
                </td>
                <td className="py-2 px-3 tabular-nums text-slate-600 dark:text-slate-300 font-lexend">
                  {item.mobileNumber || '—'}
                </td>
                <td className="py-2 px-3">
                  {isSent && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>Sent</span>
                    </span>
                  )}
                  {isFailed && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 shadow-xs"
                      title={item.errorMessage || 'Send failure'}
                    >
                      <XCircle size={12} className="text-rose-500 shrink-0" />
                      <span className="truncate max-w-[170px] font-bold">
                        {item.errorMessage ? `Failed: ${item.errorMessage}` : 'Failed'}
                      </span>
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                      <Clock size={12} className="text-slate-400" />
                      <span>Pending</span>
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 tabular-nums text-[11px] text-slate-500 dark:text-slate-400 font-lexend">
                  {formatDateTime(item.sentAt)}
                </td>
                <td className="py-2 px-3 text-[11px]">
                  {isActivelyCountingDelay ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 tabular-nums font-bold shadow-xs font-lexend">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <span>
                        Waiting {displayCount}s / {waitSec}s
                        {elapsedSec >= waitSec ? " • Dispatching next..." : ""}
                      </span>
                    </div>
                  ) : (isSent || isFailed) ? (
                    isLastLeadItem ? (
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold font-lexend">
                        ✓ Completed (No delay on final)
                      </span>
                    ) : (
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold font-lexend">
                        ✓ Waited {item.waitSecondsAfter || waitSec}s
                      </span>
                    )
                  ) : isPending ? (
                    <span className="tabular-nums text-slate-400 dark:text-slate-500 italic font-lexend">
                      {waitSec}s delay set
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ConversationTab({
  isOpen,
  onClose,
  dealerId = 'main',
  currentMonthId,
  billingMonths = [],
  currentUser,
  users = [],
  masterClients = []
}: ConversationTabProps) {
  const [leads, setLeads] = useState<ReminderLead[]>([]);
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<ReminderLead | null>(null);

  // Determine if logged-in user is a Sub-Dealer (Multi-tenancy isolation)
  const isSubDealerUser = (currentUser?.role === 'dealer' || Boolean(currentUser?.dealerId && currentUser?.dealerId !== 'main') || Boolean(currentUser?.lineCode)) && currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin';
  const subDealerLineCode = (currentUser?.lineCode || '').trim();
  const subDealerDealerId = (currentUser?.role === 'dealer' ? currentUser?.uid : (currentUser?.dealerId || currentUser?.uid || 'main')).trim();

  // List of available VLAN channels for Admin channel switcher
  const availableVlanChannels = useMemo(() => {
    const list = [{ key: 'all', label: '🌐 ALL VLANS / GLOBAL GATEWAY', vlan: null, dealerId: 'main', company: 'Global Master' }];
    const dealerUsers = (users || []).filter(u => u.lineCode || u.role === 'dealer');
    dealerUsers.forEach(u => {
      const key = u.lineCode || u.uid;
      if (!list.some(item => item.key === key)) {
        list.push({
          key,
          label: `⚡ VLAN ${u.lineCode || 'DEALER'} • ${u.fullName || u.companyName || u.username}`,
          vlan: u.lineCode || null,
          dealerId: u.uid,
          company: u.companyName || u.fullName || u.username
        });
      }
    });
    return list;
  }, [users]);

  // Selected Channel state: Sub-dealers are strictly locked to their own VLAN
  const [selectedVlanChannel, setSelectedVlanChannel] = useState<string>(() => {
    if (isSubDealerUser) return subDealerLineCode || subDealerDealerId;
    return 'all';
  });

  // Effective Active Session Key for WhatsApp operations & QR Code
  const activeSessionKey = useMemo(() => {
    if (isSubDealerUser) {
      return subDealerLineCode || subDealerDealerId || 'main';
    }
    if (selectedVlanChannel && selectedVlanChannel !== 'all') {
      return selectedVlanChannel;
    }
    return 'main';
  }, [isSubDealerUser, subDealerLineCode, subDealerDealerId, selectedVlanChannel]);

  // Live WhatsApp device connection status for this active session
  const [whatsAppStatus, setWhatsAppStatus] = useState<{
    connected: boolean;
    phoneNumber: string | null;
    session?: string;
  } | null>(null);
  const [isConnectPanelOpen, setIsConnectPanelOpen] = useState(false);

  // Poll WhatsApp Status for activeSessionKey
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const checkStatus = async () => {
      try {
        const st = await getStatus(activeSessionKey);
        if (active && st) {
          setWhatsAppStatus(st);
        }
      } catch (_) {}
    };

    checkStatus();
    const timer = setInterval(checkStatus, 3500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isOpen, activeSessionKey]);

  // New Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadMode, setLeadMode] = useState<'automatic' | 'custom'>('automatic');
  const [dueDateStart, setDueDateStart] = useState('1');
  const [dueDateEnd, setDueDateEnd] = useState('10');
  const [waitSeconds, setWaitSeconds] = useState(30);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [selectedCustomUserIds, setSelectedCustomUserIds] = useState<string[]>([]);

  // Subscribe to reminder leads with live polling fallback
  useEffect(() => {
    if (!isOpen) return;

    const fetchFreshLeads = async () => {
      try {
        const fresh = await getReminderLeads(dealerId);
        if (fresh && fresh.length >= 0) {
          setLeads(fresh);
        }
      } catch (_) {}
    };

    fetchFreshLeads();

    const unsub = subscribeReminderLeads((data) => {
      setLeads(data || []);
    }, dealerId);

    // Active polling interval while tab is open to reflect background server progress
    const pollTimer = setInterval(fetchFreshLeads, 1500);

    return () => {
      if (unsub) unsub();
      clearInterval(pollTimer);
    };
  }, [isOpen, dealerId]);

  // Find active rows from billingMonths for live matching preview
  const activeMonthDoc = useMemo(() => {
    if (!currentMonthId || !billingMonths) return billingMonths?.[0] || null;
    return billingMonths.find(m => m.id === currentMonthId) || billingMonths?.[0] || null;
  }, [currentMonthId, billingMonths]);

  const activeRows = useMemo(() => {
    return Array.isArray(activeMonthDoc?.rows) ? activeMonthDoc.rows : [];
  }, [activeMonthDoc]);

  // STRICT MULTI-TENANCY: Scope rows strictly to the active VLAN / Sub-Dealer
  const scopedRows = useMemo(() => {
    if (!activeRows || activeRows.length === 0) return [];

    if (isSubDealerUser) {
      const userLc = subDealerLineCode.toLowerCase();
      const userDId = subDealerDealerId;
      return activeRows.filter((r: any) => {
        const rowLc = (r.lineCode || r.line_code || '').toLowerCase().trim();
        const rowDId = (r.dealerId || r.dealer_id || '').trim();
        if (userLc && rowLc === userLc) return true;
        if (userDId && rowDId === userDId) return true;
        return false;
      });
    }

    if (selectedVlanChannel && selectedVlanChannel !== 'all') {
      const channel = availableVlanChannels.find(c => c.key === selectedVlanChannel);
      const targetLc = (channel?.vlan || selectedVlanChannel).toLowerCase().trim();
      const targetDId = (channel?.dealerId || '').trim();
      return activeRows.filter((r: any) => {
        const rowLc = (r.lineCode || r.line_code || '').toLowerCase().trim();
        const rowDId = (r.dealerId || r.dealer_id || '').trim();
        if (targetLc && rowLc === targetLc) return true;
        if (targetDId && rowDId === targetDId) return true;
        return false;
      });
    }

    return activeRows;
  }, [activeRows, isSubDealerUser, subDealerLineCode, subDealerDealerId, selectedVlanChannel, availableVlanChannels]);

  // All strictly unpaid clients within this VLAN's scoped data
  const allUnpaidClients = useMemo(() => {
    if (!scopedRows || scopedRows.length === 0) return [];
    return scopedRows.filter((r: any) => {
      const phone = (r.mobileNumber || r.phone || r.number || '').trim();
      if (!phone) return false;
      const pStatus = String(r.paymentStatus || r.status || '').toLowerCase().trim();
      return pStatus === 'unpaid';
    });
  }, [scopedRows]);

  // Mode 1: Automatic Matched Clients (by Due Date Range)
  const autoMatchedClients = useMemo(() => {
    if (!allUnpaidClients || allUnpaidClients.length === 0) return [];
    const startNum = parseInt(dueDateStart, 10);
    const endNum = parseInt(dueDateEnd, 10);

    return allUnpaidClients.filter((r: any) => {
      const bDayStr = String(r.billingDay || r.dueDate || '').trim();
      const bDayNum = parseInt(bDayStr, 10);

      if (!isNaN(startNum) && !isNaN(endNum) && !isNaN(bDayNum)) {
        return bDayNum >= startNum && bDayNum <= endNum;
      }
      if (dueDateStart && dueDateEnd) {
        return bDayStr >= dueDateStart && bDayStr <= dueDateEnd;
      }
      return true;
    });
  }, [allUnpaidClients, dueDateStart, dueDateEnd]);

  // Mode 2: Custom Search Results (Search by Name / Username / Phone)
  const customFilteredClients = useMemo(() => {
    if (!allUnpaidClients || allUnpaidClients.length === 0) return [];
    if (!customSearchQuery.trim()) return allUnpaidClients;

    const q = customSearchQuery.toLowerCase().trim();
    return allUnpaidClients.filter((r: any) => {
      const name = String(r.name || '').toLowerCase();
      const uname = String(r.username || r.clientId || r.id || '').toLowerCase();
      const phone = String(r.mobileNumber || r.phone || r.number || '').toLowerCase();
      return name.includes(q) || uname.includes(q) || phone.includes(q);
    });
  }, [allUnpaidClients, customSearchQuery]);

  // Final Selected Clients for Campaign Execution
  const matchedClients = useMemo(() => {
    if (leadMode === 'automatic') {
      return autoMatchedClients;
    } else {
      return allUnpaidClients.filter((r: any) => {
        const id = String(r.id || r.clientId || r.username || '');
        return selectedCustomUserIds.includes(id);
      });
    }
  }, [leadMode, autoMatchedClients, allUnpaidClients, selectedCustomUserIds]);

  const toggleSelectCustomUser = (id: string) => {
    setSelectedCustomUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllCustomUsers = () => {
    if (selectedCustomUserIds.length === customFilteredClients.length) {
      setSelectedCustomUserIds([]);
    } else {
      const allIds = customFilteredClients.map((r: any) => String(r.id || r.clientId || r.username || ''));
      setSelectedCustomUserIds(allIds);
    }
  };

  // STRICT MULTI-TENANCY: Only show campaigns belonging to the active sub-dealer / VLAN
  const scopedLeads = useMemo(() => {
    if (isSubDealerUser) {
      const targetLc = subDealerLineCode.toLowerCase();
      const targetDId = subDealerDealerId;
      return leads.filter(l => {
        const leadLc = (l.lineCode || '').toLowerCase().trim();
        const leadDId = (l.dealerId || '').trim();
        if (targetLc && leadLc === targetLc) return true;
        if (targetDId && leadDId === targetDId) return true;
        return false;
      });
    }

    if (selectedVlanChannel && selectedVlanChannel !== 'all') {
      const channel = availableVlanChannels.find(c => c.key === selectedVlanChannel);
      const targetLc = (channel?.vlan || selectedVlanChannel).toLowerCase().trim();
      const targetDId = (channel?.dealerId || '').trim();
      return leads.filter(l => {
        const leadLc = (l.lineCode || '').toLowerCase().trim();
        const leadDId = (l.dealerId || '').trim();
        if (targetLc && leadLc === targetLc) return true;
        if (targetDId && leadDId === targetDId) return true;
        return false;
      });
    }

    return leads;
  }, [leads, isSubDealerUser, subDealerLineCode, subDealerDealerId, selectedVlanChannel, availableVlanChannels]);

  // Top 4 Summary Cards Metrics for Scoped Campaigns
  const summaryMetrics = useMemo(() => {
    const totalLeads = scopedLeads.length;
    let completedReminders = 0;
    let failedReminders = 0;
    let totalTimeMs = 0;

    scopedLeads.forEach(l => {
      completedReminders += Number(l.successCount || 0);
      failedReminders += Number(l.failedCount || 0);
      if (l.startedAt && l.completedAt) {
        const start = new Date(l.startedAt).getTime();
        const end = new Date(l.completedAt).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          totalTimeMs += (end - start);
        }
      }
    });

    return {
      totalLeads,
      completedReminders,
      failedReminders,
      totalTime: formatDuration(totalTimeMs)
    };
  }, [scopedLeads]);

  const toggleExpand = (leadId: string) => {
    setExpandedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const handleStartLead = async (leadId: string) => {
    // Optimistically show as running
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'running', startedAt: l.startedAt || new Date().toISOString() } : l));
    toast.info("Starting reminder lead campaign on server...");
    try {
      await startReminderLead(leadId);
      toast.success("Lead campaign running in background on server!");
      // Immediate fetch after trigger
      const fresh = await getReminderLeads(dealerId);
      if (fresh) setLeads(fresh);
    } catch (err: any) {
      toast.error(`Lead execution error: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteLead = (lead: ReminderLead) => {
    setLeadToDelete(lead);
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    const targetLead = leadToDelete;
    setDeletingLeadId(targetLead.id);
    setLeadToDelete(null);

    // Optimistically remove from list
    setLeads(prev => prev.filter(l => l.id !== targetLead.id));

    try {
      await deleteReminderLead(targetLead.id);
      toast.success(`Lead "${targetLead.name}" permanently deleted.`);
      const fresh = await getReminderLeads(dealerId);
      if (fresh) setLeads(fresh);
    } catch (err: any) {
      console.error("Delete lead error:", err);
      toast.error(`Failed to delete lead: ${err.message || 'Database error'}`);
      const fresh = await getReminderLeads(dealerId);
      if (fresh) setLeads(fresh);
    } finally {
      setDeletingLeadId(null);
    }
  };

  const handleCreateAndRunLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim()) {
      toast.error("Please enter a name for this Reminder Lead.");
      return;
    }
    if (matchedClients.length === 0) {
      toast.error("No customers matched with the selected due date range.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Fetch template to precompute message for each client
      let templateText = '';
      try {
        const templateData = await getTemplate();
        templateText = templateData?.template || '';
      } catch (e) {
        templateText = 'Dear {{name}}, this is a reminder that your internet bill of Rs. {{amount}} is due. Please clear it at your earliest convenience. Thank you.';
      }

      // 2. Precompute message for each matched client
      const items = matchedClients.map(c => {
        const pkg = (c as any).package || (c as any).pkgDetails || (c as any).pkg || (c as any).packageDetails || '';
        const builtMessage = buildReminderMessage(templateText, {
          name: c.name,
          amount: c.amount ?? c.totalAmount ?? c.baseAmount ?? 0,
          totalAmount: c.totalAmount ?? c.amount,
          baseAmount: c.baseAmount,
          username: c.username || c.clientId || c.id,
          clientId: c.clientId || c.id || c.username,
          paymentStatus: c.status || c.paymentStatus || 'unpaid',
          area: c.area,
          package: pkg,
          pkg: pkg
        });

        return {
          clientId: c.clientId || c.id || c.username || '',
          username: c.username || c.clientId || c.id || '',
          name: c.name || 'Customer',
          mobileNumber: (c.mobileNumber || c.phone || c.number || '').trim(),
          message: builtMessage
        };
      });

      // Determine target dealerId and lineCode based on active VLAN scoping
      const targetDealerId = isSubDealerUser
        ? subDealerDealerId
        : (selectedVlanChannel !== 'all' ? (availableVlanChannels.find(c => c.key === selectedVlanChannel)?.dealerId || selectedVlanChannel) : (dealerId || 'main'));

      const targetLineCode = isSubDealerUser
        ? (subDealerLineCode || undefined)
        : (selectedVlanChannel !== 'all' ? (availableVlanChannels.find(c => c.key === selectedVlanChannel)?.vlan || selectedVlanChannel) : undefined);

      // 3. Create lead and items in database tagged strictly to this VLAN/dealer
      const newLeadId = await createReminderLead({
        name: leadName.trim(),
        dealerId: targetDealerId || 'main',
        lineCode: targetLineCode || undefined,
        monthId: currentMonthId || activeMonthDoc?.id || 'UNKNOWN',
        dueDateStart,
        dueDateEnd,
        waitSeconds: Math.max(1, Number(waitSeconds) || 30),
        items
      });

      toast.success(`Created lead "${leadName}" with ${matchedClients.length} customers!`);
      setIsModalOpen(false);

      if (!whatsAppStatus?.connected) {
        toast.warning(`WhatsApp for session "${activeSessionKey}" is not connected yet. Scan QR code to start sending.`, { duration: 5000 });
      }

      // 4. Trigger server-side background campaign processor
      startReminderLead(newLeadId).then(() => {
        toast.success(`Lead "${leadName}" is now running on the server via session "${activeSessionKey}".`);
      }).catch((err) => {
        console.error("Server lead trigger error:", err);
        toast.error(`Lead created, but server failed to start: ${err.message || 'Unknown error'}`);
      });
    } catch (err: any) {
      toast.error(`Failed to create lead: ${err.message || 'Unknown database error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-font-lexend="true"
      className="fixed inset-0 z-[10000] w-screen h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-y-auto font-lexend antialiased"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            title="Return to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                <MessageSquare size={18} />
              </span>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                WhatsApp Conversation & Reminder Leads
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block truncate">
              Multi-Tenant VLAN isolated campaigns, separate WhatsApp QR authentication & automated customer reminders.
            </p>
          </div>
        </div>

        {/* Action Controls & Channel Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap ml-auto">
          {/* Sub-Dealer locked badge OR Admin VLAN Channel Switcher */}
          {isSubDealerUser ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-black uppercase tracking-wider shadow-xs">
              <Shield size={13} className="text-blue-500 shrink-0" />
              <span>VLAN: {subDealerLineCode || 'SUB-DEALER'}</span>
            </div>
          ) : (
            <div className="relative flex items-center">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500">
                <Layers size={13} />
              </div>
              <select
                value={selectedVlanChannel}
                onChange={(e) => setSelectedVlanChannel(e.target.value)}
                className="pl-7 pr-7 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer uppercase shadow-xs appearance-none"
                title="Switch Gateway & Campaign Scoping by Sub-Dealer VLAN"
              >
                {availableVlanChannels.map(c => (
                  <option key={`c-${c.key}`} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Dedicated WhatsApp Device & QR Connection Button */}
          <button
            onClick={() => setIsConnectPanelOpen(true)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border transition-all cursor-pointer shadow-xs",
              whatsAppStatus?.connected
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                : "bg-amber-50 dark:bg-amber-950/40 border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 animate-pulse"
            )}
            title={`WhatsApp Device Authentication for session "${activeSessionKey}"`}
          >
            <Smartphone size={15} className={whatsAppStatus?.connected ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} />
            <span className="font-mono">
              {whatsAppStatus?.connected
                ? `Live: +${whatsAppStatus.phoneNumber || 'Active'}`
                : `Link WhatsApp QR`}
            </span>
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              whatsAppStatus?.connected ? "bg-emerald-500 animate-ping" : "bg-amber-500"
            )} />
          </button>

          {/* Start New Lead Button */}
          <button
            onClick={() => {
              const channelLabel = isSubDealerUser ? `VLAN ${subDealerLineCode || 'Dealer'}` : (selectedVlanChannel !== 'all' ? `VLAN ${selectedVlanChannel}` : 'Global');
              setLeadName(`${channelLabel} Reminder - ${new Date().toLocaleDateString()}`);
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Start New Lead</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Top 4 Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Total Leads
              </span>
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Layers size={18} />
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-lexend">
              {summaryMetrics.totalLeads}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
              Registered bulk campaigns
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Completed Reminders
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
              </span>
            </div>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-lexend">
              {summaryMetrics.completedReminders.toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
              Successfully dispatched via WhatsApp
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Failed Reminders
              </span>
              <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <XCircle size={18} />
              </span>
            </div>
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400 font-lexend">
              {summaryMetrics.failedReminders.toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
              Network or mobile number issues
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Total Time
              </span>
              <span className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                <Clock size={18} />
              </span>
            </div>
            <div className="text-3xl font-black text-violet-600 dark:text-violet-400 font-lexend">
              {summaryMetrics.totalTime}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
              Total runtime elapsed across leads
            </p>
          </div>
        </section>

        {/* Leads Table Section */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Reminder Leads Registry</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                  {scopedLeads.length} campaigns
                </span>
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Click any lead row to inspect per-recipient progress, timestamps, and error messages.
              </p>
            </div>
          </div>

          {scopedLeads.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                <MessageSquare size={32} />
              </div>
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-300">
                No Reminder Leads For This VLAN Channel
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Click the "Start New Lead" button above to launch an automated WhatsApp reminder campaign for your subscribers under {isSubDealerUser ? `VLAN ${subDealerLineCode || 'Sub-Dealer'}` : (selectedVlanChannel !== 'all' ? `VLAN ${selectedVlanChannel}` : 'Global Network')}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-lexend">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th className="py-3 px-4">Lead Name</th>
                    <th className="py-3 px-3 text-center">Total Customers</th>
                    <th className="py-3 px-3 text-center text-emerald-600">Success</th>
                    <th className="py-3 px-3 text-center text-rose-600">Failed</th>
                    <th className="py-3 px-3 text-center">Total Sent</th>
                    <th className="py-3 px-3">Start Time</th>
                    <th className="py-3 px-3">End Time</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-4 min-w-[140px]">% Complete</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {scopedLeads.map((lead) => {
                    const isExpanded = expandedLeadIds.has(lead.id);
                    const isRunning = lead.status === 'running';
                    const isCompleted = lead.status === 'completed';
                    const isFailed = lead.status === 'failed';
                    const isPending = lead.status === 'pending';

                    const successCount = Number(lead.successCount || 0);
                    const failedCount = Number(lead.failedCount || 0);
                    const totalCount = Number(lead.totalCount || 0);
                    const processed = successCount + failedCount;
                    const pct = totalCount > 0 ? Math.min(100, Math.round((processed / totalCount) * 100)) : 0;

                    let durationStr = '—';
                    if (lead.startedAt && lead.completedAt) {
                      const start = new Date(lead.startedAt).getTime();
                      const end = new Date(lead.completedAt).getTime();
                      if (!isNaN(start) && !isNaN(end) && end >= start) {
                        durationStr = formatDuration(end - start);
                      }
                    } else if (isRunning && lead.startedAt) {
                      const start = new Date(lead.startedAt).getTime();
                      if (!isNaN(start)) {
                        durationStr = formatDuration(Date.now() - start);
                      }
                    }

                    return (
                      <React.Fragment key={lead.id}>
                        <tr
                          onClick={() => toggleExpand(lead.id)}
                          className={cn(
                            "cursor-pointer transition-colors duration-150 select-none",
                            isExpanded ? "bg-blue-50/30 dark:bg-blue-950/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                          )}
                        >
                          {/* Lead Name */}
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isRunning && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                              )}
                              <span>{lead.name}</span>
                              {lead.lineCode && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                                  ⚡ VLAN {lead.lineCode}
                                </span>
                              )}
                              {isRunning && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                                  Running
                                </span>
                              )}
                              {isCompleted && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                                  Done
                                </span>
                              )}
                              {isFailed && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                                  Failed
                                </span>
                              )}
                              {isPending && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                                  Pending
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Total Customers */}
                          <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-700 dark:text-slate-300 font-lexend text-xs">
                            {totalCount}
                          </td>

                          {/* Success */}
                          <td className="py-3 px-3 text-center tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400 font-lexend text-xs">
                            {successCount}
                          </td>

                          {/* Failed */}
                          <td className="py-3 px-3 text-center tabular-nums font-extrabold text-rose-600 dark:text-rose-400 font-lexend text-xs">
                            {failedCount}
                          </td>

                          {/* Total Processed */}
                          <td className="py-3 px-3 text-center tabular-nums font-bold text-slate-700 dark:text-slate-300 font-lexend text-xs">
                            {processed}
                          </td>

                          {/* Start Time */}
                          <td className="py-3 px-3 tabular-nums text-[11px] text-slate-500 dark:text-slate-400 font-lexend">
                            {formatDateTime(lead.startedAt)}
                          </td>

                          {/* End Time */}
                          <td className="py-3 px-3 tabular-nums text-[11px] font-lexend">
                            {isRunning ? (
                              <span className="text-blue-500 font-bold animate-pulse">● Running...</span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">{formatDateTime(lead.completedAt)}</span>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-3 tabular-nums text-[11px] text-slate-500 dark:text-slate-400 font-lexend">
                            {durationStr}
                          </td>

                          {/* % Complete */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[10px] font-black tabular-nums font-lexend">
                                <span className="text-slate-500">{processed}/{totalCount}</span>
                                <span className={pct === 100 ? "text-emerald-600 font-black" : "text-blue-600"}>{pct}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full transition-all duration-300 rounded-full",
                                    pct === 100
                                      ? "bg-emerald-500"
                                      : isFailed
                                      ? "bg-rose-500"
                                      : "bg-blue-600"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Start / Resume button for pending or interrupted leads */}
                              {(isPending || isRunning || (isFailed && processed < totalCount)) && (
                                <button
                                  type="button"
                                  onClick={() => handleStartLead(lead.id)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase flex items-center gap-1 border border-blue-200 dark:border-blue-900/40 cursor-pointer"
                                  title="Run or resume lead campaign on server"
                                >
                                  <Play size={11} className="fill-current" />
                                  <span>{isPending ? "Start" : "Resume"}</span>
                                </button>
                              )}

                              {/* Delete Lead Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteLead(lead)}
                                disabled={deletingLeadId === lead.id}
                                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer disabled:opacity-50"
                                title="Permanently Delete Lead"
                              >
                                {deletingLeadId === lead.id ? (
                                  <Loader2 size={12} className="animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleExpand(lead.id)}
                                className="p-1 rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Accordion Expanded Content */}
                        {isExpanded && (
                          <tr className="bg-slate-50/40 dark:bg-slate-950/20">
                            <td colSpan={10} className="p-4 pt-1 pb-4">
                              <LeadItemsList
                                leadId={lead.id}
                                defaultWaitSeconds={Number(lead.waitSeconds) || 30}
                                isLeadRunning={isRunning}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Start New Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            data-font-lexend="true"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative font-lexend"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <Zap size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Create WhatsApp Reminder Lead
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Target subscribers by due date and launch sequential reminders.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scoped VLAN & WhatsApp Gateway Banner */}
            <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-blue-500 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Target Gateway:
                </span>
                <span className="px-2 py-0.5 rounded-lg text-xs font-black uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  {isSubDealerUser ? `⚡ VLAN ${subDealerLineCode || 'DEALER'}` : (selectedVlanChannel === 'all' ? '🌐 ALL VLANS' : `⚡ VLAN ${selectedVlanChannel}`)}
                </span>
              </div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {scopedRows.length} clients in scope ({allUnpaidClients.length} unpaid)
              </div>
            </div>

            {/* Offline warning if this session is not linked */}
            {!whatsAppStatus?.connected && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">
                    WhatsApp for session "{activeSessionKey}" is not connected.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectPanelOpen(true)}
                  className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs"
                >
                  Link QR
                </button>
              </div>
            )}

            {/* Mode Selection Tabs (Automatic vs Custom) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-white/10 mb-1">
              <button
                type="button"
                onClick={() => setLeadMode('automatic')}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer",
                  leadMode === 'automatic'
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Zap size={15} />
                <span>Automatic</span>
              </button>
              <button
                type="button"
                onClick={() => setLeadMode('custom')}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer",
                  leadMode === 'custom'
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Users size={15} />
                <span>Custom</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAndRunLead} className="flex flex-col gap-4 mt-2">
              {/* Lead Name */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Campaign / Lead Name
                </label>
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. 5th Due Date Reminder - Batch 1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* MODE 1: Automatic Mode (Due Date Range) */}
              {leadMode === 'automatic' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Due Day (Start)
                    </label>
                    <input
                      type="text"
                      required
                      value={dueDateStart}
                      onChange={(e) => setDueDateStart(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Due Day (End)
                    </label>
                    <input
                      type="text"
                      required
                      value={dueDateEnd}
                      onChange={(e) => setDueDateEnd(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* MODE 2: Custom Mode (Live Search & Select Checkboxes) */}
              {leadMode === 'custom' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Search Unpaid Customers
                    </label>
                    <button
                      type="button"
                      onClick={toggleSelectAllCustomUsers}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {selectedCustomUserIds.length === customFilteredClients.length && customFilteredClients.length > 0
                        ? 'Deselect All'
                        : `Select All (${customFilteredClients.length})`}
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={customSearchQuery}
                      onChange={(e) => setCustomSearchQuery(e.target.value)}
                      placeholder="Search unpaid users by Name, Username or Phone..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Users List with Checkboxes */}
                  <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-950/50 divide-y divide-slate-100 dark:divide-white/5 space-y-1">
                    {customFilteredClients.length === 0 ? (
                      <div className="p-4 text-center text-xs font-bold text-slate-400">
                        No unpaid customers match your search.
                      </div>
                    ) : (
                      customFilteredClients.map((client: any) => {
                        const id = String(client.id || client.clientId || client.username || '');
                        const isSelected = selectedCustomUserIds.includes(id);
                        const phone = (client.mobileNumber || client.phone || client.number || '').trim();
                        const due = client.billingDay || client.dueDate || '—';

                        return (
                          <div
                            key={id}
                            onClick={() => toggleSelectCustomUser(id)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs select-none",
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={cn(
                                "p-1 rounded-md transition-colors",
                                isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                              )}>
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold truncate text-slate-900 dark:text-white">
                                  {client.name || 'Customer'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-lexend tabular-nums">
                                  {client.username || client.clientId} • {phone}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-lexend tabular-nums px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              Due: {due}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Wait Time */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Wait time after each message (seconds)
                  </label>
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1">
                    {[15, 30, 45, 60, 90, 120].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setWaitSeconds(sec)}
                        className={cn(
                          "px-2 py-0.5 text-[9px] font-black rounded-md transition-all cursor-pointer",
                          waitSeconds === sec
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        )}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  required
                  value={waitSeconds === 0 ? '' : waitSeconds}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setWaitSeconds(0);
                    } else {
                      const parsed = parseInt(val, 10);
                      if (!isNaN(parsed)) {
                        setWaitSeconds(Math.max(1, parsed));
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!waitSeconds || waitSeconds < 1) {
                      setWaitSeconds(30);
                    }
                  }}
                  placeholder="Enter seconds (e.g. 30, 45, 60...)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none font-lexend tabular-nums"
                />
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1 block">
                  Recommended: 30–60 seconds to prevent WhatsApp account rate limits.
                </span>
              </div>

              {/* Permanent Unpaid-Only Rule Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Locked Rule:</strong> Only strictly <strong>UNPAID</strong> customers will be targeted. Customers with <strong>TDC</strong>, <strong>DC</strong>, or <strong>PAID</strong> status are permanently excluded.
                </span>
              </div>

              {/* Live Preview of Matched Customers */}
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-xs font-bold">
                <span className="text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                  <Users size={15} className="text-blue-500" />
                  <span>Matching Customers with WhatsApp:</span>
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full font-black text-xs",
                  matchedClients.length > 0
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
                )}>
                  {matchedClients.length} clients
                </span>
              </div>

              {/* Confirm & Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10 mt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={matchedClients.length === 0 || !leadName.trim() || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Creating Lead...</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} className="fill-current" />
                      <span>Confirm & Launch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Lead Confirmation Modal */}
      <AnimatePresence>
        {leadToDelete && (
          <div className="fixed inset-0 z-[10050] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              data-font-lexend="true"
              className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative font-lexend"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <Trash2 size={22} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Permanently Delete Lead?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/5 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Lead Name:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{leadToDelete.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Total Recipients:</span>
                  <span className="font-lexend tabular-nums font-bold text-slate-700 dark:text-slate-300">{leadToDelete.totalCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Status:</span>
                  <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {leadToDelete.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mb-6">
                The lead campaign record and all associated recipient dispatch logs will be permanently deleted from the database.
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setLeadToDelete(null)}
                  disabled={deletingLeadId === leadToDelete.id}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteLead}
                  disabled={deletingLeadId === leadToDelete.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deletingLeadId === leadToDelete.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp Device Authentication & QR Modal */}
      <AnimatePresence>
        {isConnectPanelOpen && (
          <div className="fixed inset-0 z-[12000] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl my-auto"
            >
              <WhatsAppConnectPanel
                onClose={() => {
                  setIsConnectPanelOpen(false);
                  getStatus(activeSessionKey).then((st) => st && setWhatsAppStatus(st));
                }}
                currentUser={currentUser}
                initialSessionKey={activeSessionKey}
                users={users}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
