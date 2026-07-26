const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const target = `            <motion.svg
              initial={{ opacity: 0.6 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              viewBox="0 0 1200 110"
              className="w-full max-w-4xl mx-auto h-auto select-none pointer-events-none opacity-85 dark:opacity-40"
              preserveAspectRatio="xMidYMid meet"
            >
              <text
                x="50%"
                y="52%"
                dominantBaseline="central"
                textAnchor="middle"
                fontFamily="Georgia, Cambria, 'Times New Roman', serif"
                fontSize="80"
                fontWeight="bold"
                fill="rgba(241, 245, 249, 0.75)"
                stroke="#94a3b8"
                strokeWidth="2.5"
                className="dark:fill-slate-900/50 dark:stroke-slate-600"
              >
                {brandingText}
              </text>
            </motion.svg>`;

const replace = `            <svg
              viewBox="0 0 1200 110"
              className="w-full max-w-4xl mx-auto h-auto select-none pointer-events-none opacity-85 dark:opacity-40"
              preserveAspectRatio="xMidYMid meet"
            >
              <motion.text
                x="50%"
                y="52%"
                dominantBaseline="central"
                textAnchor="middle"
                fontFamily="Georgia, Cambria, 'Times New Roman', serif"
                fontSize="80"
                fontWeight="bold"
                fill="rgba(241, 245, 249, 0.75)"
                stroke="#94a3b8"
                strokeWidth="2.5"
                className="dark:fill-slate-900/50 dark:stroke-slate-600"
                initial={{ strokeDasharray: "1000", strokeDashoffset: "1000" }}
                animate={{ strokeDashoffset: ["1000", "0", "1000"], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              >
                {brandingText}
              </motion.text>
            </svg>`;

const normalize = s => s.replace(/\s+/g, '');
if (normalize(code).includes(normalize(target))) {
   let startIdx = code.indexOf('            <motion.svg\n              initial={{ opacity: 0.6 }}');
   let endIdx = code.indexOf('              </text>\n            </motion.svg>') + '              </text>\n            </motion.svg>'.length;
   
   if(startIdx !== -1 && endIdx !== -1) {
       code = code.substring(0, startIdx) + replace + code.substring(endIdx);
       fs.writeFileSync('src/components/Layout.tsx', code);
       console.log('Replaced correctly');
   } else {
       console.log('Indexes not found, fallback needed');
   }
} else {
   console.log('Target not found');
}
