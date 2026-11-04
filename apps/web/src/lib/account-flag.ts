/** Customer accounts stay hidden until a release review; read at runtime so one image fits every environment. */
export function customerAccountsEnabled(): boolean {
  return process.env.CUSTOMER_ACCOUNTS_ENABLED === "true";
}

/** Advisor Workspace needs accounts as well as its own flag. */
export function advisorWorkspaceEnabled(): boolean {
  return customerAccountsEnabled() && process.env.ADVISOR_WORKSPACE_ENABLED === "true";
}
