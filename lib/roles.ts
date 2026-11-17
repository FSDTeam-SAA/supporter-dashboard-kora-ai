export const SUPPORT_ROLES = ["supporter", "support_lead"] as const;

export function normalizeRole(role?: string | null) {
  return String(role ?? "").trim().toLowerCase();
}

export function isSupportRole(role?: string | null) {
  return (SUPPORT_ROLES as readonly string[]).includes(normalizeRole(role));
}

export function isSupportLead(role?: string | null) {
  return normalizeRole(role) === "support_lead";
}
