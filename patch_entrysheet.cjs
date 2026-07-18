const fs = require('fs');
let content = fs.readFileSync('src/components/EntrySheet.tsx', 'utf8');

const target = `                        doc.setFont('Helvetica', 'bold');
                        doc.text(\`Date : \${formattedDate}\`, 85, 38);
                        doc.text(\`Time : \${displayTimeStr}\`, 85, 44);`;

const replacement = `                        const now = new Date();
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

content = content.replace(target, replacement);
fs.writeFileSync('src/components/EntrySheet.tsx', content);
console.log("Patched EntrySheet");
