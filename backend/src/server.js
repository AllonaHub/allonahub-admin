import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

try {
  await app.listen({ host: "0.0.0.0", port: config.port });
  app.log.info({ port: config.port }, "AllonaHub backend API started");
} catch (error) {
  app.log.error(error, "Backend API failed to start");
  process.exit(1);
}
