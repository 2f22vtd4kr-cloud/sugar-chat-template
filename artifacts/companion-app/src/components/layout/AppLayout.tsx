import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, MessageSquare, Coins, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: t("nav.home") },
    { href: "/companions", icon: Users, label: t("nav.explore") },
    { href: "/conversations", icon: MessageSquare, label: t("nav.chats") },
    { href: "/credits", icon: Coins, label: t("nav.credits") },
    { href: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Ambient red glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] opacity-[0.06] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(348 76% 49%) 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <main className="flex-1 pb-[4.5rem] overflow-y-auto overflow-x-hidden">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 glass-nav">
        <div className="flex items-center justify-around py-1.5 px-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-0.5 py-1 transition-all duration-250",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  <div className="relative p-1.5 rounded-xl">
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: "rgba(225,29,72,0.18)", boxShadow: "0 0 14px rgba(225,29,72,0.4)" }}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Icon className="w-[18px] h-[18px] relative z-10" />
                  </div>
                  <span className="text-[9px] font-medium tracking-wide leading-none">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
