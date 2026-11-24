const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission, getScopedQuery } = require('../rbac.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = supabase.from('radius_vlans').select('*');
    query = await getScopedQuery(req, query);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ vlans: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/suggest', authenticateToken, async (req, res, next) => {
  try {
    const dealerNo = req.query.dealerNo ? Number(req.query.dealerNo) : 10;
    const suggestedVlanId = 100 + dealerNo;
    res.json({ suggestedVlanId, dealerNo, rule: 'dealer_no + 100' });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('vlans.manage'), async (req, res, next) => {
  try {
    const { vlan_id, name, kind, dealer_uid, nas_id, pppoe_service, ip_pool, notes } = req.body;
    const vId = Number(vlan_id);
    if (vId < 2 || vId > 4093) return res.status(400).json({ error: 'VLAN ID must be between 2 and 4093' });

    const { data, error } = await supabase.from('radius_vlans').insert([{
      vlan_id: vId,
      name,
      kind: kind || 'dealer',
      dealer_uid: dealer_uid || null,
      nas_id: nas_id || null,
      pppoe_service: pppoe_service || 'PPPoE-Service',
      ip_pool: ip_pool || 'pool-1',
      notes: notes || '',
      line_id: req.user.lineId,
      created_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateToken, requirePermission('vlans.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    const { data, error } = await supabase.from('radius_vlans').update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, requirePermission('vlans.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('radius_vlans').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/routeros-script', authenticateToken, async (req, res, next) => {
  try {
    const vlanId = Number(req.query.vlanId || 10);
    const script = `/interface vlan add name=vlan${vlanId} vlan-id=${vlanId} interface=ether1\n/ip pool add name=pool-vlan${vlanId} ranges=10.10.${vlanId}.2-10.10.${vlanId}.254\n/ppp profile add name=profile-vlan${vlanId} local-address=10.10.${vlanId}.1 remote-address=pool-vlan${vlanId}`;
    res.json({ vlanId, script, note: 'RouterOS configuration script generated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
