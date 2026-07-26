const fs = require('fs');
let code = fs.readFileSync('src/lib/pocketbaseService.ts', 'utf8');

const replacement = `
  _billingMonthExecutionLocks: {} as Record<string, Promise<void>>,
  _syncingMonths: new Set<string>(),

  async _executeSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main') {
    const syncKey = \`\${monthId}_\${dealerId}\`;
    if (!this._billingMonthExecutionLocks) this._billingMonthExecutionLocks = {};
    const previous = this._billingMonthExecutionLocks[syncKey] || Promise.resolve();
    const run = previous.then(() => this._doExecuteSaveBillingMonth(monthId, rows, updatedBy, dealerId));
    this._billingMonthExecutionLocks[syncKey] = run.catch(() => {});
    return run;
  },

  async _doExecuteSaveBillingMonth(monthId: string, rows: any[], updatedBy: string, dealerId: string = 'main') {
    const syncKey = \`\${monthId}_\${dealerId}\`;
    if (!this._syncingMonths) this._syncingMonths = new Set<string>();
    this._syncingMonths.add(syncKey);

    const logEntry = this.addSyncLog('billing_months', 'sync', 'pending', \`Month: \${monthId}, Dealer: \${dealerId}, Rows count: \${rows.length}\`);
    try {
      const filter = \`month_id = "\${monthId}" && dealer_id = "\${dealerId}"\`;
`;
code = code.replace(/async _executeSaveBillingMonth\(monthId: string, rows: any\[\], updatedBy: string, dealerId: string = 'main'\) \{\n    const logEntry = this\.addSyncLog\('billing_months', 'sync', 'pending', `Month: \$\{monthId\}, Dealer: \$\{dealerId\}, Rows count: \$\{rows\.length\}`\);\n    try \{\n      const filter = `month_id = "\$\{monthId\}" && dealer_id = "\$\{dealerId\}"`;/, replacement);

code = code.replace(/      await this\.syncBillingRows\(monthId, dealerId, rows\);\n      console\.log\("PB: Sync of billing_rows completed successfully\."\);\n    \} catch \(e: any\) \{/, `      await this.syncBillingRows(monthId, dealerId, rows);
      console.log("PB: Sync of billing_rows completed successfully.");
    } catch (e: any) {`);

code = code.replace(/    } catch \(e: any\) \{\n      console\.error\("PB: Failed to save billing month", e\);\n      logEntry\.status = 'failed';\n      logEntry\.errorMessage = e\.message \|\| String\(e\);\n      this\.saveSyncLogsLocally\(\);\n    \}\n  \},/, `    } catch (e: any) {
      console.error("PB: Failed to save billing month", e);
      logEntry.status = 'failed';
      logEntry.errorMessage = e.message || String(e);
      this.saveSyncLogsLocally();
    } finally {
      if (this._syncingMonths) {
        this._syncingMonths.delete(syncKey);
      }
    }
  },`);

code = code.replace(/      activeSyncingMonths\.add\(monthId\);\n/g, '');
code = code.replace(/    \} finally \{\n      activeSyncingMonths\.delete\(monthId\);\n    \}\n/g, '    }\n');

fs.writeFileSync('src/lib/pocketbaseService.ts', code);
