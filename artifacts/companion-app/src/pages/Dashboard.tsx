import { useGetMe, getGetMeQueryKey, useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Coins, Heart, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  const isLoading = userLoading || summaryLoading;

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-8">
        <header className="space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"
          >
            Welcome back{user?.username ? `, ${user.username}` : ''}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            Your companions are waiting for you.
          </motion.p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <StatCard 
            icon={<Coins className="w-5 h-5 text-accent" />}
            label="Credits"
            value={isLoading ? <Skeleton className="h-6 w-12" /> : user?.credits}
            delay={0.2}
          />
          <StatCard 
            icon={<Heart className="w-5 h-5 text-primary" />}
            label="Total Affinity"
            value={isLoading ? <Skeleton className="h-6 w-12" /> : summary?.totalAffinity}
            delay={0.3}
          />
          <StatCard 
            icon={<MessageCircle className="w-5 h-5 text-blue-400" />}
            label="Messages"
            value={isLoading ? <Skeleton className="h-6 w-12" /> : summary?.totalMessages}
            delay={0.4}
          />
          <StatCard 
            icon={<Sparkles className="w-5 h-5 text-purple-400" />}
            label="Active Chats"
            value={isLoading ? <Skeleton className="h-6 w-12" /> : summary?.activeConversations}
            delay={0.5}
          />
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-serif">Recent Activity</h2>
          
          <div className="space-y-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Card key={i} className="bg-card/50 border-white/5">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : summary?.recentActivity?.length === 0 ? (
              <div className="text-center p-8 bg-card/30 rounded-2xl border border-white/5">
                <p className="text-muted-foreground text-sm">No recent activity yet. Start chatting to build your bond.</p>
              </div>
            ) : (
              summary?.recentActivity?.map((activity, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                >
                  <Card className="bg-card/50 border-white/5 hover:bg-card/80 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-4">
                      <img 
                        src={activity.companionAvatar} 
                        alt={activity.companionName} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                      />
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm text-foreground">{activity.companionName}</h3>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {activity.lastMessage || "No messages yet"}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Heart className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary">{activity.affinity}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value, delay }: { icon: React.ReactNode, label: string, value: React.ReactNode, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
    >
      <Card className="bg-card/30 border-white/5 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
        <CardContent className="p-4 relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
          </div>
          <div className="text-2xl font-bold font-serif text-foreground">
            {value}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
