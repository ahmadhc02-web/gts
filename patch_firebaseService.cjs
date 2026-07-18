const fs = require('fs');
let content = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

// Patch getAppConfig
const getAppConfigTarget = `  getAppConfig: async (tenantId: string = 'main'): Promise<any> => {
    const docId = tenantId === 'main' ? 'app_main_config' : \`app_config_\${tenantId}\`;
    try {
      const { data, error } = await supabase
        .from('branding_config')
        .select('*')
        .eq('id', docId)
        .maybeSingle();`;

const getAppConfigReplacement = `  getAppConfig: async (tenantId: string = 'main'): Promise<any> => {
    const docId = tenantId === 'main' ? 'app_main_config' : \`app_config_\${tenantId}\`;
    try {
      // Setup base config from PB or empty
      let pbConfig = {};
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
        } catch(e) { console.warn("PB fetch failed", e); }
      }

      const { data, error } = await supabase
        .from('branding_config')
        .select('*')
        .eq('id', docId)
        .maybeSingle();`;

content = content.replace(getAppConfigTarget, getAppConfigReplacement);

// We need to also merge the pbConfig into the returned config of getAppConfig.
const getAppConfigReturnTarget = `      if (data && data.dashboard_subtext) {
        const parsed = JSON.parse(data.dashboard_subtext);
        return parsed;
      }`;
      
const getAppConfigReturnReplacement = `      if (data && data.dashboard_subtext) {
        const parsed = JSON.parse(data.dashboard_subtext);
        return { ...parsed, ...pbConfig }; // PB config overrides or merges
      }
      if (Object.keys(pbConfig).length > 0) return pbConfig;`;
      
content = content.replace(getAppConfigReturnTarget, getAppConfigReturnReplacement);

fs.writeFileSync('src/lib/firebaseService.ts', content);
console.log("Patched getAppConfig");
