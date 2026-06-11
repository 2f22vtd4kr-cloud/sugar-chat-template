import { useListCompanions, getListCompanionsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";

export default function Companions() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const { data: companions, isLoading } = useListCompanions({ query: { queryKey: getListCompanionsQueryKey() } });

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-5">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-3xl font-serif text-gradient-red">{t("companions.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("companions.subtitle")}</p>
        </motion.header>

        <div className="grid grid-cols-2 gap-3">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl overflow-hidden">
                <Skeleton className="h-44 w-full rounded-none bg-white/5" />
                <div className="p-3 space-y-1.5">
                  <Skeleton className="h-4 w-2/3 bg-white/5" />
                  <Skeleton className="h-3 w-1/2 bg-white/5" />
                </div>
              </div>
            ))
          ) : (
            companions?.map((companion, i) => (
              <motion.div
                key={companion.id}
                initial={{ opacity: 0, scale: 0.93 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
              >
                <div className="glass-card rounded-2xl overflow-hidden group cursor-pointer" onClick={() => haptic("light")}>
                  <div className="relative aspect-square">
                    <img src={companion.avatarUrl} alt={companion.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "radial-gradient(ellipse at bottom, rgba(225,29,72,0.22) 0%, transparent 70%)" }} />
                    <div className="absolute bottom-2 left-2 right-2">
                      <h3 className="font-serif font-semibold text-white text-sm drop-shadow-sm">{companion.name}</h3>
                      <p className="text-[10px] text-white/60 line-clamp-1 mt-0.5">{companion.personality}</p>
                    </div>
                  </div>
                  <div className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Coins className="w-3 h-3" />
                      <span className="text-[10px] font-medium">{companion.creditCostText} {t("companions.cost_per_msg")}</span>
                    </div>
                    <button
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                      style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 10px rgba(225,29,72,0.4)" }}
                      onClick={(e) => { e.stopPropagation(); haptic("medium"); (window as any).Telegram?.WebApp?.close(); }}
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
