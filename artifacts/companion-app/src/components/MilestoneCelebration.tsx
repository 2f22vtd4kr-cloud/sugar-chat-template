import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/context/TelegramContext";

interface MilestoneCelebrationProps {
  milestone: number;
  companionName: string;
  companionAvatar: string;
  rewardCredits: number;
  onClose: () => void;
}

const MILESTONE_COLORS: Record<number, { primary: string; secondary: string; glow: string }> = {
  25:  { primary: "#E11D48", secondary: "#FB7185", glow: "rgba(225,29,72,0.5)" },
  50:  { primary: "#DC2626", secondary: "#F87171", glow: "rgba(220,38,38,0.5)" },
  75:  { primary: "#7C3AED", secondary: "#A78BFA", glow: "rgba(124,58,237,0.5)" },
  100: { primary: "#D97706", secondary: "#FCD34D", glow: "rgba(217,119,6,0.6)" },
};

const HEART_COUNTS = 18;

export function MilestoneCelebration({ milestone, companionName, companionAvatar, rewardCredits, onClose }: MilestoneCelebrationProps) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const colors = MILESTONE_COLORS[milestone] ?? MILESTONE_COLORS[25];

  const handleClose = () => {
    haptic("heavy");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="milestone-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(4,1,2,0.92)" }}
        onClick={handleClose}
      >
        {/* Floating hearts */}
        {Array.from({ length: HEART_COUNTS }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute pointer-events-none"
            initial={{ opacity: 0, y: "110vh", x: `${(i / HEART_COUNTS) * 100}vw` }}
            animate={{ opacity: [0, 0.9, 0], y: "-20vh" }}
            transition={{ duration: 2.8 + Math.random() * 1.5, delay: Math.random() * 0.8, ease: "easeOut" }}
            style={{ left: `${Math.random() * 100}%` }}
          >
            <span style={{ fontSize: `${10 + Math.random() * 18}px`, color: i % 3 === 0 ? colors.primary : i % 3 === 1 ? colors.secondary : "#fff" }}>
              {i % 4 === 0 ? "💕" : i % 4 === 1 ? "✨" : i % 4 === 2 ? "🌟" : "❤️"}
            </span>
          </motion.div>
        ))}

        {/* Main card */}
        <motion.div
          initial={{ scale: 0.7, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
          className="glass-card rounded-3xl p-7 max-w-[320px] w-full mx-6 text-center space-y-5 relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background glow blob */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 30%, ${colors.glow} 0%, transparent 70%)`, opacity: 0.35 }} />

          {/* Level badge */}
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.35 }}
            className="mx-auto w-fit px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, boxShadow: `0 0 20px ${colors.glow}` }}
          >
            {t("milestone.level", { level: milestone })}
          </motion.div>

          {/* Companion avatar with pulsing ring */}
          <div className="relative mx-auto w-24 h-24">
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)` }}
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-dashed opacity-40"
              style={{ borderColor: colors.secondary }}
            />
            <img
              src={companionAvatar}
              alt={companionName}
              className="w-24 h-24 rounded-full object-cover border-3 relative z-10"
              style={{ border: `3px solid ${colors.primary}`, boxShadow: `0 0 24px ${colors.glow}` }}
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.6 }}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center z-20"
              style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
            >
              <Heart className="w-4 h-4 text-white fill-white" />
            </motion.div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-xl font-serif font-bold"
              style={{ color: colors.secondary }}
            >
              {t("milestone.unlocked")}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="text-sm text-muted-foreground leading-relaxed px-2"
            >
              {t(`milestone.messages.${milestone}` as any, { defaultValue: "A special bond moment with " + companionName })}
            </motion.p>
          </div>

          {/* Reward */}
          {rewardCredits > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.75, type: "spring" }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl"
              style={{ background: `linear-gradient(135deg, ${colors.primary}22, ${colors.secondary}15)`, border: `1px solid ${colors.primary}40` }}
            >
              <Sparkles className="w-4 h-4" style={{ color: colors.secondary }} />
              <span className="font-serif font-bold text-base" style={{ color: colors.secondary }}>
                {t("milestone.reward_earned", { count: rewardCredits })}
              </span>
            </motion.div>
          )}

          <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}40, transparent)` }} />

          <Button
            onClick={handleClose}
            className="w-full h-12 rounded-2xl font-semibold text-base"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, boxShadow: `0 0 20px ${colors.glow}` }}
          >
            {t("milestone.dismiss")}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
