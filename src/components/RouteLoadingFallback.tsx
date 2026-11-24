import React from 'react';
import { TabSkeleton, SkVariantProvider, getVariantForTab } from './skeleton/Skeleton';

export default function RouteLoadingFallback({ text: _text = "Loading", variant }: { text?: string; variant?: string }) {
  const resolved = getVariantForTab(variant);

  if (resolved === 'greenradius') {
    return (
      <SkVariantProvider variant="flat">
        <TabSkeleton variant="greenradius" />
      </SkVariantProvider>
    );
  }

  if (resolved === 'login') {
    return <TabSkeleton variant="login" />;
  }

  return (
    <div className="w-full py-1 select-none">
      <TabSkeleton variant={resolved} />
    </div>
  );
}
