import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, RotateCcw, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useTelegram } from "@/context/TelegramContext";
import { TAROT_TOPICS } from "@/tarot/cards";
import type { TarotTopicId } from "@/tarot/cards";
import { useTranslation } from "react-i18next";

interface DrawnCard {
  name: string;
  position: string;
  reversed: boolean;
  romanticFlavor: string;
  meaningUpright: string;
  meaningReversed: string;
  arcana: string;
  suit?: string;
  keywords: string[];
}

interface TarotReadingResult {
  id: string;
  companionId: string;
  companionName: string;
  topic: string;
  topicLabel: string;
  spreadType: string;
  cards: DrawnCard[];
  readingText: string;
  affinityGain: number;
  createdAt: string;
}

type Phase = "topic" | "loading" | "reveal" | "reading";

const CARD_SUITS_SYMBOL: Record<string, string> = {
  cups: "🌊",
  wands: "🔥",
  swords: "⚔️",
  pentacles: "🌕",
};

function CardBack() {
  return (
    <div className="w-full h-full rounded-2xl flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a0510 0%, #2d0a1a 50%, #0d0208 100%)", border: "1px solid rgba(225,29,72,0.3)" }}>
      <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(225,29,72,0.04) 0px, rgba(225,29,72,0.04) 1px, transparent 1px, transparent 8px)" }} />
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ border: "2px solid rgba(225,29,72,0.4)", boxShadow: "0 0 24px rgba(225,29,72,0.2)" }}>
        <span className="text-3xl">🔮</span>
      </div>
    </div>
  );
}

function CardFace({ card, visible }: { card: DrawnCard; visible: boolean }) {
  const meaning = card.reversed ? card.meaningReversed : card.meaningUpright;
  const suitSymbol = card.suit ? CARD_SUITS_SYMBOL[card.suit] ?? "✦" : "✦";

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden relative"
      style={{
        background: card.reversed
          ? "linear-gradient(135deg, #1c0a1a 0%, #2d0a2d 60%, #0d0217 100%)"
          : "linear-gradient(135deg, #1a0510 0%, #2d0714 60%, #170308 100%)",
        border: `1px solid ${card.reversed ? "rgba(168,85,247,0.35)" : "rgba(225,29,72,0.35)"}`,
        boxShadow: card.reversed
          ? "0 0 30px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 0 30px rgba(225,29,72,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
        opacity: visible ? 1 : 0,
      }}>
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-[0.3em] font-bold"
            style={{ color: card.reversed ? "rgba(168,85,247,0.7)" : "rgba(225,29,72,0.7)" }}>
            {card.position}
          </span>
          <span className="text-base">{suitSymbol}</span>
        </div>

        <h3 className="font-serif font-bold text-white text-[13px] leading-tight mb-1.5">
          {card.name}
          {card.reversed && <span className="text-purple-400 text-[10px] ml-1.5">↑↓</span>}
        </h3>

        <div className="flex flex-wrap gap-1 mb-2">
          {card.keywords.slice(0, 2).map((kw) => (
            <span key={kw} className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              {kw}
            </span>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-white/60 flex-1 overflow-hidden line-clamp-3">{meaning}</p>

        <div className="mt-auto pt-2 border-t border-white/5">
          <p className="text-[10px] leading-snug italic"
            style={{ color: card.reversed ? "rgba(216,180,254,0.75)" : "rgba(253,164,175,0.75)" }}>
            {card.romanticFlavor}
          </p>
        </div>
      </div>
    </div>
  );
}

function FlipCard({ card, delay, onFlipComplete }: { card: DrawnCard; delay: number; onFlipComplete?: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const [faceVisible, setFaceVisible] = useState(false);
  const { haptic } = useTelegram();

  const handleFlip = () => {
    if (flipped) return;
    haptic("medium");
    setFlipped(true);
    setTimeout(() => {
      setFaceVisible(true);
      onFlipComplete?.();
    }, 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="relative cursor-pointer"
      style={{ perspective: "800px" }}
      onClick={handleFlip}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: "preserve-3d", height: "200px" }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <CardBack />
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <CardFace card={card} visible={faceVisible} />
        </div>
      </motion.div>

      {!flipped && (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-2 left-0 right-0 text-center"
        >
          <span className="text-[9px] text-white/40 uppercase tracking-widest">Tap to reveal</span>
        </motion.div>
      )}
    </motion.div>
  );
}

interface TarotPageProps {
  companionId: string;
}

export default function TarotPage({ companionId }: TarotPageProps) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("topic");
  const [selectedTopic, setSelectedTopic] = useState<TarotTopicId | null>(null);
  const [result, setResult] = useState<TarotReadingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flippedCount, setFlippedCount] = useState(0);

  const handleTopicSelect = async (topicId: TarotTopicId) => {
    haptic("medium");
    setSelectedTopic(topicId);
    setPhase("loading");
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/tarot/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionId, topic: topicId, spreadType: "three_card" }),
      });

      if (!res.ok) throw new Error("Reading failed");

      const data: TarotReadingResult = await res.json();
      setResult(data);
      setPhase("reveal");
      haptic("heavy");
    } catch {
      setError("The cards couldn't be read right now. Try again.");
      setPhase("topic");
    }
  };

  const handleReset = () => {
    haptic("light");
    setPhase("topic");
    setSelectedTopic(null);
    setResult(null);
    setFlippedCount(0);
  };

  const allFlipped = result ? flippedCount >= result.cards.length : false;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background max-w-md mx-auto relative overflow-hidden">
      {/* Mystical ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] opacity-[0.08]"
          style={{ background: "radial-gradient(circle, hsl(280 60% 40%) 0%, hsl(348 76% 49%) 40%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] opacity-[0.05]"
          style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(40px)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: "rgba(10,2,6,0.85)", backdropFilter: "blur(32px)", borderBottom: "1px solid rgba(225,29,72,0.12)" }}>
        <button onClick={() => { haptic("light"); navigate(`/conversations/${companionId}`); }}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-serif font-semibold text-sm text-gradient-red">Tarot Reading</h1>
          <p className="text-[10px] text-muted-foreground">A mystical companion-led spread</p>
        </div>
        <span className="text-xl">🔮</span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-8">
        <AnimatePresence mode="wait">

          {/* ── TOPIC SELECTION ── */}
          {phase === "topic" && (
            <motion.div
              key="topic"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >
              <div className="text-center space-y-2 pt-2">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="text-5xl mb-2"
                >🔮</motion.div>
                <h2 className="font-serif text-2xl text-gradient-red">What shall we explore?</h2>
                <p className="text-sm text-muted-foreground">Choose a topic and let the cards speak</p>
              </div>

              {error && (
                <div className="rounded-xl p-3 text-center text-sm text-red-400"
                  style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.2)" }}>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {TAROT_TOPICS.map((topic, i) => (
                  <motion.button
                    key={topic.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                    onClick={() => handleTopicSelect(topic.id)}
                    className="glass-card rounded-2xl p-3 text-left space-y-1.5 hover:brightness-125 active:scale-95 transition-all duration-150"
                    style={{ border: "1px solid rgba(225,29,72,0.15)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{topic.emoji}</span>
                      <span className="text-xs font-semibold text-foreground leading-tight">{topic.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{topic.description}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="text-6xl"
              >🌙</motion.div>
              <div className="text-center space-y-2">
                <p className="font-serif text-lg text-gradient-red">Consulting the cards...</p>
                <p className="text-sm text-muted-foreground">
                  {TAROT_TOPICS.find(t => t.id === selectedTopic)?.label}
                </p>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
                    transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "hsl(348 76% 49%)" }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── CARD REVEAL ── */}
          {phase === "reveal" && result && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="text-center space-y-1 pt-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">{TAROT_TOPICS.find(t => t.id === selectedTopic)?.emoji}</span>
                  <h2 className="font-serif text-lg text-gradient-red">{result.topicLabel}</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  {result.companionName} has laid your cards — tap each to reveal
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {result.cards.map((card, i) => (
                  <FlipCard
                    key={card.name}
                    card={card}
                    delay={i * 0.18}
                    onFlipComplete={() => setFlippedCount((c) => c + 1)}
                  />
                ))}
              </div>

              <AnimatePresence>
                {allFlipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 250, damping: 22 }}
                    className="space-y-3"
                  >
                    <div className="rounded-2xl p-4 space-y-3"
                      style={{ background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.18)" }}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest text-primary">Reading</span>
                        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                          +{result.affinityGain} ❤️ bond
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                        {result.readingText.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/conversations/${companionId}`)}
                        className="flex-1 h-11 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
                        style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 20px rgba(225,29,72,0.3)" }}
                      >
                        Continue with {result.companionName}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleReset}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <RotateCcw className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
