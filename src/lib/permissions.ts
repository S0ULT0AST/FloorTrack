export const PERMISSIONS = [
  "viewInventory",
  "addItems",
  "editItems",
  "moveItems",
  "markSold",
  "viewSoldList",
  "markVerified",
  "addNotes",
  "overrideLocks",
  "initiateTransfer",
  "verifyTransfer",
  "viewTransferHistory",
  "viewMap",
  "editLayout",
  "viewLogs",
  "manageUsers",
  "manageRoles",
  "viewAudit",
  "viewLocations",
  "manageLocations",
  "deleteLocations",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionMap = Record<Permission, boolean>;

export const STAFF_ROLES = [
  { key: "admin", name: "Admin" },
  { key: "manager", name: "Manager" },
  { key: "warehouse", name: "Warehouse" },
  { key: "sales", name: "Sales" },
] as const;

export type StaffRoleKey = (typeof STAFF_ROLES)[number]["key"];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function can(
  permissions: Partial<Record<string, boolean>> | null | undefined,
  permission: Permission,
) {
  return Boolean(permissions?.[permission]);
}
