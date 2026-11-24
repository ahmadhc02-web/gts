import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Table1Row } from './types';
import { logPerf } from './storageCache';

export interface Table1RowItemProps {
  row: Table1Row;
  index: number;
  rowPadding: number;
  tableFontSize: number;
  t1WidthSr: number;
  t1WidthId: number;
  t1WidthName: number;
  t1WidthComments: number;
  t1WidthAmount: number;
  t1WidthCh: number;
  isFocusedRow: boolean;
  focusedField: 'cId' | 'name' | 'amount' | null;
  isSearchResultMatch: boolean;
  isLocked: boolean;
  onCommitChange: (index: number, field: keyof Table1Row, value: any) => void;
  onFocusField: (index: number, field: 'name' | 'amount', currentVal: string, element: HTMLInputElement) => void;
  onBlurField: () => void;
  onSearchQueryChange: (val: string) => void;
}

export const Table1RowItem = React.memo(({
  row,
  index,
  rowPadding,
  tableFontSize,
  isFocusedRow,
  focusedField,
  isSearchResultMatch,
  isLocked,
  onCommitChange,
  onFocusField,
  onBlurField,
  onSearchQueryChange,
}: Table1RowItemProps) => {
  const [localRow, setLocalRow] = useState(row);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<Table1Row>>({});
  const isEditingRef = useRef(false);

  useEffect(() => {
    const isNameActive = isFocusedRow && focusedField === 'name';
    if (!isNameActive) {
      isEditingRef.current = false;
      pendingRef.current = {};
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }

    if (isEditingRef.current) {
      const hasPending = Object.keys(pendingRef.current).length > 0;
      const hasTimer = debounceTimerRef.current !== null;
      if (hasPending || hasTimer) {
        return;
      }
      if (row.name !== localRow.name) {
        setLocalRow(prev => ({
          ...row,
          name: prev.name,
        }));
        return;
      }
    }

    setLocalRow(row);
    pendingRef.current = {};
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [row.sr, row.cId, row.name, row.comments, row.amount, row.ch, row.clientUsername, row.status, isFocusedRow, focusedField]);

  const flushCommit = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingRef.current;
    if (Object.keys(pending).length > 0) {
      for (const [k, v] of Object.entries(pending)) {
        onCommitChange(index, k as keyof Table1Row, v);
      }
      pendingRef.current = {};
    }
  }, [index, onCommitChange]);

  const handleFieldChange = (field: keyof Table1Row, val: any) => {
    if (isLocked) return;
    const start = performance.now();
    setLocalRow(prev => ({ ...prev, [field]: val }));
    pendingRef.current[field] = val;

    if (field === 'name') {
      onSearchQueryChange(val);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushCommit();
    }, 250);

    logPerf(`typing (${field})`, start);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      flushCommit();
    }
  };

  return (
    <tr
      className={`border-b border-slate-405 font-mono colRow transition-all duration-250 relative ${
        isFocusedRow ? 'z-[99999]' : 'z-0'
      } ${
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
          value={localRow.sr}
          onChange={(e) => handleFieldChange('sr', e.target.value)}
          onBlur={flushCommit}
          onKeyDown={handleKeyDown}
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
          value={localRow.cId}
          onChange={(e) => handleFieldChange('cId', e.target.value)}
          onBlur={flushCommit}
          onKeyDown={handleKeyDown}
          style={{ fontSize: `${tableFontSize - 0.5}px` }}
          className="w-full min-w-0 border-none p-0 text-center text-slate-900 bg-transparent focus:bg-slate-100 font-bold tracking-tight outline-none"
        />
      </td>

      {/* Name */}
      <td
        style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
        className={`px-2 border-r border-black font-sans relative group/cell ${isFocusedRow && focusedField === 'name' ? 'z-[99999]' : ''}`}
      >
        <div className="flex items-center justify-between gap-1 w-full">
          <input
            type="text"
            value={localRow.name}
            onChange={(e) => {
              handleFieldChange('name', e.target.value);
            }}
            onFocus={(e) => {
              isEditingRef.current = true;
              onFocusField(index, 'name', localRow.name, e.currentTarget);
            }}
            onBlur={() => {
              flushCommit();
              isEditingRef.current = false;
              onBlurField();
            }}
            onKeyDown={handleKeyDown}
            style={{ fontSize: `${tableFontSize}px` }}
            className="flex-1 min-w-0 border-none p-0 text-slate-900 bg-transparent font-black tracking-tight focus:bg-slate-100 outline-none"
          />
          {(localRow.clientUsername || (localRow.cId && localRow.name)) && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const textToCopy = (localRow.clientUsername || localRow.cId || '').trim();
                if (textToCopy) {
                  navigator.clipboard?.writeText(textToCopy);
                  toast.success(`Copied: ${textToCopy}`, { duration: 2500, icon: '📋' });
                }
              }}
              title="Click to copy User ID"
              className="print:hidden text-[9px] font-black text-slate-500 hover:text-indigo-600 bg-slate-100/80 hover:bg-indigo-50 active:scale-95 dark:text-slate-400 dark:bg-slate-800 dark:hover:bg-indigo-900/40 px-1.5 py-0.5 rounded leading-none shrink-0 border border-slate-200/60 hover:border-indigo-200 dark:border-slate-700 dark:hover:border-indigo-800/60 cursor-pointer transition-all duration-200 flex items-center gap-1 select-none group/copy overflow-hidden"
            >
              <span className="truncate max-w-[60px] group-hover/copy:max-w-none transition-all duration-300">@{localRow.clientUsername || localRow.cId}</span>
              <Copy size={9} className="opacity-0 w-0 -ml-1 group-hover/copy:w-auto group-hover/copy:opacity-100 group-hover/copy:ml-0 transition-all duration-300 ease-out text-indigo-500" />
            </button>
          )}
        </div>
      </td>

      {/* Comments */}
      <td
        style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
        className="px-2 border-r border-black font-sans"
      >
        <input
          type="text"
          value={localRow.comments}
          onChange={(e) => handleFieldChange('comments', e.target.value)}
          onBlur={flushCommit}
          onKeyDown={handleKeyDown}
          style={{ fontSize: `${tableFontSize - 0.5}px` }}
          className="w-full min-w-0 border-none p-0 text-slate-600 dark:text-slate-600 bg-transparent font-semibold focus:bg-slate-100 outline-none"
        />
      </td>

      {/* Amount */}
      <td
        style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
        className={`px-2 border-r border-black text-right relative ${isFocusedRow && focusedField === 'amount' ? 'z-[99999]' : ''}`}
      >
        <input
          type="text"
          value={localRow.amount === 0 ? '' : localRow.amount}
          placeholder="0"
          onChange={(e) => handleFieldChange('amount', e.target.value)}
          onFocus={(e) => {
            onFocusField(index, 'amount', String(localRow.amount || ''), e.currentTarget);
          }}
          onBlur={() => {
            flushCommit();
            onBlurField();
          }}
          onKeyDown={handleKeyDown}
          style={{ fontSize: `${tableFontSize}px` }}
          className="w-full min-w-0 border-none p-0 text-right text-slate-900 font-black bg-transparent focus:bg-slate-100 outline-none font-mono uppercase"
        />

        {isFocusedRow && focusedField === 'amount' && (
          <div className="absolute top-[105%] right-0 w-[120px] bg-white border border-slate-350 dark:bg-slate-950 dark:border-white/10 shadow-2xl rounded-xl p-1 z-[99999] print:hidden font-sans pointer-events-auto">
            <div className="text-[8px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-555 px-2 py-1 border-b border-slate-100 dark:border-slate-900 mb-1 text-left">
              Set Status
            </div>
            {['PAID', 'UNPAID', 'TDC', 'DC', 'PARTIAL', 'EXTRA', 'NEXT'].map(st => (
              <button
                key={st}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                  }
                  pendingRef.current = {};
                  onCommitChange(index, 'amount', st);
                  onCommitChange(index, 'status', st.toLowerCase());
                  onBlurField();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                  }
                  pendingRef.current = {};
                  onCommitChange(index, 'amount', st);
                  onCommitChange(index, 'status', st.toLowerCase());
                  onBlurField();
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
            checked={!!localRow.ch}
            onChange={(e) => {
              if (isLocked) return;
              setLocalRow(prev => ({ ...prev, ch: e.target.checked }));
              onCommitChange(index, 'ch', e.target.checked);
            }}
            className="w-3.5 h-3.5 rounded border-slate-400 text-brand-accent focus:ring-brand-accent cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
});
Table1RowItem.displayName = 'Table1RowItem';
