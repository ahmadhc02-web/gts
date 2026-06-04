import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, Trash2, RefreshCw, ClipboardList, Check, Info, FileSpreadsheet, Sparkles, Settings2, SlidersHorizontal, RotateCcw,
  History, Save, Search, Key, FolderPlus, AlertCircle, Database, ChevronRight, LogIn, ChevronLeft, Shield, ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { firebaseService } from '../lib/firebaseService';
import { googleSheetsService } from '../services/googleSheetsService';
import { Client, UserProfile } from '../types';
import { getCleanErrorMessage } from '../lib/styleUtils';

interface EntrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  activeRows?: any[]; // For pre-filling rows
  currentMonthId?: string;
  isBillingUnlocked?: boolean;
  appConfig?: any;
}

interface Table1Row {
  sr: any;
  cId: string;
  name: string;
  comments: string;
  amount: number;
  ch: boolean;
  originalAmount?: number;
  clientId?: string;
  clientUsername?: string;
}

interface Table2Row {
  sr: any;
  name: string;
  amount: number;
  ch: boolean;
}

export default function EntrySheet({ 
  isOpen, 
  onClose, 
  currentUser, 
  activeRows = [], 
  currentMonthId,
  isBillingUnlocked,
  appConfig
}: EntrySheetProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const isDealerTied = currentUser.role === 'dealer' || (currentUser.dealerId && currentUser.dealerId !== 'main');
  const activeDealerId = isDealerTied ? firebaseService.getTenantId(currentUser) : undefined;

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
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
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

  useEffect(() => {
    if (zoomOption !== 'fit') {
      if (zoomOption === '100%') setCalculatedScale(1);
      else if (zoomOption === '85%') setCalculatedScale(0.85);
      else if (zoomOption === '75%') setCalculatedScale(0.72);
      return;
    }

    const handleResize = () => {
      let availableWidth = window.innerWidth - 32;
      let availableHeight = window.innerHeight - 110 - (isLocked ? 95 : 0) - 16;

      if (workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        const containerWidth = workspaceRef.current.clientWidth || rect.width;
        const containerHeight = workspaceRef.current.clientHeight || rect.height;

        const warningBanner = workspaceRef.current.querySelector(".bg-amber-500\\/10");
        const warningHeight = warningBanner ? warningBanner.getBoundingClientRect().height + 16 : 0;

        availableWidth = containerWidth - 32;
        availableHeight = containerHeight - warningHeight - 24;
      }

      const paperHeight = 1122.5; // approx 297mm A4 height in pixels
      const paperWidth = 793.7; // approx 210mm A4 width in pixels

      const fitScaleHeight = availableHeight / paperHeight;
      const fitScaleWidth = availableWidth / paperWidth;

      const bestFitScale = Math.min(fitScaleHeight, fitScaleWidth);
      const finalScale = Math.min(1.0, Math.max(0.25, bestFitScale));
      setCalculatedScale(finalScale);
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
  }, [zoomOption, isLocked, isOpen]);

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

  // Setup initial empty ledger rows
  const resetToBlank = () => {
    // Current date format matching: DD - MM - YYYY
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setSheetDate(`${day} - ${month} - ${year}`);
    
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
    setTable2Rows([
      { sr: 1, name: 'Bank', amount: 0, ch: false },
      { sr: 2, name: 'Panel Balance', amount: 0, ch: false },
      { sr: 3, name: 'Cash Hand', amount: 0, ch: false }
    ]);

    setCashReceived('');
    setSign('');
    setSubmitted('');
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
      if (!recOfficer.trim()) {
        toast.error("Please specify a Recovery Officer name first.");
        return;
      }

      // Check if some rows contain data to prevent completely empty submissions
      const hasT1Data = table1Rows.some(r => r.cId.trim() || r.name.trim() || r.amount > 0);
      const hasT2Data = table2Rows.some(r => r.name.trim() || r.amount > 0);
      if (!hasT1Data && !hasT2Data) {
        toast.error("The ledger sheet is completely empty. Please enter some records first!");
        return;
      }

      const tenantId = firebaseService.getReadTenantId(currentUser as any);
      const sheetPayload = {
        id: loadedSheetId || undefined,
        recOfficer,
        recOfficerLabel,
        area,
        areaLabel,
        sheetDate,
        dateLabel,
        table1Rows: table1Rows.map(r => ({
          sr: r.sr,
          cId: r.cId || '',
          name: r.name || '',
          comments: r.comments || '',
          amount: Number(r.amount) || 0,
          ch: !!r.ch,
          originalAmount: r.originalAmount || 0,
          clientId: r.clientId || '',
          clientUsername: r.clientUsername || ''
        })),
        table2Rows: table2Rows.map(r => ({
          sr: r.sr,
          name: r.name || '',
          amount: Number(r.amount) || 0,
          ch: !!r.ch
        })),
        cashReceived,
        sign,
        submitted,
        cashReceivedLabel,
        signLabel,
        submittedLabel,
        footnoteLeft,
        footnoteRight,
        dealerId: tenantId || 'main',
        createdAt: loadedSheetId ? undefined : Date.now() // Retain creation date on update
      };

      toast.loading(loadedSheetId ? "Updating ledger card in history..." : "Moving active ledger sheet down to history...", { id: "ledger-save" });

      const saved = await firebaseService.saveLedgerSheet(sheetPayload);
      toast.dismiss("ledger-save");
      if (saved) {
        toast.success(loadedSheetId ? "Ledger card updated successfully!" : "Ledger sheet successfully saved to Monthly History!");

        // Auto-update matched master clients inside the currently active/selected billing month
        if (currentMonthId && activeRows && activeRows.length > 0) {
          try {
            const updatedBillingRows = [...activeRows];
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
                matchedIdx = updatedBillingRows.findIndex(br => 
                  (searchClientId && br.clientId && br.clientId.trim().toLowerCase() === searchClientId) ||
                  (searchClientUsername && br.username && br.username.trim().toLowerCase() === searchClientUsername)
                );
              }

              // 2. Fallback to typed matching by ID or Username
              if (matchedIdx === -1 && hasId) {
                const searchId = r.cId.trim().toLowerCase();
                matchedIdx = updatedBillingRows.findIndex(br => 
                  (br.clientId && br.clientId.trim().toLowerCase() === searchId) ||
                  (br.username && br.username.trim().toLowerCase() === searchId)
                );
              }

              // 3. Last fallback: match by Name
              if (matchedIdx === -1 && hasName) {
                const searchName = r.name.trim().toLowerCase();
                matchedIdx = updatedBillingRows.findIndex(br => 
                  br.name && br.name.trim().toLowerCase() === searchName
                );
              }

              if (matchedIdx !== -1) {
                const amountVal = Number(r.amount) || 0;
                const row = updatedBillingRows[matchedIdx];
                const savedOrigCr = row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0);
                const newCr = Math.max(0, savedOrigCr - amountVal);
                const base = parseFloat(row.baseAmount || 0);

                // Auto calculate status based on payment vs total
                const totalAmount = base + newCr;
                let finalStatus = 'partial';
                if (amountVal === 0) {
                  finalStatus = 'unpaid';
                } else if (amountVal >= totalAmount) {
                  finalStatus = 'paid';
                }

                updatedBillingRows[matchedIdx] = {
                  ...row,
                  _originalCr: savedOrigCr,
                  cr: newCr,
                  totalAmount: totalAmount,
                  paymentReceived: amountVal,
                  paymentStatus: finalStatus
                };
                updatedCount++;
              }
            });

            if (updatedCount > 0) {
              await firebaseService.saveBillingMonth(
                currentMonthId, 
                updatedBillingRows, 
                currentUser.username || 'admin',
                activeDealerId
              );
              toast.success(`Automatically updated ${updatedCount} subscriber(s) to PAID with designated recovery amounts in ${currentMonthId}!`);
            }
          } catch (billingErr: any) {
            console.error("Failed to auto-update billing status:", billingErr);
          }
        }

        // "jesy sheet histry main move hojy to bahr new empty sheet automatic creat hojy same"
        resetToBlank();
        setLoadedSheetId(null);
        // "histry butten per click kru to waja cards show hongy sheet ke" => transition to history tab
        setShowHistoryPanel(true);
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
    const reT1 = (sheet.table1Rows || []).map((r: any) => ({
      sr: r.sr,
      cId: r.cId || '',
      name: r.name || '',
      comments: r.comments || '',
      amount: Number(r.amount) || 0,
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
    const reT2 = (sheet.table2Rows || []).map((r: any) => ({
      sr: r.sr,
      name: r.name || '',
      amount: Number(r.amount) || 0,
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

    toast.info(`Loaded sheet card for recovery officer: ${sheet.recOfficer}`);
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
  const totalAmount1 = table1Rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalAmount2 = table2Rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Edit helper for Table 1
  const handleT1Change = (index: number, field: keyof Table1Row, value: any) => {
    if (isLocked) return;
    const updated = [...table1Rows];
    let commentsVal = updated[index].comments;

    if (field === 'comments') {
      commentsVal = value;
    } else if (field === 'amount') {
      const orig = updated[index].originalAmount;
      if (typeof orig === 'number') {
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

  const handleSelectSuggestion = (index: number, client: any) => {
    if (isLocked) return;
    // Find if there's an outstanding month payment entry for them
    const matchingActiveRow = activeRows?.find(r => 
      (r.username && r.username.toLowerCase() === client.username?.toLowerCase()) || 
      (r.clientId && r.clientId.toLowerCase() === client.id?.toLowerCase())
    );

    const updated = [...table1Rows];
    let amount = 0;
    
    if (matchingActiveRow) {
      const totalAmt = parseFloat(matchingActiveRow.totalAmount) || 0;
      const rcvAmt = parseFloat(matchingActiveRow.paymentReceived) || 0;
      const outstanding = totalAmt - rcvAmt;
      amount = outstanding > 0 ? outstanding : totalAmt;
    } else {
      // parse from package details if available
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
    
    // Clear suggestion states
    setFocusedRowIndex(null);
    setFocusedField(null);
    setSearchQuery('');
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

  return createPortal(
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className="print-overlay-wrapper fixed inset-0 bg-slate-100 dark:bg-slate-950 z-[250] flex flex-col items-stretch justify-start overflow-hidden print:p-0 print:bg-transparent print:backdrop-blur-none print:block print:static text-slate-950 dark:text-slate-100 font-sans"
      >
        {/* Full-Width Workspace Premium Navbar (Replaces the floating right toolbar) */}
        <div className="w-full bg-[#fcfcfc] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-4 z-[310] print:hidden shrink-0 select-none">
          {/* Left Block */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <ChevronLeft size={14} className="text-blue-500" />
              Portal
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
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
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
              overflow: hidden !important;
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
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: ${paperPaddingY}mm ${paperPaddingX}mm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              box-sizing: border-box !important;
              page-break-after: avoid !important;
              page-break-before: avoid !important;
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
        <div className="flex-1 w-full flex flex-row items-stretch overflow-hidden print:block print:p-0 print:overflow-visible print:h-auto">
          {/* Left Inline Sizing Designer Panel with custom enter animations */}
          <AnimatePresence mode="popLayout">
          {showSizingPanel && (
            <motion.div 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 280 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[280px] bg-[#fdfdfd] dark:bg-slate-900 border-r border-slate-205 dark:border-slate-800/85 p-4 overflow-y-auto shrink-0 print:hidden h-full text-slate-850 dark:text-slate-100 select-none text-left scrollbar-thin flex flex-col gap-3 font-mono"
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
              className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-start bg-slate-100 dark:bg-slate-900/40 scrollbar-thin relative h-full print:bg-transparent print:p-0 print:m-0 print:block print:overflow-visible print:h-auto select-none print:select-text"
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

              <div 
                className="relative flex items-start justify-center print:block print:w-auto print:h-auto shrink-0 print:static my-auto mx-auto"
                style={{
                  width: `calc(210mm * ${calculatedScale})`,
                  height: `calc(297mm * ${calculatedScale})`,
                  minWidth: `calc(210mm * ${calculatedScale})`,
                  minHeight: `calc(297mm * ${calculatedScale})`,
                }}
              >
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
                  className={`print-paper-container bg-white border border-slate-350 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-lg w-[210mm] min-h-[297mm] flex flex-col text-[#0f172a] font-sans print:p-0 print:m-0 print:border-none print:shadow-none print:static print:transform-none select-text ${isLocked ? 'pointer-events-none opacity-80 select-none' : ''}`}
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
                      className="w-full text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
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
                      className="w-full text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
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
                      className="w-full text-left bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase px-1"
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
                      className="w-full text-left bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase px-1"
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
                      className="w-full text-right bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase pr-4"
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
                      className="w-full text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
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
                        className="w-full border-none p-0 text-center text-slate-600 bg-transparent focus:bg-slate-100 font-bold outline-none font-sans"
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
                        className="w-full border-none p-0 text-center text-slate-900 bg-transparent focus:bg-slate-100 font-bold tracking-tight outline-none"
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
                              const outstandingStr = matchingActiveRow 
                                ? `Outstanding: Rs. ${parseFloat(matchingActiveRow.totalAmount || '0') - parseFloat(matchingActiveRow.paymentReceived || '0')}`
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
                              const outstandingStr = matchingActiveRow 
                                ? `Outstanding: Rs. ${parseFloat(matchingActiveRow.totalAmount || '0') - parseFloat(matchingActiveRow.paymentReceived || '0')}`
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
                        className="w-full border-none p-0 text-slate-600 dark:text-slate-600 bg-transparent font-semibold focus:bg-slate-100 outline-none"
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
                        onChange={(e) => handleT1Change(index, 'amount', parseFloat(e.target.value) || 0)}
                        style={{ fontSize: `${tableFontSize}px` }}
                        className="w-full border-none p-0 text-right text-slate-900 font-black bg-transparent focus:bg-slate-100 outline-none font-mono"
                      />
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
                      className="w-full text-center bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase"
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
                      className="w-full text-left bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase px-1"
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
                      className="w-full text-right bg-transparent border-none p-0 font-extrabold text-black font-mono focus:bg-slate-200 outline-none uppercase pr-4"
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
                        className="w-full border-none p-0 text-center text-slate-600 bg-transparent focus:bg-slate-100 font-bold outline-none font-sans"
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
                        className="w-full border-none p-0 text-slate-900 font-black tracking-wide bg-transparent focus:bg-slate-100 outline-none uppercase font-mono"
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
                        className="w-full border-none p-0 text-right text-slate-900 font-black bg-transparent focus:bg-slate-100 outline-none font-mono"
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
              </div> {/* relative wrapper ends */}
            </div> {/* center scale workspace ends */}

        {/* Financial Ledger Sheets Registry & Backup Sidebar Panel on the right */}
        {showHistoryPanel && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="w-[380px] shrink-0 bg-[#fafafa] dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 font-sans text-slate-900 dark:text-slate-100 print:hidden text-left h-full overflow-y-auto scrollbar-thin z-[300]"
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
                  const t1Valid = (sheet.table1Rows || []).filter((r: any) => r.cId || r.name || r.amount > 0);
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
      </motion.div> {/* print-overlay-wrapper ends */}

      {/* Beautiful Reset & Purge Confirmation Modal */}
      <AnimatePresence>
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
      </AnimatePresence>
    </>,
    document.body
  );
}
