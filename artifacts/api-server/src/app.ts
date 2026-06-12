import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Deployment healthcheck — must respond BEFORE the main router
// Replit probes GET /api; returning 200 here prevents startup failure
app.get("/api", (_req, res) => {
  res.json({ status: "ok" });
});

// Keep-alive health endpoint (pinged every 4 min by the bot to prevent sleep)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

app.use("/api", router);

export default app;
