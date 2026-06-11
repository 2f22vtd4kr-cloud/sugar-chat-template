import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageSquare, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useTelegram } from "@/context/TelegramContext";

export default function Conversations() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const [, navigate] = useLocation();
  const { data: conversations, isLoading } = useListConversations({ query: { queryKey: getListConversationsQueryKey() } });

  const openConversation = (companionId: string) => {
    haptic("light");
    navigate(`/conversations/${companionId}`);
  };

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-5">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-3xl font-serif text-gradient-red">{t("conversations.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("conversations.subtitle")}</p>
        </motion.header>

        <div className="space-y-2.5">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <Skeleton className="w-14 h-14 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 bg-white/5" />
                  <Skeleton className="h-3 w-3/4 bg-white/5" />
                </div>
              </div>
            ))
          ) : !conversations?.length ? (
            <div className="text-center p-12 glass-card rounded-2xl flex flex-col items-center gap-3">
              <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{t("conversations.no_conversations")}</p>
            </div>
          ) : (
            conversations?.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07, type: "spring", stiffness: 300, damping: 28 }}
              >
                <div
                  className="glass-card rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer hover:brightness-110 transition-all duration-200 group relative overflow-hidden"
                  onClick={() => openConversation(conv.companionId)}
                >
                  {/* hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background: "linear-gradient(135deg, rgba(225,29,72,0.05), transparent)" }} />

                  <div className="relative flex-shrink-0">
                    <img src={conv.companion.avatarUrl} alt={conv.companion.name}
                      className="w-13 h-13 w-[52px] h-[52px] rounded-full object-cover border-2"
                      style={{ borderColor: "rgba(225,29,72,0.3)" }} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}>
                      <Heart className="w-2.5 h-2.5 text-white fill-white" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif font-medium text-sm">{conv.companion.name}</h3>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage || conv.companion.greetingText}
                    </p>
                    {/* Affinity bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${conv.affinity}%` }}
                          transition={{ duration: 1.2, delay: 0.3 + i * 0.07, ease: "easeOut" }}
                          style={{ background: "linear-gradient(90deg, hsl(348 76% 40%), hsl(351 88% 62%))" }}
                        />
                      </div>
                      <span className="text-[10px] font-bold w-5 text-right" style={{ color: "hsl(348 76% 65%)" }}>
                        {conv.affinity}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 group-hover:text-primary/60 transition-colors duration-200" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
