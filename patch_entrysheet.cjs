const fs = require('fs');

const content = fs.readFileSync('src/components/EntrySheet.tsx', 'utf8');

const start_marker = "      // Step 3: Run connected recovery sheet matching/updating using the updated/linked sheet rows";
const end_marker = "      // --- INSTANT OPTIMISTIC UI STATE SYNCHRONIZATION ---";

if (content.includes(start_marker) && content.includes(end_marker)) {
    const before = content.split(start_marker)[0];
    const after = content.split(end_marker)[1];
    
    const new_logic = `      // Step 3: Run connected recovery sheet matching/updating using the updated/linked sheet rows
      // We perform a full recalculation: we gather ALL sheets connected to the affected months,
      // reset the base rows to unpaid, and sum up all entries. This ensures strong connection,
      // and guarantees that removing an entry from the A4 sheet will correctly un-pay the recovery row.
      const targetMonthIdsToUpdate = new Set<string>();
      sheetPayloads.forEach(sp => {
        const tFolderId = sp.folderId;
        if (tFolderId) {
          const fObj = folders.find(f => f.id === tFolderId);
          const tMonthId = (folderMonthMap[tFolderId] || fObj?.connectedMonthId) || currentMonthId;
          if (tMonthId) targetMonthIdsToUpdate.add(tMonthId);
        }
      });

      for (const targetMonthId of Array.from(targetMonthIdsToUpdate)) {
        if (!targetMonthId) continue;
        
        let targetMonthRows: any[] = accumulatedBillingMonths[targetMonthId] || [];
        
        if (targetMonthRows.length === 0) {
          const targetMonthDoc = billingMonths.find(m => m.id === targetMonthId);
          targetMonthRows = targetMonthDoc?.rows || [];
        }

        // REQUIREMENT 1: Direct network call straight to Supabase before assuming month is empty
        if (targetMonthRows.length === 0) {
          try {
            const directMonth = await pocketbaseService.getBillingMonthDirect(targetMonthId, activeDealerId || 'main');
            if (directMonth && Array.isArray(directMonth.rows) && directMonth.rows.length > 0) {
              targetMonthRows = directMonth.rows;
            }
          } catch (err) {
            console.warn("Direct DB fetch for target month failed:", err);
          }
        }

        if (targetMonthRows.length === 0 && clients && clients.length > 0) {
          targetMonthRows = clients.map((c: any) => {
            let cleanBase = 1000;
            if (c.pkgDetails) {
              const digitsMatch = c.pkgDetails.match(/\\d{3,5}/g);
              if (digitsMatch && digitsMatch.length > 0) {
                cleanBase = parseInt(digitsMatch[digitsMatch.length - 1], 10);
              } else {
                const lowDigits = c.pkgDetails.replace(/[^0-9]/g, '');
                if (lowDigits && lowDigits.length >= 3) {
                  cleanBase = parseInt(lowDigits, 10);
                }
              }
            }
            return {
              id: c.id,
              clientId: c.id,
              name: c.name,
              username: c.username,
              mobileNumber: c.mobileNumber || c.number || '',
              area: c.area || '',
              rt: c.rt || '',
              baseAmount: cleanBase,
              cr: Number(c.cr) || 0,
              totalAmount: cleanBase + (Number(c.cr) || 0),
              billingDay: '5',
              paymentReceived: 0,
              paymentStatus: 'unpaid',
              comments: '',
              occ: '',
              pkgDetails: c.pkgDetails || '',
              sag: '',
              lai: '',
              connectionDate: '',
              devicePrice: 0,
              abl: 0
            };
          });
        }

        try {
          // Identify all folders connected to this month
          const monthFolderIds = new Set<string>();
          folders.forEach(f => {
            const tId = folderMonthMap[f.id] || f.connectedMonthId;
            if (tId === targetMonthId) monthFolderIds.add(f.id);
          });
          sheetPayloads.forEach(sp => {
            const tFolderId = sp.folderId;
            const fObj = folders.find(f => f.id === tFolderId);
            const tId = (tFolderId ? (folderMonthMap[tFolderId] || fObj?.connectedMonthId) : undefined) || currentMonthId;
            if (tId === targetMonthId && tFolderId) monthFolderIds.add(tFolderId);
          });

          // Collect ALL relevant sheets (historical + currently saving payloads)
          const allRelevantSheetsMap = new Map<string, any>();
          ledgerHistory.forEach(sh => {
            const fId = updatedFolderMap[sh.id] || sh.folderId;
            if (monthFolderIds.has(fId)) {
              allRelevantSheetsMap.set(sh.id, sh);
            }
          });
          sheetPayloads.forEach(sp => {
            const fId = sp.folderId;
            if (monthFolderIds.has(fId)) {
              allRelevantSheetsMap.set(sp.id, sp); // Overwrite historical with new unsaved state
            }
          });

          // PREPARE: Reset all base rows to 0 to recalculate from scratch
          // We filter out excluded names (like "bank") so they don't count as clients
          const baseRecalculatedRows = targetMonthRows.filter((br: any) => !isExcludedName(br.name)).map((row: any) => ({
            ...row,
            paymentReceived: 0,
            paymentStatus: 'unpaid'
          }));

          let updatedCount = 0;
          if (!accumulatedChangedIndicesMap[targetMonthId]) {
            accumulatedChangedIndicesMap[targetMonthId] = new Set<number>();
          }
          
          const batchPaymentsMap = new Map<string, number>();

          // ITERATE OVER ALL SHEETS TO SUM PAYMENTS
          for (const sh of allRelevantSheetsMap.values()) {
            const allSheetRows = Array.isArray(sh.table1Rows) ? sh.table1Rows : [];
            allSheetRows.forEach((r: any) => {
              const amountVal = Number(r.amount) || 0;
              const amountStr = String(r.amount || '').trim().toUpperCase();
              const isStatusString = ['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL', 'EXTRA'].includes(amountStr);
              
              const hasId = Boolean(r.cId && String(r.cId).trim());
              const hasName = Boolean(r.name && String(r.name).trim());
              
              if (!hasId && !hasName) return;
              if (isExcludedName(r.name)) return;

              const client = clients.find((c: any) => c.id === r.clientId);

              let matchedIdx = -1;
              if (r.clientId || r.clientUsername) {
                const searchClientId = (r.clientId || '').trim().toLowerCase();
                const searchClientUsername = (r.clientUsername || '').trim().toLowerCase();
                matchedIdx = baseRecalculatedRows.findIndex((br: any) => 
                  (searchClientId && br.clientId && String(br.clientId).trim().toLowerCase() === searchClientId) ||
                  (searchClientUsername && br.username && String(br.username).trim().toLowerCase() === searchClientUsername) ||
                  (searchClientUsername && br.clientId && String(br.clientId).trim().toLowerCase() === searchClientUsername)
                );
              }
              if (matchedIdx === -1 && hasId) {
                const searchId = String(r.cId).trim().toLowerCase();
                matchedIdx = baseRecalculatedRows.findIndex((br: any) => 
                  (br.clientId && String(br.clientId).trim().toLowerCase() === searchId) ||
                  (br.username && String(br.username).trim().toLowerCase() === searchId) ||
                  (br.id && String(br.id).trim().toLowerCase() === searchId)
                );
              }
              if (matchedIdx === -1 && hasName) {
                const searchName = String(r.name).trim().toLowerCase();
                matchedIdx = baseRecalculatedRows.findIndex((br: any) => 
                  br.name && String(br.name).trim().toLowerCase() === searchName
                );
              }

              if (matchedIdx !== -1) {
                const row = baseRecalculatedRows[matchedIdx];
                const clientKey = row.id || row.clientId || row.username || \`idx_\${matchedIdx}\`;
                
                const savedOrigCr = row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0);
                const base = parseFloat(row.baseAmount || 0);
                const totalAmount = base + savedOrigCr;
                
                let newPaymentReceived = 0;
                let finalStatus = 'partial';
                
                if (isStatusString) {
                  finalStatus = amountStr.toLowerCase();
                  newPaymentReceived = finalStatus === 'paid' ? totalAmount : 0;
                  // If there's already a batch payment, A4 status overrides it entirely for simplicity
                  batchPaymentsMap.set(clientKey, newPaymentReceived);
                } else {
                  const prevBatchPayment = batchPaymentsMap.get(clientKey) || 0;
                  newPaymentReceived = prevBatchPayment + amountVal;
                  
                  batchPaymentsMap.set(clientKey, newPaymentReceived);

                  if (r.status) {
                    finalStatus = r.status.toLowerCase();
                  } else if (row.name === 'Unspecified Entry' || r.name === 'Unspecified Entry') {
                    finalStatus = 'extra';
                  } else if (newPaymentReceived === 0) {
                    finalStatus = 'unpaid';
                  } else if (newPaymentReceived >= totalAmount) {
                    finalStatus = 'paid';
                  }
                }

                baseRecalculatedRows[matchedIdx] = {
                  ...row,
                  clientId: client?.id || row.clientId || r.clientId || '',
                  username: client?.username || row.username || r.clientUsername || '',
                  _originalCr: savedOrigCr,
                  cr: savedOrigCr,
                  totalAmount: totalAmount,
                  paymentReceived: newPaymentReceived,
                  paymentStatus: finalStatus
                };

              } else {
                if (client && (isExcludedName(client.name) || isExcludedName(client.username))) return;
                
                const baseAmount = client ? (Number(client.baseAmount) || 0) : amountVal;
                const cr = client ? (Number(client.cr) || 0) : 0;
                const totalAmount = baseAmount + cr;
                
                let finalStatus = 'partial';
                if (isStatusString) {
                  finalStatus = amountStr.toLowerCase();
                } else if (r.status) {
                  finalStatus = r.status.toLowerCase();
                } else if (r.name === 'Unspecified Entry' || (!r.cId && (!r.name || r.name === 'Unspecified Entry'))) {
                  finalStatus = 'extra';
                } else if (amountVal === 0) {
                  finalStatus = 'unpaid';
                } else if (amountVal >= totalAmount) {
                  finalStatus = 'paid';
                }
                
                const clientKey = client?.id || \`new_row_\${Date.now()}_\${Math.random().toString(36).substr(2, 5)}\`;
                const newRow = {
                  id: clientKey,
                  clientId: client?.id || r.clientId || r.cId || '',
                  name: client?.name || r.name || 'Unknown',
                  username: client?.username || r.clientUsername || r.cId || '',
                  mobileNumber: client?.mobileNumber || '',
                  area: client?.area || r.area || area || '',
                  rt: client?.rt || '',
                  baseAmount: baseAmount,
                  cr: cr,
                  totalAmount: totalAmount,
                  billingDay: client?.billingDay || '5',
                  paymentReceived: isStatusString ? (finalStatus === 'paid' ? totalAmount : 0) : amountVal,
                  paymentStatus: finalStatus,
                  comments: r.comments || '',
                  pkgDetails: client?.pkgDetails || '',
                  connectionDate: client?.connectionDate || '',
                  devicePrice: client?.devicePrice || '',
                  abl: client?.abl || ''
                };
                
                batchPaymentsMap.set(clientKey, newRow.paymentReceived);
                baseRecalculatedRows.push(newRow);
              }
            });
          }

          // Compare with original targetMonthRows to detect changes and add to allSyncedUsersSummary
          baseRecalculatedRows.forEach((newRow: any, idx: number) => {
            const origRow = targetMonthRows.find((br: any) => br.id === newRow.id || br.clientId === newRow.clientId);
            const origPayment = Number(origRow?.paymentReceived) || 0;
            const origStatus = (origRow?.paymentStatus || 'unpaid').toLowerCase();
            const newPayment = Number(newRow.paymentReceived) || 0;
            const newStatus = (newRow.paymentStatus || 'unpaid').toLowerCase();

            if (origPayment !== newPayment || origStatus !== newStatus || (!origRow && newPayment > 0)) {
              accumulatedChangedIndicesMap[targetMonthId].add(idx);
              updatedCount++;
              
              const pName = newRow.name;
              const pUser = newRow.username || newRow.clientId || '';
              const detailStr = newStatus.toUpperCase();
              allSyncedUsersSummary.push(\`\${pName} (\${pUser}): \${detailStr}\`);
            }
          });

          totalUpdatedBillingCount += updatedCount;
          accumulatedBillingMonths[targetMonthId] = baseRecalculatedRows;
        } catch (billingErr: any) {
          console.error("Failed to auto-update billing status:", billingErr);
        }
      }

      // --- INSTANT OPTIMISTIC UI STATE SYNCHRONIZATION ---`;
    
    fs.writeFileSync('src/components/EntrySheet.tsx', before + new_logic + after);
    console.log("Successfully patched EntrySheet.tsx");
} else {
    console.log("Could not find markers!");
}
