import React, { Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  X, Printer, Trash2, RefreshCw, Check, FileSpreadsheet, Sparkles,
  Save, Search, FolderPlus, AlertCircle, ChevronRight, ChevronLeft, Shield, ShieldAlert,
  ArrowUpDown, Folder, Plus, FileText, FolderOpen, UserPlus, ArrowLeft, FileDown, Settings, Loader2, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService, pocketbaseService, globalTableCaches, updateClientFee } from '../lib/supabaseService';
import { supabase } from '../lib/supabase';
import { googleSheetsService } from '../services/googleSheetsService';
import { UserProfile } from '../types';
import { getCleanErrorMessage } from '../lib/styleUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SkBar, SkFrame, SkTable } from './skeleton/Skeleton';
import { useSkeletonGate } from './skeleton/useSkeletonGate';
import { overlayMotion, dialogMotion } from '../lib/motionPresets';
import { DeferredBody } from './ui/DeferredBody';
import { usePopupTiming } from '../lib/usePopupTiming';
import { useBillingFresh } from '../lib/useBillingFresh';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { Table1Row, Table2Row } from './entrysheet/types';
import {
  safeGetStorageItem,
  safeSetStorageItem,
  safeRemoveStorageItem,
  getValidCacheItem,
  debouncedSetStorageItem,
  setCachedItemWithMeta,
  flushPendingStorageWrites,
  logPerf,
} from './entrysheet/storageCache';
import {
  areRecordsShallowEqual,
  areFoldersEqual,
  areClientsEqual,
  areLedgerSheetsEqual,
} from './entrysheet/compareHelpers';
import {
  FoldersGridSkeleton,
  SheetListSkeleton,
  A4SheetSkeleton,
  SizingPanelSkeleton,
  HistoryPanelSkeleton,
  ReceiptPreviewPanelSkeleton,
  ModalDialogSkeleton,
} from './entrysheet/EntrySheetSkeletons';
import { Table1RowItem } from './entrysheet/Table1RowItem';
import { Table2RowItem } from './entrysheet/Table2RowItem';
import { SuggestionsDropdown, SuggestionsDropdownHandle } from './entrysheet/SuggestionsDropdown';
import { EditorToolbar } from './entrysheet/EditorToolbar';

const HistoryPanel = lazyWithRetry(() => import('./entrysheet/HistoryPanel'));
const SizingPanel = lazyWithRetry(() => import('./entrysheet/SizingPanel'));
const TerminateMonthModal = lazyWithRetry(() => import('./entrysheet/TerminateMonthModal'));
const ReceiptPreviewPanel = lazyWithRetry(() => import('./entrysheet/ReceiptPreviewPanel'));
const FolderSettingsModal = lazyWithRetry(() => import('./entrysheet/FolderSettingsModal'));

interface EntrySheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  activeRows?: any[]; // For pre-filling rows
  currentMonthId?: string;
  isBillingUnlocked?: boolean;
  appConfig?: any;
  billingMonths?: any[];
  billingMonthsList?: { id: string }[];
  initialShowUserLedger?: boolean;
  setBillingMonths?: React.Dispatch<React.SetStateAction<any[]>>;
  savingMonthIds?: React.MutableRefObject<Set<string>>;
  onRequestResync?: () => Promise<any> | void;
}

const parseRowsArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
};

const ColumnDragHandle = ({ min, max, value, onChange, onDragEnd }: { min: number, max: number, value: number, onChange: (v: number) => void, onDragEnd: () => void }) => {
  const handleRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startWidthRef = useRef(0);
  const dragActivatedRef = useRef(false);

  const finishDrag = useCallback((notifyEnd: boolean) => {
    const pointerId = activePointerIdRef.current;
    activePointerIdRef.current = null;
    const wasActivated = dragActivatedRef.current;
    dragActivatedRef.current = false;
    document.body.style.cursor = '';

    if (pointerId !== null && handleRef.current) {
      try {
        if (handleRef.current.hasPointerCapture(pointerId)) {
          handleRef.current.releasePointerCapture(pointerId);
        }
      } catch {
        // ignore if already released
      }
    }

    if (notifyEnd && wasActivated && onDragEnd) {
      onDragEnd();
    }
  }, [onDragEnd]);

  useEffect(() => {
    const handleWindowBlur = () => {
      if (activePointerIdRef.current !== null) {
        finishDrag(true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden && activePointerIdRef.current !== null) {
        finishDrag(true);
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      finishDrag(false);
    };
  }, [finishDrag]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startWidthRef.current = value;
    dragActivatedRef.current = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture is unsupported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (!dragActivatedRef.current) {
      // Only lock into column resize after > 6px horizontal movement
      if (Math.abs(dx) <= 6) {
        // If user moved noticeably vertically before 6px horizontally, yield immediately
        if (Math.abs(dy) > 10) {
          finishDrag(false);
        }
        return;
      }
      dragActivatedRef.current = true;
      document.body.style.cursor = 'col-resize';
    }

    let newWidth = startWidthRef.current + dx;
    if (newWidth < min) newWidth = min;
    if (newWidth > max) newWidth = max;
    onChange(newWidth);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    finishDrag(true);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    finishDrag(true);
  };

  const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    finishDrag(true);
  };

  return (
    <div
      ref={handleRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-brand-accent z-10 transition-colors print:hidden"
      style={{ right: '-1px', touchAction: 'none' }}
    />
  );
};



export default function EntrySheet({ 
  isOpen, 
  onClose, 
  currentUser, 
  activeRows = [], 
  currentMonthId,
  isBillingUnlocked,
  appConfig,
  billingMonths = [],
  billingMonthsList = [],
  initialShowUserLedger = false,
  setBillingMonths,
  savingMonthIds,
  onRequestResync
}: EntrySheetProps) {
  usePopupTiming('EntrySheet', isOpen);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const matchSheet = location.pathname.match(/\/billingmod\/(?:entrysheet|ledger)\/folder\/([^\/]+)\/sheet\/([^\/]+)/);
  const matchFolder = location.pathname.match(/\/billingmod\/(?:entrysheet|ledger)\/folder\/([^\/]+)/);

  const urlFolderId = matchSheet ? matchSheet[1] : matchFolder ? matchFolder[1] : null;
  const urlSheetId = matchSheet ? matchSheet[2] : null;

  const isDealerTied = currentUser.role === 'dealer' || (currentUser.dealerId && currentUser.dealerId !== 'main');
  const activeDealerId = isDealerTied ? pocketbaseService.getTenantId(currentUser) : undefined;

  // --- Folders & Dashboard State ---
  const openedFolderId = urlFolderId === 'all' ? null : urlFolderId;
  const loadedSheetId = urlSheetId;
  const activeView = (loadedSheetId ? 'editor' : 'dashboard') as 'dashboard' | 'editor';
  const [folders, setFolders] = useState<any[]>(() => {
    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    const syncKey = `ledger_folders_${originalScopeId}_${currentUser?.lineCode || 'nolc'}`;
    if ((globalTableCaches as any)[syncKey] && Array.isArray((globalTableCaches as any)[syncKey])) {
      return (globalTableCaches as any)[syncKey];
    }
    const key1 = `gts_cache_v3_ledger_folders_${originalScopeId}_${currentUser?.lineCode || 'nolc'}`;
    const key2 = `gts_cache_v3_ledger_folders_all_${currentUser?.lineCode || 'nolc'}`;
    const key3 = `gts_cache_v3_ledger_folders_${originalScopeId}`;
    const saved = isDealerTied
      ? (getValidCacheItem(key1) || getValidCacheItem(key3))
      : (getValidCacheItem(key1) || getValidCacheItem(key2) || getValidCacheItem(key3));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const setSheetFolderMap = (val: any) => {
    // Deprecated: rely exclusively on ledger_sheets.folder_id column
  };
  const [folderMonthMap, setFolderMonthMap] = useState<Record<string, string>>(() => {
    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    const saved = getValidCacheItem(`gts_ledger_folder_months_${originalScopeId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    return {};
  });
  const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
  const sheetFolderMap = useMemo(() => {
    const map: Record<string, string> = {};
    ledgerHistory.forEach(sh => {
      if (sh.id) {
        map[sh.id] = sh.folderId || '';
      }
    });
    return map;
  }, [ledgerHistory]);

  const billingFresh = useBillingFresh();
  const billingFreshRef = useRef(billingFresh);
  const prevBillingFreshRef = useRef(billingFresh);
  const freshReasonRef = useRef<'scope-change' | 'loaded' | 'timeout' | 'resync'>('scope-change');
  if (prevBillingFreshRef.current !== billingFresh) {
    prevBillingFreshRef.current = billingFresh;
    if (billingFresh && freshReasonRef.current !== 'resync') {
      freshReasonRef.current = 'loaded';
    } else if (!billingFresh) {
      freshReasonRef.current = 'scope-change';
    }
  }
  billingFreshRef.current = billingFresh;

  const foldersFreshRef = useRef(false);
  const folderMonthsFreshRef = useRef(false);
  const [isFoldersFresh, setIsFoldersFresh] = useState(false);
  const [isFolderMonthsFresh, setIsFolderMonthsFresh] = useState(false);
  const [resyncNonce, setResyncNonce] = useState(0);
  const [isSyncSlow, setIsSyncSlow] = useState(false);
  const [staleOk, setStaleOk] = useState(false);
  const staleOkRef = useRef(false);
  staleOkRef.current = staleOk;
  const isSavingSheetRef = useRef(false);

  const isDataFresh = Boolean(billingFresh && isFoldersFresh && isFolderMonthsFresh);
  const openedUpdatedAtBySheetIdRef = useRef<Map<string, number | string>>(new Map());

  const [settingsFolderId, setSettingsFolderId] = useState<string | null>(null);
  const [folderToDeleteId, setFolderToDeleteId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState<string>('');
  const [editConnectedMonthId, setEditConnectedMonthId] = useState<string>('');

  useEffect(() => {
    if (settingsFolderId) {
      const folder = folders.find(f => f.id === settingsFolderId);
      setEditFolderName(folder?.name || '');
      setEditConnectedMonthId(folderMonthMap[settingsFolderId] || folder?.connectedMonthId || '');
    } else {
      setEditFolderName('');
      setEditConnectedMonthId('');
    }
  }, [settingsFolderId, folderMonthMap]);

  const [internalMonthsList, setInternalMonthsList] = useState<{ id: string }[]>([]);
  const [isLoadingOpenedFolder, setIsLoadingOpenedFolder] = useState<boolean>(false);
  const effectiveMonthsList = useMemo(() => {
    if (billingMonthsList && billingMonthsList.length > 0) return billingMonthsList;
    if (internalMonthsList.length > 0) return internalMonthsList;
    return billingMonths;
  }, [billingMonthsList, internalMonthsList, billingMonths]);

  const hasOpenedFolderSheets = useMemo(() => {
    if (!openedFolderId) return false;
    return ledgerHistory.some(sh => sh.folderId === openedFolderId || sheetFolderMap[sh.id] === openedFolderId);
  }, [openedFolderId, ledgerHistory, sheetFolderMap]);

  const ledgerHistoryRef = useRef(ledgerHistory);
  ledgerHistoryRef.current = ledgerHistory;
  const loadedPrefsUidRef = useRef<string | null>(null);

  const hadFoldersCacheRef = useRef(folders.length > 0);
  const hadMonthsCacheRef = useRef(effectiveMonthsList.length > 0 || billingMonths.length > 0);

  useEffect(() => {
    if (folders.length > 0 || isFoldersFresh) {
      hadFoldersCacheRef.current = true;
    }
  }, [folders.length, isFoldersFresh]);

  useEffect(() => {
    if (effectiveMonthsList.length > 0 || billingMonths.length > 0 || isFolderMonthsFresh) {
      hadMonthsCacheRef.current = true;
    }
  }, [effectiveMonthsList.length, billingMonths.length, isFolderMonthsFresh]);

  const triggerResync = useCallback((reason: 'timeout' | 'resync' = 'resync') => {
    freshReasonRef.current = reason;
    setResyncNonce(n => n + 1);
    if (onRequestResync) {
      Promise.resolve(onRequestResync()).catch(err => {
        console.warn('[Fresh] onRequestResync failed:', err);
      });
    }
  }, [onRequestResync]);

  const triggerResyncRef = useRef(triggerResync);
  triggerResyncRef.current = triggerResync;

  const waitForFresh = useCallback((timeoutMs: number) => {
    const checkReady = () =>
      (pocketbaseService.getBillingFresh() && foldersFreshRef.current && folderMonthsFreshRef.current) ||
      staleOkRef.current;

    if (checkReady()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let unsubBilling: (() => void) | null = null;
      let pollTimer: number | null = null;
      let timeoutTimer: number | null = null;

      const cleanup = () => {
        if (unsubBilling) {
          unsubBilling();
          unsubBilling = null;
        }
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        if (timeoutTimer !== null) {
          window.clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      };

      const tryResolve = () => {
        if (settled) return;
        if (checkReady()) {
          settled = true;
          cleanup();
          resolve();
        }
      };

      unsubBilling = pocketbaseService.subscribeBillingFresh(tryResolve);
      pollTimer = window.setInterval(tryResolve, 100);
      timeoutTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Sync timed out'));
      }, timeoutMs);
    });
  }, []);

  // Diagnostic freshness log whenever any freshness piece changes
  const prevFreshLogRef = useRef<{ billing: boolean; folders: boolean; months: boolean; staleOk: boolean } | null>(null);
  useEffect(() => {
    const prev = prevFreshLogRef.current;
    if (
      !prev ||
      prev.billing !== billingFresh ||
      prev.folders !== isFoldersFresh ||
      prev.months !== isFolderMonthsFresh ||
      prev.staleOk !== staleOk
    ) {
      prevFreshLogRef.current = {
        billing: billingFresh,
        folders: isFoldersFresh,
        months: isFolderMonthsFresh,
        staleOk
      };
      console.log(
        `[Fresh] billing=${billingFresh} folders=${isFoldersFresh} months=${isFolderMonthsFresh} staleOk=${staleOk} reason=${freshReasonRef.current}`
      );
    }
  }, [billingFresh, isFoldersFresh, isFolderMonthsFresh, staleOk]);

  // Watchdog timer when sheet opens or isDataFresh turns false (8s retry + 15s staleOk fallback)
  useEffect(() => {
    if (!isOpen || isDataFresh) {
      setIsSyncSlow(false);
      setStaleOk(false);
      return;
    }

    setIsSyncSlow(false);
    let didForceResync = false;

    const slowTimer = window.setTimeout(() => {
      setIsSyncSlow(true);
      if (!didForceResync) {
        didForceResync = true;
        triggerResyncRef.current('timeout');
      }
    }, 8000);

    const staleTimer = window.setTimeout(() => {
      if (hadFoldersCacheRef.current && hadMonthsCacheRef.current) {
        freshReasonRef.current = 'timeout';
        setStaleOk(true);
      }
    }, 15000);

    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(staleTimer);
    };
  }, [isOpen, isDataFresh]);

  // Scoped folders loading on user change or forced resync
  const prevFolderScopeRef = useRef({
    uid: currentUser?.uid,
    dealerId: activeDealerId,
    isDealerTied
  });
  useEffect(() => {
    const scopeChanged =
      prevFolderScopeRef.current.uid !== currentUser?.uid ||
      prevFolderScopeRef.current.dealerId !== activeDealerId ||
      prevFolderScopeRef.current.isDealerTied !== isDealerTied;

    if (scopeChanged) {
      prevFolderScopeRef.current = {
        uid: currentUser?.uid,
        dealerId: activeDealerId,
        isDealerTied
      };
      freshReasonRef.current = 'scope-change';
      hadFoldersCacheRef.current = false;
      hadMonthsCacheRef.current = false;
      setInternalMonthsList([]);
      setStaleOk(false);
      setIsSyncSlow(false);
    } else if (freshReasonRef.current !== 'timeout' && freshReasonRef.current !== 'resync') {
      freshReasonRef.current = 'scope-change';
    }

    foldersFreshRef.current = false;
    folderMonthsFreshRef.current = false;
    setIsFoldersFresh(false);
    setIsFolderMonthsFresh(false);

    if (!isOpen) return;

    // Expose migration to window
    (window as any).runMigration = async () => {
      console.log("Migration is no longer needed.");
    };

    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
    const tenantId = pocketbaseService.getReadTenantId(currentUser as any);

    // Subscribe to Folders
    const unsubFolders = pocketbaseService.subscribeLedgerFolders((data) => {
      freshReasonRef.current = 'loaded';
      foldersFreshRef.current = true;
      setIsFoldersFresh(true);
      if (Array.isArray(data)) {
        hadFoldersCacheRef.current = true;
        setFolders(prev => areFoldersEqual(prev, data) ? prev : data);
        setCachedItemWithMeta(`gts_cache_v3_ledger_folders_${originalScopeId}`, () => JSON.stringify(data));
      }
      setIsLoadingFolders(false);
    }, scopeId);

    // Subscribe to Folder Month Map
    const unsubFolderMonths = pocketbaseService.subscribeFolderMonthMap((data) => {
      freshReasonRef.current = 'loaded';
      folderMonthsFreshRef.current = true;
      setIsFolderMonthsFresh(true);
      let mergedMap = data && Object.keys(data).length > 0 ? { ...data } : {};
      let didMerge = false;

      const folderMonthsKey = `gts_ledger_folder_months_${originalScopeId}`;
      const migrationFlag = `migrated_local_folder_months_${scopeId || 'main'}`;
      const isDbNonEmpty = Boolean(data && Object.keys(data).length > 0);
      if (isDbNonEmpty) {
        debouncedSetStorageItem(migrationFlag, 'true');
      }

      if (!isDbNonEmpty && !safeGetStorageItem(migrationFlag)) {
        const savedMap = getValidCacheItem(folderMonthsKey);
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
          } catch (e) { console.error("Migration folder months map parse error", e); }
        }
        debouncedSetStorageItem(migrationFlag, 'true');
      }

      if (didMerge) {
        pocketbaseService.updateFolderMonthMap(mergedMap, scopeId).catch(console.error);
      }

      setFolderMonthMap(prev => areRecordsShallowEqual(prev, mergedMap) ? prev : mergedMap);
    }, scopeId);

    // Priority parallel startup fetches (independent async calls run concurrently,
    // opened folder & opened sheet requested BEFORE full cross-folder idle sync)
    let cancelled = false;
    if (openedFolderId) {
      const alreadyHasFolderSheets = ledgerHistoryRef.current.some(
        sh => sh.folderId === openedFolderId || sh.folder_id === openedFolderId
      );
      if (!alreadyHasFolderSheets) {
        setIsLoadingOpenedFolder(true);
      }
    } else {
      setIsLoadingOpenedFolder(false);
    }

    const priorityTasks: Promise<any>[] = [];

    if (urlSheetId && !ledgerHistoryRef.current.some(s => s.id === urlSheetId)) {
      priorityTasks.push(
        pocketbaseService.getLedgerSheetDirect(urlSheetId).then(sheet => {
          if (cancelled || !sheet) return;
          setLedgerHistory(prev => prev.some(s => s.id === sheet.id) ? prev : [sheet, ...prev]);
        }).catch(console.warn)
      );
    }

    if (openedFolderId) {
      priorityTasks.push(
        pocketbaseService.getLedgerSheetsForFolder(openedFolderId, tenantId).then(folderSheets => {
          if (cancelled) return;
          if (Array.isArray(folderSheets) && folderSheets.length > 0) {
            setLedgerHistory(prev => {
              const prevMap = new Map(prev.map(s => [s.id, s]));
              let hasNew = false;
              folderSheets.forEach(s => {
                if (!prevMap.has(s.id)) {
                  prevMap.set(s.id, s);
                  hasNew = true;
                }
              });
              return hasNew ? Array.from(prevMap.values()) : prev;
            });
          }
          setIsLoadingOpenedFolder(false);
        }).catch(err => {
          console.warn(err);
          if (!cancelled) setIsLoadingOpenedFolder(false);
        })
      );
    }

    if (!(billingMonthsList && billingMonthsList.length > 0)) {
      const monthsScopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined) || 'main';
      priorityTasks.push(
        pocketbaseService.getBillingMonthsList(monthsScopeId).then(list => {
          if (cancelled || !list || !Array.isArray(list)) return;
          setInternalMonthsList(list.map((m: any) => ({ id: m.id })));
        }).catch(() => {})
      );
    }

    if (currentUser?.uid && loadedPrefsUidRef.current !== currentUser.uid) {
      loadedPrefsUidRef.current = currentUser.uid;
      priorityTasks.push(
        supabaseService.getUserPreferences(currentUser.uid).then(prefs => {
          if (cancelled) return;
          if (prefs && prefs.columnWidths) {
            const w = prefs.columnWidths;
            if (w.t1WidthSr) setT1WidthSr(w.t1WidthSr);
            if (w.t1WidthId) setT1WidthId(w.t1WidthId);
            if (w.t1WidthName) setT1WidthName(w.t1WidthName);
            if (w.t1WidthComments) setT1WidthComments(w.t1WidthComments);
            if (w.t1WidthAmount) setT1WidthAmount(w.t1WidthAmount);
            if (w.t1WidthCh) setT1WidthCh(w.t1WidthCh);
            if (w.t2WidthSr) setT2WidthSr(w.t2WidthSr);
            if (w.t2WidthName) setT2WidthName(w.t2WidthName);
            if (w.t2WidthAmount) setT2WidthAmount(w.t2WidthAmount);
            if (w.t2WidthCh) setT2WidthCh(w.t2WidthCh);
          }
          setWidthsLoading(false);
        }).catch(() => {
          if (!cancelled) setWidthsLoading(false);
        })
      );
    }

    if (priorityTasks.length > 0) {
      Promise.all(priorityTasks).catch(() => {});
    }

    return () => {
      cancelled = true;
      foldersFreshRef.current = false;
      folderMonthsFreshRef.current = false;
      setIsFoldersFresh(false);
      setIsFolderMonthsFresh(false);
      unsubFolders();
      unsubFolderMonths();
    };
  }, [isOpen, currentUser?.uid, currentUser?.role, currentUser?.dealerId, activeDealerId, isDealerTied, openedFolderId, urlSheetId, billingMonthsList, resyncNonce]);

  // Folder UI inputs
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [folderSortOption, setFolderSortOption] = useState<'a-to-z' | 'amount-high' | 'amount-low' | 'newest'>('newest');
  const [sheetToDeleteId, setSheetToDeleteId] = useState<string | null>(null);
  const [showTerminateMonthModal, setShowTerminateMonthModal] = useState(false);
  const [isSavingSheet, setIsSavingSheet] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(() => {
    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    const key1 = `gts_cache_v3_ledger_folders_${originalScopeId}_${currentUser?.lineCode || 'nolc'}`;
    const key2 = `gts_ledger_folders_${originalScopeId}`;
    const key3 = `gts_cache_v3_ledger_folders_${originalScopeId}`;
    const hasCache = getValidCacheItem(key1) || getValidCacheItem(key2) || getValidCacheItem(key3);
    return !hasCache;
  });
  const [isLoadingSheets, setIsLoadingSheets] = useState(true);



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
      const matchedRows = parseRowsArray(sheet.table1Rows).filter((r: any) => {
        const rowCId = String(r.cId || '').trim().toLowerCase();
        const rowName = String(r.name || '').trim().toLowerCase();
        const rowComments = String(r.comments || '').trim().toLowerCase();
        const rowClientId = String(r.clientId || '').trim().toLowerCase();
        const rowClientUsername = String(r.clientUsername || '').trim().toLowerCase();
        const rowReceiptCode = String(r.receiptCode || '').trim().toLowerCase();

        return (
          rowCId.includes(q) ||
          rowName.includes(q) ||
          rowComments.includes(q) ||
          rowClientId.includes(q) ||
          rowClientUsername.includes(q) ||
          rowReceiptCode.includes(q)
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

  // --- Auto Save Hooks Removed to Prevent Realtime Sync Loops ---
  
  // Use these wrappers for local changes to push immediately to DB
  const saveFoldersToDb = async (newFolders: any[]) => {
    const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
    await pocketbaseService.updateLedgerFolders(newFolders, scopeId);
    
    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    setCachedItemWithMeta(`gts_ledger_folders_${originalScopeId}`, () => JSON.stringify(newFolders));
  };

  const saveMapToDb = async (_newMap: Record<string, string>) => {
    // Deprecated: rely exclusively on ledger_sheets.folder_id column
  };

  const saveFolderMonthMapToDb = async (newMap: Record<string, string>) => {
    const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined) || 'main';
    await pocketbaseService.updateFolderMonthMap(newMap, scopeId);

    // Also persist individual links to the google_sheet_links schema helper
    for (const [folderId, sheetId] of Object.entries(newMap)) {
      if (sheetId) {
        await pocketbaseService.saveGoogleSheetLink(scopeId, folderId, sheetId).catch(console.error);
      }
    }

    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    setCachedItemWithMeta(`gts_ledger_folder_months_${originalScopeId}`, () => JSON.stringify(newMap));
  };


  const handleCreateFolder = async (e?: React.FormEvent) => {
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
    
    const tenantId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : 'main');
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();
    const activeLineCode = pocketbaseService.getActiveLineCode() || '';

    try {
      const { data, error } = await supabase.from('ledger_folders').insert({
        name: cleanName,
        tenant_id: tenantId,
        line_code: activeLineCode,
        created_at: nowIso
      }).select().single();

      if (error) {
        console.error("Supabase insert error for ledger_folders:", error);
        toast.error("Failed to create folder in cloud: " + error.message);
        return;
      }

      if (data) {
        console.log("Successfully created folder in Supabase:", data);
        const createdTimestamp = data.created 
          ? new Date(data.created).getTime() 
          : (data.created_at ? new Date(data.created_at).getTime() : nowTs);
        
        const nFolder = {
          id: data.id || data.folder_id || `folder_${nowTs}`,
          name: data.name,
          createdAt: createdTimestamp,
          created_at: createdTimestamp,
          tenantId: tenantId,
          lineCode: activeLineCode
        };
        
        // Ensure new folder is placed at the top-left 1st position (prepended)
        const previousFolders = folders;
        const newFolders = [nFolder, ...folders.filter(f => f.id !== nFolder.id)];
        setFolders(newFolders);
        // Also keep local backup & cloud sync for offline resilience
        const originalScopeId = activeDealerId || currentUser?.uid || 'main';
        setCachedItemWithMeta(`gts_ledger_folders_${originalScopeId}`, () => JSON.stringify(newFolders));
        try {
          await pocketbaseService.saveLedgerFolders(newFolders, tenantId);
        } catch (saveErr: any) {
          console.error("Failed to save ledger folders after creation:", saveErr);
          setFolders(previousFolders);
          setCachedItemWithMeta(`gts_ledger_folders_${originalScopeId}`, () => JSON.stringify(previousFolders));
          toast.error("Failed to save folder: " + (saveErr?.message || String(saveErr)));
          return;
        }
        
        setNewFolderNameInput('');
        setIsCreatingFolder(false);
        toast.success(`📁 Folder "${cleanName}" created successfully!`);
      }
    } catch (err: any) {
      console.error("Unexpected error creating folder:", err);
      toast.error("Unexpected error creating folder");
    }
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToDeleteId(folderId);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDeleteId) return;
    const folderId = folderToDeleteId;
    
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) {
      setFolderToDeleteId(null);
      return;
    }

    const previousFolders = [...folders];
    const previousMap = { ...sheetFolderMap };

    const newFolders = folders.filter(f => f.id !== folderId);
    
    // Get list of sheets associated with this folder to store in Recycle Bin
    const associatedSheetIds = ledgerHistory
      .filter(sh => sh.folderId === folderId || sheetFolderMap[sh.id] === folderId)
      .map(sh => sh.id);
    
    // Safely unmap sheets inside this folder locally
    const nextMap = { ...sheetFolderMap };
    Object.keys(nextMap).forEach(sheetId => {
      if (nextMap[sheetId] === folderId) {
        delete nextMap[sheetId];
      }
    });

    // Clear folderId from any active sheets in the editor
    setSheets(prev => prev.map(sh => {
      if (sh.folderId === folderId || sheetFolderMap[sh.id] === folderId) {
        return { ...sh, folderId: '', sort: '', sortFolder: '' };
      }
      return sh;
    }));

    const originalScopeId = activeDealerId || currentUser?.uid || 'main';

    // 1. Instantly update folders and map in local state & local storage to prevent any race conditions
    setFolders(newFolders);
    setCachedItemWithMeta(`gts_ledger_folders_${originalScopeId}`, () => JSON.stringify(newFolders));

    setSheetFolderMap(nextMap);
    setCachedItemWithMeta(`gts_ledger_sheet_folders_${originalScopeId}`, () => JSON.stringify(nextMap));

    // 2. Save folder to Recycle Bin first, then update folders in database
    try {
      const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
      
      await pocketbaseService.saveToRecycleBin(
        'ledger_folder',
        folderToDelete.id,
        currentUser?.username || currentUser?.fullName || 'admin',
        scopeId || 'main',
        {
          originalData: folderToDelete,
          dealerId: scopeId || 'main',
          associatedSheetIds: associatedSheetIds
        }
      );

      // Update folder collection and unmap sheets in the database concurrently
      const updateSheetPromises = [
        pocketbaseService.updateLedgerSheetFolderMap(nextMap, scopeId),
        ...associatedSheetIds.map(shId => {
          const sh = ledgerHistory.find(s => s.id === shId);
          if (sh) {
            return pocketbaseService.saveLedgerSheet({ ...sh, folderId: '', sort: '', sortFolder: '' }, scopeId);
          }
          return Promise.resolve();
        })
      ];

      await Promise.all([
        pocketbaseService.deleteLedgerFolder(folderToDelete.id, scopeId),
        pocketbaseService.updateLedgerFolders(newFolders, scopeId),
        ...updateSheetPromises
      ]);

      toast.success(`📁 Folder "${folderToDelete.name}" moved to Recycle Bin!`);
    } catch (error: any) {
      console.error("Database Delete Error:", error);
      
      // Rollback UI state and localStorage upon failure to prevent inconsistent states
      setFolders(previousFolders);
      setSheetFolderMap(previousMap);
      setCachedItemWithMeta(`gts_ledger_folders_${originalScopeId}`, () => JSON.stringify(previousFolders));
      setCachedItemWithMeta(`gts_ledger_sheet_folders_${originalScopeId}`, () => JSON.stringify(previousMap));

      toast.error(`Database Error: Failed to delete folder. Please check your database connection or permission rules!`, {
        id: `folder-delete-error-${folderId}`,
        duration: 8000
      });
    }

    setFolderToDeleteId(null);
  };

  const handleCreateSheetInFolder = async (folderId: string, e?: React.MouseEvent) => {
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

    const tenantId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : 'main');

    const blankSheetPayload = {
      folder_id: folderId,
      dealer_id: activeDealerId || currentUser?.uid || 'main',
      rec_officer: currentUser.fullName || currentUser.username.toUpperCase(),
      rec_officer_label: 'REC. OFFICER',
      area: 'MAIN',
      area_label: 'AREA',
      sheet_date: formattedDate,
      date_label: 'DATE',
      table1_rows: JSON.stringify(tRef),
      table2_rows: JSON.stringify(t2),
      cash_received: '',
      cash_received_label: 'CASH RECEIVED',
      sign: '',
      sign_label: 'SIGN',
      submitted: '',
      submitted_label: 'SUBMITTED',
      footnote_left: 'Enterprise Ledger Dispatch System',
      footnote_right: 'GENv2.5 // A4 PRINTABLE'
    };

    try {
      const { data, error } = await supabase.from('ledger_sheets').insert(blankSheetPayload).select().single();
      
      if (error) {
        console.error("Supabase insert error for ledger_sheets:", error);
        toast.error("Failed to create sheet in cloud: " + error.message);
        return;
      }
      
      if (data) {
        console.log("Successfully created sheet in Supabase:", data);
        
        const newSheetId = data.id;

        const blankSheet = {
          id: newSheetId,
          folderId: folderId,
          recOfficer: data.rec_officer || currentUser.fullName || currentUser.username.toUpperCase(),
          recOfficerLabel: data.rec_officer_label || 'REC. OFFICER',
          area: data.area || 'MAIN',
          areaLabel: data.area_label || 'AREA',
          sheetDate: data.sheet_date || formattedDate,
          dateLabel: data.date_label || 'DATE',
          table1Rows: parseRowsArray(data.table1_rows || tRef),
          table2Rows: parseRowsArray(data.table2_rows || t2),
          cashReceived: data.cash_received || '',
          sign: data.sign || '',
          submitted: data.submitted || '',
          footnoteLeft: data.footnote_left || 'Enterprise Ledger Dispatch System',
          footnoteRight: data.footnote_right || 'GENv2.5 // A4 PRINTABLE',
          t1Headers: ['SR', 'C. ID', 'NAME', 'COMMENTS', 'AMOUNT', 'CH'],
          t2Headers: ['SR', 'NAME', 'AMOUNT', 'CH'],
          t1TotalLabel: 'TOTAL',
          t2TotalLabel: 'TOTAL',
          cashReceivedLabel: data.cash_received_label || 'CASH RECEIVED',
          signLabel: data.sign_label || 'SIGN',
          submittedLabel: data.submitted_label || 'SUBMITTED',
        };

        // Set editor fields
        setRecOfficer(blankSheet.recOfficer);
        setArea(blankSheet.area);
        setSheetDate(blankSheet.sheetDate);
        setTable1Rows(blankSheet.table1Rows);
        setTable2Rows(blankSheet.table2Rows);
        setCashReceived('');
        setSign('');
        setSubmitted('');

        isSwappingRef.current = true;
        setSheets([blankSheet]);
        setActiveSheetIdx(0);
        setOriginalActiveRows([]);
        setOriginalActiveSheetId(newSheetId);
        if (newSheetId) {
          originalRowsBySheetIdRef.current.set(newSheetId, []);
        }
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

        const targetFolder = folderId || 'all';
        navigate(`${initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet'}/folder/${targetFolder}/sheet/${newSheetId}`);
        toast.success("📄 Created empty sheet inside selected folder! Let's fill it.");
      }
    } catch (err: any) {
      console.error("Unexpected error creating sheet:", err);
      toast.error("Unexpected error creating sheet");
    }
  };

  // Top fields
  const [recOfficer, setRecOfficer] = useState('');
  const [area, setArea] = useState('MAIN');
  const [sheetDate, setSheetDate] = useState('');

  // Security and lock synchronization
  const [localPasskey, setLocalPasskey] = useState('');
  const [localUnlocked, setLocalUnlocked] = useState(() => {
    return safeGetStorageItem('gts_billing_unlocked', 'session') === 'true';
  });

  useEffect(() => {
    if (isBillingUnlocked !== undefined) {
      setLocalUnlocked(isBillingUnlocked);
    }
  }, [isBillingUnlocked]);

  const isLocked = !localUnlocked;

  const handleLocalUnlock = () => {
    const isDealerTied = currentUser.role === 'dealer' || (currentUser.dealerId && currentUser.dealerId !== 'main');
    const requiredKey = (isDealerTied && currentUser.password) ? currentUser.password : (appConfig?.billingSecurityKey || '1239870');
    if (localPasskey === requiredKey) {
      setLocalUnlocked(true);
      safeSetStorageItem('gts_billing_unlocked', 'true', 'session');
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

  const showFoldersSkeleton = useSkeletonGate(isLoadingFolders && folders.length === 0, { delay: 0, minShow: 350 });
  const showSheetListSkeleton = useSkeletonGate(
    Boolean(openedFolderId) && activeView === 'dashboard' && (isLoadingSheets || isLoadingOpenedFolder) && !hasOpenedFolderSheets,
    { delay: 0, minShow: 350 }
  );
  const isWorkspaceLoadingForSkeleton = activeView === 'editor' && (!sheets || sheets.length === 0 || (Boolean(urlSheetId) && sheets[activeSheetIdx]?.id !== urlSheetId));
  const showWorkspaceSkeleton = useSkeletonGate(isWorkspaceLoadingForSkeleton, { delay: 0, minShow: 350 });

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

  // Fast client lookup maps built once whenever clients change
  const clientMaps = useMemo(() => {
    const byId = new Map<string, any>();
    const byIdExact = new Map<string, any>();
    const byUsername = new Map<string, any>();
    const nameCount = new Map<string, number>();
    const nameToClient = new Map<string, any>();

    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (!c) continue;
      if (c.id) {
        byIdExact.set(String(c.id), c);
        byId.set(String(c.id).toLowerCase(), c);
      }
      if (c.username) {
        byUsername.set(String(c.username).toLowerCase(), c);
      }
      if (c.name) {
        const normName = String(c.name).trim().toLowerCase();
        if (normName) {
          const count = (nameCount.get(normName) || 0) + 1;
          nameCount.set(normName, count);
          if (count === 1) {
            nameToClient.set(normName, c);
          } else {
            nameToClient.delete(normName);
          }
        }
      }
    }

    return { byId, byIdExact, byUsername, nameCount, nameToClient };
  }, [clients]);

  const loggedAmbiguousNamesRef = useRef<Set<string>>(new Set());

  const findClientForEntry = useCallback((item: any): any | null => {
    if (!item) return null;
    const { byId, byIdExact, byUsername, nameCount, nameToClient } = clientMaps;

    // 1. Try reliable ID-based matches
    // Match by clientId / clientUsername / cId (ID-based, reliable)
    if (item.clientId) {
      const match = byIdExact.get(String(item.clientId)) || byId.get(String(item.clientId).toLowerCase());
      if (match) return match;
    }
    if (item.clientUsername) {
      const match = byUsername.get(String(item.clientUsername).toLowerCase());
      if (match) return match;
    }
    if (item.cId) {
      const cIdStr = String(item.cId).toLowerCase();
      const match = byId.get(cIdStr) || byUsername.get(cIdStr);
      if (match) return match;
    }

    // 2. Fallback: match by name, ONLY if the name is unique among all clients
    const nameToSearch = item.name ? String(item.name).trim().toLowerCase() : '';
    if (nameToSearch) {
      const count = nameCount.get(nameToSearch) || 0;
      if (count === 1) {
        return nameToClient.get(nameToSearch) || null;
      } else if (count > 1) {
        if (!loggedAmbiguousNamesRef.current.has(nameToSearch)) {
          loggedAmbiguousNamesRef.current.add(nameToSearch);
          console.warn(`Ambiguous same-name case for "${item.name}" in clients list. Found ${count} clients with this name. Leaving unmatched.`);
        }
      }
    }

    return null;
  }, [clientMaps]);

  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'cId' | 'name' | 'amount' | null>(null);
  const [activeInputElement, setActiveInputElement] = useState<HTMLInputElement | null>(null);

  const selectionLockRef = useRef<{ index: number; until: number } | null>(null);
  const blurResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const suggestionsDropdownRef = useRef<SuggestionsDropdownHandle | null>(null);
  const dropdownPosRafRef = useRef<number | null>(null);
  const lastScrolledRowIndexRef = useRef<number | null>(null);

  const getLiveInputElement = useCallback((): HTMLInputElement | null => {
    if (activeInputElement && activeInputElement.isConnected) {
      return activeInputElement;
    }
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body && document.activeElement.tagName === 'INPUT') {
      return document.activeElement as HTMLInputElement;
    }
    return null;
  }, [activeInputElement]);

  const getDropdownCoords = useCallback(() => {
    const inputEl = getLiveInputElement();
    if (!inputEl) return null;
    const row = inputEl.closest('tr') || inputEl;
    const rowRect = row.getBoundingClientRect();
    const cell = inputEl.closest('td') || inputEl;
    const cellRect = cell.getBoundingClientRect();

    const top = rowRect.bottom + 2;
    const desiredWidth = Math.max(370, inputEl.getBoundingClientRect().width);
    const rawLeft = cellRect.left;
    const maxLeft = typeof window !== 'undefined' ? window.innerWidth - desiredWidth - 12 : rawLeft;
    const finalLeft = Math.max(8, Math.min(rawLeft, maxLeft));

    return { top, left: finalLeft, width: desiredWidth };
  }, [getLiveInputElement]);

  const updateDropdownPosition = useCallback(() => {
    const coords = getDropdownCoords();
    if (!coords || !dropdownContainerRef.current) return;
    dropdownContainerRef.current.style.bottom = '';
    dropdownContainerRef.current.style.top = `${coords.top}px`;
    dropdownContainerRef.current.style.left = `${coords.left}px`;
    dropdownContainerRef.current.style.width = `${coords.width}px`;
  }, [getDropdownCoords]);

  const scheduleDropdownPositionUpdate = useCallback(() => {
    if (dropdownPosRafRef.current !== null) return;
    dropdownPosRafRef.current = requestAnimationFrame(() => {
      dropdownPosRafRef.current = null;
      updateDropdownPosition();
    });
  }, [updateDropdownPosition]);

  // Handle scrollIntoView and auto-reposition 150ms and 400ms after dropdown opens
  useEffect(() => {
    if (focusedRowIndex === null || focusedField === null) {
      lastScrolledRowIndexRef.current = null;
      return;
    }

    const inputEl = getLiveInputElement();
    if (inputEl) {
      const row = inputEl.closest('tr') || inputEl;
      const rect = row.getBoundingClientRect();
      if (typeof window !== 'undefined' && rect.bottom + 300 > window.innerHeight) {
        if (lastScrolledRowIndexRef.current !== focusedRowIndex) {
          lastScrolledRowIndexRef.current = focusedRowIndex;
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }

    scheduleDropdownPositionUpdate();

    const timer1 = setTimeout(() => {
      scheduleDropdownPositionUpdate();
    }, 150);

    const timer2 = setTimeout(() => {
      scheduleDropdownPositionUpdate();
    }, 400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [focusedRowIndex, focusedField, getLiveInputElement, scheduleDropdownPositionUpdate]);

  // RequestAnimationFrame throttled repositioning of suggestions dropdown (no state update per scroll)
  useEffect(() => {
    if (!activeInputElement) return;
    const handleScrollOrResize = () => {
      scheduleDropdownPositionUpdate();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      if (dropdownPosRafRef.current !== null) {
        cancelAnimationFrame(dropdownPosRafRef.current);
        dropdownPosRafRef.current = null;
      }
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeInputElement, scheduleDropdownPositionUpdate]);

  // Ledger Card Monthly History and Backup States
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showUserLedger, setShowUserLedger] = useState(initialShowUserLedger);

  const [isReceiptSwipeOpen, setIsReceiptSwipeOpen] = useState(false);
  const [isPendingReceipt, setIsPendingReceipt] = useState(false);
  const [lastSavedEntry, setLastSavedEntry] = useState<{ name: string; amount: number; comments?: string; originalIndex?: number } | null>(null);
  const [multiSavedEntries, setMultiSavedEntries] = useState<{ name: string; amount: number; comments?: string; originalIndex?: number }[] | null>(null);
  const [showMultiSlipConfirm, setShowMultiSlipConfirm] = useState(false);
  const [pendingActiveRows, setPendingActiveRows] = useState<{ name: string; amount: number; comments?: string; originalIndex?: number }[]>([]);
  const [originalActiveRows, setOriginalActiveRows] = useState<{ name: string; amount: number; comments?: string; cId?: string; clientId?: string; clientUsername?: string; status?: string }[]>([]);
  const [originalActiveSheetId, setOriginalActiveSheetId] = useState<string | null>(null);
  const originalRowsBySheetIdRef = useRef<Map<string, { name: string; amount: any; comments?: string; cId?: string; clientId?: string; clientUsername?: string; status?: string }[]>>(new Map());

  // Memoized receipt preview items with client resolution
  const previewItemsData = useMemo(() => {
    const isMulti = multiSavedEntries && multiSavedEntries.length > 0;
    const rawItems = isMulti ? multiSavedEntries.slice(0, 4) : (lastSavedEntry ? [lastSavedEntry] : []);
    const actualCount = rawItems.filter(item => item && (item?.name || '').trim() !== '').length;
    const items: any[] = [...rawItems];
    while (items.length < 4) {
      items.push({
        name: '',
        amount: ''
      });
    }

    return items.map((entry) => {
      const client = (entry && entry.name) ? findClientForEntry(entry) : null;
      return { entry, client, actualCount };
    });
  }, [multiSavedEntries, lastSavedEntry, findClientForEntry]);

  // Outstanding payment map for fast O(1) receipt lookups
  const activeRowsCrMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeRows) return map;
    for (let i = 0; i < activeRows.length; i++) {
      const r = activeRows[i];
      if (r && r.name) {
        map.set(String(r.name).trim().toLowerCase(), parseFloat(r.cr) || 0);
      }
    }
    return map;
  }, [activeRows]);

  const getOutstandingPaymentForEntry = useCallback((entryName?: string) => {
    if (!entryName) return 0;
    return activeRowsCrMap.get(String(entryName).trim().toLowerCase()) || 0;
  }, [activeRowsCrMap]);

  // New states for manual receipt selection
  const [showReceiptSelectionPopup, setShowReceiptSelectionPopup] = useState(false);
  const [selectedReceiptIndices, setSelectedReceiptIndices] = useState<number[]>([]);
  const [currentReceiptCode, setCurrentReceiptCode] = useState<string>('');

  const [receiptConfig, setReceiptConfig] = useState({
    title: 'GREEN TECH SERVICES',
    address1: 'Jinnah Complax Road',
    address2: 'Sadiqabad',
    footer: 'Thank You For Using Our Services.'
  });

  useEffect(() => {
    const handleSync = () => {
      setReceiptConfig({
        title: safeGetStorageItem('gts_receipt_title') || 'GREEN TECH SERVICES',
        address1: safeGetStorageItem('gts_receipt_address1') || 'Jinnah Complax Road',
        address2: safeGetStorageItem('gts_receipt_address2') || 'Sadiqabad',
        footer: safeGetStorageItem('gts_receipt_footer') || 'Thank You For Using Our Services.'
      });
    };
    handleSync();
    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShowUserLedger(initialShowUserLedger);
    }
  }, [isOpen, initialShowUserLedger]);

  const [ledgerSearchUser, setLedgerSearchUser] = useState('');
  const [ledgerSelectedFolder, setLedgerSelectedFolder] = useState('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);

  // Backup accounts states
  const [backupTokens, setBackupTokens] = useState<any>(() => googleSheetsService.getBackupTokens());
  const [backupSpreadsheetId, setBackupSpreadsheetId] = useState(() => googleSheetsService.getBackupSpreadsheetId() || '');
  const [isBackingUp, setIsBackingUp] = useState(false);




  // Deferred background subscription to master clients scoped to the current dealer tenant
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const startSubscribe = () => {
      if (cancelled) return;
      try {
        const tenantId = pocketbaseService.getReadTenantId(currentUser as any);
        unsubscribe = pocketbaseService.subscribeClients((data) => {
          if (cancelled || !Array.isArray(data)) return;
          setClients(prev => areClientsEqual(prev, data) ? prev : data);
        }, tenantId);
      } catch (e) {
        console.warn("Failed to subscribe to clients in EntrySheet:", e);
      }
    };

    if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
      idleHandle = (window as any).requestIdleCallback(startSubscribe, { timeout: 1500 });
    } else {
      timeoutHandle = setTimeout(startSubscribe, 1500);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, currentUser?.uid, currentUser?.role, currentUser?.dealerId]);

  // Deferred background listener for full Monthly Ledger Sheets History (opened folder/sheet fetched on startup)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const startSubscribe = () => {
      if (cancelled) return;
      try {
        const tenantId = pocketbaseService.getReadTenantId(currentUser as any);
        unsubscribe = pocketbaseService.subscribeLedgerSheets((data) => {
          if (cancelled) return;
          const next = Array.isArray(data) ? data : [];
          setLedgerHistory(prev => areLedgerSheetsEqual(prev, next) ? prev : next);
          setIsLoadingSheets(false);
        }, tenantId);
      } catch (e) {
        console.warn("Failed to subscribe historical ledger sheets:", e);
        if (!cancelled) setIsLoadingSheets(false);
      }
    };

    if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
      idleHandle = (window as any).requestIdleCallback(startSubscribe, { timeout: 1500 });
    } else {
      timeoutHandle = setTimeout(startSubscribe, 1500);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, currentUser?.uid, currentUser?.role, currentUser?.dealerId, activeDealerId]);

  // Synchronize folders state with debounced browser local storage cache
  useEffect(() => {
    if (!isOpen) return;
    const originalScopeId = activeDealerId || currentUser?.uid || 'main';
    setCachedItemWithMeta(`gts_cache_v3_ledger_folders_${originalScopeId}`, () => JSON.stringify(folders));
    setCachedItemWithMeta(`gts_ledger_folders_${originalScopeId}`, () => JSON.stringify(folders));
  }, [folders, activeDealerId, currentUser?.uid, isOpen]);

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
  const [showSizingPanel, setShowSizingPanel] = useState(false);
  useEffect(() => {
    setShowSizingPanel(false);
  }, [isOpen, activeView, loadedSheetId]);
  const [rowPadding, setRowPadding] = useState(() => {
    const saved = safeGetStorageItem('gts_ledger_rowPadding_v2');
    return saved !== null ? parseFloat(saved) : 6;
  }); // vertical padding in px/mm
  const [tableFontSize, setTableFontSize] = useState(() => {
    const saved = safeGetStorageItem('gts_ledger_tableFontSize_v2');
    return saved !== null ? parseFloat(saved) : 15;
  }); // in pixels
  const [headerFontSize, setHeaderFontSize] = useState(() => {
    const saved = safeGetStorageItem('gts_ledger_headerFontSize');
    return saved !== null ? parseFloat(saved) : 13;
  }); // in pixels
  const [paperPaddingX, setPaperPaddingX] = useState(() => {
    const saved = safeGetStorageItem('gts_ledger_paperPaddingX');
    return saved !== null ? parseInt(saved, 10) : 10;
  }); // in mm
  const [paperPaddingY, setPaperPaddingY] = useState(() => {
    const saved = safeGetStorageItem('gts_ledger_paperPaddingY');
    return saved !== null ? parseInt(saved, 10) : 8;
  });  // in mm

  // Table 1 individual column width states (can be modified back and forth via sliders)
  const [t1WidthSr, setT1WidthSr] = useState(40);
  const [t1WidthId, setT1WidthId] = useState(90);
  const [t1WidthName, setT1WidthName] = useState(240);
  const [t1WidthComments, setT1WidthComments] = useState(180);
  const [t1WidthAmount, setT1WidthAmount] = useState(100);
  const [t1WidthCh, setT1WidthCh] = useState(40);

  // Table 2 individual column width states
  const [t2WidthSr, setT2WidthSr] = useState(40);
  const [t2WidthName, setT2WidthName] = useState(490);
  const [t2WidthAmount, setT2WidthAmount] = useState(120);
  const [t2WidthCh, setT2WidthCh] = useState(40);

  const [widthsLoading, setWidthsLoading] = useState(true);
  const [showSaveWidthsBar, setShowSaveWidthsBar] = useState(false);
  const [savingWidths, setSavingWidths] = useState(false);

  // Save layout configurations to localStorage on modification (400ms trailing debounce)
  useEffect(() => {
    debouncedSetStorageItem('gts_ledger_rowPadding_v2', String(rowPadding));
    debouncedSetStorageItem('gts_ledger_tableFontSize_v2', String(tableFontSize));
    debouncedSetStorageItem('gts_ledger_headerFontSize', String(headerFontSize));
    debouncedSetStorageItem('gts_ledger_paperPaddingX', String(paperPaddingX));
    debouncedSetStorageItem('gts_ledger_paperPaddingY', String(paperPaddingY));
  }, [
    rowPadding, tableFontSize, headerFontSize, paperPaddingX, paperPaddingY
  ]);

  // Zoom & Auto-Fit scaling states: strictly defaults to 'fit' (Auto)
  const [zoomOption, setZoomOption] = useState<'fit' | '100%' | '85%' | '75%'>('fit');
  const [calculatedScale, setCalculatedScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(1122.5);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Remove any legacy saved zoomOption key so every fresh session forces 'fit' (Auto) mode by default
  useEffect(() => {
    safeRemoveStorageItem('gts_ledger_zoomOption');
  }, []);

  const paperContainerRef = useRef<HTMLDivElement | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePaperFocus = (e: React.FocusEvent) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsInputFocused(true);
    const targetEl = e.target as HTMLElement;
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }, 80);
    }
  };

  const handlePaperBlur = (e: React.FocusEvent) => {
    const currentTarget = e.currentTarget;
    flushPendingStorageWrites();
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      if (!currentTarget || !currentTarget.contains(document.activeElement)) {
        setIsInputFocused(false);
      }
    }, 150);
  };

  const [receiptPanelReady, setReceiptPanelReady] = useState(false);
  const currentScaleRef = useRef(1);
  const currentPaperHeightRef = useRef(1122.5);

  useEffect(() => {
    let rafId: number | null = null;

    const computeScale = () => {
      const paperEl = paperContainerRef.current;
      const measuredPaperHeight = paperEl
        ? Math.max(1122.5, paperEl.scrollHeight || paperEl.offsetHeight || 1122.5)
        : 1122.5;
      if (Math.abs(measuredPaperHeight - currentPaperHeightRef.current) > 1) {
        currentPaperHeightRef.current = measuredPaperHeight;
        setPaperHeight(measuredPaperHeight);
      }

      let baseScale = 1;

      if (zoomOption !== 'fit') {
        if (zoomOption === '100%') baseScale = 1.0;
        else if (zoomOption === '85%') baseScale = 0.85;
        else if (zoomOption === '75%') baseScale = 0.75;
      } else {
        let availableWidth = window.innerWidth;
        let availableHeight = window.innerHeight - (window.innerWidth < 640 ? 100 : 80);

        if (workspaceRef.current) {
          const clientW = workspaceRef.current.clientWidth;
          const clientH = workspaceRef.current.clientHeight;
          if (clientW > 0) availableWidth = clientW;
          if (clientH > 0) availableHeight = clientH;
        }

        const padX = window.innerWidth < 640 ? 16 : 32;
        const padY = window.innerWidth < 640 ? 16 : 32;

        const safeWidth = Math.max(150, availableWidth - padX);
        const safeHeight = Math.max(150, availableHeight - padY);

        const paperWidth = paperEl ? Math.max(793.7, paperEl.offsetWidth || 793.7) : 793.7;

        const fitScaleWidth = safeWidth / paperWidth;
        const fitScaleHeight = safeHeight / measuredPaperHeight;

        baseScale = Math.min(fitScaleWidth, fitScaleHeight);
        baseScale = Math.max(0.18, Math.min(1.0, baseScale * 0.96));
      }

      let newScale = baseScale;
      if (isInputFocused) {
        const minComfortZoom = window.innerWidth < 640 ? 0.85 : 0.88;
        newScale = Math.max(minComfortZoom, Math.min(1.15, baseScale * 1.35));
      }

      if (Math.abs(newScale - currentScaleRef.current) > 0.002) {
        currentScaleRef.current = newScale;
        setCalculatedScale(newScale);
      }
    };

    const handleResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        computeScale();
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      if (workspaceRef.current) resizeObserver.observe(workspaceRef.current);
      if (paperContainerRef.current) resizeObserver.observe(paperContainerRef.current);
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [zoomOption, isLocked, isOpen, showSizingPanel, showHistoryPanel, isInputFocused, activeView, rowPadding, tableFontSize, headerFontSize, paperPaddingY, paperPaddingX]);

  // Function to reset all lines & boxes sizing parameters to default
  const resetSizingToDefault = useCallback(async () => {
    setRowPadding(6);
    setTableFontSize(15);
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

    safeRemoveStorageItem('gts_ledger_showSizingPanel');
    safeRemoveStorageItem('gts_ledger_rowPadding');
    safeRemoveStorageItem('gts_ledger_tableFontSize');
    safeRemoveStorageItem('gts_ledger_rowPadding_v2');
    safeRemoveStorageItem('gts_ledger_tableFontSize_v2');
    safeRemoveStorageItem('gts_ledger_headerFontSize');
    safeRemoveStorageItem('gts_ledger_paperPaddingX');
    safeRemoveStorageItem('gts_ledger_paperPaddingY');

    if (currentUser) {
      try {
        const prefs = await supabaseService.getUserPreferences(currentUser.uid) || {};
        delete prefs.columnWidths;
        await supabaseService.updateUserPreferences(currentUser.uid, prefs);
      } catch (e) {
        console.error("Failed to reset sizing preferences in DB", e);
      }
    }

    toast.success("Sizing and column widths restored to defaults and permanently saved!");
  }, [currentUser]);

  const saveColumnWidths = async () => {
    if (!currentUser) return;
    setSavingWidths(true);
    try {
      const prefs = await supabaseService.getUserPreferences(currentUser.uid) || {};
      prefs.columnWidths = {
        t1WidthSr, t1WidthId, t1WidthName, t1WidthComments, t1WidthAmount, t1WidthCh,
        t2WidthSr, t2WidthName, t2WidthAmount, t2WidthCh
      };
      await supabaseService.updateUserPreferences(currentUser.uid, prefs);
      toast.success("Column widths saved to your account! They'll be the same wherever you log in.");
      setShowSaveWidthsBar(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save — please try again");
    } finally {
      setSavingWidths(false);
    }
  };

  // Footer fields
  const [cashReceived, setCashReceived] = useState('');
  const [sign, setSign] = useState('');
  const [submitted, setSubmitted] = useState('');

  const isSwappingRef = useRef(false);

  // Live state tracking ref for active sheet slice
  const liveStateRef = useRef({
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
    footnoteLeft,
    footnoteRight,
    t1Headers,
    t2Headers,
    t1TotalLabel,
    t2TotalLabel,
    cashReceivedLabel,
    signLabel,
    submittedLabel
  });

  // Keep ref synchronously updated without triggering secondary renders
  liveStateRef.current = {
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
    footnoteLeft,
    footnoteRight,
    t1Headers,
    t2Headers,
    t1TotalLabel,
    t2TotalLabel,
    cashReceivedLabel,
    signLabel,
    submittedLabel
  };

  const flushLiveSheetState = useCallback(() => {
    if (sheets.length === 0 || isSwappingRef.current) return;
    const live = liveStateRef.current;
    setSheets(prev => {
      if (!prev[activeSheetIdx]) return prev;
      return prev.map((sh, idx) => {
        if (idx === activeSheetIdx) {
          return {
            ...sh,
            recOfficer: live.recOfficer,
            recOfficerLabel: live.recOfficerLabel,
            area: live.area,
            areaLabel: live.areaLabel,
            sheetDate: live.sheetDate,
            dateLabel: live.dateLabel,
            table1Rows: live.table1Rows,
            table2Rows: live.table2Rows,
            cashReceived: live.cashReceived,
            sign: live.sign,
            submitted: live.submitted,
            footnoteLeft: live.footnoteLeft,
            footnoteRight: live.footnoteRight,
            t1Headers: live.t1Headers,
            t2Headers: live.t2Headers,
            t1TotalLabel: live.t1TotalLabel,
            t2TotalLabel: live.t2TotalLabel,
            cashReceivedLabel: live.cashReceivedLabel,
            signLabel: live.signLabel,
            submittedLabel: live.submittedLabel
          };
        }
        return sh;
      });
    });
  }, [activeSheetIdx, sheets.length]);

  // Flush live state and pending storage writes before unmounting / navigating away
  useEffect(() => {
    return () => {
      flushLiveSheetState();
      flushPendingStorageWrites();
    };
  }, [flushLiveSheetState]);

  const switchToSheet = useCallback((targetIdx: number) => {
    if (targetIdx === activeSheetIdx || !sheets[targetIdx]) return;
    flushLiveSheetState();
    const target = sheets[targetIdx];
    if (target) {
      isSwappingRef.current = true;
      setRecOfficer(target.recOfficer || '');
      setRecOfficerLabel(target.recOfficerLabel || 'REC. OFFICER');
      setArea(target.area || 'MAIN');
      setAreaLabel(target.areaLabel || 'AREA');
      setSheetDate(target.sheetDate || '');
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
      setActiveSheetIdx(targetIdx);
      setTimeout(() => {
        isSwappingRef.current = false;
      }, 50);
    }
  }, [activeSheetIdx, sheets, flushLiveSheetState]);

  const isExcludedName = (name?: string) => {
    if (!name) return false;
    const n = String(name).trim().toLowerCase();
    return ['bank', 'panel balance', 'cash hand', 'total', 'grand total', 'sub total', 'cash in hand'].includes(n);
  };

  const resetToBlank = () => {
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

    setRecOfficer(currentUser?.fullName || currentUser?.username?.toUpperCase() || '');
    setRecOfficerLabel('REC. OFFICER');
    setArea('MAIN');
    setAreaLabel('AREA');
    setSheetDate(formattedDate);
    setDateLabel('DATE');
    setTable1Rows(tRef);
    setTable2Rows(t2);
    setCashReceived('');
    setSign('');
    setSubmitted('');
    setSheets([{
      id: '',
      folderId: openedFolderId || '',
      recOfficer: currentUser?.fullName || currentUser?.username?.toUpperCase() || '',
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
      footnoteRight: 'GENv2.5 // A4 PRINTABLE'
    }]);
    setActiveSheetIdx(0);
  };

  const handleAddSheet = (fromIdx?: number) => {
    flushLiveSheetState();
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
    const targetDate = sheetDate || new Date().toLocaleDateString();
    const newSheet = {
      id: '',
      folderId: openedFolderId || '',
      recOfficer: recOfficer || currentUser?.fullName || currentUser?.username?.toUpperCase() || '',
      recOfficerLabel: recOfficerLabel || 'REC. OFFICER',
      area: area || 'MAIN',
      areaLabel: areaLabel || 'AREA',
      sheetDate: targetDate,
      dateLabel: dateLabel || 'DATE',
      table1Rows: tRef,
      table2Rows: t2,
      cashReceived: '',
      sign: '',
      submitted: '',
      footnoteLeft: 'Enterprise Ledger Dispatch System',
      footnoteRight: 'GENv2.5 // A4 PRINTABLE'
    };

    setSheets(prev => {
      const copy = [...prev];
      const insertAt = typeof fromIdx === 'number' ? fromIdx + 1 : copy.length;
      copy.splice(insertAt, 0, newSheet);
      return copy;
    });
    const nextIdx = typeof fromIdx === 'number' ? fromIdx + 1 : sheets.length;
    setActiveSheetIdx(nextIdx);
    toast.success(`📄 Page ${nextIdx + 1} added!`);
  };

  const handleDeleteSheetItem = (idxToDelete: number) => {
    flushLiveSheetState();
    if (sheets.length <= 1) {
      toast.error("Cannot delete the last remaining sheet page.");
      return;
    }
    setSheets(prev => prev.filter((_, idx) => idx !== idxToDelete));
    if (activeSheetIdx >= idxToDelete && activeSheetIdx > 0) {
      setActiveSheetIdx(activeSheetIdx - 1);
    }
    toast.success("Sheet page removed.");
  };

  const autoFillFromDb = () => {
    try {
      const activeMonth = billingMonths.find(m => m.id === currentMonthId);
      if (!activeMonth || !Array.isArray(activeMonth.rows) || activeMonth.rows.length === 0) {
        toast.error("No active monthly recovery records found to fill.");
        return;
      }

      const pendingRows = activeMonth.rows.filter((r: any) => {
        const amt = Number(r.rec_amount || r.amount || r.dueAmount || r.monthly_bill || 0);
        return amt > 0;
      });

      if (pendingRows.length === 0) {
        toast.info("All clients in this month have 0 pending recovery balance.");
        return;
      }

      setTable1Rows(prev => {
        const updated = [...prev];
        let fillIdx = 0;
        for (let i = 0; i < updated.length && fillIdx < pendingRows.length; i++) {
          if (!updated[i].name && !updated[i].cId) {
            const p = pendingRows[fillIdx++];
            updated[i] = {
              ...updated[i],
              cId: p.custom_id || p.cId || p.username || '',
              name: p.name || p.fullName || p.username || '',
              amount: Number(p.rec_amount || p.amount || p.dueAmount || p.monthly_bill || 0),
              comments: p.comments || p.area || '',
              clientId: p.client_id || p.clientId || '',
              clientUsername: p.username || ''
            };
          }
        }
        return updated;
      });

      toast.success(`✨ Auto-filled accounts from ${currentMonthId || 'Current Month'}!`);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to auto fill from database.");
    }
  };

  const saveReceiptCodeToDb = async (code: string) => {
    try {
      if (code) {
        debouncedSetStorageItem(`last_receipt_code_${activeDealerId || 'main'}`, code);
      }
    } catch (e) {
      console.warn("Could not store receipt code:", e);
    }
  };

  const handleSaveSheet = async () => {
    if (isSavingSheetRef.current || isSavingSheet) return;
    flushLiveSheetState();
    flushPendingStorageWrites();
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", { description: "Please unlock the Billing Security Shield first." });
      return;
    }

    // 1. Synchronize current active sheet state into sheets array
    const currentSyncSheets = sheets.map((sh, idx) => {
      if (idx === activeSheetIdx) {
        return {
          ...sh,
          id: sh.id || loadedSheetId || '',
          folderId: openedFolderId || (loadedSheetId ? sheetFolderMap[loadedSheetId] : null) || sh.folderId || '',
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
          footnoteLeft,
          footnoteRight,
          t1Headers,
          t2Headers,
          t1TotalLabel,
          t2TotalLabel,
          cashReceivedLabel,
          signLabel,
          submittedLabel
        };
      }
      return sh;
    });

    let currentLoadedId = loadedSheetId;
    if (!currentLoadedId && currentSyncSheets[activeSheetIdx]?.id) {
      currentLoadedId = currentSyncSheets[activeSheetIdx].id;
    }

    const tenantId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : 'main');

    // Validation: Ensure at least one sheet has recOfficer and records
    let hasValidSheet = false;
    for (let i = 0; i < currentSyncSheets.length; i++) {
      const s = currentSyncSheets[i];
      const hasT1 = parseRowsArray(s.table1Rows).some((p: any) => (p.cId || '').trim() || (p.name || '').trim() || (Number(p.amount) || 0) > 0);
      const hasT2 = parseRowsArray(s.table2Rows).some((p: any) => (!['bank', 'panel balance', 'cash hand'].includes((p.name || '').trim().toLowerCase()) && (p.name || '').trim()) || (Number(p.amount) || 0) > 0);
      if (!(s.recOfficer || '').trim()) {
        if (currentSyncSheets.length === 1) {
          toast.error("Please specify a Recovery Officer name first.");
          return;
        }
        continue;
      }
      if (!hasT1 && !hasT2) {
        if (currentSyncSheets.length === 1) {
          toast.error("The ledger sheet is completely empty. Please enter some records first!");
          return;
        }
        continue;
      }
      hasValidSheet = true;
    }

    if (!hasValidSheet) {
      toast.error("Please enter a Recovery Officer name and sheet records first!");
      return;
    }

    isSavingSheetRef.current = true;
    setIsSavingSheet(true);
    let savingToastId: string | number | undefined;
    let usedStaleOk = false;

    try {
      const freshNow =
        pocketbaseService.getBillingFresh() &&
        foldersFreshRef.current &&
        folderMonthsFreshRef.current;

      if (!freshNow && !staleOkRef.current) {
        const waitToastId = toast.loading("Syncing latest data...");
        try {
          await waitForFresh(6000);
        } catch {
          toast.dismiss(waitToastId);
          toast.error("Latest data is still syncing", {
            description: "Your entries were kept safe. Retry sync and try saving again.",
            action: {
              label: "Retry sync",
              onClick: () => triggerResync('resync')
            },
            duration: 8000
          });
          return;
        } finally {
          toast.dismiss(waitToastId);
        }
      }

      usedStaleOk =
        !(pocketbaseService.getBillingFresh() && foldersFreshRef.current && folderMonthsFreshRef.current) &&
        staleOkRef.current;

      savingToastId = toast.loading("Saving sheet and synchronizing recovery entries...");
      const sheetPayloads: any[] = [];
      const payloadSourceIdx: number[] = [];
      const savedSheetsToLocal: any[] = [];
      const updatedFolderMap = { ...sheetFolderMap };
      const unmatchedNames = new Set<string>();
      const ambiguousBillingNames = new Set<string>();

      for (let i = 0; i < currentSyncSheets.length; i++) {
        const s = currentSyncSheets[i];
        const hasT1 = parseRowsArray(s.table1Rows).some((p: any) => (p.cId || '').trim() || (p.name || '').trim() || (Number(p.amount) || 0) > 0);
        const hasT2 = parseRowsArray(s.table2Rows).some((p: any) => (!['bank', 'panel balance', 'cash hand'].includes((p.name || '').trim().toLowerCase()) && (p.name || '').trim()) || (Number(p.amount) || 0) > 0);
        if (!(s.recOfficer || '').trim() || (!hasT1 && !hasT2)) continue;

        const isCurrentActive = i === activeSheetIdx && currentLoadedId;
        const targetFolderId = isCurrentActive ? (updatedFolderMap[currentLoadedId] || s.folderId || openedFolderId || '') : (s.folderId || openedFolderId || '');

        let finalSheetId = s.id;
        if (!finalSheetId || finalSheetId.startsWith('sheet_') || !/^[a-zA-Z0-9-]{15,36}$/.test(finalSheetId)) {
          finalSheetId = isCurrentActive
            ? currentLoadedId
            : Array.from({ length: 15 }, (_, idx) => idx === 0 ? "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] : "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join('');
        }

        const folderObj = folders.find(f => f.id === targetFolderId);
        const folderName = folderObj?.name || targetFolderId || '';

        const openedAtRaw = s.updated || (finalSheetId ? openedUpdatedAtBySheetIdRef.current.get(finalSheetId) : undefined) || s.openedUpdatedAtAsStoredInDb;
        const openedAtNum = openedAtRaw && typeof openedAtRaw === 'number' ? openedAtRaw : 0;
        const safeUpdatedAt = Math.max(Date.now(), openedAtNum + 1);
        const openedUpdatedAtAsStoredDb = (typeof openedAtRaw === 'string' && openedAtRaw.trim()) ? openedAtRaw : undefined;

        const payload = {
          id: finalSheetId,
          folderId: targetFolderId || '',
          sort: folderName,
          sortFolder: folderName,
          recOfficer: s.recOfficer,
          recOfficerLabel: s.recOfficerLabel || 'REC. OFFICER',
          area: s.area || 'MAIN',
          areaLabel: s.areaLabel || 'AREA',
          sheetDate: s.sheetDate || sheetDate || '',
          dateLabel: s.dateLabel || 'DATE',
          table1Rows: parseRowsArray(s.table1Rows).map((r: any) => ({
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
          table2Rows: parseRowsArray(s.table2Rows).map((r: any) => ({
            sr: r.sr,
            name: r.name || '',
            amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
            ch: !!r.ch
          })),
          cashReceived: s.cashReceived || '',
          cashReceivedLabel: s.cashReceivedLabel || 'CASH RECEIVED',
          sign: s.sign || '',
          signLabel: s.signLabel || 'SIGN',
          submitted: s.submitted || '',
          submittedLabel: s.submittedLabel || 'SUBMITTED',
          footnoteLeft: s.footnoteLeft || 'Enterprise Ledger Dispatch System',
          footnoteRight: s.footnoteRight || 'GENv2.5 // A4 PRINTABLE',
          openedUpdatedAt: openedAtNum || openedAtRaw,
          openedUpdatedAtAsStoredInDb: openedUpdatedAtAsStoredDb,
          updatedAt: safeUpdatedAt
        };

        sheetPayloads.push(payload);
        savedSheetsToLocal.push(payload);
        payloadSourceIdx.push(i);

        if (targetFolderId && finalSheetId) {
          updatedFolderMap[finalSheetId] = targetFolderId;
        }
      }

      if (sheetPayloads.length === 0) {
        toast.error("No valid sheet records found to save.");
        return;
      }

      // Link clients for all rows
      const isExcludedName = (nameStr?: string) => {
        if (!nameStr) return false;
        const lower = nameStr.trim().toLowerCase();
        return [
          'bank', 'panel balance', 'panel', 'cash hand', 'hand cash',
          'cash in hand', 'expense', 'expenses'
        ].includes(lower);
      };

      sheetPayloads.forEach((sheetPayload) => {
        const allSheetRows = Array.isArray(sheetPayload.table1Rows) ? sheetPayload.table1Rows : [];
        allSheetRows.forEach((r: any) => {
          const hasId = Boolean(r.cId && String(r.cId).trim());
          const hasName = Boolean(r.name && String(r.name).trim());
          if (!hasId && !hasName) return;
          if (isExcludedName(r.name)) return;

          const client = findClientForEntry(r);
          if (client) {
            r.clientId = client.id;
            r.clientUsername = client.username;
            if (!r.name && client.name) r.name = client.name;
          }
        });
      });

      // Target Months to update
      const targetMonthIdsToUpdate = new Set<string>();
      sheetPayloads.forEach(sp => {
        const tFolderId = sp.folderId;
        const fObj = folders.find(f => f.id === tFolderId);
        const tMonthId = (tFolderId ? (folderMonthMap[tFolderId] || fObj?.connectedMonthId) : undefined) || currentMonthId;
        if (tMonthId) targetMonthIdsToUpdate.add(tMonthId);
      });
      if (targetMonthIdsToUpdate.size === 0 && currentMonthId) {
        targetMonthIdsToUpdate.add(currentMonthId);
      }

      const accumulatedBillingMonths: Record<string, any[]> = {};
      const accumulatedBillingBaseRows: Record<string, any[]> = {};
      const accumulatedChangedIndicesMap: Record<string, Set<number>> = {};
      const allSyncedUsersSummary: string[] = [];
      const clientFeeUpdatesToApply: Array<{ clientId: string; clientName: string; oldFee: number; newFee: number }> = [];
      let totalUpdatedBillingCount = 0;

      for (const targetMonthId of Array.from(targetMonthIdsToUpdate)) {
        if (!targetMonthId) continue;

        let targetMonthRows: any[] = [];
        let fetchedFresh = false;

        try {
          const directMonth = await pocketbaseService.getBillingMonthDirect(targetMonthId, activeDealerId || 'main');
          if (directMonth && Array.isArray(directMonth.rows) && directMonth.rows.length > 0) {
            targetMonthRows = directMonth.rows;
            fetchedFresh = true;
          }
        } catch (err) {
          console.warn(`Direct DB fetch for target month ${targetMonthId} failed:`, err);
        }

        if (targetMonthRows.length === 0) {
          targetMonthRows = accumulatedBillingMonths[targetMonthId] || [];
          if (targetMonthRows.length === 0) {
            const targetMonthDoc = billingMonths.find(m => m.id === targetMonthId);
            targetMonthRows = targetMonthDoc?.rows || [];
          }
        }
        if (targetMonthRows.length === 0 && activeRows && activeRows.length > 0) {
          targetMonthRows = activeRows;
        }

        if (targetMonthRows.length === 0) {
          console.warn(`Target month ${targetMonthId} has no rows. Skipping recovery sync.`);
          continue;
        }

        try {
          // Copy all target month rows intact
          const baseRecalculatedRows = targetMonthRows.filter((br: any) => !isExcludedName(br.name)).map((row: any) => ({
            ...row,
            _originalCr: row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0),
            cr: row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0),
            totalAmount: parseFloat(row.baseAmount || 0) + (row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0))
          }));

          if (!accumulatedChangedIndicesMap[targetMonthId]) {
            accumulatedChangedIndicesMap[targetMonthId] = new Set<number>();
          }

          // Helper to match a row
          const findRowIndex = (r: any): number => {
            const hasId = Boolean(r.cId && String(r.cId).trim());
            const hasName = Boolean(r.name && String(r.name).trim());
            const client = findClientForEntry(r);

            let matchedIdx = -1;
            if (r.clientId || r.clientUsername) {
              const searchClientId = (r.clientId || '').trim().toLowerCase();
              const searchClientUsername = (r.clientUsername || '').trim().toLowerCase();
              matchedIdx = baseRecalculatedRows.findIndex((br: any) => 
                (searchClientId && br.clientId && String(br.clientId).trim().toLowerCase() === searchClientId) ||
                (searchClientUsername && br.username && String(br.username).trim().toLowerCase() === searchClientUsername) ||
                (searchClientUsername && br.clientId && String(br.clientId).trim().toLowerCase() === searchClientUsername) ||
                (searchClientId && br.id && String(br.id).trim().toLowerCase() === searchClientId)
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
            if (matchedIdx === -1 && client) {
              const cId = (client.id || '').trim().toLowerCase();
              const cUser = (client.username || '').trim().toLowerCase();
              matchedIdx = baseRecalculatedRows.findIndex((br: any) => 
                (cId && br.clientId && String(br.clientId).trim().toLowerCase() === cId) ||
                (cUser && br.username && String(br.username).trim().toLowerCase() === cUser) ||
                (cId && br.id && String(br.id).trim().toLowerCase() === cId)
              );
            }
            if (matchedIdx === -1 && hasName) {
              const searchName = String(r.name).trim().toLowerCase();
              const nameMatches: number[] = [];
              for (let i = 0; i < baseRecalculatedRows.length; i++) {
                const br = baseRecalculatedRows[i];
                if (br.name && String(br.name).trim().toLowerCase() === searchName) {
                  nameMatches.push(i);
                }
              }
              if (nameMatches.length === 1) {
                matchedIdx = nameMatches[0];
              } else if (nameMatches.length > 1) {
                ambiguousBillingNames.add(String(r.name).trim());
                matchedIdx = -1;
              }
            }
            return matchedIdx;
          };

          // 1. Check if any previously active row from THIS sheet (or any page being saved) was removed
          const currentActiveRowsInPayload: any[] = [];
          sheetPayloads.forEach(sp => {
            (Array.isArray(sp.table1Rows) ? sp.table1Rows : []).forEach((r: any) => {
              const amt = Number(r.amount) || 0;
              const amtStr = String(r.amount || '').trim().toUpperCase();
              const statStr = String(r.status || '').trim().toUpperCase();
              const hasValidName = Boolean(r.name && String(r.name).trim() && !isExcludedName(r.name));
              const hasValidId = Boolean((r.cId && String(r.cId).trim()) || (r.clientId && String(r.clientId).trim()) || (r.clientUsername && String(r.clientUsername).trim()));
              if ((hasValidName || hasValidId) && (amt > 0 || amtStr === 'PAID' || statStr === 'PAID' || statStr === 'PARTIAL' || Boolean(r.status))) {
                currentActiveRowsInPayload.push(r);
              }
            });
          });

          const processedRemovalClientKeys = new Set<string>();

          // Check removals for every page being saved
          sheetPayloads.forEach(sp => {
            let origRowsForSheet = sp.id ? originalRowsBySheetIdRef.current.get(sp.id) : undefined;
            if (!origRowsForSheet && originalActiveSheetId && sp.id === originalActiveSheetId && originalActiveRows && originalActiveRows.length > 0) {
              origRowsForSheet = originalActiveRows;
            }
            if (!origRowsForSheet && sp.id) {
              const histSheet = ledgerHistory.find(s => s.id === sp.id);
              if (histSheet && Array.isArray(histSheet.table1Rows)) {
                origRowsForSheet = histSheet.table1Rows;
              }
            }

            if (!origRowsForSheet || origRowsForSheet.length === 0) return;

            origRowsForSheet.forEach((orig: any) => {
              const origName = (orig.name || '').trim().toLowerCase();
              const origCId = (orig.cId || '').trim().toLowerCase();
              const origUser = (orig.clientUsername || '').trim().toLowerCase();
              const origId = (orig.clientId || '').trim().toLowerCase();
              const hasOrigIdentifier = Boolean(origId || origUser || origCId);

              if (!hasOrigIdentifier && !origName) return;
              if (origName && isExcludedName(origName)) return;

              const userDedupeKey = origId ? `id:${origId}` : origUser ? `user:${origUser}` : origCId ? `cid:${origCId}` : `name:${origName}`;
              if (processedRemovalClientKeys.has(userDedupeKey)) return;

              const rIdx = findRowIndex(orig);
              const matchingBillingRow = rIdx !== -1 ? baseRecalculatedRows[rIdx] : null;
              const matchingPaymentReceived = matchingBillingRow ? (Number(matchingBillingRow.paymentReceived) || 0) : 0;

              // Gap a: origAmount > 0 skips valid cases. Also treat a row as previously active if its status was PAID/PARTIAL, its amount was the string 'PAID', or the matching billing row has paymentReceived > 0.
              const origAmount = Number(orig.amount) || 0;
              const origAmountStr = String(orig.amount || '').trim().toUpperCase();
              const origStatusStr = String(orig.status || '').trim().toUpperCase();

              const isPrevActive = 
                origAmount > 0 ||
                origAmountStr === 'PAID' ||
                origStatusStr === 'PAID' ||
                origStatusStr === 'PARTIAL' ||
                matchingPaymentReceived > 0;

              if (!isPrevActive) return;

              // Gap d: isStillPresent must match by clientId, clientUsername, cId first, and use name only when the row has none of them.
              const isStillPresent = currentActiveRowsInPayload.some((cur: any) => {
                const curId = (cur.clientId || '').trim().toLowerCase();
                const curUser = (cur.clientUsername || '').trim().toLowerCase();
                const curCId = (cur.cId || '').trim().toLowerCase();
                const curName = (cur.name || '').trim().toLowerCase();

                if (hasOrigIdentifier) {
                  if (origId && curId && origId === curId) return true;
                  if (origUser && curUser && origUser === curUser) return true;
                  if (origCId && curCId && origCId === curCId) return true;
                  return false;
                } else if (origName) {
                  return curName === origName;
                }
                return false;
              });

              if (!isStillPresent) {
                // Gap c: isPaidInAnotherSheet must consider only OTHER sheets (different id) of the same folder/connected month,
                // matching by clientId/clientUsername/cId first and by name only if the row has none of those.
                // A stale local copy of the same sheet never counts.
                const isPaidInAnotherSheet = ledgerHistory.some(otherSheet => {
                  if (!otherSheet || !otherSheet.id) return false;
                  if (otherSheet.id === sp.id || sheetPayloads.some(savingSp => savingSp.id === otherSheet.id)) return false;

                  const otherFolderId = otherSheet.folderId;
                  const otherMonthId = (otherFolderId ? (folderMonthMap[otherFolderId] || folders.find(f => f.id === otherFolderId)?.connectedMonthId) : undefined) || currentMonthId;
                  const isSameFolderOrMonth = (otherFolderId && sp.folderId && otherFolderId === sp.folderId) || (otherMonthId && otherMonthId === targetMonthId);
                  if (!isSameFolderOrMonth) return false;

                  const otherRows = Array.isArray(otherSheet.table1Rows) ? otherSheet.table1Rows : [];
                  return otherRows.some((or: any) => {
                    const orId = (or.clientId || '').trim().toLowerCase();
                    const orUser = (or.clientUsername || '').trim().toLowerCase();
                    const orCId = (or.cId || '').trim().toLowerCase();
                    const orName = (or.name || '').trim().toLowerCase();

                    let isMatch = false;
                    if (hasOrigIdentifier) {
                      if (origId && orId && origId === orId) isMatch = true;
                      else if (origUser && orUser && origUser === orUser) isMatch = true;
                      else if (origCId && orCId && origCId === orCId) isMatch = true;
                    } else if (origName) {
                      isMatch = Boolean(orName && orName === origName);
                    }
                    if (!isMatch) return false;

                    const oAmt = Number(or.amount) || 0;
                    const oStat = String(or.status || '').trim().toUpperCase();
                    const oAmtStr = String(or.amount || '').trim().toUpperCase();
                    return oAmt > 0 || oStat === 'PAID' || oAmtStr === 'PAID' || oStat === 'PARTIAL';
                  });
                });

                if (isPaidInAnotherSheet) {
                  return; // Another sheet in the same folder/connected month has this client's payment recorded.
                }

                processedRemovalClientKeys.add(userDedupeKey);

                // Gap e: If findRowIndex(orig) returns -1, console.warn with the user's details instead of silently ignoring.
                if (rIdx !== -1) {
                  const rObj = baseRecalculatedRows[rIdx];
                  baseRecalculatedRows[rIdx] = {
                    ...rObj,
                    paymentReceived: 0,
                    paymentStatus: 'unpaid'
                  };
                  accumulatedChangedIndicesMap[targetMonthId].add(rIdx);
                  totalUpdatedBillingCount++;
                  const userDetail = rObj.username || rObj.clientId || orig.clientUsername || orig.clientId || orig.cId || '';
                  const displayName = rObj.name || orig.name || 'User';
                  allSyncedUsersSummary.push(`set back to UNPAID: ${displayName}${userDetail ? ` (${userDetail})` : ''} [REMOVED]`);
                } else {
                  console.warn("Could not find matching billing row for removed user:", {
                    name: orig.name,
                    cId: orig.cId,
                    clientId: orig.clientId,
                    clientUsername: orig.clientUsername,
                    amount: orig.amount,
                    status: orig.status,
                    sheetId: sp.id,
                    targetMonthId
                  });
                }
              }
            });
          });

          // Helper to find original active row for comparison
          const findOriginalMatch = (r: any) => {
            const rName = (r.name || '').trim().toLowerCase();
            const rCId = (r.cId || '').trim().toLowerCase();
            const rUser = (r.clientUsername || '').trim().toLowerCase();
            const rId = (r.clientId || '').trim().toLowerCase();

            const rows = originalActiveRows || [];
            // Match by id/username/cId first
            for (const orig of rows) {
              const origCId = (orig.cId || '').trim().toLowerCase();
              const origUser = (orig.clientUsername || '').trim().toLowerCase();
              const origId = (orig.clientId || '').trim().toLowerCase();

              if (rId && origId && rId === origId) return orig;
              if (rUser && origUser && rUser === origUser) return orig;
              if (rCId && origCId && rCId === origCId) return orig;
            }

            // Fallback by name only when exactly ONE matches
            if (rName) {
              const nameMatches = rows.filter((orig: any) => {
                const origName = (orig.name || '').trim().toLowerCase();
                return Boolean(origName && origName === rName);
              });
              if (nameMatches.length === 1) {
                return nameMatches[0];
              } else if (nameMatches.length > 1) {
                ambiguousBillingNames.add(String(r.name).trim());
                return null;
              }
            }
            return null;
          };

          // 2. Process ONLY the rows of the current saving sheet(s) (sheetPayloads)
          sheetPayloads.forEach(sp => {
            const sheetRows = Array.isArray(sp.table1Rows) ? sp.table1Rows : [];
            sheetRows.forEach((r: any) => {
              const amountVal = Number(r.amount) || 0;
              const amountStr = String(r.amount || '').trim().toUpperCase();
              const rowStatusStr = String(r.status || '').trim().toUpperCase();

              const isDcStatus = amountStr === 'DC' || rowStatusStr === 'DC';
              const isTdcStatus = amountStr === 'TDC' || rowStatusStr === 'TDC';
              const isPaidStatus = amountStr === 'PAID' || rowStatusStr === 'PAID';
              const isUnpaidStatus = amountStr === 'UNPAID' || rowStatusStr === 'UNPAID';
              const isNextStatus = amountStr === 'NEXT' || rowStatusStr === 'NEXT';
              const isStatusString = ['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL', 'EXTRA', 'NEXT'].includes(amountStr) || ['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL', 'EXTRA', 'NEXT'].includes(rowStatusStr);

              const hasId = Boolean(r.cId && String(r.cId).trim());
              const hasName = Boolean(r.name && String(r.name).trim());
              if (!hasId && !hasName) return;
              if (isExcludedName(r.name)) return;

              const client = findClientForEntry(r);
              const matchedIdx = findRowIndex(r);

              if (matchedIdx !== -1) {
                const row = baseRecalculatedRows[matchedIdx];
                const savedOrigCr = row._originalCr !== undefined ? row._originalCr : (parseFloat(row.cr) || 0);
                let base = parseFloat(row.baseAmount || 0);

                // A tdc/dc user who is later given an amount in the A4 sheet becomes 'unpaid' with the client's default fee (never 0)
                const defaultFee = (client && Number(client.baseAmount) > 0)
                  ? Number(client.baseAmount)
                  : (base > 0 ? base : 1000);

                if ((row.paymentStatus === 'tdc' || row.paymentStatus === 'dc' || base === 0) && !isDcStatus && !isTdcStatus) {
                  base = defaultFee;
                }

                let totalAmount = base + savedOrigCr;
                let newPaymentReceived = 0;
                let finalStatus = 'unpaid';

                if (isDcStatus) {
                  finalStatus = 'dc';
                  newPaymentReceived = 0;
                } else if (isTdcStatus) {
                  finalStatus = 'tdc';
                  newPaymentReceived = 0;
                } else if (isUnpaidStatus) {
                  finalStatus = 'unpaid';
                  newPaymentReceived = 0;
                } else if (isNextStatus) {
                  finalStatus = 'next';
                  newPaymentReceived = 0;
                } else if (amountVal > 0 || isPaidStatus) {
                  newPaymentReceived = amountVal > 0 ? amountVal : (totalAmount > 0 ? totalAmount : base);
                  if (isPaidStatus) {
                    finalStatus = 'paid';
                  } else if (amountVal >= totalAmount || totalAmount <= 0) {
                    finalStatus = 'paid';
                  } else {
                    finalStatus = 'partial';
                  }
                } else if (rowStatusStr === 'DC') {
                  finalStatus = 'dc';
                } else if (rowStatusStr === 'TDC') {
                  finalStatus = 'tdc';
                } else if (rowStatusStr === 'NEXT') {
                  finalStatus = 'next';
                } else if (r.status) {
                  finalStatus = r.status.toLowerCase();
                } else {
                  // If amount was 0 or empty and no explicit status was entered:
                  // Preserve existing payment if row is already marked paid or has paymentReceived > 0
                  if (row.paymentReceived > 0 || row.paymentStatus === 'paid' || row.paymentStatus === 'partial') {
                    finalStatus = row.paymentStatus;
                    newPaymentReceived = row.paymentReceived;
                  } else {
                    finalStatus = 'unpaid';
                    newPaymentReceived = 0;
                  }
                }

                // Check for Upgrade / Downgrade fee change
                const comment = String(r.comments || '').trim();
                if ((comment === 'Upgrade' || comment === 'Downgrade') && amountVal > 0 && !['dc', 'tdc', 'unpaid', 'next'].includes(finalStatus)) {
                  const resolvedClientId = client?.id || row.clientId || r.clientId;
                  if (resolvedClientId && client) {
                    const cr = savedOrigCr;
                    const newFee = Math.max(0, amountVal - cr);
                    const clientBase = Number(client.baseAmount) || 0;
                    if (newFee > 0 && newFee !== clientBase) {
                      base = newFee;
                      totalAmount = newFee + cr;
                      newPaymentReceived = amountVal;
                      finalStatus = amountVal >= totalAmount ? 'paid' : 'partial';

                      clientFeeUpdatesToApply.push({
                        clientId: resolvedClientId,
                        clientName: client.name || row.name || 'Client',
                        oldFee: clientBase,
                        newFee: newFee
                      });
                    }
                  }
                }

                const clientPhone = client?.mobileNumber || client?.number || client?.phone || row.mobileNumber || row.phone || '';
                baseRecalculatedRows[matchedIdx] = {
                  ...row,
                  clientId: client?.id || row.clientId || r.clientId || '',
                  username: client?.username || row.username || r.clientUsername || '',
                  mobileNumber: clientPhone,
                  phone: clientPhone,
                  _originalCr: savedOrigCr,
                  cr: savedOrigCr,
                  baseAmount: base,
                  totalAmount: totalAmount,
                  paymentReceived: newPaymentReceived,
                  paymentStatus: finalStatus
                };

                accumulatedChangedIndicesMap[targetMonthId].add(matchedIdx);

                // Notification filtering: Only include user in notification if NEW or EDITED
                const origMatch = findOriginalMatch(r);
                let isEntryNew = !origMatch;
                let isEntryEdited = false;

                if (origMatch) {
                  const origAmount = Number(origMatch.amount) || 0;
                  const origStatus = String(origMatch.status || '').trim().toLowerCase();
                  const origComments = String(origMatch.comments || '').trim();
                  const currentComments = String(r.comments || '').trim();
                  const currentStatus = String(r.status || '').trim().toLowerCase();

                  const isAmountChanged = origAmount !== amountVal;
                  const isStatusChanged = origStatus !== currentStatus;
                  const isCommentsChanged = origComments !== currentComments;
                  const isRecoveryChanged = (row.paymentReceived !== newPaymentReceived) || (row.paymentStatus !== finalStatus);

                  isEntryEdited = isAmountChanged || isStatusChanged || isCommentsChanged || isRecoveryChanged;
                }

                if (isEntryNew || isEntryEdited) {
                  totalUpdatedBillingCount++;
                  const tag = isEntryNew ? '[NEW]' : '[EDITED]';
                  allSyncedUsersSummary.push(`${baseRecalculatedRows[matchedIdx].name} (${baseRecalculatedRows[matchedIdx].username || baseRecalculatedRows[matchedIdx].clientId || ''}): ${finalStatus.toUpperCase()} (${newPaymentReceived}) ${tag}`);
                }
              } else {
                // 3) Do not create billing rows for unregistered names.
                // In the branch "New user not present in targetMonthRows": only create a row when client
                // (resolved by findClientForEntry) exists; otherwise collect the name in unmatchedNames
                // and, after saving, show toast.warning("Not found in Client Management, not synced to billing: <names>").
                // The sheet itself still saves.
                if (!client) {
                  const rawName = String(r.name || '').trim();
                  if (rawName && !isExcludedName(rawName)) {
                    unmatchedNames.add(rawName);
                  }
                  return; // Skip creating a billing row for unregistered clients
                }

                // New user not present in targetMonthRows (client is guaranteed to exist)
                let baseAmount = Number(client.baseAmount) || 0;
                const cr = Number(client.cr) || 0;
                let totalAmount = baseAmount + cr;

                let finalStatus = 'partial';
                if (isDcStatus) finalStatus = 'dc';
                else if (isTdcStatus) finalStatus = 'tdc';
                else if (isPaidStatus) finalStatus = 'paid';
                else if (isUnpaidStatus) finalStatus = 'unpaid';
                else if (isNextStatus) finalStatus = 'next';
                else if (amountVal >= totalAmount && totalAmount > 0) finalStatus = 'paid';
                else if (amountVal === 0) finalStatus = 'unpaid';

                let paymentReceived = isStatusString ? (finalStatus === 'paid' ? totalAmount : 0) : amountVal;

                // Check for Upgrade / Downgrade fee change
                const comment = String(r.comments || '').trim();
                if ((comment === 'Upgrade' || comment === 'Downgrade') && amountVal > 0 && !['dc', 'tdc', 'unpaid', 'next'].includes(finalStatus) && client && client.id) {
                  const newFee = Math.max(0, amountVal - cr);
                  const clientBase = Number(client.baseAmount) || 0;
                  if (newFee > 0 && newFee !== clientBase) {
                    baseAmount = newFee;
                    totalAmount = newFee + cr;
                    paymentReceived = amountVal;
                    finalStatus = amountVal >= totalAmount ? 'paid' : 'partial';

                    clientFeeUpdatesToApply.push({
                      clientId: client.id,
                      clientName: client.name || 'Client',
                      oldFee: clientBase,
                      newFee: newFee
                    });
                  }
                }

                const clientKey = client.id || `new_row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const clientPhone = client.mobileNumber || client.number || client.phone || '';
                const newRow = {
                  id: clientKey,
                  clientId: client.id || r.clientId || r.cId || '',
                  name: client.name || r.name || 'Unknown',
                  username: client.username || r.clientUsername || r.cId || '',
                  mobileNumber: clientPhone,
                  phone: clientPhone,
                  area: client.area || r.area || area || '',
                  rt: client.rt || '',
                  baseAmount: baseAmount,
                  cr: cr,
                  totalAmount: totalAmount,
                  billingDay: client.billingDay || '5',
                  paymentReceived: paymentReceived,
                  paymentStatus: finalStatus,
                  comments: r.comments || '',
                  pkgDetails: client.pkgDetails || '',
                  connectionDate: client.connectionDate || '',
                  devicePrice: client.devicePrice || '',
                  abl: client.abl || ''
                };

                const newIdx = baseRecalculatedRows.length;
                baseRecalculatedRows.push(newRow);
                accumulatedChangedIndicesMap[targetMonthId].add(newIdx);
                totalUpdatedBillingCount++;
                allSyncedUsersSummary.push(`${newRow.name} (${newRow.username || newRow.clientId || ''}): ${finalStatus.toUpperCase()} (${newRow.paymentReceived}) [NEW]`);
              }
            });
          });

          accumulatedBillingMonths[targetMonthId] = baseRecalculatedRows;
          accumulatedBillingBaseRows[targetMonthId] = targetMonthRows;
        } catch (billingErr: any) {
          console.error("Failed to auto-update billing status:", billingErr);
        }
      }

      // PARALLEL FAST DATABASE SYNC (Save A4 sheets and connected recovery rows concurrently)
      try {
        const tStartFastSave = performance.now();
        const dbTasks: Promise<any>[] = [];
        // A. Batch save A4 sheets to database
        if (sheetPayloads.length > 0) {
          dbTasks.push(pocketbaseService.saveLedgerSheetsBatch(sheetPayloads, tenantId));
        }

        // B. Save synced billing months to database concurrently
        for (const [monthId, accumulatedRows] of Object.entries(accumulatedBillingMonths)) {
          const changedIndices = accumulatedChangedIndicesMap[monthId] 
            ? Array.from(accumulatedChangedIndicesMap[monthId]) 
            : undefined;
          const freshBaseRows = accumulatedBillingBaseRows[monthId];
          dbTasks.push(
            pocketbaseService.saveBillingMonth(
              monthId, 
              accumulatedRows, 
              currentUser?.username || 'admin',
              activeDealerId,
              true,
              changedIndices,
              undefined,
              true,
              freshBaseRows
            )
          );
        }

        const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
          return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
              reject(new Error(`${label} timed out after ${ms / 1000}s. Please check your connection and try again.`));
            }, ms);
            promise.then(
              (val) => { clearTimeout(timer); resolve(val); },
              (err) => { clearTimeout(timer); reject(err); }
            );
          });
        };

        const saveResults = await withTimeout(Promise.all(dbTasks), 25000, 'Save is taking too long \u2014');
        const savedVersionMap: Record<string, string> = (sheetPayloads.length > 0 && saveResults && saveResults[0]) ? saveResults[0] : {};
        const elapsedFastSave = Math.round(performance.now() - tStartFastSave);
        console.log(`[Save Timing] Fast save (A4 sheets + billing rows sync) completed in ${elapsedFastSave}ms`);

        // Show success toast immediately as soon as database save finishes
        const primaryOfficerName = currentSyncSheets[0]?.recOfficer || recOfficer || 'Recovery Officer';
        toast.success("📄 A4 Size Sheet Saved Successfully!", {
          description: `Sheet for "${primaryOfficerName}" has been securely saved.`,
          duration: 4000
        });

        // Execute client fee updates after successful database save
        if (clientFeeUpdatesToApply.length > 0) {
          // Optimistically update local clients state
          setClients(prev => prev.map(c => {
            const upd = clientFeeUpdatesToApply.find(u => u.clientId === c.id);
            return upd ? { ...c, baseAmount: upd.newFee } : c;
          }));

          const feeChangeLogs: string[] = [];
          for (const item of clientFeeUpdatesToApply) {
            try {
              await updateClientFee(item.clientId, item.newFee);
              const logStr = `${item.clientName}: ${item.oldFee} -> ${item.newFee}`;
              console.log(`[FeeUpdate] ${logStr} (ID: ${item.clientId})`);
              feeChangeLogs.push(logStr);
            } catch (feeErr: any) {
              console.error(`Failed to update fee for ${item.clientName}:`, feeErr);
              toast.warning(`Sheet saved, but the fee of ${item.clientName} could not be updated`);
            }
          }

          if (feeChangeLogs.length > 0) {
            toast.info(`Updated client base fee:\n${feeChangeLogs.join(', ')}`);
          }
        }

        // --- UI STATE SYNCHRONIZATION (ONLY AFTER DATABASE PERSISTENCE SUCCEEDED) ---

        // 1. Update folders organisation mapping
        setSheetFolderMap(updatedFolderMap);
        saveMapToDb(updatedFolderMap);

        // 2. Update local ledger history
        setLedgerHistory(prev => {
          let next = [...prev];
          savedSheetsToLocal.forEach(localObj => {
            const existsIdx = next.findIndex(sh => sh.id === localObj.id);
            if (existsIdx >= 0) {
              next[existsIdx] = { ...next[existsIdx], ...localObj };
            } else {
              next = [localObj, ...next];
            }
          });
          return next;
        });

        // 3. Update parent state billing months
        for (const [monthId, accumulatedRows] of Object.entries(accumulatedBillingMonths)) {
          if (setBillingMonths) {
            setBillingMonths(prev => {
              const activeDocIndex = prev.findIndex(m => m.id === monthId);
              const mergedRows = accumulatedRows;
              if (activeDocIndex !== -1) {
                const newPrev = [...prev];
                newPrev[activeDocIndex] = { ...prev[activeDocIndex], rows: mergedRows };
                return newPrev;
              } else {
                return [{ id: monthId, rows: mergedRows, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
              }
            });
          }
        }

        // 4. Update currently loaded sheet references in editor with updated rows
        const lastSavedId = currentLoadedId || currentSyncSheets[activeSheetIdx]?.id;
        if (lastSavedId) {
          lastLoadedSheetIdRef.current = lastSavedId;
          const targetFolder = openedFolderId || sheetFolderMap[lastSavedId] || 'all';
          const targetPath = `${initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet'}/folder/${targetFolder}/sheet/${lastSavedId}`;
          if (location.pathname !== targetPath) {
            navigate(targetPath, { replace: true });
          }
        }

        const activeSavedPayload = sheetPayloads.find((_, pIdx) => payloadSourceIdx[pIdx] === activeSheetIdx);
        if (activeSavedPayload) {
          setTable1Rows(activeSavedPayload.table1Rows);
          setTable2Rows(activeSavedPayload.table2Rows);
        }

        // 5. Update removal baseline and remembered versions ONLY AFTER the database save has succeeded
        const activeRowsNow: any[] = [];
        sheetPayloads.forEach(sp => {
          const rows = (Array.isArray(sp.table1Rows) ? sp.table1Rows : []).filter((r: any) =>
            (r.name || '').trim() || (r.cId || '').trim() || (Number(r.amount) || 0) > 0 || r.status || String(r.amount || '').trim().toUpperCase() === 'PAID'
          ).map((r: any) => ({
            name: (r.name || '').trim(),
            amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
            comments: (r.comments || '').trim(),
            cId: r.cId || '',
            clientId: r.clientId || '',
            clientUsername: r.clientUsername || '',
            status: r.status || ''
          }));
          if (sp.id) {
            originalRowsBySheetIdRef.current.set(sp.id, rows);
            const returnedVersion = savedVersionMap[sp.id] || sp.updated || sp.openedUpdatedAtAsStoredInDb;
            if (returnedVersion) {
              openedUpdatedAtBySheetIdRef.current.set(sp.id, returnedVersion);
            }
          }
          rows.forEach(r => activeRowsNow.push(r));
        });
        setOriginalActiveRows(activeRowsNow);
        setOriginalActiveSheetId(activeSavedPayload?.id || (sheetPayloads[0]?.id) || null);
        setSheets(prev => {
          return prev.map((sh, idx) => {
            const matchingPayload = sheetPayloads.find((_, pIdx) => payloadSourceIdx[pIdx] === idx);
            if (matchingPayload) {
              const savedLocal = savedSheetsToLocal.find(s => s.id === matchingPayload.id);
              const returnedVersion = savedVersionMap[matchingPayload.id] || matchingPayload.updated || matchingPayload.openedUpdatedAtAsStoredInDb;
              return {
                ...sh,
                id: matchingPayload.id,
                folderId: savedLocal?.folderId || matchingPayload.folderId || sh.folderId || '',
                table1Rows: matchingPayload.table1Rows,
                table2Rows: matchingPayload.table2Rows,
                openedUpdatedAt: returnedVersion || sh.openedUpdatedAt,
                openedUpdatedAtAsStoredInDb: returnedVersion || sh.openedUpdatedAtAsStoredInDb,
                updated: returnedVersion || sh.updated,
                updatedAt: matchingPayload.updatedAt,
              };
            }
            return sh;
          });
        });

        if (allSyncedUsersSummary.length > 0) {
          const removedEntries = allSyncedUsersSummary.filter(s => s.startsWith("set back to UNPAID:"));
          toast.success("🎯 Connected Recovery Sheet Synced!", {
            description: (
              <div className="mt-1.5 space-y-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <p className="font-extrabold text-emerald-600 dark:text-emerald-400">Successfully updated recovery entries for {allSyncedUsersSummary.length} user(s):</p>
                {removedEntries.length > 0 && (
                  <p className="font-bold text-amber-600 dark:text-amber-400">
                    {removedEntries.map(s => s.replace(" [REMOVED]", "")).join(', ')}
                  </p>
                )}
                <ul className="list-disc pl-3 max-h-32 overflow-y-auto space-y-0.5 font-mono">
                  {allSyncedUsersSummary.map((summary, idx) => (
                    <li key={idx} className={summary.startsWith("set back to UNPAID:") ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                      {summary}
                    </li>
                  ))}
                </ul>
              </div>
            ),
            duration: 6000
          });
        }

        if (usedStaleOk) {
          toast.warning("Saved using last synced data; changes are checked for conflicts");
        }

        // Show warnings for unregistered and ambiguous name entries
        if (unmatchedNames.size > 0) {
          toast.warning(`Not found in Client Management, not synced to billing: ${Array.from(unmatchedNames).join(', ')}`);
        }

        if (ambiguousBillingNames.size > 0) {
          toast.warning(`Multiple billing rows found for name, skipped sync: ${Array.from(ambiguousBillingNames).join(', ')}`);
        }

      } catch (dbError: any) {
        console.error("DB persistence failed:", dbError);
        const errMsg = dbError?.message || "Failed to save to database. Please check your network and try again.";
        const isCasConflict = errMsg.includes("changed on another device");
        const isTimeout = errMsg.includes("timed out");

        if (isCasConflict) {
          toast.error("Save Blocked \u2014 Conflict Detected", {
            description: "This sheet was changed on another device. Please reload it and try again.",
            duration: 9000
          });
        } else {
          toast.error(isTimeout ? "Save Timed Out" : "Save Incomplete \u2014 Retry Safe", {
            description: `${errMsg} Note: Some parts of the save may already be completed; pressing Save again is safe (it is idempotent).`,
            duration: 9000
          });
        }
        throw dbError;
      }

    } catch (e: any) {
      console.error("Save sheet error:", e);
      const msg = getCleanErrorMessage(e) || "Failed to save sheet";
      if (!msg.includes("changed on another device") && !msg.includes("idempotent")) {
        toast.error("Failed to save sheet", {
          description: `${msg} (Pressing Save again is safe)`
        });
      }
    } finally {
      if (savingToastId !== undefined) {
        toast.dismiss(savingToastId);
      }
      isSavingSheetRef.current = false;
      setIsSavingSheet(false);
    }
  };

    const loadSheetIntoEditor = (sheet: any) => {
    setRecOfficer(sheet.recOfficer || '');
    setRecOfficerLabel(sheet.recOfficerLabel || 'REC. OFFICER');
    setArea(sheet.area || 'MAIN');
    setAreaLabel(sheet.areaLabel || 'AREA');
    setSheetDate(sheet.sheetDate || '');
    setDateLabel(sheet.dateLabel || 'DATE');

    // Restore table 1rows
    const reT1 = parseRowsArray(sheet.table1Rows).map((r: any) => ({
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
        originalAmount: 0,
        clientId: '',
        clientUsername: ''
      });
    }
    setTable1Rows(reT1);

    // Restore table 2rows
    const reT2 = parseRowsArray(sheet.table2Rows).map((r: any) => ({
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
      folderId: sheet.folderId || sheetFolderMap[sheet.id] || '',
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
      openedUpdatedAt: sheet.updated || sheet.openedUpdatedAt || undefined,
      updatedAt: sheet.updatedAt || sheet.updated_at || undefined,
      updated: sheet.updated || undefined
    };
    
    const initialActive = reT1.filter((r: any) => (r.name || '').trim() || (r.cId || '').trim() || (Number(r.amount) || 0) > 0 || r.status || String(r.amount || '').trim().toUpperCase() === 'PAID');
    const mappedInitialActive = initialActive.map((r: any) => ({
      name: (r.name || '').trim(),
      amount: isNaN(Number(r.amount)) ? r.amount : (Number(r.amount) || 0),
      comments: (r.comments || '').trim(),
      cId: r.cId || '',
      clientId: r.clientId || '',
      clientUsername: r.clientUsername || '',
      status: r.status || ''
    }));
    setOriginalActiveRows(mappedInitialActive);
    const targetSheetId = restoredSheet.id || sheet.id || null;
    setOriginalActiveSheetId(targetSheetId);
    if (targetSheetId) {
      originalRowsBySheetIdRef.current.set(targetSheetId, mappedInitialActive);
      const sheetOpenedUpdated = sheet.updated || sheet.openedUpdatedAtAsStoredInDb;
      if (sheetOpenedUpdated) {
        openedUpdatedAtBySheetIdRef.current.set(targetSheetId, sheetOpenedUpdated);
      }
    }
    isSwappingRef.current = true;
    setSheets([restoredSheet]);
    setActiveSheetIdx(0);
    setTimeout(() => {
      isSwappingRef.current = false;
    }, 50);
  };

  const handleLoadHistorySheet = (sheet: any) => {
    loadSheetIntoEditor(sheet);
    const targetFolder = sheet.folderId || openedFolderId || sheetFolderMap[sheet.id] || 'all';
    const targetPath = `${initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet'}/folder/${targetFolder}/sheet/${sheet.id}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
    toast.info(`Loaded sheet card for recovery officer: ${sheet.recOfficer}`);
  };

  const lastLoadedSheetIdRef = useRef<string | null>(null);

  // Sync URL parameter sheetId with Editor state loading
  useEffect(() => {
    if (!isOpen) return;

    if (urlSheetId) {
      if (lastLoadedSheetIdRef.current !== urlSheetId) {
        const foundSheet = ledgerHistory.find(s => s.id === urlSheetId);
        if (foundSheet) {
          loadSheetIntoEditor(foundSheet);
          lastLoadedSheetIdRef.current = urlSheetId;
        } else {
          pocketbaseService.getLedgerSheetDirect(urlSheetId).then(sheet => {
            if (sheet) {
              setLedgerHistory(prev => {
                if (prev.some(s => s.id === sheet.id)) return prev;
                return [sheet, ...prev];
              });
              loadSheetIntoEditor(sheet);
              lastLoadedSheetIdRef.current = urlSheetId;
            }
          }).catch(console.warn);
        }
      }
    } else {
      if (lastLoadedSheetIdRef.current !== null) {
        resetToBlank();
        lastLoadedSheetIdRef.current = null;
      }
    }
  }, [urlSheetId, ledgerHistory, isOpen]);

  // Delete a single historical card from registry logs
  const handleDeleteHistorySheet = (sheetId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid loading the sheet on card click
    
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to delete historical logs."
      });
      return;
    }

    setSheetToDeleteId(sheetId);
  };

  const [isDeletingSheet, setIsDeletingSheet] = useState(false);

  const confirmDeleteHistorySheet = async () => {
    if (!sheetToDeleteId || isDeletingSheet) return;
    setIsDeletingSheet(true);
    const targetId = sheetToDeleteId;
    const previousHistory = [...ledgerHistory];

    // Optimistically update UI
    setLedgerHistory(prev => prev.filter(s => s.id !== targetId));

    try {
      const sheetObj = previousHistory.find(s => s.id === targetId);
      const author = currentUser?.fullName || currentUser?.username || 'admin';
      const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined) || 'main';

      await pocketbaseService.deleteLedgerSheet(targetId, author, scopeId, sheetObj);
      toast.success("Ledger card moved to Recycle Bin!");
      if (loadedSheetId === targetId) {
        resetToBlank();
        navigate(`${initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet'}/folder/${openedFolderId || 'all'}`);
      }
    } catch (err: any) {
      // Roll back optimistic UI state if server operation fails
      setLedgerHistory(previousHistory);
      toast.error(getCleanErrorMessage(err));
    } finally {
      setIsDeletingSheet(false);
      setSheetToDeleteId(null);
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
  const handleTerminateMonth = () => {
    if (isLocked) {
      toast.error("🔒 SYSTEM SECURED", {
        description: "Please unlock the Billing Security Shield to terminate the ongoing billing month."
      });
      return;
    }
    setShowTerminateMonthModal(true);
  };

  const confirmTerminateMonth = async () => {
    try {
      const tenantId = pocketbaseService.getReadTenantId(currentUser as any);
      const author = currentUser?.fullName || currentUser?.username || 'admin';
      toast.loading("Moving all monthly cards to Recycle Bin...", { id: "terminate-proc" });
      await pocketbaseService.terminateAllLedgerSheets(tenantId, author);
      toast.dismiss("terminate-proc");
      toast.success("Month terminated cleanly! Sheet cards moved to Recycle Bin.");
      resetToBlank();
      navigate(initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet');
    } catch (e: any) {
      toast.dismiss("terminate-proc");
      toast.error("Failed to terminate month: " + getCleanErrorMessage(e));
    } finally {
      setShowTerminateMonthModal(false);
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
        const tenantId = pocketbaseService.getReadTenantId(currentUser as any);
        const author = currentUser?.fullName || currentUser?.username || 'admin';
        toast.loading("Moving registered monthly sheets to Recycle Bin...", { id: "reset-all-proc" });
        await pocketbaseService.terminateAllLedgerSheets(tenantId, author);
        toast.dismiss("reset-all-proc");
        toast.success("Active workspace reset and registered sheet history moved to Recycle Bin!");
      } else {
        toast.success("Active workspace fields reset successfully!");
      }
      resetToBlank();
      navigate(initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet');
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


  // Workspace and Editor Loading indicators
  const isEditorWaitingForSheet = activeView === 'editor' && (!sheets || sheets.length === 0 || sheets[activeSheetIdx]?.id !== urlSheetId);
  const isWorkspaceLoading = isLoadingSheets || isEditorWaitingForSheet;

  // Calculators (memoized so stable primitives are passed to EditorToolbar)
  const totalAmount1 = useMemo(
    () => table1Rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [table1Rows]
  );
  const totalAmount2 = useMemo(
    () => table2Rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [table2Rows]
  );
  const rowsFilledCount = useMemo(
    () => table1Rows.filter(r => r.cId || r.name || r.amount > 0).length,
    [table1Rows]
  );

  // Edit helper for Table 1
  const handleT1Change = useCallback((index: number, field: keyof Table1Row, value: any) => {
    if (isLocked) return;
    if (
      field === 'name' &&
      selectionLockRef.current &&
      selectionLockRef.current.index === index &&
      Date.now() < selectionLockRef.current.until
    ) {
      return;
    }
    const start = performance.now();
    setTable1Rows(prevRows => {
      const updated = [...prevRows];
      if (!updated[index]) return prevRows;
      let commentsVal = updated[index].comments;
      let statusVal = updated[index].status;
      if (field === 'comments') {
        commentsVal = value;
      } else if (field === 'amount') {
        const orig = updated[index].originalAmount;
        const strVal = String(value || '').trim().toUpperCase();
        const isStatusString = ['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL', 'EXTRA', 'NEXT'].includes(strVal);
        if (isStatusString) {
          statusVal = strVal.toLowerCase();
          if (commentsVal === 'Upgrade' || commentsVal === 'Downgrade') {
            commentsVal = '';
          }
        } else {
          const numVal = parseFloat(value);
          if (!isNaN(numVal) && numVal > 0) {
            // Reset DC status so entering an amount shifts DC users back to active billing!
            if (statusVal === 'dc' || statusVal === 'tdc') {
              statusVal = 'unpaid';
            }
          }
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
      } else if (field === 'status') {
        statusVal = String(value || '').toLowerCase();
      }
      updated[index] = {
        ...updated[index],
        [field]: value,
        comments: commentsVal,
        status: statusVal
      };
      if (field === 'name') {
        updated[index].clientId = undefined;
        updated[index].clientUsername = undefined;
      }
      return updated;
    });
    logPerf(`handleT1Change (${field})`, start);
  }, [isLocked]);

  // Edit helper for Table 2
  const handleT2Change = useCallback((index: number, field: keyof Table2Row, value: any) => {
    if (isLocked) return;
    const start = performance.now();
    setTable2Rows(prevRows => {
      const updated = [...prevRows];
      if (!updated[index]) return prevRows;
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
    logPerf(`handleT2Change (${field})`, start);
  }, [isLocked]);

  const handleFocusField = useCallback((index: number, field: 'name' | 'amount', currentVal: string, element: HTMLInputElement) => {
    if (blurResetTimerRef.current) {
      clearTimeout(blurResetTimerRef.current);
      blurResetTimerRef.current = null;
    }
    setFocusedRowIndex(index);
    setFocusedField(field);
    setActiveInputElement(element);
    if (field === 'name') {
      suggestionsDropdownRef.current?.setSearchState(currentVal, false);
    }
  }, []);

  const handleBlurField = useCallback(() => {
    flushPendingStorageWrites();
    if (blurResetTimerRef.current) {
      clearTimeout(blurResetTimerRef.current);
    }
    blurResetTimerRef.current = setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName === 'INPUT') {
        return;
      }
      setFocusedRowIndex(null);
      setFocusedField(null);
      setActiveInputElement(null);
      blurResetTimerRef.current = null;
    }, 250);
  }, []);

  const handleSearchQueryChange = useCallback((val: string) => {
    suggestionsDropdownRef.current?.setSearchState(val, true);
    scheduleDropdownPositionUpdate();
  }, [scheduleDropdownPositionUpdate]);

  const proceedSelectSuggestion = useCallback((index: number, client: any) => {
    if (blurResetTimerRef.current) {
      clearTimeout(blurResetTimerRef.current);
      blurResetTimerRef.current = null;
    }
    selectionLockRef.current = { index, until: Date.now() + 600 };

    const matchingActiveRow = activeRows?.find(r => 
      (r.username && r.username.toLowerCase() === client.username?.toLowerCase()) || 
      (r.clientId && r.clientId.toLowerCase() === client.id?.toLowerCase())
    );
    let amount = 0;
    
    if (matchingActiveRow) {
      const isDcOrTdc = matchingActiveRow.paymentStatus === 'dc' || matchingActiveRow.paymentStatus === 'tdc';
      const totalAmt = parseFloat(matchingActiveRow.totalAmount) || parseFloat(matchingActiveRow.baseAmount) || (client.baseAmount ? Number(client.baseAmount) : 0);
      const rcvAmt = parseFloat(matchingActiveRow.paymentReceived) || 0;
      const outstanding = totalAmt - rcvAmt;
      amount = outstanding > 0 ? outstanding : totalAmt;
      if (amount === 0 && client.pkgDetails) {
        const match = client.pkgDetails.match(/\b(1000|1200|1500|2000|2500|3000|3500|4000|5000|150|200|250|300|350|400|450|500|600|700|800|900)\b/) || client.pkgDetails.match(/\b\d{3,4}\b/);
        amount = match ? parseInt(match[0], 10) : 0;
      }
    } else {
      if (client.pkgDetails) {
        const match = client.pkgDetails.match(/\b(1000|1200|1500|2000|2500|3000|3500|4000|5000|150|200|250|300|350|400|450|500|600|700|800|900)\b/) || client.pkgDetails.match(/\b\d{3,4}\b/);
        amount = match ? parseInt(match[0], 10) : 0;
      }
      if (amount === 0 && client.baseAmount) {
        amount = Number(client.baseAmount) || 0;
      }
    }

    const rawFoundName = (
      client.name ||
      client.fullName ||
      client.full_name ||
      client.clientName ||
      matchingActiveRow?.name ||
      ''
    );
    const resolvedName = typeof rawFoundName === 'string' ? rawFoundName.trim() : String(rawFoundName || '').trim();

    if (!resolvedName) {
      toast.error('This customer has no name saved');
    }

    setTable1Rows(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const finalName = resolvedName || updated[index].name;
      updated[index] = {
        ...updated[index],
        cId: '',
        name: finalName,
        amount: amount,
        originalAmount: amount,
        clientId: client.id || '',
        clientUsername: client.username || '',
        status: amount > 0 ? 'paid' : ((matchingActiveRow?.paymentStatus === 'dc' && amount > 0) ? 'paid' : (matchingActiveRow?.paymentStatus || undefined))
      };
      return updated;
    });
    
    setFocusedRowIndex(null);
    setFocusedField(null);
    suggestionsDropdownRef.current?.setSearchState('', false);
    setActiveInputElement(null);
  }, [activeRows]);

  const handleSelectSuggestion = useCallback((index: number, client: any) => {
    if (isLocked) return;
    const start = performance.now();
    flushLiveSheetState();

    const currentSheetId = sheets[activeSheetIdx]?.id;
    const currentFolderId = currentSheetId 
      ? (sheetFolderMap[currentSheetId] || ledgerHistory.find(sh => sh.id === currentSheetId)?.folderId) 
      : undefined;

    if (currentFolderId) {
      const folderSheets = ledgerHistory.filter(sh => sh.folderId === currentFolderId || sheetFolderMap[sh.id] === currentFolderId);
      let duplicateFound = false;
      let dupLocation = "";

      const isDupInCurrent = table1Rows.some((r, i) => i !== index && (
        (r.clientId && r.clientId === client.id) || 
        (r.clientUsername && r.clientUsername === client.username)
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
            (r.clientUsername && r.clientUsername === client.username)
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
        logPerf('handleSelectSuggestion (duplicate warning)', start);
        return;
      }
    }

    proceedSelectSuggestion(index, client);
    logPerf('handleSelectSuggestion', start);
  }, [isLocked, flushLiveSheetState, sheets, activeSheetIdx, sheetFolderMap, ledgerHistory, table1Rows, proceedSelectSuggestion]);

  // Memoized search index for ultra-fast customer autocomplete
  const suggestionsIndex = useMemo(() => {
    const sourceList: any[] = [];
    const seenUsernames = new Set<string>();
    const seenNames = new Set<string>();

    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (!c) continue;
      const uKey = String(c.username || c.id || '').toLowerCase();
      const nKey = String(c.name || '').trim().toLowerCase();
      if (uKey) seenUsernames.add(uKey);
      if (nKey) seenNames.add(nKey);
      sourceList.push({
        ...c,
        _lowerName: nKey,
        _lowerUsername: uKey,
        _lowerId: String(c.id || '').toLowerCase(),
      });
    }

    if (activeRows && activeRows.length > 0) {
      for (let i = 0; i < activeRows.length; i++) {
        const r = activeRows[i];
        if (!r) continue;
        const usernameKey = String(r.username || r.clientId || '').toLowerCase();
        const nameKey = String(r.name || '').trim().toLowerCase();
        const alreadyExists = (usernameKey && seenUsernames.has(usernameKey)) || (nameKey && seenNames.has(nameKey));

        if (!alreadyExists && (usernameKey || nameKey)) {
          if (usernameKey) seenUsernames.add(usernameKey);
          if (nameKey) seenNames.add(nameKey);
          sourceList.push({
            id: r.clientId || r.username || '',
            username: r.username || r.clientId || '',
            name: r.name || '',
            mobileNumber: r.mobileNumber || '',
            pkgDetails: r.pkgDetails || r.comments || '',
            area: r.area || '',
            _lowerName: nameKey,
            _lowerUsername: usernameKey,
            _lowerId: String(r.clientId || r.username || '').toLowerCase()
          });
        }
      }
    }

    return sourceList;
  }, [clients, activeRows]);

  useLayoutEffect(() => {
    if (activeInputElement && !activeInputElement.isConnected) {
      const live = getLiveInputElement();
      if (live) {
        setActiveInputElement(live);
      }
    }
    updateDropdownPosition();
  }, [activeInputElement, focusedRowIndex, focusedField, updateDropdownPosition, getLiveInputElement]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleSelectZoom = useCallback((zOpt: 'fit' | '100%' | '85%' | '75%') => {
    setZoomOption(zOpt);
    debouncedSetStorageItem('gts_ledger_zoomOption', zOpt);
    toast.success(`Zoom adjusted to ${zOpt.toUpperCase()}`);
  }, []);

  const handleToggleSizing = useCallback(() => {
    setShowSizingPanel(prev => !prev);
  }, []);

  const handleToggleHistory = useCallback(() => {
    setShowHistoryPanel(prev => !prev);
  }, []);

  const handleCloseHistoryPanel = useCallback(() => {
    setShowHistoryPanel(false);
  }, []);

  const handleNavigateFolders = useCallback(() => {
    if (openedFolderId) {
      navigate(`${initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet'}/folder/${openedFolderId}`);
    } else {
      navigate(initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet');
    }
  }, [openedFolderId, initialShowUserLedger, navigate]);

  const handleTriggerResync = useCallback(() => {
    triggerResync('resync');
  }, [triggerResync]);

  const handleShowSaveWidthsBar = useCallback(() => {
    setShowSaveWidthsBar(true);
  }, []);

  const handleCloseReceiptPanel = useCallback(() => {
    setReceiptPanelReady(false);
    setIsReceiptSwipeOpen(false);
  }, []);

  const handleHoldReceipt = useCallback(() => {
    setReceiptPanelReady(false);
    setIsReceiptSwipeOpen(false);
    setIsPendingReceipt(true);
    toast.info('Receipt placed on Hold. Click the floating pending badge to resume.');
  }, []);

  const handleRegenerateReceiptCode = useCallback(() => {
    setCurrentReceiptCode(Math.random().toString(36).substring(2, 12).toUpperCase());
  }, []);

  const handleCancelTerminateMonth = useCallback(() => {
    setShowTerminateMonthModal(false);
  }, []);

  const handleCloseFolderSettings = useCallback(() => {
    setSettingsFolderId(null);
  }, []);

  const handleSaveFolderSettings = useCallback(() => {
    const cleanName = editFolderName.trim();
    if (!cleanName) {
      toast.error("Folder name cannot be empty");
      return;
    }
    const folderExists = folders.some(f => f.id !== settingsFolderId && f.name.toLowerCase() === cleanName.toLowerCase());
    if (folderExists) {
      toast.error("A folder with this name already exists");
      return;
    }
    const newFolders = folders.map(f => f.id === settingsFolderId ? { ...f, name: cleanName, connectedMonthId: editConnectedMonthId } : f);
    setFolders(newFolders);
    saveFoldersToDb(newFolders);

    const nextFolderMonthMap = { ...folderMonthMap, [settingsFolderId!]: editConnectedMonthId };
    setFolderMonthMap(nextFolderMonthMap);
    saveFolderMonthMapToDb(nextFolderMonthMap);

    toast.success("Folder settings saved successfully!");
    setSettingsFolderId(null);
  }, [editFolderName, editConnectedMonthId, folders, settingsFolderId, folderMonthMap]);

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
      filteredSheets = ledgerHistory.filter(sh => sh.folderId === ledgerSelectedFolder || sheetFolderMap[sh.id] === ledgerSelectedFolder);
    }

    const keyword = ledgerSearchUser.toLowerCase().trim();
    const results: any[] = [];

    if (keyword) {
      filteredSheets.forEach(sh => {
        const folderId = sh.folderId || sheetFolderMap[sh.id];
        const folder = folders.find(f => f.id === folderId);
        const folderName = folder ? folder.name : 'Uncategorized';

        // Check T1
        (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).forEach((r: any) => {
          const match = r.cId?.toLowerCase().includes(keyword) || 
                        r.name?.toLowerCase().includes(keyword) || 
                        r.clientUsername?.toLowerCase().includes(keyword) ||
                        r.receiptCode?.toLowerCase().includes(keyword);
          if (match && Number(r.amount) > 0) {
            // Find corresponding client for extra connection info
            const matchClient = findClientForEntry(r);

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
            const matchClient = findClientForEntry(r);

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
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 print:hidden">
             <div className="flex items-center gap-3">
               <button onClick={() => {
                 if (!initialShowUserLedger) { setShowUserLedger(false); }
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

          <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm print:hidden">
             <div className="flex-1 space-y-1">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Search User</label>
               <div className="relative">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                 <input 
                   type="text" 
                   value={ledgerSearchUser}
                   onChange={(e) => setLedgerSearchUser(e.target.value)}
                   placeholder="Enter Name, User ID, or PPPoE..." 
                   className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                 />
               </div>
             </div>
             
             <div className="w-full sm:w-64 space-y-1">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filter By Month (Folder)</label>
               <select 
                 value={ledgerSelectedFolder}
                 onChange={(e) => setLedgerSelectedFolder(e.target.value)}
                 className="w-full px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 transition-all outline-none"
               >
                 <option value="all">ALL VOLUMES / MONTHS</option>
                 {folders.map((f, idx) => (
                   <option key={`folder-opt-${f.id}-${idx}`} value={f.id}>{f.name.toUpperCase()}</option>
                 ))}
               </select>
             </div>
          </div>

          {keyword ? (
            <div className="user-ledger-print-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm print:border-none print:shadow-none print:rounded-none">
               <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/10 flex justify-between items-center print:bg-white print:border-none print:p-0 print:mb-4">
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
                     <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                       <tr className="border-t-2 border-slate-200 dark:border-white/10 font-black uppercase text-[11px] text-slate-800 dark:text-slate-200">
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
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl">
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
    let uncategorizedSheets = ledgerHistory.filter(sh => !sh.folderId && !sheetFolderMap[sh.id]);

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
          const receiptCode = String(r.receiptCode || '').toLowerCase();

          return (
            cId.includes(filterKeyword) ||
            name.includes(filterKeyword) ||
            comments.includes(filterKeyword) ||
            clientId.includes(filterKeyword) ||
            clientUsername.includes(filterKeyword) ||
            receiptCode.includes(filterKeyword)
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
      ? ledgerHistory.filter(sh => (sh.folderId === activeFolder.id || sheetFolderMap[sh.id] === activeFolder.id) && doesMatchSearch(sh)) 
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-5 w-full">
          <div className="flex items-center justify-between w-full md:w-auto gap-2">
            <div className="text-left flex-1 min-w-0">
              <h1 className="text-sm min-[380px]:text-base sm:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    if (openedFolderId) {
                      navigate(initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet');
                    } else {
                      onClose();
                    }
                  }}
                  className="p-1 sm:p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mr-0.5 sm:mr-1 flex items-center justify-center cursor-pointer shrink-0"
                  title="Go Back"
                >
                  <ArrowLeft size={16} className="sm:size-[20px]" />
                </button>
                <FolderOpen className="text-blue-500 shrink-0 sm:size-[26px]" size={18} />
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
                <form onSubmit={handleCreateFolder} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
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
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-705 dark:text-slate-300 text-[10px] items-center font-bold uppercase transition-colors hover:border-slate-300 dark:hover:border-slate-700 py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
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
                    className="w-full pl-8 pr-3 py-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-205 dark:border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-blue-550 transition-all text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchUserClick}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-650 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:via-emerald-555 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-500/20 active:scale-95 shadow-md shadow-emerald-600/10 shrink-0"
                  title="Search User Entry"
                >
                  <Sparkles size={11} className="text-white" />
                  <span>Search Entry</span>
                </button>
              </div>
            )}

            {/* Desktop-only container for Create Folder button */}
            <div className="hidden md:flex items-center gap-2">
              {!isCreatingFolder ? (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus size={14} />
                  New Folder
                </button>
              ) : (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/10">
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
              onClick={() => navigate(initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet')}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
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
            {showFoldersSkeleton ? (
              <FoldersGridSkeleton />
            ) : (
              /* Folders grid styled as real PC drive folder icons */
              <div className="mt-1">
                {(() => {
                  const getFolderTimestamp = (f: any): number => {
                    if (!f) return 0;
                    if (typeof f.createdAt === 'number' && f.createdAt > 0) return f.createdAt;
                    if (typeof f.created_at === 'number' && f.created_at > 0) return f.created_at;
                    if (f.createdAt) {
                      const t = new Date(f.createdAt).getTime();
                      if (!isNaN(t) && t > 0) return t;
                    }
                    if (f.created_at) {
                      const t = new Date(f.created_at).getTime();
                      if (!isNaN(t) && t > 0) return t;
                    }
                    if (f.created) {
                      const t = new Date(f.created).getTime();
                      if (!isNaN(t) && t > 0) return t;
                    }
                    if (typeof f.id === 'string' && f.id.startsWith('folder_')) {
                      const parts = f.id.split('_');
                      const parsed = parseInt(parts[1], 10);
                      if (!isNaN(parsed) && parsed > 0) return parsed;
                    }
                    return 0;
                  };

                  const sortedFolders = [...folders].sort((a, b) => {
                    const timeA = getFolderTimestamp(a);
                    const timeB = getFolderTimestamp(b);
                    if (timeA !== timeB) {
                      return timeB - timeA; // Newest / latest created folder always FIRST on the top-left
                    }
                    return 0;
                  });

                  // Precompute folder stats for zero-lag and zero-flicker rendering
                  const folderStatsMap: Record<string, { sheets: any[]; totalAmount: number }> = {};
                  sortedFolders.forEach(folder => {
                    const fSheets = ledgerHistory.filter(sh => (sh.folderId === folder.id || sheetFolderMap[sh.id] === folder.id) && doesMatchSearch(sh));
                    const total = fSheets.reduce((sum, sh) => {
                      const t1 = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                      return sum + t1;
                    }, 0);
                    folderStatsMap[folder.id] = { sheets: fSheets, totalAmount: total };
                  });

                  return (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2.5 sm:gap-3">
                      {sortedFolders.map((folder, folderIdx) => {
                        const { sheets: folderSheets, totalAmount } = folderStatsMap[folder.id] || { sheets: [], totalAmount: 0 };
                        return (
                          <motion.div
                            key={`folder-${folder.id}-${folderIdx}`}
                            initial={false}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 220, damping: 18 }}
                            onClick={() => navigate(`${initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet'}/folder/${folder.id}`)}
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
                                <Plus size={12} className="text-amber-600 stroke-[3]" />
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
                              {(() => {
                                const connId = folderMonthMap[folder.id] || folder.connectedMonthId;
                                if (connId) {
                                  const hasListLoaded = (billingMonthsList && billingMonthsList.length > 0) || internalMonthsList.length > 0 || billingMonths.length > 0;
                                  const monthExists = effectiveMonthsList.some(m => m.id === connId) || billingMonths.some(m => m.id === connId);
                                  if (hasListLoaded && !monthExists) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 px-2 py-0.5 rounded-full select-none mb-1 border border-rose-100 dark:border-rose-900/30">
                                        <AlertTriangle size={10} />
                                        Deleted: {connId}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 px-2 py-0.5 rounded-full select-none mb-1 border border-blue-100 dark:border-blue-900/30">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                      {connId}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {folderSheets.length > 0 ? (
                                <>
                                  {totalAmount > 0 ? (
                                    <span className="text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 select-none">
                                      Rs. {totalAmount.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-slate-550 uppercase">
                                      Empty Folder
                                    </span>
                                  )}
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
                          {true && (
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
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 text-center min-h-[200px] mt-2">
                  <FolderPlus size={32} className="text-blue-550 dark:text-blue-400 mb-3 animate-bounce" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    No directory folders established yet
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold max-w-sm mt-1 uppercase tracking-wider leading-relaxed">
                    Set up your first recovery sheet folder directory below using the "New Volume Folder" input.
                  </p>
                </div>
              )}
            </div>)}


          </div>
        ) : showFoldersSkeleton ? (
          /* Loading folder state */
          <div className="w-full min-h-[300px]">
            <SkTable rows={6} cols={5} className="min-h-[300px]" />
          </div>
        ) : !activeFolder ? (
          /* Folder not found */
          <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px] w-full bg-transparent">
            <FolderPlus size={32} className="text-slate-400 dark:text-slate-600 mb-3" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Directory Not Found</p>
            <button onClick={() => navigate(initialShowUserLedger ? '/billingmod/ledger' : '/billingmod/entrysheet')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
              Go To Dashboard
            </button>
          </div>
        ) : (
          /* ================= INSIDE OPENED DIRECTORY VIEW ================= */
          <div className="flex flex-col gap-6 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* Creator Card (the "+" option card explicitly requested) */}
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                onClick={() => activeFolder && handleCreateSheetInFolder(activeFolder.id)}
                className="group cursor-pointer border-2 border-dashed border-blue-400/50 dark:border-blue-900/40 hover:border-blue-500 dark:hover:border-blue-400 rounded-3xl p-6 bg-blue-50/10 dark:bg-blue-950/5 hover:bg-blue-50/25 flex flex-col items-center justify-center text-center gap-4 min-h-[180px] transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1"
              >
                <div className="p-3 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-blue-600 dark:text-blue-400 text-sm uppercase tracking-wide">
                    Create New Sheet
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Add logged ledger to /{activeFolder?.name || 'Volume'}
                  </p>
                </div>
              </motion.div>

              {showSheetListSkeleton ? (
                <div className="col-span-full"><SheetListSkeleton /></div>
              ) : openedFolderSheets.length === 0 ? (
                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-900/10 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 stroke-[1.8] animate-bounce" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
                    This directory is empty
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Click the creator card to start logging recoveries
                  </p>
                </div>
              ) : (
                openedFolderSheets.map((sh, shIdx) => {
                  const t1Am = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
                  const sheetTotal = t1Am;
                  const filledLines = (Array.isArray(sh.table1Rows) ? sh.table1Rows : []).filter((r: any) => r.cId || r.name || r.amount > 0).length;

                  return (
                    <motion.div
                      key={`sheet-${sh.id}-${shIdx}`}
                      initial={false}
                      animate={{ opacity: 1 }}
                      className="p-5 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-400/40 rounded-3xl flex flex-col justify-between gap-5 shadow-sm hover:shadow-xl hover:shadow-blue-550/[0.03] group relative select-none transition-all duration-200 hover:scale-[1.015] hover:-translate-y-1"
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
                      <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-white/10">
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
                          value={activeFolder?.id || ''}
                          onChange={(e) => {
                            const destId = e.target.value;
                            const newMap = { ...sheetFolderMap, [sh.id]: destId };
                            setSheetFolderMap(newMap);
                            saveMapToDb(newMap);
                            const scopeId = activeDealerId || (currentUser?.role === 'dealer' ? currentUser?.uid : undefined);
                            pocketbaseService.saveLedgerSheet({ ...sh, folderId: destId }, scopeId).catch(console.error);
                            toast.success(`Moved sheet to ${folders.find(f => f.id === destId)?.name || 'folder'}`);
                          }}
                          className="py-1 px-2 border border-slate-205 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-950 text-[9px] font-black uppercase text-slate-500 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 transition-shadow shrink-0"
                          title="Move to other folder"
                        >
                          {folders.map((f, idx) => (
                            <option key={`f-opt-${f.id}-${idx}`} value={f.id}>{f.name}</option>
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

  if (!isOpen) return null;

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
            <EditorToolbar
              onClose={onClose}
              onNavigateFolders={handleNavigateFolders}
              isLocked={isLocked}
              rowsFilledCount={rowsFilledCount}
              totalAmount1={totalAmount1}
              totalAmount2={totalAmount2}
              zoomOption={zoomOption}
              onSelectZoom={handleSelectZoom}
              showSizingPanel={showSizingPanel}
              onToggleSizing={handleToggleSizing}
              onPrint={handlePrint}
              showHistoryPanel={showHistoryPanel}
              onToggleHistory={handleToggleHistory}
              isDataFresh={isDataFresh}
              staleOk={staleOk}
              isSyncSlow={isSyncSlow}
              onTriggerResync={handleTriggerResync}
              isSavingSheet={isSavingSheet}
              onSaveSheet={handleSaveSheet}
            />

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
              height: auto !important;
              min-height: 297mm !important;
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
            .print-sheet-wrapper-container {
              display: block !important;
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-sheet-wrapper {
              position: static !important;
              width: 210mm !important;
              height: 297mm !important;
              min-width: 210mm !important;
              min-height: 297mm !important;
              max-width: 210mm !important;
              max-height: 297mm !important;
              transform: none !important;
              margin: 0 auto !important;
              padding: 0 !important;
              display: block !important;
              box-shadow: none !important;
              border: none !important;
            }
            .print-sheet-wrapper:not(:last-child) {
              page-break-after: always !important;
              break-after: page !important;
            }
            .print-paper-container {
              position: relative !important;
              width: 210mm !important;
              height: 297mm !important;
              min-width: 210mm !important;
              min-height: 297mm !important;
              max-width: 210mm !important;
              max-height: 297mm !important;
              transform: none !important;
              margin: 0 auto 10mm auto !important;
              padding: ${paperPaddingY}mm ${paperPaddingX}mm !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
            }
            .print-paper-container:not(:last-child) {
              page-break-after: always !important;
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

        {showWorkspaceSkeleton ? (
          <A4SheetSkeleton
            calculatedScale={calculatedScale}
            paperPaddingX={paperPaddingX}
            paperPaddingY={paperPaddingY}
            headerFontSize={headerFontSize}
            rowPadding={rowPadding}
            tableFontSize={tableFontSize}
            t1WidthSr={t1WidthSr}
            t1WidthId={t1WidthId}
            t1WidthName={t1WidthName}
            t1WidthComments={t1WidthComments}
            t1WidthAmount={t1WidthAmount}
            t1WidthCh={t1WidthCh}
            t2WidthSr={t2WidthSr}
            t2WidthName={t2WidthName}
            t2WidthAmount={t2WidthAmount}
            t2WidthCh={t2WidthCh}
          />
        ) : (
          <>
            {/* Main Integrated Workspace (No more double screen scrolling or nested popups!) */}
            <div className="flex-1 w-full flex flex-row items-stretch overflow-hidden print:block print:p-0 print:overflow-visible print:h-auto relative">
          <AnimatePresence mode="popLayout">
          {showSizingPanel && (
            <Suspense fallback={<SizingPanelSkeleton />}>
              <SizingPanel
                rowPadding={rowPadding}
                setRowPadding={setRowPadding}
                tableFontSize={tableFontSize}
                setTableFontSize={setTableFontSize}
                headerFontSize={headerFontSize}
                setHeaderFontSize={setHeaderFontSize}
                paperPaddingY={paperPaddingY}
                setPaperPaddingY={setPaperPaddingY}
                paperPaddingX={paperPaddingX}
                setPaperPaddingX={setPaperPaddingX}
                t1WidthSr={t1WidthSr}
                setT1WidthSr={setT1WidthSr}
                t1WidthId={t1WidthId}
                setT1WidthId={setT1WidthId}
                t1WidthName={t1WidthName}
                setT1WidthName={setT1WidthName}
                t1WidthComments={t1WidthComments}
                setT1WidthComments={setT1WidthComments}
                t1WidthAmount={t1WidthAmount}
                setT1WidthAmount={setT1WidthAmount}
                t2WidthName={t2WidthName}
                setT2WidthName={setT2WidthName}
                t2WidthAmount={t2WidthAmount}
                setT2WidthAmount={setT2WidthAmount}
                onShowSaveWidthsBar={() => setShowSaveWidthsBar(true)}
                onResetSizingToDefault={resetSizingToDefault}
              />
            </Suspense>
          )}
          </AnimatePresence>

            {/* Center Area: Full Viewport Scale-to-Fit Workspace Area */}
            <div 
              ref={workspaceRef}
              className={`flex-1 flex flex-col items-center bg-slate-100 dark:bg-slate-900/40 scrollbar-none relative h-full print:bg-transparent print:p-0 print:m-0 print:block print:overflow-visible print:h-auto select-none print:select-text ${
                (zoomOption === 'fit' && !isInputFocused && focusedRowIndex === null)
                  ? 'p-2 sm:p-3 overflow-hidden justify-center' 
                  : 'p-4 sm:p-6 overflow-auto justify-start'
              }`}
            >
              {isLocked && (
                <div className="w-full max-w-[800px] bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden animate-in fade-in slide-in-from-top-2 duration-300 select-text shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
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
                      className="w-full sm:w-36 px-2.5 py-1.5 text-[9px] font-mono font-black tracking-widest bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 dark:text-white"
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
                    <div className="print-sheet-wrapper-container flex flex-row gap-6 mx-auto w-max px-2 sm:px-0 print:block print:w-auto print:h-auto print:static print:p-0 print:m-0">
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
                          key={`sh-${sh.id || sheetIdx}-${sheetIdx}`}
                          onMouseDownCapture={() => {
                            if (activeSheetIdx !== sheetIdx) {
                              switchToSheet(sheetIdx);
                            }
                          }}
                          onFocusCapture={() => {
                            if (activeSheetIdx !== sheetIdx) {
                              switchToSheet(sheetIdx);
                            }
                          }}
                          className={`print-sheet-wrapper group relative flex flex-col items-center shrink-0 print:block print:w-auto print:h-auto print:static my-auto transition-all ${
                            isActive 
                              ? `ring-2 ring-indigo-650/40 dark:ring-indigo-400/50 ring-offset-4 ring-offset-slate-100 dark:ring-offset-slate-900 rounded-lg z-10 ${zoomOption === 'fit' ? 'scale-100' : 'scale-102'}` 
                              : 'opacity-70 saturate-75 hover:opacity-95 hover:saturate-100'
                          }`}
                          style={{
                            width: `${793.7 * calculatedScale}px`,
                            height: `${(paperContainerRef.current ? Math.max(1122.5, paperContainerRef.current.scrollHeight || paperContainerRef.current.offsetHeight || 1122.5) : 1122.5) * calculatedScale}px`,
                            minWidth: `${793.7 * calculatedScale}px`,
                            minHeight: `${1122.5 * calculatedScale}px`,
                            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {/* Floating tools bar in top-right corner of sheet paper */}
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-md hover:shadow-lg border border-slate-200 dark:border-white/10 rounded-lg px-1.5 py-1 transition-all duration-200 z-[110] print:hidden select-none">
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
                              className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/45 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-505 dark:text-indigo-400 border border-slate-200 dark:border-white/10 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0.5"
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
                              className="p-1 rounded bg-rose-50 dark:bg-rose-950/45 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-505 dark:text-rose-400 border border-slate-200 dark:border-white/10 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center p-0.5"
                              title="Delete sheet (Dusbin)"
                            >
                              <Trash2 size={10} className="stroke-[2.5]" />
                            </button>
                          </div>

                          {/* A4 Paper Mockup Sheet Container */}
                          <div 
                            ref={isActive ? paperContainerRef : null}
                            style={{ 
                              paddingLeft: `${paperPaddingX}mm`, 
                              paddingRight: `${paperPaddingX}mm`, 
                              paddingTop: `${paperPaddingY}mm`, 
                              paddingBottom: `${paperPaddingY}mm`,
                              transform: `scale(${calculatedScale})`,
                              transformOrigin: 'top left',
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                            className={`print-paper-container bg-white border border-slate-350 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-lg w-[793.7px] min-h-[1122.5px] flex flex-col text-[#0f172a] font-sans print:p-0 print:m-0 print:border-none print:shadow-none print:static print:transform-none select-text overflow-visible ${isLocked ? 'pointer-events-none opacity-80 select-none' : ''}`}
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
                    className="px-1 border-r-2 border-black relative"
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
                    <ColumnDragHandle min={20} max={80} value={t1WidthSr} onChange={setT1WidthSr} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
                      className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by C.ID"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                    <ColumnDragHandle min={40} max={150} value={t1WidthId} onChange={setT1WidthId} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
                      className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Name"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                    <ColumnDragHandle min={100} max={380} value={t1WidthName} onChange={setT1WidthName} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
                      className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Comments"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                    <ColumnDragHandle min={100} max={350} value={t1WidthComments} onChange={setT1WidthComments} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
                      className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Amount"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                    <ColumnDragHandle min={50} max={180} value={t1WidthAmount} onChange={setT1WidthAmount} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
              <tbody style={{ contain: 'layout paint' }}>
                {table1Rows.map((row, index) => {
                  const isSearchResultMatch = !!(historySearchQuery.trim() && (
                    (row.cId && row.cId.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                    (row.name && row.name.toLowerCase().includes(historySearchQuery.toLowerCase())) ||
                    ((row as any).receiptCode && (row as any).receiptCode.toLowerCase().includes(historySearchQuery.toLowerCase()))
                  ));
                  return (
                    <Table1RowItem
                      key={`t1-${index}`}
                      row={row}
                      index={index}
                      rowPadding={rowPadding}
                      tableFontSize={tableFontSize}
                      t1WidthSr={t1WidthSr}
                      t1WidthId={t1WidthId}
                      t1WidthName={t1WidthName}
                      t1WidthComments={t1WidthComments}
                      t1WidthAmount={t1WidthAmount}
                      t1WidthCh={t1WidthCh}
                      isFocusedRow={focusedRowIndex === index}
                      focusedField={focusedRowIndex === index ? focusedField : null}
                      isSearchResultMatch={isSearchResultMatch}
                      isLocked={isLocked}
                      onCommitChange={handleT1Change}
                      onFocusField={handleFocusField}
                      onBlurField={handleBlurField}
                      onSearchQueryChange={handleSearchQueryChange}
                    />
                  );
                })}

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
                    style={{ width: `${t2WidthSr}px`, paddingTop: `${Math.max(1, rowPadding - 2.5)}px`, paddingBottom: `${Math.max(1, rowPadding - 2.5)}px`, fontSize: `${tableFontSize}px` }} 
                    className="px-1 border-r-2 border-black relative"
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
                    <ColumnDragHandle min={20} max={80} value={t2WidthSr} onChange={setT2WidthSr} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
                      className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Name"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                    <ColumnDragHandle min={150} max={550} value={t2WidthName} onChange={setT2WidthName} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
                      className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black hover:bg-slate-200 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="Sort by Amount"
                    >
                      <ArrowUpDown className="w-2.5 h-2.5" />
                    </button>
                    <ColumnDragHandle min={50} max={250} value={t2WidthAmount} onChange={setT2WidthAmount} onDragEnd={() => setShowSaveWidthsBar(true)} />
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
              <tbody style={{ contain: 'layout paint' }}>
                {table2Rows.map((row, index) => (
                  <Table2RowItem
                    key={`t2-${index}`}
                    row={row}
                    index={index}
                    rowPadding={rowPadding}
                    tableFontSize={tableFontSize}
                    t2WidthSr={t2WidthSr}
                    t2WidthName={t2WidthName}
                    t2WidthAmount={t2WidthAmount}
                    isLocked={isLocked}
                    onCommitChange={handleT2Change}
                  />
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
 
                          </div> {/* print-paper-container ends */}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })()}
            </div> {/* center scale workspace ends */}
            </div> {/* Main Integrated Workspace ends */}
          </>
        )}

        {/* Receipt Swipe Left Panel on the right */}
        <AnimatePresence onExitComplete={() => setReceiptPanelReady(false)}>
          {isReceiptSwipeOpen && (
            <Suspense fallback={<ReceiptPreviewPanelSkeleton />}>
              <ReceiptPreviewPanel
                receiptPanelReady={receiptPanelReady}
                setReceiptPanelReady={setReceiptPanelReady}
                onClose={handleCloseReceiptPanel}
                onHold={handleHoldReceipt}
                lastSavedEntry={lastSavedEntry}
                multiSavedEntries={multiSavedEntries}
                previewItemsData={previewItemsData}
                receiptConfig={receiptConfig}
                getOutstandingPaymentForEntry={getOutstandingPaymentForEntry}
                currentReceiptCode={currentReceiptCode}
                onRegenerateReceiptCode={handleRegenerateReceiptCode}
                onSaveReceiptCode={saveReceiptCodeToDb}
              />
            </Suspense>
          )}
        </AnimatePresence>

      {/* Floating Manual Receipt Button (Left Side) */}
      <AnimatePresence>
        <motion.div
          {...dialogMotion}
          className="transform-gpu will-change-transform fixed bottom-6 left-6 z-[300] print:hidden text-left"
        >
          <button
            onClick={() => {
              setSelectedReceiptIndices([]);
              setShowReceiptSelectionPopup(true);
            }}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-wider text-[11px] rounded-2xl shadow-2xl transition-all duration-150 active:scale-95 border-none cursor-pointer"
          >
            <Printer size={15} />
            <span>Receipt</span>
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Floating Pending Receipt Badge */}
      <AnimatePresence>
        {isPendingReceipt && (
          <motion.div
            {...dialogMotion}
            className="transform-gpu will-change-transform fixed bottom-6 right-6 z-[300] print:hidden text-left"
          >
            <button
              onClick={() => {
                setIsReceiptSwipeOpen(true);
                setIsPendingReceipt(false);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-wider text-[11px] rounded-2xl shadow-2xl transition-all duration-150 active:scale-95 border-none cursor-pointer"
            >
              <Printer size={15} />
              <span>Pending Receipt</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Financial Ledger Sheets Registry & Backup Sidebar Panel on the right */}
        <AnimatePresence>
          {showHistoryPanel && (
            <Suspense fallback={<HistoryPanelSkeleton />}>
              <HistoryPanel
                onClose={handleCloseHistoryPanel}
                historySearchQuery={historySearchQuery}
                setHistorySearchQuery={setHistorySearchQuery}
                backupTokens={backupTokens}
                setBackupTokens={setBackupTokens}
                backupSpreadsheetId={backupSpreadsheetId}
                setBackupSpreadsheetId={setBackupSpreadsheetId}
                isBackingUp={isBackingUp}
                onConnectBackupAccount={handleConnectBackupAccount}
                onCreateBackupSheet={handleCreateBackupSheet}
                onBackupLedgerHistory={handleBackupLedgerHistory}
                onTerminateMonth={handleTerminateMonth}
                ledgerHistory={ledgerHistory}
                loadedSheetId={loadedSheetId}
                onLoadHistorySheet={handleLoadHistorySheet}
                onDeleteHistorySheet={handleDeleteHistorySheet}
              />
            </Suspense>
          )}
        </AnimatePresence>

      {/* Beautiful Reset & Purge Confirmation Modal */}
      <AnimatePresence>
        {/* Duplicate Entry Warning Modal */}
        {duplicateWarning && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              {...dialogMotion}
              className="transform-gpu will-change-transform bg-white border-2 border-rose-500 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col"
            >
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full -mr-20 -mt-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.14) 0%, transparent 70%)' }}
              />
              
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
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              {...dialogMotion}
              className="transform-gpu will-change-transform bg-white dark:bg-slate-900 border border-slate-205 dark:border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden text-left"
            >
              <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-100 dark:border-emerald-900/50">
                    <Sparkles size={20} className="text-emerald-500" />
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
                <DeferredBody fallback={<SkTable rows={4} cols={4} className="min-h-[280px]" />}>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  FOUND {userSearchResults.length} LEDGER {userSearchResults.length === 1 ? 'SHEET' : 'SHEETS'} CONTAINER IN SYSTEM MEMORY:
                </p>

                {userSearchResults.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
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
                      const targetFolderId = sh.folderId || sheetFolderMap[sh.id];
                      const folderName = targetFolderId 
                        ? (folders.find(f => f.id === targetFolderId)?.name || "Uncategorized")
                        : "Uncategorized";

                      return (
                        <div
                          key={`res-${sh.id}-${idx}`}
                          className="p-5 bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/80 dark:border-white/10 rounded-2.5xl hover:border-slate-300 dark:hover:border-slate-750 transition-all space-y-4 text-left"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-105 dark:border-white/10">
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
                          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
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
                                    className="border-b border-slate-100/60 dark:border-white/10 last:border-none font-bold text-slate-750 dark:text-slate-100"
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
                </DeferredBody>
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2 bg-slate-100/10 dark:bg-slate-900/20 shrink-0">
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
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              {...dialogMotion}
              className="transform-gpu will-change-transform bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2.5xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden text-left"
            >
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 shrink-0">
                    <AlertCircle size={20} className="text-rose-500" />
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
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-1">
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

        {sheetToDeleteId && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              {...dialogMotion}
              className="transform-gpu will-change-transform bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2.5xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden text-left"
            >
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 shrink-0">
                    <Trash2 size={20} className="text-rose-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-rose-500 font-mono">
                      DELETE RECOVERY SHEET
                    </h4>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Move Card to Recycle Bin?
                    </h3>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                  <p className="uppercase text-[9px] font-bold text-slate-400">
                    Details of target card:
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-1">
                    {(() => {
                      const itemObj = ledgerHistory.find(s => s.id === sheetToDeleteId);
                      return (
                        <>
                          <p className="font-extrabold text-[#0f172a] dark:text-slate-200 uppercase text-[10px] tracking-wide">
                            Officer: <span className="text-blue-500">{itemObj?.recOfficer || 'Unnamed'}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold leading-normal uppercase">
                            Date: {itemObj?.sheetDate}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold leading-normal uppercase">
                            Area: {itemObj?.area || 'MAIN'}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={confirmDeleteHistorySheet}
                    className="w-full py-2 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-rose-550/15 border-none text-center"
                  >
                    🗑️ Move to Recycle Bin
                  </button>

                  <button
                    onClick={() => setSheetToDeleteId(null)}
                    className="w-full py-1.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer border border-slate-200 dark:border-slate-700 text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showTerminateMonthModal && (
          <TerminateMonthModal
            sheetCount={ledgerHistory.length}
            onConfirm={confirmTerminateMonth}
            onCancel={handleCancelTerminateMonth}
          />
        )}

        {/* Folder Settings Popup */}
        {settingsFolderId && (
          <FolderSettingsModal
            editFolderName={editFolderName}
            setEditFolderName={setEditFolderName}
            editConnectedMonthId={editConnectedMonthId}
            setEditConnectedMonthId={setEditConnectedMonthId}
            monthsList={effectiveMonthsList && effectiveMonthsList.length > 0 ? effectiveMonthsList : billingMonths}
            onClose={handleCloseFolderSettings}
            onSave={handleSaveFolderSettings}
          />
        )}

        {folderToDeleteId && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-[99999]"
            onClick={() => setFolderToDeleteId(null)}
          >
            <motion.div
              {...dialogMotion}
              onClick={(e) => e.stopPropagation()}
              className="transform-gpu will-change-transform w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-white/10 space-y-6"
            >
              <div className="flex items-center gap-4 text-rose-500 dark:text-rose-450">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                  <Trash2 size={24} className="stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white">
                    Confirm Folder Deletion
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    Move Directory to Recycle Bin
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete this folder?
                </p>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-450">Folder Name:</span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">
                      {folders.find(f => f.id === folderToDeleteId)?.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-500 font-semibold leading-relaxed">
                    ⚠️ Sheets inside this folder will automatically become "Uncategorized", but will not be deleted.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setFolderToDeleteId(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteFolder}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-rose-500/10 active:scale-[0.98]"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showMultiSlipConfirm && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              {...dialogMotion}
              className="transform-gpu will-change-transform bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2.5xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden text-left"
            >
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500 shrink-0">
                    <Printer size={20} className="text-indigo-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-500 font-mono">
                      Multi Slip Request
                    </h4>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider leading-snug">
                      Entry main new users multi slip chahiya?
                    </h3>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  You have entered {pendingActiveRows.length} users. Yes will generate a multi-user slip (up to 4) on the receipt panel, and No will skip generating the receipt.
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setMultiSavedEntries(pendingActiveRows);
                      if (pendingActiveRows.length > 0) {
                        setLastSavedEntry(pendingActiveRows[pendingActiveRows.length - 1]);
                      }
                      setIsReceiptSwipeOpen(true);
                      setIsPendingReceipt(false);
                      setShowMultiSlipConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer border-none shadow-md shadow-indigo-600/20"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => {
                      setShowMultiSlipConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer border-none"
                  >
                    No
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReceiptSelectionPopup && (
          <motion.div
            {...overlayMotion}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              {...dialogMotion}
              className="transform-gpu will-change-transform bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2.5xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm w-full overflow-hidden text-left flex flex-col max-h-[80vh]"
            >
              <div className="p-5 pb-3 border-b border-slate-100 dark:border-white/10 flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500 shrink-0">
                  <Printer size={20} className="text-emerald-500" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-500 font-mono">
                    Select Users
                  </h4>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider leading-snug">
                    Generate Receipt
                  </h3>
                </div>
                <button
                  onClick={() => setShowReceiptSelectionPopup(false)}
                  className="ml-auto p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-xl transition-all cursor-pointer border-none"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 scrollbar-thin">
                {(() => {
                  const availableRows = table1Rows
                    .map((r, i) => ({ ...r, originalIndex: i }))
                    .filter(r => (r.name || '').trim() && (Number(r.amount) || 0) > 0);
                    
                  if (availableRows.length === 0) {
                    return <div className="text-xs text-slate-500 py-4 text-center">No active users in current entry.</div>;
                  }

                  return availableRows.map((r, idx) => {
                    const isSelected = selectedReceiptIndices.includes(r.originalIndex);
                    return (
                      <div 
                        key={r.originalIndex}
                        onClick={() => {
                          setSelectedReceiptIndices(prev => {
                            if (prev.includes(r.originalIndex)) {
                              return prev.filter(i => i !== r.originalIndex);
                            }
                            if (prev.length >= 4) {
                              toast.error("You can select a maximum of 4 users.");
                              return prev;
                            }
                            return [...prev, r.originalIndex];
                          });
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border ${isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50'} cursor-pointer transition-colors`}
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden pr-3">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{r.name}</span>
                          {r.comments && <span className="text-[10px] text-slate-500 truncate">{r.comments}</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">Rs. {Number(r.amount).toLocaleString()}</span>
                          <div className={`w-4 h-4 rounded shadow-inner flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
                            {isSelected && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3"><path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-white/10">
                <button
                  onClick={() => {
                    if (selectedReceiptIndices.length === 0) {
                      toast.error("Please select at least 1 user.");
                      return;
                    }
                    
                    const selectedData = selectedReceiptIndices.map(idx => {
                      const row = table1Rows[idx];
                      return {
                        name: (row.name || '').trim(),
                        amount: Number(row.amount) || 0,
                        comments: (row.comments || '').trim(),
                        originalIndex: idx,
                        cId: row.cId,
                        clientUsername: row.clientUsername,
                        clientId: row.clientId
                      };
                    });
                    
                    setPendingActiveRows(selectedData);
                    setMultiSavedEntries(selectedData);
                    if (selectedData.length > 0) {
                      setLastSavedEntry(selectedData[selectedData.length - 1]);
                    }
                    
                    setCurrentReceiptCode(Math.random().toString(36).substring(2, 12).toUpperCase());
                    setShowReceiptSelectionPopup(false);
                    setIsReceiptSwipeOpen(true);
                    setIsPendingReceipt(false);
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-xs transition-all cursor-pointer border-none shadow-md shadow-emerald-500/20"
                >
                  Okay ({selectedReceiptIndices.length} Selected)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SuggestionsDropdown
        ref={suggestionsDropdownRef}
        focusedRowIndex={focusedRowIndex}
        focusedField={focusedField}
        hasActiveInput={Boolean(activeInputElement)}
        suggestionsIndex={suggestionsIndex}
        activeRows={activeRows}
        dropdownContainerRef={dropdownContainerRef}
        onSelectSuggestion={handleSelectSuggestion}
      />
      
      {showSaveWidthsBar && (
        <div className="fixed bottom-6 right-6 z-[350] bg-white dark:bg-slate-800 shadow-xl border-2 border-brand-accent rounded-lg p-3 flex items-center gap-4 animate-in slide-in-from-bottom-5 print:hidden">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Unsaved column width changes</span>
          <button 
            onClick={saveColumnWidths}
            disabled={savingWidths}
            className="px-4 py-1.5 bg-brand-accent text-white rounded font-bold hover:bg-brand-accent/90 disabled:opacity-50 flex items-center gap-2"
          >
            {savingWidths ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      )}
          </>
        )}
      </motion.div>
    </>,
    document.body
  );
}