// Define roles
const roles = {
  ADMIN: 'admin',
  CUSTOMER: 'customer'
};

// Define permissions for each role
const rolePermissions = {
  [roles.ADMIN]: [
    'create',       // add product
    'read',         // view product
    'update',       // edit product
    'delete',       // delete product
    'view_csv',     // download generated CSV reports
    'view_charts',  // view AI prediction charts
    'apply_ai'      // apply AI suggestions to update stock/prices
  ],
  [roles.CUSTOMER]: [
    'browse_product', // see available products
    'buy_product'     // purchase product
  ]
};

// Check if a role has permission for an action
const hasPermission = (role, action) => {
  return rolePermissions[role]?.includes(action);
};

module.exports = {
  roles,
  rolePermissions,
  hasPermission
};
