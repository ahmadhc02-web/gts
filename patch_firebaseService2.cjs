const fs = require('fs');
let content = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

const subscribeConfigTarget = `    const fetchConfig = async () => {
      try {
        let currentConfig: any = null;
        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', docId)
          .maybeSingle();`;

const subscribeConfigReplacement = `    const fetchConfig = async () => {
      try {
        let currentConfig: any = null;
        let pbConfig: any = {};
        if (import.meta.env.VITE_USE_POCKETBASE === 'true' || true) {
          try {
            const [cat, stat, prio, zone] = await Promise.all([
              pocketbaseService.getCategories(tenantId),
              pocketbaseService.getStatuses(tenantId),
              pocketbaseService.getPriorities(tenantId),
              pocketbaseService.getZones(tenantId)
            ]);
            if (cat.length || stat.length || prio.length || zone.length) {
              pbConfig = { categories: cat, statuses: stat, priorities: prio, zones: zone };
            }
          } catch(e) {}
        }

        const { data, error } = await supabase
          .from('branding_config')
          .select('*')
          .eq('id', docId)
          .maybeSingle();`;

content = content.replace(subscribeConfigTarget, subscribeConfigReplacement);

const subscribeConfigReturnTarget = `        if (data && data.dashboard_subtext) {
          currentConfig = JSON.parse(data.dashboard_subtext);
        }`;

const subscribeConfigReturnReplacement = `        if (data && data.dashboard_subtext) {
          currentConfig = JSON.parse(data.dashboard_subtext);
        }
        
        if (Object.keys(pbConfig).length > 0) {
          currentConfig = { ...(currentConfig || {}), ...pbConfig };
        }`;

content = content.replace(subscribeConfigReturnTarget, subscribeConfigReturnReplacement);

fs.writeFileSync('src/lib/firebaseService.ts', content);
console.log("Patched subscribeConfig");
