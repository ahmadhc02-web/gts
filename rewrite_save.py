import sys

with open("src/components/EntrySheet.tsx", "r") as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "let hasAnyValidSheet = false;" in line:
        start_idx = i
        break

end_idx = -1
for i, line in enumerate(lines):
    if "if (resolvedSheetId && targetFolderId) {" in line:
        end_idx = i
        break

replacement = """
      const activeSh = currentSyncSheets[activeSheetIdx];
      if (!activeSh) {
        toast.error("Invalid active sheet.");
        return;
      }
      
      const hasT1Data = parseRowsArray(activeSh.table1Rows).some(r => (r.cId || '').trim() || (r.name || '').trim() || (r.amount || 0) > 0);
      const hasT2Data = parseRowsArray(activeSh.table2Rows).some(r => {
        const isDefault = ['bank', 'panel balance', 'cash hand'].includes((r.name || '').trim().toLowerCase());
        return (!isDefault && (r.name || '').trim()) || (Number(r.amount) || 0) > 0;
      });
      const officerName = activeSh.recOfficer || '';
      
      if (!officerName.trim()) {
        toast.error("Please specify a Recovery Officer name first.");
        return;
      }
      
      if (!hasT1Data && !hasT2Data) {
        toast.error("The ledger sheet is completely empty. Please enter some records first!");
        return;
      }

      // Prepare payloads for all sheets, performing local optimistic updates and sync calculations
      const sheetPayloads: any[] = [];
      const savedSheetsToLocal: any[] = [];
      const updatedFolderMap = { ...sheetFolderMap };

      // Step 1: Build basic payloads and local copies
      const sh = activeSh;
      
      const isCurrentlyLoadedSheet = currentLoadedId ? true : false; // It's the active sheet
      const targetFolderId = isCurrentlyLoadedSheet 
         ? (updatedFolderMap[currentLoadedId] || sh.folderId || openedFolderId || '') 
         : (sh.folderId || openedFolderId || '');

      let resolvedSheetId = sh.id;
      if (!resolvedSheetId || resolvedSheetId.startsWith('sheet_') || !/^[a-zA-Z0-9-]{15,36}$/.test(resolvedSheetId)) {
        resolvedSheetId = isCurrentlyLoadedSheet ? currentLoadedId : Array.from({length:15}, (_, idx) => idx === 0 ? "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random()*26)] : "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random()*36)]).join('');
      }

      const targetFolderObj = folders.find(f => f.id === targetFolderId);
      const sortDetailName = targetFolderObj?.name || targetFolderId || '';
      const finalFolderId = targetFolderId || '';

      const sheetPayload = {
        id: resolvedSheetId,
        folderId: finalFolderId,
        sort: sortDetailName,
        sortFolder: sortDetailName,
        recOfficer: sh.recOfficer,
        recOfficerLabel: sh.recOfficerLabel || 'REC. OFFICER',
        area: sh.area || 'MAIN',
        areaLabel: sh.areaLabel || 'AREA',
        sheetDate: sh.sheetDate || sheetDate || '',
        dateLabel: sh.dateLabel || 'DATE',
        table1Rows: parseRowsArray(sh.table1Rows).map(r => ({
          sr: r.sr,
          cId: r.cId || '',
          name: r.name || '',
          comments: r.comments || '',
          amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
          ch: !!r.ch,
          originalAmount: r.originalAmount || 0,
          clientId: r.clientId || '',
          clientUsername: r.clientUsername || '',
          status: r.status || ''
        })),
        table2Rows: parseRowsArray(sh.table2Rows).map(r => ({
          sr: r.sr,
          name: r.name || '',
          amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
          ch: !!r.ch
        })),
        cashReceived: sh.cashReceived || '',
        sign: sh.sign || '',
        submitted: sh.submitted || '',
        cashReceivedLabel: sh.cashReceivedLabel || 'CASH RECEIVED',
        signLabel: sh.signLabel || 'SIGN',
        submittedLabel: sh.submittedLabel || 'SUBMITTED',
        footnoteLeft: sh.footnoteLeft || 'Enterprise Ledger Dispatch System',
        footnoteRight: sh.footnoteRight || 'GENv2.5 // A4 PRINTABLE',
        dealerId: tenantId || 'main',
        createdAt: sh.createdAt || Date.now()
      };

      sheetPayloads.push(sheetPayload);

      const localObj = {
        id: resolvedSheetId,
        name: sheetPayload.recOfficer || '',
        folderId: targetFolderId || '',
        recOfficer: sheetPayload.recOfficer,
        recOfficerLabel: sheetPayload.recOfficerLabel,
        area: sheetPayload.area,
        areaLabel: sheetPayload.areaLabel,
        sheetDate: sheetPayload.sheetDate,
        dateLabel: sheetPayload.dateLabel,
        table1Rows: sheetPayload.table1Rows,
        table2Rows: sheetPayload.table2Rows,
        cashReceived: sheetPayload.cashReceived,
        sign: sheetPayload.sign,
        submitted: sheetPayload.submitted,
        cashReceivedLabel: sheetPayload.cashReceivedLabel,
        signLabel: sheetPayload.signLabel,
        submittedLabel: sheetPayload.submittedLabel,
        footnoteLeft: sheetPayload.footnoteLeft,
        footnoteRight: sheetPayload.footnoteRight,
        createdAt: sheetPayload.createdAt,
        updatedAt: Date.now()
      };
      savedSheetsToLocal.push(localObj);

"""

# Let's write replacement and check it
lines = lines[:start_idx] + [replacement] + lines[end_idx:]

with open("src/components/EntrySheet.tsx", "w") as f:
    f.writelines(lines)

