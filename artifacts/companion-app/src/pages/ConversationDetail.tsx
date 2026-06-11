import { useGetConversation, getGetConversationQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, MessageSquare, ExternalLink, Image as ImageIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { GiftPanel, type GiftResult } from "@/components/GiftPanel";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";

interface ConversationDetailProps {
  companionId: string;
}

function ChatBubble({ message, avatarUrl }: { message: Message; avatarUrl: string }) {
  const isUser = message.sender === "user";
  const isImage = message.type === "image";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && (
        <img src={avatarUrl} alt="companion"
          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1 border"
          style={{ borderColor: "rgba(225,29,72,0.3)" }} />
      )}
      <div
        className={`max-w-[75%] rounded-2xl overflow-hidden ${isUser ? "rounded-br-sm" : "rounded-bl-sm"}`}
        style={isUser
          ? { background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }
          : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {isImage && message.mediaUrl ? (
          <div className="relative">
            <img src={message.mediaUrl} alt="companion image" className="w-full max-w-[220px] object-cover rounded-2xl"
              style={isUser ? {} : { borderRadius: "1rem 1rem 1rem 0.25rem" }} />
            <div className="absolute bottom-1.5 right-2 flex items-center gap-1 bg-black/50 rounded-full px-1.5 py-0.5">
              <ImageIcon className="w-2.5 h-2.5 text-white/70" />
            </div>
          </div>
        ) : (
          <div className="px-3 py-2">
            <p className={`text-sm leading-relaxed ${isUser ? "text-white" : "text-foreground"}`}>{message.content}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MessageTimestamp({ createdAt }: { createdAt: string }) {
  return (
    <div className="flex justify-center">
      <span className="text-[10px] text-muted-foreground/60 px-2 py-0.5 rounded-full"
        style={{ background: "rgba(255,255,255,0.04)" }}>
        {format(new Date(createdAt), "MMM d · h:mm a")}
      </span>
    </div>
  );
}

export default function ConversationDetail({ companionId }: ConversationDetailProps) {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [, navigate] = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Live affinity & milestone state
  const [liveAffinity, setLiveAffinity] = useState<number | null>(null);
  const [pendingMilestones, setPendingMilestones] = useState<number[]>([]);
  const [celebratingMilestone, setCelebratingMilestone] = useState<number | null>(null);
  const [milestoneRewardCredits, setMilestoneRewardCredits] = useState(0);

  const { data: conversation, isLoading } = useGetConversation(companionId, {
    query: { queryKey: getGetConversationQueryKey(companionId) },
  });

  const affinity = liveAffinity ?? conversation?.affinity ?? 0;

  // Scroll to bottom when messages load
  useEffect(() => {
    if (conversation?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [conversation?.messages?.length]);

  // Process pending milestone queue (one at a time)
  useEffect(() => {
    if (pendingMilestones.length > 0 && celebratingMilestone === null) {
      const [next, ...rest] = pendingMilestones;
      setCelebratingMilestone(next);
      setPendingMilestones(rest);
    }
  }, [pendingMilestones, celebratingMilestone]);

  const handleGiftSent = (result: GiftResult) => {
    setLiveAffinity(result.newAffinity);
    qc.invalidateQueries({ queryKey: getGetConversationQueryKey(companionId) });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });

    if (result.newlyReachedMilestones.length > 0) {
      setMilestoneRewardCredits(result.milestoneRewardCredits);
      setPendingMilestones((prev) => [...prev, ...result.newlyReachedMilestones]);
    }
    // Scroll to bottom after companion reaction loads
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 800);
  };

  const handleMilestoneClose = () => {
    haptic("heavy");
    setCelebratingMilestone(null);
  };

  const handleBack = () => { haptic("light"); navigate("/conversations"); };
  const handleContinueInBot = () => {
    haptic("medium");
    const botUsername = import.meta.env.VITE_BOT_USERNAME as string | undefined;
    const deepLink = botUsername ? `https://t.me/${botUsername}?start=companion_${companionId}` : undefined;
    if (deepLink) {
      const openTelegramLink = (window as any).Telegram?.WebApp?.openTelegramLink as ((url: string) => void) | undefined;
      if (openTelegramLink) openTelegramLink(deepLink);
      else window.open(deepLink, "_blank");
      return;
    }
    (window as any).Telegram?.WebApp?.close?.() ?? navigate("/conversations");
  };

  const messages = conversation?.messages ?? [];
  const shouldShowTimestamp = (i: number) =>
    i === 0 || new Date(messages[i].createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 10 * 60 * 1000;

  // User credits from conversation data isn't available here, use a fallback
  // We'll re-fetch via the Me query key we already have
  const [userCredits, setUserCredits] = useState(99);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/users/me`)
      .then((r) => r.json())
      .then((u) => setUserCredits(u.credits ?? 0))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background max-w-md mx-auto relative overflow-hidden">
      {/* Milestone celebration overlay */}
      {celebratingMilestone !== null && conversation && (
        <MilestoneCelebration
          milestone={celebratingMilestone}
          companionName={conversation.companion.name}
          companionAvatar={conversation.companion.avatarUrl}
          rewardCredits={milestoneRewardCredits}
          onClose={handleMilestoneClose}
        />
      )}

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] opacity-[0.05] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "rgba(12,3,6,0.88)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", borderBottomColor: "rgba(225,29,72,0.15)" }}>
        <button onClick={handleBack} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>

        {isLoading ? (
          <>
            <Skeleton className="w-9 h-9 rounded-full bg-white/5" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-24 bg-white/5" /><Skeleton className="h-3 w-16 bg-white/5" /></div>
          </>
        ) : (
          <>
            <div className="relative">
              <img src={conversation?.companion.avatarUrl} alt={conversation?.companion.name}
                className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: "rgba(225,29,72,0.4)" }} />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}>
                <Heart className="w-2 h-2 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif font-semibold text-sm text-foreground truncate">{conversation?.companion.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${Math.min(affinity, 100)}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ background: "linear-gradient(90deg, hsl(348 76% 40%), hsl(351 88% 62%))" }}
                  />
                </div>
                <span className="text-[10px] font-medium" style={{ color: "hsl(348 76% 65%)" }}>
                  {t("conversations.affinity_label")} {affinity}
                </span>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-36 space-y-2">
        {isLoading ? (
          <div className="space-y-4 pt-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}>
                {i % 2 === 0 && <Skeleton className="w-7 h-7 rounded-full bg-white/5 flex-shrink-0" />}
                <Skeleton className="h-10 rounded-2xl bg-white/5" style={{ width: `${40 + Math.random() * 35}%` }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t("conversations.no_conversations")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <div key={msg.id}>
                {shouldShowTimestamp(i) && (
                  <div className="py-2"><MessageTimestamp createdAt={msg.createdAt} /></div>
                )}
                <ChatBubble message={msg} avatarUrl={conversation?.companion.avatarUrl ?? ""} />
              </div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Footer — gifts + continue */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pt-3 pb-5 space-y-3"
        style={{ background: "linear-gradient(to top, rgba(8,2,4,1) 55%, transparent)" }}>

        {/* Gift panel */}
        {!isLoading && conversation && (
          <GiftPanel
            companionId={companionId}
            userCredits={userCredits}
            onGiftSent={handleGiftSent}
          />
        )}

        {/* Continue button */}
        <Button
          onClick={handleContinueInBot}
          className="w-full h-11 rounded-2xl font-semibold text-base gap-2"
          style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 24px rgba(225,29,72,0.3)" }}
        >
          <ExternalLink className="w-4 h-4" />
          Continue in Telegram
        </Button>

        {messages.length > 0 && (
          <p className="text-[10px] text-muted-foreground/40 text-center -mt-1">
            {messages.length} messages · showing last 50
          </p>
        )}
      </div>
    </div>
  );
}
