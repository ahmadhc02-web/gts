import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Complaint } from '../types';
import { supabase } from '../lib/supabase';
import { supabaseService } from '../lib/supabaseService';
import { ShieldAlert, ArrowLeft, Eye, TrendingUp, User, Hash, Loader2 } from 'lucide-react';
import ComplaintList from './ComplaintList';
import EntrySheet from './EntrySheet';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface DealerDataViewerProps {
  users: UserProfile[];
  appConfig: any;
  branding: any;
  currentUser: UserProfile;
}

// Convert from DB format to App format (copying logic from supabaseService)
const fromDb = (table: string, r: any): any => {
  if (table === 'complaints') {
    return {
      id: r.id,
      ticketNumber: r.ticket_number,
      userId: r.user_id,
      name: r.name,
      address: r.address,
      mobile: r.mobile,
      router: r.router,
      details: r.details,
      priority: r.priority,
      status: r.status,
      category: r.category || 'General',
      zone: r.zone || 'Other',
      dealerId: r.dealer_id,
      createdAt: new Date(r.created_at).getTime(),
      assignedTo: r.assigned_to,
      remarks: r.remarks ? (typeof r.remarks === 'string' ? JSON.parse(r.remarks) : r.remarks) : [],
      locationUrl: r.location_url,
      images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : []
    };
  }
  return r;
};

export default function DealerDataViewer({ users, appConfig, branding, currentUser }: DealerDataViewerProps) {
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [billingMonths, setBillingMonths] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'complaints' | 'billing'>('complaints');
  const [loading, setLoading] = useState(false);

  const selectedDealer = useMemo(() => users.find(u => u.uid === selectedDealerId), [selectedDealerId, users]);

  useEffect(() => {
    if (!selectedDealerId || !selectedDealer) return;
    
    setLoading(true);
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const lineCode = selectedDealer.lineCode;
        
        // Fetch complaints
        let cQuery = supabase.from('complaints').select('*');
        if (lineCode) cQuery = cQuery.eq('line_code', lineCode);
        else cQuery = cQuery.or('line_code.is.null,line_code.eq.');
        
        const { data: cData } = await cQuery;
        
        // Fetch billing months
        // But we actually need full billing months with rows_data.
        // Let's use the explicit bypassLineCodeFilter we just added!
        const bMonths = await supabaseService.getBillingMonths(
          selectedDealerId, 
          lineCode || true // true means empty/no line code filtering, but wait, 'true' means bypass filter entirely. If we want empty, we should pass false.
        );
        // Wait, supabaseService.getBillingMonths(dealerId, bypassFilter)
        // If bypassFilter === true, no filter.
        // If bypassFilter === 'string', filter by that string.
        // If bypassFilter === false, filter by activeLineCode OR empty if activeLineCode is false.
        // So passing `lineCode || false` is exactly what we want! Because if the dealer has no lineCode, we pass false, and since activeLineCode is false (we are admin), it will filter to empty lineCode! Wait, no. If we pass `false`, and activeLineCode is false, it uses `query.or('line_code.is.null,line_code.eq.')`. Which perfectly gets the empty line_code ones!
        // But wait! This dealer might be 'main' dealer. If we pass false, it filters to empty lineCode. That's correct!
        
        // Actually for billing months, we don't have to duplicate the logic, we can just call getBillingMonths with bypassLineCodeFilter.
        // Let's just fetch them directly to be safe and avoid touching global cache.
        
        let bmQuery = supabase.from('billing_months').select('*');
        if (lineCode) bmQuery = bmQuery.eq('line_code', lineCode);
        else bmQuery = bmQuery.or('line_code.is.null,line_code.eq.');
        
        if (selectedDealerId !== 'main') bmQuery = bmQuery.eq('dealer_id', selectedDealerId);
        
        const { data: bmData } = await bmQuery;
        
        if (isMounted) {
          if (cData) setComplaints(cData.map(r => fromDb('complaints', r)));
          
          if (bmData) {
             const parsedMonths = bmData.map(em => {
                let rows = [];
                try {
                  const rowsData = em.rows_data ?? em.rows;
                  rows = typeof rowsData === 'string' ? JSON.parse(rowsData) : rowsData;
                  if (rows && !Array.isArray(rows) && (rows as any).rows) rows = (rows as any).rows;
                } catch (e) {}
                return {
                  id: em.month_id,
                  dealerId: em.dealer_id,
                  lineCode: em.line_code,
                  rows: rows,
                  hasAuthoritativeRowsData: true,
                  updatedAt: new Date(em.updated_at).getTime(),
                  createdAt: new Date(em.created_at).getTime(),
                  updatedBy: em.updated_by
                };
             });
             setBillingMonths(parsedMonths);
          }
        }
      } catch (err) {
        console.error("Error fetching dealer data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchData();
    return () => { isMounted = false; };
  }, [selectedDealerId, selectedDealer]);

  if (!selectedDealerId) {
    const dealers = users.filter(u => u.role === 'dealer');
    return (
      <div className="space-y-8 animate-in fade-in duration-300 text-left">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Dealer Data Viewer</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              Read-only view of specific dealer operations and billing
            </p>
          </div>
        </div>

        {dealers.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-[var(--neu-border)] rounded-3xl">
            <ShieldAlert size={32} className="mx-auto text-slate-300 mb-4" />
            <p className="text-sm font-bold text-slate-500 uppercase">No dealers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dealers.map(dealer => (
              <div 
                key={dealer.uid}
                onClick={() => setSelectedDealerId(dealer.uid)}
                className="p-6 bg-[var(--neu-surface)] border border-slate-200 dark:border-white/10 rounded-2xl cursor-pointer hover:border-blue-500 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User size={20} />
                  </div>
                  {dealer.lineCode && (
                    <span className="px-2 py-1 bg-[var(--neu-surface)] rounded text-[10px] font-black uppercase text-slate-500 border border-[var(--neu-border)]">
                      {dealer.lineCode}
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-black uppercase tracking-tight truncate text-slate-900 dark:text-white">{dealer.username}</h4>
                <p className="text-xs text-slate-500 font-bold uppercase truncate">{dealer.email || 'No Email'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setSelectedDealerId(null); setComplaints([]); setBillingMonths([]); }}
            className="w-10 h-10 flex items-center justify-center bg-[var(--neu-surface)] rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Read-Only Mode</p>
            </div>
            <h3 className="text-lg font-black uppercase text-amber-900 dark:text-amber-100">
              Viewing Data For: {selectedDealer?.username}
            </h3>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('complaints')}
            className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer", activeTab === 'complaints' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-200 dark:bg-slate-900')}
          >
            Complaints
          </button>
          <button 
            onClick={() => setActiveTab('billing')}
            className={cn("px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer", activeTab === 'billing' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-200 dark:bg-slate-900')}
          >
            Billing
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      ) : (
        <div className="read-only-wrapper opacity-95">
          <style>{`
            .read-only-wrapper input, 
            .read-only-wrapper button, 
            .read-only-wrapper select, 
            .read-only-wrapper textarea {
              pointer-events: none !important;
              opacity: 0.6 !important;
            }
            .read-only-wrapper [contenteditable="true"] {
              pointer-events: none !important;
              user-select: none !important;
            }
            /* Allow the Back button to work, so scope carefully if needed. Wait, back button is outside this wrapper! */
          `}</style>
          {activeTab === 'complaints' ? (
            <div className="bg-[var(--neu-surface)] p-4 rounded-xl border border-slate-200 dark:border-white/10">
               <ComplaintList 
                 complaints={complaints}
                 users={users}
                 onDelete={async () => {}}
                 onStatusChange={async () => {}}
                 onUpdateRemarks={async () => {}}
                 onEdit={async () => {}}
                 isAdmin={true}
                 currentUser={currentUser}
                 appConfig={appConfig}
                 branding={branding}
                 readOnly={true}
               />
            </div>
          ) : (
            <div className="bg-[var(--neu-surface)] p-4 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden relative">
               <div className="absolute inset-0 z-[100] bg-transparent" /> 
               {/* Invisible shield to block any remaining clicks */}
               {billingMonths.length > 0 ? (
                 <EntrySheet 
                   isOpen={true}
                   onClose={() => {}}
                   currentUser={currentUser}
                   activeRows={billingMonths[0]?.rows || []}
                   currentMonthId={billingMonths[0]?.id || ''}
                   isBillingUnlocked={false}
                   appConfig={appConfig}
                   billingMonths={billingMonths}
                   setBillingMonths={() => {}}
                   savingMonthIds={new Set()}
                 />
               ) : (
                 <div className="p-12 text-center text-slate-500 font-bold uppercase text-sm">No billing data found.</div>
               )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
