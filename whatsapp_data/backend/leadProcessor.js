const { sendMessage } = require('./baileysClient');

let supabase = null;
const activeLeadIds = new Set();

function init(supabaseClient) {
  supabase = supabaseClient;
  console.log('[Lead Processor] Initialized with Supabase client');
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
    if (lead.status === 'pending') {
      await supabase
        .from('reminder_leads')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
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
      await supabase
        .from('reminder_leads')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
      console.log(`[Lead Processor] Lead ${leadId} has no pending items. Marked as ${finalStatus}.`);
      return;
    }

    console.log(`[Lead Processor] Processing ${items.length} pending items for lead ${leadId}`);

    // 4. Process items sequentially
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isLastItem = (i === items.length - 1);
      const phone = (item.mobile_number || '').trim();
      const messageText = item.message || 'Dear Customer, this is a reminder regarding your internet service bill due date. Thank you.';

      try {
        if (!phone) {
          throw new Error('No mobile number available for client');
        }

        console.log(`[Lead Processor] [${i + 1}/${items.length}] Sending to ${phone} for lead ${leadId}...`);
        await sendMessage(phone, messageText);

        currentSuccessCount++;
        const nowIso = new Date().toISOString();
        await supabase
          .from('reminder_lead_items')
          .update({
            status: 'sent',
            sent_at: nowIso,
            error_message: null,
            updated_at: nowIso
          })
          .eq('id', item.id);

        await supabase
          .from('reminder_leads')
          .update({
            success_count: currentSuccessCount,
            updated_at: nowIso
          })
          .eq('id', leadId);

        // Update billing_rows and billing_months to permanently reflect reminder sent
        if (item.client_id) {
          try {
            // 1. Update billing_rows table
            let query = supabase.from('billing_rows').select('id, reminder_sent_count');
            if (lead.month_id) {
              query = query.eq('month_id', lead.month_id);
            }
            query = query.or(`client_id.eq.${item.client_id},client_username.eq.${item.client_id}`);
            const { data: bRows } = await query;

            if (bRows && bRows.length > 0) {
              for (const br of bRows) {
                await supabase
                  .from('billing_rows')
                  .update({
                    reminder_sent_count: (Number(br.reminder_sent_count || 0)) + 1,
                    reminder_sent_at: nowIso,
                    updated_at: nowIso
                  })
                  .eq('id', br.id);
              }
            }

            // 2. Update billing_months JSON rows if month_id is specified
            if (lead.month_id) {
              const { data: bMonth } = await supabase
                .from('billing_months')
                .select('id, rows')
                .eq('id', lead.month_id)
                .single();

              if (bMonth && Array.isArray(bMonth.rows)) {
                let changed = false;
                const cleanPhone = (item.mobile_number || '').replace(/\D/g, '');
                const updatedRows = bMonth.rows.map(r => {
                  const rPhone = (r.mobileNumber || r.phone || '').replace(/\D/g, '');
                  const isMatch = (item.client_id && (r.clientId === item.client_id || r.id === item.client_id || r.username === item.client_id)) ||
                                  (cleanPhone && rPhone && (cleanPhone.endsWith(rPhone.slice(-7)) || rPhone.endsWith(cleanPhone.slice(-7))));
                  if (isMatch) {
                    changed = true;
                    return {
                      ...r,
                      reminderSentCount: (Number(r.reminderSentCount || 0)) + 1,
                      reminderSentAt: nowIso
                    };
                  }
                  return r;
                });
                if (changed) {
                  await supabase
                    .from('billing_months')
                    .update({
                      rows: updatedRows,
                      updated_at: nowIso
                    })
                    .eq('id', lead.month_id);
                }
              }
            }
          } catch (recErr) {
            console.warn('[Lead Processor] Warning updating client reminder row count:', recErr.message);
          }
        }

      } catch (err) {
        console.error(`[Lead Processor] Failed item ${item.id} (${phone}) on lead ${leadId}:`, err.message);
        currentFailedCount++;

        await supabase
          .from('reminder_lead_items')
          .update({
            status: 'failed',
            error_message: err.message || 'Send failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        await supabase
          .from('reminder_leads')
          .update({
            failed_count: currentFailedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', leadId);
      }

      // Wait between messages if not the last item
      if (!isLastItem) {
        console.log(`[Lead Processor] Waiting ${waitSeconds}s before next item...`);
        await new Promise(r => setTimeout(r, waitSeconds * 1000));
        await supabase
          .from('reminder_lead_items')
          .update({
            wait_seconds_after: waitSeconds,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
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
      await supabase
        .from('reminder_leads')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
      console.log(`[Lead Processor] Lead ${leadId} finished with status: ${finalStatus} (Success: ${currentSuccessCount}, Failed: ${currentFailedCount})`);
    }

  } catch (err) {
    console.error(`[Lead Processor] Unexpected error in processReminderLead for ${leadId}:`, err);
    await supabase
      .from('reminder_leads')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .catch(() => {});
  } finally {
    activeLeadIds.delete(leadId);
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
      console.warn('[Lead Processor] Failed to query running leads on startup:', error.message);
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
  resumeInterruptedLeads,
  activeLeadIds
};
