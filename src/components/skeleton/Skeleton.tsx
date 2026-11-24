import React from 'react';
import { cn } from '../../lib/utils';

export type SkVariant = 'neu' | 'flat';
const SkVariantContext = React.createContext<SkVariant>('neu');

export const SkVariantProvider: React.FC<{ variant?: SkVariant; children: React.ReactNode }> = ({ variant = 'neu', children }) => (
  <SkVariantContext.Provider value={variant}>{children}</SkVariantContext.Provider>
);

export interface SkFrameProps {
  className?: string;
  children?: React.ReactNode;
  variant?: 'neu' | 'flat';
}

export const SkFrame = React.memo<SkFrameProps>(({ className, children, variant: variantProp }) => {
  const contextVariant = React.useContext(SkVariantContext);
  const variant = variantProp || contextVariant;
  return (
    <div
      style={variant === 'neu' ? { contain: 'layout paint' } : undefined}
      className={cn(
        variant === 'neu'
          ? "rounded-[1.25rem] bg-[var(--neu-surface,#f2f4f7)] dark:bg-[var(--neu-surface,#383b42)] border border-[var(--neu-border,rgba(255,255,255,0.9))] dark:border-[var(--neu-border,rgba(117,117,117,0.35))] shadow-[var(--neu-shadow-raised)] p-4 relative overflow-hidden"
          : "sk-frame shadow-sm",
        className
      )}
    >
      {variant === 'neu' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--sk-hi-neu,rgba(255,255,255,0.55))] to-transparent -translate-x-full will-change-transform animate-[sk-sweep_1.4s_linear_infinite] pointer-events-none" />
      )}
      {children}
    </div>
  );
});
SkFrame.displayName = 'SkFrame';

export interface SkBarProps {
  w?: string;
  h?: string;
  className?: string;
  rounded?: string;
}

export const SkBar = React.memo<SkBarProps>(({ w = 'w-full', h = 'h-3', className, rounded = 'rounded-md' }) => (
  <div className={cn("sk-bar", w, h, rounded, className)} />
));
SkBar.displayName = 'SkBar';

export const SkCircle = React.memo<{ size?: string; className?: string }>(({ size = 'w-10 h-10', className }) => (
  <div className={cn("sk-bar rounded-full shrink-0", size, className)} />
));
SkCircle.displayName = 'SkCircle';

export const SkAvatarRow = React.memo<{ count?: number; className?: string }>(({ count = 3, className }) => (
  <div className={cn("flex items-center gap-2", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <SkCircle key={i} size="w-8 h-8" />
    ))}
  </div>
));
SkAvatarRow.displayName = 'SkAvatarRow';

export const SkText = React.memo<{ lines?: number; className?: string }>(({ lines = 3, className }) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <SkBar key={i} w={i === lines - 1 ? 'w-2/3' : 'w-full'} h="h-2.5" />
    ))}
  </div>
));
SkText.displayName = 'SkText';

export const SkButton = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("sk-bar h-9 w-24 rounded-xl", className)} />
));
SkButton.displayName = 'SkButton';

export const SkStatTile = React.memo<{ className?: string; variant?: 'neu' | 'flat' }>(({ className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("flex flex-col justify-between gap-2 min-h-[128.25px] rounded-[18px] px-3.5 py-3", className)}>
      <SkBar w="w-24" h="h-3" />
      <div className="flex items-center justify-between gap-1.5">
        <SkBar w="w-16" h="h-9" rounded="rounded-lg" />
        <div className="w-[54px] h-7 opacity-60 shrink-0">
          <svg viewBox="0 0 60 25" className="w-full h-full">
            <path d="M0 20 Q 15 5, 30 15 T 60 2" fill="none" stroke="var(--sk-hi)" strokeWidth="2.5" />
          </svg>
        </div>
      </div>
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <SkBar w="w-24" h="h-2.5" />
        <SkBar w="w-3" h="h-3" rounded="rounded-full" />
      </div>
    </SkFrame>
  );
});
SkStatTile.displayName = 'SkStatTile';

/* Green Radius 15-grid StatCard horizontal skeleton (matches StatCard.tsx: min-h-[70px] rounded-2xl) */
export const SkVertixStatTile = React.memo<{ className?: string }>(({ className }) => (
  <SkFrame
    variant="flat"
    className={cn(
      "rounded-2xl px-3 py-2.5 sm:py-2 min-h-[70px] h-full flex flex-row items-center gap-2.5 sm:gap-2",
      className
    )}
  >
    <div className="sk-bar w-[37px] h-[38px] rounded-xl shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <SkBar w="w-24" h="h-2.5" />
      <div className="flex items-center justify-between gap-2">
        <SkBar w="w-12" h="h-5" rounded="rounded-md" />
        <SkBar w="w-12" h="h-4" rounded="rounded-full" />
      </div>
    </div>
  </SkFrame>
));
SkVertixStatTile.displayName = 'SkVertixStatTile';

/* Green Radius Subview Landscape Card (matches VertixLandscapeCard: h-[86px] sm:h-[90px] rounded-[22px]) */
export const SkVertixLandscapeTile = React.memo<{ className?: string }>(({ className }) => (
  <SkFrame
    variant="flat"
    className={cn(
      "rounded-[22px] p-3.5 sm:p-4 h-[86px] sm:h-[90px] flex items-center justify-between gap-3",
      className
    )}
  >
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <SkBar w="w-24" h="h-2.5" />
        <SkBar w="w-14" h="h-4" rounded="rounded-full" />
      </div>
      <SkBar w="w-20" h="h-6" />
    </div>
    <div className="sk-bar w-11 h-11 rounded-2xl shrink-0" />
  </SkFrame>
));
SkVertixLandscapeTile.displayName = 'SkVertixLandscapeTile';

export const SkChartCard = React.memo<{ type?: 'donut' | 'area' | 'bar'; className?: string; variant?: 'neu' | 'flat' }>(({ type = 'area', className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("flex flex-col justify-between gap-4 h-[340px] sm:h-[365px]", className)}>
      <div className="flex items-center justify-between">
        <SkBar w="w-36" h="h-4" />
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg">
          <SkBar w="w-10" h="h-5" rounded="rounded" />
          <SkBar w="w-10" h="h-5" rounded="rounded" />
          <SkBar w="w-10" h="h-5" rounded="rounded" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        {type === 'donut' && (
          <div className="flex items-center gap-6 w-full px-4">
            <div className="w-36 h-36 rounded-full border-8 border-[var(--sk-hi)] border-t-transparent shrink-0 mx-auto" />
            <div className="space-y-2 flex-1 hidden sm:block">
              <SkBar w="w-full" h="h-2.5" />
              <SkBar w="w-4/5" h="h-2.5" />
              <SkBar w="w-3/4" h="h-2.5" />
              <SkBar w="w-2/3" h="h-2.5" />
            </div>
          </div>
        )}
        {type === 'bar' && (
          <div className="w-full h-full flex items-end justify-between gap-3 px-4 pt-6">
            {[40, 70, 55, 90, 65, 80, 50].map((ht, idx) => (
              <div key={idx} className="w-full bg-[var(--sk-hi)] rounded-t-md" style={{ height: `${ht}%` }} />
            ))}
          </div>
        )}
        {type === 'area' && (
          <div className="w-full h-full flex flex-col justify-between py-2">
            <svg viewBox="0 0 100 40" className="w-full h-32 opacity-50">
              <path d="M0 35 Q 25 10, 50 22 T 100 12 L 100 40 L 0 40 Z" fill="var(--sk-hi)" />
              <path d="M0 25 Q 30 18, 60 28 T 100 8" fill="none" stroke="var(--sk-hi)" strokeWidth="2" />
            </svg>
            <div className="flex justify-between px-2 pt-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((_, i) => (
                <SkBar key={i} w="w-8" h="h-2" />
              ))}
            </div>
          </div>
        )}
      </div>
    </SkFrame>
  );
});
SkChartCard.displayName = 'SkChartCard';

export const SkTable = React.memo<{
  rows?: number;
  cols?: number;
  columns?: string[];
  rowHeight?: string;
  className?: string;
  variant?: 'neu' | 'flat';
}>(({ rows = 5, cols = 4, columns, rowHeight = 'py-3 px-4', className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  const renderRows = Math.min(rows, 15);
  const gridTemplate = columns && columns.length > 0 ? columns.join(' ') : `repeat(${cols}, minmax(0, 1fr))`;
  return (
    <SkFrame variant={v} className={cn("space-y-3", className)}>
      <div className="grid gap-3 pb-3 border-b border-black/10 dark:border-white/10 items-center font-bold text-xs" style={{ gridTemplateColumns: gridTemplate }}>
        {Array.from({ length: columns ? columns.length : cols }).map((_, i) => (
          <SkBar key={i} h="h-3.5" w={i === 0 ? 'w-3/4' : 'w-full'} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: renderRows }).map((_, rIdx) => (
          <div key={rIdx} className={cn("grid gap-3 items-center border-b border-black/5 dark:border-white/5 last:border-0", rowHeight)} style={{ gridTemplateColumns: gridTemplate }}>
            {Array.from({ length: columns ? columns.length : cols }).map((_, cIdx) => (
              <SkBar key={cIdx} h="h-3" w={cIdx === 0 ? 'w-4/5' : cIdx === 4 || cIdx === 5 ? 'w-16' : 'w-full'} rounded={cIdx === 4 || cIdx === 5 ? 'rounded-full' : 'rounded-md'} />
            ))}
          </div>
        ))}
      </div>
    </SkFrame>
  );
});
SkTable.displayName = 'SkTable';

export const SkRegistry = React.memo<{ className?: string; variant?: 'neu' | 'flat' }>(({ className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <div className={cn("space-y-4", className)}>
      {/* Heading row */}
      <div className="flex items-center justify-between pb-1">
        <SkBar w="w-56" h="h-6" />
        <SkBar w="w-28" h="h-6" rounded="rounded-full" />
      </div>
      <SkBar w="w-72 max-w-full" h="h-3 mb-2" />

      {/* Toolbar card */}
      <SkFrame variant={v} className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <SkBar w="w-full sm:w-72" h="h-10" rounded="rounded-xl" />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <SkBar w="w-28" h="h-9" rounded="rounded-xl" />
            <SkBar w="w-20" h="h-9" rounded="rounded-xl" />
            <SkButton />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkBar key={i} w="w-24" h="h-7" rounded="rounded-full" className="shrink-0" />
          ))}
        </div>
      </SkFrame>

      {/* Second row of 3 select boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkBar key={i} h="h-10" rounded="rounded-xl" />
        ))}
      </div>

      {/* Table with 8 columns */}
      <SkTable
        variant={v}
        rows={8}
        columns={['minmax(180px,1.5fr)', 'minmax(120px,1fr)', 'minmax(130px,1fr)', 'minmax(200px,2fr)', 'minmax(90px,0.8fr)', 'minmax(100px,0.9fr)', 'minmax(120px,1fr)', 'minmax(90px,0.8fr)']}
        rowHeight="py-3 px-4"
      />
    </div>
  );
});
SkRegistry.displayName = 'SkRegistry';

export const SkList = React.memo<{ rows?: number; className?: string; variant?: 'neu' | 'flat' }>(({ rows = 4, className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("space-y-3", className)}>
      {Array.from({ length: Math.min(rows, 12) }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-black/5 dark:border-white/5 last:border-0">
          <SkCircle size="w-9 h-9" />
          <div className="flex-1 space-y-1.5">
            <SkBar w="w-1/3" h="h-3" />
            <SkBar w="w-3/4" h="h-2" />
          </div>
        </div>
      ))}
    </SkFrame>
  );
});
SkList.displayName = 'SkList';

/* ServiceMonitor full-width ServerCard row skeleton */
export const SkServerCardRow = React.memo<{ className?: string }>(({ className }) => (
  <SkFrame
    variant="neu"
    className={cn("rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5", className)}
  >
    <div className="flex items-center gap-3 min-w-0 lg:w-64">
      <div className="sk-bar w-11 h-11 rounded-2xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <SkBar w="w-28" h="h-4" />
        <SkBar w="w-36" h="h-2.5" />
        <SkBar w="w-24" h="h-2" />
      </div>
    </div>
    <div className="flex-1 min-w-[160px] h-14 rounded-xl border border-black/5 dark:border-white/10 p-2 flex items-end gap-1">
      {[25, 40, 35, 65, 50, 45, 70, 55, 60, 40, 50, 75, 45, 55].map((ht, i) => (
        <div key={i} className="flex-1 bg-[var(--sk-hi)] rounded-t-sm" style={{ height: `${ht}%` }} />
      ))}
    </div>
    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
      <div className="space-y-1.5 min-w-[110px]">
        <SkBar w="w-16" h="h-5" />
        <SkBar w="w-28" h="h-2" />
      </div>
      <SkBar w="w-16" h="h-6" rounded="rounded-full" />
      <div className="flex items-center gap-1.5">
        <SkBar w="w-16" h="h-8" rounded="rounded-xl" />
        <SkBar w="w-14" h="h-8" rounded="rounded-xl" />
        <SkBar w="w-16" h="h-8" rounded="rounded-xl" />
      </div>
    </div>
  </SkFrame>
));
SkServerCardRow.displayName = 'SkServerCardRow';

export const SkCardGrid = React.memo<{ count?: number; cols?: number; className?: string; variant?: 'neu' | 'flat' }>(({ count = 6, cols = 3, className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  const colsClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : cols === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : cols === 6
      ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 lg:gap-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  if (cols === 1) {
    return (
      <div className={cn("grid gap-3 grid-cols-1", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <SkServerCardRow key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-4", colsClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkStatTile key={i} variant={v} />
      ))}
    </div>
  );
});
SkCardGrid.displayName = 'SkCardGrid';

export const SkForm = React.memo<{ fields?: number; className?: string; variant?: 'neu' | 'flat' }>(({ fields = 4, className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("space-y-4 max-w-2xl mx-auto", className)}>
      <SkBar w="w-48" h="h-5" className="mb-6" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <SkBar w="w-28" h="h-2.5" />
          <SkBar h="h-10" rounded="rounded-xl" />
        </div>
      ))}
      <div className="pt-4">
        <SkButton className="w-full h-11" />
      </div>
    </SkFrame>
  );
});
SkForm.displayName = 'SkForm';

export const SkToolbar = React.memo<{ className?: string; variant?: 'neu' | 'flat' }>(({ className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4", className)}>
      <SkBar w="w-full sm:w-64" h="h-10" rounded="rounded-xl" />
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <SkBar w="w-24" h="h-9" rounded="rounded-xl" />
        <SkBar w="w-24" h="h-9" rounded="rounded-xl" />
        <SkButton />
      </div>
    </SkFrame>
  );
});
SkToolbar.displayName = 'SkToolbar';

export const SkChatList = React.memo<{ className?: string; variant?: 'neu' | 'flat' }>(({ className, variant }) => (
  <SkList rows={7} className={className} variant={variant} />
));
SkChatList.displayName = 'SkChatList';

export const SkChatThread = React.memo<{ className?: string; variant?: 'neu' | 'flat' }>(({ className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("space-y-4 h-[450px] flex flex-col justify-between", className)}>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <SkCircle size="w-8 h-8" />
          <SkBar w="w-2/3" h="h-12" rounded="rounded-2xl" />
        </div>
        <div className="flex items-start gap-3 justify-end">
          <SkBar w="w-1/2" h="h-10" rounded="rounded-2xl" />
          <SkCircle size="w-8 h-8" />
        </div>
        <div className="flex items-start gap-3">
          <SkCircle size="w-8 h-8" />
          <SkBar w="w-3/5" h="h-16" rounded="rounded-2xl" />
        </div>
      </div>
      <SkBar h="h-12" rounded="rounded-2xl" />
    </SkFrame>
  );
});
SkChatThread.displayName = 'SkChatThread';

export const SkMap = React.memo<{ className?: string; variant?: 'neu' | 'flat' }>(({ className, variant }) => {
  const ctx = React.useContext(SkVariantContext);
  const v = variant || ctx;
  return (
    <SkFrame variant={v} className={cn("h-[450px] flex items-center justify-center", className)}>
      <div className="space-y-2 text-center">
        <SkCircle size="w-12 h-12 mx-auto" />
        <SkBar w="w-32" h="h-3 mx-auto" />
      </div>
    </SkFrame>
  );
});
SkMap.displayName = 'SkMap';

/* -------- PER-PAGE FRAME-MATCHED COMPOSITE SKELETONS -------- */

/* GTS Home (AdminPanel / MemberPanel home: 6 KPI tiles -> Chart Analytics + 3 Charts -> Registry) */
export const SkDashboardHome = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("space-y-3.5 sm:space-y-4", className)}>
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 lg:gap-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <SkStatTile key={`home-sk-stat-${idx}`} variant="neu" />
      ))}
    </div>
    <div className="space-y-2.5">
      <div className="space-y-1">
        <SkBar w="w-36" h="h-5" />
        <SkBar w="w-56" h="h-2.5" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkChartCard type="donut" variant="neu" className="h-[340px] sm:h-[365px]" />
        <SkChartCard type="area" variant="neu" className="h-[340px] sm:h-[365px]" />
        <SkChartCard type="donut" variant="neu" className="h-[340px] sm:h-[365px]" />
      </div>
    </div>
    <SkRegistry variant="neu" />
  </div>
));
SkDashboardHome.displayName = 'SkDashboardHome';

/* Green Radius Top Grid (Total Balance 4-col card + 15 horizontal StatCard tiles) */
export const SkVertixHeroGrid = React.memo<{ className?: string }>(({ className }) => (
  <div
    className={cn(
      "grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 lg:gap-4 items-stretch shrink-0 w-full min-w-0 h-auto lg:min-h-[380.833px] pt-[5px] pl-0 pr-[2px] sm:pr-[5px]",
      className
    )}
  >
    <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-3.5 justify-between min-w-0">
      <SkFrame
        variant="flat"
        className="flex-1 min-h-[320px] lg:min-h-[340px] rounded-2xl sm:rounded-3xl flex flex-col justify-between p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <SkBar w="w-24" h="h-4" />
          <div className="flex items-center gap-2">
            <SkBar w="w-14" h="h-5" rounded="rounded-full" />
            <SkBar w="w-20" h="h-6" rounded="rounded-full" />
          </div>
        </div>
        <div className="space-y-2 my-2">
          <SkBar w="w-44" h="h-9" rounded="rounded-lg" />
          <div className="flex items-center gap-2">
            <SkBar w="w-12" h="h-5" rounded="rounded-full" />
            <SkBar w="w-24" h="h-3" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 my-1">
          <SkBar h="h-10" rounded="rounded-xl" />
          <SkBar h="h-10" rounded="rounded-xl" />
        </div>
        <div className="mt-2 p-3 sm:p-4 rounded-xl border border-black/10 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <SkBar w="w-36" h="h-3" />
            <SkBar w="w-14" h="h-4" rounded="rounded-md" />
          </div>
          <SkBar w="w-32" h="h-7" />
          <SkBar w="w-48" h="h-2.5" />
          <SkBar h="h-3" rounded="rounded-full" />
          <SkBar w="w-28" h="h-2.5" />
        </div>
      </SkFrame>
    </div>
    <div className="md:col-span-7 lg:col-span-8 min-w-0 flex flex-col justify-between">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 content-stretch min-w-0">
        {Array.from({ length: 15 }).map((_, idx) => (
          <SkVertixStatTile key={`vertix-sk-tile-${idx}`} />
        ))}
      </div>
    </div>
  </div>
));
SkVertixHeroGrid.displayName = 'SkVertixHeroGrid';

/* Green Radius Subscriber Table (#vertix-users-table exact 9-col card + search + pagination) */
export const SkVertixUsersTable = React.memo<{ rows?: number; className?: string }>(({ rows = 8, className }) => (
  <SkFrame
    variant="flat"
    className={cn("p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex flex-col w-full min-w-0 space-y-3", className)}
  >
    {/* Header line */}
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 pb-3 border-b border-black/10 dark:border-white/10">
      <div className="space-y-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <SkBar w="w-28" h="h-5" />
          <SkBar w="w-10" h="h-5" rounded="rounded-full" />
        </div>
        <SkBar w="w-32" h="h-2.5" />
      </div>
      <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto min-w-0 px-1 sm:px-2 order-last sm:order-none w-full sm:w-auto">
        <SkBar h="h-8" rounded="rounded-full" />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SkBar w="w-28" h="h-8" rounded="rounded-lg" />
        <SkBar w="w-20" h="h-8" rounded="rounded-lg" />
      </div>
    </div>

    {/* 9-col Subscriber table rows */}
    <div className="space-y-2.5 overflow-hidden">
      <div className="grid grid-cols-7 lg:grid-cols-9 gap-3 pb-2.5 border-b border-black/10 dark:border-white/10 items-center">
        <SkBar w="w-4" h="h-4" rounded="rounded" />
        <SkBar w="w-24" h="h-3.5" />
        <SkBar w="w-20" h="h-3.5" />
        <SkBar w="w-14" h="h-3.5" className="hidden lg:block" />
        <SkBar w="w-16" h="h-3.5" />
        <SkBar w="w-14" h="h-3.5" />
        <SkBar w="w-20" h="h-3.5" />
        <SkBar w="w-20" h="h-3.5" className="hidden lg:block" />
        <SkBar w="w-24" h="h-3.5" className="ml-auto" />
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="grid grid-cols-7 lg:grid-cols-9 gap-3 py-2 border-b border-black/5 dark:border-white/5 last:border-0 items-center">
          <SkBar w="w-4" h="h-4" rounded="rounded" />
          <div className="flex items-center gap-2 min-w-0">
            <SkCircle size="w-8 h-8" />
            <div className="space-y-1 flex-1 min-w-0">
              <SkBar w="w-24" h="h-3" />
              <SkBar w="w-20" h="h-2" />
            </div>
          </div>
          <SkBar w="w-24" h="h-7" rounded="rounded-lg" />
          <SkBar w="w-16" h="h-6" rounded="rounded-md" className="hidden lg:block" />
          <SkBar w="w-16" h="h-6" rounded="rounded-lg" />
          <SkBar w="w-16" h="h-6" rounded="rounded-md" />
          <div className="space-y-1">
            <SkBar w="w-20" h="h-2.5" />
            <SkBar w="w-16" h="h-2" />
          </div>
          <SkBar w="w-24" h="h-3" className="hidden lg:block" />
          <div className="flex items-center justify-end gap-1.5">
            <SkBar w="w-16" h="h-6" rounded="rounded-md" />
            <SkBar w="w-14" h="h-6" rounded="rounded-md" />
            <SkBar w="w-7" h="h-6" rounded="rounded-lg" />
          </div>
        </div>
      ))}
    </div>

    {/* Pagination bar */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-black/10 dark:border-white/10">
      <SkBar w="w-44" h="h-3" />
      <div className="flex items-center gap-1.5">
        <SkBar w="w-16" h="h-7" rounded="rounded-lg" />
        <SkBar w="w-7" h="h-7" rounded="rounded-lg" />
        <SkBar w="w-7" h="h-7" rounded="rounded-lg" />
        <SkBar w="w-14" h="h-7" rounded="rounded-lg" />
      </div>
    </div>
  </SkFrame>
));
SkVertixUsersTable.displayName = 'SkVertixUsersTable';

/* Green Radius Full Shell + Body (identical for Suspense fallback & first paint) */
export const SkVertixDashboard = React.memo<{ className?: string }>(({ className }) => (
  <SkVariantProvider variant="flat">
    <div
      className={cn(
        "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] h-dvh-fallback w-full flex flex-col overflow-hidden bg-[#eef3f1] dark:bg-[#0f131a]",
        className
      )}
    >
      {/* Top OS Header matching VertixDashboard */}
      <header className="h-14 sm:h-16 shrink-0 px-2.5 sm:px-5 lg:px-6 flex items-center justify-between gap-2 border-b border-slate-300 dark:border-[#2d3648] bg-white dark:bg-[#161b24]">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SkBar w="w-8 h-8 sm:w-10 sm:h-10" rounded="rounded-xl" />
          <div className="space-y-1.5 hidden xs:block">
            <SkBar w="w-28 sm:w-36" h="h-3.5" />
            <SkBar w="w-24" h="h-2" className="hidden sm:block" />
          </div>
          <SkBar w="w-24" h="h-7" rounded="rounded-full" />
        </div>
        <div className="hidden xl:flex items-center gap-1.5 p-1.5 rounded-full border border-slate-200 dark:border-[#2d3648] bg-slate-100 dark:bg-[#10141b]">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkBar key={i} w="w-16" h="h-6" rounded="rounded-full" />
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SkCircle size="w-8 h-8 sm:w-9 sm:h-9" />
          <SkCircle size="w-8 h-8 sm:w-9 sm:h-9" />
          <SkCircle size="w-8 h-8 sm:w-9 sm:h-9" />
          <SkCircle size="w-8 h-8 sm:w-9 sm:h-9" />
          <SkBar w="w-24 sm:w-32" h="h-9" rounded="rounded-full" />
        </div>
      </header>

      {/* Mobile horizontal nav bar */}
      <div className="lg:hidden shrink-0 border-b border-slate-300 dark:border-[#2d3648] bg-white dark:bg-[#161b24] px-3 py-1.5 flex items-center gap-1.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkBar key={i} w="w-20" h="h-7" rounded="rounded-full" className="shrink-0" />
        ))}
      </div>

      {/* Main Dock + Scroll Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden p-2 sm:p-3.5 lg:p-4 gap-3 lg:gap-4 w-full">
        <aside className="hidden lg:flex flex-col items-center justify-between w-14 shrink-0 rounded-3xl border border-slate-300 dark:border-[#2d3648] bg-white dark:bg-[#161b24] py-3 px-1.5">
          <div className="flex flex-col items-center gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkBar key={i} w="w-10" h="h-10" rounded="rounded-2xl" />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#2d3648] w-full">
            <SkBar w="w-9" h="h-9" rounded="rounded-xl" />
            <SkBar w="w-9" h="h-9" rounded="rounded-xl" />
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden space-y-3.5 sm:space-y-4">
          <SkVertixHeroGrid />
          <SkVertixUsersTable rows={6} />
        </div>
      </div>
    </div>
  </SkVariantProvider>
));
SkVertixDashboard.displayName = 'SkVertixDashboard';

/* Green Radius Subview skeleton (4 VertixLandscapeCard + Table/Charts workspace) */
export const SkVertixSubView = React.memo<{ mode?: 'table' | 'charts'; cols?: number; className?: string }>(({ mode = 'table', cols = 6, className }) => (
  <div className={cn("space-y-4 w-full min-w-0", className)}>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkVertixLandscapeTile key={i} />
      ))}
    </div>
    {mode === 'charts' ? (
      <SkFrame variant="flat" className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
          <SkBar w="w-56" h="h-5" />
          <div className="flex items-center gap-2">
            <SkBar w="w-40" h="h-8" rounded="rounded-full" />
            <SkBar w="w-24" h="h-8" rounded="rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <SkChartCard variant="flat" type="bar" className="lg:col-span-7 min-h-[260px]" />
          <SkChartCard variant="flat" type="donut" className="lg:col-span-5 min-h-[260px]" />
        </div>
      </SkFrame>
    ) : (
      <SkTable variant="flat" rows={6} cols={cols} className="rounded-2xl sm:rounded-3xl p-4 sm:p-5" />
    )}
  </div>
));
SkVertixSubView.displayName = 'SkVertixSubView';

/* BillingTab skeleton: Optional top unlock bar + 8 Bento border-l-4 summary cards + Recovery Rows table */
export const SkBillingView = React.memo<{ showHeader?: boolean; className?: string }>(({ showHeader = true, className }) => (
  <div className={cn("space-y-4 sm:space-y-5 w-full", className)}>
    {showHeader && (
      <SkFrame variant="neu" className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SkCircle size="w-9 h-9" />
          <div className="space-y-1.5">
            <SkBar w="w-40" h="h-4" />
            <SkBar w="w-28" h="h-2.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkBar w="w-36" h="h-9" rounded="rounded-xl" />
          <SkBar w="w-24" h="h-9" rounded="rounded-xl" />
          <SkBar w="w-20" h="h-9" rounded="rounded-xl" />
        </div>
      </SkFrame>
    )}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkFrame key={i} variant="neu" className="p-3 sm:p-4 rounded-xl border-l-4 space-y-2.5">
          <SkBar w="w-24" h="h-2.5" />
          <SkBar w="w-32" h="h-5" />
          <SkBar w="w-40 max-w-full" h="h-2.5" />
        </SkFrame>
      ))}
    </div>
    <SkFrame variant="neu" className="p-6 sm:p-8 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SkBar w="w-48" h="h-5" />
          <SkBar w="w-28" h="h-7" rounded="rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <SkBar w="w-44" h="h-9" rounded="rounded-xl" />
          <SkBar w="w-28" h="h-9" rounded="rounded-xl" />
          <SkBar w="w-24" h="h-9" rounded="rounded-xl" />
        </div>
      </div>
      <SkTable variant="neu" rows={8} cols={8} className="shadow-none border-0 p-0 bg-transparent dark:bg-transparent" />
    </SkFrame>
  </div>
));
SkBillingView.displayName = 'SkBillingView';

/* ClientManagement skeleton: Registration multi-col form card + Infrastructure Directory 7-col table */
export const SkClientsView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("space-y-6 w-full", className)}>
    <SkFrame variant="neu" className="p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <SkBar w="w-48" h="h-5" />
          <SkBar w="w-64" h="h-2.5" />
        </div>
        <SkBar w="w-28" h="h-9" rounded="rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkBar w="w-24" h="h-2.5" />
            <SkBar h="h-10" rounded="rounded-xl" />
          </div>
        ))}
      </div>
      <SkBar w="w-40" h="h-10" rounded="rounded-xl" />
    </SkFrame>

    <SkFrame variant="neu" className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <SkBar w="w-56" h="h-5" />
        <div className="flex flex-wrap items-center gap-2">
          <SkBar w="w-28" h="h-9" rounded="rounded-xl" />
          <SkBar w="w-28" h="h-9" rounded="rounded-xl" />
          <SkBar w="w-48" h="h-9" rounded="rounded-xl" />
        </div>
      </div>
      <SkTable variant="neu" rows={6} cols={7} className="shadow-none border-0 p-0 bg-transparent dark:bg-transparent" />
    </SkFrame>
  </div>
));
SkClientsView.displayName = 'SkClientsView';

/* Split Left-Form / Right-Directory skeleton (Users & Dealers tabs) */
export const SkSplitDirectoryView = React.memo<{ cols?: number; className?: string }>(({ cols = 5, className }) => (
  <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-8", className)}>
    <div className="lg:col-span-1">
      <SkForm variant="neu" fields={5} className="max-w-none p-8" />
    </div>
    <div className="lg:col-span-2">
      <SkTable variant="neu" rows={6} cols={cols} className="p-6" />
    </div>
  </div>
));
SkSplitDirectoryView.displayName = 'SkSplitDirectoryView';

/* Field Operations Submit skeleton */
export const SkSubmitView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("max-w-4xl mx-auto space-y-8", className)}>
    <div className="text-center space-y-2.5">
      <SkBar w="w-64" h="h-8" className="mx-auto" />
      <SkBar w="w-72" h="h-2.5" className="mx-auto" />
    </div>
    <SkForm variant="neu" fields={6} className="max-w-4xl p-6 sm:p-8" />
  </div>
));
SkSubmitView.displayName = 'SkSubmitView';

/* Top10 / HighFrequencyNodes skeleton */
export const SkRankedNodesView = React.memo<{ className?: string }>(({ className }) => (
  <SkFrame variant="neu" className={cn("max-w-4xl mx-auto p-6 sm:p-8 space-y-5 rounded-3xl", className)}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <SkBar w="w-10" h="h-10" rounded="rounded-xl" />
        <div className="space-y-1.5">
          <SkBar w="w-44" h="h-4" />
          <SkBar w="w-56" h="h-2.5" />
        </div>
      </div>
      <SkBar w="w-40" h="h-9" rounded="rounded-xl" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl border border-black/5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <SkBar w="w-9" h="h-9" rounded="rounded-xl" />
            <div className="space-y-1.5">
              <SkBar w="w-36" h="h-3.5" />
              <SkBar w="w-24" h="h-2.5" />
            </div>
          </div>
          <div className="space-y-1 text-right">
            <SkBar w="w-10" h="h-5" className="ml-auto" />
            <SkBar w="w-14" h="h-2" />
          </div>
        </div>
      ))}
    </div>
  </SkFrame>
));
SkRankedNodesView.displayName = 'SkRankedNodesView';

/* Dealers Data Intelligence skeleton */
export const SkDealersDataView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("space-y-8", className)}>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <SkBar w="w-52" h="h-6" />
        <SkBar w="w-80 max-w-full" h="h-2.5" />
      </div>
      <SkBar w="w-32" h="h-10" rounded="rounded-xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkFrame key={i} variant="neu" className="p-6 rounded-2xl space-y-5">
          <div className="flex items-start justify-between">
            <SkBar w="w-12" h="h-12" rounded="rounded-xl" />
            <SkBar w="w-16" h="h-6" rounded="rounded" />
          </div>
          <div className="space-y-1.5">
            <SkBar w="w-32" h="h-5" />
            <SkBar w="w-40" h="h-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/10">
            <div className="space-y-1">
              <SkBar w="w-16" h="h-2" />
              <SkBar w="w-10" h="h-5" />
            </div>
            <div className="space-y-1">
              <SkBar w="w-14" h="h-2" />
              <SkBar w="w-10" h="h-5" />
            </div>
          </div>
        </SkFrame>
      ))}
    </div>
  </div>
));
SkDealersDataView.displayName = 'SkDealersDataView';

/* Settings (Audio Matrix & Voice) skeleton */
export const SkSettingsView = React.memo<{ className?: string }>(({ className }) => (
  <SkFrame variant="neu" className={cn("max-w-2xl p-8 sm:p-10 space-y-8", className)}>
    <div className="flex items-center gap-4">
      <SkBar w="w-14" h="h-14" rounded="rounded-2xl" />
      <div className="space-y-1.5">
        <SkBar w="w-48" h="h-5" />
        <SkBar w="w-56" h="h-2.5" />
      </div>
    </div>
    <div className="space-y-4">
      <SkBar w="w-36" h="h-2.5" />
      <SkBar h="h-16" rounded="rounded-xl" />
      <SkBar h="h-11" rounded="rounded-xl" />
    </div>
    <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/10">
      <SkBar w="w-36" h="h-2.5" />
      <SkBar h="h-16" rounded="rounded-xl" />
      <SkBar h="h-16" rounded="rounded-xl" />
    </div>
    <SkBar h="h-12" rounded="rounded-xl" />
  </SkFrame>
));
SkSettingsView.displayName = 'SkSettingsView';

/* Integrations (Google Sheets Sync + Enterprise Backup) skeleton */
export const SkIntegrationsView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
    {Array.from({ length: 2 }).map((_, i) => (
      <SkFrame key={i} variant="neu" className="p-8 sm:p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SkBar w="w-16" h="h-16" rounded="rounded-2xl" />
            <div className="space-y-1.5">
              <SkBar w="w-48" h="h-6" />
              <SkBar w="w-40" h="h-2.5" />
            </div>
          </div>
          <SkBar w="w-48" h="h-12" rounded="rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SkText lines={4} />
          <SkBar h="h-36" rounded="rounded-2xl" />
        </div>
      </SkFrame>
    ))}
  </div>
));
SkIntegrationsView.displayName = 'SkIntegrationsView';

/* Recycle Bin skeleton */
export const SkRecycleBinView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("max-w-6xl mx-auto space-y-6", className)}>
    <SkFrame variant="neu" className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <SkBar w="w-14" h="h-14" rounded="rounded-2xl" />
        <div className="space-y-1.5">
          <SkBar w="w-56" h="h-5" />
          <SkBar w="w-72 max-w-full" h="h-2.5" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SkBar w="w-52" h="h-10" rounded="rounded-xl" />
        <SkBar w="w-28" h="h-10" rounded="rounded-xl" />
      </div>
    </SkFrame>
    <SkTable variant="neu" rows={6} cols={5} className="p-6" />
  </div>
));
SkRecycleBinView.displayName = 'SkRecycleBinView';

/* MyPC / Config Sidebar + Workspace Explorer skeleton */
export const SkMyPCView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("flex gap-4 min-h-[540px] w-full", className)}>
    <SkFrame variant="neu" className="hidden lg:flex flex-col w-64 shrink-0 p-3 space-y-3">
      <SkBar h="h-9" rounded="rounded-xl" />
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkBar key={i} w="w-12" h="h-5" rounded="rounded-md" />
        ))}
      </div>
      <div className="space-y-1.5 pt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkBar key={i} h="h-9" rounded="rounded-xl" />
        ))}
      </div>
    </SkFrame>
    <div className="flex-1 min-w-0 space-y-5">
      <div className="space-y-1.5 pb-3 border-b border-black/10 dark:border-white/10">
        <SkBar w="w-48" h="h-6" />
        <SkBar w="w-72 max-w-full" h="h-3" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkFrame key={i} variant="neu" className="p-5 space-y-3">
            <SkBar w="w-36" h="h-4" />
            <SkText lines={3} />
            <div className="flex flex-wrap gap-2 pt-1">
              <SkBar w="w-20" h="h-6" rounded="rounded-lg" />
              <SkBar w="w-24" h="h-6" rounded="rounded-lg" />
              <SkBar w="w-16" h="h-6" rounded="rounded-lg" />
            </div>
          </SkFrame>
        ))}
      </div>
    </div>
  </div>
));
SkMyPCView.displayName = 'SkMyPCView';

/* Branding EditorPanel skeleton */
export const SkBrandingView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("space-y-6", className)}>
    <SkFrame variant="neu" className="p-4 flex items-center justify-between">
      <div className="space-y-1.5">
        <SkBar w="w-48" h="h-5" />
        <SkBar w="w-64" h="h-2.5" />
      </div>
      <SkBar w="w-36" h="h-10" rounded="rounded-xl" />
    </SkFrame>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5">
        <SkForm variant="neu" fields={5} className="max-w-none" />
      </div>
      <div className="lg:col-span-7">
        <SkFrame variant="neu" className="h-[460px] p-6 space-y-4">
          <SkBar w="w-44" h="h-5" />
          <div className="grid grid-cols-3 gap-3">
            <SkStatTile variant="neu" />
            <SkStatTile variant="neu" />
            <SkStatTile variant="neu" />
          </div>
          <SkBar h="h-52" rounded="rounded-2xl" />
        </SkFrame>
      </div>
    </div>
  </div>
));
SkBrandingView.displayName = 'SkBrandingView';

/* ServiceMonitor Quick Ping + ServerCard rows */
export const SkMonitorView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("space-y-4", className)}>
    <SkFrame variant="neu" className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <SkBar w="w-full sm:w-80" h="h-10" rounded="rounded-xl" />
      <div className="flex items-center gap-2">
        <SkBar w="w-24" h="h-9" rounded="rounded-xl" />
        <SkBar w="w-24" h="h-9" rounded="rounded-xl" />
      </div>
    </SkFrame>
    <SkCardGrid count={5} cols={1} variant="neu" />
  </div>
));
SkMonitorView.displayName = 'SkMonitorView';

/* Login page skeleton */
export const SkLoginView = React.memo<{ className?: string }>(({ className }) => (
  <div className={cn("min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#f4f7f5] dark:bg-[#1a1d21]", className)}>
    <SkFrame variant="neu" className="w-full max-w-md p-6 sm:p-8 rounded-3xl space-y-6">
      <div className="flex flex-col items-center space-y-2.5 text-center">
        <SkBar w="w-16" h="h-16" rounded="rounded-2xl" />
        <SkBar w="w-40" h="h-6" />
        <SkBar w="w-56" h="h-3" />
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <SkBar w="w-36" h="h-3" />
          <SkBar h="h-12" rounded="rounded-2xl" />
        </div>
        <div className="space-y-1.5">
          <SkBar w="w-24" h="h-3" />
          <SkBar h="h-12" rounded="rounded-2xl" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <SkBar w="w-28" h="h-4" />
          <SkBar w="w-28" h="h-4" />
        </div>
        <SkBar h="h-12" rounded="rounded-2xl" />
      </div>
    </SkFrame>
  </div>
));
SkLoginView.displayName = 'SkLoginView';

export interface SkSectionProps {
  loading: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  minHeight?: number | string;
}

export const SkSection = React.memo<SkSectionProps>(({ loading, fallback, children, className, minHeight }) => {
  const style = minHeight !== undefined ? { minHeight } : undefined;
  if (loading) {
    return (
      <div className={className} style={style}>
        {fallback || <SkRegistry />}
      </div>
    );
  }
  return (
    <div className={cn("sk-fade-in", className)} style={style}>
      {children}
    </div>
  );
});
SkSection.displayName = 'SkSection';

export interface TabSkeletonProps {
  variant?:
    | 'dashboard'
    | 'greenradius'
    | 'login'
    | 'billing'
    | 'clients'
    | 'monitor'
    | 'submit'
    | 'users'
    | 'dealers'
    | 'dealers_data'
    | 'top10'
    | 'nodes'
    | 'mypc'
    | 'config'
    | 'settings'
    | 'branding'
    | 'integrations'
    | 'recycle_bin'
    | 'table'
    | 'cards'
    | 'form'
    | 'chat'
    | 'map'
    | 'default';
  className?: string;
}

export const TabSkeleton = React.memo<TabSkeletonProps>(({ variant = 'default', className }) => {
  if (variant === 'greenradius') {
    return <SkVertixDashboard className={className} />;
  }
  if (variant === 'login') {
    return <SkLoginView className={className} />;
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {variant === 'dashboard' && <SkDashboardHome />}
      {variant === 'billing' && <SkBillingView />}
      {variant === 'clients' && <SkClientsView />}
      {variant === 'monitor' && <SkMonitorView />}
      {variant === 'submit' && <SkSubmitView />}
      {variant === 'users' && <SkSplitDirectoryView cols={6} />}
      {variant === 'dealers' && <SkSplitDirectoryView cols={4} />}
      {variant === 'dealers_data' && <SkDealersDataView />}
      {(variant === 'top10' || variant === 'nodes') && <SkRankedNodesView />}
      {(variant === 'mypc' || variant === 'config') && <SkMyPCView />}
      {variant === 'settings' && <SkSettingsView />}
      {variant === 'branding' && <SkBrandingView />}
      {variant === 'integrations' && <SkIntegrationsView />}
      {variant === 'recycle_bin' && <SkRecycleBinView />}
      {variant === 'table' && <SkRegistry />}
      {variant === 'cards' && <SkCardGrid count={8} cols={4} />}
      {variant === 'form' && <SkForm fields={5} />}
      {variant === 'chat' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-2 sm:p-4">
          <SkChatList />
          <div className="md:col-span-2">
            <SkChatThread />
          </div>
        </div>
      )}
      {variant === 'map' && <SkMap />}
      {variant === 'default' && (
        <>
          <SkCardGrid count={4} cols={2} />
          <SkRegistry />
        </>
      )}
    </div>
  );
});
TabSkeleton.displayName = 'TabSkeleton';

export const getVariantForTab = (tabId?: string): TabSkeletonProps['variant'] => {
  if (!tabId) return 'dashboard';
  const id = tabId.toLowerCase();
  switch (id) {
    case 'login':
      return 'login';
    case 'greenradius':
    case 'radius':
    case 'vertix':
      return 'greenradius';
    case 'dashboard':
    case 'complaints':
    case 'complaints_view':
    case 'ops':
      return 'dashboard';
    case 'billing':
    case 'billingmod':
      return 'billing';
    case 'clients':
      return 'clients';
    case 'monitor':
    case 'latency':
      return 'monitor';
    case 'submit':
    case 'registry':
      return 'submit';
    case 'users':
      return 'users';
    case 'dealers':
      return 'dealers';
    case 'dealers_data':
    case 'analytics':
      return 'dealers_data';
    case 'top10':
      return 'top10';
    case 'nodes':
      return 'nodes';
    case 'mypc':
    case 'profile':
      return 'mypc';
    case 'config':
      return 'config';
    case 'settings':
    case 'security':
      return 'settings';
    case 'branding':
      return 'branding';
    case 'integrations':
    case 'sheets':
      return 'integrations';
    case 'recycle_bin':
    case 'recyclebin':
      return 'recycle_bin';
    case 'critical':
    case 'table':
    case 'conversations':
    case 'entrysheet':
    case 'ledger':
      return 'table';
    case 'cards':
      return 'cards';
    case 'map':
      return 'map';
    case 'chat':
    case 'whatsapp':
    case 'whatsappcenter':
    case 'whatsapplogs':
      return 'chat';
    case 'form':
      return 'form';
    case 'default':
    default:
      return 'default';
  }
};

