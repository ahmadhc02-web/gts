import React from 'react';
import { SkBar, SkCircle, SkFrame } from '../skeleton/Skeleton';

export const FoldersGridSkeleton: React.FC = React.memo(() => (
  <div className="mt-1">
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2.5 sm:gap-3">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="p-3 bg-transparent rounded-2xl flex flex-col items-center justify-start text-center gap-1.5 min-h-[170px]"
        >
          <div className="relative w-28 h-18 flex items-center justify-center shrink-0">
            <div className="sk-bar w-24 h-14 rounded-lg" />
          </div>
          <div className="w-full flex flex-col items-center gap-1.5 mt-1">
            <SkBar w="w-20" h="h-3.5" rounded="rounded-md" />
            <SkBar w="w-16" h="h-3" rounded="rounded-full" />
            <SkBar w="w-14" h="h-2.5" rounded="rounded-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
));
FoldersGridSkeleton.displayName = 'FoldersGridSkeleton';

export const SheetListSkeleton: React.FC = React.memo(() => (
  <div className="flex flex-col gap-6 text-left">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkFrame
          key={i}
          className="p-5 rounded-3xl flex flex-col justify-between gap-5 min-h-[196px]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <SkBar w="w-10" h="h-10" rounded="rounded-2xl" />
              <div className="space-y-2 flex-1">
                <SkBar w="w-28" h="h-3.5" />
                <SkBar w="w-20" h="h-2.5" />
              </div>
            </div>
            <SkBar w="w-16" h="h-5" rounded="rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-white/10">
            <div className="space-y-1.5">
              <SkBar w="w-14" h="h-2" />
              <SkBar w="w-16" h="h-3" />
            </div>
            <div className="space-y-1.5">
              <SkBar w="w-16" h="h-2" />
              <SkBar w="w-14" h="h-3" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SkBar w="flex-1" h="h-8" rounded="rounded-xl" />
            <SkBar w="w-20" h="h-8" rounded="rounded-xl" />
            <SkBar w="w-8" h="h-8" rounded="rounded-xl" />
          </div>
        </SkFrame>
      ))}
    </div>
  </div>
));
SheetListSkeleton.displayName = 'SheetListSkeleton';

export interface A4SheetSkeletonProps {
  calculatedScale: number;
  paperPaddingX: number;
  paperPaddingY: number;
  headerFontSize: number;
  rowPadding: number;
  tableFontSize: number;
  t1WidthSr: number;
  t1WidthId: number;
  t1WidthName: number;
  t1WidthComments: number;
  t1WidthAmount: number;
  t1WidthCh: number;
  t2WidthSr: number;
  t2WidthName: number;
  t2WidthAmount: number;
  t2WidthCh: number;
}

export const A4SheetSkeleton: React.FC<A4SheetSkeletonProps> = React.memo(({
  calculatedScale,
  paperPaddingX,
  paperPaddingY,
  headerFontSize,
  rowPadding,
  tableFontSize,
  t1WidthSr,
  t1WidthId,
  t1WidthName,
  t1WidthComments,
  t1WidthAmount,
  t1WidthCh,
  t2WidthSr,
  t2WidthName,
  t2WidthAmount,
  t2WidthCh,
}) => {
  const rowHeightPx = Math.max(22, Math.round(rowPadding * 2 + tableFontSize * 1.25));
  const headerHeightPx = Math.max(22, Math.round(Math.max(1, rowPadding - 2.5) * 2 + tableFontSize * 1.25));

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900/40 p-2 sm:p-3 overflow-hidden h-full select-none">
      <div className="flex flex-row justify-start sm:justify-center gap-6 overflow-x-auto min-w-full items-start pb-2 pt-2 my-auto">
        <div className="flex flex-row gap-6 mx-auto w-max px-2 sm:px-0">
          <div
            className="relative flex flex-col items-center shrink-0 my-auto"
            style={{
              width: `${793.7 * calculatedScale}px`,
              height: `${1122.5 * calculatedScale}px`,
              minWidth: `${793.7 * calculatedScale}px`,
              minHeight: `${1122.5 * calculatedScale}px`,
            }}
          >
            <div
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
                contain: 'layout paint',
              }}
              className="bg-white border border-slate-300 shadow-[0_15px_50px_rgba(0,0,0,0.12)] rounded-lg w-[793.7px] min-h-[1122.5px] flex flex-col"
            >
              {/* Header Fields Skeleton (matches OFFICER, AREA, DATE widths) */}
              <div className="flex flex-row flex-wrap justify-start items-center gap-x-8 gap-y-3 border-b-2 border-slate-200 pb-4">
                <div
                  style={{ width: `${260 * (headerFontSize / 13)}px` }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <SkBar w="w-20" h="h-3" />
                  <SkBar w="flex-1" h="h-5" />
                </div>
                <div
                  style={{ width: `${140 * (headerFontSize / 13)}px` }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <SkBar w="w-11" h="h-3" />
                  <SkBar w="flex-1" h="h-5" />
                </div>
                <div
                  style={{ width: `${170 * (headerFontSize / 13)}px` }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <SkBar w="w-11" h="h-3" />
                  <SkBar w="flex-1" h="h-5" />
                </div>
              </div>

              {/* Table 1 Grid Skeleton (22 real-height rows with exact column widths) */}
              <div className="mt-4 flex-1">
                <div className="w-full border-2 border-slate-300">
                  <div
                    className="flex border-b-2 border-slate-300 bg-slate-100/80"
                    style={{ height: `${headerHeightPx}px` }}
                  >
                    <div style={{ width: `${t1WidthSr}px` }} className="px-1 border-r-2 border-slate-300 flex items-center justify-center"><SkBar w="w-4" h="h-3" /></div>
                    <div style={{ width: `${t1WidthId}px` }} className="px-2 border-r border-slate-200 flex items-center justify-center"><SkBar w="w-10" h="h-3" /></div>
                    <div style={{ width: `${t1WidthName}px` }} className="px-3 border-r border-slate-200 flex items-center"><SkBar w="w-16" h="h-3" /></div>
                    <div style={{ width: `${t1WidthComments}px` }} className="px-3 border-r border-slate-200 flex items-center"><SkBar w="w-20" h="h-3" /></div>
                    <div style={{ width: `${t1WidthAmount}px` }} className="px-2 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-14" h="h-3" /></div>
                    <div style={{ width: `${t1WidthCh}px` }} className="px-1 flex items-center justify-center"><SkBar w="w-4" h="h-3" /></div>
                  </div>
                  {Array.from({ length: 22 }).map((_, rIdx) => (
                    <div
                      key={rIdx}
                      className="flex border-b border-slate-200"
                      style={{ height: `${rowHeightPx}px` }}
                    >
                      <div style={{ width: `${t1WidthSr}px` }} className="px-1 border-r-2 border-slate-300 flex items-center justify-center bg-slate-50/50"><SkBar w="w-3" h="h-2.5" /></div>
                      <div style={{ width: `${t1WidthId}px` }} className="px-2 border-r border-slate-200 flex items-center justify-center"><SkBar w="w-10" h="h-2.5" /></div>
                      <div style={{ width: `${t1WidthName}px` }} className="px-2 border-r border-slate-200 flex items-center"><SkBar w={rIdx % 2 === 0 ? 'w-3/4' : 'w-1/2'} h="h-3" /></div>
                      <div style={{ width: `${t1WidthComments}px` }} className="px-2 border-r border-slate-200 flex items-center"><SkBar w="w-2/3" h="h-2.5" /></div>
                      <div style={{ width: `${t1WidthAmount}px` }} className="px-2 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-12" h="h-3" /></div>
                      <div style={{ width: `${t1WidthCh}px` }} className="px-1 flex items-center justify-center"><SkBar w="w-3.5" h="h-3.5" rounded="rounded" /></div>
                    </div>
                  ))}
                  <div className="flex border-t-2 border-slate-300 bg-slate-100/70 h-[34px]">
                    <div className="flex-1 px-3 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-14" h="h-3" /></div>
                    <div style={{ width: `${t1WidthAmount}px` }} className="px-3 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-16" h="h-3.5" /></div>
                    <div style={{ width: `${t1WidthCh}px` }} />
                  </div>
                </div>
              </div>

              {/* Table 2 Grid Skeleton (3 real-height rows with exact column widths) */}
              <div className="mt-5">
                <div className="w-full border-2 border-slate-300">
                  <div
                    className="flex border-b-2 border-slate-300 bg-slate-100/80"
                    style={{ height: `${headerHeightPx}px` }}
                  >
                    <div style={{ width: `${t2WidthSr}px` }} className="px-1 border-r-2 border-slate-300 flex items-center justify-center"><SkBar w="w-4" h="h-3" /></div>
                    <div style={{ width: `${t2WidthName}px` }} className="px-3 border-r border-slate-200 flex items-center"><SkBar w="w-20" h="h-3" /></div>
                    <div style={{ width: `${t2WidthAmount}px` }} className="px-2 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-16" h="h-3" /></div>
                    <div style={{ width: `${t2WidthCh}px` }} className="px-1 flex items-center justify-center"><SkBar w="w-4" h="h-3" /></div>
                  </div>
                  {Array.from({ length: 3 }).map((_, rIdx) => (
                    <div
                      key={rIdx}
                      className="flex border-b border-slate-200"
                      style={{ height: `${rowHeightPx}px` }}
                    >
                      <div style={{ width: `${t2WidthSr}px` }} className="px-1 border-r-2 border-slate-300 flex items-center justify-center bg-slate-50/50"><SkBar w="w-3" h="h-2.5" /></div>
                      <div style={{ width: `${t2WidthName}px` }} className="px-3 border-r border-slate-200 flex items-center"><SkBar w="w-32" h="h-3" /></div>
                      <div style={{ width: `${t2WidthAmount}px` }} className="px-2 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-16" h="h-3" /></div>
                      <div style={{ width: `${t2WidthCh}px` }} className="px-1 flex items-center justify-center"><SkBar w="w-3.5" h="h-3.5" rounded="rounded" /></div>
                    </div>
                  ))}
                  <div className="flex border-t-2 border-slate-300 bg-slate-100/70 h-[34px]">
                    <div className="flex-1 px-3 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-14" h="h-3" /></div>
                    <div style={{ width: `${t2WidthAmount}px` }} className="px-3 border-r border-slate-200 flex items-center justify-end"><SkBar w="w-16" h="h-3.5" /></div>
                    <div style={{ width: `${t2WidthCh}px` }} />
                  </div>
                </div>
              </div>

              {/* Footer Signatures Skeleton */}
              <div className="mt-8 pt-4 border-t-2 border-slate-200 grid grid-cols-3 gap-6">
                <div className="space-y-2"><SkBar w="w-24" h="h-2.5" /><SkBar w="w-full" h="h-5" /></div>
                <div className="space-y-2 flex flex-col items-center"><SkBar w="w-16" h="h-2.5" /><SkBar w="w-full" h="h-5" /></div>
                <div className="space-y-2 flex flex-col items-end"><SkBar w="w-20" h="h-2.5" /><SkBar w="w-full" h="h-5" /></div>
              </div>

              <div className="mt-6 pt-2 border-t border-slate-100 flex items-center justify-between">
                <SkBar w="w-40" h="h-2" />
                <SkBar w="w-32" h="h-2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
A4SheetSkeleton.displayName = 'A4SheetSkeleton';

export const SizingPanelSkeleton: React.FC = React.memo(() => (
  <div className="bg-[#fdfdfd] dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 p-4 shrink-0 h-full select-none flex flex-col gap-3 w-[280px] max-lg:absolute max-lg:top-0 max-lg:bottom-0 max-lg:left-0 max-lg:w-[calc(100vw-32px)] max-lg:shadow-2xl z-[400]">
    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/10">
      <SkBar w="w-28" h="h-3.5" />
      <SkBar w="w-12" h="h-3" />
    </div>
    <SkFrame className="space-y-3 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <SkBar w="w-24" h="h-2.5" />
            <SkBar w="w-10" h="h-2.5" />
          </div>
          <SkBar w="w-full" h="h-2" />
        </div>
      ))}
    </SkFrame>
  </div>
));
SizingPanelSkeleton.displayName = 'SizingPanelSkeleton';

export const HistoryPanelSkeleton: React.FC = React.memo(() => (
  <div className="w-[380px] max-w-full shrink-0 bg-[#fafafa] dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 p-4 flex flex-col gap-4 h-full z-[400] max-lg:absolute max-lg:top-0 max-lg:bottom-0 max-lg:right-0 max-lg:shadow-2xl">
    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <SkCircle size="w-5 h-5" />
        <div className="space-y-1">
          <SkBar w="w-28" h="h-3.5" />
          <SkBar w="w-36" h="h-2.5" />
        </div>
      </div>
      <SkBar w="w-6" h="h-6" rounded="rounded-lg" />
    </div>
    <SkBar w="w-full" h="h-9" rounded="rounded-xl" />
    <SkFrame className="flex-1 min-h-[380px] p-3.5 space-y-3">
      <SkBar w="w-40" h="h-3" />
      <SkBar w="w-full" h="h-8" rounded="rounded-lg" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkBar key={i} w="w-full" h="h-16" rounded="rounded-xl" />
        ))}
      </div>
    </SkFrame>
  </div>
));
HistoryPanelSkeleton.displayName = 'HistoryPanelSkeleton';

export const ReceiptCardSkeleton: React.FC = React.memo(() => (
  <SkFrame className="w-[320px] min-h-[380px] p-6 rounded-md space-y-4">
    <div className="flex flex-col items-center gap-1.5">
      <SkBar w="w-44" h="h-4" />
      <SkBar w="w-36" h="h-2.5" />
    </div>
    <SkBar w="w-full" h="h-12" rounded="rounded-lg" />
    <SkBar w="w-full" h="h-7" rounded="rounded-sm" />
    <div className="space-y-3 pt-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <SkBar w="w-32" h="h-3" />
          <SkBar w="w-16" h="h-3" />
        </div>
      ))}
    </div>
    <div className="flex justify-end pt-3">
      <SkBar w="w-24" h="h-4" />
    </div>
  </SkFrame>
));
ReceiptCardSkeleton.displayName = 'ReceiptCardSkeleton';

export const ReceiptPreviewPanelSkeleton: React.FC = React.memo(() => (
  <div className="absolute right-0 top-0 h-full w-[380px] max-w-full z-[400] shadow-2xl bg-[#fafafa] dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 p-4 flex flex-col gap-4">
    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
      <div className="flex items-center gap-2">
        <SkCircle size="w-5 h-5" />
        <div className="space-y-1">
          <SkBar w="w-28" h="h-3.5" />
          <SkBar w="w-32" h="h-2.5" />
        </div>
      </div>
      <SkBar w="w-12" h="h-6" rounded="rounded-xl" />
    </div>
    <div className="flex-1 flex flex-col items-center justify-center py-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-white/10">
      <ReceiptCardSkeleton />
    </div>
  </div>
));
ReceiptPreviewPanelSkeleton.displayName = 'ReceiptPreviewPanelSkeleton';

export const ModalDialogSkeleton: React.FC<{ className?: string }> = React.memo(({ className = 'max-w-sm' }) => (
  <div className="fixed inset-0 bg-slate-950/75 z-[99999] flex items-center justify-center p-4">
    <SkFrame className={`w-full ${className} rounded-3xl p-6 space-y-4`}>
      <div className="flex items-center gap-3">
        <SkBar w="w-10" h="h-10" rounded="rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <SkBar w="w-28" h="h-2.5" />
          <SkBar w="w-40" h="h-4" />
        </div>
      </div>
      <SkBar w="w-full" h="h-20" rounded="rounded-xl" />
      <SkBar w="w-full" h="h-10" rounded="rounded-xl" />
    </SkFrame>
  </div>
));
ModalDialogSkeleton.displayName = 'ModalDialogSkeleton';
