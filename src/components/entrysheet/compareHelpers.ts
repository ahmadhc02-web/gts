export function areRecordsShallowEqual(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function areFoldersEqual(prev: any[], next: any[]): boolean {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (!a || !b) return false;
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.parentId !== b.parentId ||
      a.connectedMonthId !== b.connectedMonthId ||
      a.createdAt !== b.createdAt ||
      a.updatedAt !== b.updatedAt ||
      a.updated_at !== b.updated_at ||
      a.updated !== b.updated ||
      a.lineCode !== b.lineCode
    ) {
      return false;
    }
  }
  return true;
}

export function areClientsEqual(prev: any[], next: any[]): boolean {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (!a || !b) return false;
    if (
      a.id !== b.id ||
      a.username !== b.username ||
      a.name !== b.name ||
      a.baseAmount !== b.baseAmount ||
      a.pkgDetails !== b.pkgDetails ||
      a.area !== b.area ||
      a.mobileNumber !== b.mobileNumber ||
      a.updatedAt !== b.updatedAt ||
      a.updated_at !== b.updated_at ||
      a.updated !== b.updated
    ) {
      return false;
    }
  }
  return true;
}

export function areLedgerSheetsEqual(prev: any[], next: any[]): boolean {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (!a || !b) return false;
    const updA = a.updated ?? a.updatedAt ?? a.updated_at ?? a.createdAt;
    const updB = b.updated ?? b.updatedAt ?? b.updated_at ?? b.createdAt;
    if (
      a.id !== b.id ||
      updA !== updB ||
      a.folderId !== b.folderId ||
      a.recOfficer !== b.recOfficer ||
      a.sheetDate !== b.sheetDate ||
      a.area !== b.area ||
      (Array.isArray(a.table1Rows) ? a.table1Rows.length : 0) !==
        (Array.isArray(b.table1Rows) ? b.table1Rows.length : 0) ||
      (Array.isArray(a.table2Rows) ? a.table2Rows.length : 0) !==
        (Array.isArray(b.table2Rows) ? b.table2Rows.length : 0)
    ) {
      return false;
    }
  }
  return true;
}
