const fs = require('fs');
let content = fs.readFileSync('src/components/EntrySheet.tsx', 'utf8');

const target = `                        const now = new Date();
                        let hours = now.getHours();
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12; 
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const formattedTime = \`\${String(hours).padStart(2, '0')}:\${minutes}\${ampm}\`;
                        const shift = (now.getHours() >= 6 && now.getHours() < 18) ? 'Day' : 'Night';
                        const timeStr = \`\${formattedTime} - \${shift}\`;

                        doc.setFont('Helvetica', 'bold');
                        doc.text(\`Date : \${formattedDate}\`, 85, 38);
                        doc.text(\`Time : \${timeStr}\`, 85, 44);`;

const replacement = `                        {
                            const d_now = new Date();
                            let d_hours = d_now.getHours();
                            const d_ampm = d_hours >= 12 ? 'PM' : 'AM';
                            d_hours = d_hours % 12;
                            d_hours = d_hours ? d_hours : 12; 
                            const d_minutes = String(d_now.getMinutes()).padStart(2, '0');
                            const d_formattedTime = \`\${String(d_hours).padStart(2, '0')}:\${d_minutes}\${d_ampm}\`;
                            const d_shift = (d_now.getHours() >= 6 && d_now.getHours() < 18) ? 'Day' : 'Night';
                            const d_timeStr = \`\${d_formattedTime} - \${d_shift}\`;

                            doc.setFont('Helvetica', 'bold');
                            doc.text(\`Date : \${formattedDate}\`, 85, 38);
                            doc.text(\`Time : \${d_timeStr}\`, 85, 44);
                        }`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/EntrySheet.tsx', content);
console.log("Patched scope in EntrySheet");
