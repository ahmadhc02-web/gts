const { sendMessage, normalizePakistaniPhone } = require('./baileysClient.cjs');

let supabase = null;
const activeLeadIds = new Set();
const cancelledLeadIds = new Set();

function cancelReminderLead(leadId) {
  if (!leadId) return;
  cancelledLeadIds.add(leadId);
  activeLeadIds.delete(leadId);
  console.log(`[Lead Processor] Lead ${leadId} cancellation/deletion registered`);
}

function init(supabaseClient) {
  supabase = supabaseClient;
  console.log('[Lead Processor] Initialized with Supabase client');
}

async function recordClientReminderSent(clientId, monthId) {
  if (!supabase || !clientId) return;
  try {
    const nowIso = new Date().toISOString();
    let query = supabase.from('billing_rows').select('id, reminder_sent_count');
    if (monthId) query = query.eq('month_id', monthId);
    query = query.or(`client_id.eq.${clientId},client_username.eq.${clientId}`);
    const { data: rows, error: selErr } = await query;
    if (selErr) {
      console.error('[Lead Processor] recordClientReminderSent select error:', selErr.message);
      return;
    }
    if (rows && rows.length > 0) {
      for (const r of rows) {
        await supabase
          .from('billing_rows')
          .update({
            reminder_sent_count: (Number(r.reminder_sent_count || 0)) + 1,
            reminder_sent_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', r.id);
      }
    }
  } catch (e) {
    console.error('[Lead Processor] recordClientReminderSent exception:', e.message);
  }
}

/**
 * Processes a reminder lead campaign sequentially on the server.
 * Handles item updates, delay waits, success/failure counts, and final completion.
 */
async function processReminderLead(leadId) {
  if (!leadId) return;
  if (!supabase) {
    console.error('[Lead Processor] Cannot process lead: Supabase not configured');
    return;
  }

  if (activeLeadIds.has(leadId)) {
    console.log(`[Lead Processor] Lead ${leadId} is already running in this process.`);
    return;
  }

  activeLeadIds.add(leadId);
  console.log(`[Lead Processor] Starting processing for lead ${leadId}`);

  try {
    // 1. Fetch lead metadata
    const { data: lead, error: leadErr } = await supabase
      .from('reminder_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      console.error(`[Lead Processor] Lead ${leadId} not found in database:`, leadErr?.message);
      return;
    }

    if (lead.status === 'completed') {
      console.log(`[Lead Processor] Lead ${leadId} is already completed.`);
      return;
    }

    let currentSuccessCount = Number(lead.success_count || 0);
    let currentFailedCount = Number(lead.failed_count || 0);
    const waitSeconds = Math.max(1, Number(lead.wait_seconds || 5));

    // 2. Transition pending -> running
    const { error: runErr } = await supabase
      .from('reminder_leads')
      .update({
        status: 'running',
        started_at: lead.started_at || new Date().toISOString()
      })
      .eq('id', leadId);
    if (runErr) {
      console.error(`[Lead Processor] Failed to set status=running for lead ${leadId}:`, runErr.message);
    }

    // 3. Fetch pending items sorted by sort_order
    const { data: items, error: itemsErr } = await supabase
      .from('reminder_lead_items')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'pending')
      .order('sort_order', { ascending: true });

    if (itemsErr) {
      console.error(`[Lead Processor] Failed to fetch items for lead ${leadId}:`, itemsErr.message);
      throw itemsErr;
    }

    if (!items || items.length === 0) {
      const finalStatus = currentSuccessCount > 0 ? 'completed' : (currentFailedCount > 0 ? 'failed' : 'completed');
      const { error: compErr } = await supabase
        .from('reminder_leads')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', leadId);
      if (compErr) console.error(`[Lead Processor] Failed to mark completed:`, compErr.message);
      console.log(`[Lead Processor] Lead ${leadId} has no pending items. Marked as ${finalStatus}.`);
      return;
    }

    console.log(`[Lead Processor] Processing ${items.length} pending items for lead ${leadId}`);

    // 4. Process items sequentially
    for (let i = 0; i < items.length; i++) {
      if (cancelledLeadIds.has(leadId)) {
        console.log(`[Lead Processor] Halting execution of deleted/cancelled lead ${leadId}`);
        cancelledLeadIds.delete(leadId);
        return;
      }

      const item = items[i];
      const isLastItem = (i === items.length - 1);
      const rawPhone = (item.mobile_number || '').trim();
      const messageText = item.message || 'Dear Customer, this is a reminder regarding your internet service bill due date. Thank you.';

      try {
        if (!rawPhone) {
          throw new Error('No mobile number available for client');
        }

        const normalizedPhone = normalizePakistaniPhone(rawPhone);
        console.log(`[Lead Processor] [${i + 1}/${items.length}] Sending to ${normalizedPhone} for lead ${leadId}...`);
        
        const sendResult = await sendMessage(normalizedPhone, messageText);
        if (!sendResult || sendResult.success === false) {
          throw new Error(sendResult?.error || 'WhatsApp send returned failure');
        }

        currentSuccessCount++;
        await recordClientReminderSent(item.client_id, lead.month_id);

        const { error: itemErr } = await supabase
          .from('reminder_lead_items')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', item.id);
        if (itemErr) {
          console.error(`[Lead Processor] Error updating item ${item.id} to sent:`, itemErr.message);
        }

        const { error: leadErr2 } = await supabase
          .from('reminder_leads')
          .update({
            success_count: currentSuccessCount,
            status: 'running'
          })
          .eq('id', leadId);
        if (leadErr2) {
          console.error(`[Lead Processor] Error updating success_count for lead ${leadId}:`, leadErr2.message);
        }

      } catch (err) {
        console.error(`[Lead Processor] Failed item ${item.id} (${rawPhone}) on lead ${leadId}:`, err.message);
        currentFailedCount++;

        const { error: itemErr } = await supabase
          .from('reminder_lead_items')
          .update({
            status: 'failed',
            error_message: err.message || 'Send failed'
          })
          .eq('id', item.id);
        if (itemErr) {
          console.error(`[Lead Processor] Error updating item ${item.id} to failed:`, itemErr.message);
        }

        const { error: leadErr2 } = await supabase
          .from('reminder_leads')
          .update({
            failed_count: currentFailedCount,
            status: 'running'
          })
          .eq('id', leadId);
        if (leadErr2) {
          console.error(`[Lead Processor] Error updating failed_count for lead ${leadId}:`, leadErr2.message);
        }
      }

      // Wait between messages if not the last item
      if (!isLastItem) {
        console.log(`[Lead Processor] Waiting ${waitSeconds}s before next item...`);
        for (let s = 0; s < waitSeconds; s++) {
          if (cancelledLeadIds.has(leadId)) {
            console.log(`[Lead Processor] Lead ${leadId} cancelled during interval.`);
            cancelledLeadIds.delete(leadId);
            return;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        const { error: waitErr } = await supabase
          .from('reminder_lead_items')
          .update({
            wait_seconds_after: waitSeconds
          })
          .eq('id', item.id);
        if (waitErr) {
          console.error(`[Lead Processor] Error updating wait_seconds_after for item ${item.id}:`, waitErr.message);
        }
      }
    }

    // 5. Check if any items are still pending before marking completed
    const { data: remainingPending } = await supabase
      .from('reminder_lead_items')
      .select('id')
      .eq('lead_id', leadId)
      .eq('status', 'pending');

    if (!remainingPending || remainingPending.length === 0) {
      const finalStatus = currentSuccessCount > 0 ? 'completed' : (currentFailedCount > 0 ? 'failed' : 'completed');
      const { error: finErr } = await supabase
        .from('reminder_leads')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', leadId);
      if (finErr) console.error(`[Lead Processor] Error marking lead final status:`, finErr.message);
      console.log(`[Lead Processor] Lead ${leadId} finished with status: ${finalStatus} (Success: ${currentSuccessCount}, Failed: ${currentFailedCount})`);
    }

  } catch (err) {
    console.error(`[Lead Processor] Unexpected error in processReminderLead for ${leadId}:`, err);
    await supabase
      .from('reminder_leads')
      .update({
        status: 'failed'
      })
      .eq('id', leadId)
      .catch(() => {});
  } finally {
    activeLeadIds.delete(leadId);
    cancelledLeadIds.delete(leadId);
  }
}

/**
 * Resumes leads that were left in 'running' status across server restarts.
 */
async function resumeInterruptedLeads() {
  if (!supabase) return;
  try {
    console.log('[Lead Processor] Checking for interrupted running leads...');
    const { data: runningLeads, error } = await supabase
      .from('reminder_leads')
      .select('id, name')
      .eq('status', 'running');

    if (error) {
      console.log('[Lead Processor] Startup leads check notice (no active leads to resume):', error.message);
      return;
    }

    if (runningLeads && runningLeads.length > 0) {
      console.log(`[Lead Processor] Found ${runningLeads.length} interrupted running lead(s). Resuming...`);
      for (const lead of runningLeads) {
        processReminderLead(lead.id).catch(err => {
          console.error(`[Lead Processor] Error resuming lead ${lead.id}:`, err);
        });
      }
    } else {
      console.log('[Lead Processor] No interrupted leads found.');
    }
  } catch (err) {
    console.error('[Lead Processor] Exception in resumeInterruptedLeads:', err);
  }
}

module.exports = {
  init,
  processReminderLead,
  cancelReminderLead,
  resumeInterruptedLeads,
  activeLeadIds
};
