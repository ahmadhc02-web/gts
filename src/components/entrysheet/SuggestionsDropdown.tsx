import React, { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { motion } from 'motion/react';
import { dropdownMotion } from '../../lib/motionPresets';

export interface SuggestionsDropdownHandle {
  setSearchState: (query: string, hasTyped: boolean) => void;
}

export interface SuggestionsDropdownProps {
  focusedRowIndex: number | null;
  focusedField: 'cId' | 'name' | 'amount' | null;
  hasActiveInput: boolean;
  suggestionsIndex: any[];
  activeRows: any[];
  dropdownContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectSuggestion: (rowIndex: number, client: any) => void;
}

const getStatusBadge = (statusKey: string | undefined) => {
  const s = (statusKey || 'active').toLowerCase();
  switch (s) {
    case 'paid':
      return {
        label: 'Paid',
        class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
      };
    case 'partial':
      return {
        label: 'Partial',
        class: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
      };
    case 'unpaid':
      return {
        label: 'Unpaid',
        class: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
      };
    case 'dc':
      return {
        label: 'DC',
        class: 'bg-slate-100 text-slate-700 dark:bg-slate-850 dark:text-slate-400 border-slate-200 dark:border-white/10',
      };
    case 'tdc':
      return {
        label: 'TDC',
        class: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
      };
    case 'next':
      return {
        label: 'Next',
        class: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/60',
      };
    default:
      return {
        label: 'Active',
        class: 'bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-350 border-slate-150 dark:border-white/10',
      };
  }
};

export const SuggestionsDropdown = React.memo(
  forwardRef<SuggestionsDropdownHandle, SuggestionsDropdownProps>(
    (
      {
        focusedRowIndex,
        focusedField,
        hasActiveInput,
        suggestionsIndex,
        activeRows,
        dropdownContainerRef,
        onSelectSuggestion,
      },
      ref
    ) => {
      const [searchQuery, setSearchQuery] = useState('');
      const [hasTypedSinceFocus, setHasTypedSinceFocus] = useState(false);

      useImperativeHandle(
        ref,
        () => ({
          setSearchState: (query: string, hasTyped: boolean) => {
            setSearchQuery(query);
            setHasTypedSinceFocus(hasTyped);
          },
        }),
        []
      );

      const activeRowLookup = useMemo(() => {
        const byUsername = new Map<string, any>();
        const byClientId = new Map<string, any>();
        if (!activeRows) return { byUsername, byClientId };
        for (let i = 0; i < activeRows.length; i++) {
          const r = activeRows[i];
          if (!r) continue;
          if (r.username) byUsername.set(String(r.username).toLowerCase(), r);
          if (r.clientId) byClientId.set(String(r.clientId).toLowerCase(), r);
        }
        return { byUsername, byClientId };
      }, [activeRows]);

      const filteredSuggestions = useMemo(() => {
        if (focusedRowIndex === null || focusedField === null) return [];
        let q = searchQuery.trim().toLowerCase();
        if (q.startsWith('@')) {
          q = q.substring(1);
        }
        const isShowingCurrentValue = !hasTypedSinceFocus;
        if (!q || isShowingCurrentValue) {
          return suggestionsIndex.slice(0, 8);
        }

        const startsWithMatches: any[] = [];
        const containsMatches: any[] = [];

        for (let i = 0; i < suggestionsIndex.length; i++) {
          const c = suggestionsIndex[i];
          const name = c._lowerName || '';
          const username = c._lowerUsername || '';
          const id = c._lowerId || '';

          if (name.startsWith(q) || username.startsWith(q)) {
            startsWithMatches.push(c);
            if (startsWithMatches.length >= 8) {
              return startsWithMatches;
            }
          } else if (name.includes(q) || username.includes(q) || id.includes(q)) {
            containsMatches.push(c);
          }
        }

        return startsWithMatches.concat(containsMatches).slice(0, 8);
      }, [suggestionsIndex, searchQuery, hasTypedSinceFocus, focusedRowIndex, focusedField]);

      if (focusedRowIndex === null || focusedField === null || !hasActiveInput) {
        return null;
      }

      return (
        <motion.div
          ref={dropdownContainerRef}
          {...dropdownMotion}
          style={{ position: 'fixed', zIndex: 1000000 }}
          className="transform-gpu fixed bg-white/95 dark:bg-slate-900/95 sm:backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_-15px_rgba(0,0,0,0.5)] rounded-2xl p-2 max-h-72 overflow-y-auto print:hidden font-sans pointer-events-auto text-slate-900 dark:text-slate-100 scrollbar-thin z-[1000000]"
        >
          <div className="flex items-center justify-between text-[8.5px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-555 px-3 py-2 mb-1.5 border-b border-slate-100 dark:border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              Select Customer Entry
            </span>
            <span className="text-indigo-500 font-mono font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
              {filteredSuggestions.length} Found
            </span>
          </div>
          {filteredSuggestions.length === 0 ? (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 py-6 text-center font-medium">
              No matching accounts found
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSuggestions.map((cObj, idx) => {
                const uLower = cObj.username ? String(cObj.username).toLowerCase() : '';
                const idLower = cObj.id ? String(cObj.id).toLowerCase() : '';
                const matchingActiveRow =
                  (uLower ? activeRowLookup.byUsername.get(uLower) : undefined) ||
                  (idLower ? activeRowLookup.byClientId.get(idLower) : undefined);

                let userTotalAmt = 0;
                if (matchingActiveRow) {
                  userTotalAmt =
                    Number(matchingActiveRow.totalAmount) ||
                    (Number(matchingActiveRow.baseAmount) || 0) + (Number(matchingActiveRow.cr) || 0);
                }
                if (!userTotalAmt && (cObj.totalAmount || cObj.baseAmount)) {
                  userTotalAmt =
                    Number(cObj.totalAmount) ||
                    (Number(cObj.baseAmount) || 0) + (Number(cObj.cr) || 0);
                }
                if (!userTotalAmt && cObj.pkgDetails) {
                  const match =
                    String(cObj.pkgDetails).match(
                      /\b(1000|1200|1500|2000|2500|3000|3500|4000|5000|150|200|250|300|350|400|450|500|600|700|800|900)\b/
                    ) || String(cObj.pkgDetails).match(/\b\d{3,4}\b/);
                  userTotalAmt = match ? parseInt(match[0], 10) : 0;
                }

                const statusObj = getStatusBadge(matchingActiveRow?.paymentStatus);
                return (
                  <button
                    key={`cobj-${cObj.id || cObj.username || idx}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => onSelectSuggestion(focusedRowIndex, cObj)}
                    className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60 transition-all duration-200 ease-out group cursor-pointer select-none"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {cObj.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 rounded-sm">
                          @{cObj.username || cObj.id}
                        </span>
                        {cObj.area && <span>• {cObj.area}</span>}
                        {cObj.pkgDetails && (
                          <span className="text-slate-400 dark:text-slate-500 truncate">
                            ({cObj.pkgDetails})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none mb-0.5">
                          T. Amount
                        </span>
                        <span className="text-[12px] font-mono font-black text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 group-hover:scale-105 transition-transform origin-right leading-none">
                          <span className="text-[9px] text-emerald-500/70 mr-0.5">Rs.</span>
                          {userTotalAmt.toLocaleString()}
                        </span>
                      </div>

                      <div
                        className={`flex items-center justify-center min-w-[50px] h-6 text-[9px] font-black px-2 rounded-lg border uppercase tracking-wider ${statusObj.class} shadow-sm group-hover:shadow transition-all`}
                      >
                        {statusObj.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      );
    }
  )
);
SuggestionsDropdown.displayName = 'SuggestionsDropdown';
