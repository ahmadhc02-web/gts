const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

const target = `      updatedRows[rowIndex] = targetRow;

      // 1. Update local state immediately for instant UI feedback and snappy response
      if (currentMonthId) {
        lastLocalEditTime.current[currentMonthId] = Date.now();
      }
      setBillingMonths(prev => prev.map(m => m.id === currentMonthId ? { ...m, rows: updatedRows } : m));

      // 2. Persist to database in background
      pocketbaseService.saveBillingMonth(currentMonthId, updatedRows, currentUser.username || 'admin', activeDealerId).catch(err => {
         console.warn("Failed to background persist row edit:", err);
      });
    } catch (err) {
      console.error(err);
    }
  };`;

const replacement = `      updatedRows[rowIndex] = targetRow;

      // 1. Update local state immediately for instant UI feedback and snappy response
      if (currentMonthId) {
        lastLocalEditTime.current[currentMonthId] = Date.now();
      }
      setBillingMonths(prev => {
        const newPrev = prev.map(m => m.id === currentMonthId ? { ...m, rows: updatedRows } : m);
        // 2. Persist to database in background using the latest rows
        const latestDoc = newPrev.find(m => m.id === currentMonthId);
        if (latestDoc && latestDoc.rows) {
          pocketbaseService.saveBillingMonth(currentMonthId, latestDoc.rows, currentUser.username || 'admin', activeDealerId).catch(err => {
             console.warn("Failed to background persist row edit:", err);
          });
        }
        return newPrev;
      });
    } catch (err) {
      console.error(err);
    }
  };`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Patched successfully");
} else {
  console.log("Target not found!");
}
