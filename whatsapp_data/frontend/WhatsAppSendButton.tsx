import React, { useState, useEffect } from 'react';
import { MessageCircle, Loader2, Check, X } from 'lucide-react';
import { getStatus, getTemplate, sendMessage } from './whatsappApi';
import { toast } from 'sonner';

interface Props {
  name: string;
  mobileNumber: string;
  totalAmount?: number | string;
  baseAmount?: number | string;
  paymentStatus: string;
  username: string;
  area: string;
}

// Simple in-memory cache to avoid refetching template and status on every button render
let cachedTemplate: string | null = null;
let cachedStatus: boolean | null = null;

export default function WhatsAppSendButton({ name, mobileNumber, totalAmount, baseAmount, paymentStatus, username, area }: Props) {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isReady, setIsReady] = useState(cachedStatus === true);

  useEffect(() => {
    // Check if connected when component mounts if we don't know yet
    if (cachedStatus === null) {
      getStatus().then(data => {
        cachedStatus = data.connected;
        setIsReady(data.connected);
      }).catch(() => {});
    }
    if (cachedTemplate === null) {
      getTemplate().then(data => {
        cachedTemplate = data.template;
      }).catch(() => {});
    }
  }, []);

  const handleSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mobileNumber) {
      toast.error('No mobile number available for this client');
      return;
    }
    if (!cachedStatus) {
      toast.error('WhatsApp is not connected. Please connect it from the top menu first.');
      return;
    }

    setIsSending(true);
    setStatus('idle');

    try {
      // Ensure we have the template
      if (!cachedTemplate) {
        const data = await getTemplate();
        cachedTemplate = data.template;
      }

      // Build message
      let message = cachedTemplate || '';
      message = message.replace(/\{\{name\}\}/g, name || 'Customer');
      message = message.replace(/\{\{amount\}\}/g, (totalAmount ?? baseAmount ?? 0).toString());
      message = message.replace(/\{\{username\}\}/g, username || 'N/A');
      message = message.replace(/\{\{status\}\}/g, (paymentStatus || 'unpaid').toUpperCase());
      message = message.replace(/\{\{area\}\}/g, area || 'N/A');

      await sendMessage(mobileNumber, message);
      
      setStatus('success');
      toast.success(`Message sent to ${name}`);
    } catch (err: any) {
      console.error('Failed to send WhatsApp message', err);
      setStatus('error');
      toast.error(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  if (!isReady && status === 'idle') {
    return (
      <button
        type="button"
        title="WhatsApp not connected"
        onClick={(e) => {
          e.stopPropagation();
          toast.info('Please connect WhatsApp from the top menu first.');
        }}
        className="p-1 text-slate-300 dark:text-slate-600 cursor-not-allowed rounded transition-colors"
      >
        <MessageCircle size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isSending || status !== 'idle'}
      onClick={handleSend}
      className={`p-1 rounded transition-colors disabled:opacity-80 relative flex items-center justify-center ${
        status === 'success' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' :
        status === 'error' ? 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' :
        'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'
      }`}
      title="Send WhatsApp Reminder"
    >
      {isSending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : status === 'success' ? (
        <Check size={14} />
      ) : status === 'error' ? (
        <X size={14} />
      ) : (
        <MessageCircle size={14} />
      )}
    </button>
  );
}
