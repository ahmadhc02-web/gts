import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, Trash2, RefreshCw, ClipboardList, Check, Info, FileSpreadsheet, Sparkles, Settings2, SlidersHorizontal, RotateCcw,
  History, Save, Search, Key, FolderPlus, AlertCircle, Database, ChevronRight, LogIn, ChevronLeft, Shield, ShieldAlert,
  ArrowUpDown, Folder, Plus, FileText, LayoutGrid, FolderOpen, ArrowRight, ChevronDown, Edit3, UserPlus, ArrowLeft, FileDown, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { firebaseService } from '../lib/firebaseService';
import { googleSheetsService } from '../services/googleSheetsService';
import { Client, UserProfile } from '../types';
import { getCleanErrorMessage } from '../lib/styleUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EntrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  activeRows?: any[]; // For pre-filling rows
  currentMonthId?: string;
  isBillingUnlocked?: boolean;
  appConfig?: any;
  billingMonths?: any[];
  initialShowUserLedger?: boolean;
}

interface Table1Row {
  sr: any;
  cId: string;
  name: string;
  comments: string;
  amount: number | string;
  ch: boolean;
  originalAmount?: number;
  clientId?: string;
  clientUsername?: string;
  status?: string;
}

interface Table2Row {
  sr: any;
  name: string;
  amount: number | string;
  ch: boolean;
}

export default function EntrySheet({ 
  isOpen, 
  onClose, 
  currentUser, 
  activeRows = [], 
  currentMonthId,
  isBillingUnlocked,
  appConfig,
  billingMonths = [],
  initialShowUserLedger = false
}: EntrySheetProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const isDealerTied = currentUser.role === 'dealer' || (currentUser.dealerId && currentUser.dealerId !== 'main');
  const activeDealerId = isDealerTied ? firebaseService.getTenantId(currentUser) : undefined;

  // --- Folders & Dashboard State ---
  const [activeView, setActiveView] = useState<'dashboard' | 'editor'>('dashboard');
  const [folders, setFolders] = useState<any[]>([]);
  const [sheetFolderMap, setSheetFolderMap] = useState<Record<string, string>>({});
  const [settingsFolderId, setSettingsFolderId] = useState<string | null>(null);

  // Scoped folders loading on user change
  useEffect(() => {
    // Expose migration to window
    (window as any).runMigration = async () => {
      console.log("Running migration...");
      await firebaseService.runOneTimeJulyMigration();
      console.log("Migration done");
      window.location.reload();
    };

    if (!localStorage.getItem('july_migration_done_v3')) {
      firebaseService.runOneTimeJulyMigration().then(() => {
        localStorage.setItem('july_migration_done_v3', 'true');
      });
    }

    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    const originalSuffix = `_${originalScopeId}`;
    const foldersKey = `gts_ledger_folders${originalSuffix}`;
    const sheetFoldersKey = `gts_ledger_sheet_folders${originalSuffix}`;

    const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
    
    // Subscribe to Folders
    const unsubFolders = firebaseService.subscribeLedgerFolders((data) => {
      setFolders(prev => {
        let mergedFolders = data && data.length > 0 ? [...data] : [];
        let didMerge = false;
        
        // Ensure local folders aren't lost due to realtime race conditions
        prev.forEach(pf => {
          if (!mergedFolders.find(mf => mf.id === pf.id)) {
            mergedFolders.push(pf);
            didMerge = true;
          }
        });

        const migrationFlag = `migrated_local_folders_${scopeId || 'main'}`;
        if (!localStorage.getItem(migrationFlag)) {
          const savedFolders = localStorage.getItem(foldersKey);
          if (savedFolders) {
            try {
              const parsed = JSON.parse(savedFolders);
              if (parsed && Array.isArray(parsed)) {
                parsed.forEach(pf => {
                  if (!mergedFolders.find(mf => mf.id === pf.id || mf.name.toLowerCase() === pf.name.toLowerCase())) {
                    mergedFolders.push(pf);
                    didMerge = true;
                  }
                });
              }
            } catch (e) { console.error("Migration parse error", e); }
          }
          localStorage.setItem(migrationFlag, 'true');
        }

        if (mergedFolders.length === 0) {
          mergedFolders = isDealerTied ? [] : [{ id: 'june_data', name: 'June Data', createdAt: Date.now() }];
          didMerge = true;
        }
        
        if (didMerge) {
          firebaseService.updateLedgerFolders(mergedFolders, scopeId).catch(console.error);
        }
        return mergedFolders;
      });
    }, scopeId);

    // Subscribe to Sheet Folder Map
    const unsubMap = firebaseService.subscribeLedgerSheetFolderMap((data) => {
      setSheetFolderMap(prev => {
        let mergedMap = data && Object.keys(data).length > 0 ? { ...data } : {};
        let didMerge = false;
        
        // Ensure local map changes aren't lost due to realtime race conditions
        Object.keys(prev).forEach(k => {
          if (!mergedMap[k] || (mergedMap[k] !== prev[k] && typeof mergedMap[k] !== 'undefined')) {
            // Keep the local mapping if it was recently modified (we prefer prev[k] if there's a conflict just in case, but let's just keep missing ones for safety)
            if (!mergedMap[k]) {
              mergedMap[k] = prev[k];
              didMerge = true;
            }
          }
        });

        const migrationFlag = `migrated_local_map_${scopeId || 'main'}`;
        if (!localStorage.getItem(migrationFlag)) {
          const savedMap = localStorage.getItem(sheetFoldersKey);
          if (savedMap) {
            try {
              const parsed = JSON.parse(savedMap);
              if (parsed && typeof parsed === 'object') {
                Object.keys(parsed).forEach(k => {
                  if (!mergedMap[k]) {
                    mergedMap[k] = parsed[k];
                    didMerge = true;
                  }
                });
              }
            } catch (e) { console.error("Migration map parse error", e); }
          }
          localStorage.setItem(migrationFlag, 'true');
        }

        if (didMerge) {
          firebaseService.updateLedgerSheetFolderMap(mergedMap, scopeId).catch(console.error);
        }
        return mergedMap;
      });
    }, scopeId);

    return () => {
      unsubFolders();
      unsubMap();
    };
  }, [currentUser?.uid, activeDealerId, isDealerTied]);

  // Folder UI inputs
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [openedFolderId, setOpenedFolderId] = useState<string | null>(null);
  const [folderSortOption, setFolderSortOption] = useState<'a-to-z' | 'amount-high' | 'amount-low' | 'newest'>('newest');

  // User search popup state variables
  const [showUserSearchPopup, setShowUserSearchPopup] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);

  const [duplicateWarning, setDuplicateWarning] = useState<{
    index: number;
    client: any;
    message: string;
  } | null>(null);

  const handleSearchUserClick = () => {
    const q = (dashboardSearchQuery || '').trim().toLowerCase();
    if (!q) {
      toast.error("Please enter a User ID or Customer Name containing what you wish to locate!");
      return;
    }

    const results: any[] = [];
    ledgerHistory.forEach((sheet) => {
      const matchedRows = (Array.isArray(sheet.table1Rows) ? sheet.table1Rows : []).filter((r: any) => {
        const rowCId = String(r.cId || '').trim().toLowerCase();
        const rowName = String(r.name || '').trim().toLowerCase();
        const rowComments = String(r.comments || '').trim().toLowerCase();
        const rowClientId = String(r.clientId || '').trim().toLowerCase();
        const rowClientUsername = String(r.clientUsername || '').trim().toLowerCase();

        return (
          rowCId.includes(q) ||
          rowName.includes(q) ||
          rowComments.includes(q) ||
          rowClientId.includes(q) ||
          rowClientUsername.includes(q)
        );
      });

      if (matchedRows.length > 0) {
        results.push({
          sheet,
          matchedRows
        });
      }
    });

    setUserSearchResults(results);
    setShowUserSearchPopup(true);
  };

  // Whenever Entry Sheet is opened, always reset view to the root folders dashboard view
  useEffect(() => {
    if (isOpen) {
      setActiveView('dashboard');
      setOpenedFolderId(null);
    }
  }, [isOpen]);

  // --- Auto Save Hooks Removed to Prevent Realtime Sync Loops ---
  
  // Use these wrappers for local changes to push immediately to DB
  const saveFoldersToDb = async (newFolders: any[]) => {
    const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
    await firebaseService.updateLedgerFolders(newFolders, scopeId);
  };

  const saveMapToDb = async (newMap: Record<string, string>) => {
    const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
    await firebaseService.updateLedgerSheetFolderMap(newMap, scopeId);
  };


  const handleCreateFolder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newFolderNameInput.trim();
    if (!cleanName) {
      toast.error("Please enter a valid folder name");
      return;
    }
    if (folders.some(f => f.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error("A folder with this name already exists!");
      return;
    }
    const nFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      createdAt: Date.now()
    };
    const newFolders = [...folders, nFolder];
    setFolders(newFolders);
    saveFoldersToDb(newFolders);
    setNewFolderNameInput('');
    setIsCreatingFolder(false);
    toast.success(`📁 Folder "${cleanName}" created successfully!`);
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folders.length <= 1) {
      toast.error("You must keep at least one folder in the system.");
      return;
    }
    const conf = window.confirm("Are you sure you want to delete this folder? Sheets inside will become Uncategorized.");
    if (!conf) return;

    const folderToDelete = folders.find(f => f.id === folderId);

    const newFolders = folders.filter(f => f.id !== folderId);
    setFolders(newFolders);
    saveFoldersToDb(newFolders);
    
    setSheetFolderMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sheetId => {
        if (next[sheetId] === folderId) {
          delete next[sheetId];
        }
      });
      saveMapToDb(next);
      return next;
    });

    if (folderToDelete) {
      try {
        const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
        firebaseService.saveToRecycleBin(
          'ledger_folder',
          folderToDelete.id,
          currentUser?.username || 'admin',
          scopeId || 'main',
          {
            originalData: folderToDelete,
            dealerId: scopeId || 'main'
          }
        );
      } catch (binErr) {
        console.error("Error saving ledger folder to recycle bin:", binErr);
      }
    }

    toast.success("Folder deleted");
  };

  const handleCreateSheetInFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", { description: "Please unlock the Billing Security Shield first." });
      return;
    }

    // Default table rows creation
    const tRef: Table1Row[] = [];
    for (let i = 1; i <= 22; i++) {
      tRef.push({
        sr: i,
        cId: '',
        name: '',
        comments: '',
        amount: 0,
        ch: false,
        clientId: '',
        clientUsername: ''
      });
    }
    const t2 = [
      { sr: 1, name: 'Bank', amount: 0, ch: false },
      { sr: 2, name: 'Panel Balance', amount: 0, ch: false },
      { sr: 3, name: 'Cash Hand', amount: 0, ch: false }
    ];

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day} - ${month} - ${year}`;

    const newSheetId = `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Set editor fields
    setLoadedSheetId(newSheetId);
    setRecOfficer(currentUser.fullName || currentUser.username.toUpperCase());
    setArea('MAIN');
    setSheetDate(formattedDate);
    setTable1Rows(tRef);
    setTable2Rows(t2);
    setCashReceived('');
    setSign('');
    setSubmitted('');

    const blankSheet = {
      id: newSheetId,
      recOfficer: currentUser.fullName || currentUser.username.toUpperCase(),
      recOfficerLabel: 'REC. OFFICER',
      area: 'MAIN',
      areaLabel: 'AREA',
      sheetDate: formattedDate,
      dateLabel: 'DATE',
      table1Rows: tRef,
      table2Rows: t2,
      cashReceived: '',
      sign: '',
      submitted: '',
      footnoteLeft: 'Enterprise Ledger Dispatch System',
      footnoteRight: 'GENv2.5 // A4 PRINTABLE',
      t1Headers: ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH'],
      t2Headers: ['SR', 'NAME', 'AMOUNT', 'CH'],
      t1TotalLabel: 'TOTAL',
      t2TotalLabel: 'TOTAL',
      cashReceivedLabel: 'CASH RECEIVED',
      signLabel: 'SIGN',
      submittedLabel: 'SUBMITTED',
    };

    isSwappingRef.current = true;
    setSheets([blankSheet]);
    setActiveSheetIdx(0);
    setTimeout(() => {
      isSwappingRef.current = false;
    }, 50);

    // Map sheet id
    const newMap = {
      ...sheetFolderMap,
      [newSheetId]: folderId
    };
    setSheetFolderMap(newMap);
    saveMapToDb(newMap);

    setActiveView('editor');
    toast.success("📄 Created empty sheet inside selected folder! Let's fill it.");
  };

  // Top fields
  const [recOfficer, setRecOfficer] = useState('');
  const [area, setArea] = useState('MAIN');
  const [sheetDate, setSheetDate] = useState('');

  // Security and lock synchronization
  const [localPasskey, setLocalPasskey] = useState('');
  const [localUnlocked, setLocalUnlocked] = useState(() => {
    return sessionStorage.getItem('gts_billing_unlocked') === 'true';
  });

  useEffect(() => {
    if (isBillingUnlocked !== undefined) {
      setLocalUnlocked(isBillingUnlocked);
    }
  }, [isBillingUnlocked]);

  const isLocked = !localUnlocked;

  const handleLocalUnlock = () => {
    const isDealerTied = currentUser.role === 'dealer' || (currentUser.dealerId && currentUser.dealerId !== 'main');
    const requiredKey = (isDealerTied && currentUser.password) ? currentUser.password : (appConfig?.billingSecurityKey || '786786');
    if (localPasskey === requiredKey) {
      setLocalUnlocked(true);
      sessionStorage.setItem('gts_billing_unlocked', 'true');
      // Dispatch custom event to notify rest of components in real-time
      window.dispatchEvent(new CustomEvent('gts-billing-unlocked-changed', { detail: true }));
      toast.success("🔑 ACCESS GRANTED", { description: "WiFi Billing & entry sheets unlocked for editing." });
    } else {
      toast.error("🔒 ACCESS DENIED", { description: "Incorrect or invalid Security Key." });
    }
  };

  // Editable top labels
  const [recOfficerLabel, setRecOfficerLabel] = useState('REC. OFFICER');
  const [areaLabel, setAreaLabel] = useState('AREA');
  const [dateLabel, setDateLabel] = useState('DATE');

  // Editable table headers
  const [t1Headers, setT1Headers] = useState(['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH']);
  const [t2Headers, setT2Headers] = useState(['SR', 'NAME', 'AMOUNT', 'CH']);

  // Editable totals
  const [t1TotalLabel, setT1TotalLabel] = useState('TOTAL');
  const [t2TotalLabel, setT2TotalLabel] = useState('TOTAL');

  // Editable footer labels
  const [cashReceivedLabel, setCashReceivedLabel] = useState('CASH RECEIVED');
  const [signLabel, setSignLabel] = useState('SIGN');
  const [submittedLabel, setSubmittedLabel] = useState('SUBMITTED');

  // Editable footnote labels
  const [footnoteLeft, setFootnoteLeft] = useState('Enterprise Ledger Dispatch System');
  const [footnoteRight, setFootnoteRight] = useState('GENv2.5 // A4 PRINTABLE');

  // Multi-sheet state and active page tracking variables
  const [sheets, setSheets] = useState<any[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);

  // Table 1 rows (22 rows)
  const [table1Rows, setTable1Rows] = useState<Table1Row[]>([]);
  // Table 2 rows (3 rows)
  const [table2Rows, setTable2Rows] = useState<Table2Row[]>([]);

  // Sorting configurations & handlers
  const [t1SortConfig, setT1SortConfig] = useState<{ key: 'cId' | 'name' | 'comments' | 'amount' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [t2SortConfig, setT2SortConfig] = useState<{ key: 'name' | 'amount' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  const handleT1Sort = (key: 'cId' | 'name' | 'comments' | 'amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (t1SortConfig.key === key && t1SortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setT1SortConfig({ key, direction });

    // Filter filled (active) rows vs blank rows to float blanks to bottom
    const activeRows = table1Rows.filter(r => (r.cId || '').trim() || (r.name || '').trim() || (r.comments || '').trim() || (Number(r.amount) || 0) > 0);
    const blankRows = table1Rows.filter(r => !((r.cId || '').trim() || (r.name || '').trim() || (r.comments || '').trim() || (Number(r.amount) || 0) > 0));

    activeRows.sort((a, b) => {
      let valA: any = a[key] || '';
      let valB: any = b[key] || '';

      if (key === 'amount') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      } else {
        const strA = String(valA).trim();
        const strB = String(valB).trim();
        const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      }
    });

    // Reassemble and re-index Serial Numbers dynamically
    const sorted = [...activeRows, ...blankRows].map((r, i) => ({
      ...r,
      sr: i + 1
    }));

    setTable1Rows(sorted);
    toast.success(`Table 1 sorted by ${key.toUpperCase()} (${direction === 'asc' ? 'A-Z' : 'Z-A'})`);
  };

  const handleT2Sort = (key: 'name' | 'amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (t2SortConfig.key === key && t2SortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setT2SortConfig({ key, direction });

    const activeRows = table2Rows.filter(r => (r.name || '').trim() || (Number(r.amount) || 0) > 0);
    const blankRows = table2Rows.filter(r => !((r.name || '').trim() || (Number(r.amount) || 0) > 0));

    activeRows.sort((a, b) => {
      let valA: any = a[key] || '';
      let valB: any = b[key] || '';

      if (key === 'amount') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return direction === 'asc' ? numA - numB : numB - numA;
      } else {
        const strA = String(valA).trim();
        const strB = String(valB).trim();
        const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        return direction === 'asc' ? cmp : -cmp;
      }
    });

    const sorted = [...activeRows, ...blankRows].map((r, i) => ({
      ...r,
      sr: i + 1
    }));

    setTable2Rows(sorted);
    toast.success(`Table 2 sorted by ${key.toUpperCase()} (${direction === 'asc' ? 'A-Z' : 'Z-A'})`);
  };

  // Autocomplete suggestions states
  const [clients, setClients] = useState<any[]>([]);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'cId' | 'name' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Ledger Card Monthly History and Backup States
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);

  // Auto-migrate and synchronize: put every existing sheet inside 'June Data' (One-time migration)
  useEffect(() => {
    if (isDealerTied || ledgerHistory.length === 0) {
      return;
    }
    
    // Check if migration already ran
    const migrationKey = `gts_june_data_migrated_v8_${currentUser?.uid || 'main'}`;
    if (localStorage.getItem(migrationKey)) {
      return;
    }

    const juneFolder = folders.find(f => f.name.toLowerCase() === 'june data' || f.id === 'june_data') || { id: 'june_data', name: 'June Data', createdAt: Date.now() };
    
    // Ensure juneFolder is in folders
    if (!folders.some(f => f.id === juneFolder.id)) {
      const newFolders = [...folders, juneFolder];
      setFolders(newFolders);
      saveFoldersToDb(newFolders);
    }

    // Map uncategorized sheets from ledgerHistory into the june_data folder
    let mapChanged = false;
    const nextMap = { ...sheetFolderMap };
    
    ledgerHistory.forEach(sh => {
      // Only map it if it's not currently mapped to ANY folder
      if (!nextMap[sh.id]) {
        nextMap[sh.id] = juneFolder.id;
        mapChanged = true;
      }
    });

    if (mapChanged) {
      setSheetFolderMap(nextMap);
      saveMapToDb(nextMap).catch(console.error);
    }
    localStorage.setItem(migrationKey, 'true');
  }, [ledgerHistory, folders, isDealerTied, currentUser?.uid, sheetFolderMap, activeDealerId]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showUserLedger, setShowUserLedger] = useState(initialShowUserLedger);

  useEffect(() => {
    if (isOpen) {
      setShowUserLedger(initialShowUserLedger);
    }
  }, [isOpen, initialShowUserLedger]);

  const [ledgerSearchUser, setLedgerSearchUser] = useState('');
  const [ledgerSelectedFolder, setLedgerSelectedFolder] = useState('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [loadedSheetId, setLoadedSheetId] = useState<string | null>(null);
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);

  // Backup accounts states
  const [backupTokens, setBackupTokens] = useState<any>(() => googleSheetsService.getBackupTokens());
  const [backupSpreadsheetId, setBackupSpreadsheetId] = useState(() => googleSheetsService.getBackupSpreadsheetId() || '');
  const [isBackingUp, setIsBackingUp] = useState(false);


  // Subeffect to load master clients scoped to the current dealer tenant
  useEffect(() => {
    if (!isOpen) return;
    try {
      const tenantId = firebaseService.getReadTenantId(currentUser as any);
      const unsubscribe = firebaseService.subscribeClients((data) => {
        setClients(data);
      }, tenantId);
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to subscribe to clients in EntrySheet:", e);
    }
  }, [isOpen, currentUser]);

  // Real-time listener for Monthly Ledger Sheets History
  useEffect(() => {
    if (!isOpen) return;
    try {
      const tenantId = firebaseService.getReadTenantId(currentUser as any);
      const unsubscribe = firebaseService.subscribeLedgerSheets((data) => {
        setLedgerHistory(data);
      }, tenantId);
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to fetch historical ledger sheets:", e);
    }
  }, [isOpen, currentUser]);

  // Sync internal backup states with custom storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setBackupTokens(googleSheetsService.getBackupTokens());
      setBackupSpreadsheetId(googleSheetsService.getBackupSpreadsheetId() || '');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sizing and Layout configuration states (Agy pichy controls)
  const [showSizingPanel, setShowSizingPanel] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_showSizingPanel');
    return saved !== null ? saved === 'true' : true;
  });
  const [rowPadding, setRowPadding] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_rowPadding');
    return saved !== null ? parseFloat(saved) : 5.5;
  }); // vertical padding in px/mm
  const [tableFontSize, setTableFontSize] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_tableFontSize');
    return saved !== null ? parseFloat(saved) : 11.5;
  }); // in pixels
  const [headerFontSize, setHeaderFontSize] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_headerFontSize');
    return saved !== null ? parseFloat(saved) : 13;
  }); // in pixels
  const [paperPaddingX, setPaperPaddingX] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_paperPaddingX');
    return saved !== null ? parseInt(saved) : 10;
  }); // in mm
  const [paperPaddingY, setPaperPaddingY] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_paperPaddingY');
    return saved !== null ? parseInt(saved) : 8;
  });  // in mm

  // Table 1 individual column width states (can be modified back and forth via sliders)
  const [t1WidthSr, setT1WidthSr] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t1WidthSr');
    return saved !== null ? parseInt(saved) : 40;
  });
  const [t1WidthId, setT1WidthId] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t1WidthId');
    return saved !== null ? parseInt(saved) : 90;
  });
  const [t1WidthName, setT1WidthName] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t1WidthName');
    return saved !== null ? parseInt(saved) : 240;
  });
  const [t1WidthComments, setT1WidthComments] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t1WidthComments');
    return saved !== null ? parseInt(saved) : 180;
  });
  const [t1WidthAmount, setT1WidthAmount] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t1WidthAmount');
    return saved !== null ? parseInt(saved) : 100;
  });
  const [t1WidthCh, setT1WidthCh] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t1WidthCh');
    return saved !== null ? parseInt(saved) : 40;
  });

  // Table 2 individual column width states
  const [t2WidthSr, setT2WidthSr] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t2WidthSr');
    return saved !== null ? parseInt(saved) : 40;
  });
  const [t2WidthName, setT2WidthName] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t2WidthName');
    return saved !== null ? parseInt(saved) : 490;
  });
  const [t2WidthAmount, setT2WidthAmount] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t2WidthAmount');
    return saved !== null ? parseInt(saved) : 120;
  });
  const [t2WidthCh, setT2WidthCh] = useState(() => {
    const saved = localStorage.getItem('gts_ledger_t2WidthCh');
    return saved !== null ? parseInt(saved) : 40;
  });

  // Save layout configurations to localStorage on modification
  useEffect(() => {
    localStorage.setItem('gts_ledger_showSizingPanel', String(showSizingPanel));
    localStorage.setItem('gts_ledger_rowPadding', String(rowPadding));
    localStorage.setItem('gts_ledger_tableFontSize', String(tableFontSize));
    localStorage.setItem('gts_ledger_headerFontSize', String(headerFontSize));
    localStorage.setItem('gts_ledger_paperPaddingX', String(paperPaddingX));
    localStorage.setItem('gts_ledger_paperPaddingY', String(paperPaddingY));
    localStorage.setItem('gts_ledger_t1WidthSr', String(t1WidthSr));
    localStorage.setItem('gts_ledger_t1WidthId', String(t1WidthId));
    localStorage.setItem('gts_ledger_t1WidthName', String(t1WidthName));
    localStorage.setItem('gts_ledger_t1WidthComments', String(t1WidthComments));
    localStorage.setItem('gts_ledger_t1WidthAmount', String(t1WidthAmount));
    localStorage.setItem('gts_ledger_t1WidthCh', String(t1WidthCh));
    localStorage.setItem('gts_ledger_t2WidthSr', String(t2WidthSr));
    localStorage.setItem('gts_ledger_t2WidthName', String(t2WidthName));
    localStorage.setItem('gts_ledger_t2WidthAmount', String(t2WidthAmount));
    localStorage.setItem('gts_ledger_t2WidthCh', String(t2WidthCh));
  }, [
    showSizingPanel, rowPadding, tableFontSize, headerFontSize, paperPaddingX, paperPaddingY,
    t1WidthSr, t1WidthId, t1WidthName, t1WidthComments, t1WidthAmount, t1WidthCh,
    t2WidthSr, t2WidthName, t2WidthAmount, t2WidthCh
  ]);

  // Zoom & Auto-Fit scaling states
  const [zoomOption, setZoomOption] = useState<'fit' | '100%' | '85%' | '75%'>(() => {
    const saved = localStorage.getItem('gts_ledger_zoomOption');
    return (saved as 'fit' | '100%' | '85%' | '75%') || 'fit';
  });
  const [calculatedScale, setCalculatedScale] = useState(1);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handlePaperFocus = (e: React.FocusEvent) => {
    setIsInputFocused(true);
    const targetEl = e.target as HTMLElement;
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }, 150);
    }
  };

  const handlePaperBlur = (e: React.FocusEvent) => {
    const currentTarget = e.currentTarget;
    setTimeout(() => {
      if (!currentTarget.contains(document.activeElement)) {
        setIsInputFocused(false);
      }
    }, 100);
  };

  useEffect(() => {
    const handleResize = () => {
      let baseScale = 1;
      
      if (zoomOption !== 'fit') {
        if (zoomOption === '100%') baseScale = 1.0;
        else if (zoomOption === '85%') baseScale = 0.85;
        else if (zoomOption === '75%') baseScale = 0.72;
      } else {
        let availableWidth = window.innerWidth;
        let availableHeight = window.innerHeight - (window.innerWidth < 640 ? 100 : 80);

        if (workspaceRef.current) {
          availableWidth = workspaceRef.current.clientWidth || window.innerWidth;
          availableHeight = workspaceRef.current.clientHeight || (window.innerHeight - (window.innerWidth < 640 ? 100 : 80));
        }

        const padX = window.innerWidth < 640 ? 12 : 24;
        const padY = window.innerWidth < 640 ? 12 : 24;

        const safeWidth = Math.max(150, availableWidth - padX);
        const safeHeight = Math.max(150, availableHeight - padY);

        const paperWidth = 793.7;
        const paperHeight = 1122.5;

        const fitScaleWidth = safeWidth / paperWidth;
        const fitScaleHeight = safeHeight / paperHeight;

        baseScale = Math.min(fitScaleWidth, fitScaleHeight);
        baseScale = Math.max(0.18, Math.min(1.0, baseScale * 0.97));
      }

      if (isInputFocused) {
        const minComfortZoom = 0.88;
        setCalculatedScale(Math.max(minComfortZoom, Math.min(1.15, baseScale * 1.35)));
      } else {
        setCalculatedScale(baseScale);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (workspaceRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(workspaceRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [zoomOption, isLocked, isOpen, showSizingPanel, showHistoryPanel, isInputFocused, activeView]);

   // Function to reset all lines & boxes sizing parameters to default
  const resetSizingToDefault = () => {
    setRowPadding(5.5);
    setTableFontSize(11.5);
    setHeaderFontSize(13);
    setPaperPaddingX(10);
    setPaperPaddingY(8);
    setT1WidthSr(40);
    setT1WidthId(90);
    setT1WidthName(240);
    setT1WidthComments(180);
    setT1WidthAmount(100);
    setT1WidthCh(40);
    setT2WidthSr(40);
    setT2WidthName(490);
    setT2WidthAmount(120);
    setT2WidthCh(40);
    
    localStorage.removeItem('gts_ledger_showSizingPanel');
    localStorage.removeItem('gts_ledger_rowPadding');
    localStorage.removeItem('gts_ledger_tableFontSize');
    localStorage.removeItem('gts_ledger_headerFontSize');
    localStorage.removeItem('gts_ledger_paperPaddingX');
    localStorage.removeItem('gts_ledger_paperPaddingY');
    localStorage.removeItem('gts_ledger_t1WidthSr');
    localStorage.removeItem('gts_ledger_t1WidthId');
    localStorage.removeItem('gts_ledger_t1WidthName');
    localStorage.removeItem('gts_ledger_t1WidthComments');
    localStorage.removeItem('gts_ledger_t1WidthAmount');
    localStorage.removeItem('gts_ledger_t1WidthCh');
    localStorage.removeItem('gts_ledger_t2WidthSr');
    localStorage.removeItem('gts_ledger_t2WidthName');
    localStorage.removeItem('gts_ledger_t2WidthAmount');
    localStorage.removeItem('gts_ledger_t2WidthCh');
    
    toast.success("Sizing and column widths restored to defaults and permanently saved!");
  };

  // Footer fields
  const [cashReceived, setCashReceived] = useState('');
  const [sign, setSign] = useState('');
  const [submitted, setSubmitted] = useState('');

  const isSwappingRef = useRef(false);

  // Synchronize changes in live active states back into sheets list slice
  useEffect(() => {
    if (sheets.length === 0 || isSwappingRef.current) return;
    setSheets(prev => {
      const next = [...prev];
      if (next[activeSheetIdx]) {
        next[activeSheetIdx] = {
          ...next[activeSheetIdx],
          recOfficer,
          area,
          sheetDate,
          table1Rows,
          table2Rows,
          cashReceived: String(cashReceived),
          sign,
          submitted,
          recOfficerLabel,
          areaLabel,
          dateLabel,
          t1Headers,
          t2Headers,
          t1TotalLabel,
          t2TotalLabel,
          cashReceivedLabel,
          signLabel,
          submittedLabel,
          footnoteLeft,
          footnoteRight,
        };
      }
      return next;
    });
  }, [
    recOfficer, area, sheetDate, table1Rows, table2Rows, cashReceived, sign, submitted,
    recOfficerLabel, areaLabel, dateLabel, t1Headers, t2Headers, t1TotalLabel, t2TotalLabel,
    cashReceivedLabel, signLabel, submittedLabel, footnoteLeft, footnoteRight,
    activeSheetIdx
  ]);

  // Load selected sheet states back into active workspace editor on index changes
  useEffect(() => {
    if (sheets.length === 0 || !sheets[activeSheetIdx]) return;
    const target = sheets[activeSheetIdx];
    isSwappingRef.current = true;
    
    setRecOfficer(target.recOfficer || '');
    setRecOfficerLabel(target.recOfficerLabel || 'REC. OFFICER');
    setArea(target.area || 'MAIN');
    setAreaLabel(target.areaLabel || 'AREA');
    if (target.sheetDate) {
      setSheetDate(target.sheetDate);
    }
    setDateLabel(target.dateLabel || 'DATE');
    setTable1Rows(Array.isArray(target.table1Rows) ? target.table1Rows : []);
    setTable2Rows(Array.isArray(target.table2Rows) ? target.table2Rows : []);
    setCashReceived(target.cashReceived || '');
    setSign(target.sign || '');
    setSubmitted(target.submitted || '');
    setCashReceivedLabel(target.cashReceivedLabel || 'CASH RECEIVED');
    setSignLabel(target.signLabel || 'SIGN');
    setSubmittedLabel(target.submittedLabel || 'SUBMITTED');
    setFootnoteLeft(target.footnoteLeft || 'Enterprise Ledger Dispatch System');
    setFootnoteRight(target.footnoteRight || 'GENv2.5 // A4 PRINTABLE');
    setT1Headers(target.t1Headers || ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH']);
    setT2Headers(target.t2Headers || ['SR', 'NAME', 'AMOUNT', 'CH']);
    setT1TotalLabel(target.t1TotalLabel || 'TOTAL');
    setT2TotalLabel(target.t2TotalLabel || 'TOTAL');
    
    const timer = setTimeout(() => {
      isSwappingRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [activeSheetIdx, sheets.length]);

  // Setup initial empty ledger rows
  const resetToBlank = () => {
    // Current date format matching: DD - MM - YYYY
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day} - ${month} - ${year}`;
    setSheetDate(formattedDate);
    
    setRecOfficer(currentUser.fullName || currentUser.username.toUpperCase());
    setArea('MAIN');

    setRecOfficerLabel('REC. OFFICER');
    setAreaLabel('AREA');
    setDateLabel('DATE');

    setT1Headers(['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH']);
    setT2Headers(['SR', 'NAME', 'AMOUNT', 'CH']);

    setT1TotalLabel('TOTAL');
    setT2TotalLabel('TOTAL');

    setCashReceivedLabel('CASH RECEIVED');
    setSignLabel('SIGN');
    setSubmittedLabel('SUBMITTED');

    setFootnoteLeft('Enterprise Ledger Dispatch System');
    setFootnoteRight('GENv2.5 // A4 PRINTABLE');

    // Create 22 blank rows for Table 1
    const t1: Table1Row[] = [];
    for (let i = 1; i <= 22; i++) {
      t1.push({
        sr: i,
        cId: '',
        name: '',
        comments: '',
        amount: 0,
        ch: false,
        clientId: '',
        clientUsername: ''
      });
    }
    setTable1Rows(t1);

    // Create 3 static rows for Table 2
    const t2 = [
      { sr: 1, name: 'Bank', amount: 0, ch: false },
      { sr: 2, name: 'Panel Balance', amount: 0, ch: false },
      { sr: 3, name: 'Cash Hand', amount: 0, ch: false }
    ];
    setTable2Rows(t2);

    setCashReceived('');
    setSign('');
    setSubmitted('');

    // Setup initial single sheets list
    const blankSheet = {
      id: Math.random().toString(36).substring(7),
      recOfficer: '',
      recOfficerLabel: 'REC. OFFICER',
      area: 'MAIN',
      areaLabel: 'AREA',
      sheetDate: formattedDate,
      dateLabel: 'DATE',
      table1Rows: t1,
      table2Rows: t2,
      cashReceived: '',
      sign: '',
      submitted: '',
      footnoteLeft: 'Enterprise Ledger Dispatch System',
      footnoteRight: 'GENv2.5 // A4 PRINTABLE',
      t1Headers: ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH'],
      t2Headers: ['SR', 'NAME', 'AMOUNT', 'CH'],
      t1TotalLabel: 'TOTAL',
      t2TotalLabel: 'TOTAL',
      cashReceivedLabel: 'CASH RECEIVED',
      signLabel: 'SIGN',
      submittedLabel: 'SUBMITTED',
    };
    
    isSwappingRef.current = true;
    setSheets([blankSheet]);
    setActiveSheetIdx(0);
    setTimeout(() => {
      isSwappingRef.current = false;
    }, 50);
  };

  // Add a new A4 sheet item under the same date directly on the right side of the list
  const handleAddSheet = (index: number) => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", { description: "Unlock Billing security shield to add new sheets." });
      return;
    }
    
    const blankT1Rows: Table1Row[] = [];
    for (let i = 1; i <= 22; i++) {
      blankT1Rows.push({
        sr: i,
        cId: '',
        name: '',
        comments: '',
        amount: 0,
        ch: false,
        clientId: '',
        clientUsername: ''
      });
    }
    
    const blankT2Rows = [
      { sr: 1, name: 'Bank', amount: 0, ch: false },
      { sr: 2, name: 'Panel Balance', amount: 0, ch: false },
      { sr: 3, name: 'Cash Hand', amount: 0, ch: false }
    ];
    
    // Inherit layout parameters from currently active/edited sheet for seamless multi-page consistency, while keeping data rows blank
    const newSheet = {
      id: Math.random().toString(36).substring(7),
      recOfficer: recOfficer || currentUser.fullName || currentUser.username.toUpperCase(),
      recOfficerLabel: recOfficerLabel || 'REC. OFFICER',
      area: area || 'MAIN',
      areaLabel: areaLabel || 'AREA',
      sheetDate: sheetDate || new Date().toISOString().split('T')[0],
      dateLabel: dateLabel || 'DATE',
      table1Rows: blankT1Rows,
      table2Rows: blankT2Rows,
      cashReceived: '',
      sign: '',
      submitted: '',
      footnoteLeft: footnoteLeft || 'Enterprise Ledger Dispatch System',
      footnoteRight: footnoteRight || 'GENv2.5 // A4 PRINTABLE',
      t1Headers: t1Headers || ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH'],
      t2Headers: t2Headers || ['SR', 'NAME', 'AMOUNT', 'CH'],
      t1TotalLabel: t1TotalLabel || 'TOTAL',
      t2TotalLabel: t2TotalLabel || 'TOTAL',
      cashReceivedLabel: cashReceivedLabel || 'CASH RECEIVED',
      signLabel: signLabel || 'SIGN',
      submittedLabel: submittedLabel || 'SUBMITTED',
    };
    
    setSheets(prev => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newSheet);
      return updated;
    });
    
    setTimeout(() => {
      isSwappingRef.current = true;
      setActiveSheetIdx(index + 1);
      toast.success("📄 NEW A4 SHEET CREATED", { description: `Sheet Added to the right side of Sheet ${index + 1} sharing date ${sheetDate}.` });
    }, 50);
  };

  // Delete a specific sheet from the multi-sheet compilation view
  const handleDeleteSheetItem = (index: number) => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", { description: "Unlock Billing security shield to discard pages." });
      return;
    }
    
    if (sheets.length <= 1) {
      toast.info("Clearing active sheet as it is the only page remaining.");
      resetToBlank();
      return;
    }
    
    const sheetToDelete = sheets[index];

    setSheets(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    
    const nextIdx = Math.max(0, index - 1);
    isSwappingRef.current = true;
    setActiveSheetIdx(nextIdx);

    if (sheetToDelete) {
      try {
        const sheetId = sheetToDelete.id || `sheet_discarded_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
        const sheetDataToSave = {
          ...sheetToDelete,
          id: sheetId,
          createdAt: sheetToDelete.createdAt || Date.now(),
          dealerId: scopeId || 'main'
        };

        firebaseService.saveToRecycleBin(
          'ledger_sheets',
          sheetId,
          currentUser?.username || 'admin',
          scopeId || 'main',
          sheetDataToSave
        );
      } catch (binErr) {
        console.error("Error saving discarded A4 sheet to recycle bin:", binErr);
      }
    }

    toast.success("🗑️ SHEET DELETED", { description: `A4 Sheet Page ${index + 1} has been completely discarded.` });
  };

  // Run on load
  useEffect(() => {
    resetToBlank();
  }, [currentUser]);

  // Handle auto-prefilling from current month database rows (unpaid / partial)
  const autoFillFromDb = () => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to auto-fill or modify ledger sheets."
      });
      return;
    }
    if (!activeRows || activeRows.length === 0) {
      toast.error("No active monthly rows found to import.");
      return;
    }

    // Filter for unpaid, partial, or tdc clients
    const collectableRows = activeRows.filter(r => 
      r.paymentStatus === 'unpaid' || r.paymentStatus === 'partial' || r.paymentStatus === 'tdc'
    );

    if (collectableRows.length === 0) {
      toast.warning("All clients in the active month are paid! Loaded blank instead.");
      return;
    }

    const updatedT1 = [...table1Rows];
    
    // Fill up to 22 rows
    collectableRows.slice(0, 22).forEach((dbRow, index) => {
      // Calculate outstanding amount: totalAmount - paymentReceived
      const totalAmt = parseFloat(dbRow.totalAmount) || 0;
      const rcvAmt = parseFloat(dbRow.paymentReceived) || 0;
      const outstanding = totalAmt - rcvAmt;

      const calculatedAmount = outstanding > 0 ? outstanding : totalAmt;
      updatedT1[index] = {
        sr: index + 1,
        cId: dbRow.username || dbRow.clientId || '',
        name: dbRow.name || '',
        comments: dbRow.comments || dbRow.mobileNumber || '',
        amount: calculatedAmount,
        ch: false,
        originalAmount: calculatedAmount
      };
    });

    setTable1Rows(updatedT1);
    
    // Set field area automatically to target the dominant area of collectable rows
    const areaCounts: { [key: string]: number } = {};
    collectableRows.forEach(r => {
      if (r.area) {
        areaCounts[r.area] = (areaCounts[r.area] || 0) + 1;
      }
    });
    const topArea = Object.keys(areaCounts).reduce((a, b) => areaCounts[a] > areaCounts[b] ? a : b, 'MAIN');
    setArea(topArea.toUpperCase());

    toast.success(`Imported ${Math.min(collectableRows.length, 22)} outstanding accounts into Entry Sheet!`);
  };

  // --- Financial Ledger Sheets History and Google Backup Core System ---

  // Save the currently active sheet (creates a new entry or updates an existing card in real-time)
  const handleSaveSheet = async () => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to commit or update ledger sheets."
      });
      return;
    }
    try {
      // Build finalized synced list of sheets
      const currentSyncSheets = [...sheets];
      if (currentSyncSheets[activeSheetIdx]) {
        currentSyncSheets[activeSheetIdx] = {
          ...currentSyncSheets[activeSheetIdx],
          recOfficer,
          area,
          sheetDate,
          table1Rows,
          table2Rows,
          cashReceived: String(cashReceived),
          sign,
          submitted,
          recOfficerLabel,
          areaLabel,
          dateLabel,
          t1Headers,
          t2Headers,
          t1TotalLabel,
          t2TotalLabel,
          cashReceivedLabel,
          signLabel,
          submittedLabel,
          footnoteLeft,
          footnoteRight,
        };
      }

      const tenantId = firebaseService.getReadTenantId(currentUser as any);
      let anySaved = false;
      let totalUpdatedBillingCount = 0;

      let lastSavedId: string | null = null;

      for (let i = 0; i < currentSyncSheets.length; i++) {
        const sh = currentSyncSheets[i];
        
        // Skip empty sheets if we have multiple sheets
        const hasT1Data = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).some(r => (r.cId || '').trim() || (r.name || '').trim() || (r.amount || 0) > 0);
        const hasT2Data = (Array.isArray(sh.table2Rows) ? sh.table2Rows : []).some(r => (r.name || '').trim() || (r.amount || 0) > 0);
        const officerName = sh.recOfficer || '';
        
        if (!officerName.trim()) {
          if (currentSyncSheets.length === 1) {
            toast.error("Please specify a Recovery Officer name first.");
            return;
          }
          continue; // skip empty sheet title
        }
        
        if (!hasT1Data && !hasT2Data) {
          if (currentSyncSheets.length === 1) {
            toast.error("The ledger sheet is completely empty. Please enter some records first!");
            return;
          }
          continue; // skip completely empty pages
        }

        const isCurrentlyLoadedSheet = (i === activeSheetIdx) && loadedSheetId;
        const sheetPayload = {
          id: isCurrentlyLoadedSheet ? loadedSheetId : undefined,
          recOfficer: sh.recOfficer,
          recOfficerLabel: sh.recOfficerLabel || 'REC. OFFICER',
          area: sh.area || 'MAIN',
          areaLabel: sh.areaLabel || 'AREA',
          sheetDate: sh.sheetDate || sheetDate || '',
          dateLabel: sh.dateLabel || 'DATE',
          table1Rows: (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).map(r => ({
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
          table2Rows: (Array.isArray(sh.table2Rows) ? sh.table2Rows : []).map(r => ({
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
          createdAt: isCurrentlyLoadedSheet ? undefined : Date.now()
        };

        toast.loading(`Saving Sheet ${i + 1} (${sh.recOfficer})...`, { id: `ledger-save-${i}` });
        const savedDoc = await firebaseService.saveLedgerSheet(sheetPayload);
        toast.dismiss(`ledger-save-${i}`);

        if (savedDoc) {
          anySaved = true;
          if (savedDoc.id) {
            lastSavedId = savedDoc.id;
          }

          // Map new generated Firestore ID to sheetFolderMap
          const targetFolderId = savedDoc.id ? (sheetFolderMap[savedDoc.id] || (loadedSheetId ? sheetFolderMap[loadedSheetId] : null) || openedFolderId) : openedFolderId;
          
          if (savedDoc.id && targetFolderId) {
            const updated = { ...sheetFolderMap };
            updated[savedDoc.id] = targetFolderId;
            if (!isCurrentlyLoadedSheet && loadedSheetId) {
              delete updated[loadedSheetId];
            }
            setSheetFolderMap(updated);
            saveMapToDb(updated);
          }

          const folderObj = folders.find(f => f.id === targetFolderId);
          const targetMonthId = folderObj?.connectedMonthId;

          if (targetMonthId) {
            const targetMonthDoc = billingMonths.find(m => m.id === targetMonthId);
            const targetMonthRows = targetMonthDoc?.rows || [];
            
            if (targetMonthRows.length > 0) {
              try {
                const updatedBillingRows = [...targetMonthRows];
                let updatedCount = 0;

                sheetPayload.table1Rows.forEach((r) => {
                  const hasId = r.cId && r.cId.trim();
                  const hasName = r.name && r.name.trim();
                  if (!hasId && !hasName) return; // skip empty rows

                  let matchedIdx = -1;

                  // 1. Match using precise metadata from suggestions
                  if (r.clientId || r.clientUsername) {
                    const searchClientId = (r.clientId || '').trim().toLowerCase();
                    const searchClientUsername = (r.clientUsername || '').trim().toLowerCase();
                    matchedIdx = updatedBillingRows.findIndex((br: any) => 
                      (searchClientId && br.clientId && br.clientId.trim().toLowerCase() === searchClientId) ||
                      (searchClientUsername && br.username && br.username.trim().toLowerCase() === searchClientUsername)
                    );
                  }

                  // 2. Fallback to typed matching by ID or Username
                  if (matchedIdx === -1 && hasId) {
                    const searchId = r.cId.trim().toLowerCase();
                    matchedIdx = updatedBillingRows.findIndex((br: any) => 
                      (br.clientId && br.clientId.trim().toLowerCase() === searchId) ||
                      (br.username && br.username.trim().toLowerCase() === searchId)
                    );
                  }

                  // 3. Last fallback: match by Name
                  if (matchedIdx === -1 && hasName) {
                    const searchName = r.name.trim().toLowerCase();
                    matchedIdx = updatedBillingRows.findIndex((br: any) => 
                      br.name && br.name.trim().toLowerCase() === searchName
                    );
                  }

                  if (matchedIdx !== -1) {
                    const amountVal = Number(r.amount) || 0;
                    const amountStr = String(r.amount).toUpperCase();
                    const isStatusString = ['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL'].includes(amountStr);
                    const row = updatedBillingRows[matchedIdx];
                    
                    // Do not automatically add payments to TDC or DC users
                    if (row.paymentStatus === 'tdc' || row.paymentStatus === 'dc') {
                      return;
                    }

                    const savedOrigCr = row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0);
                    const base = parseFloat(row.baseAmount || 0);

                    // Keep original CR and totalAmount intact, just record payment
                    const totalAmount = base + savedOrigCr;
                    let finalStatus = 'partial';
                    
                    if (isStatusString) {
                      finalStatus = amountStr.toLowerCase();
                    } else if (r.status) {
                      finalStatus = r.status;
                    } else if (amountVal === 0) {
                      finalStatus = 'unpaid';
                    } else if (amountVal >= totalAmount) {
                      finalStatus = 'paid';
                    }

                    updatedBillingRows[matchedIdx] = {
                      ...row,
                      _originalCr: savedOrigCr,
                      cr: savedOrigCr, // Do not destructively modify CR
                      totalAmount: totalAmount, // Do not destructively modify totalAmount
                      paymentReceived: isStatusString ? (finalStatus === 'paid' ? totalAmount : 0) : amountVal,
                      paymentStatus: finalStatus
                    };
                    updatedCount++;
                  }
                });

                if (updatedCount > 0) {
                  totalUpdatedBillingCount += updatedCount;
                  await firebaseService.saveBillingMonth(
                    targetMonthId, 
                    updatedBillingRows, 
                    currentUser.username || 'admin',
                    activeDealerId
                  );
                }
              } catch (billingErr: any) {
                console.error("Failed to auto-update billing status for sheet index:", i, billingErr);
              }
            }
          }
        }
      }

      if (anySaved) {
        toast.success(loadedSheetId ? "Ledger page updated successfully!" : "Ledger sheet compile successfully saved!");
        if (totalUpdatedBillingCount > 0) {
          toast.success(`Automatically updated ${totalUpdatedBillingCount} subscriber(s) designated recovery amounts in ${currentMonthId}!`);
        }
        
        // Pin the saved ID as the currently loaded sheet so subsequent edits modify this same sheet
        if (lastSavedId) {
          setLoadedSheetId(lastSavedId);
          setSheets(prev => {
            const next = [...prev];
            if (next[activeSheetIdx]) {
              next[activeSheetIdx] = {
                ...next[activeSheetIdx],
                id: lastSavedId
              };
            }
            return next;
          });
        }
      }
    } catch (e: any) {
      toast.dismiss("ledger-save");
      toast.error(getCleanErrorMessage(e));
    }
  };

  // Restores a historical ledger card directly back into the live active A4 view
  const handleLoadHistorySheet = (sheet: any) => {
    setLoadedSheetId(sheet.id);
    setRecOfficer(sheet.recOfficer || '');
    setRecOfficerLabel(sheet.recOfficerLabel || 'REC. OFFICER');
    setArea(sheet.area || 'MAIN');
    setAreaLabel(sheet.areaLabel || 'AREA');
    setSheetDate(sheet.sheetDate || '');
    setDateLabel(sheet.dateLabel || 'DATE');

    // Restore table 1rows
    const reT1 = (Array.isArray(sheet.table1Rows) ? sheet.table1Rows : []).map((r: any) => ({
      sr: r.sr,
      cId: r.cId || '',
      name: r.name || '',
      comments: r.comments || '',
      amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
      ch: !!r.ch,
      originalAmount: r.originalAmount || r.amount || 0,
      clientId: r.clientId || '',
      clientUsername: r.clientUsername || ''
    }));
    while (reT1.length < 22) {
      reT1.push({
        sr: reT1.length + 1,
        cId: '',
        name: '',
        comments: '',
        amount: 0,
        ch: false,
        clientId: '',
        clientUsername: ''
      });
    }
    setTable1Rows(reT1);

    // Restore table 2rows
    const reT2 = (Array.isArray(sheet.table2Rows) ? sheet.table2Rows : []).map((r: any) => ({
      sr: r.sr,
      name: r.name || '',
      amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
      ch: !!r.ch
    }));
    while (reT2.length < 3) {
      reT2.push({
        sr: reT2.length + 1,
        name: reT2.length === 0 ? 'Bank' : reT2.length === 1 ? 'Panel Balance' : 'Cash Hand',
        amount: 0,
        ch: false
      });
    }
    setTable2Rows(reT2);

    setCashReceived(sheet.cashReceived || '');
    setSign(sheet.sign || '');
    setSubmitted(sheet.submitted || '');
    setCashReceivedLabel(sheet.cashReceivedLabel || 'CASH RECEIVED');
    setSignLabel(sheet.signLabel || 'SIGN');
    setSubmittedLabel(sheet.submittedLabel || 'SUBMITTED');

    setFootnoteLeft(sheet.footnoteLeft || 'Enterprise Ledger Dispatch System');
    setFootnoteRight(sheet.footnoteRight || 'GENv2.5 // A4 PRINTABLE');

    // Initialize multi-sheet view to hold this restored card
    const restoredSheet: any = {
      id: sheet.id || Math.random().toString(36).substring(7),
      recOfficer: sheet.recOfficer || '',
      recOfficerLabel: sheet.recOfficerLabel || 'REC. OFFICER',
      area: sheet.area || 'MAIN',
      areaLabel: sheet.areaLabel || 'AREA',
      sheetDate: sheet.sheetDate || '',
      dateLabel: sheet.dateLabel || 'DATE',
      table1Rows: reT1,
      table2Rows: reT2,
      cashReceived: sheet.cashReceived || '',
      sign: sheet.sign || '',
      submitted: sheet.submitted || '',
      cashReceivedLabel: sheet.cashReceivedLabel || 'CASH RECEIVED',
      signLabel: sheet.signLabel || 'SIGN',
      submittedLabel: sheet.submittedLabel || 'SUBMITTED',
      footnoteLeft: sheet.footnoteLeft || 'Enterprise Ledger Dispatch System',
      footnoteRight: sheet.footnoteRight || 'GENv2.5 // A4 PRINTABLE',
      t1Headers: sheet.t1Headers || ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH'],
      t2Headers: sheet.t2Headers || ['SR', 'NAME', 'AMOUNT', 'CH'],
      t1TotalLabel: sheet.t1TotalLabel || 'TOTAL',
      t2TotalLabel: sheet.t2TotalLabel || 'TOTAL',
    };
    
    isSwappingRef.current = true;
    setSheets([restoredSheet]);
    setActiveSheetIdx(0);
    setTimeout(() => {
      isSwappingRef.current = false;
    }, 50);

    toast.info(`Loaded sheet card for recovery officer: ${sheet.recOfficer}`);
    setActiveView('editor');
  };

  // Delete a single historical card from Firestore registry logs
  const handleDeleteHistorySheet = async (sheetId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid loading the sheet on card click
    
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to delete historical logs."
      });
      return;
    }

    const confirmDel = window.confirm("Are you sure you want to delete this historical ledger card?");
    if (!confirmDel) return;

    try {
      await firebaseService.deleteLedgerSheet(sheetId);
      toast.success("Ledger card deleted successfully.");
      if (loadedSheetId === sheetId) {
        resetToBlank();
        setLoadedSheetId(null);
      }
    } catch (err: any) {
      toast.error(getCleanErrorMessage(err));
    }
  };

  // Perform a Google OAuth integration explicitly targetting the user's SECOND/BACKUP Google Account (pop-up)
  const handleConnectBackupAccount = async () => {
    try {
      const tokens = await googleSheetsService.initiateBackupAuth();
      if (tokens) {
        setBackupTokens(tokens);
        toast.success("Authorized with backup Google Account successfully!");
      }
    } catch (e: any) {
      toast.error(e.message || "Google backup login failed. Please allow popups.");
    }
  };

  // Automatically create a Google Spreadsheet to write the journal backup under the secondary account
  const handleCreateBackupSheet = async () => {
    if (!backupTokens) {
      toast.error("Please connect your Google backup account first.");
      return;
    }
    try {
      toast.loading("Creating Google Sheet in cloud drive...", { id: "sheet-create" });
      const currentMonthText = sheetDate.split('-')[1]?.trim() || String(new Date().getMonth() + 1);
      const res = await googleSheetsService.createBackupSpreadsheet(`Monthly Recovery Ledger Backup (Month: ${currentMonthText})`, backupTokens);
      toast.dismiss("sheet-create");
      if (res && res.spreadsheetId) {
        setBackupSpreadsheetId(res.spreadsheetId);
        toast.success("New spreadsheet created in your backup account!");
      }
    } catch (e: any) {
      toast.dismiss("sheet-create");
      toast.error(e.message || "Google spreadsheet creation failed.");
    }
  };

  // Backup all history entries cleanly separated and sorted inside one single Google Sheet
  const handleBackupLedgerHistory = async () => {
    if (!backupTokens) {
      toast.error("Please connect your secondary Google account first.");
      return;
    }
    if (!backupSpreadsheetId) {
      toast.error("Please specify or automatically create a target Backup Google Sheet ID first.");
      return;
    }
    if (ledgerHistory.length === 0) {
      toast.error("There are no historical ledger sheets in this month's register to backup.");
      return;
    }

    try {
      setIsBackingUp(true);
      toast.loading("Exporting recovery cards in separate sections by date...", { id: "backup-proc" });
      await googleSheetsService.exportLedgerSheetsToSheets(ledgerHistory, backupTokens, backupSpreadsheetId);
      toast.dismiss("backup-proc");
      setIsBackingUp(false);
      toast.success("Successfully backed up all ledger records in beautifully structured date sections!");
    } catch (e: any) {
      toast.dismiss("backup-proc");
      setIsBackingUp(false);
      toast.error(e.message || "Backup failed. Make sure your sheet permits editing.");
    }
  };

  // Purge/clear all month-end sheets from Firestore to start a new month cycle afresh
  const handleTerminateMonth = async () => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to terminate the ongoing billing month."
      });
      return;
    }
    const confirmReset = window.confirm(
      "☢️ WARNING: CRITICAL RESETS TRIGGERED\n\nThis will permanently delete ALL historical sheets & card records in your database forever. Please verify you have taken a full Google spreadsheet backup first.\n\nType OK to continue."
    );
    if (!confirmReset) return;

    try {
      const tenantId = firebaseService.getReadTenantId(currentUser as any);
      toast.loading("Purging all monthly cards from Firebase registry...", { id: "terminate-proc" });
      await firebaseService.terminateAllLedgerSheets(tenantId);
      toast.dismiss("terminate-proc");
      toast.success("Month terminated cleanly! Sheet cards starting fresh.");
      resetToBlank();
      setLoadedSheetId(null);
    } catch (e: any) {
      toast.dismiss("terminate-proc");
      toast.error("Failed to terminate month: " + getCleanErrorMessage(e));
    }
  };

  // Confirmation handler for complete workspace reset & purge
  const handleResetWorkspaceAndHistory = async (deleteHistory: boolean) => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to clear workspace records."
      });
      return;
    }
    try {
      if (deleteHistory) {
        const tenantId = firebaseService.getReadTenantId(currentUser as any);
        toast.loading("Purging all registered monthly sheets...", { id: "reset-all-proc" });
        await firebaseService.terminateAllLedgerSheets(tenantId);
        toast.dismiss("reset-all-proc");
        toast.success("Active workspace reset and all registered sheet history purged successfully!");
      } else {
        toast.success("Active workspace fields reset successfully!");
      }
      resetToBlank();
      setLoadedSheetId(null);
      setShowConfirmResetModal(false);
    } catch (e: any) {
      toast.dismiss("reset-all-proc");
      toast.error("Failed to reset workspace: " + getCleanErrorMessage(e));
    }
  };

  // Deep search query filtering for customer IDs, usernames, details, or recovery officer fields
  const getFilteredHistory = () => {
    if (!historySearchQuery.trim()) return ledgerHistory;
    const q = historySearchQuery.toLowerCase();
    return ledgerHistory.filter(sheet => {
      if (sheet.recOfficer?.toLowerCase().includes(q)) return true;
      if (sheet.area?.toLowerCase().includes(q)) return true;
      if (sheet.sheetDate?.toLowerCase().includes(q)) return true;
      
      if (sheet.table1Rows && Array.isArray(sheet.table1Rows)) {
        const itemMatch = sheet.table1Rows.some((r: any) => 
          (r.cId && String(r.cId).toLowerCase().includes(q)) ||
          (r.name && String(r.name).toLowerCase().includes(q)) ||
          (r.comments && String(r.comments).toLowerCase().includes(q))
        );
        if (itemMatch) return true;
      }
      return false;
    });
  };


  // Render nothing if closed
  if (!isOpen) return null;

  // Calculators
  const totalAmount1 = table1Rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalAmount2 = table2Rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Edit helper for Table 1
  const handleT1Change = (index: number, field: keyof Table1Row, value: any) => {
    if (isLocked) return;
    const updated = [...table1Rows];
    let commentsVal = updated[index].comments;

    if (field === 'comments') {
      commentsVal = value;
    } else if (field === 'amount') {
      const orig = updated[index].originalAmount;
      const isStatusString = ['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL'].includes(String(value).toUpperCase());
      if (typeof orig === 'number' && !isStatusString) {
        const newAmt = parseFloat(value) || 0;
        if (newAmt > orig) {
          commentsVal = 'Upgrade';
        } else if (newAmt < orig) {
          commentsVal = 'Downgrade';
        } else {
          if (commentsVal === 'Upgrade' || commentsVal === 'Downgrade') {
            commentsVal = '';
          }
        }
      } else if (isStatusString) {
        if (commentsVal === 'Upgrade' || commentsVal === 'Downgrade') {
          commentsVal = '';
        }
      }
    }

    updated[index] = {
      ...updated[index],
      [field]: value,
      comments: commentsVal
    };

    if (field === 'name') {
      updated[index].clientId = undefined;
      updated[index].clientUsername = undefined;
    }
    setTable1Rows(updated);
  };

  // Edit helper for Table 2
  const handleT2Change = (index: number, field: keyof Table2Row, value: any) => {
    if (isLocked) return;
    const updated = [...table2Rows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setTable2Rows(updated);
  };

  const proceedSelectSuggestion = (index: number, client: any) => {
    const matchingActiveRow = activeRows?.find(r => 
      (r.username && r.username.toLowerCase() === client.username?.toLowerCase()) || 
      (r.clientId && r.clientId.toLowerCase() === client.id?.toLowerCase())
    );

    const updated = [...table1Rows];
    let amount = 0;
    
    if (matchingActiveRow) {
      const isDcOrTdc = matchingActiveRow.paymentStatus === 'dc' || matchingActiveRow.paymentStatus === 'tdc';
      const totalAmt = isDcOrTdc ? 0 : (parseFloat(matchingActiveRow.totalAmount) || 0);
      const rcvAmt = isDcOrTdc ? 0 : (parseFloat(matchingActiveRow.paymentReceived) || 0);
      const outstanding = totalAmt - rcvAmt;
      amount = outstanding > 0 ? outstanding : totalAmt;
    } else {
      if (client.pkgDetails) {
        const match = client.pkgDetails.match(/\b(1000|1200|1500|2000|2500|3000|3500|4000|5000|150|200|250|300|350|400|450|500|600|700|800|900)\b/) || client.pkgDetails.match(/\b\d{3,4}\b/);
        amount = match ? parseInt(match[0], 10) : 0;
      }
    }

    updated[index] = {
      ...updated[index],
      name: client.name || '',
      amount: amount,
      originalAmount: amount,
      clientId: client.id || '',
      clientUsername: client.username || ''
    };
    
    setTable1Rows(updated);
    setFocusedRowIndex(null);
    setFocusedField(null);
    setSearchQuery('');
  };

  const handleSelectSuggestion = (index: number, client: any) => {
    if (isLocked) return;

    const currentSheetId = sheets[activeSheetIdx]?.id;
    const currentFolderId = sheetFolderMap[currentSheetId];

    if (currentFolderId) {
      const folderSheets = ledgerHistory.filter(sh => sheetFolderMap[sh.id] === currentFolderId);
      let duplicateFound = false;
      let dupLocation = "";

      const isDupInCurrent = table1Rows.some((r, i) => i !== index && (
        (r.clientId && r.clientId === client.id) || 
        (r.clientUsername && r.clientUsername === client.username) ||
        (r.name && r.name.toLowerCase() === client.name?.toLowerCase())
      ));

      if (isDupInCurrent) {
        duplicateFound = true;
        dupLocation = "this current sheet";
      } else {
        for (const sh of folderSheets) {
          if (sh.id === currentSheetId) continue;
          const rows = Array.isArray(sh.table1Rows) ? sh.table1Rows : [];
          const isDup = rows.some((r: any) => 
            (r.clientId && r.clientId === client.id) || 
            (r.clientUsername && r.clientUsername === client.username) ||
            (r.name && r.name.toLowerCase() === client.name?.toLowerCase())
          );
          if (isDup) {
            duplicateFound = true;
            dupLocation = `sheet "${sh.recOfficer || 'Unnamed'}"`;
            break;
          }
        }
      }

      if (duplicateFound) {
        setDuplicateWarning({
          index,
          client,
          message: `This user (${client.username || client.name}) already exists in ${dupLocation} within this folder. Are you sure you want to add a double entry?`
        });
        return;
      }
    }

    proceedSelectSuggestion(index, client);
  };

  const getFilteredSuggestions = (field: 'cId' | 'name', queryValue: string) => {
    let sourceList = [...clients];
    
    // Build fallback list dynamically from active monthly payments if Firestore list is empty
    if (sourceList.length === 0 && activeRows && activeRows.length > 0) {
      const seen = new Set();
      activeRows.forEach(r => {
        const key = (r.username || r.clientId || r.name || '').toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          sourceList.push({
            id: r.clientId || r.username || '',
            username: r.username || r.clientId || '',
            name: r.name || '',
            mobileNumber: r.mobileNumber || '',
            pkgDetails: r.pkgDetails || r.comments || '',
            area: r.area || ''
          });
        }
      });
    }

    if (!queryValue.trim()) {
      return sourceList.slice(0, 8);
    }

    const q = queryValue.toLowerCase();
    return sourceList.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q))
    ).slice(0, 8);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportUserLedgerToPDF = (resultsArray: any[]) => {
    if (resultsArray.length === 0) {
      toast.error('No ledger history found for the current search.');
      return;
    }

    const doc = new jsPDF();
    
    // Add title line
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900 color
    doc.text('Green Tech Services', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500 color
    doc.text('User Ledger Vault | Enterprise Management Console', 14, 27);
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('TRANSACTION HISTORY STATEMENT', 14, 38);

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600 color
    doc.text(`User Reference: ${ledgerSearchUser}`, 14, 44);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 49);

    const tableRows = resultsArray.map(res => [
      res.date,
      res.folderName,
      `${res.userName}\nPPPoE ID: ${res.userId || '-'}\nPKG: ${res.pkgDetails || '-'}\nPANEL: ${res.panelDetails || '-'}`,
      res.recOfficer,
      res.comments || '-',
      `PKR ${res.amount.toLocaleString()}`
    ]);

    const totalAggregate = resultsArray.reduce((acc, curr) => acc + curr.amount, 0);

    autoTable(doc, {
      startY: 56,
      head: [['Date', 'Folder/Month', 'User / Target & Connection Details', 'Recovery Officer', 'Comments/Ref', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      foot: [['', '', '', '', 'Total Aggregate Recovery:', `PKR ${totalAggregate.toLocaleString()}`]],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        5: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const safeSearchName = ledgerSearchUser.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`GTS_Ledger_Statement_${safeSearchName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Transaction history downloaded successfully as PDF!');
  };

  const renderUserLedger = () => {
    let filteredSheets = ledgerHistory;
    if (ledgerSelectedFolder !== 'all') {
      filteredSheets = ledgerHistory.filter(sh => sheetFolderMap[sh.id] === ledgerSelectedFolder);
    }

    const keyword = ledgerSearchUser.toLowerCase().trim();
    const results: any[] = [];

    if (keyword) {
      filteredSheets.forEach(sh => {
        const folderId = sheetFolderMap[sh.id];
        const folder = folders.find(f => f.id === folderId);
        const folderName = folder ? folder.name : 'Uncategorized';

        // Check T1
        (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).forEach((r: any) => {
          const match = r.cId?.toLowerCase().includes(keyword) || r.name?.toLowerCase().includes(keyword) || r.clientUsername?.toLowerCase().includes(keyword);
          if (match && Number(r.amount) > 0) {
            // Find corresponding client for extra connection info
            const matchClient = clients.find(c => 
              (r.clientUsername && c.username?.toLowerCase() === r.clientUsername.toLowerCase()) ||
              (r.cId && c.username?.toLowerCase() === r.cId.toLowerCase()) ||
              (r.clientId && c.id === r.clientId) ||
              (c.name?.toLowerCase() === (r.name || '').toLowerCase())
            );

            results.push({
              sheetId: sh.id,
              date: sh.sheetDate || 'Unknown Date',
              recOfficer: sh.recOfficer || 'Unknown',
              folderName,
              userName: r.name || r.clientUsername || r.clientId || r.cId,
              amount: Number(r.amount) || 0,
              comments: r.comments || '',
              type: 'T1',
              userId: matchClient?.username || r.cId || r.clientUsername || '-',
              pkgDetails: matchClient?.pkgDetails || '-',
              panelDetails: matchClient?.panelDetails || '-'
            });
          }
        });

        // Check T2
        (Array.isArray(sh.table2Rows) ? sh.table2Rows : []).forEach((r: any) => {
          const match = r.name?.toLowerCase().includes(keyword);
          if (match && Number(r.amount) > 0) {
            // Find corresponding client
            const matchClient = clients.find(c => 
              c.name?.toLowerCase() === (r.name || '').toLowerCase() ||
              c.username?.toLowerCase() === (r.name || '').toLowerCase()
            );

            results.push({
              sheetId: sh.id,
              date: sh.sheetDate || 'Unknown Date',
              recOfficer: sh.recOfficer || 'Unknown',
              folderName,
              userName: r.name,
              amount: Number(r.amount) || 0,
              comments: '',
              type: 'T2',
              userId: matchClient?.username || '-',
              pkgDetails: matchClient?.pkgDetails || '-',
              panelDetails: matchClient?.panelDetails || '-'
            });
          }
        });
      });
    }
    
    // Sort results by date descendant
    results.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return (
      <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 flex flex-col gap-6 select-none scrollbar-thin print:p-0 print:bg-white print:h-auto print:overflow-visible">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            .user-ledger-print-block, .user-ledger-print-block * {
              visibility: visible !important;
            }
            .user-ledger-print-block {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `}} />
        <div className="max-w-5xl mx-auto w-full space-y-6 print:space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 print:hidden">
             <div className="flex items-center gap-3">
               <button onClick={() => {
                 setShowUserLedger(false);
                 onClose();
               }} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                 <ArrowLeft size={18} />
               </button>
               <h1 className="text-xl font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                 <UserPlus size={22} className="text-blue-500" />
                 User Ledger Vault
               </h1>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
             <div className="flex-1 space-y-1">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Search User</label>
               <div className="relative">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                 <input 
                   type="text" 
                   value={ledgerSearchUser}
                   onChange={(e) => setLedgerSearchUser(e.target.value)}
                   placeholder="Enter Name, User ID, or PPPoE..." 
                   className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                 />
               </div>
             </div>
             
             <div className="w-full sm:w-64 space-y-1">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filter By Month (Folder)</label>
               <select 
                 value={ledgerSelectedFolder}
                 onChange={(e) => setLedgerSelectedFolder(e.target.value)}
                 className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 transition-all outline-none"
               >
                 <option value="all">ALL VOLUMES / MONTHS</option>
                 {folders.map(f => (
                   <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>
                 ))}
               </select>
             </div>
          </div>

          {keyword ? (
            <div className="user-ledger-print-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none">
               <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center print:bg-white print:border-none print:p-0 print:mb-4">
                 <div>
                   <h2 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider print:text-lg print:text-black">
                     Transaction History Statement
                   </h2>
                   <p className="hidden print:block text-xs font-bold text-slate-500 mt-1 uppercase">
                     User Reference: {ledgerSearchUser}
                   </p>
                 </div>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={() => exportUserLedgerToPDF(results)}
                     className="print:hidden text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                   >
                     <FileDown size={14} />
                     EXPORT PDF
                   </button>
                   <button 
                     onClick={() => window.print()}
                     className="print:hidden text-[10px] font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                   >
                     <Printer size={14} />
                     PRINT HISTORY
                   </button>
                   <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md print:hidden">
                     {results.length} Matches
                   </span>
                 </div>
               </div>
               
               <div className="overflow-x-auto print:overflow-visible">
                 <table className="w-full text-left whitespace-nowrap text-xs">
                   <thead className="bg-slate-100 dark:bg-slate-900/50">
                     <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                       <th className="py-3 px-5">Date</th>
                       <th className="py-3 px-5">Folder</th>
                       <th className="py-3 px-5">User / Target</th>
                       <th className="py-3 px-5">Recovery Officer</th>
                       <th className="py-3 px-5">Comments/Ref</th>
                       <th className="py-3 px-5 text-right">Amount (PKR)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                     {results.length > 0 ? results.map((res, i) => (
                       <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                         <td className="py-3 px-5 font-mono text-slate-800 dark:text-slate-200">{res.date}</td>
                         <td className="py-3 px-5"><span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-bold uppercase text-[9px] text-slate-600 dark:text-slate-400">{res.folderName}</span></td>
                         <td className="py-3 px-5 font-bold text-slate-900 dark:text-white capitalize">
                            <div className="flex flex-col gap-1 text-left">
                              <span className="font-bold text-slate-900 dark:text-white capitalize text-xs">{res.userName}</span>
                              <div className="flex flex-wrap gap-1 items-center mt-0.5">
                                {res.userId && res.userId !== '-' && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-mono text-[9px] font-black rounded border border-blue-105 dark:border-blue-900/20">
                                    ID: {res.userId}
                                  </span>
                                )}
                                {res.pkgDetails && res.pkgDetails !== '-' && (
                                  <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded border border-indigo-105 dark:border-indigo-900/20">
                                    PKG: {res.pkgDetails}
                                  </span>
                                )}
                                {res.panelDetails && res.panelDetails !== '-' && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[9px] font-bold rounded border border-amber-105 dark:border-amber-900/15">
                                    PANEL: {res.panelDetails}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                         <td className="py-3 px-5 text-slate-600 dark:text-slate-400">{res.recOfficer}</td>
                         <td className="py-3 px-5 text-slate-500 text-[10px] italic">{res.comments || '-'}</td>
                         <td className="py-3 px-5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                           + {res.amount.toLocaleString()}
                         </td>
                       </tr>
                     )) : (
                       <tr>
                         <td colSpan={6} className="py-12 text-center text-slate-400 font-medium text-sm">
                           No payments logged for "{ledgerSearchUser}"
                         </td>
                       </tr>
                     )}
                   </tbody>
                   {results.length > 0 && (
                     <tfoot className="bg-slate-50 dark:bg-slate-900">
                       <tr className="border-t-2 border-slate-200 dark:border-slate-800 font-black uppercase text-[11px] text-slate-800 dark:text-slate-200">
                         <td colSpan={5} className="py-4 px-5 text-right">Total Aggregate Recovery:</td>
                         <td className="py-4 px-5 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-500/10 shadow-inner">
                           PKR {results.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                         </td>
                       </tr>
                     </tfoot>
                   )}
                 </table>
               </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto opacity-50" />
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Vault Awaiting Query</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Enter a user name, PPPoE ID, or reference in the search above to instantly pull their full lifetime recovery lineage.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const parseDateValue = (dateStr?: string, fallbackTs?: number) => {
      if (!dateStr) return fallbackTs || 0;
      const parts = dateStr.split(/[-/]/).map(p => p.trim());
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const year = y < 100 ? 2000 + y : y;
          return new Date(year, m - 1, d).getTime();
        }
      }
      const parsed = Date.parse(dateStr);
      return isNaN(parsed) ? (fallbackTs || 0) : parsed;
    };

    // Group sheets into folders based on sheetFolderMap
    let uncategorizedSheets = ledgerHistory.filter(sh => !sheetFolderMap[sh.id]);

    uncategorizedSheets.sort((a, b) => {
      if (folderSortOption === 'a-to-z') {
        const nameA = (a.recOfficer || '').toLowerCase();
        const nameB = (b.recOfficer || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (folderSortOption === 'amount-high' || folderSortOption === 'amount-low') {
        const t1AmA = (Array.isArray(a.table1Rows) ? a.table1Rows : []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const t1AmB = (Array.isArray(b.table1Rows) ? b.table1Rows : []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        return folderSortOption === 'amount-high' ? t1AmB - t1AmA : t1AmA - t1AmB;
      }
      
      const dateA = parseDateValue(a.sheetDate, a.createdAt);
      const dateB = parseDateValue(b.sheetDate, b.createdAt);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    // Filter search query across sheets
    const filterKeyword = dashboardSearchQuery.toLowerCase().trim();
    const doesMatchSearch = (sh: any) => {
      if (!filterKeyword) return true;
      if (sh.recOfficer?.toLowerCase().includes(filterKeyword)) return true;
      if (sh.area?.toLowerCase().includes(filterKeyword)) return true;
      if (sh.sheetDate?.toLowerCase().includes(filterKeyword)) return true;

      // Deep search inside client entries in Table 1
      if (sh.table1Rows && Array.isArray(sh.table1Rows)) {
        const matchT1 = sh.table1Rows.some((r: any) => {
          const cId = String(r.cId || '').toLowerCase();
          const name = String(r.name || '').toLowerCase();
          const comments = String(r.comments || '').toLowerCase();
          const clientId = String(r.clientId || '').toLowerCase();
          const clientUsername = String(r.clientUsername || '').toLowerCase();

          return (
            cId.includes(filterKeyword) ||
            name.includes(filterKeyword) ||
            comments.includes(filterKeyword) ||
            clientId.includes(filterKeyword) ||
            clientUsername.includes(filterKeyword)
          );
        });
        if (matchT1) return true;
      }

      // Deep search inside Table 2 rows
      if (sh.table2Rows && Array.isArray(sh.table2Rows)) {
        const matchT2 = sh.table2Rows.some((r: any) => {
          const name = String(r.name || '').toLowerCase();
          return name.includes(filterKeyword);
        });
        if (matchT2) return true;
      }

      return false;
    };

    const activeFolder = folders.find(f => f.id === openedFolderId);
    let openedFolderSheets = activeFolder 
      ? ledgerHistory.filter(sh => sheetFolderMap[sh.id] === activeFolder.id && doesMatchSearch(sh)) 
      : [];

    openedFolderSheets.sort((a, b) => {
      if (folderSortOption === 'a-to-z') {
        const nameA = (a.recOfficer || '').toLowerCase();
        const nameB = (b.recOfficer || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (folderSortOption === 'amount-high' || folderSortOption === 'amount-low') {
        const t1AmA = (Array.isArray(a.table1Rows) ? a.table1Rows : []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const t1AmB = (Array.isArray(b.table1Rows) ? b.table1Rows : []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        return folderSortOption === 'amount-high' ? t1AmB - t1AmA : t1AmA - t1AmB;
      }
      
      // Default: Date (Newest first)
      const dateA = parseDateValue(a.sheetDate, a.createdAt);
      const dateB = parseDateValue(b.sheetDate, b.createdAt);
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return (
      <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 flex flex-col gap-6 select-none scrollbar-thin">
        {/* Upper Header info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-850 pb-5 w-full">
          <div className="flex items-center justify-between w-full md:w-auto gap-2">
            <div className="text-left flex-1 min-w-0">
              <h1 className="text-sm min-[380px]:text-base sm:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    if (openedFolderId) {
                      setOpenedFolderId(null);
                    } else {
                      onClose();
                    }
                  }}
                  className="p-1 sm:p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mr-0.5 sm:mr-1 flex items-center justify-center cursor-pointer shrink-0"
                  title="Go Back"
                >
                  <ArrowLeft size={16} className="sm:size-[20px]" />
                </button>
                <FolderOpen className="text-blue-500 animate-pulse shrink-0 sm:size-[26px]" size={18} />
                <span className="truncate">Data Folders</span>
              </h1>
              {openedFolderId && (
                <p className="text-[9px] sm:text-xs text-slate-450 dark:text-slate-400 font-semibold uppercase tracking-wide mt-1 truncate">
                  Exploring database files located in /{activeFolder?.name || 'Volume'}
                </p>
              )}
            </div>

            {/* Mobile-only container for Create Folder button so it always shows next to Data Folders in mobile view */}
            <div className="flex md:hidden items-center gap-1 shrink-0">
              {!isCreatingFolder ? (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-[9px] min-[360px]:text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <FolderPlus size={12} />
                  <span className="hidden min-[360px]:inline">New Folder</span>
                  <span className="min-[360px]:hidden">New</span>
                </button>
              ) : (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                  <input
                    type="text"
                    placeholder="Name..."
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    className="px-1.5 py-1 text-[10px] bg-transparent border-none outline-none text-slate-950 dark:text-slate-100 w-16 min-[360px]:w-24 font-bold"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all text-[9px] font-bold"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreatingFolder(false); setNewFolderNameInput(''); }}
                    className="p-0.5 bg-slate-300 dark:bg-slate-800 text-slate-705 dark:text-slate-300 rounded-md text-[9px] font-bold"
                  >
                    <X size={10} />
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search filter - displayed only when a folder is selected */}
            {openedFolderId && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={folderSortOption}
                  onChange={(e) => setFolderSortOption(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-300 text-[10px] items-center font-bold uppercase transition-colors hover:border-slate-300 dark:hover:border-slate-700 py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                >
                  <option value="newest">Latest Date (Default)</option>
                  <option value="a-to-z">Alphabetical (A-Z)</option>
                  <option value="amount-high">Amount (Highest)</option>
                  <option value="amount-low">Amount (Lowest)</option>
                </select>
                <div className="relative flex-1 sm:flex-initial sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Sheets..."
                    value={dashboardSearchQuery}
                    onChange={(e) => setDashboardSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-550 transition-all text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchUserClick}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-650 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:via-emerald-555 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-500/20 active:scale-95 shadow-md shadow-emerald-600/10 shrink-0"
                  title="Search User Entry"
                >
                  <Sparkles size={11} className="text-white animate-pulse" />
                  <span>Search Entry</span>
                </button>
              </div>
            )}

            {/* Desktop-only container for Create Folder button */}
            <div className="hidden md:block">
              {!isCreatingFolder ? (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus size={14} />
                  New Folder
                </button>
              ) : (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="Folder Name..."
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-transparent border-none outline-none text-slate-950 dark:text-slate-100 w-36 font-bold"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-xs font-bold"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreatingFolder(false); setNewFolderNameInput(''); }}
                    className="p-1.5 bg-slate-300 dark:bg-slate-800 text-slate-705 dark:text-slate-300 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Directory Breadcrumbs / Back button */}
        {openedFolderId && (
          <div className="flex items-center gap-3 text-left">
            <button
              onClick={() => setOpenedFolderId(null)}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <ChevronLeft size={16} className="text-slate-505" />
              Back to PC Directory
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-850" />
            <div className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span>GTS SYSTEM DRIVE</span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-blue-500 flex items-center gap-1">
                <FolderOpen size={13} className="fill-blue-500/10" />
                {activeFolder?.name}
              </span>
            </div>
          </div>
        )}

        {!openedFolderId ? (
          /* ================= ROOT DIRECTORY (PC DESKTOP FOLDERS) ================= */
          <div className="flex flex-col gap-4 text-left">
            {/* Folders grid styled as real PC drive folder icons */}
            <div className="mt-1">
              {(() => {
                const sortedFolders = [...folders].sort((a, b) => {
                  const timeA = a.createdAt || (a.id.startsWith('folder_') ? parseInt(a.id.split('_')[1]) || 0 : 0);
                  const timeB = b.createdAt || (b.id.startsWith('folder_') ? parseInt(b.id.split('_')[1]) || 0 : 0);
                  return timeB - timeA;
                });
                return (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2.5 sm:gap-3">
                    {sortedFolders.map((folder) => {
                      const folderSheets = ledgerHistory.filter(sh => sheetFolderMap[sh.id] === folder.id && doesMatchSearch(sh));
                      return (
                        <motion.div
                          key={folder.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 220, damping: 18 }}
                          onClick={() => setOpenedFolderId(folder.id)}
                          className="group cursor-pointer p-3 bg-transparent border-0 shadow-none hover:bg-slate-100/50 dark:hover:bg-slate-850/30 rounded-2xl flex flex-col items-center justify-start text-center gap-1.5 transition-all duration-300 relative select-none min-h-[170px]"
                        >
                          {/* Folder Settings Gear Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingsFolderId(folder.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 z-40 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-blue-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            <Settings size={12} />
                          </button>

                          {/* Folder PC-style Visual Representation Shape */}
                          <div className="relative w-28 h-18 flex items-center justify-center shrink-0 pointer-events-none perspective-500">
                            {/* Glowing shadow effect behind folder */}
                            <div className="absolute inset-2 bg-amber-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-300" />

                            {/* Gold folder back tab (lifts up) */}
                            <div className="absolute top-0.5 left-2.5 w-11 h-4.5 bg-[#e29302] rounded-t-lg opacity-90 -translate-y-px group-hover:-translate-y-1.5 transition-transform duration-300 ease-out origin-bottom" style={{ clipPath: 'polygon(0% 100%, 10% 0%, 90% 0%, 100% 100%)' }} />
                            
                            {/* Main folder back cover (Amber-gold) */}
                            <div className="absolute top-2 inset-x-2.5 bottom-0 bg-[#e29302] rounded-lg group-hover:scale-[1.02] transition-transform duration-300 ease-out shadow-inner" />
                            
                            {/* Peeking multiple document sheets inside (animated overlapping slides) */}
                            {folderSheets.length > 0 ? (
                              <>
                                {/* Back document sheet */}
                                <div className="absolute w-16 h-14 bg-slate-100 dark:bg-slate-800 rounded-md shadow-sm border border-slate-200/50 dark:border-slate-700/60 -top-1.5 left-5 rotate-[-8deg] group-hover:-translate-y-5.5 group-hover:rotate-[-16deg] group-hover:scale-105 transition-all duration-300 ease-out flex flex-col gap-1 p-1.5 overflow-hidden">
                                  <div className="w-9 h-1 bg-amber-500/20 dark:bg-blue-500/20 rounded-full" />
                                  <div className="w-11 h-0.5 bg-slate-300/40 dark:bg-slate-700/40 rounded-full" />
                                  <div className="w-7 h-0.5 bg-slate-300/40 dark:bg-slate-700/40 rounded-full" />
                                </div>
                                {/* Middle document sheet */}
                                <div className="absolute w-16 h-14 bg-slate-50 dark:bg-slate-850 rounded-md shadow border border-slate-200/60 dark:border-slate-750/60 -top-2 left-7 rotate-[4deg] group-hover:-translate-y-7 group-hover:rotate-[14deg] group-hover:scale-105 transition-all duration-310 ease-out flex flex-col gap-1 p-1.5 overflow-hidden z-10">
                                  <div className="w-7 h-1 bg-emerald-500/20 dark:bg-emerald-500/20 rounded-full" />
                                  <div className="w-11 h-0.5 bg-slate-300/40 dark:bg-slate-700/40 rounded-full" />
                                  <div className="w-9 h-0.5 bg-slate-300/40 dark:bg-slate-700/40 rounded-full" />
                                </div>
                                {/* Frontmost document sheet */}
                                <div className="absolute w-16 h-14 bg-white dark:bg-slate-900 rounded-md shadow-md border border-slate-250 dark:border-slate-700 -top-2.5 left-6 rotate-[-2deg] group-hover:-translate-y-8 group-hover:rotate-[-2deg] group-hover:scale-110 transition-all duration-320 ease-out flex flex-col gap-1.5 p-1.5 overflow-hidden z-15">
                                  <div className="w-10 h-1 bg-blue-500/35 dark:bg-cyan-550/35 rounded-full" />
                                  <div className="w-11 h-0.5 bg-slate-400/25 dark:bg-slate-650/35 rounded-full" />
                                  <div className="w-12 h-0.5 bg-slate-400/25 dark:bg-slate-650/35 rounded-full" />
                                </div>
                              </>
                            ) : (
                              /* Empty Folder Placement Glow */
                              <div className="absolute w-14 h-11 bg-transparent border border-dashed border-amber-500/40 rounded-md -top-1 left-7 opacity-0 group-hover:opacity-100 group-hover:-translate-y-4.5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 flex items-center justify-center">
                                <Plus size={12} className="text-amber-600 animate-pulse stroke-[3]" />
                              </div>
                            )}

                            {/* Front cover sleeve of folder (Golden yellow matching the pic) */}
                            <div className="absolute bottom-1 inset-x-2.5 h-12 bg-gradient-to-b from-[#ffca28] to-[#ffb300] dark:from-[#ffca28] dark:to-[#ffa000] rounded-b-lg rounded-t-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] group-hover:rotate-x-12 group-hover:scale-y-[1.04] group-hover:translate-y-1 transition-all duration-300 z-20 overflow-hidden transform-gpu origin-bottom">
                              <div className="absolute inset-0 flex items-center justify-center z-40 mt-1">
                                <div className="px-1.5 py-0.5 bg-black/10 rounded-md shadow-inner backdrop-blur-sm">
                                  <span className="text-[9px] font-black text-[#5d4037] dark:text-[#ffecb3] uppercase tracking-widest leading-none">
                                    {folderSheets.length}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Info & Labels (details folder ke nichy show ho) */}
                          <div className="w-full text-center mt-1">
                            <p className="font-extrabold text-slate-800 dark:text-slate-100 truncate text-xs sm:text-[13px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-150 leading-tight">
                              {folder.name}
                            </p>
                            
                            {/* Modern Badge for amount or sheets */}
                            <div className="mt-1 flex flex-col gap-0.5 items-center justify-center">
                              {folderSheets.length > 0 ? (
                                <>
                                  {(() => {
                                    const totalAmount = folderSheets.reduce((sum, sh) => {
                                      const t1 = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                                      return sum + t1;
                                    }, 0);
                                    if (totalAmount > 0) {
                                      return (
                                        <span className="text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 select-none">
                                          Rs. {totalAmount.toLocaleString()}
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-slate-550 uppercase">
                                          Empty Folder
                                        </span>
                                      );
                                    }
                                  })()}
                                  <span className="text-[9px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider">
                                    {folderSheets.length} {folderSheets.length === 1 ? 'Sheet' : 'Sheets'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  No sheets
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick delete option */}
                          {folder.id !== 'june_data' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id, e);
                              }}
                              className="absolute top-2 left-2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 active:scale-90 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-30"
                              title="Delete Directory"
                            >
                              <Trash2 size={12} className="stroke-[2.5]" />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}
              {folders.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center min-h-[200px] mt-2">
                  <FolderPlus size={32} className="text-blue-550 dark:text-blue-400 mb-3 animate-bounce" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    No directory folders established yet
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold max-w-sm mt-1 uppercase tracking-wider leading-relaxed">
                    Set up your first recovery sheet folder directory below using the "New Volume Folder" input.
                  </p>
                </div>
              )}
            </div>

            {/* Uncategorized loose sheets as high-fidelity interactive file cards */}
            {uncategorizedSheets.length > 0 && (
              <div className="flex flex-col gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Loose Desktop Sheets
                  </h2>
                  <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-extrabold">
                    {uncategorizedSheets.length} Unsorted
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {uncategorizedSheets.filter(doesMatchSearch).map((sh) => {
                    const t1Am = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                    const docTotal = t1Am;
                    const filledLines = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).filter((r: any) => r.cId || r.name || r.amount > 0).length;
                    return (
                      <motion.div
                        layout
                        key={sh.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -4, scale: 1.015 }}
                        transition={{ type: "spring", stiffness: 300, damping: 22 }}
                        className="p-4.5 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-md border border-slate-205 dark:border-slate-850 hover:border-blue-500/40 dark:hover:border-blue-400/40 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:shadow-lg transition-all duration-200 group cursor-pointer"
                        onClick={() => handleLoadHistorySheet(sh)}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/10 text-amber-550 dark:text-amber-400 rounded-xl group-hover:scale-110 group-hover:from-amber-100 group-hover:to-amber-200 dark:group-hover:from-amber-900/30 dark:group-hover:to-amber-850/20 transition-all duration-300 shrink-0 shadow-sm border border-amber-200/5 shadow-amber-350/5">
                            <FileText className="w-5 h-5 stroke-[2]" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-150">
                              {sh.sheetDate || "No Date"}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest truncate leading-tight mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="font-extrabold text-slate-500 dark:text-slate-400">{sh.recOfficer || "No Officer"}</span>
                              <span className="text-slate-300 dark:text-slate-800">•</span>
                              <span className="text-slate-400 dark:text-slate-500 text-[8.5px]">{sh.area || "Main"}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                          <div className="flex items-center gap-1.5">
                            {docTotal > 0 ? (
                              <span className="text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-550/10 dark:bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                Rs. {docTotal.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[8.5px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                                Draft
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteHistorySheet(sh.id, e);
                              }}
                              className="p-1 text-slate-450 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                              title="Delete Sheet"
                            >
                              <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <select
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const destId = e.target.value;
                                if (destId) {
                                  const newMap = { ...sheetFolderMap, [sh.id]: destId };
                                  setSheetFolderMap(newMap);
                                  saveMapToDb(newMap);
                                  toast.success(`Organized sheet into ${folders.find(f => f.id === destId)?.name}`);
                                }
                              }}
                              className="py-0.5 px-2 border border-slate-200 dark:border-slate-800/80 rounded-lg bg-white dark:bg-slate-950 text-[8.5px] font-black uppercase text-slate-500 shrink-0 cursor-pointer focus:ring-1 focus:ring-blue-500 transition-shadow outline-none"
                            >
                              <option value="">Sort Folder...</option>
                              {folders.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                            <span className="text-[8px] font-mono font-black text-slate-450 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-150 dark:border-slate-800/40">
                              {filledLines} Lns
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= INSIDE OPENED DIRECTORY VIEW ================= */
          <div className="flex flex-col gap-6 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* Creator Card (the "+" option card explicitly requested) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02, y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                onClick={() => handleCreateSheetInFolder(activeFolder.id)}
                className="group cursor-pointer border-2 border-dashed border-blue-400/50 dark:border-blue-900/40 hover:border-blue-500 dark:hover:border-blue-400 rounded-3xl p-6 bg-blue-50/10 dark:bg-blue-950/5 hover:bg-blue-50/25 flex flex-col items-center justify-center text-center gap-4 min-h-[180px] transition-all duration-300"
              >
                <div className="p-3 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 text-sm uppercase tracking-wide">
                    Create New Sheet
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Add logged ledger to /{activeFolder.name}
                  </p>
                </div>
              </motion.div>

              {/* List of Sheet Cards configured as folder-like details */}
              {openedFolderSheets.length === 0 ? (
                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 stroke-[1.8] animate-bounce" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                    This directory is empty
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Click the creator card to start logging recoveries
                  </p>
                </div>
              ) : (
                openedFolderSheets.map((sh) => {
                  const t1Am = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
                  const sheetTotal = t1Am;
                  const filledLines = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).filter((r: any) => r.cId || r.name || r.amount > 0).length;

                  return (
                    <motion.div
                      layout
                      key={sh.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4, scale: 1.015 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-5 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/40 dark:hover:border-blue-400/40 rounded-3xl flex flex-col justify-between gap-5 shadow-sm hover:shadow-xl hover:shadow-blue-550/[0.03] group relative select-none"
                    >
                      {/* Visual paper-sheet card layout */}
                      <div className="flex items-start justify-between min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-550 dark:text-blue-450 rounded-2xl group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-650 dark:group-hover:bg-blue-900/40 transition-all duration-200">
                            <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
                          </div>
                          <div className="min-w-0">
                            {/* Date as requested highlighted on top */}
                            <p className="text-sm font-extrabold text-slate-850 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate leading-tight transition-colors duration-150">
                              {sh.sheetDate || "No Date"}
                            </p>
                            {/* Name of recovery officer underneath */}
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5 leading-none truncate">
                              {sh.recOfficer || "Unknown Rec. Officer"}
                            </p>
                          </div>
                        </div>

                        {sheetTotal > 0 ? (
                          <div className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-mono font-black border border-emerald-150 dark:border-emerald-900/20 shrink-0">
                            Rs. {sheetTotal.toLocaleString()}
                          </div>
                        ) : (
                          <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/60 text-slate-405 dark:text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0">
                            Draft
                          </div>
                        )}
                      </div>

                      {/* Operational Details Area Metas */}
                      <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-850/60">
                        <div>
                          <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Area Center</span>
                          <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase truncate block mt-1">{sh.area || "Main"}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Logged Records</span>
                          <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase mt-1 block">
                            {filledLines} {filledLines === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                      </div>

                      {/* Folder Reorganization or direct editing actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadHistorySheet(sh)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-md hover:shadow-blue-500/15"
                        >
                          Open Sheet
                        </button>

                        {/* Folder destination selector */}
                        <select
                          value={activeFolder.id}
                          onChange={(e) => {
                            const destId = e.target.value;
                            const newMap = { ...sheetFolderMap, [sh.id]: destId };
                            setSheetFolderMap(newMap);
                            saveMapToDb(newMap);
                            toast.success(`Moved sheet to ${folders.find(f => f.id === destId)?.name || 'folder'}`);
                          }}
                          className="py-1 px-2 border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-[9px] font-black uppercase text-slate-500 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 transition-shadow shrink-0"
                          title="Move to other folder"
                        >
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>

                        <button
                          onClick={(e) => handleDeleteHistorySheet(sh.id, e)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 shrink-0"
                          title="Delete Sheet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className="print-overlay-wrapper fixed inset-0 bg-slate-100 dark:bg-slate-950 z-[250] flex flex-col items-stretch justify-start overflow-hidden print:p-0 print:bg-transparent print:backdrop-blur-none print:block print:static text-slate-950 dark:text-slate-100 font-sans"
      >
        {activeView === 'dashboard' ? (
          showUserLedger ? renderUserLedger() : renderDashboard()
        ) : (
          <>
            {/* Full-Width Workspace Premium Navbar (Replaces the floating right toolbar) */}
            <div className="w-full bg-[#fcfcfc] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-3 sm:px-6 py-1.5 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 z-[310] print:hidden shrink-0 select-none">
              {/* Left Block */}
              <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <ChevronLeft size={14} className="text-blue-500" />
                  Portal
                </button>
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-455 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 border border-blue-200 dark:border-blue-900/50 cursor-pointer"
                >
                  <Folder size={12} className="stroke-[2.5]" />
                  Folders Dashboard
                </button>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                <div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                Ledger Workspace
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden sm:block">A4 PRINT-READY INTEGRATION CONSOLE</p>
                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[7.5px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    <Shield size={8} />
                    Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[7.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    <Check size={8} />
                    Unlocked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Middle Block: Live statistics feedback */}
          <div className="flex items-center gap-4 text-[10px] bg-slate-50/50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800/80 hidden lg:flex">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">ROWS FILLED</span>
              <span className="font-extrabold text-[#0f172a] dark:text-slate-100">
                {table1Rows.filter(r => r.cId || r.name || r.amount > 0).length} / 22
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">COLLECTED TOTAL</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                Rs. {totalAmount1.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest">AUXILIARY AMNT</span>
              <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                Rs. {totalAmount2.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right Block: Main controller actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto scrollbar-none pb-1 sm:pb-0 shrink-0">
            {/* Viewport Scale Control */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-0.5 border border-slate-250 dark:border-slate-800 text-[9px] font-black uppercase shrink-0">
              <span className="text-slate-400 dark:text-slate-500 px-1.5 font-black text-[8px]">ZOOM</span>
              {(['fit', '100%', '85%', '75%'] as const).map((zOpt) => (
                <button
                  key={zOpt}
                  onClick={() => {
                    setZoomOption(zOpt);
                    localStorage.setItem('gts_ledger_zoomOption', zOpt);
                    toast.success(`Zoom adjusted to ${zOpt.toUpperCase()}`);
                  }}
                  className={`px-2 py-1 rounded-lg font-extrabold cursor-pointer transition-all border-none ${
                    zoomOption === zOpt 
                      ? 'bg-brand-accent text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white bg-transparent'
                  }`}
                >
                  {zOpt === 'fit' ? 'Auto' : zOpt}
                </button>
              ))}
            </div>

            {/* Sizing Toggle */}
            <button
              onClick={() => setShowSizingPanel(!showSizingPanel)}
              className={`p-2 rounded-xl border text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1 ${
                showSizingPanel 
                  ? 'bg-brand-accent border-brand-accent text-white shadow-md shadow-brand-accent/20' 
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-705 border-slate-200 dark:border-slate-705 text-slate-700 dark:text-slate-300'
              }`}
              title="Toggle Sizing and Column Width Sliders"
            >
              <SlidersHorizontal size={12} />
              <span className="hidden md:inline">Sizing</span>
            </button>

            {/* Auto Fill outstanding from Active Monthly accounts */}
            <button
              onClick={autoFillFromDb}
              className="p-2 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/20 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1 shrink-0"
              title="Auto Fill Accounts needing Recovery"
            >
              <RefreshCw size={12} className="text-brand-accent" />
              <span>Fill</span>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-brand-accent hover:opacity-90 text-white text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-md shadow-brand-accent/15 flex items-center gap-1 border-none"
              title="Print to Paper or save PDF"
            >
              <Printer size={12} />
              <span>Print</span>
            </button>

            {/* Registry History */}
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className={`p-2 rounded-xl border text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1 ${
                showHistoryPanel 
                  ? 'bg-brand-accent border-brand-accent text-white shadow-md shadow-brand-accent/20' 
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-705 border-slate-200 dark:border-slate-705 text-slate-700 dark:text-slate-300'
              }`}
              title="Toggle Historical Month Registry Logs"
            >
              <History size={12} />
              <span>History</span>
            </button>

            {/* Save active sheet */}
            <button
              onClick={handleSaveSheet}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-md flex items-center gap-1 border-none"
              title="Commit active sheet to historical database logs"
            >
              <Save size={12} />
              <span>Save</span>
            </button>

            {/* Reset blank */}
            <button
              onClick={() => setShowConfirmResetModal(true)}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-750 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1"
              title="Reset fields of current sheet"
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* CSS to overlay print and target only the A4 container physically */}
        <style dangerouslySetInnerHTML={{ __html: `
          .print-paper-container,
          .print-paper-container * {
            font-family: 'Lexend', sans-serif !important;
          }
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 210mm !important;
              height: 297mm !important;
              overflow: visible !important;
            }
            #root {
              display: none !important;
            }
            .print-overlay-wrapper {
              position: static !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              display: block !important;
              width: auto !important;
              height: auto !important;
            }
            .print-paper-container {
              position: relative !important;
              width: 210mm !important;
              height: 297mm !important;
              transform: none !important;
              margin: 0 auto 10mm auto !important;
              padding: ${paperPaddingY}mm ${paperPaddingX}mm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
            }
            /* Super compact print overrides for tables and grids */
            .print-paper-container table {
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1.5px solid #000000 !important;
              margin: 0 !important;
            }
            .print-paper-container tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              height: auto !important;
              max-height: none !important;
            }
            .print-paper-container th {
              padding: ${Math.max(1, rowPadding - 2.5)}px 4px !important;
              font-size: ${tableFontSize}px !important;
              font-weight: 805 !important;
              border: 1px solid #000000 !important;
              border-bottom: 2px solid #000000 !important;
              background-color: #f1f5f9 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-paper-container td {
              padding: ${rowPadding}px 4px !important;
              font-size: ${tableFontSize - 1}px !important;
              border: 1px solid #000000 !important;
              height: auto !important;
              line-height: normal !important;
            }
            .print-paper-container input[type="text"], 
            .print-paper-container input[type="number"] {
              font-size: ${tableFontSize - 1}px !important;
              height: auto !important;
              line-height: normal !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              background: transparent !important;
              color: black !important;
            }
            .print-paper-container input[type="checkbox"] {
              -webkit-appearance: checkbox !important;
              appearance: checkbox !important;
              width: 11px !important;
              height: 11px !important;
              margin: 0 !important;
              padding: 0 !important;
              display: inline-block !important;
            }
            /* Specific border classes */
            .print-border-black {
              border-color: #000000 !important;
            }
            .print-bg-gray {
              background-color: #e2e8f0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />

        {/* Main Integrated Workspace (No more double screen scrolling or nested popups!) */}
        <div className="flex-1 w-full flex flex-row items-stretch overflow-hidden print:block print:p-0 print:overflow-visible print:h-auto relative">
          {/* Left Inline Sizing Designer Panel with custom enter animations */}
          <AnimatePresence mode="popLayout">
          {showSizingPanel && (
            <motion.div 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: window.innerWidth < 1024 ? (window.innerWidth - 32) : 280 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`bg-[#fdfdfd] dark:bg-slate-900 border-r border-slate-205 dark:border-slate-800/85 p-4 overflow-y-auto shrink-0 print:hidden h-full text-slate-850 dark:text-slate-100 select-none text-left scrollbar-thin flex flex-col gap-3 font-mono z-[400] ${window.innerWidth < 1024 ? 'absolute top-0 bottom-0 left-0 shadow-2xl max-w-full' : 'relative w-[280px]'}`}
            >
                
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-150 dark:border-slate-800 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-brand-accent animate-spin-slow" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc]">Sizing Designer</span>
                  </div>
                  <button 
                    onClick={resetSizingToDefault}
                    className="flex items-center gap-0.5 text-[8px] font-black text-slate-400 hover:text-brand-accent transition-colors cursor-pointer border-none bg-transparent"
                    title="Reset to default sizes"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    RESET
                  </button>
                </div>

                {/* Spacing & Scaling Slider Section */}
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-850/60 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Row padding</span>
                      <span className="font-mono text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20 px-1 py-0.5 rounded text-[9px] font-bold">{rowPadding}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="14" 
                      step="0.5"
                      value={rowPadding} 
                      onChange={(e) => setRowPadding(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent mt-1.5"
                    />
                    <span className="text-[7.5px] text-slate-450 leading-none block mt-1">Squeeze padding to fit lines on one page.</span>
                  </div>

                  <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-850/60 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Table Font Size</span>
                      <span className="font-mono text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20 px-1 py-0.5 rounded text-[9px] font-bold">{tableFontSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="8" 
                      max="15" 
                      step="0.5"
                      value={tableFontSize} 
                      onChange={(e) => setTableFontSize(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent mt-1.5"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-850/60 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Header Font Size</span>
                      <span className="font-mono text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20 px-1 py-0.5 rounded text-[9px] font-bold">{headerFontSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="22" 
                      step="0.5"
                      value={headerFontSize} 
                      onChange={(e) => setHeaderFontSize(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent mt-1.5"
                    />
                    <span className="text-[7.5px] text-slate-450 leading-none block mt-1">Scale top header fields (OFFICER, AREA, DATE).</span>
                  </div>

                  {/* Page Margins Controllers */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-850/60 shadow-sm">
                      <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider block mb-1">Top Margin</span>
                      <span className="text-[8px] font-mono text-brand-accent block mb-1">{paperPaddingY}mm</span>
                      <input 
                        type="range" 
                        min="2" 
                        max="22" 
                        value={paperPaddingY} 
                        onChange={(e) => setPaperPaddingY(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                      />
                    </div>
                    <div className="p-2 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/80 dark:border-slate-850/60 shadow-sm">
                      <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-wider block mb-1">Side Margin</span>
                      <span className="text-[8px] font-mono text-brand-accent block mb-1">{paperPaddingX}mm</span>
                      <input 
                        type="range" 
                        min="2" 
                        max="22" 
                        value={paperPaddingX} 
                        onChange={(e) => setPaperPaddingX(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                      />
                    </div>
                  </div>

                  {/* Table 1 Grid lines */}
                  <div className="border-t border-slate-150 dark:border-slate-850 pt-2.5 mt-1">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9] block mb-2">
                      Table 1 Grid Lines (Col Width)
                    </span>
                    
                    <div className="space-y-1.5 text-[8.5px] font-bold text-slate-500">
                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Sr column</span>
                          <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthSr}px</span>
                        </div>
                        <input 
                          type="range" min="20" max="80" value={t1WidthSr} 
                          onChange={(e) => setT1WidthSr(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Customer ID col</span>
                          <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthId}px</span>
                        </div>
                        <input 
                          type="range" min="40" max="150" value={t1WidthId} 
                          onChange={(e) => setT1WidthId(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Name col</span>
                          <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthName}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="380" value={t1WidthName} 
                          onChange={(e) => setT1WidthName(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Comments/Phone col</span>
                          <span className="font-mono text-slate-650 dark:text-slate-400">{t1WidthComments}px</span>
                        </div>
                        <input 
                          type="range" min="100" max="350" value={t1WidthComments} 
                          onChange={(e) => setT1WidthComments(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Amount col</span>
                          <span className="font-mono text-slate-655 dark:text-slate-400">{t1WidthAmount}px</span>
                        </div>
                        <input 
                          type="range" min="50" max="180" value={t1WidthAmount} 
                          onChange={(e) => setT1WidthAmount(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table 2 Grid lines */}
                  <div className="border-t border-slate-150 dark:border-slate-850 pt-2.5">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f1f5f9] block mb-2">
                      Table 2 Grid Lines (Col Width)
                    </span>
                    
                    <div className="space-y-1.5 text-[8.5px] font-bold text-slate-500">
                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Account Title col</span>
                          <span className="font-mono text-slate-650 dark:text-slate-400">{t2WidthName}px</span>
                        </div>
                        <input 
                          type="range" min="150" max="550" value={t2WidthName} 
                          onChange={(e) => setT2WidthName(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="bg-slate-50/40 dark:bg-slate-850/20 p-1.5 rounded-lg border border-slate-100/50 dark:border-slate-800/40">
                        <div className="flex justify-between text-[8px] uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc] mb-0.5">
                          <span>Amount col</span>
                          <span className="font-mono text-slate-655 dark:text-slate-400">{t2WidthAmount}px</span>
                        </div>
                        <input 
                          type="range" min="50" max="250" value={t2WidthAmount} 
                          onChange={(e) => setT2WidthAmount(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-700 accent-brand-accent rounded appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-3 p-2 bg-brand-accent/10 dark:bg-brand-accent/20 rounded-lg border border-brand-accent/20 dark:border-brand-accent/10 text-[8.5px] text-brand-accent leading-normal">
                  💡 <span className="font-extrabold uppercase">Grid Position:</span> Drag sliders to align columns perfectly.
                </div>

              </motion.div>
            )}
            </AnimatePresence>

            {/* Center Area: Full Viewport Scale-to-Fit Workspace Area */}
            <div 
              ref={workspaceRef}
              className={`flex-1 flex flex-col items-center bg-slate-100 dark:bg-slate-900/40 scrollbar-none relative h-full print:bg-transparent print:p-0 print:m-0 print:block print:overflow-visible print:h-auto select-none print:select-text ${
                (zoomOption === 'fit' && !isInputFocused)
                  ? 'p-2 sm:p-3 overflow-hidden justify-center' 
                  : 'p-4 sm:p-6 overflow-auto justify-start'
              }`}
            >
              {isLocked && (
                <div className="w-full max-w-[800px] bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden animate-in fade-in slide-in-from-top-2 duration-300 select-text shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 animate-pulse shrink-0">
                      <Shield size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                        Ledger Sheet Locked (View-Only)
                      </h4>
                      <p className="text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mt-0.5 leading-normal max-w-sm sm:max-w-md">
                        This recovery report and entry sheet is secured. Enter Security key passkey to enable edits.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="password"
                      value={localPasskey}
                      onChange={(e) => setLocalPasskey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLocalUnlock();
                      }}
                      placeholder="ENTER PASSKEY..."
                      className="w-full sm:w-36 px-2.5 py-1.5 text-[9px] font-mono font-black tracking-widest bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleLocalUnlock}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[9px] tracking-wider rounded-xl transition-all shadow-md shrink-0 active:scale-95"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              )}

              {/* Reference current live editing states safely via a proxy object mapped into shadow variables */}
              {(() => {
                const liveState = {
                  recOfficer,
                  recOfficerLabel,
                  area,
                  areaLabel,
                  sheetDate,
                  dateLabel,
                  table1Rows,
                  table2Rows,
                  cashReceived,
                  sign,
                  submitted,
                  cashReceivedLabel,
                  signLabel,
                  submittedLabel,
                  footnoteLeft,
                  footnoteRight,
                  t1Headers,
                  t2Headers,
                  t1TotalLabel,
                  t2TotalLabel,
                };

                return (
                  <div className={`flex flex-row justify-start sm:justify-center gap-6 overflow-x-auto min-w-full select-text print:block print:w-auto print:h-auto print:static ${
                    (zoomOption === 'fit' && !isInputFocused) ? 'items-start pb-2 pt-2 my-auto' : 'items-start pb-10 pt-4'
                  }`}>
                    <div className="flex flex-row gap-6 mx-auto w-max px-2 sm:px-0">
                    {sheets.map((sh, sheetIdx) => {
                      const isActive = activeSheetIdx === sheetIdx;

                      // Shadowing our states inside mapped list callback cleanly avoiding Temporal Dead Zone scope conflicts
                      const recOfficer = isActive ? liveState.recOfficer : (sh.recOfficer || '');
                      const recOfficerLabel = isActive ? liveState.recOfficerLabel : (sh.recOfficerLabel || 'REC. OFFICER');
                      const area = isActive ? liveState.area : (sh.area || 'MAIN');
                      const areaLabel = isActive ? liveState.areaLabel : (sh.areaLabel || 'AREA');
                      const sheetDate = isActive ? liveState.sheetDate : (sh.sheetDate || '');
                      const dateLabel = isActive ? liveState.dateLabel : (sh.dateLabel || 'DATE');
                      const table1Rows = isActive ? liveState.table1Rows : (Array.isArray(sh.table1Rows) ? sh.table1Rows : []);
                      const table2Rows = isActive ? liveState.table2Rows : (Array.isArray(sh.table2Rows) ? sh.table2Rows : []);
                      const cashReceived = isActive ? liveState.cashReceived : (sh.cashReceived || '');
                      const sign = isActive ? liveState.sign : (sh.sign || '');
                      const submitted = isActive ? liveState.submitted : (sh.submitted || '');
                      const cashReceivedLabel = isActive ? liveState.cashReceivedLabel : (sh.cashReceivedLabel || 'CASH RECEIVED');
                      const signLabel = isActive ? liveState.signLabel : (sh.signLabel || 'SIGN');
                      const submittedLabel = isActive ? liveState.submittedLabel : (sh.submittedLabel || 'SUBMITTED');
                      const footnoteLeft = isActive ? liveState.footnoteLeft : (sh.footnoteLeft || 'Enterprise Ledger Dispatch System');
                      const footnoteRight = isActive ? liveState.footnoteRight : (sh.footnoteRight || 'GENv2.5 // A4 PRINTABLE');
                      const t1Headers = isActive ? liveState.t1Headers : (sh.t1Headers || ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH']);
                      const t2Headers = isActive ? liveState.t2Headers : (sh.t2Headers || ['SR', 'NAME', 'AMOUNT', 'CH']);
                      const t1TotalLabel = isActive ? liveState.t1TotalLabel : (sh.t1TotalLabel || 'TOTAL');
                      const t2TotalLabel = isActive ? liveState.t2TotalLabel : (sh.t2TotalLabel || 'TOTAL');

                      const totalAmount1 = table1Rows.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
                      const totalAmount2 = table2Rows.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
                      const grandTotal = totalAmount1 + totalAmount2;

                      return (
                        <div 
                          key={sh.id || sheetIdx}
                          onMouseDownCapture={() => {
                            if (activeSheetIdx !== sheetIdx) {
                              isSwappingRef.current = true;
                              setActiveSheetIdx(sheetIdx);
                            }
                          }}
                          onFocusCapture={() => {
                            if (activeSheetIdx !== sheetIdx) {
                              isSwappingRef.current = true;
                              setActiveSheetIdx(sheetIdx);
                            }
                          }}
                          className={`group relative flex flex-col items-center shrink-0 print:block print:w-auto print:h-auto print:static my-auto transition-all ${
                            isActive 
                              ? `ring-2 ring-indigo-650/40 dark:ring-indigo-400/50 ring-offset-4 ring-offset-slate-100 dark:ring-offset-slate-900 rounded-lg z-10 ${zoomOption === 'fit' ? 'scale-100' : 'scale-102'}` 
                              : 'opacity-70 saturate-75 hover:opacity-95 hover:saturate-100'
                          }`}
                          style={{
                            width: `${793.7 * calculatedScale}px`,
                            height: `${1122.5 * calculatedScale}px`,
                            minWidth: `${793.7 * calculatedScale}px`,
                            minHeight: `${1122.5 * calculatedScale}px`,
                          }}
                        >
                          {/* Floating tools bar in top-right corner of sheet paper */}
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-1 transition-all duration-200 z-[110] print:hidden select-none">
                            <span className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mr-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-950 rounded">
                              Page {sheetIdx + 1} of {sheets.length}
                            </span>
                            
                            {/* Option to create a new sheet with SAME DATE directly to the right side of the list */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSheet(sheetIdx);
                              }}
                              className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/45 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-505 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0.5"
                              title="Create multi-page layout (Add new same-date Sheet to the right side)"
                            >
                              <FolderPlus size={10} className="stroke-[2.5]" />
                            </button>
                            
                            {/* Option to delete sheet (Dusbin / Trash) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSheetItem(sheetIdx);
                              }}
                              className="p-1 rounded bg-rose-50 dark:bg-rose-950/45 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-505 dark:text-rose-400 border border-slate-200 dark:border-slate-800 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0.5"
                              title="Delete sheet (Dusbin)"
                            >
                              <Trash2 size={10} className="stroke-[2.5]" />
                            </button>
                          </div>

                          {/* A4 Paper Mockup Sheet Container */}
                          <motion.div 
                            initial={{ opacity: 0, y: 30, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            style={{ 
                              paddingLeft: `${paperPaddingX}mm`, 
                              paddingRight: `${paperPaddingX}mm`, 
                              paddingTop: `${paperPaddingY}mm`, 
                              paddingBottom: `${paperPaddingY}mm`,
                              transform: `scale(${calculatedScale})`,
                              transformOrigin: 'top left',
                              position: 'absolute',
                              left: 0,
                              top: 0
                            }}
                            className={`print-paper-container bg-white border border-slate-350 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-lg w-[793.7px] min-h-[1122.5px] flex flex-col text-[#0f172a] font-sans print:p-0 print:m-0 print:border-none print:shadow-none print:static print:transform-none select-text ${isLocked ? 'pointer-events-none opacity-80 select-none' : ''}`}
                            onFocusCapture={handlePaperFocus}
                            onBlurCapture={handlePaperBlur}
                          >
            
            {/* Header Row - Aligned tight & left with Flex box for perfect viewport/A4 compatibility */}
            <div 
              style={{ fontSize: `${headerFontSize}px` }}
              className="flex flex-row flex-wrap justify-start items-center gap-x-8 gap-y-3 border-b-2 border-black pb-4 font-sans tracking-wide"
            >
              <div 
                style={{ width: `${260 * (headerFontSize / 13)}px` }}
                className="flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={recOfficerLabel}
                  onChange={(e) => setRecOfficerLabel(e.target.value)}
                  style={{ 
                    fontSize: `${Math.max(8, headerFontSize - 3)}px`,
                    width: `${85 * (headerFontSize / 13)}px`
                  }}
                  className="font-extrabold text-slate-500 uppercase font-mono bg-transparent outline-none border-b border-transparent hover:border-dashed hover:border-slate-300 focus:border-slate-500 focus:bg-slate-50 px-0.5 py-px shrink-0 text-slate-650"
                  title="Click to edit label"
                />
                <input
                  type="text"
                  value={recOfficer}
                  onChange={(e) => setRecOfficer(e.target.value)}
                  style={{ fontSize: `${headerFontSize}px` }}
                  className="flex-1 border-b border-slate-400 font-black text-slate-900 border-dashed pb-0.5 px-1 bg-transparent hover:bg-slate-50 focus:bg-slate-100 outline-none tracking-wide min-w-0"
                  placeholder="Name"
                />
              </div>
              
              <div 
                style={{ width: `${140 * (headerFontSize / 13)}px` }}
                className="flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={areaLabel}
                  onChange={(e) => setAreaLabel(e.target.value)}
                  style={{ 
                    fontSize: `${Math.max(8, headerFontSize - 3)}px`,
                    width: `${45 * (headerFontSize / 13)}px`
                  }}
                  className="font-extrabold text-slate-500 uppercase font-mono bg-transparent outline-none border-b border-transparent hover:border-dashed hover:border-slate-300 focus:border-slate-500 focus:bg-slate-50 px-0.5 py-px shrink-0 text-slate-650 text-left"
                  title="Click to edit label"
                />
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  style={{ fontSize: `${headerFontSize}px` }}
                  className="flex-1 border-b border-slate-400 font-black text-slate-900 border-dashed pb-0.5 px-1 bg-transparent text-left hover:bg-slate-50 focus:bg-slate-100 outline-none tracking-wide min-w-0"
                  placeholder="MAIN"
                />
              </div>

              <div 
                style={{ width: `${170 * (headerFontSize / 13)}px` }}
                className="flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={dateLabel}
                  onChange={(e) => setDateLabel(e.target.value)}
                  style={{ 
                    fontSize: `${Math.max(8, headerFontSize - 3)}px`,
                    width: `${45 * (headerFontSize / 13)}px`
                  }}
                  className="font-extrabold text-[#111827] dark:text-[#f3f4f6] text-slate-500 uppercase font-mono bg-transparent outline-none border-b border-transparent hover:border-dashed hover:border-slate-300 focus:border-slate-500 focus:bg-slate-50 px-0.5 py-px shrink-0 text-slate-650 text-left"
                  title="Click to edit label"
                />
                <input
                  type="text"
                  value={sheetDate}
                  onChange={(e) => setSheetDate(e.target.value)}
                  style={{ fontSize: `${headerFontSize - 1}px` }}
                  className="flex-1 border-b border-slate-400 font-extrabold text-slate-900 border-dashed pb-0.5 px-1 bg-transparent text-left hover:bg-slate-50 focus:bg-slate-100 outline-none font-mono min-w-0"
                  placeholder="DD - MM - YYYY"
                />
              </div>
            </div>

          {/* Table 1 (22 collection rows) */}
          <div className="mt-4 flex-1">
            <table className="w-full border-2 border-black border-collapse table-fixed">
              <thead>
                <tr className="border-b-2 border-black font-extrabold text-center text-black uppercase font-mono">
                  <th 
                    style={{ width: `${t1WidthSr}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }} 
                    className="px-1 border-r-2 border-black"
                  >
                    <input
                      type="text"
                      value={t1Headers[0]}
                      onChange={(e) => {
                        const h = [...t1Headers];
                        h[0] = e.target.value;
                        setT1Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
                      title="Double-click/type to edit column header"
                    />
                  </th>
                  <th 
                    style={{ width: `${t1WidthId}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }}
                    className="px-2 border-r border-black relative group"
                  >
                    <input
                      type="text"
                      value={t1Headers[1]}
                      onChange={(e) => {
                        const h = [...t1Headers];
                        h[1] = e.target.value;
                        setT1Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
                      title="Double-click/type to edit column header"
                    />
                    <button
                      type="button"
                      onClick={() => handleT1Sort('cId')}
                      className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by C.ID"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th 
                    style={{ width: `${t1WidthName}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }}
                    className="px-3 border-r border-black relative group"
                  >
                    <input
                      type="text"
                      value={t1Headers[2]}
                      onChange={(e) => {
                        const h = [...t1Headers];
                        h[2] = e.target.value;
                        setT1Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-left bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase px-1"
                      title="Double-click/type to edit column header"
                    />
                    <button
                      type="button"
                      onClick={() => handleT1Sort('name')}
                      className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Name"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th 
                    style={{ width: `${t1WidthComments}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }}
                    className="px-3 border-r border-black relative group"
                  >
                    <input
                      type="text"
                      value={t1Headers[3]}
                      onChange={(e) => {
                        const h = [...t1Headers];
                        h[3] = e.target.value;
                        setT1Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-left bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase px-1"
                      title="Double-click/type to edit column header"
                    />
                    <button
                      type="button"
                      onClick={() => handleT1Sort('comments')}
                      className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Comments"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th 
                    style={{ width: `${t1WidthAmount}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }}
                    className="px-2 border-r border-black relative group"
                  >
                    <input
                      type="text"
                      value={t1Headers[4]}
                      onChange={(e) => {
                        const h = [...t1Headers];
                        h[4] = e.target.value;
                        setT1Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-right bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase pr-4"
                      title="Double-click/type to edit column header"
                    />
                    <button
                      type="button"
                      onClick={() => handleT1Sort('amount')}
                      className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Amount"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th 
                    style={{ width: `${t1WidthCh}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }}
                    className="px-1"
                  >
                    <input
                      type="text"
                      value={t1Headers[5]}
                      onChange={(e) => {
                        const h = [...t1Headers];
                        h[5] = e.target.value;
                        setT1Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
                      title="Double-click/type to edit column header"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {table1Rows.map((row, index) => {
                  const isSearchResultMatch = !!(historySearchQuery.trim() && (
                    (row.cId && row.cId.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                    (row.name && row.name.toLowerCase().includes(historySearchQuery.toLowerCase()))
                  ));
                  return (
                    <tr 
                      key={index} 
                      className={`border-b border-slate-405 font-mono colRow transition-all duration-250 ${
                        isSearchResultMatch 
                           ? 'bg-brand-accent/20 dark:bg-brand-accent/30 font-bold border-l-4 border-l-brand-accent' 
                          : ''
                      }`}
                    >
                    {/* Sr */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-1 border-r-2 border-black text-center font-bold font-sans text-slate-600 bg-slate-50/50"
                    >
                      <input
                        type="text"
                        value={row.sr}
                        onChange={(e) => handleT1Change(index, 'sr', e.target.value)}
                        style={{ fontSize: `${tableFontSize - 0.5}px` }}
                        className="w-full min-w-0 border-none p-0 text-center text-slate-600 bg-transparent focus:bg-slate-100 font-bold outline-none font-sans"
                        title="Double-click/type to edit Serial"
                      />
                    </td>
 
                    {/* C. ID */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-1 border-r border-black relative group/cell"
                    >
                      <input
                        type="text"
                        value={row.cId}
                        onChange={(e) => {
                          handleT1Change(index, 'cId', e.target.value);
                          setSearchQuery(e.target.value);
                          setFocusedRowIndex(index);
                          setFocusedField('cId');
                        }}
                        onFocus={() => {
                          setSearchQuery(row.cId);
                          setFocusedRowIndex(index);
                          setFocusedField('cId');
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setFocusedRowIndex(null);
                            setFocusedField(null);
                          }, 250);
                        }}
                        style={{ fontSize: `${tableFontSize - 0.5}px` }}
                        className="w-full min-w-0 border-none p-0 text-center text-slate-900 bg-transparent focus:bg-slate-100 font-bold tracking-tight outline-none"
                      />
                      
                      {focusedRowIndex === index && focusedField === 'cId' && (
                        <div className="absolute top-[105%] left-0 w-[290px] bg-white border border-slate-350 dark:bg-slate-950 dark:border-slate-800 shadow-2xl rounded-xl p-1.5 z-[999] max-h-56 overflow-y-auto print:hidden font-sans">
                          <div className="text-[8px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 px-2 py-1 border-b border-slate-100 dark:border-slate-900 mb-1">
                            Search by User ID / Name
                          </div>
                          {getFilteredSuggestions('cId', searchQuery).length === 0 ? (
                            <div className="text-[10px] text-slate-400 py-2 text-center">No matches found</div>
                          ) : (
                            getFilteredSuggestions('cId', searchQuery).map((cObj) => {
                              const matchingActiveRow = activeRows?.find(r => 
                                (r.username && r.username.toLowerCase() === cObj.username?.toLowerCase()) || 
                                (r.clientId && r.clientId.toLowerCase() === cObj.id?.toLowerCase())
                              );
                              const isDcOrTdc = matchingActiveRow && (matchingActiveRow.paymentStatus === 'dc' || matchingActiveRow.paymentStatus === 'tdc');
                              const outstandingStr = matchingActiveRow 
                                ? `Outstanding: Rs. ${isDcOrTdc ? 0 : parseFloat(matchingActiveRow.totalAmount || '0') - parseFloat(matchingActiveRow.paymentReceived || '0')}`
                                : cObj.pkgDetails || 'Active Master Customer';

                              return (
                                <button
                                  key={cObj.id || cObj.username}
                                  type="button"
                                  onClick={() => handleSelectSuggestion(index, cObj)}
                                  className="w-full flex items-center justify-between text-left px-2 sm:px-2.5 py-1.5 hover:bg-brand-accent hover:text-white dark:hover:bg-brand-accent/80 rounded-lg transition-colors group"
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-white truncate">
                                      {cObj.name}
                                    </span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 group-hover:text-white/80 font-mono truncate">
                                      @{cObj.username || cObj.id} {cObj.area ? `• ${cObj.area}` : ''}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-900 group-hover:bg-white/20 text-slate-700 dark:text-slate-350 group-hover:text-white font-bold px-1.5 py-0.5 rounded font-mono">
                                      {outstandingStr.length > 20 ? outstandingStr.substring(0, 18) + '..' : outstandingStr}
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </td>
 
                    {/* Name */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-2 border-r border-black font-sans relative group/cell"
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => {
                            handleT1Change(index, 'name', e.target.value);
                            setSearchQuery(e.target.value);
                            setFocusedRowIndex(index);
                            setFocusedField('name');
                          }}
                          onFocus={() => {
                            setSearchQuery(row.name);
                            setFocusedRowIndex(index);
                            setFocusedField('name');
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setFocusedRowIndex(null);
                              setFocusedField(null);
                            }, 250);
                          }}
                          style={{ fontSize: `${tableFontSize}px` }}
                          className="flex-1 min-w-0 border-none p-0 text-slate-900 bg-transparent font-black tracking-tight focus:bg-slate-100 outline-none"
                        />
                        {row.clientUsername && (
                          <span className="print:hidden text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950 px-1 py-0.5 rounded leading-none shrink-0">
                            @{row.clientUsername}
                          </span>
                        )}
                      </div>

                      {focusedRowIndex === index && focusedField === 'name' && (
                        <div className="absolute top-[105%] left-0 w-[290px] bg-white border border-slate-350 dark:bg-slate-950 dark:border-slate-800 shadow-2xl rounded-xl p-1.5 z-[999] max-h-56 overflow-y-auto print:hidden font-sans">
                          <div className="text-[8px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-555 px-2 py-1 border-b border-slate-100 dark:border-slate-900 mb-1">
                            Search by User ID / Name
                          </div>
                          {getFilteredSuggestions('name', searchQuery).length === 0 ? (
                            <div className="text-[10px] text-slate-400 py-2 text-center">No matches found</div>
                          ) : (
                            getFilteredSuggestions('name', searchQuery).map((cObj) => {
                              const matchingActiveRow = activeRows?.find(r => 
                                (r.username && r.username.toLowerCase() === cObj.username?.toLowerCase()) || 
                                (r.clientId && r.clientId.toLowerCase() === cObj.id?.toLowerCase())
                              );
                              const isDcOrTdc = matchingActiveRow && (matchingActiveRow.paymentStatus === 'dc' || matchingActiveRow.paymentStatus === 'tdc');
                              const outstandingStr = matchingActiveRow 
                                ? `Outstanding: Rs. ${isDcOrTdc ? 0 : parseFloat(matchingActiveRow.totalAmount || '0') - parseFloat(matchingActiveRow.paymentReceived || '0')}`
                                : cObj.pkgDetails || 'Active Master Customer';

                              return (
                                <button
                                  key={cObj.id || cObj.username}
                                  type="button"
                                  onClick={() => handleSelectSuggestion(index, cObj)}
                                  className="w-full flex items-center justify-between text-left px-2 sm:px-2.5 py-1.5 hover:bg-brand-accent hover:text-white dark:hover:bg-brand-accent/80 rounded-lg transition-colors group"
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-white truncate">
                                      {cObj.name}
                                    </span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 group-hover:text-white/80 font-mono truncate">
                                      @{cObj.username || cObj.id} {cObj.area ? `• ${cObj.area}` : ''}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-900 group-hover:bg-white/20 text-slate-700 dark:text-slate-350 group-hover:text-white font-bold px-1.5 py-0.5 rounded font-mono">
                                      {outstandingStr.length > 20 ? outstandingStr.substring(0, 18) + '..' : outstandingStr}
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </td>
 
                    {/* Comments */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-2 border-r border-black font-sans"
                    >
                      <input
                        type="text"
                        value={row.comments}
                        onChange={(e) => handleT1Change(index, 'comments', e.target.value)}
                        style={{ fontSize: `${tableFontSize - 0.5}px` }}
                        className="w-full min-w-0 border-none p-0 text-slate-600 dark:text-slate-600 bg-transparent font-semibold focus:bg-slate-100 outline-none"
                      />
                    </td>
 
                    {/* Amount */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-2 border-r border-black text-right relative"
                    >
                      <input
                        type="text"
                        value={row.amount === 0 ? '' : row.amount}
                        placeholder="0"
                        onChange={(e) => handleT1Change(index, 'amount', e.target.value)}
                        onFocus={() => {
                          setFocusedRowIndex(index);
                          setFocusedField('amount');
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setFocusedRowIndex(null);
                            setFocusedField(null);
                          }, 250);
                        }}
                        style={{ fontSize: `${tableFontSize}px` }}
                        className="w-full min-w-0 border-none p-0 text-right text-slate-900 font-black bg-transparent focus:bg-slate-100 outline-none font-mono uppercase"
                      />
                      
                      {focusedRowIndex === index && focusedField === 'amount' && (
                        <div className="absolute top-[105%] right-0 w-[120px] bg-white border border-slate-350 dark:bg-slate-950 dark:border-slate-800 shadow-2xl rounded-xl p-1 z-[999] print:hidden font-sans">
                          <div className="text-[8px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-555 px-2 py-1 border-b border-slate-100 dark:border-slate-900 mb-1 text-left">
                            Set Status
                          </div>
                          {['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL'].map(st => (
                            <button
                              key={st}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              onClick={() => {
                                handleT1Change(index, 'amount', st);
                                handleT1Change(index, 'status', st.toLowerCase());
                              }}
                              className="w-full text-right px-2 py-1.5 hover:bg-brand-accent hover:text-white dark:hover:bg-brand-accent/80 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors uppercase tracking-widest cursor-pointer"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
 
                    {/* Ch (Tick checkbox) */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px` }}
                      className="px-1 text-center select-none"
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={row.ch}
                          onChange={(e) => handleT1Change(index, 'ch', e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-400 text-brand-accent focus:ring-brand-accent cursor-pointer"
                        />
                      </div>
                    </td>
                  </tr>
                ); })}

                {/* Sub Total row */}
                <tr className="border-t-2 border-black font-extrabold bg-slate-100/60 print-bg-gray">
                  <td colSpan={4} className="py-1 px-3 text-right text-xs font-black uppercase tracking-wider font-sans border-r border-black">
                    <input
                      type="text"
                      value={t1TotalLabel}
                      onChange={(e) => setT1TotalLabel(e.target.value)}
                      className="bg-transparent border-none p-0 text-right font-black uppercase text-slate-800 outline-none text-[11px] w-full"
                      title="Double-click/type to edit total label"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right border-r border-black font-mono text-[13px] font-black tracking-wide text-slate-900 bg-slate-100 print-bg-gray">
                    {totalAmount1.toLocaleString()}
                  </td>
                  <td className="bg-slate-100/60 print-bg-gray"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2 Secondary Balances (3 rows, Bank, Panel balance, Cash hand) */}
          <div className="mt-5 select-text">
            <table className="w-full border-2 border-black border-collapse table-fixed">
              <thead>
                <tr className="border-b-2 border-black font-extrabold text-center text-black uppercase font-mono">
                  <th 
                    style={{ width: '40px', paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }} 
                    className="px-1 border-r-2 border-black"
                  >
                    <input
                      type="text"
                      value={t2Headers[0]}
                      onChange={(e) => {
                        const h = [...t2Headers];
                        h[0] = e.target.value;
                        setT2Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
                      title="Double-click/type to edit heading"
                    />
                  </th>
                  <th 
                    style={{ width: `${t2WidthName}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }} 
                    className="px-3 border-r border-black text-left relative group"
                  >
                    <input
                      type="text"
                      value={t2Headers[1]}
                      onChange={(e) => {
                        const h = [...t2Headers];
                        h[1] = e.target.value;
                        setT2Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-left bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase px-1"
                      title="Double-click/type to edit heading"
                    />
                    <button
                      type="button"
                      onClick={() => handleT2Sort('name')}
                      className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Name"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th 
                    style={{ width: `${t2WidthAmount}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }} 
                    className="px-2 border-r border-black relative group"
                  >
                    <input
                      type="text"
                      value={t2Headers[2]}
                      onChange={(e) => {
                        const h = [...t2Headers];
                        h[2] = e.target.value;
                        setT2Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full min-w-0 text-right bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase pr-4"
                      title="Double-click/type to edit heading"
                    />
                    <button
                      type="button"
                      onClick={() => handleT2Sort('amount')}
                      className="print:hidden absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Amount"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th 
                    style={{ width: '40px', paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }} 
                    className="px-1"
                  >
                    <input
                      type="text"
                      value={t2Headers[3]}
                      onChange={(e) => {
                        const h = [...t2Headers];
                        h[3] = e.target.value;
                        setT2Headers(h);
                      }}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="w-full text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
                      title="Double-click/type to edit heading"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {table2Rows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-400 font-mono">
                    {/* Sr */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-1 border-r-2 border-black text-center font-bold font-sans text-slate-600 bg-slate-50/50"
                    >
                      <input
                        type="text"
                        value={row.sr}
                        onChange={(e) => handleT2Change(index, 'sr', e.target.value)}
                        style={{ fontSize: `${tableFontSize - 0.5}px` }}
                        className="w-full min-w-0 border-none p-0 text-center text-slate-600 bg-transparent focus:bg-slate-100 font-bold outline-none font-sans"
                        title="Double-click/type to edit Serial"
                      />
                    </td>
 
                    {/* Name */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-3 border-r border-black font-sans text-slate-800 font-extrabold uppercase select-text"
                    >
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleT2Change(index, 'name', e.target.value)}
                        style={{ fontSize: `${tableFontSize}px` }}
                        className="w-full min-w-0 border-none p-0 text-slate-900 font-black tracking-wide bg-transparent focus:bg-slate-100 outline-none uppercase font-mono"
                      />
                    </td>
 
                    {/* Amount */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
                      className="px-2 border-r border-black text-right"
                    >
                      <input
                        type="number"
                        value={row.amount === 0 ? '' : row.amount}
                        placeholder="0"
                        onChange={(e) => handleT2Change(index, 'amount', parseFloat(e.target.value) || 0)}
                        style={{ fontSize: `${tableFontSize}px` }}
                        className="w-full min-w-0 border-none p-0 text-right text-slate-900 font-black bg-transparent focus:bg-slate-100 outline-none font-mono"
                      />
                    </td>
 
                    {/* Ch checkbox */}
                    <td 
                      style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px` }}
                      className="px-1 text-center select-none"
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={row.ch}
                          onChange={(e) => handleT2Change(index, 'ch', e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-400 text-brand-accent focus:ring-brand-accent cursor-pointer"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
 
                {/* Sub Total row 2 */}
                <tr className="border-t-2 border-black font-extrabold bg-slate-100/60 print-bg-gray">
                  <td 
                    colSpan={2} 
                    style={{ paddingTop: `${rowPadding + 0.5}px`, paddingBottom: `${rowPadding + 0.5}px`, fontSize: `${tableFontSize}px` }}
                    className="px-3 text-right text-xs font-black uppercase tracking-wider font-sans border-r border-black"
                  >
                    <input
                      type="text"
                      value={t2TotalLabel}
                      onChange={(e) => setT2TotalLabel(e.target.value)}
                      style={{ fontSize: `${tableFontSize}px` }}
                      className="bg-transparent border-none p-0 text-right font-black uppercase text-slate-800 outline-none w-full"
                      title="Double-click/type to edit total label"
                    />
                  </td>
                  <td 
                    style={{ paddingTop: `${rowPadding + 0.5}px`, paddingBottom: `${rowPadding + 0.5}px`, fontSize: `${tableFontSize}px` }}
                    className="px-3 text-right border-r border-black font-mono font-black tracking-wide text-slate-900 bg-slate-100 print-bg-gray"
                  >
                    {totalAmount2.toLocaleString()}
                  </td>
                  <td className="bg-slate-100/60 print-bg-gray"></td>
                </tr>
              </tbody>
            </table>
          </div>
 
          {/* Footer block (Cash received / Sign / Submitted) */}
          <div className="mt-8 pt-4 border-t-2 border-slate-200 grid grid-cols-3 gap-6 text-[11px] font-mono tracking-wide">
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                value={cashReceivedLabel}
                onChange={(e) => setCashReceivedLabel(e.target.value)}
                className="font-extrabold text-slate-500 uppercase text-[10px] bg-transparent outline-none border-b border-transparent hover:border-dashed hover:border-slate-300 focus:border-slate-500 focus:bg-slate-50 w-full"
                title="Click to edit label"
              />
              <input
                type="text"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full border-b border-slate-400 border-dashed py-1 bg-transparent hover:bg-slate-50 focus:bg-slate-100 outline-none text-[12px] font-bold text-slate-800"
                placeholder=""
              />
            </div>
 
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                value={signLabel}
                onChange={(e) => setSignLabel(e.target.value)}
                className="font-extrabold text-slate-500 uppercase text-[10px] text-center bg-transparent outline-none border-b border-transparent hover:border-dashed hover:border-slate-300 focus:border-slate-500 focus:bg-slate-50 w-full"
                title="Click to edit label"
              />
              <input
                type="text"
                value={sign}
                onChange={(e) => setSign(e.target.value)}
                className="w-full border-b border-slate-400 border-dashed py-1 bg-transparent text-center hover:bg-slate-50 focus:bg-slate-100 outline-none text-[12px] font-bold text-slate-800"
                placeholder=""
              />
            </div>
 
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                value={submittedLabel}
                onChange={(e) => setSubmittedLabel(e.target.value)}
                className="font-extrabold text-slate-500 uppercase text-[10px] text-right bg-transparent outline-none border-b border-transparent hover:border-dashed hover:border-slate-300 focus:border-slate-500 focus:bg-slate-50 w-full"
                title="Click to edit label"
              />
              <input
                type="text"
                value={submitted}
                onChange={(e) => setSubmitted(e.target.value)}
                className="w-full border-b border-slate-400 border-dashed py-1 bg-transparent text-right hover:bg-slate-50 focus:bg-slate-100 outline-none text-[12px] font-bold text-slate-800"
                placeholder=""
              />
            </div>
          </div>
 
          {/* Document watermark code (very clean, professional) */}
          <div className="mt-6 pt-2 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400 uppercase tracking-widest font-mono">
            <input
              type="text"
              value={footnoteLeft}
              onChange={(e) => setFootnoteLeft(e.target.value)}
              className="bg-transparent border-none p-0 font-semibold uppercase text-slate-400 outline-none text-[8px] w-[200px]"
              title="Click to edit footnote"
            />
            <input
              type="text"
              value={footnoteRight}
              onChange={(e) => setFootnoteRight(e.target.value)}
              className="bg-transparent border-none p-0 font-semibold uppercase text-slate-400 outline-none text-[8px] text-right w-[200px]"
              title="Click to edit footnote"
            />
          </div>
 
                          </motion.div> {/* print-paper-container ends */}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })()}
            </div> {/* center scale workspace ends */}

        {/* Financial Ledger Sheets Registry & Backup Sidebar Panel on the right */}
        {showHistoryPanel && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className={`w-[380px] shrink-0 bg-[#fafafa] dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 font-sans text-slate-900 dark:text-slate-100 print:hidden text-left h-full overflow-y-auto scrollbar-thin z-[400] max-w-full ${window.innerWidth < 1024 ? 'absolute top-0 bottom-0 right-0 shadow-2xl' : 'relative'}`}
          >
            {/* Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="text-brand-accent h-5 w-5 animate-pulse" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-mono">Ledger Registry</h3>
                  <p className="text-[10px] text-slate-400">Monthly recovery historical cards</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={14} />
              </button>
            </div>

            {/* Advanced Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Advanced Search Client ID or Name..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-brand-accent rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
              />
              {historySearchQuery && (
                <button
                  onClick={() => setHistorySearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 text-[10px] bg-transparent border-none"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Financial Backup & Terminate Control Center */}
            <div className="bg-slate-950/50 rounded-xl border border-slate-800/60 p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 font-mono flex items-center gap-1">
                  <Database size={10} className="text-brand-accent" />
                  Backup & Monthly Resets
                </span>
                {backupTokens ? (
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase border border-emerald-500/10">
                    🟢 Ready
                  </span>
                ) : (
                  <span className="text-[9px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-black uppercase border border-rose-500/10 animate-pulse">
                    ⚠️ Off-line
                  </span>
                )}
              </div>

              {/* 2nd Account Logins status */}
              {!backupTokens ? (
                <button
                  onClick={handleConnectBackupAccount}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-brand-accent hover:opacity-95 text-white text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer shadow-md border-none"
                >
                  <LogIn size={11} />
                  Authorize Backup Google Account
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 text-left">
                  {/* Input target Spreadsheet ID */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Paste Backup Spreadsheet ID"
                      value={backupSpreadsheetId}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setBackupSpreadsheetId(val);
                        googleSheetsService.saveBackupSpreadsheetId(val);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-slate-300 outline-none"
                    />
                    <button
                      onClick={handleCreateBackupSheet}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-black uppercase shrink-0 border border-slate-700 cursor-pointer"
                      title="Create a fresh workbook in target secondary drive"
                    >
                      <FolderPlus size={11} />
                    </button>
                  </div>

                  {/* Account toggle and action row */}
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleBackupLedgerHistory}
                      disabled={isBackingUp}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white text-[10px] font-black tracking-wider uppercase rounded-lg shadow-md transition-all cursor-pointer border-none"
                      title="Google spreadsheet ledger backup with date sections integration"
                    >
                      <FileSpreadsheet size={11} />
                      {isBackingUp ? "Backing up..." : "Backup Grid"}
                    </button>

                    <button
                      onClick={handleTerminateMonth}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 hover:text-white text-white text-[10px] font-black tracking-wider uppercase rounded-lg shadow-md transition-all cursor-pointer border-none"
                      title="Trigger month-end reset, archiving and purging cards"
                    >
                      <Trash2 size={11} />
                      Terminate
                    </button>
                  </div>
                  
                  <button
                     onClick={() => {
                       localStorage.removeItem('gts_ledger_backup_google_tokens');
                       setBackupTokens(null);
                       toast.success("Disconnected secondary backup google account!");
                     }}
                     className="text-right text-[8.5px] text-slate-500 hover:text-slate-400 hover:underline mt-1 bg-transparent border-none cursor-pointer"
                  >
                     Disconnect Backup Account
                  </button>
                </div>
              )}
            </div>

            {/* Cards List Scroller */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[440px] scrollbar-thin scrollbar-thumb-slate-800 pr-1">
              <div className="text-[9.5px] uppercase font-black font-mono tracking-wider text-slate-500 px-1">
                Registered Sheets ({getFilteredHistory().length})
              </div>

              {getFilteredHistory().length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1 border border-dashed border-slate-800 rounded-xl">
                  <AlertCircle size={16} className="text-slate-600" />
                  <span>No historical cards match.</span>
                </div>
              ) : (
                getFilteredHistory().map((sheet) => {
                  const isLoaded = loadedSheetId === sheet.id;
                  const t1Valid = (Array.isArray(sheet.table1Rows) ? sheet.table1Rows : []).filter((r: any) => r.cId || r.name || r.amount > 0);
                  const sumT1 = t1Valid.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
                  
                  return (
                    <div
                      key={sheet.id}
                      onClick={() => handleLoadHistorySheet(sheet)}
                      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isLoaded
                          ? 'bg-brand-accent/10 border-brand-accent/60 shadow-md shadow-brand-accent/10'
                          : 'bg-slate-950/45 hover:bg-slate-900/60 border-slate-850 hover:border-slate-700'
                      }`}
                    >
                      {/* Delete button card */}
                      <button
                        onClick={(e) => handleDeleteHistorySheet(sheet.id, e)}
                        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer border-none bg-transparent"
                        title="Delete this ledger card"
                      >
                        <Trash2 size={11} />
                      </button>

                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-brand-accent/20 border border-brand-accent/35 flex items-center justify-center text-xs font-black text-brand-accent font-mono">
                          {sheet.recOfficer?.substring(0, 2).toUpperCase() || 'RO'}
                        </div>
                        <div>
                          <div className="text-xs font-black uppercase text-slate-200 line-clamp-1 pr-4">
                            {sheet.recOfficer || 'Unnamed Roll'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {sheet.sheetDate}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] border-t border-slate-800/60 pt-2 font-mono">
                        <span className="text-slate-400">
                          Area: <span className="text-slate-200 font-bold uppercase">{sheet.area || 'MAIN'}</span>
                        </span>
                        <span className="text-slate-400">
                          Sum: <span className="text-emerald-400 font-bold">Rs. {sumT1}</span>
                        </span>
                      </div>
                      
                      {isLoaded && (
                        <div className="absolute bottom-1 right-2 text-[8px] uppercase tracking-widest font-black text-brand-accent animate-pulse">
                          Active Panel
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-slate-950/20 rounded-lg p-2.5 text-[9px] text-slate-500 leading-normal border border-slate-900">
              ⚡ <span className="font-extrabold uppercase">Interactive Hub:</span> Select historic cards to restore state into live printable sheet paper. Re-run advanced queries directly above.
            </div>
          </motion.div>
        )}
        </div> {/* Main Integrated Workspace ends */}
          </>
        )}
      </motion.div> {/* print-overlay-wrapper ends */}

      {/* Beautiful Reset & Purge Confirmation Modal */}
      <AnimatePresence>
        {/* Duplicate Entry Warning Modal */}
        {duplicateWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white border-2 border-rose-500 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 border-2 border-rose-200">
                  <ShieldAlert size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight uppercase">Double Entry Warning</h3>
                  <p className="text-xs font-bold text-rose-500 tracking-widest uppercase mt-0.5">Potential Duplicate Detected</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8 relative z-10">
                <p className="text-sm font-semibold text-slate-700 leading-relaxed text-center">
                  {duplicateWarning.message}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-auto relative z-10">
                <button
                  onClick={() => setDuplicateWarning(null)}
                  className="px-6 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-black text-sm uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    proceedSelectSuggestion(duplicateWarning.index, duplicateWarning.client);
                    setDuplicateWarning(null);
                  }}
                  className="px-6 py-3 rounded-xl bg-rose-500 text-white font-black text-sm uppercase tracking-wider hover:bg-rose-600 shadow-lg shadow-rose-500/20 transition-all active:scale-95 border-2 border-rose-500"
                >
                  Okay, Add Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* User Search Entry Locator Popup Screen */}
        {showUserSearchPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden text-left"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-100 dark:border-emerald-900/50">
                    <Sparkles size={20} className="animate-pulse text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-500 font-mono">
                      Entry Locator Registry Match
                    </h4>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Search results for: "<span className="text-emerald-500">{dashboardSearchQuery}</span>"
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUserSearchPopup(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-750 dark:hover:text-slate-200 rounded-lg transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-thin">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  FOUND {userSearchResults.length} LEDGER {userSearchResults.length === 1 ? 'SHEET' : 'SHEETS'} CONTAINER IN SYSTEM MEMORY:
                </p>

                {userSearchResults.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-400">
                      <Search size={32} />
                    </div>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mt-1">
                      No matching records found
                    </p>
                    <p className="text-xs text-slate-450 dark:text-slate-550 max-w-sm mx-auto uppercase tracking-wide leading-relaxed font-semibold">
                      We couldn't locate any consumer entry containing user ID, Name, or reference matching "{dashboardSearchQuery}" inside your active monthly sheets.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userSearchResults.map((res: any, idx) => {
                      const sh = res.sheet;
                      const matchedRows = res.matchedRows;
                      const folderName = sheetFolderMap[sh.id] 
                        ? (folders.find(f => f.id === sheetFolderMap[sh.id])?.name || "Uncategorized")
                        : "Uncategorized";

                      return (
                        <div
                          key={`res-${sh.id}-${idx}`}
                          className="p-5 bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-850 rounded-2.5xl hover:border-slate-300 dark:hover:border-slate-750 transition-all space-y-4 text-left"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-105 dark:border-slate-850">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-550 dark:text-blue-400 rounded-xl">
                                <FileSpreadsheet size={18} />
                              </div>
                              <div className="text-left">
                                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-350 px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[8px] mr-1 ml-0 border border-slate-300/30">
                                  Folder: /{folderName}
                                </span>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mt-1.5">
                                  Sheet Date: {sh.sheetDate || "No Date"}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase">
                                    Officer: <span className="text-slate-755 dark:text-slate-350 text-emerald-500">{sh.recOfficer || "N/A"}</span>
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase">
                                    Area: <span className="text-slate-755 dark:text-slate-350">{sh.area || "N/A"}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleLoadHistorySheet(sh);
                                setShowUserSearchPopup(false);
                              }}
                              className="px-4 py-2 bg-gradient-to-r from-blue-650 to-indigo-650 hover:from-blue-550 hover:to-indigo-555 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-550/15 border-none"
                            >
                              <span>Open Sheet</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>

                          {/* Matched row list within this sheet */}
                          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-105/60 dark:bg-slate-900/60 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-550 border-b border-slate-100 dark:border-slate-805">
                                  <th className="px-3 py-2">C. ID</th>
                                  <th className="px-3 py-2">Name</th>
                                  <th className="px-3 py-2">Comments / Ref</th>
                                  <th className="px-3 py-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchedRows.map((row: any, rIdx: number) => (
                                  <tr
                                    key={`row-${rIdx}`}
                                    className="border-b border-slate-100/60 dark:border-slate-850 last:border-none font-bold text-slate-750 dark:text-slate-100"
                                  >
                                    <td className="px-3 py-2 text-[10px] font-mono text-blue-500">{row.cId || "N/A"}</td>
                                    <td className="px-3 py-2 font-black uppercase text-[10.5px]">{row.name || "N/A"}</td>
                                    <td className="px-3 py-2 text-[10px] text-slate-450 dark:text-slate-400 font-semibold">{row.comments || "—"}</td>
                                    <td className="px-3 py-2 text-right font-black text-emerald-500 font-mono text-[11px]">
                                      Rs. {row.amount?.toLocaleString() || "0"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-slate-850 flex justify-end gap-2 bg-slate-100/10 dark:bg-slate-900/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowUserSearchPopup(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-750 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border border-slate-205/50 dark:border-slate-700 font-bold"
                >
                  Close Results
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showConfirmResetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2.5xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden text-left"
            >
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 shrink-0">
                    <AlertCircle size={20} className="animate-pulse text-rose-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-rose-500 font-mono">
                      CONFIRM TOTAL RESET
                    </h4>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Reset Workspace & History?
                    </h3>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                  <p className="uppercase text-[9px] font-bold text-slate-400">
                    Choose one of the core reset operations below:
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                    <p className="font-extrabold text-[#0f172a] dark:text-slate-200 uppercase text-[9.5px] tracking-wide flex items-center gap-1.5 label-danger">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Option 1: Total Server Purge
                    </p>
                    <p className="text-[10px] text-slate-450 dark:text-slate-400 font-bold leading-normal uppercase">
                      Resets live inputs and permanently purges <span className="text-rose-500 font-black">{ledgerHistory.length} registered monthly sheets</span> on Firebase.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => handleResetWorkspaceAndHistory(true)}
                    className="w-full py-2 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-rose-550/15 border-none text-center"
                  >
                    💥 Clear Screen & Delete All history
                  </button>

                  <button
                    onClick={() => handleResetWorkspaceAndHistory(false)}
                    className="w-full py-2 px-4 bg-brand-accent hover:opacity-90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm border-none text-center"
                  >
                    🧹 Clear SCREEN Inputs Only
                  </button>

                  <button
                    onClick={() => setShowConfirmResetModal(false)}
                    className="w-full py-1.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border border-slate-200 dark:border-slate-700 text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* Folder Settings Popup */}
        {settingsFolderId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setSettingsFolderId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Folder Settings</h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Manage Recovery Connection</p>
                </div>
                <button
                  onClick={() => setSettingsFolderId(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">
                    Connected Recovery Sheet (Billing Month)
                  </label>
                  <select
                    value={folders.find(f => f.id === settingsFolderId)?.connectedMonthId || ''}
                    onChange={(e) => {
                      const newMonthId = e.target.value;
                      const newFolders = folders.map(f => f.id === settingsFolderId ? { ...f, connectedMonthId: newMonthId } : f);
                      setFolders(newFolders);
                      saveFoldersToDb(newFolders);
                      toast.success(newMonthId ? "Folder connected to Recovery Sheet!" : "Folder disconnected.");
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold p-3 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Not Connected --</option>
                    {billingMonths.map(m => {
                      const totalTarget = m.rows?.reduce((acc: number, r: any) => acc + (parseFloat(r.totalAmount) || 0), 0) || 0;
                      return (
                        <option key={m.id} value={m.id}>{m.id} (Target: {totalTarget.toLocaleString()})</option>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase mt-2 leading-relaxed">
                    When connected, any entry activity inside this folder will automatically update the selected Recovery Sheet. If not connected, updates will remain local.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                  <button
                    onClick={() => setSettingsFolderId(null)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-md"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
