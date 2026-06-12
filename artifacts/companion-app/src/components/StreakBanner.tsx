import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Flame, Coins } from "lucide-react";

interface StreakData {
  streakDays: number;
  lastLoginDate: string | null;
  canClaimToday: boolean;
  streakWillReset: boolean;
  nextRewardCredits: number;
  isWeeklyBonus: boolean;
  isMonthlyBonus: boolean;
}

export function StreakBanner() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  const { data: streak, isLoading } = useQuery<StreakData>({
    queryKey: ["streak"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/users/me/streak`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading || !streak) return null;

  const handleClaim = async () => {
    if (!streak.canClaimToday || claiming) return;
    haptic("medium");
    setClaiming(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/me/streak/claim`, { method: "POST" });
      if (!res.ok) throw new Error("Already claimed");
      const data = await res.json();
      haptic("heavy");
      setJustClaimed(true);
      qc.invalidateQueries({ queryKey: ["streak"] });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      const label = data.isMonthlyBonus ? t("streak.monthly_bonus") : data.isWeeklyBonus ? t("streak.weekly_bonus") : `Day ${data.streakDays}!`;
      toast({ title: `🔥 ${label}`, description: `+${data.rewardCredits} credits added to your balance!` });
      setTimeout(() => setJustClaimed(false), 3000);
    } catch {
      toast({ variant: "destructive", title: "Already claimed today" });
    } finally {
      setClaiming(false);
    }
  };

  const isSpecial = streak.isWeeklyBonus || streak.isMonthlyBonus;
  const displayDays = streak.canClaimToday
    ? (streak.streakWillReset ? 1 : streak.streakDays + 1)
    : streak.streakDays;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.35 }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: isSpecial
          ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.12))"
          : "linear-gradient(135deg, rgba(225,29,72,0.12), rgba(244,63,94,0.07))",
        border: `1px solid ${isSpecial ? "rgba(245,158,11,0.3)" : "rgba(225,29,72,0.2)"}`,
      }}
    >
      {/* Animated fire glow */}
      <motion.div
        className="absolute left-3 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full pointer-events-none"
        animate={{ opacity: [0.15, 0.28, 0.15], scale: [1, 1.15, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: isSpecial ? "radial-gradient(circle, rgba(245,158,11,0.6) 0%, transparent 70%)" : "radial-gradient(circle, rgba(225,29,72,0.5) 0%, transparent 70%)" }}
      />

      <div className="relative flex items-center gap-3 px-4 py-3">
        {/* Fire icon */}
        <motion.div
          animate={{ rotate: [-4, 4, -4], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex-shrink-0 text-2xl select-none"
        >
          🔥
        </motion.div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-serif font-bold text-sm" style={{ color: isSpecial ? "#FCD34D" : "hsl(348 76% 65%)" }}>
              {displayDays > 0
                ? t("streak.active", { count: displayDays })
                : t("streak.start")}
            </span>
            {isSpecial && streak.canClaimToday && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300"
              >
                {streak.isMonthlyBonus ? t("streak.monthly_bonus") : t("streak.weekly_bonus")}
              </motion.span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {streak.canClaimToday && !justClaimed
              ? `Claim +${streak.nextRewardCredits} credits`
              : t("streak.claimed")}
          </p>
        </div>

        {/* Claim button */}
        <AnimatePresence mode="wait">
          {streak.canClaimToday && !justClaimed ? (
            <motion.button
              key="claim"
              onClick={handleClaim}
              disabled={claiming}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold text-xs text-white transition-all"
              style={{
                background: isSpecial
                  ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                  : "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))",
                boxShadow: isSpecial ? "0 0 14px rgba(245,158,11,0.4)" : "0 0 14px rgba(225,29,72,0.35)",
                opacity: claiming ? 0.7 : 1,
              }}
            >
              {claiming ? (
                <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Coins className="w-3 h-3" />
                  {t("streak.claim", { count: streak.nextRewardCredits })}
                </>
              )}
            </motion.button>
          ) : justClaimed ? (
            <motion.div
              key="claimed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="text-xl"
            >
              ✅
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-[10px] text-muted-foreground/60 text-right">
              <Flame className="w-4 h-4 mx-auto" style={{ color: isSpecial ? "#F59E0B" : "hsl(348 76% 49%)" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
