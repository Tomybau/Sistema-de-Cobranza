export async function register() {
  // Solo en el runtime de Node.js (no en Edge, no en el cliente)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBillingCron } = await import("@/jobs/billing-cron")
    startBillingCron()
  }
}
