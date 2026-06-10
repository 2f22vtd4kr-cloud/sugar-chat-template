import { useListCompanions, getListCompanionsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Companions() {
  const { data: companions, isLoading } = useListCompanions({ query: { queryKey: getListCompanionsQueryKey() } });

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-6">
        <header className="space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"
          >
            Explore
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            Find a new companion to connect with.
          </motion.p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-card/50 border-white/5 overflow-hidden">
                <Skeleton className="h-40 w-full rounded-none" />
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : (
            companions?.map((companion, i) => (
              <motion.div
                key={companion.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <Card className="bg-card/50 border-white/5 overflow-hidden group">
                  <div className="relative aspect-square">
                    <img 
                      src={companion.avatarUrl} 
                      alt={companion.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <h3 className="font-serif font-medium text-foreground">{companion.name}</h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{companion.personality}</p>
                    </div>
                  </div>
                  <CardContent className="p-2 flex items-center justify-between bg-card/80 backdrop-blur">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Cost</span>
                      <span className="text-xs font-medium text-primary">{companion.creditCostText} cr/msg</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-7 w-7 p-0 rounded-full bg-primary/20 text-primary hover:bg-primary/40"
                      onClick={() => {
                        if (window.Telegram?.WebApp) {
                          // In a real app this might redirect to a specific bot deep link
                          window.Telegram.WebApp.close();
                        }
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
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
