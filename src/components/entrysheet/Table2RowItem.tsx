import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Table2Row } from './types';
import { logPerf } from './storageCache';

export interface Table2RowItemProps {
  row: Table2Row;
  index: number;
  rowPadding: number;
  tableFontSize: number;
  t2WidthSr: number;
  t2WidthName: number;
  t2WidthAmount: number;
  isLocked: boolean;
  onCommitChange: (index: number, field: keyof Table2Row, value: any) => void;
}

export const Table2RowItem = React.memo(({
  row,
  index,
  rowPadding,
  tableFontSize,
  isLocked,
  onCommitChange,
}: Table2RowItemProps) => {
  const [localRow, setLocalRow] = useState(row);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<Table2Row>>({});
  const isEditingRef = useRef(false);

  useEffect(() => {
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
  }, [row.sr, row.name, row.amount, row.ch]);

  const flushCommit = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingRef.current;
    if (Object.keys(pending).length > 0) {
      for (const [k, v] of Object.entries(pending)) {
        onCommitChange(index, k as keyof Table2Row, v);
      }
      pendingRef.current = {};
    }
  }, [index, onCommitChange]);

  const handleFieldChange = (field: keyof Table2Row, val: any) => {
    if (isLocked) return;
    const start = performance.now();
    setLocalRow(prev => ({ ...prev, [field]: val }));
    pendingRef.current[field] = val;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushCommit();
    }, 250);

    logPerf(`typing table2 (${field})`, start);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      flushCommit();
    }
  };

  return (
    <tr className="border-b border-slate-400 font-mono">
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

      {/* Name */}
      <td
        style={{ paddingTop: `${rowPadding}px`, paddingBottom: `${rowPadding}px`, fontSize: `${tableFontSize}px` }}
        className="px-3 border-r border-black font-sans text-slate-800 font-extrabold uppercase select-text"
      >
        <input
          type="text"
          value={localRow.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          onFocus={() => {
            isEditingRef.current = true;
          }}
          onBlur={() => {
            flushCommit();
            isEditingRef.current = false;
          }}
          onKeyDown={handleKeyDown}
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
          value={localRow.amount === 0 ? '' : localRow.amount}
          placeholder="0"
          onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
          onBlur={flushCommit}
          onKeyDown={handleKeyDown}
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
Table2RowItem.displayName = 'Table2RowItem';
