import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Zap, X, Gift } from "lucide-react";

interface WeekDay {
  dayOffset: number;
  credits: number;
  isBonusDay: boolean;
  claimed: boolean;
  isToday: boolean;
}

interface MilestoneInfo {
  targetDays: number;
  daysLeft: number;
  creditsBonus: number;
  label: string;
  hasGift: boolean;
  emoji: string;
}

interface StreakData {
  streakDays: number;
  lastLoginDate: string | null;
  canClaimToday: boolean;
  nextRewardCredits: number;
  isWeeklyBonus: boolean;
  isMonthlyBonus: boolean;
  weekSchedule: WeekDay[];
  nextMilestone: MilestoneInfo | null;
}

interface StreakClaimModalProps {
  onClose: () => void;
  onClaimed: (data: { rewardCredits: number; streakDays: number; isWeeklyBonus: boolean; isMonthlyBonus: boolean; milestoneGift: { itemName: string; emoji: string } | null; streakReset: boolean }) => void;
}

export function StreakClaimModal({ onClose, onClaimed }: StreakClaimModalProps) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const { data: streak, isLoading } = useQuery<StreakData>({
    queryKey: ["streak"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/users/me/streak`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const handleClaim = async () => {
    if (!streak?.canClaimToday || claiming) return;
    haptic("medium");
    setClaiming(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/users/me/streak/claim`, { method: "POST" });
      if (!res.ok) throw new Error("Already claimed");
      const data = await res.json();
      haptic("heavy");
      setClaimed(true);
      qc.invalidateQueries({ queryKey: ["streak"] });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      onClaimed(data);
      setTimeout(() => onClose(), 2000);
    } catch {
      toast({ variant: "destructive", title: "Already claimed today" });
      onClose();
    } finally {
      setClaiming(false);
    }
  };

  if (isLoading || !streak) return null;

  const schedule = streak.weekSchedule ?? [];
  const isSpecial = streak.isWeeklyBonus || streak.isMonthlyBonus;
  const displayStreakDays = streak.streakDays + (streak.canClaimToday ? 1 : 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1a0508 0%, #0d0305 100%)",
          border: "1px solid rgba(225,29,72,0.25)",
          boxShadow: "0 -4px 60px rgba(225,29,72,0.2), 0 40px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>

        {/* Glow bar at top */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, transparent, hsl(348 76% 49%), hsl(330 80% 55%), transparent)" }} />

        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="text-center space-y-1 pr-6">
            <motion.div
              animate={{ rotate: [-5, 5, -5], scale: [1, 1.12, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-4xl mx-auto w-fit"
            >
              🔥
            </motion.div>
            <h2 className="font-serif font-bold text-xl text-white mt-2">
              {t("streak.modal_title")}
            </h2>
            <p className="text-sm text-white/50">
              {displayStreakDays > 1
                ? t("streak.active", { count: displayStreakDays })
                : t("streak.start")}
            </p>
          </div>

          {/* 7-day schedule track */}
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-5 right-5 h-0.5" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(schedule.filter(d => d.claimed || d.isToday).length / 7) * 100}%`,
                  background: "linear-gradient(90deg, hsl(348 76% 49%), hsl(330 80% 55%))",
                }}
              />
            </div>

            <div className="flex justify-between relative">
              {schedule.map((day, i) => {
                const isCurrent = day.isToday;
                const isClaimed = day.claimed || (claimed && isCurrent);
                const isFuture = !day.claimed && !day.isToday;

                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{
                        scale: isCurrent ? [1, 1.1, 1] : 1,
                      }}
                      transition={isCurrent ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                      className="relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: isClaimed
                          ? "linear-gradient(135deg, hsl(348 76% 49%), hsl(330 80% 42%))"
                          : isCurrent
                            ? day.isBonusDay
                              ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                              : "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))"
                            : "rgba(255,255,255,0.06)",
                        border: isCurrent ? `2px solid ${day.isBonusDay ? "#FCD34D" : "hsl(348 76% 65%)"}` : "2px solid rgba(255,255,255,0.08)",
                        boxShadow: isCurrent ? `0 0 16px ${day.isBonusDay ? "rgba(245,158,11,0.5)" : "rgba(225,29,72,0.5)"}` : "none",
                        opacity: isFuture ? 0.45 : 1,
                      }}
                    >
                      {isClaimed ? (
                        <span className="text-white text-lg">✓</span>
                      ) : (
                        <span className={isFuture ? "text-white/40" : day.isBonusDay ? "text-yellow-300" : "text-white"}>
                          {day.credits}
                        </span>
                      )}
                      {isCurrent && !claimed && (
                        <motion.div
                          className="absolute inset-[-3px] rounded-full border-2 border-primary/50"
                          animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </motion.div>

                    <div className="text-center">
                      <div className={`text-[9px] font-bold ${isCurrent ? (day.isBonusDay ? "text-yellow-400" : "text-primary") : isClaimed ? "text-white/60" : "text-white/25"}`}>
                        {day.isBonusDay ? "⭐" : <Zap className="w-2 h-2 mx-auto" />}
                      </div>
                      <div className={`text-[9px] leading-tight ${isCurrent ? "text-white/80" : "text-white/30"}`}>
                        {t("streak.day_n", { n: day.dayOffset })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Claimed animation */}
          <AnimatePresence>
            {claimed && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="text-center space-y-1"
              >
                <p className="text-3xl">🎉</p>
                <p className="font-serif font-bold text-white">{t("streak.claimed_success", { count: streak.nextRewardCredits })}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Next milestone hint */}
          {!claimed && streak.nextMilestone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <span className="text-lg">{streak.nextMilestone.emoji}</span>
              <div className="flex-1">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">{t("streak.next_milestone")}</p>
                <p className="text-xs text-white/70 font-medium">
                  {streak.nextMilestone.label} — {t("streak.days_left", { count: streak.nextMilestone.daysLeft })}
                  {streak.nextMilestone.hasGift && <span className="ml-1 text-primary">🎁</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold" style={{ color: "hsl(348 76% 65%)" }}>+{streak.nextMilestone.creditsBonus} cr</p>
              </div>
            </motion.div>
          )}

          {/* Claim button */}
          {!claimed && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleClaim}
              disabled={claiming || !streak.canClaimToday}
              className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: isSpecial
                  ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                  : "linear-gradient(135deg, hsl(348 76% 49%), hsl(330 80% 42%))",
                boxShadow: isSpecial
                  ? "0 0 30px rgba(245,158,11,0.4), 0 4px 16px rgba(0,0,0,0.4)"
                  : "0 0 30px rgba(225,29,72,0.4), 0 4px 16px rgba(0,0,0,0.4)",
                opacity: (!streak.canClaimToday || claiming) ? 0.6 : 1,
              }}
            >
              {claiming ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : !streak.canClaimToday ? (
                <>{t("streak.already_claimed")}</>
              ) : (
                <>
                  {isSpecial && <span className="text-lg">⭐</span>}
                  {t("streak.claim", { count: streak.nextRewardCredits })}
                  {isSpecial && <span className="text-xs opacity-80">{streak.isMonthlyBonus ? t("streak.monthly_bonus") : t("streak.weekly_bonus")}</span>}
                </>
              )}
            </motion.button>
          )}

          {/* Dismiss link */}
          {!claimed && (
            <button
              onClick={onClose}
              className="w-full text-center text-xs text-white/25 hover:text-white/40 transition-colors py-1"
            >
              {t("streak.not_now")}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
