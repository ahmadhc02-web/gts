const { supabase } = require('./db.cjs');

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (user.radiusRole === 'SuperAdmin' || (user.permissions && user.permissions.includes('*'))) {
      return next();
    }

    if (user.permissions && user.permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({ error: `Forbidden: Missing required permission [${permissionKey}]` });
  };
}

async function getScopedQuery(req, queryBuilder, tableAlias = '') {
  const user = req.user;
  if (!user) return queryBuilder;

  const prefix = tableAlias ? `${tableAlias}.` : '';

  if (user.radiusRole === 'SuperAdmin') {
    const selectedLine = req.headers['x-radius-line'];
    if (selectedLine && selectedLine !== 'all') {
      return queryBuilder.eq(`${prefix}line_id`, selectedLine);
    }
    return queryBuilder;
  }

  if (user.radiusRole === 'Owner') {
    if (user.lineId) {
      return queryBuilder.eq(`${prefix}line_id`, user.lineId);
    }
  } else if (user.radiusRole === 'Dealer') {
    if (user.lineId && user.sub) {
      return queryBuilder.eq(`${prefix}line_id`, user.lineId).eq(`${prefix}dealer_uid`, user.sub);
    }
  } else if (user.radiusRole === 'DealerStaff') {
    if (user.lineId && user.parentUid) {
      return queryBuilder.eq(`${prefix}line_id`, user.lineId).eq(`${prefix}dealer_uid`, user.parentUid);
    }
  } else if (user.radiusRole === 'Member') {
    if (user.scope && user.scope.all) {
      return queryBuilder;
    }
    if (user.lineId) {
      queryBuilder = queryBuilder.eq(`${prefix}line_id`, user.lineId);
    }
    if (user.scope && Array.isArray(user.scope.dealerUids) && user.scope.dealerUids.length > 0) {
      queryBuilder = queryBuilder.in(`${prefix}dealer_uid`, user.scope.dealerUids);
    }
    if (user.scope && Array.isArray(user.scope.vlanIds) && user.scope.vlanIds.length > 0) {
      queryBuilder = queryBuilder.in(`${prefix}vlan_id`, user.scope.vlanIds);
    }
  }

  return queryBuilder;
}

module.exports = { requirePermission, getScopedQuery };
