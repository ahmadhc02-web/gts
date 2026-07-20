const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf-8');

const target2 = `      updatedRows[rowIndex] = targetRow;

      // 1. Update local state immediately for instant UI feedback and snappy response
      setBillingMonths(prev => prev.map(m => m.id === currentMonthId ? { ...m, rows: updatedRows } : m));

      // 2. Persist permanently in PocketBase in background
      pocketbaseService.saveBillingMonth(currentMonthId, updatedRows, currentUser.username || 'admin', activeDealerId).catch(err => {
         console.error("Failed to persist billing cell edit:", err);
         toast.error("Cell auto-save issue", { description: "Changes may not have synced to cloud." });
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Cell local edit issue", { description: getCleanErrorMessage(err) });
    }
  };`;

const replacement2 = `      updatedRows[rowIndex] = targetRow;

      const newPrev = [...prev];
      newPrev[activeDocIndex] = { ...activeDoc, rows: updatedRows };
      
      // 2. Persist permanently in PocketBase in background using latest
      pocketbaseService.saveBillingMonth(currentMonthId, updatedRows, currentUser.username || 'admin', activeDealerId).catch(err => {
         console.error("Failed to persist billing cell edit:", err);
         toast.error("Cell auto-save issue", { description: "Changes may not have synced to cloud." });
      });
      
      return newPrev;
    }); // end of setBillingMonths
    } catch (err: any) {
      console.error(err);
      toast.error("Cell local edit issue", { description: getCleanErrorMessage(err) });
    }
  };`;

if (code.includes(target2)) {
  code = code.replace(target2, replacement2);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Patched successfully part 2");
} else {
  console.log("Target 2 not found!");
}
