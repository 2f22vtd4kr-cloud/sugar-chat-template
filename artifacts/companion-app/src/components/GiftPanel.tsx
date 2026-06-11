import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface GiftResult {
  newAffinity: number;
  affinityGain: number;
  newlyReachedMilestones: number[];
  milestoneRewardCredits: number;
}

interface GiftPanelProps {
  companionId: string;
  userCredits: number;
  onGiftSent: (result: GiftResult) => void;
}

const GIFT_TYPES = [
  { id: "rose",    emoji: "🌹", labelKey: "gifts.rose",    cost: 2,  affinityGain: 3,  color: "#E11D48" },
  { id: "heart",   emoji: "💝", labelKey: "gifts.heart",   cost: 5,  affinityGain: 8,  color: "#F43F5E" },
  { id: "diamond", emoji: "💎", labelKey: "gifts.diamond", cost: 15, affinityGain: 25, color: "#8B5CF6" },
  { id: "star",    emoji: "⭐", labelKey: "gifts.star",    cost: 30, affinityGain: 50, color: "#F59E0B" },
] as const;

export function GiftPanel({ companionId, userCredits, onGiftSent }: GiftPanelProps) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const sendGift = async (giftType: string, cost: number) => {
    if (sending) return;
    if (userCredits < cost) {
      haptic("heavy");
      toast({ variant: "destructive", title: t("gifts.not_enough"), description: `Need ${cost} credits` });
      return;
    }

    haptic("medium");
    setSending(giftType);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/conversations/${companionId}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to send gift");
      }

      const result: GiftResult = await res.json();
      haptic("heavy");
      setLastSent(giftType);
      setTimeout(() => setLastSent(null), 2000);
      onGiftSent(result);
    } catch (err: any) {
      haptic("heavy");
      toast({ variant: "destructive", title: err.message ?? "Failed to send gift" });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="flex items-center justify-between gap-1.5 px-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex-shrink-0 opacity-60">
        {t("gifts.title")}
      </span>
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        {GIFT_TYPES.map((gift) => {
          const isLoading = sending === gift.id;
          const isSent = lastSent === gift.id;
          const canAfford = userCredits >= gift.cost;

          return (
            <motion.button
              key={gift.id}
              onClick={() => sendGift(gift.id, gift.cost)}
              disabled={!!sending}
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: canAfford ? 1.08 : 1 }}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 min-w-[54px]",
                !canAfford && "opacity-40",
                canAfford && "hover:brightness-125"
              )}
              style={{
                background: isSent
                  ? `linear-gradient(135deg, ${gift.color}33, ${gift.color}20)`
                  : "rgba(255,255,255,0.06)",
                border: isSent ? `1px solid ${gift.color}60` : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isSent ? `0 0 12px ${gift.color}40` : "none",
              }}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ rotate: { duration: 0.8, repeat: Infinity, ease: "linear" } }}
                    className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full"
                    style={{ borderTopColor: gift.color }}
                  />
                ) : isSent ? (
                  <motion.span
                    key="sent"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="text-base"
                  >
                    {gift.emoji}
                  </motion.span>
                ) : (
                  <motion.span key="idle" className="text-base">{gift.emoji}</motion.span>
                )}
              </AnimatePresence>
              <span className="text-[9px] font-medium" style={{ color: canAfford ? gift.color : "inherit" }}>
                {gift.cost}cr
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
