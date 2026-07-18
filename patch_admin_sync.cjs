const fs = require('fs');
let content = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

if (!content.includes('syncAllToPocketBase')) {
  // We can add it into the AdminPanel component
  const syncFunc = `
  const [isSyncingPB, setIsSyncingPB] = useState(false);
  const syncAllToPocketBase = async () => {
    if (!confirm("This will synchronize all data (Billing, Ledger, Complaints) from the Cloud to your custom Server/PocketBase. Proceed?")) return;
    setIsSyncingPB(true);
    try {
      toast.loading("Syncing Billing Months...", { id: "pb-sync" });
      const bMonths = await firebaseService.getBillingMonths(activeDealerId);
      for (const m of bMonths) {
        if (m.rows) {
          await pocketbaseService.saveBillingMonth(m.id, m.rows, currentUser?.username || 'admin', activeDealerId || 'main').catch(()=>{});
        }
      }
      
      toast.loading("Syncing Complaints...", { id: "pb-sync" });
      const comps = await firebaseService.getComplaints(activeDealerId);
      for (const c of comps) {
        await pocketbaseService.saveComplaint(c, activeDealerId || 'main').catch(()=>{});
      }
      
      toast.success("Sync completed successfully! Your Server/PocketBase is up to date.");
    } catch(e) {
      console.error(e);
      toast.error("Sync failed. Check console for details.");
    } finally {
      setIsSyncingPB(false);
      toast.dismiss("pb-sync");
    }
  };
`;
  content = content.replace('const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);', 'const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n' + syncFunc);
  
  // Now add the button in the Settings tab
  const btnCode = `
          {/* PB Sync Button */}
          <div className="bg-white/5 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 mt-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <Database className="text-emerald-500" size={20} />
              Server/PocketBase Synchronization
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Manually push all records (Billing, Complaints, etc.) to your connected Hetzner PocketBase server.
              Note: New records and updates will automatically sync, use this only to upload existing data.
            </p>
            <button
              onClick={syncAllToPocketBase}
              disabled={isSyncingPB}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSyncingPB ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              {isSyncingPB ? "Syncing..." : "Sync All Data Now"}
            </button>
          </div>
`;
  content = content.replace('{/* Global Configurations Section */}', btnCode + '\n          {/* Global Configurations Section */}');
  
  fs.writeFileSync('src/components/AdminPanel.tsx', content);
  console.log('AdminPanel patched');
}
