// Permissions for each role
const permissions = {
  admin: ['create', 'read', 'update', 'delete', 'browse_product', 'buy_product', 'view_csv', 'view_charts', 'apply_ai'],
  customer: ['browse_product', 'buy_product']
};

function requirePermission(action) {
  return (req, res, next) => {
    const userRole = req.user.role;
    if (!permissions[userRole] || !permissions[userRole].includes(action)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
}

module.exports = requirePermission;
