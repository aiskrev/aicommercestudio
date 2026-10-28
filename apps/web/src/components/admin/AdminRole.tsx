"use client";

import { createContext, useContext } from "react";

import type { StaffRole } from "@/lib/admin-types";

/** The signed-in staff member's role. The API enforces it; the UI only hides what would be refused. */
export const AdminRoleContext = createContext<StaffRole>("admin");

export function useAdminRole(): StaffRole {
  return useContext(AdminRoleContext);
}
