import { Router } from "express";
import healthRouter from "./health.js";
import usersRouter from "./users.js";
import companionsRouter from "./companions.js";
import conversationsRouter from "./conversations.js";
import messagesRouter from "./messages.js";
import ledgerRouter from "./ledger.js";
import dashboardRouter from "./dashboard.js";
import plansRouter from "./plans.js";
import tarotRouter from "./tarot.js";
import shopRouter from "./shop.js";
import adminRouter from "./admin.js";

const router = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/companions", companionsRouter);
router.use("/conversations", conversationsRouter);
router.use("/conversations", messagesRouter);
router.use("/ledger", ledgerRouter);
router.use("/credits", ledgerRouter);
router.use("/dashboard", dashboardRouter);
router.use("/plans", plansRouter);
router.use("/tarot", tarotRouter);
router.use("/shop", shopRouter);
router.use("/admin", adminRouter);

export default router;
