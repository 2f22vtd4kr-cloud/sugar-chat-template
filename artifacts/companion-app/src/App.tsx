import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramProvider } from "@/context/TelegramContext";
import { NsfwModal } from "@/components/NsfwModal";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Companions from "@/pages/Companions";
import Conversations from "@/pages/Conversations";
import Credits from "@/pages/Credits";
import Settings from "@/pages/Settings";
import Plans from "@/pages/Plans";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function NsfwGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "hsl(348 76% 49%)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (user && !user.adultConfirmed) {
    return (
      <NsfwModal
        onConfirm={async () => {
          await fetch(`${import.meta.env.BASE_URL}api/users/me`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adultConfirmed: true }),
          });
          await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        }}
        onDecline={() => {
          (window as any).Telegram?.WebApp?.close();
        }}
      />
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/companions" component={Companions} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/credits" component={Credits} />
      <Route path="/plans" component={Plans} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TelegramProvider>
          <NsfwGate>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </NsfwGate>
        </TelegramProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
