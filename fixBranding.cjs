const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

// Inject the shared branding manager at the top level
const sharedManager = `
const globalBrandingSubscribers = new Set<(payload: any) => void>();
let globalBrandingChannel: any = null;

function ensureBrandingChannel() {
   if (!globalBrandingChannel) {
       globalBrandingChannel = supabase.channel('global_branding_config_shared');
       globalBrandingChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'branding_config' }, (payload: any) => {
           globalBrandingSubscribers.forEach(cb => cb(payload));
       }).subscribe();
   }
}

function releaseBrandingChannel(cb: (payload: any) => void) {
   globalBrandingSubscribers.delete(cb);
   if (globalBrandingSubscribers.size === 0 && globalBrandingChannel) {
      supabase.removeChannel(globalBrandingChannel);
      globalBrandingChannel = null;
   }
}
`;

code = code.replace(/function sanitize<T>\(obj: T\): T {/, sharedManager + '\nfunction sanitize<T>(obj: T): T {');

// 1. subscribeConfig
code = code.replace(
  /const configChannelId = [\s\S]*?\.subscribe\(\);\s*return \(\) => {\s*supabase\.removeChannel\(channel\);\s*};/g,
  `ensureBrandingChannel();
    const handleUpdate = () => fetchConfig();
    globalBrandingSubscribers.add(handleUpdate);

    return () => {
      releaseBrandingChannel(handleUpdate);
    };`
);

// 2. subscribeBranding
code = code.replace(
  /const brandingChannelId = [\s\S]*?\.subscribe\(\);\s*return \(\) => {\s*supabase\.removeChannel\(channel\);\s*};/g,
  `ensureBrandingChannel();
    const handleUpdate = (payload: any) => {
      if (!payload.new || payload.new.id === 'branding') fetchBranding();
    };
    globalBrandingSubscribers.add(handleUpdate);

    return () => {
      releaseBrandingChannel(handleUpdate);
    };`
);

// 3. subscribeBillingMonths
code = code.replace(
  /const billingMonthsChannelId = [\s\S]*?\.subscribe\(\);\s*return \(\) => {\s*supabase\.removeChannel\(channel\);\s*};/g,
  `ensureBrandingChannel();
    const handleUpdate = () => fetchBillingMonths();
    globalBrandingSubscribers.add(handleUpdate);

    return () => {
      releaseBrandingChannel(handleUpdate);
    };`
);

// 4. subscribeTranslations
code = code.replace(
  /const translationsChannelId = [\s\S]*?\.subscribe\(\);\s*return \(\) => {\s*supabase\.removeChannel\(channel\);\s*};/g,
  `ensureBrandingChannel();
    const handleUpdate = (payload: any) => {
      if (!payload.new || payload.new.id === 'translations') fetchTranslations();
    };
    globalBrandingSubscribers.add(handleUpdate);

    return () => {
      releaseBrandingChannel(handleUpdate);
    };`
);

// 5. subscribeLedgerFolders
code = code.replace(
  /const channelId = `ledger_folders_\${docId}[\s\S]*?\.subscribe\(\);\s*return \(\) => {\s*supabase\.removeChannel\(channel\);\s*};/g,
  `ensureBrandingChannel();
    const handleUpdate = (payload: any) => {
      if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new && payload.new.id === docId) {
        if (payload.new.dashboard_subtext) {
          try { callback(JSON.parse(payload.new.dashboard_subtext)); } catch(e){}
        }
      }
    };
    globalBrandingSubscribers.add(handleUpdate);

    return () => {
      releaseBrandingChannel(handleUpdate);
    };`
);

// 6. subscribeLedgerSheetFolderMap
code = code.replace(
  /const channelId = `ledger_sheet_map_\${docId}[\s\S]*?\.subscribe\(\);\s*return \(\) => {\s*supabase\.removeChannel\(channel\);\s*};/g,
  `ensureBrandingChannel();
    const handleUpdate = (payload: any) => {
      if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new && payload.new.id === docId) {
        if (payload.new.dashboard_subtext) {
          try { callback(JSON.parse(payload.new.dashboard_subtext)); } catch(e){}
        }
      }
    };
    globalBrandingSubscribers.add(handleUpdate);

    return () => {
      releaseBrandingChannel(handleUpdate);
    };`
);

fs.writeFileSync('src/lib/firebaseService.ts', code);
console.log("Done patching branding config channels");
