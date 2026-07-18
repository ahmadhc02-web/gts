const fs = require('fs');
let content = fs.readFileSync('src/lib/firebaseService.ts', 'utf8');

function addSyncAfter(content, searchStr, syncCode) {
  if (!content.includes(syncCode.trim().split('\n')[0])) {
    return content.replace(searchStr, searchStr + '\n      ' + syncCode);
  }
  return content;
}

// 1. createComplaint
content = addSyncAfter(
  content,
  `const { error } = await supabase.from('complaints').insert(dbRow);\n      if (error) throw error;`,
  `pocketbaseService.saveComplaint(clientComplaint, clientComplaint.dealerId || 'main').catch(e => console.warn("PB skip", e));`
);

// 2. deleteComplaint
content = addSyncAfter(
  content,
  `const { error } = await supabase.from('complaints').delete().eq('id', id);\n      if (error) throw error;`,
  `// Fetch to get tenant if possible? We don't have it here easily unless we fetch before delete. But we can just try to delete on 'main' or skip it since we can't get tenant easily. Actually, in deleteComplaint, let's fetch it first.`
);

content = content.replace(
  `const { error } = await supabase.from('complaints').delete().eq('id', id);`,
  `const { data: exComp } = await supabase.from('complaints').select('dealer_id').eq('id', id).maybeSingle();
      const tenantId = exComp?.dealer_id || 'main';
      const { error } = await supabase.from('complaints').delete().eq('id', id);
      pocketbaseService.deleteComplaint(id, tenantId).catch(e => console.warn("PB skip", e));`
);

// For updates: updateComplaintStatus, updateComplaintAdmin, updateComplaint
// We need to fetch the full updated row and sync it.
function patchUpdate(content, functionName) {
  const rgx = new RegExp(`(const { error } = await supabase\\.from\\('complaints'\\)\\.update\\(dbRow\\)\\.eq\\('id', id\\);\\s*if \\(error\\) throw error;)`, 'g');
  return content.replace(rgx, `$1\n      const { data: fullComp } = await supabase.from('complaints').select('*').eq('id', id).maybeSingle();\n      if (fullComp) pocketbaseService.saveComplaint(fromDb('complaints', fullComp), fullComp.dealer_id || 'main').catch(e => console.warn("PB skip", e));`);
}

content = patchUpdate(content);

// For restoreFromRecycleBin
content = content.replace(
  `await supabase.from('complaints').upsert(dbRow);`,
  `await supabase.from('complaints').upsert(dbRow);\n        pocketbaseService.saveComplaint(originalData, originalData.dealerId || 'main').catch(e=>console.warn("PB skip",e));`
);

fs.writeFileSync('src/lib/firebaseService.ts', content);
