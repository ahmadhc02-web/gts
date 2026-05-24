/**
 * Utility to parse 'Team Resolution Protocol' (remarks) text
 * and return step completion percentage & step text indicator.
 */

export function calculateProtocolProgress(remarks?: string): { percentage: number; stepText: string } {
  if (!remarks || remarks.trim() === '') {
    return { percentage: 0, stepText: '' };
  }

  const text = remarks.toLowerCase();

  // 1. Check for explicit percent numbers (e.g., "60%", "progress: 40%")
  const percentMatch = remarks.match(/\b(\d+)\s*%/);
  if (percentMatch) {
    const pct = parseInt(percentMatch[1], 10);
    if (pct >= 0 && pct <= 100) {
      return { percentage: pct, stepText: `Progress: ${pct}%` };
    }
  }

  // 2. Check for markdown-like checklist (e.g., [x] item 1, [ ] item 2)
  const checklistMatches = remarks.match(/\[([ xX])\]/g);
  if (checklistMatches && checklistMatches.length > 0) {
    const total = checklistMatches.length;
    const checked = checklistMatches.filter(m => m.toLowerCase().includes('x')).length;
    const pct = Math.round((checked / total) * 100);
    return { percentage: pct, stepText: `Steps: ${checked}/${total} (${pct}%)` };
  }

  // 3. Check for fractional steps (e.g., "Step 2/4", "step 3 of 5", "phase 1/3")
  const fractionalMatch = remarks.match(/(?:step|phase|stage|task)?\s*(\d+)\s*(?:\/|of)\s*(\d+)/i);
  if (fractionalMatch) {
    const current = parseInt(fractionalMatch[1], 10);
    const total = parseInt(fractionalMatch[2], 10);
    if (total > 0 && current <= total) {
      const pct = Math.round((current / total) * 100);
      return { percentage: pct, stepText: `Step ${current}/${total} (${pct}%)` };
    }
  }

  // 4. Check for standalone single-step mentions (e.g., "Step 3", "Phase 2")
  const singleStepMatch = remarks.match(/(?:step|phase|stage)\s*(\d+)/i);
  if (singleStepMatch) {
    const step = parseInt(singleStepMatch[1], 10);
    // Let's assume 4 steps by default
    const assumedTotal = 4;
    const pct = Math.min(100, Math.round((step / assumedTotal) * 100));
    return { percentage: pct, stepText: `Step ${step} of ${assumedTotal} (${pct}%)` };
  }

  // 5. Look for lines or bullet points to guess progress:
  // E.g., count finished keywords vs total steps
  const sentences = remarks.split(/[.\n;]/).map(s => s.trim()).filter(s => s.length > 0);
  if (sentences.length > 1) {
    let completedCount = 0;
    const completionKeywords = ['done', 'ok', 'resolved', 'success', 'complete', 'finished', 'patched', 'fixed', 'active', 'swapped', 'replaced'];
    sentences.forEach(s => {
      const sLower = s.toLowerCase();
      if (completionKeywords.some(kw => sLower.includes(kw))) {
        completedCount++;
      }
    });
    if (completedCount > 0) {
      const pct = Math.round((completedCount / sentences.length) * 100);
      return { percentage: pct, stepText: `Subtasks: ${completedCount}/${sentences.length} (${pct}%)` };
    }
  }

  // 6. If none matches, check keywords in remarks for general progress level
  if (text.includes('complete') || text.includes('resolved') || text.includes('finished') || text.includes('done')) {
    return { percentage: 90, stepText: 'Nearing Completion (90%)' };
  }
  if (text.includes('testing') || text.includes('verifying') || text.includes('investigating')) {
    return { percentage: 60, stepText: 'Testing Stage (60%)' };
  }
  if (text.includes('progress') || text.includes('working') || text.includes('fixing')) {
    return { percentage: 40, stepText: 'In Progress (40%)' };
  }
  if (text.includes('started') || text.includes('assigned') || text.includes('received')) {
    return { percentage: 25, stepText: 'Started (25%)' };
  }

  // Default fallback if there's remarks but can't match specific step info
  return { percentage: 0, stepText: '' };
}
