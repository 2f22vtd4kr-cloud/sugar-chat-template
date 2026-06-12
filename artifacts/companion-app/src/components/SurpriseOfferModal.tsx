import { motion } from "framer-motion";
import { X, Zap, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useLocation } from "wouter";

interface SurpriseOfferModalProps {
  trigger: "streak_milestone" | "streak_reset" | "low_credits";
  streakDays?: number;
  onClose: () => void;
}

const OFFER_PACKAGES = [
  { id: "starter", credits: 50,  stars: 49,  label: "Starter",    badge: null,         popular: false },
  { id: "boost",   credits: 150, stars: 99,  label: "Boost",      badge: "BEST VALUE",  popular: true  },
  { id: "mega",    credits: 350, stars: 199, label: "Mega Pack",   badge: "+40% bonus", popular: false },
];

export function SurpriseOfferModal({ trigger, streakDays, onClose }: SurpriseOfferModalProps) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [, navigate] = useLocation();

  const heading = trigger === "streak_milestone"
    ? t("surprise.title_milestone", { days: streakDays })
    : trigger === "streak_reset"
      ? t("surprise.title_reset")
      : t("surprise.title_default");

  const subtitle = trigger === "streak_milestone"
    ? t("surprise.sub_milestone")
    : trigger === "streak_reset"
      ? t("surprise.sub_reset")
      : t("surprise.sub_default");

  const handleBuy = () => {
    haptic("medium");
    onClose();
    navigate("/shop");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.93 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.93 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl overflow-hidden relative"
        style={{
          background: "linear-gradient(180deg, #1a0508 0%, #0d0305 100%)",
          border: "1px solid rgba(225,29,72,0.3)",
          boxShadow: "0 0 80px rgba(225,29,72,0.25), 0 40px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Top glow stripe */}
        <div className="h-1" style={{ background: "linear-gradient(90deg, transparent, hsl(348 76% 49%), hsl(330 80% 55%), transparent)" }} />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>

        {/* Floating sparkles background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/40"
              style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ y: [-4, 4, -4], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        <div className="p-5 pt-6 space-y-4 relative">
          {/* Header */}
          <div className="text-center space-y-2 pr-6">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="text-5xl mx-auto w-fit"
            >
              🎁
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="font-serif font-bold text-xl"
              style={{ color: "hsl(348 76% 65%)" }}
            >
              {heading}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-white/50"
            >
              {subtitle}
            </motion.p>
          </div>

          {/* Credit packages */}
          <div className="space-y-2">
            {OFFER_PACKAGES.map((pkg, i) => (
              <motion.button
                key={pkg.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.07, type: "spring", stiffness: 280, damping: 24 }}
                onClick={handleBuy}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                style={{
                  background: pkg.popular
                    ? "linear-gradient(135deg, rgba(225,29,72,0.2), rgba(244,63,94,0.12))"
                    : "rgba(255,255,255,0.04)",
                  border: pkg.popular
                    ? "1px solid rgba(225,29,72,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: pkg.popular ? "0 0 20px rgba(225,29,72,0.15)" : "none",
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: pkg.popular ? "linear-gradient(135deg, hsl(348 76% 49%), hsl(330 80% 42%))" : "rgba(255,255,255,0.08)" }}
                >
                  <Zap className="w-4 h-4 text-white" fill="currentColor" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{pkg.credits} credits</span>
                    {pkg.badge && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                        style={{ background: pkg.popular ? "hsl(348 76% 49%)" : "rgba(245,158,11,0.3)", color: pkg.popular ? "white" : "#FCD34D" }}>
                        {pkg.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40">{pkg.label}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                    <span className="text-sm font-bold text-white">{pkg.stars}</span>
                  </div>
                  <p className="text-[9px] text-white/30">Stars</p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleBuy}
            className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(330 80% 42%))",
              boxShadow: "0 0 30px rgba(225,29,72,0.4), 0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <Star className="w-4 h-4" fill="currentColor" />
            {t("surprise.cta")}
          </motion.button>

          <button
            onClick={onClose}
            className="w-full text-center text-xs text-white/25 hover:text-white/40 transition-colors py-1"
          >
            {t("surprise.dismiss")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
