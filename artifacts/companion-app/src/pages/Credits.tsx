import { useGetMe, getGetMeQueryKey, useGetLedger, getGetLedgerQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Coins, Sparkles, Receipt, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

const STARS_PACKAGES = [
  { id: "starter", label: "Starter", credits: 50, stars: 50 },
  { id: "popular", label: "Popular", credits: 200, stars: 175, popular: true },
  { id: "premium", label: "Premium", credits: 500, stars: 399 },
];

export default function Credits() {
  const { data: user, isLoading: userLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: ledger, isLoading: ledgerLoading } = useGetLedger({ query: { queryKey: getGetLedgerQueryKey() } });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);

  const isTelegram = typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;

  const handleStarsPurchase = async (packageId: string) => {
    setLoadingPackage(packageId);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/credits/stars-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": (window as any).Telegram?.WebApp?.initData ?? "dev",
        },
        body: JSON.stringify({ packageId }),
      });

      if (!res.ok) throw new Error("Failed to create invoice");
      const { invoiceLink } = await res.json();

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoiceLink, (status: string) => {
          if (status === "paid") {
            toast({
              title: "Payment successful! ⭐",
              description: "Your credits have been added. It may take a moment to reflect.",
            });
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetLedgerQueryKey() });
            }, 2000);
          } else if (status === "cancelled") {
            toast({ title: "Payment cancelled" });
          } else if (status === "failed") {
            toast({ variant: "destructive", title: "Payment failed", description: "Please try again." });
          }
        });
      } else {
        // Outside Telegram: open the invoice link directly
        window.open(invoiceLink, "_blank");
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Could not start payment",
        description: "Please try again.",
      });
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-8">
        {/* Balance header */}
        <header className="space-y-2 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-primary/20 rounded-full mx-auto flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,105,180,0.3)]"
          >
            <Coins className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"
          >
            {userLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : user?.credits}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm uppercase tracking-widest"
          >
            Available Credits
          </motion.p>
        </header>

        {/* Stars payment section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <h2 className="text-xl font-serif">Buy with Telegram Stars</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Pay securely using Telegram's built-in Stars currency — no card needed.
          </p>
          <div className="grid gap-3">
            {STARS_PACKAGES.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <Card
                  className={`relative overflow-hidden ${
                    pkg.popular
                      ? "border-yellow-400/40 bg-yellow-400/5"
                      : "border-white/5 bg-card/50"
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -right-12 top-4 rotate-45 bg-yellow-400 text-black text-[10px] font-bold uppercase tracking-wider py-1 w-40 text-center shadow-lg">
                      Best Value
                    </div>
                  )}
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif font-medium text-base">{pkg.label}</h3>
                        {pkg.popular && <Sparkles className="w-3.5 h-3.5 text-yellow-400" />}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        {pkg.credits} credits
                      </p>
                    </div>
                    <Button
                      onClick={() => handleStarsPurchase(pkg.id)}
                      disabled={loadingPackage !== null}
                      className={`min-w-28 gap-1.5 font-semibold ${
                        pkg.popular
                          ? "bg-yellow-400 text-black hover:bg-yellow-300"
                          : "bg-white/10 text-foreground hover:bg-white/20"
                      }`}
                    >
                      {loadingPackage === pkg.id ? (
                        <span className="animate-pulse">...</span>
                      ) : (
                        <>
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {pkg.stars} Stars
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          {!isTelegram && (
            <p className="text-xs text-muted-foreground text-center mt-2 opacity-60">
              Open this app inside Telegram to pay with Stars.
            </p>
          )}
        </section>

        {/* Ledger */}
        <section className="space-y-4 pb-8">
          <h2 className="text-xl font-serif flex items-center gap-2">
            <Receipt className="w-5 h-5 text-muted-foreground" />
            Transaction History
          </h2>
          <div className="space-y-3">
            {ledgerLoading ? (
              Array(3)
                .fill(0)
                .map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl bg-card/50" />)
            ) : ledger?.length === 0 ? (
              <div className="text-center p-6 bg-card/30 rounded-2xl border border-white/5">
                <p className="text-muted-foreground text-sm">No transaction history.</p>
              </div>
            ) : (
              ledger?.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-card/30 border border-white/5"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{entry.description}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <div
                    className={`font-mono text-sm font-bold ${
                      entry.amount > 0 ? "text-green-400" : "text-foreground"
                    }`}
                  >
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount}
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
