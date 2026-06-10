import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Conversations() {
  const { data: conversations, isLoading } = useListConversations({ query: { queryKey: getListConversationsQueryKey() } });

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-6">
        <header className="space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"
          >
            Chats
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            Your ongoing conversations and bonds.
          </motion.p>
        </header>

        <div className="space-y-3">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-card/50 border-white/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : conversations?.length === 0 ? (
            <div className="text-center p-12 bg-card/30 rounded-2xl border border-white/5 flex flex-col items-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-sm">No conversations yet.</p>
            </div>
          ) : (
            conversations?.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <Card className="bg-card/50 border-white/5 hover:bg-card/80 transition-colors cursor-pointer relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={conv.companion.avatarUrl} 
                        alt={conv.companion.name} 
                        className="w-14 h-14 rounded-full object-cover border-2 border-primary/20"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                        <div className="bg-primary/20 rounded-full p-1 flex items-center justify-center">
                          <Heart className="w-3 h-3 text-primary" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif font-medium text-foreground text-base">{conv.companion.name}</h3>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conv.lastMessage || conv.companion.greetingText}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-background rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full transition-all duration-1000" 
                            style={{ width: `${conv.affinity}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-primary w-6 text-right">
                          {conv.affinity}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
