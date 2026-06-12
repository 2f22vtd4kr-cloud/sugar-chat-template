import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListCompanions, getListCompanionsQueryKey } from "@workspace/api-client-react";
import { useTelegram } from "@/context/TelegramContext";
import { useLocation } from "wouter";
import { Zap, ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OnboardingProps {
  firstName: string;
  credits: number;
  onComplete: () => void;
}

function UserAvatar({ photoUrl, firstName }: { photoUrl: string | null; firstName: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = firstName.slice(0, 2).toUpperCase();

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt={firstName}
        className="w-full h-full object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-3xl font-serif font-bold text-white">{initials || "💜"}</span>
    </div>
  );
}

function CompanionCard({
  companion,
  onSelect,
  index,
}: {
  companion: { id: string; name: string; avatarUrl: string; personality: string; creditCostText: number };
  onSelect: (id: string) => void;
  index: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const handleSelect = async () => {
    if (selecting) return;
    setSelecting(true);
    onSelect(companion.id);
  };

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.06 * index, type: "spring", stiffness: 320, damping: 26 }}
      onClick={handleSelect}
      disabled={selecting}
      className="w-full text-left group focus:outline-none"
    >
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: selecting ? "0 0 24px rgba(225,29,72,0.5)" : "none",
          transition: "box-shadow 0.2s",
        }}
      >
        <div className="relative aspect-[3/4]">
          {imgFailed ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-950 to-black">
              <span className="text-4xl font-serif font-bold text-white/80">{companion.name.slice(0, 2)}</span>
            </div>
          ) : (
            <img
              src={companion.avatarUrl}
              alt={companion.name}
              className="w-full h-full object-cover transition-transform duration-500 group-active:scale-[1.02]"
              onError={() => setImgFailed(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {selecting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(225,29,72,0.25)", backdropFilter: "blur(2px)" }}
            >
              <div className="w-10 h-10 border-2 border-white/60 border-t-white rounded-full animate-spin" />
            </motion.div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-serif font-semibold text-white text-sm leading-tight">{companion.name}</h3>
            <p className="text-[10px] text-white/55 mt-0.5 line-clamp-2">{companion.personality}</p>
          </div>
        </div>

        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-white/40 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            {companion.creditCostText} cr/msg
          </span>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}
          >
            <MessageCircle className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function Onboarding({ firstName, credits, onComplete }: OnboardingProps) {
  const { t } = useTranslation();
  const { photoUrl, haptic } = useTelegram();
  const [step, setStep] = useState<"welcome" | "pick">("welcome");
  const [, navigate] = useLocation();
  const { data: companions, isLoading } = useListCompanions({ query: { queryKey: getListCompanionsQueryKey() } });

  const handleCompanionSelect = (companionId: string) => {
    haptic("medium");
    onComplete();
    navigate(`/conversations/${companionId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] opacity-[0.12] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-64 h-64 opacity-[0.06] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(330 80% 55%) 0%, transparent 70%)", filter: "blur(60px)" }}
        />
      </div>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center flex-1 min-h-[100dvh] px-6 text-center gap-6"
          >
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
              className="relative"
            >
              <div
                className="w-24 h-24 rounded-full overflow-hidden"
                style={{
                  border: "2px solid rgba(225,29,72,0.6)",
                  boxShadow: "0 0 32px rgba(225,29,72,0.4), 0 0 64px rgba(225,29,72,0.15)",
                }}
              >
                <UserAvatar photoUrl={photoUrl} firstName={firstName} />
              </div>
              {/* Pulse ring */}
              <div
                className="absolute inset-[-4px] rounded-full animate-ping opacity-20"
                style={{ border: "2px solid hsl(348 76% 49%)" }}
              />
            </motion.div>

            {/* Greeting */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-3"
            >
              <h1 className="text-4xl font-serif font-bold leading-tight" style={{ color: "white" }}>
                {t("onboarding.welcome_title", { name: firstName })}
              </h1>
              <p className="text-white/55 text-sm max-w-xs mx-auto leading-relaxed">
                {t("onboarding.welcome_sub")}
              </p>
            </motion.div>

            {/* Credits pill */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl"
              style={{
                background: "rgba(225,29,72,0.12)",
                border: "1px solid rgba(225,29,72,0.3)",
                boxShadow: "0 0 16px rgba(225,29,72,0.15)",
              }}
            >
              <Zap className="w-4 h-4 text-yellow-400" fill="currentColor" />
              <span className="text-sm font-semibold text-white">
                {credits} {t("onboarding.credits_label")}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            </motion.div>

            {/* Companion count */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-white/35 tracking-widest uppercase"
            >
              {t("onboarding.companions_waiting", { count: companions?.length ?? 12 })}
            </motion.p>

            {/* CTA */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, type: "spring", stiffness: 280, damping: 24 }}
              onClick={() => { haptic("medium"); setStep("pick"); }}
              className="w-full max-w-xs py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{
                background: "linear-gradient(135deg, hsl(348 76% 49%) 0%, hsl(330 80% 42%) 100%)",
                boxShadow: "0 0 30px rgba(225,29,72,0.45), 0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {t("onboarding.cta")}
              <ChevronRight className="w-5 h-5" />
            </motion.button>

            {/* Sugar Chat wordmark */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 0.7 }}
              className="text-[10px] tracking-[0.35em] uppercase text-white/30 font-medium"
            >
              Sugar Chat
            </motion.p>
          </motion.div>
        )}

        {/* ── Step 2: Companion Picker ─────────────────────────────────── */}
        {step === "pick" && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 340, damping: 30 }}
            className="flex flex-col min-h-[100dvh]"
          >
            {/* Header */}
            <div className="px-5 pt-10 pb-4 space-y-1">
              <motion.h1
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-serif font-bold"
                style={{ color: "white" }}
              >
                {t("onboarding.pick_title")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="text-sm text-white/45"
              >
                {t("onboarding.pick_sub")}
              </motion.p>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array(6).fill(0).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl overflow-hidden animate-pulse"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="aspect-[3/4] bg-white/5" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 w-2/3 bg-white/5 rounded-full" />
                        <div className="h-2 w-1/2 bg-white/5 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {companions?.map((companion, i) => (
                    <CompanionCard
                      key={companion.id}
                      companion={companion}
                      onSelect={handleCompanionSelect}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
