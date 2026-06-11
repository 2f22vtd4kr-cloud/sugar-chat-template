import { useGetMe, getGetMeQueryKey, useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Coins, Heart, MessageCircle, Sparkles, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { Link } from "wouter";

export default function Dashboard() {
  const { t } = useTranslation();
  const { isPremium } = useTelegram();
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  const isLoading = userLoading || summaryLoading;

  const displayName = user?.username ? `@${user.username}` : user?.firstName ?? "";

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-6">
        <header className="space-y-1.5">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <h1 className="text-3xl font-serif text-gradient-red">
              {t("dashboard.welcome")}{displayName ? `, ${displayName}` : ""}
            </h1>
            {isPremium && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000" }}
              >
                <Crown className="w-3 h-3" /> {t("dashboard.premium_badge")}
              </motion.span>
            )}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            {t("dashboard.subtitle")}
          </motion.p>
        </header>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: <Coins className="w-4 h-4 text-accent" />, label: t("dashboard.credits"), value: user?.credits, delay: 0.15 },
            { icon: <Heart className="w-4 h-4 text-primary" />, label: t("dashboard.affinity"), value: summary?.totalAffinity, delay: 0.2 },
            { icon: <MessageCircle className="w-4 h-4 text-blue-400" />, label: t("dashboard.messages"), value: summary?.totalMessages, delay: 0.25 },
            { icon: <Sparkles className="w-4 h-4 text-purple-400" />, label: t("dashboard.active_chats"), value: summary?.activeConversations, delay: 0.3 },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: stat.delay, type: "spring", stiffness: 300, damping: 25 }}
            >
              <Card className="glass-card rounded-2xl border-0 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
                <CardContent className="p-4 relative z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {stat.icon}
                    <span className="text-[10px] font-medium uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-bold font-serif text-foreground">
                    {isLoading ? <Skeleton className="h-7 w-14 bg-white/5" /> : stat.value ?? 0}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Get subscription banner (if no subscription) */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Link href="/plans">
            <div className="rounded-2xl p-4 cursor-pointer flex items-center justify-between hover:brightness-110 transition-all"
              style={{ background: "linear-gradient(135deg, rgba(225,29,72,0.12), rgba(244,63,94,0.08))", border: "1px solid rgba(225,29,72,0.2)" }}>
              <div>
                <p className="font-serif font-medium text-sm text-gradient-red">Unlock Unlimited Access</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Subscribe from 49 ⭐ / week</p>
              </div>
              <Crown className="w-5 h-5 text-primary opacity-70" />
            </div>
          </Link>
        </motion.div>

        {/* Recent activity */}
        <section className="space-y-3">
          <h2 className="text-lg font-serif text-muted-foreground">{t("dashboard.recent_activity")}</h2>
          <div className="space-y-2">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/3 bg-white/5" />
                    <Skeleton className="h-3 w-2/3 bg-white/5" />
                  </div>
                </div>
              ))
            ) : !summary?.recentActivity?.length ? (
              <div className="text-center p-8 glass-card rounded-2xl">
                <p className="text-muted-foreground text-sm">{t("dashboard.no_activity")}</p>
              </div>
            ) : (
              summary.recentActivity.map((activity, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="glass-card rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:brightness-110 transition-all"
                >
                  <img
                    src={activity.companionAvatar}
                    alt={activity.companionName}
                    className="w-11 h-11 rounded-full object-cover border-2"
                    style={{ borderColor: "rgba(225,29,72,0.3)" }}
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{activity.companionName}</h3>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {activity.lastMessage || t("dashboard.no_messages")}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Heart className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary">{activity.affinity}</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
