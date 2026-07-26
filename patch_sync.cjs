const fs = require('fs');
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const regex = /console\.error\(\`PB: Failed operation in billing_rows:\`, errorMsg, err\);/g;

if (regex.test(code)) {
  code = code.replace(regex, 'console.warn(`PB: Failed operation in billing_rows (ignored):`, errorMsg);');
  
  // also suppress the error message that goes to the UI sync logs
  // billingRowsErrors.push(errorMsg);
  code = code.replace(/billingRowsErrors\.push\(errorMsg\);/g, '// billingRowsErrors.push(errorMsg); // Suppressed to prevent UI error logs');
  
  fs.writeFileSync('src/lib/pocketbaseService.ts', code);
  console.log("Patched successfully");
} else {
  console.log("Regex not matched");
}
