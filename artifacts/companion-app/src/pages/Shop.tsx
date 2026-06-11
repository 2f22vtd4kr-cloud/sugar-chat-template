import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Coins, Package, Zap, Flame } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  creditsCost: number;
  baseCreditsCost: number;
  category: "romantic" | "spicy" | "kinky" | "luxury" | "playful";
  gradient: string;
  affinityGain: number;
  flashSaleActive?: boolean;
  flashDiscountPct?: number;
}

interface PurchaseResult {
  success: boolean;
  item: ShopItem;
  newCreditBalance: number;
  purchaseId: string;
  flashSaleApplied: boolean;
  discountPct: number;
}

// ── Item Art — real product photos with emoji fallback ─────────────────────
function ItemArt({ itemId, emoji }: { itemId: string; emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="text-4xl select-none flex-shrink-0">{emoji}</span>;
  }
  return (
    <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-white/5">
      <img
        src={`/shop/${itemId}.png`}
        alt={itemId}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ── Flash badge ───────────────────────────────────────────────────────────────
function FlashBadge({ pct }: { pct: number }) {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flash-badge flash-pulse"
    >
      <Zap className="w-2 h-2" />
      -{Math.round(pct * 100)}%
    </motion.span>
  );
}

// ── Category tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { id: "all",      label: "All",     icon: "✦" },
  { id: "romantic", label: "Romantic",icon: "🌹" },
  { id: "spicy",    label: "Spicy",   icon: "🌶️" },
  { id: "kinky",    label: "Kinky",   icon: "🔮" },
  { id: "luxury",   label: "Luxury",  icon: "👑" },
  { id: "playful",  label: "Playful", icon: "🐱" },
] as const;
type Tab = typeof TABS[number]["id"];

// ── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, onClick }: { item: ShopItem; onClick: () => void }) {
  const isDiscounted = item.flashSaleActive && item.creditsCost < item.baseCreditsCost;
  const isKinky      = item.category === "kinky";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden cursor-pointer active:opacity-90 ${isKinky ? "kinky-card" : ""}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${isKinky ? "rgba(168,85,247,0.22)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {/* Color band */}
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(${item.gradient})` }} />

      {isDiscounted && item.flashDiscountPct && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <FlashBadge pct={item.flashDiscountPct} />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <ItemArt itemId={item.id} emoji={item.emoji} />
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-semibold text-sm leading-tight">{item.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{item.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            {isDiscounted && (
              <span className="text-[10px] text-muted-foreground/50 line-through">{item.baseCreditsCost}</span>
            )}
            <div className="flex items-center gap-1">
              <Coins className="w-3 h-3" style={{ color: isDiscounted ? "#fbbf24" : "hsl(348 76% 65%)" }} />
              <span className="font-bold text-sm" style={{ color: isDiscounted ? "#fcd34d" : "hsl(348 76% 65%)" }}>
                {item.creditsCost}
              </span>
            </div>
          </div>
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(225,29,72,0.09)", border: "1px solid rgba(225,29,72,0.18)", color: "hsl(348 76% 65%)" }}
          >
            +{item.affinityGain} bond
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Purchase Modal ────────────────────────────────────────────────────────────
function PurchaseModal({
  item, credits, onConfirm, onClose, isPending,
}: {
  item: ShopItem; credits: number; onConfirm: () => void; onClose: () => void; isPending: boolean;
}) {
  const { t } = useTranslation();
  const isDiscounted = item.flashSaleActive && item.creditsCost < item.baseCreditsCost;
  const balanceAfter = credits - item.creditsCost;
  const canAfford    = balanceAfter >= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%", scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: "100%", scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-md rounded-t-3xl overflow-hidden"
        style={{ background: "#0e0408", border: "1px solid rgba(225,29,72,0.22)", borderBottom: "none" }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-5" style={{ background: "rgba(255,255,255,0.14)" }} />

        <div className="px-5 pb-8">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(${item.gradient})`, opacity: 0.9 }}
            >
              <ItemArt itemId={item.id} emoji={item.emoji} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-bold text-lg leading-tight">{item.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
              {isDiscounted && item.flashDiscountPct && (
                <div className="mt-1.5"><FlashBadge pct={item.flashDiscountPct} /></div>
              )}
            </div>
          </div>

          <div
            className="rounded-2xl p-4 mb-5 space-y-2.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("shop.confirm_title")}</span>
              <div className="flex items-baseline gap-1.5">
                {isDiscounted && (
                  <span className="text-xs text-muted-foreground/50 line-through">{item.baseCreditsCost} cr</span>
                )}
                <span className="font-bold" style={{ color: isDiscounted ? "#fcd34d" : "hsl(348 76% 65%)" }}>
                  {item.creditsCost} cr
                </span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("shop.balance_after")}</span>
              <span className={`font-bold ${canAfford ? "" : "text-red-400"}`}>{balanceAfter} cr</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bond gain</span>
              <span className="font-bold" style={{ color: "hsl(348 76% 65%)" }}>+{item.affinityGain}</span>
            </div>
          </div>

          {!canAfford && (
            <p className="text-xs text-red-400 text-center mb-4">{t("shop.not_enough")}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl font-semibold text-sm transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              {t("shop.cancel")}
            </button>
            <button
              disabled={!canAfford || isPending}
              onClick={onConfirm}
              className="flex-1 h-12 rounded-2xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: canAfford
                  ? "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))"
                  : "rgba(255,255,255,0.08)",
                boxShadow: canAfford ? "0 0 20px rgba(225,29,72,0.35)" : "none",
              }}
            >
              {isPending
                ? <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                : <><Coins className="w-4 h-4" />{t("shop.confirm_buy")}</>
              }
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShopPage() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab]               = useState<Tab>("all");
  const [selected, setSelected]     = useState<ShopItem | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | undefined>();
  const [credits, setCredits]       = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/users/me`)
      .then((r) => r.json())
      .then((u) => setCredits(u.credits ?? 0))
      .catch(() => {});
  }, []);

  const { data: items = [], isLoading } = useQuery<ShopItem[]>({
    queryKey: ["shop-items"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/shop/items`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const intentMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const r = await fetch(`${import.meta.env.BASE_URL}api/shop/checkout-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      return r.ok ? (r.json() as Promise<{ checkoutId: string }>) : null;
    },
    onSuccess: (data) => { if (data?.checkoutId) setCheckoutId(data.checkoutId); },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const r = await fetch(`${import.meta.env.BASE_URL}api/shop/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, checkoutId }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Purchase failed");
      return r.json() as Promise<PurchaseResult>;
    },
    onSuccess: (data) => {
      haptic("heavy");
      setCredits(data.newCreditBalance);
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["shop-items"] });
      toast({
        title: `${data.item.emoji} ${data.item.name} added to inventory!`,
        description: data.flashSaleApplied
          ? `Flash sale — saved ${data.item.baseCreditsCost - data.item.creditsCost} cr 🔥`
          : `+${data.item.affinityGain} bond`,
      });
      setSelected(null);
      setCheckoutId(undefined);
    },
    onError: (err: Error) => {
      haptic("light");
      toast({ variant: "destructive", title: t("shop.purchase_failed"), description: err.message });
    },
  });

  const handlePick = (item: ShopItem) => {
    haptic("medium");
    setSelected(item);
    intentMutation.mutate(item.id);
  };

  const filtered   = tab === "all" ? items : items.filter((i) => i.category === tab);
  const flashActive = items.some((i) => i.flashSaleActive);

  return (
    <AppLayout>
      <div className="min-h-[100dvh] flex flex-col">

        {/* Header */}
        <header
          className="sticky top-0 z-40 px-4 pt-3 pb-0 border-b glass-header"
          style={{ borderBottomColor: "rgba(225,29,72,0.15)" }}
        >
          <div className="flex items-center justify-between pb-3">
            <div>
              <h1 className="font-serif font-bold text-lg">{t("shop.title")}</h1>
              <p className="text-[10px] text-muted-foreground">{t("shop.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { haptic("light"); navigate("/inventory"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                <Package className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("shop.my_items")}</span>
              </button>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(225,29,72,0.10)", border: "1px solid rgba(225,29,72,0.22)" }}
              >
                <Coins className="w-3.5 h-3.5" style={{ color: "hsl(348 76% 65%)" }} />
                <span className="text-xs font-bold" style={{ color: "hsl(348 76% 65%)" }}>{credits}</span>
              </div>
            </div>
          </div>

          {/* Flash sale banner */}
          <AnimatePresence>
            {flashActive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  <Flame className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
                  <p className="text-xs font-semibold" style={{ color: "#fcd34d" }}>{t("shop.flash_active")}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category tabs */}
          <div ref={tabsRef} className="flex gap-2 pb-3 overflow-x-auto scrollbar-none">
            {TABS.map(({ id, label, icon }) => {
              const active  = tab === id;
              const isKinky = id === "kinky";
              return (
                <motion.button
                  key={id}
                  onClick={() => { haptic("light"); setTab(id); }}
                  whileTap={{ scale: 0.93 }}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: active ? (isKinky ? "rgba(168,85,247,0.24)" : "rgba(225,29,72,0.21)") : "rgba(255,255,255,0.05)",
                    border: active ? `1px solid ${isKinky ? "rgba(168,85,247,0.50)" : "rgba(225,29,72,0.42)"}` : "1px solid rgba(255,255,255,0.08)",
                    color: active ? (isKinky ? "#d8b4fe" : "hsl(348 76% 72%)") : "hsl(var(--muted-foreground))",
                  }}
                >
                  <span>{icon}</span>{label}
                </motion.button>
              );
            })}
          </div>
        </header>

        {/* Grid */}
        <div className="flex-1 px-4 pt-4 pb-28">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl">🛍️</span>
              <p className="text-sm">{t("shop.empty_category")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <ItemCard item={item} onClick={() => handlePick(item)} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Ambient */}
        <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-96 h-72 opacity-[0.04] rounded-full"
            style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(80px)" }} />
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selected && (
            <PurchaseModal
              item={selected}
              credits={credits}
              onConfirm={() => purchaseMutation.mutate(selected.id)}
              onClose={() => { setSelected(null); setCheckoutId(undefined); }}
              isPending={purchaseMutation.isPending}
            />
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
