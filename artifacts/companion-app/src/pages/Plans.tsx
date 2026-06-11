import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Check, Sparkles, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface Plan { id: string; label: string; stars: number; daysValid: number; description: string; benefits: string[] }
interface ActiveSub { id: string; planId: string; expiresAt: string; status: string; plan: Plan }

export default function Plans() {
  const { t } = useTranslation();
  const { haptic } = useTelegram();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/plans`).then((r) => r.json()),
  });

  const { data: activeSub, isLoading: subLoading, refetch } = useQuery<ActiveSub | null>({
    queryKey: ["plans", "active"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/plans/active`).then((r) => r.json()),
  });

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    haptic("medium");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/plans/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      const { invoiceLink } = await res.json();

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoiceLink, (status: string) => {
          if (status === "paid") {
            haptic("heavy");
            toast({ title: "Subscription activated! ⭐", description: "Your plan is now active." });
            setTimeout(() => refetch(), 2000);
          } else if (status === "cancelled") {
            toast({ title: t("credits.cancelled", "Cancelled") });
          } else if (status === "failed") {
            toast({ variant: "destructive", title: "Payment failed. Please try again." });
          }
        });
      } else {
        window.open(invoiceLink, "_blank");
      }
    } catch {
      toast({ variant: "destructive", title: "Could not start payment. Please try again." });
    } finally {
      setLoading(null);
    }
  };

  const benefitLabel: Record<string, string> = {
    unlimited_chat: t("plans.benefit_unlimited_chat"),
    daily_images: t("plans.benefit_daily_images"),
    priority_ai: t("plans.benefit_priority_ai"),
    half_images: t("plans.benefit_half_images"),
    premium_badge: t("plans.benefit_premium_badge"),
  };

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-6 pb-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1 text-center"
        >
          <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3 glow-red"
            style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}>
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-serif text-gradient-red">{t("plans.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("plans.subtitle")}</p>
        </motion.header>

        {/* Active sub */}
        {!subLoading && activeSub && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl p-4 text-center space-y-1"
              style={{ background: "linear-gradient(135deg, rgba(225,29,72,0.15), rgba(244,63,94,0.1))", border: "1px solid rgba(225,29,72,0.3)" }}>
              <p className="text-xs text-primary uppercase tracking-widest font-medium">{t("plans.active_plan")}</p>
              <p className="font-serif text-xl font-bold text-foreground">{activeSub.plan?.label}</p>
              <p className="text-xs text-muted-foreground">
                {t("plans.expires")} {format(new Date(activeSub.expiresAt), "MMM d, yyyy")}
              </p>
            </div>
          </motion.div>
        )}

        {/* Plan cards */}
        <div className="space-y-4">
          {plansLoading ? (
            Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-2xl bg-card/50" />)
          ) : (
            plans?.map((plan, i) => {
              const isMonthly = plan.id === "monthly";
              const isActive = activeSub?.planId === plan.id;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                >
                  <Card className="glass-card rounded-2xl overflow-hidden border-0 relative"
                    style={isMonthly ? { borderColor: "rgba(225,29,72,0.35)", boxShadow: "0 0 30px rgba(225,29,72,0.12)" } : {}}>
                    {isMonthly && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                        style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}>
                        <Sparkles className="w-3 h-3" /> {t("plans.most_popular")}
                      </div>
                    )}
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <h3 className="font-serif text-xl font-bold">{plan.label}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="text-3xl font-bold font-serif">{plan.stars}</span>
                        <span className="text-muted-foreground text-sm">
                          {plan.id === "weekly" ? t("plans.per_week") : t("plans.per_month")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {plan.benefits.map((b) => (
                          <div key={b} className="flex items-center gap-2 text-sm">
                            <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="text-foreground/80">{benefitLabel[b] ?? b}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={loading !== null || isActive}
                        className="w-full h-11 rounded-xl font-semibold text-base gap-2"
                        style={isMonthly
                          ? { background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 20px rgba(225,29,72,0.3)" }
                          : { background: "rgba(225,29,72,0.15)", color: "hsl(348 76% 65%)", border: "1px solid rgba(225,29,72,0.3)" }
                        }
                      >
                        {loading === plan.id ? (
                          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        ) : isActive ? (
                          <><Check className="w-4 h-4" /> {t("plans.active_plan")}</>
                        ) : (
                          <><Star className="w-4 h-4 fill-current" /> {plan.stars} {t("plans.subscribe")}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground opacity-50">{t("plans.open_telegram")}</p>
      </div>
    </AppLayout>
  );
}
