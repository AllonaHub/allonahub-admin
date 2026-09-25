import { buildApp } from "./app.js";
import { config } from "./config.js";
import { supabaseAdmin } from "./lib/supabase.js";
import { deliverDueMaritimeAdminNotifications } from "./lib/maritime-admin-notifications.js";

const app = await buildApp();

try {
  await app.listen({ host: "0.0.0.0", port: config.port });
  app.log.info({ port: config.port }, "AllonaHub backend API started");
  if (config.maritimeAdminNotifications.enabled && config.maritimeAdminNotifications.resendApiKey) {
    const timer = setInterval(() => {
      deliverDueMaritimeAdminNotifications({ supabase: supabaseAdmin }).catch((error) => {
        app.log.warn({ code: error?.code || "ADMIN_EMAIL_RETRY_FAILED" }, "Maritime email retry failed");
      });
    }, 60000);
    timer.unref();
  }
} catch (error) {
  app.log.error(error, "Backend API failed to start");
  process.exit(1);
}
