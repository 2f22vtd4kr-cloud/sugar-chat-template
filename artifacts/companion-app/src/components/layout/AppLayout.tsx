import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, MessageSquare, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/companions", icon: Users, label: "Explore" },
    { href: "/conversations", icon: MessageSquare, label: "Chats" },
    { href: "/credits", icon: Coins, label: "Credits" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col max-w-md mx-auto relative overflow-hidden">
      <main className="flex-1 pb-20 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/80 backdrop-blur-xl border-t border-border z-50">
        <div className="flex items-center justify-around p-3">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div 
                  className={cn(
                    "flex flex-col items-center gap-1 transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-all duration-300",
                    isActive ? "bg-primary/10 shadow-[0_0_15px_rgba(255,105,180,0.2)]" : "bg-transparent"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
