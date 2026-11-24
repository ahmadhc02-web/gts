import React from 'react';
import { SkBar, SkCircle } from './Skeleton';

export const ComplaintRowSkeleton: React.FC = () => (
  <tr className="border-b border-slate-300/30 dark:border-white/5 relative overflow-hidden group">
    {/* CLIENT & CONTACT */}
    <td className="px-6 py-4.5 relative overflow-hidden bg-white dark:bg-transparent">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-[sk-sweep_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-[var(--sk-hi-neu,rgba(255,255,255,0.55))] to-transparent will-change-transform"
      />
      <div className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-md bg-slate-300/60 dark:bg-white/10" />
      <div className="flex items-center gap-3.5 pl-1.5">
        <div className="shrink-0 w-10 h-10 rounded-xl neu-inset border border-white/40 dark:border-white/5 flex items-center justify-center">
          <SkCircle size="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <SkBar w="w-40" h="h-4" />
          <SkBar w="w-28" h="h-3" />
        </div>
      </div>
    </td>

    {/* CATEGORY */}
    <td className="px-6 py-4.5">
      <div className="px-2.5 py-1 rounded-lg neu-raised border border-white/40 dark:border-white/5 w-max">
        <SkBar w="w-20" h="h-3.5" />
      </div>
    </td>

    {/* USER ID & SECTOR */}
    <td className="px-6 py-4.5">
      <div className="flex flex-col gap-1.5">
        <div className="px-2.5 py-1 rounded-lg neu-inset border border-white/30 dark:border-white/5 w-max">
          <SkBar w="w-24" h="h-3.5" />
        </div>
        <SkBar w="w-20" h="h-2.5" />
      </div>
    </td>

    {/* ISSUE DETAILS */}
    <td className="px-6 py-4.5">
      <div className="flex flex-col gap-1.5 max-w-[280px]">
        <div className="px-2 py-0.5 rounded neu-inset border border-white/30 dark:border-white/5 w-36">
          <SkBar w="w-28" h="h-3" />
        </div>
        <SkBar w="w-52" h="h-3" />
      </div>
    </td>

    {/* PRIORITY */}
    <td className="px-4 py-4.5 text-center">
      <div className="flex flex-col items-center justify-center gap-1 neu-raised p-1.5 rounded-xl border border-white/40 dark:border-white/5 w-max mx-auto">
        <SkCircle size="w-3.5 h-3.5" />
        <SkBar w="w-12" h="h-2.5" />
      </div>
    </td>

    {/* STATUS */}
    <td className="px-6 py-4.5">
      <div className="flex items-center gap-2 justify-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full neu-raised border border-white/40 dark:border-white/5">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          <SkBar w="w-20" h="h-3" />
        </div>
        <SkCircle size="w-7 h-7" />
      </div>
    </td>

    {/* DATES */}
    <td className="px-6 py-4.5 text-right font-sans">
      <div className="flex flex-col items-end gap-1">
        <SkBar w="w-20" h="h-3.5" className="ml-auto" />
        <SkBar w="w-14" h="h-2.5" className="ml-auto" />
      </div>
    </td>

    {/* ACTIONS */}
    <td className="px-6 py-4.5 text-right">
      <div className="flex justify-end gap-2">
        <div className="w-8 h-8 rounded-xl neu-btn flex items-center justify-center">
          <SkBar w="w-3.5" h="h-3.5" rounded="rounded" />
        </div>
        <div className="w-8 h-8 rounded-xl neu-btn flex items-center justify-center">
          <SkBar w="w-3.5" h="h-3.5" rounded="rounded" />
        </div>
      </div>
    </td>
  </tr>
);

export const ComplaintPopupSkeleton: React.FC = () => (
  <div className="visible absolute inset-0 z-50 rounded-[32px] bg-[var(--neu-surface,#f2f4f7)] dark:bg-[var(--neu-surface,#2b2d33)] border border-[var(--neu-border,rgba(255,255,255,0.9))] dark:border-slate-700 p-5 sm:p-7 md:p-9 flex flex-col justify-between shadow-2xl transition-opacity duration-150 overflow-hidden">
    {/* Sweep overlay */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -translate-x-full animate-[sk-sweep_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-[var(--sk-hi-neu,rgba(255,255,255,0.55))] to-transparent"
    />

    <div className="space-y-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <SkBar w="w-40" h="h-6" />
          <SkBar w="w-24" h="h-6" rounded="rounded-full" />
        </div>
        <SkCircle size="w-8 h-8" />
      </div>

      {/* 4-cell info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1.5 neu-inset">
            <SkBar w="w-16" h="h-2.5" />
            <SkBar w="w-24" h="h-4" />
          </div>
        ))}
      </div>

      {/* 12-column grid: left chat-thread (7 cols) + right Admin Protocol (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-3 p-4 rounded-2xl bg-black/5 dark:bg-white/5 neu-inset">
          <SkBar w="w-32" h="h-3.5 mb-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex items-start gap-2.5 ${i % 2 === 1 ? 'justify-end' : ''}`}>
              {i % 2 === 0 && <SkCircle size="w-7 h-7" />}
              <SkBar w={i % 2 === 0 ? 'w-3/4' : 'w-2/3'} h="h-10" rounded="rounded-2xl" />
              {i % 2 === 1 && <SkCircle size="w-7 h-7" />}
            </div>
          ))}
        </div>
        <div className="lg:col-span-5 space-y-3 p-4 rounded-2xl bg-black/5 dark:bg-white/5 neu-inset">
          <SkBar w="w-28" h="h-3.5 mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkBar key={i} h="h-7" rounded="rounded-xl" />
            ))}
          </div>
          <SkBar h="h-20" rounded="rounded-xl" className="mt-3" />
        </div>
      </div>
    </div>

    {/* Footer buttons */}
    <div className="pt-4 flex items-center justify-end gap-3 border-t border-black/5 dark:border-white/5 relative z-10">
      <SkBar w="w-28" h="h-10" rounded="rounded-xl" />
      <SkBar w="w-32" h="h-10" rounded="rounded-xl" />
    </div>
  </div>
);
