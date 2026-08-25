import React from 'react';
import Preloader from './Preloader';

export default function RouteLoadingFallback({ text = "Loading" }: { text?: string }) {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-6 text-center select-none">
      <Preloader size="sm" text={text} />
    </div>
  );
}
