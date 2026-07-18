const fs = require('fs');
let content = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

const target = `        if (error) throw error;
        
        let months: any[] = [];
        if (data) {
          months = data
            .filter((item: any) => {
              // If dealerId is passed, exactly match the prefix
              if (dealerId) return item.id.startsWith(prefix);
              // If dealerId is NOT passed, filter out dealer-specific billing months
              // Dealer specific months have format: billing_month_DEALERID_MONTHID
              const suffix = item.id.substring('billing_month_'.length);
              return !suffix.includes('_');
            })
            .map((item: any) => {
              let rows = [];
              try { rows = JSON.parse(item.dashboard_subtext); } catch (e) {}
              return {
                id: dealerId 
                ? item.id.replace(\`billing_month_\${dealerId}_\`, '')
                : item.id.replace('billing_month_', ''),
                dealerId: dealerId || 'main',
                rows: rows
              };
            });
        }
        
        callback(months);`;

const replacement = `        if (error) throw error;
        
        let months: any[] = [];
        if (data) {
          months = data
            .filter((item: any) => {
              if (dealerId) return item.id.startsWith(prefix);
              const suffix = item.id.substring('billing_month_'.length);
              return !suffix.includes('_');
            })
            .map((item: any) => {
              let rows = [];
              try { rows = JSON.parse(item.dashboard_subtext); } catch (e) {}
              return {
                id: dealerId 
                ? item.id.replace(\`billing_month_\${dealerId}_\`, '')
                : item.id.replace('billing_month_', ''),
                dealerId: dealerId || 'main',
                rows: rows
              };
            });
        }
        
        // Merge PocketBase Billing Months
        if (import.meta.env.VITE_USE_POCKETBASE === 'true' || true) {
           try {
             const pbMonths = await pocketbaseService.getBillingMonths(dealerId);
             if (pbMonths.length > 0) {
                // simple merge by ID, preferring PB data if it exists
                const existingIds = new Set(months.map(m => m.id));
                for (const pm of pbMonths) {
                   if (existingIds.has(pm.id)) {
                      const idx = months.findIndex(m => m.id === pm.id);
                      months[idx] = pm;
                   } else {
                      months.push(pm);
                   }
                }
             }
           } catch(e) {}
        }
        
        callback(months);`;

content = content.replace(target, replacement);
fs.writeFileSync('src/lib/firebaseService.ts', content);
console.log("Patched subscribeBillingMonths");
