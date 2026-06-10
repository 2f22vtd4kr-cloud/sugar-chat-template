import app from "./app.js";
import { logger } from "./lib/logger.js";
import { seedCompanions } from "./lib/seed.js";
import { startBot } from "./bot/engine.js";
import { textWorker } from "./queues/text-queue.js";
import { imageWorker } from "./queues/image-queue.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Seed companion data on startup
seedCompanions().catch((err) => {
  logger.error({ err }, "Failed to seed companions");
});

// Start workers (they self-initialize via import)
logger.info("Text and image workers initialized");
void textWorker;
void imageWorker;

// Start Telegram bot
startBot();

app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
