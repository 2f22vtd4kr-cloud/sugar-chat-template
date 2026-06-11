import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTelegram } from "@/context/TelegramContext";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { User, Globe, Sparkles, Shield, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface BonusSummary {
  hasPremiumAccess: boolean;
  isTelegramPremium: boolean;
  extraEnergyPerDay: number;
  priorityMultiplier: number;
  dailyImageCredits: number;
  badgeLabel: string;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { isPremium, haptic } = useTelegram();
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: bonuses } = useQuery<BonusSummary>({
    queryKey: ["users", "bonuses"],
    queryFn: () => fetch(`${import.meta.env.BASE_URL}api/users/me/bonuses`).then((r) => r.json()),
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedLang, setSelectedLang] = useState(i18n.language.slice(0, 2));

  const handleSaveLanguage = async () => {
    setSaving(true);
    haptic("medium");
    try {
      await fetch(`${import.meta.env.BASE_URL}api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: selectedLang }),
      });
      i18n.changeLanguage(selectedLang);
      await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: t("settings.saved") });
    } catch {
      toast({ variant: "destructive", title: "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetAdult = async () => {
    haptic("heavy");
    await fetch(`${import.meta.env.BASE_URL}api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adultConfirmed: false }),
    });
    await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    toast({ title: "Adult confirmation reset" });
  };

  return (
    <AppLayout>
      <div className="p-4 pt-8 space-y-6 pb-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-serif text-gradient-red">{t("settings.title")}</h1>
        </motion.header>

        {/* Account card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card rounded-2xl overflow-hidden border-0">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}>
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-serif font-medium text-base truncate">
                      {isLoading ? "..." : user?.username ? `@${user.username}` : user?.firstName ?? "Anonymous"}
                    </p>
                    {isPremium && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                        style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#000" }}>
                        <Sparkles className="w-2.5 h-2.5" /> Premium
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.telegram_id")}: {isLoading ? "..." : user?.telegramId}
                  </p>
                </div>
              </div>
              <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(225,29,72,0.2), transparent)" }} />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("settings.premium")}</span>
                <span className={isPremium ? "text-yellow-400 font-medium" : "text-muted-foreground"}>
                  {isPremium ? t("settings.premium_yes") : t("settings.premium_no")}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {bonuses && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="glass-card rounded-2xl overflow-hidden border-0">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">{t("settings.bonus_title")}</p>
                    <h2 className="font-serif text-lg text-foreground">
                      {bonuses.hasPremiumAccess ? bonuses.badgeLabel : t("settings.bonus_standard")}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("settings.bonus_priority")}</p>
                    <p className="text-lg font-bold text-foreground">{bonuses.priorityMultiplier.toFixed(2)}x</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-2">
                    {t("settings.bonus_energy", { count: bonuses.extraEnergyPerDay })}
                  </span>
                  <span className="rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-2">
                    {t("settings.bonus_images", { count: bonuses.dailyImageCredits })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Language selector */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card rounded-2xl overflow-hidden border-0">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="w-4 h-4 text-primary" />
                {t("settings.language")}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setSelectedLang(lang.code); haptic("light"); }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium transition-all duration-200",
                      selectedLang === lang.code
                        ? "text-white"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                    style={selectedLang === lang.code
                      ? { background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 14px rgba(225,29,72,0.4)" }
                      : undefined}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-[10px] leading-none">{lang.label}</span>
                  </button>
                ))}
              </div>
              <Button
                onClick={handleSaveLanguage}
                disabled={saving || selectedLang === (user?.language ?? "en")}
                className="w-full h-10 rounded-xl font-semibold"
                style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}
              >
                {saving ? t("settings.save") + "..." : t("settings.save")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Open bot */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-card rounded-2xl overflow-hidden border-0">
            <CardContent className="p-4 space-y-3">
              <Button
                variant="ghost"
                className="w-full justify-between h-11 text-sm rounded-xl bg-white/5 hover:bg-white/10"
                onClick={() => {
                  haptic("light");
                  (window as any).Telegram?.WebApp?.openTelegramLink?.(`https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? ""}`) ||
                    window.open("https://t.me", "_blank");
                }}
              >
                <span>{t("settings.open_bot")}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger zone */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-card rounded-2xl overflow-hidden border-0 border border-red-900/30">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />{t("settings.danger_zone")}
              </p>
              <Button
                variant="ghost"
                className="w-full h-10 text-sm rounded-xl bg-red-950/40 text-red-400 hover:bg-red-950/60 hover:text-red-300"
                onClick={handleResetAdult}
              >
                {t("settings.nsfw_reset")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-[10px] text-muted-foreground">Sugar Chat · v7.0</p>
      </div>
    </AppLayout>
  );
}
