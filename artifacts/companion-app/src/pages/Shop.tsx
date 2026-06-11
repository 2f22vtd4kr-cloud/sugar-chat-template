import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { X, Info, ShoppingBag, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  creditsCost: number;
  category: "romantic" | "spicy" | "luxury" | "playful";
  gradient: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  romantic: "Romantic",
  spicy: "Spicy 🔥",
  luxury: "Luxury",
  playful: "Playful",
};

export default function Shop() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { toast } = useToast();
  const qc = useQueryClient();

  const [infoItem, setInfoItem] = useState<ShopItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: items = [] } = useQuery<ShopItem[]>({
    queryKey: ["shop", "items"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/shop/items`).then((r) => r.json()),
  });

  const purchaseMutation = useMutation({
    mutationFn: (itemId: string) =>
      fetch(`${import.meta.env.BASE_URL}api/shop/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Purchase failed");
        return data;
      }),
    onSuccess: (data) => {
      haptic("heavy");
      toast({ title: `${data.item.emoji} ${data.item.name} received!`, description: `Balance: ${data.newCreditBalance} cr` });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setConfirmItem(null);
    },
    onError: (err: Error) => {
      haptic("heavy");
      toast({ variant: "destructive", title: err.message === "Insufficient credits" ? t("shop.not_enough") : t("shop.purchase_failed") });
      setConfirmItem(null);
    },
  });

  const filtered = activeCategory === "all" ? items : items.filter((i) => i.category === activeCategory);
  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category)))];

  return (
    <AppLayout>
      <div className="p-4 pt-8 pb-6 space-y-5">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif text-gradient-red">{t("shop.title")}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t("shop.subtitle")}</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.25)" }}>
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">{user?.credits ?? "—"}</span>
            </div>
          </div>
        </motion.header>

        {/* Category filter */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button key={cat}
              onClick={() => { setActiveCategory(cat); haptic("light"); }}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                activeCategory === cat
                  ? "text-white"
                  : "bg-white/5 text-muted-foreground border border-white/10"
              )}
              style={activeCategory === cat
                ? { background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 12px rgba(225,29,72,0.45)" }
                : undefined}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {filtered.map((item) => (
            <motion.div
              key={item.id}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: "rgba(28, 14, 16, 0.55)",
                border: "1px solid rgba(225, 29, 72, 0.18)",
                backdropFilter: "blur(16px)",
              }}
            >
              {/* Name row */}
              <div className="flex items-start justify-between gap-1 px-3 pt-3 pb-1">
                <span className="text-sm font-semibold text-foreground leading-tight">{item.name}</span>
                <button
                  onClick={() => { setInfoItem(item); haptic("light"); }}
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Emoji image */}
              <div className="flex items-center justify-center py-5 mx-3 rounded-xl my-2"
                style={{ background: `linear-gradient(${item.gradient})`, minHeight: "7rem" }}>
                <span className="text-[3.5rem] drop-shadow-lg select-none">{item.emoji}</span>
              </div>

              {/* Buy button */}
              <button
                onClick={() => { setConfirmItem(item); haptic("medium"); }}
                className="mx-3 mb-3 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95"
                style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 16px rgba(225,29,72,0.28)" }}
              >
                {item.creditsCost} 💎
              </button>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Info modal */}
      <AnimatePresence>
        {infoItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setInfoItem(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl p-6 space-y-4"
              style={{ background: "rgba(20, 8, 10, 0.95)", border: "1px solid rgba(225,29,72,0.3)", backdropFilter: "blur(24px)" }}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
                  style={{ background: `linear-gradient(${infoItem.gradient})` }}>
                  {infoItem.emoji}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-serif text-gradient-red">{infoItem.name}</h3>
                  <p className="text-xs text-primary font-semibold">{infoItem.creditsCost} 💎 credits</p>
                </div>
                <button onClick={() => setInfoItem(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{infoItem.description}</p>
              <button
                onClick={() => { setConfirmItem(infoItem); setInfoItem(null); haptic("medium"); }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 20px rgba(225,29,72,0.35)" }}
              >
                {t("shop.buy_now")} — {infoItem.creditsCost} 💎
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm purchase modal */}
      <AnimatePresence>
        {confirmItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !purchaseMutation.isPending && setConfirmItem(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl p-6 space-y-4"
              style={{ background: "rgba(20, 8, 10, 0.95)", border: "1px solid rgba(225,29,72,0.3)", backdropFilter: "blur(24px)" }}
            >
              <div className="text-center space-y-2">
                <div className="text-5xl mb-2">{confirmItem.emoji}</div>
                <h3 className="text-lg font-serif text-gradient-red">{t("shop.confirm_title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {confirmItem.name} — <span className="text-primary font-bold">{confirmItem.creditsCost} 💎</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("shop.balance_after")}: {Math.max(0, (user?.credits ?? 0) - confirmItem.creditsCost)} 💎
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmItem(null)}
                  disabled={purchaseMutation.isPending}
                  className="py-3 rounded-xl text-sm font-semibold text-muted-foreground bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {t("shop.cancel")}
                </button>
                <button
                  onClick={() => purchaseMutation.mutate(confirmItem.id)}
                  disabled={purchaseMutation.isPending || (user?.credits ?? 0) < confirmItem.creditsCost}
                  className="py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 16px rgba(225,29,72,0.3)" }}
                >
                  {purchaseMutation.isPending ? "..." : t("shop.confirm_buy")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
