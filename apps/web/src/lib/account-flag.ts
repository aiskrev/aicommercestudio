/** Customer accounts stay hidden until a release review; read at runtime so one image fits every environment. */
export function customerAccountsEnabled(): boolean {
  return process.env.CUSTOMER_ACCOUNTS_ENABLED === "true";
}
