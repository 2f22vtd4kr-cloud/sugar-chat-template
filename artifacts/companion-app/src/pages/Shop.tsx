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

// ── SVG Item Art ──────────────────────────────────────────────────────────────
function RoseSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <circle cx="28" cy="18" r="12" fill="url(#rs_rg)"/>
      <ellipse cx="21" cy="22" rx="7" ry="10" fill="#be123c" opacity="0.7" transform="rotate(-30 21 22)"/>
      <ellipse cx="36" cy="20" rx="6" ry="9" fill="#9f1239" opacity="0.75" transform="rotate(25 36 20)"/>
      <path d="M28 30 Q26 40 24 48 Q28 46 32 48 Q30 40 28 30Z" fill="#15803d" opacity="0.85"/>
      <path d="M26 36 Q19 34 17 31 Q21 38 26 36Z" fill="#16a34a" opacity="0.8"/>
      <path d="M30 34 Q37 32 39 29 Q35 36 30 34Z" fill="#15803d" opacity="0.8"/>
      <circle cx="28" cy="17" r="4.5" fill="#fb7185" opacity="0.5"/>
      <defs>
        <radialGradient id="rs_rg" cx="40%" cy="35%"><stop offset="0%" stopColor="#fda4af"/><stop offset="50%" stopColor="#e11d48"/><stop offset="100%" stopColor="#9f1239"/></radialGradient>
      </defs>
    </svg>
  );
}

function WineSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <rect x="24" y="6" width="8" height="8" rx="2" fill="#fbbf24" opacity="0.9"/>
      <path d="M22 14 Q18 20 18 28 L18 46 Q18 50 28 50 Q38 50 38 46 L38 28 Q38 20 34 14Z" fill="url(#wn_g)"/>
      <rect x="20" y="31" width="16" height="6" rx="1" fill="#fda4af" opacity="0.2"/>
      <path d="M22 36 Q28 34 34 36" stroke="#fda4af" strokeWidth="0.7" opacity="0.4"/>
      <defs>
        <linearGradient id="wn_g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7f1d1d"/><stop offset="100%" stopColor="#450a0a"/></linearGradient>
      </defs>
    </svg>
  );
}

function DiamondSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <circle cx="28" cy="36" r="13" fill="none" stroke="url(#dm_rg)" strokeWidth="4.5"/>
      <polygon points="28,8 19,20 28,28 37,20" fill="url(#dm_g)"/>
      <polygon points="19,20 28,28 17,26" fill="#bfdbfe" opacity="0.55"/>
      <polygon points="37,20 28,28 39,26" fill="#93c5fd" opacity="0.55"/>
      <defs>
        <linearGradient id="dm_g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e0f2fe"/><stop offset="50%" stopColor="#7dd3fc"/><stop offset="100%" stopColor="#0ea5e9"/></linearGradient>
        <linearGradient id="dm_rg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fcd34d"/><stop offset="100%" stopColor="#d97706"/></linearGradient>
      </defs>
    </svg>
  );
}

function VipSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <rect x="5" y="18" width="46" height="26" rx="6" fill="url(#vp_g)"/>
      <rect x="5" y="18" width="46" height="7" rx="6" fill="url(#vp_g2)" opacity="0.45"/>
      <circle cx="16" cy="31" r="5" fill="#fbbf24" opacity="0.3"/>
      <text x="24" y="35" fontSize="8" fill="#fcd34d" fontWeight="bold" fontFamily="serif">V I P</text>
      <polygon points="28,4 30,10 36,10 31,14 33,20 28,16 23,20 25,14 20,10 26,10" fill="#fcd34d" opacity="0.9"/>
      <defs>
        <linearGradient id="vp_g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#78350f"/><stop offset="100%" stopColor="#451a03"/></linearGradient>
        <linearGradient id="vp_g2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#fcd34d" stopOpacity="0"/><stop offset="50%" stopColor="#fcd34d" stopOpacity="0.4"/><stop offset="100%" stopColor="#fcd34d" stopOpacity="0"/></linearGradient>
      </defs>
    </svg>
  );
}

function OrbSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <circle cx="28" cy="28" r="22" fill="url(#orb_g)"/>
      <circle cx="28" cy="28" r="22" fill="none" stroke="url(#orb_s)" strokeWidth="1.2" opacity="0.6"/>
      <ellipse cx="22" cy="20" rx="6" ry="3.5" fill="white" opacity="0.16" transform="rotate(-30 22 20)"/>
      <path d="M24 28 Q28 17 32 28 Q28 39 24 28Z" fill="white" opacity="0.10"/>
      <defs>
        <radialGradient id="orb_g" cx="35%" cy="30%"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="40%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#2e1065"/></radialGradient>
        <linearGradient id="orb_s" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#e9d5ff"/><stop offset="100%" stopColor="#7c3aed"/></linearGradient>
      </defs>
    </svg>
  );
}

function LingerySvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <path d="M12 18 Q16 12 28 14 Q40 12 44 18 L40 38 Q34 46 28 46 Q22 46 16 38Z" fill="url(#ln_g)" opacity="0.85"/>
      <path d="M20 18 Q24 24 28 22 Q32 24 36 18" stroke="#fda4af" strokeWidth="1.3" fill="none" opacity="0.65"/>
      <path d="M16 24 Q22 22 28 24 Q34 22 40 24" stroke="#fda4af" strokeWidth="0.7" fill="none" opacity="0.4" strokeDasharray="2 2"/>
      <path d="M14 30 Q22 28 28 30 Q34 28 42 30" stroke="#fda4af" strokeWidth="0.7" fill="none" opacity="0.3" strokeDasharray="2 2"/>
      <circle cx="28" cy="20" r="2" fill="#fda4af" opacity="0.5"/>
      <defs>
        <linearGradient id="ln_g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3d1a1a"/><stop offset="100%" stopColor="#1c1917"/></linearGradient>
      </defs>
    </svg>
  );
}

function RopeSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <path d="M8 17 Q16 11 24 19 Q32 27 40 21 Q48 15 50 23" stroke="url(#rp_g)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <path d="M8 28 Q16 22 24 30 Q32 38 40 32 Q48 26 50 34" stroke="url(#rp_g2)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <path d="M8 39 Q16 33 24 41 Q32 49 40 43" stroke="url(#rp_g)" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
      <circle cx="28" cy="28" r="6.5" fill="none" stroke="#fcd34d" strokeWidth="2.2" opacity="0.45"/>
      <defs>
        <linearGradient id="rp_g" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#92400e"/><stop offset="100%" stopColor="#b45309"/></linearGradient>
        <linearGradient id="rp_g2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#78350f"/><stop offset="100%" stopColor="#a16207"/></linearGradient>
      </defs>
    </svg>
  );
}

function CatEarsSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="w-10 h-10 drop-shadow">
      <polygon points="8,6 3,26 19,19" fill="url(#ce_g)" stroke="#c084fc" strokeWidth="1.2" strokeLinejoin="round"/>
      <polygon points="48,6 53,26 37,19" fill="url(#ce_g)" stroke="#c084fc" strokeWidth="1.2" strokeLinejoin="round"/>
      <polygon points="11,10 6,24 17,19" fill="#e9d5ff" opacity="0.35"/>
      <polygon points="45,10 50,24 39,19" fill="#e9d5ff" opacity="0.35"/>
      <ellipse cx="28" cy="40" rx="18" ry="12" fill="url(#ce_g2)" opacity="0.65"/>
      <ellipse cx="21" cy="41" rx="2.5" ry="3" fill="#86efac" opacity="0.65"/>
      <ellipse cx="35" cy="41" rx="2.5" ry="3" fill="#86efac" opacity="0.65"/>
      <path d="M24 47 Q28 49 32 47" stroke="#f9a8d4" strokeWidth="1" fill="none"/>
      <defs>
        <linearGradient id="ce_g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7e22ce"/><stop offset="100%" stopColor="#4c1d95"/></linearGradient>
        <radialGradient id="ce_g2" cx="50%" cy="30%"><stop offset="0%" stopColor="#ede9fe"/><stop offset="100%" stopColor="#6d28d9"/></radialGradient>
      </defs>
    </svg>
  );
}

const ITEM_SVG: Record<string, React.ReactNode> = {
  rose_bouquet:  <RoseSvg />,
  wine_bottle:   <WineSvg />,
  diamond_ring:  <DiamondSvg />,
  vip_pass:      <VipSvg />,
  control_ball:  <OrbSvg />,
  lace_lingerie: <LingerySvg />,
  bondage_rope:  <RopeSvg />,
  cat_ears:      <CatEarsSvg />,
};

function ItemArt({ itemId, emoji }: { itemId: string; emoji: string }) {
  const svg = ITEM_SVG[itemId];
  return svg ? <div className="flex-shrink-0">{svg}</div> : <span className="text-4xl select-none">{emoji}</span>;
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
