import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { textQueue } from "./queues/text-queue.js";
import { imageQueue } from "./queues/image-queue.js";
import { config } from "./lib/config.js";

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

// Bull Board admin UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(textQueue), new BullMQAdapter(imageQueue)],
  serverAdapter,
});

// Admin queue dashboard — protected by basic auth
app.use(
  "/admin/queues",
  (req, res, next) => {
    const auth = req.headers["authorization"];
    if (!auth) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
      res.status(401).send("Authentication required");
      return;
    }
    const [scheme, encoded] = auth.split(" ");
    if (scheme !== "Basic" || !encoded) {
      res.status(401).send("Invalid auth");
      return;
    }
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [, pass] = decoded.split(":");
    if (pass !== config.adminPass) {
      res.status(401).send("Forbidden");
      return;
    }
    next();
  },
  serverAdapter.getRouter(),
);

app.use("/api", router);

export default app;
