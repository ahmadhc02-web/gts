import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  PhoneCall,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  RotateCcw
} from 'lucide-react';
import { RadiusUser } from './radiusStore';
import { VertixLandscapeCard } from './ui';
import { SkVertixSubView } from '../skeleton/Skeleton';

interface SmsViewProps {
  store: any;
  isDarkMode: boolean;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  initialSelectedUserIds?: string[];
}

type RecipientGroup = 'All' | 'Active' | 'Expired' | 'Expiring' | 'Disabled' | 'Selected';
type Channel = 'WhatsApp' | 'SMS';
type TemplateKey = 'expiry' | 'payment' | 'maintenance' | 'custom';

interface SentHistoryItem {
  id: string;
  time: string;
  recipientName: string;
  recipientMobile: string;
  channel: Channel;
  message: string;
  status: 'Delivered' | 'Sent';
}

const TEMPLATES: Record<TemplateKey, { name: string; text: string }> = {
  expiry: {
    name: 'Expiry Reminder',
    text: 'Dear {name}, your broadband package {package} will expire on {expiry}. Please renew your account to ensure uninterrupted service. - Green Pro',
  },
  payment: {
    name: 'Payment Confirmation',
    text: 'Hello {name}, your bill payment for {package} has been successfully credited. Account {username} is active until {expiry}. Thank you for choosing Green Pro!',
  },
  maintenance: {
    name: 'Network Maintenance Notice',
    text: 'Dear {name}, Green Pro will undergo scheduled fiber maintenance tonight between 02:00 AM and 04:00 AM. Internet access may experience brief downtime.',
  },
  custom: {
    name: 'Custom Template',
    text: 'Hello {name}, this is an important notification regarding your Green Pro broadband account {username}.',
  },
};

export default function SmsView({
  store,
  isDarkMode,
  addToast,
  initialSelectedUserIds = [],
}: SmsViewProps) {
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [recipientGroup, setRecipientGroup] = useState<RecipientGroup>('Expiring');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [templateKey, setTemplateKey] = useState<TemplateKey>('expiry');
  const [messageTemplate, setMessageTemplate] = useState<string>(TEMPLATES.expiry.text);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0); // 0 to 100
  const [sentCount, setSentCount] = useState(0);
  const [sentHistory, setSentHistory] = useState<SentHistoryItem[]>(() => [
    {
      id: 'h-1',
      time: '10:30 AM',
      recipientName: 'Muhammad Ali Khan',
      recipientMobile: '0300-8472910',
      channel: 'WhatsApp',
      message: 'Hello Muhammad Ali Khan, your bill payment for Turbo 20M has been credited.',
      status: 'Delivered',
    },
    {
      id: 'h-2',
      time: '09:15 AM',
      recipientName: 'Usman Tariq',
      recipientMobile: '0321-4920183',
      channel: 'SMS',
      message: 'Dear Usman Tariq, your broadband package Ultra Fiber 50M will expire on 2026-11-04.',
      status: 'Delivered',
    },
  ]);

  // Expiry threshold from store
  const reminderDays = store.settings?.expiryReminderDays || 3;

  // Filter users by group
  const groupUsers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inDays = new Date(today);
    inDays.setDate(inDays.getDate() + reminderDays);

    return (store.users as RadiusUser[]).filter(u => {
      if (recipientGroup === 'All') return true;
      if (recipientGroup === 'Active') return u.status === 'Active';
      if (recipientGroup === 'Expired') return u.status === 'Expired';
      if (recipientGroup === 'Disabled') return u.status === 'Disabled';
      if (recipientGroup === 'Selected') return initialSelectedUserIds.includes(u.id);
      if (recipientGroup === 'Expiring') {
        if (u.status !== 'Active') return false;
        const exp = new Date(u.expiry);
        return !isNaN(exp.getTime()) && exp >= today && exp <= inDays;
      }
      return true;
    });
  }, [store.users, recipientGroup, initialSelectedUserIds, reminderDays]);

  // Synchronize selection when group changes
  useEffect(() => {
    setSelectedUserIds(groupUsers.map(u => u.id));
  }, [groupUsers]);

  // Toggle user checkbox
  const toggleUserCheck = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === groupUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(groupUsers.map(u => u.id));
    }
  };

  // Switch template
  const handleTemplateChange = (key: TemplateKey) => {
    setTemplateKey(key);
    setMessageTemplate(TEMPLATES[key].text);
  };

  // Preview user (the first selected user, or first group user, or placeholder)
  const previewUser: RadiusUser = useMemo(() => {
    const found = store.users.find((u: RadiusUser) => selectedUserIds.includes(u.id));
    if (found) return found;
    if (groupUsers.length > 0) return groupUsers[0];
    return {
      id: 'mock',
      name: 'Ahmed Tariq',
      username: 'ahmed_subscriber',
      mobile: '0300-1234567',
      package: 'Turbo 20M',
      expiry: new Date().toISOString().split('T')[0],
      status: 'Active',
      online: true,
      ip: '10.10.1.5',
      dataUsedGB: 120,
      balance: 0,
    };
  }, [selectedUserIds, groupUsers, store.users]);

  // Computed preview text with placeholders replaced
  const previewMessage = useMemo(() => {
    return messageTemplate
      .replace(/\{name\}/g, previewUser.name || previewUser.username)
      .replace(/\{username\}/g, previewUser.username)
      .replace(/\{package\}/g, previewUser.package)
      .replace(/\{expiry\}/g, previewUser.expiry);
  }, [messageTemplate, previewUser]);

  // Characters and parts
  const charCount = messageTemplate.length;
  const smsParts = Math.max(1, Math.ceil(charCount / 160));

  // Send Simulation
  const handleSendDispatch = async () => {
    if (selectedUserIds.length === 0) {
      addToast('Please select at least one recipient', 'error');
      return;
    }

    const recipients = store.users.filter((u: RadiusUser) => selectedUserIds.includes(u.id));
    setIsSending(true);
    setSendProgress(0);
    setSentCount(0);

    const newHistoryEntries: SentHistoryItem[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const u = recipients[i];
      // Simulate 150ms per message
      await new Promise(res => setTimeout(res, 150));

      const processedMsg = messageTemplate
        .replace(/\{name\}/g, u.name)
        .replace(/\{username\}/g, u.username)
        .replace(/\{package\}/g, u.package)
        .replace(/\{expiry\}/g, u.expiry);

      newHistoryEntries.push({
        id: `msg-${Date.now()}-${i}`,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        recipientName: u.name,
        recipientMobile: u.mobile,
        channel,
        message: processedMsg,
        status: 'Delivered',
      });

      setSendProgress(Math.round(((i + 1) / recipients.length) * 100));
      setSentCount(i + 1);
    }

    // Record in local sent history
    setSentHistory(prev => [...newHistoryEntries.reverse(), ...prev]);

    // Append audit log
    store.addLog(
      'SMS-DISPATCH',
      `Sent ${channel} alert to ${recipients.length} users: [${TEMPLATES[templateKey].name}]`,
      'admin'
    );

    setIsSending(false);
    addToast(`Sent to ${recipients.length} users successfully!`, 'success');
  };

  if (store.isLoading && store.users.length === 0) {
    return <SkVertixSubView mode="table" />;
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* 4 LANDSCAPE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <VertixLandscapeCard
          title="Dispatched Today"
          value={sentHistory.length + sentCount}
          badge="Delivered"
          badgeColor="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
          icon={Send}
          iconBgGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Delivery Gateway"
          value="99.8%"
          badge="Direct Pipe"
          badgeColor="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          icon={Smartphone}
          iconBgGradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Subscribers Reachable"
          value={store.users.length}
          badge="With Mobile"
          badgeColor="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800"
          icon={Users}
          iconBgGradient="bg-gradient-to-br from-purple-500 to-violet-600"
          isDarkMode={isDarkMode}
        />
        <VertixLandscapeCard
          title="Active Gateway"
          value={channel}
          badge={channel === 'WhatsApp' ? 'Cloud API' : 'GSM SMPP'}
          badgeColor={
            channel === 'WhatsApp'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
          }
          icon={MessageSquare}
          iconBgGradient={
            channel === 'WhatsApp'
              ? 'bg-gradient-to-br from-emerald-600 to-green-500'
              : 'bg-gradient-to-br from-[#1f6b4f] to-[#0b3d2e]'
          }
          isDarkMode={isDarkMode}
        />
      </div>

      {/* DISPATCH CENTER: 2-PANEL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT PANEL: RECIPIENTS PICKER (lg:col-span-5) */}
        <div
          className={`lg:col-span-5 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col justify-between transition-all ${
            isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2d3648]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-black text-sm sm:text-base text-black dark:text-white">
                  1. Choose Recipients
                </h3>
              </div>
              <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                {selectedUserIds.length} of {groupUsers.length} Selected
              </span>
            </div>

            {/* Recipient Group Filter Buttons */}
            <div className="flex flex-wrap gap-1.5 my-3">
              {(
                [
                  { id: 'Expiring', label: `Expiring (${reminderDays}d)` },
                  { id: 'Active', label: 'Active Users' },
                  { id: 'Expired', label: 'Expired' },
                  { id: 'All', label: 'All Users' },
                  { id: 'Disabled', label: 'Disabled' },
                ] as const
              ).map(grp => (
                <button
                  key={grp.id}
                  onClick={() => setRecipientGroup(grp.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    recipientGroup === grp.id
                      ? isDarkMode
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-white'
                      : isDarkMode
                      ? 'bg-[#10141b] border border-[#333d52] text-slate-200 hover:text-white'
                      : 'bg-slate-100 border border-slate-300 text-slate-900 hover:text-black'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>

            {/* Select All Toggle Bar */}
            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-[#10141b] border border-slate-200 dark:border-[#2d3648] text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 cursor-pointer hover:text-black dark:hover:text-white"
              >
                {selectedUserIds.length === groupUsers.length && groupUsers.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
                <span>Select All ({groupUsers.length})</span>
              </button>
              <span className="text-[11px] text-slate-600 dark:text-slate-300">Mobile validated</span>
            </div>

            {/* Scrollable Recipient Checkbox List */}
            <div className="max-h-[300px] overflow-y-auto no-scrollbar space-y-1.5 pr-1">
              {groupUsers.length === 0 ? (
                <div className="py-8 text-center text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-xs">No subscribers matching group</p>
                </div>
              ) : (
                groupUsers.map(u => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserCheck(u.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        isChecked
                          ? isDarkMode
                            ? 'bg-emerald-950/40 border-emerald-500/70'
                            : 'bg-emerald-50/80 border-emerald-400'
                          : isDarkMode
                          ? 'bg-[#10141b] border-[#2d3648] hover:border-[#3d4a63]'
                          : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="text-emerald-600 dark:text-emerald-400 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-950 dark:text-white truncate">
                            {u.name} <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">({u.username})</span>
                          </p>
                          <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate flex items-center gap-2">
                            <span>{u.mobile}</span>
                            <span>•</span>
                            <span className="font-sans font-bold text-emerald-700 dark:text-emerald-300">
                              Exp: {u.expiry}
                            </span>
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#161b24] border border-slate-300 dark:border-[#333d52] text-slate-900 dark:text-slate-100 shrink-0">
                        {u.package}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#2d3648] text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between font-medium">
            <span>Recipient filter active</span>
            <span className="font-bold text-slate-950 dark:text-white">
              {selectedUserIds.length} users targeted
            </span>
          </div>
        </div>

        {/* RIGHT PANEL: MESSAGE COMPOSER & LIVE PREVIEW (lg:col-span-7) */}
        <div
          className={`lg:col-span-7 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col justify-between transition-all ${
            isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
          }`}
        >
          <div className="space-y-4">
            {/* Header: Channel Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2d3648]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-black text-sm sm:text-base text-black dark:text-white">
                  2. Message & Delivery Channel
                </h3>
              </div>

              {/* Channel Selector */}
              <div
                className={`flex items-center p-1 rounded-full border shadow-xs ${
                  isDarkMode ? 'bg-[#10141b] border-[#333d52]' : 'bg-slate-100 border-slate-300'
                }`}
              >
                <button
                  onClick={() => setChannel('WhatsApp')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                    channel === 'WhatsApp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => setChannel('SMS')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                    channel === 'SMS'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>GSM SMS</span>
                </button>
              </div>
            </div>

            {/* Template Dropdown / Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Select Template</span>
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Supported placeholders: {'{name}'}, {'{username}'}, {'{expiry}'}, {'{package}'}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TEMPLATES) as TemplateKey[]).map(tKey => (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => handleTemplateChange(tKey)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer truncate ${
                      templateKey === tKey
                        ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                        : isDarkMode
                        ? 'border-[#333d52] bg-[#10141b] text-slate-200 hover:text-white hover:border-[#475569]'
                        : 'border-slate-300 bg-slate-50 text-slate-900 hover:border-slate-400'
                    }`}
                  >
                    {TEMPLATES[tKey].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Editor Box */}
            <div className="space-y-1.5">
              <textarea
                rows={3}
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                placeholder="Type your message with dynamic variables..."
                className={`w-full p-3 text-xs rounded-2xl border outline-none font-medium transition-all ${
                  isDarkMode
                    ? 'bg-[#10141b] border-[#333d52] text-white placeholder-slate-400 focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500 focus:border-emerald-500'
                }`}
              />
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                <span>
                  {charCount} characters ({smsParts} SMS {smsParts > 1 ? 'parts' : 'part'})
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  Channel: {channel} (No carrier charges)
                </span>
              </div>
            </div>

            {/* LIVE MESSAGE PREVIEW */}
            <div
              className={`p-3.5 rounded-2xl border ${
                isDarkMode ? 'bg-[#10141b] border-[#2d3648]' : 'bg-slate-100 border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Live Preview for {previewUser.name} ({previewUser.mobile})
                </span>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{channel} Preview</span>
              </div>
              <div
                className={`p-3 rounded-xl text-xs font-medium border leading-relaxed ${
                  channel === 'WhatsApp'
                    ? isDarkMode
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-100'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : isDarkMode
                    ? 'bg-[#161b24] border-[#333d52] text-slate-100'
                    : 'bg-white border-slate-300 text-slate-950'
                }`}
              >
                {previewMessage}
              </div>
            </div>

            {/* SEND PROGRESS BAR */}
            {isSending && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                  <span>Dispatching to subscriber gateway...</span>
                  <span>{sendProgress}% ({sentCount}/{selectedUserIds.length})</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-[#10141b] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${sendProgress}%` }}
                    className="h-full bg-gradient-to-r from-[#1f6b4f] to-[#14532d] transition-all duration-150"
                  />
                </div>
              </div>
            )}
          </div>

          {/* DISPATCH ACTION BUTTON */}
          <div className="pt-4 border-t border-slate-200 dark:border-[#2d3648] flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSending || selectedUserIds.length === 0}
              onClick={handleSendDispatch}
              className={`px-6 py-2.5 rounded-full font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                isSending || selectedUserIds.length === 0
                  ? 'bg-slate-400 text-slate-100 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#1f6b4f] via-[#14532d] to-[#0b3d2e] hover:from-[#18553f] hover:to-[#0f4424] text-white shadow-emerald-950/20 active:scale-95'
              }`}
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-bounce' : ''}`} />
              <span>
                {isSending
                  ? `Sending (${sentCount}/${selectedUserIds.length})...`
                  : `Send ${channel} to ${selectedUserIds.length} Users`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* DISPATCH HISTORY TABLE */}
      <div
        className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col transition-all w-full min-w-0 ${
          isDarkMode ? 'bg-[#161b24] border-[#2d3648]' : 'bg-white border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-[#2d3648]">
          <div>
            <h3 className="text-base font-black text-black dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <span>Recent Message Dispatch Logs</span>
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Transmission records and gateway delivery acknowledgments
            </p>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {sentHistory.length} messages logged
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar vertix-scroll-xy w-full border border-slate-300 dark:border-[#2d3648] rounded-2xl mt-3">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b text-[10px] font-extrabold uppercase ${
                  isDarkMode ? 'bg-[#10141b] border-[#2d3648] text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
                }`}
              >
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Message Preview</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d3648] font-medium">
              {sentHistory.map(item => (
                <tr key={item.id} className="hover:bg-emerald-50/50 dark:hover:bg-[#1c2330] transition-colors">
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono text-[11px]">
                    {item.time}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <p className="font-extrabold text-slate-950 dark:text-white">{item.recipientName}</p>
                    <p className="text-[10px] font-mono text-slate-700 dark:text-slate-300">{item.recipientMobile}</p>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-block bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                      {item.channel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-900 dark:text-slate-100 text-xs max-w-sm truncate">
                    {item.message}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{item.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
