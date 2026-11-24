import React, { useEffect, useState, useRef } from 'react';
import { type LucideIcon } from 'lucide-react';
import { STAT_CARD_TONES, type StatCardTone } from './theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  pill: string;
  icon: LucideIcon;
  tone: StatCardTone;
  onClick?: () => void;
  active?: boolean;
  isDarkMode?: boolean;
}

/**
 * Parses numeric target from string/number and preserves prefix/suffix
 * e.g. "$1,850" -> { prefix: "$", num: 1850, suffix: "", isDec: false }
 *      "42.8"   -> { prefix: "", num: 42.8, suffix: "", isDec: true }
 */
function parseValue(val: string | number) {
  if (typeof val === 'number') {
    return {
      prefix: '',
      target: val,
      suffix: '',
      decimals: Number.isInteger(val) ? 0 : 1,
    };
  }

  const str = String(val).trim();
  const match = str.match(/^(.*?)([\d]{1,3}(?:,[\d]{3})*(?:\.[\d]+)?|[\d]+(?:\.[\d]+)?)(.*)$/);
  if (!match) {
    return { prefix: '', target: 0, suffix: str, decimals: 0 };
  }

  const prefix = match[1] || '';
  const numStr = match[2].replace(/,/g, '');
  const suffix = match[3] || '';
  const num = parseFloat(numStr);
  const isNan = Number.isNaN(num);

  const decPart = numStr.includes('.') ? numStr.split('.')[1] : '';
  const decimals = decPart && decPart !== '0' && decPart !== '00' ? decPart.length : 0;

  return {
    prefix,
    target: isNan ? 0 : num,
    suffix,
    decimals,
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  pill,
  icon: Icon,
  tone,
  onClick,
  active = false,
  isDarkMode = false,
}) => {
  const toneStyle = STAT_CARD_TONES[tone] || STAT_CARD_TONES.deepGreen;

  // Animated count-up from 0 to value over 600ms
  const [displayValue, setDisplayValue] = useState<string>(() => String(value));
  const parsed = parseValue(value);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startNumRef = useRef<number>(0);

  useEffect(() => {
    const { prefix, target, suffix, decimals } = parseValue(value);
    const duration = 600; // ms
    startTimeRef.current = null;
    startNumRef.current = 0;

    const easeOutQuad = (t: number) => t * (2 - t);

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuad(progress);
      const current = startNumRef.current + (target - startNumRef.current) * eased;

      let formattedNum = '';
      if (decimals > 0) {
        formattedNum = current.toFixed(decimals);
      } else {
        formattedNum = Math.round(current).toLocaleString();
      }

      setDisplayValue(`${prefix}${formattedNum}${suffix}`);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        let finalFormatted = '';
        if (decimals > 0) {
          finalFormatted = target.toFixed(decimals);
        } else {
          finalFormatted = Math.round(target).toLocaleString();
        }
        setDisplayValue(`${prefix}${finalFormatted}${suffix}`);
      }
    };

    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [value]);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative overflow-hidden rounded-2xl border flex flex-row items-center gap-2.5 sm:gap-2 px-3 py-2.5 sm:py-2 min-h-[70px] h-full min-w-0 cursor-pointer transition-colors duration-150 select-none touch-manipulation group ${
        isDarkMode
          ? `bg-[#161b24] border-[#2d3648] hover:border-emerald-500/60 hover:bg-[#1c2330] shadow-sm shadow-black/30 ${
              active ? `${toneStyle.activeRing} border-transparent bg-[#1e2736]` : ''
            }`
          : `bg-white border-slate-300 shadow-xs hover:border-slate-500 hover:shadow-sm ${
              active ? `${toneStyle.activeRing} border-transparent bg-emerald-50/60` : ''
            }`
      }`}
    >
      {/* Subtle top-right accent */}
      <div
        className={`absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none ${isDarkMode ? 'opacity-[0.12]' : 'opacity-[0.07]'} ${toneStyle.circleBg}`}
      />

      {/* Left Icon Box (37x38) */}
      <div
        className={`w-[37px] h-[38px] rounded-xl flex items-center justify-center shrink-0 ${
          isDarkMode ? toneStyle.iconBgDark : toneStyle.iconBgLight
        }`}
      >
        <Icon
          className={`w-4 h-4 ${
            isDarkMode ? toneStyle.iconTextDark : toneStyle.iconTextLight
          }`}
        />
      </div>

      {/* Right Info */}
      <div className="flex-1 min-w-0 z-10 overflow-hidden">
        <p
          className={`text-[12px] sm:text-[13px] font-bold leading-tight truncate ${
            isDarkMode ? 'text-slate-100' : 'text-slate-800'
          }`}
        >
          {label}
        </p>
        <div className="flex items-center justify-between gap-1.5 mt-0.5 min-w-0">
          <span
            className={`font-black tabular-nums truncate text-[21px] sm:text-[24px] lg:text-[26px] leading-tight lg:leading-[29px] ${
              isDarkMode ? 'text-white' : 'text-slate-950'
            }`}
            title={displayValue}
          >
            {displayValue}
          </span>
          {pill && (
            <span
              title={pill}
              className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 tracking-wide whitespace-nowrap max-w-[135px] truncate ${
                isDarkMode
                  ? `${toneStyle.pillBgDark} ${toneStyle.pillTextDark}`
                  : `${toneStyle.pillBgLight} ${toneStyle.pillTextLight}`
              }`}
            >
              {pill}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
