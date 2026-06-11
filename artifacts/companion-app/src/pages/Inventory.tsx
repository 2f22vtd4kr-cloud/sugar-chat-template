import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft, Package, Gift, CheckCircle2, Inbox } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

interface InventoryItem {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  creditsCost: number;
  isGifted: boolean;
  giftedToCompanionId: string | null;
  giftedAt: string | null;
  createdAt: string;
}

interface Conversation {
  companionId: string;
  companion: { id: string; name: string; avatarUrl: string };
}

const ITEM_EMOJIS: Record<string, string> = {
  rose_bouquet: "🌹", wine_bottle: "🍷", plane_ticket: "✈️", silk_pajamas: "🩷",
  diamond_ring: "💍", vip_pass: "👑", control_ball: "🔮", piercing_set: "✨",
  body_lotion: "🧴", cat_ears: "🐱", lace_lingerie: "👙", bondage_rope: "🪢",
  dildo: "💜", anal_plug: "💎", lubricant: "🫧",
};

export default function InventoryPage() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [giftingItem, setGiftingItem] = useState<InventoryItem | null>(null);
  const [selectedCompanion, setSelectedCompanion] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/shop/inventory`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations-list"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/conversations`).then((r) => r.json()),
    staleTime: 60_000,
    enabled: giftingItem !== null,
  });

  const giftMutation = useMutation({
    mutationFn: async ({ inventoryId, companionId }: { inventoryId: string; companionId: string }) => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/shop/gift-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, companionId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Gift failed");
      return res.json();
    },
    onSuccess: (data) => {
      haptic("heavy");
      toast({ title: `🎁 ${data.itemName} sent!`, description: `+${data.affinityGain} bond with companion` });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setGiftingItem(null);
      setSelectedCompanion(null);
    },
    onError: (err: Error) => {
      haptic("light");
      toast({ variant: "destructive", title: "Gift failed", description: err.message });
    },
  });

  const ownedItems  = items.filter((i) => !i.isGifted);
  const giftedItems = items.filter((i) => i.isGifted);

  return (
    <AppLayout>
      <div className="min-h-[100dvh] flex flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b glass-header"
          style={{ borderBottomColor: "rgba(225,29,72,0.15)" }}
        >
          <button
            onClick={() => { haptic("light"); navigate("/shop"); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-serif font-bold text-base">{t("inventory.title")}</h1>
            <p className="text-[10px] text-muted-foreground">{t("inventory.subtitle")}</p>
          </div>
          <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-xl"
            style={{ background: "rgba(225,29,72,0.10)", border: "1px solid rgba(225,29,72,0.2)" }}>
            <Package className="w-3 h-3" style={{ color: "hsl(348 76% 65%)" }} />
            <span className="text-xs font-bold" style={{ color: "hsl(348 76% 65%)" }}>{ownedItems.length}</span>
          </div>
        </header>

        <div className="flex-1 px-4 py-4 space-y-6 pb-24">
          {/* Ambient glow */}
          <div className="fixed inset-0 pointer-events-none -z-10">
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-80 h-80 opacity-[0.04] rounded-full"
              style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(60px)" }} />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : ownedItems.length === 0 && giftedItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-20"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Inbox className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-muted-foreground">{t("inventory.empty_title")}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">{t("inventory.empty_desc")}</p>
              </div>
              <button
                onClick={() => navigate("/shop")}
                className="px-6 py-2.5 rounded-2xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 20px rgba(225,29,72,0.35)" }}
              >
                {t("inventory.go_shop")}
              </button>
            </motion.div>
          ) : (
            <>
              {/* Owned items */}
              {ownedItems.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">
                    {t("inventory.owned")} ({ownedItems.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {ownedItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 28 }}
                        className="relative rounded-2xl overflow-hidden cursor-pointer group"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div className="p-4 flex flex-col gap-2">
                          <div className="text-3xl select-none">{ITEM_EMOJIS[item.itemId] ?? "🎁"}</div>
                          <div>
                            <p className="font-semibold text-sm text-foreground leading-tight">{item.itemName}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{item.creditsCost} cr</p>
                          </div>
                          <button
                            onClick={() => { haptic("medium"); setGiftingItem(item); }}
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl text-xs font-semibold transition-all"
                            style={{
                              background: "rgba(225,29,72,0.12)",
                              border: "1px solid rgba(225,29,72,0.25)",
                              color: "hsl(348 76% 65%)",
                            }}
                          >
                            <Gift className="w-3 h-3" />
                            {t("inventory.send_gift")}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Gifted items history */}
              {giftedItems.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">
                    {t("inventory.gifted")} ({giftedItems.length})
                  </h2>
                  <div className="space-y-2">
                    {giftedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <span className="text-2xl select-none">{ITEM_EMOJIS[item.itemId] ?? "🎁"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.itemName}</p>
                          {item.giftedAt && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(item.giftedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400/80 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Gift companion picker modal */}
        <AnimatePresence>
          {giftingItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
              onClick={(e) => { if (e.target === e.currentTarget) setGiftingItem(null); }}
            >
              <motion.div
                initial={{ y: "100%", scale: 0.97 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: "100%", scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="w-full max-w-md rounded-t-3xl overflow-hidden"
                style={{ background: "#0e0408", border: "1px solid rgba(225,29,72,0.25)", borderBottom: "none" }}
              >
                <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-4"
                  style={{ background: "rgba(255,255,255,0.15)" }} />

                <div className="px-5 pb-6">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-3xl">{ITEM_EMOJIS[giftingItem.itemId] ?? "🎁"}</span>
                    <div>
                      <h3 className="font-serif font-bold text-base">{t("inventory.choose_companion")}</h3>
                      <p className="text-xs text-muted-foreground">{giftingItem.itemName}</p>
                    </div>
                  </div>

                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {t("inventory.no_conversations")}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-none">
                      {conversations.map((conv) => (
                        <button
                          key={conv.companionId}
                          onClick={() => setSelectedCompanion(conv.companionId)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                          style={{
                            background: selectedCompanion === conv.companionId
                              ? "rgba(225,29,72,0.15)"
                              : "rgba(255,255,255,0.04)",
                            border: `1px solid ${selectedCompanion === conv.companionId ? "rgba(225,29,72,0.4)" : "rgba(255,255,255,0.08)"}`,
                          }}
                        >
                          <img
                            src={conv.companion.avatarUrl}
                            alt={conv.companion.name}
                            className="w-9 h-9 rounded-full object-cover border-2"
                            style={{ borderColor: selectedCompanion === conv.companionId ? "rgba(225,29,72,0.5)" : "rgba(255,255,255,0.1)" }}
                          />
                          <span className="font-medium text-sm">{conv.companion.name}</span>
                          {selectedCompanion === conv.companionId && (
                            <CheckCircle2 className="ml-auto w-4 h-4 flex-shrink-0" style={{ color: "hsl(348 76% 65%)" }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={() => { setGiftingItem(null); setSelectedCompanion(null); }}
                      className="flex-1 h-11 rounded-2xl font-semibold text-sm"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {t("inventory.cancel")}
                    </button>
                    <button
                      disabled={!selectedCompanion || giftMutation.isPending}
                      onClick={() => {
                        if (!selectedCompanion) return;
                        haptic("medium");
                        giftMutation.mutate({ inventoryId: giftingItem.id, companionId: selectedCompanion });
                      }}
                      className="flex-1 h-11 rounded-2xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))",
                        boxShadow: "0 0 20px rgba(225,29,72,0.35)",
                      }}
                    >
                      {giftMutation.isPending ? (
                        <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Gift className="w-4 h-4" />
                          {t("inventory.send_gift")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
