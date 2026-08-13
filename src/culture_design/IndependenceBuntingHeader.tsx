import React from 'react';
import { motion } from 'motion/react';

export const IndependenceBuntingHeader: React.FC = () => {
  const today = new Date();
  const month = today.getMonth(); // 7 for August
  const date = today.getDate();
  const isIndependencePeriod = month === 7 && date >= 4 && date <= 20;

  if (!isIndependencePeriod) {
    return null;
  }

  // 7 Bunting Flags along a U-shape curve across the header
  const flags = [
    { id: 1, x: 25, y: 5, angle: -12 },
    { id: 2, x: 88, y: 14, angle: -8 },
    { id: 3, x: 154, y: 19, angle: -4 },
    { id: 4, x: 225, y: 21, angle: 0 },
    { id: 5, x: 296, y: 19, angle: 4 },
    { id: 6, x: 362, y: 14, angle: 8 },
    { id: 7, x: 425, y: 5, angle: 12 },
  ];

  return (
    <div className="flex flex-col items-center justify-center relative w-full max-w-[500px] sm:max-w-[600px] md:max-w-[680px] h-16 select-none overflow-visible mx-auto pointer-events-auto">
      {/* Top Text Badge: Jashn-e-Azadi Mubarak (Placed safely below top edge) */}
      <div className="flex items-center justify-center gap-1.5 z-20 relative translate-y-1">
        <motion.span
          animate={{ scale: [1, 1.15, 1], rotate: [-6, 6, -6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="text-emerald-500 dark:text-emerald-400 font-extrabold text-xs leading-none drop-shadow-xs"
        >
          ☪
        </motion.span>

        <div className="flex items-center gap-1.5 bg-emerald-900/95 dark:bg-emerald-950/95 px-3 py-0.5 rounded-full border border-emerald-400/80 shadow-md backdrop-blur-md">
          <span className="text-[10px] sm:text-[11.5px] font-black uppercase tracking-wider text-white font-sans leading-none drop-shadow-xs">
            JASHN-E-AZADI MUBARAK
          </span>
          <span className="text-[10px] sm:text-[11.5px] font-extrabold text-amber-300 font-serif leading-none drop-shadow-xs">
            (جشنِ آزادی مبارک)
          </span>
        </div>

        <motion.span
          animate={{ scale: [1, 1.15, 1], rotate: [6, -6, 6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="text-emerald-500 dark:text-emerald-400 font-extrabold text-xs leading-none drop-shadow-xs"
        >
          ☪
        </motion.span>
      </div>

      {/* Bunting Banner SVG hanging below text */}
      <div className="relative w-full h-[36px] sm:h-[40px] translate-y-0.5 overflow-visible">
        <svg
          viewBox="0 0 450 52"
          className="w-full h-full block overflow-visible"
          shapeRendering="geometricPrecision"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Shallow U-Shaped Hanging Green & White String */}
          <path
            d="M 10,4 Q 225,28 440,4"
            fill="none"
            stroke="#01411C"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 10,4 Q 225,28 440,4"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeDasharray="3 2"
          />

          {/* End Knots */}
          <circle cx="10" cy="4" r="3" fill="#01411C" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="440" cy="4" r="3" fill="#01411C" stroke="#ffffff" strokeWidth="0.8" />

          {/* 7 Flags along the String */}
          {flags.map((flag, idx) => (
            <g key={flag.id} transform={`translate(${flag.x}, ${flag.y})`}>
              <motion.g
                animate={{
                  rotate: [flag.angle - 1.8, flag.angle + 2, flag.angle - 1.8],
                }}
                transition={{
                  duration: 2.2 + idx * 0.18,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: "top center" }}
              >
                {/* Flag Container (-11 to +11 width = 22px, height = 25px) */}
                <g transform="translate(-11, 0)">
                  {/* Top White Hanging Fold */}
                  <rect x="0" y="0" width="22" height="3" fill="#ffffff" rx="0.4" stroke="#cbd5e1" strokeWidth="0.3" />

                  {/* Deep Green Pennant Body with V-cut at bottom */}
                  <path
                    d="M 0,3 L 22,3 L 22,24 L 11,19 L 0,24 Z"
                    fill="#01411C"
                    stroke="#002b12"
                    strokeWidth="0.4"
                  />

                  {/* Pure White Bar on Left Side (Hoist) */}
                  <rect x="0" y="3" width="5.5" height="18.2" fill="#ffffff" />

                  {/* Clear Upright Crescent Moon & Star (Chand Tara) */}
                  {/* Crescent Moon */}
                  <path
                    d="M 11.2,10 A 4.5,4.5 0 1,0 16.8,16 A 3.6,3.6 0 1,1 11.2,10 Z"
                    fill="#ffffff"
                  />

                  {/* 5-Pointed Star facing top-right */}
                  <g transform="translate(16.2, 10.5) rotate(-15)">
                    <polygon
                      points="0,-2.2 0.7,-0.7 2.2,-0.7 1.0,0.3 1.4,1.7 0,0.9 -1.4,1.7 -1.0,0.3 -2.2,-0.7 -0.7,-0.7"
                      fill="#ffffff"
                    />
                  </g>
                </g>
              </motion.g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

export default IndependenceBuntingHeader;
