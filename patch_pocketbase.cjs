const fs = require('fs');
let content = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const getBillingMonthsTarget = `  async getBillingMonths(dealerId: string = 'main') {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'main') {
        filter = \`dealer_id = "\${dealerId}"\`;
      }
      const records = await pb.collection('billing_months').getFullList({
        filter,
        sort: '-created'
      });
      return records.map(r => ({
        id: r.month_id,
        dealerId: r.dealer_id,
        rows: r.rows_data
      }));
    } catch (e) {
      console.warn("PB: Failed to fetch billing months", e);
      return [];
    }
  },`;

const getBillingMonthsReplacement = `  async getBillingMonths(dealerId: string = 'main') {
    try {
      let filter = '';
      if (dealerId && dealerId !== 'main') {
        filter = \`dealer_id = "\${dealerId}"\`;
      }
      
      let records = [];
      try {
         // Try fetching from users_data first (or user_data)
         records = await pb.collection('user_data').getFullList({ filter });
      } catch(e) {
         try {
           records = await pb.collection('users_data').getFullList({ filter });
         } catch(e2) {
           try {
             // fallback to billing_months if user_data doesn't exist
             const bmRecords = await pb.collection('billing_months').getFullList({ filter, sort: '-created' });
             return bmRecords.map(r => ({
               id: r.month_id,
               dealerId: r.dealer_id,
               rows: r.rows_data
             }));
           } catch(e3) {
             console.warn("PB: Failed to fetch any billing data from PB");
             return [];
           }
         }
      }

      // Group records by month_id if we fetched from user_data/users_data
      const monthMap = new Map();
      for (const r of records) {
        if (!r.month_id) continue;
        if (!monthMap.has(r.month_id)) {
          monthMap.set(r.month_id, {
            id: r.month_id,
            dealerId: r.dealer_id || dealerId,
            rows: []
          });
        }
        
        // Map back to the camelCase format expected by the frontend
        monthMap.get(r.month_id).rows.push({
          id: r.client_id || r.id,
          clientId: r.client_id || r.id,
          name: r.name || '',
          username: r.username || '',
          mobileNumber: r.mobile_number || '',
          area: r.area || '',
          rt: r.rt || '',
          baseAmount: r.base_amount || '',
          cr: r.cr || '',
          totalAmount: r.total_amount || '',
          billingDay: r.billing_day || '5',
          paymentReceived: r.payment_received || '',
          paymentStatus: r.payment_status || '',
          comments: r.comments || '',
          occ: r.occ || '',
          serNam: r.ser_nam || '',
          pkgDetails: r.pkg_details || '',
          sag: r.sag || '',
          lai: r.lai || '',
          connectionDate: r.connection_date || '',
          devicePrice: r.device_price || '',
          abl: r.abl || '',
          network: r.network || ''
        });
      }
      return Array.from(monthMap.values());
    } catch (e) {
      console.warn("PB: Failed to fetch billing months", e);
      return [];
    }
  },`;

content = content.replace(getBillingMonthsTarget, getBillingMonthsReplacement);

const syncBillingRowsTarget = `      const existingRows = await pb.collection('billing_rows').getFullList({ filter });
      
      // We will blindly map what is in rows to billing_rows.
      // To optimize, delete all and insert fresh.
      const BATCH_SIZE = 50;
      for (const ex of existingRows) {
        await pb.collection('billing_rows').delete(ex.id).catch(() => {});
      }

      for (const r of rows) {
        await pb.collection('billing_rows').create({`;

const syncBillingRowsReplacement = `      let collectionName = 'user_data';
      try {
        await pb.collection('user_data').getList(1, 1);
      } catch(e) {
        try {
          await pb.collection('users_data').getList(1, 1);
          collectionName = 'users_data';
        } catch(e2) {
          collectionName = 'billing_rows'; // fallback
        }
      }

      const existingRows = await pb.collection(collectionName).getFullList({ filter });
      
      for (const ex of existingRows) {
        await pb.collection(collectionName).delete(ex.id).catch(() => {});
      }

      for (const r of rows) {
        await pb.collection(collectionName).create({`;

content = content.replace(syncBillingRowsTarget, syncBillingRowsReplacement);
fs.writeFileSync('src/lib/pocketbaseService.ts', content);
console.log("Patched pocketbaseService");
