import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Gift, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

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

interface MilestoneRecord {
  days: number;
  label: string;
  bonus: number;
  hasGift: boolean;
  emoji: string;
  achieved: boolean;
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
  allMilestones: MilestoneRecord[];
}

export function StreakProgressCard() {
  const { t } = useTranslation();

  const { data: streak, isLoading } = useQuery<StreakData>({
    queryKey: ["streak"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/users/me/streak`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading || !streak) return null;

  const schedule = streak.weekSchedule ?? [];
  const posInCycle = streak.streakDays % 7;
  const progressPct = streak.nextMilestone
    ? Math.min(100, ((streak.streakDays % streak.nextMilestone.targetDays) / streak.nextMilestone.targetDays) * 100 || (streak.streakDays / streak.nextMilestone.targetDays) * 100)
    : 100;

  // Get last 4 milestones to show (2 achieved, 2 upcoming)
  const visibleMilestones = (streak.allMilestones ?? []).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
    >
      <Card className="glass-card rounded-2xl overflow-hidden border-0">
        <CardContent className="p-4 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                {t("streak.progress_title")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.25)" }}>
              <span className="text-base">🔥</span>
              <span className="font-bold text-sm text-white">{streak.streakDays}</span>
              <span className="text-[11px] text-white/40">{t("streak.days_unit")}</span>
            </div>
          </div>

          {/* 7-day weekly cycle dots */}
          <div>
            <p className="text-[11px] text-white/40 mb-2">{t("streak.this_week")}</p>
            <div className="flex justify-between items-end gap-1">
              {schedule.map((day, i) => {
                const isClaimed = day.claimed;
                const isCurrent = day.isToday;
                const isFuture = !day.claimed && !day.isToday;

                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-[9px] font-medium"
                      style={{ color: isClaimed ? "hsl(348 76% 55%)" : isCurrent ? "white" : "rgba(255,255,255,0.2)" }}>
                      +{day.credits}
                    </span>
                    <motion.div
                      className="w-full h-2 rounded-full"
                      style={{
                        background: isClaimed
                          ? "linear-gradient(90deg, hsl(348 76% 49%), hsl(330 80% 42%))"
                          : isCurrent
                            ? day.isBonusDay ? "linear-gradient(90deg, #F59E0B, #EF4444)" : "rgba(225,29,72,0.5)"
                            : "rgba(255,255,255,0.07)",
                        boxShadow: isCurrent ? "0 0 8px rgba(225,29,72,0.5)" : "none",
                        border: isCurrent ? "1px solid rgba(225,29,72,0.5)" : "none",
                      }}
                    />
                    <span className="text-[8px] text-white/25">{day.isBonusDay ? "⭐" : day.dayOffset}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next milestone progress bar */}
          {streak.nextMilestone && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/40">{t("streak.next_milestone")}</p>
                <div className="flex items-center gap-1">
                  <span className="text-sm">{streak.nextMilestone.emoji}</span>
                  <span className="text-xs font-bold text-white/70">{streak.nextMilestone.label}</span>
                </div>
              </div>
              <div className="relative h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "linear-gradient(90deg, hsl(348 76% 49%), hsl(330 80% 55%))" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/30">
                <span>{streak.streakDays} {t("streak.days_unit")}</span>
                <span>
                  {streak.nextMilestone.daysLeft} {t("streak.days_away")}
                  {streak.nextMilestone.hasGift && <span className="ml-1">🎁</span>}
                </span>
              </div>
            </div>
          )}

          {/* Milestone checklist */}
          <div>
            <p className="text-[11px] text-white/40 mb-2">{t("streak.milestones")}</p>
            <div className="space-y-1.5">
              {visibleMilestones.map((m, i) => (
                <motion.div
                  key={m.days}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: m.achieved ? "rgba(225,29,72,0.08)" : "rgba(255,255,255,0.03)",
                    border: m.achieved ? "1px solid rgba(225,29,72,0.2)" : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span className="text-base w-5 text-center">{m.emoji}</span>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${m.achieved ? "text-white" : "text-white/40"}`}>
                      {m.label}
                    </p>
                    <p className="text-[10px] text-white/25">Day {m.days} · +{m.bonus} cr{m.hasGift ? " + 🎁 gift" : ""}</p>
                  </div>
                  {m.achieved ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(348 76% 55%)" }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ border: "1.5px solid rgba(255,255,255,0.15)" }} />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
