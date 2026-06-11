import { Component, type ErrorInfo, type ReactNode } from "react";
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
import ConversationDetail from "@/pages/ConversationDetail";
import TarotPage from "@/pages/Tarot";
import ShopPage from "@/pages/Shop";
import InventoryPage from "@/pages/Inventory";
import AdminPage from "@/pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ── React Error Boundary ─────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
          <div className="text-center">
            <div
              className="inline-flex w-16 h-16 rounded-3xl items-center justify-center mb-4"
              style={{ background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.25)" }}
            >
              <span className="text-3xl">💔</span>
            </div>
            <h2 className="font-serif font-bold text-xl text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-8 py-3 rounded-2xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", boxShadow: "0 0 20px rgba(225,29,72,0.35)" }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── NSFW Gate ────────────────────────────────────────────────────────────────
function NsfwGate({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "hsl(348 76% 49%)", borderTopColor: "transparent" }}
        />
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

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/companions" component={Companions} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/conversations/:companionId">
        {(params) => <ConversationDetail companionId={params.companionId} />}
      </Route>
      <Route path="/tarot/:companionId">
        {(params) => <TarotPage companionId={params.companionId} />}
      </Route>
      <Route path="/shop" component={ShopPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/credits" component={Credits} />
      <Route path="/plans" component={Plans} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <TelegramProvider>
            <NsfwGate>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppErrorBoundary>
                  <Router />
                </AppErrorBoundary>
              </WouterRouter>
            </NsfwGate>
          </TelegramProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
