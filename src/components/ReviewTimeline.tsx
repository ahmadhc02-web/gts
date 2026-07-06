import React from 'react';
import { motion } from 'motion/react';
import { ComplaintReview } from '../types';
import { cn } from '../lib/utils';

interface ReviewTimelineProps {
  reviews?: ComplaintReview[];
}

export default function ReviewTimeline({ reviews }: ReviewTimelineProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/85 text-xs text-slate-400 dark:text-slate-500 font-bold uppercase italic tracking-wider text-center flex flex-col items-center justify-center gap-1.5">
        <span>💬 Awaiting Telemetry / No Review Logged</span>
      </div>
    );
  }

  // Sort reviews chronologically (ascending, so older at the top, newer at the bottom, and highlight the last/most recent)
  const sortedReviews = [...reviews].sort((a, b) => a.createdAt - b.createdAt);
  const latestReviewId = sortedReviews[sortedReviews.length - 1]?.id;

  return (
    <div className="relative pl-4 border-l-2 border-slate-150 dark:border-slate-800 space-y-4">
      {sortedReviews.map((review, idx) => {
        const isLatest = review.id === latestReviewId;
        return (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={cn(
              "relative p-3 rounded-lg border transition-all duration-300",
              isLatest
                ? "bg-indigo-500/[0.04] dark:bg-indigo-500/10 border-indigo-500/30 shadow-inner"
                : "bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-900"
            )}
          >
            {/* Timeline dot */}
            <div
              className={cn(
                "absolute -left-[21px] top-4 w-2 h-2 rounded-full border",
                isLatest
                  ? "bg-indigo-500 border-indigo-500 scale-125 shadow-sm shadow-indigo-500/50"
                  : "bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900"
              )}
            />

            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                  {review.authorName || "Customer"}
                </span>
                {isLatest && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[7px] font-black uppercase tracking-wider animate-pulse">
                    Most Recent
                  </span>
                )}
              </div>
              <span className="text-[8px] font-mono font-bold text-slate-400 dark:text-slate-500">
                {new Date(review.createdAt).toLocaleString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short'
                })}
              </span>
            </div>

            <p className={cn(
              "text-xs font-semibold whitespace-pre-wrap leading-relaxed",
              isLatest ? "text-indigo-900 dark:text-indigo-100 italic" : "text-slate-600 dark:text-slate-400"
            )}>
              "{review.text}"
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
