import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const BASE = import.meta.env.BASE_URL;

function apiFetch(path: string, token: string) {
  return fetch(`${BASE}api/admin/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => {
    if (!r.ok) throw new Error("Unauthorized");
    return r.json();
  });
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{
        background: "rgba(225,29,72,0.08)",
        border: "1px solid rgba(225,29,72,0.18)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-rose-400 mb-3">{title}</h2>
      {children}
    </div>
  );
}

// ── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (t: string) => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("stats", pass);
      sessionStorage.setItem("admin_token", pass);
      onLogin(pass);
    } catch {
      setErr(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col gap-5"
        style={{
          background: "rgba(225,29,72,0.07)",
          border: "1px solid rgba(225,29,72,0.2)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Sugar Chat v8</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Admin password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(false); }}
            className="w-full rounded-xl px-4 py-3 text-sm bg-black/30 border text-foreground outline-none focus:ring-2"
            style={{
              borderColor: err ? "hsl(0 84% 60%)" : "rgba(225,29,72,0.25)",
              "--tw-ring-color": "rgba(225,29,72,0.4)",
            } as React.CSSProperties}
            autoFocus
          />
          {err && <p className="text-xs text-red-400 text-center">Incorrect password</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))" }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Revenue chart tooltip ─────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(15,0,10,0.9)", border: "1px solid rgba(225,29,72,0.3)" }}>
      <p className="font-semibold text-rose-300">{label}</p>
      <p className="text-white">{payload[0].value} ⭐ revenue</p>
      <p className="text-muted-foreground">{payload[1]?.value ?? 0} transactions</p>
    </div>
  );
}

// ── Companion tooltip ─────────────────────────────────────────────────────────
function CompanionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(15,0,10,0.9)", border: "1px solid rgba(225,29,72,0.3)" }}>
      <p className="font-semibold text-rose-300">{label}</p>
      <p className="text-white">{payload[0]?.value ?? 0} messages</p>
      <p className="text-rose-200">Avg affinity {payload[1]?.value ?? 0}</p>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function Dashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<any>(null);
  const [companions, setCompanions] = useState<any[]>([]);
  const [whales, setWhales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "companions" | "whales" | "transactions">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, w, t, rc] = await Promise.all([
        apiFetch("stats", token),
        apiFetch("companions", token),
        apiFetch("whales", token),
        apiFetch("transactions", token),
        apiFetch("revenue-chart", token),
      ]);
      setStats(s);
      setCompanions(c);
      setWhales(w);
      setTransactions(t);
      setRevenueChart(rc);
    } catch {
      sessionStorage.removeItem("admin_token");
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "hsl(348 76% 49%)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "companions", label: "Companions" },
    { id: "whales", label: "🐋 Whales" },
    { id: "transactions", label: "Transactions" },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: "rgba(5,0,10,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(225,29,72,0.15)" }}
      >
        <div>
          <h1 className="text-lg font-bold text-foreground">Admin</h1>
          <p className="text-xs text-muted-foreground">Sugar Chat v8 · Live</p>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: "rgba(225,29,72,0.15)", color: "hsl(348 76% 65%)", border: "1px solid rgba(225,29,72,0.25)" }}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="px-4">
        {/* Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-all"
              style={
                tab === t.id
                  ? { background: "linear-gradient(135deg, hsl(348 76% 49%), hsl(351 88% 62%))", color: "#fff" }
                  : { background: "rgba(225,29,72,0.1)", color: "hsl(348 76% 65%)", border: "1px solid rgba(225,29,72,0.2)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ──────────────────────────────────────────────── */}
        {tab === "overview" && stats && (
          <>
            <Section title="Revenue (⭐ Stars)">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total" value={`⭐ ${stats.revenue.total.toLocaleString()}`} />
                <StatCard label="Last 24h" value={`⭐ ${stats.revenue.last24h.toLocaleString()}`} />
                <StatCard label="Last 7d" value={`⭐ ${stats.revenue.last7d.toLocaleString()}`} />
                <StatCard label="Last 30d" value={`⭐ ${stats.revenue.last30d.toLocaleString()}`} />
              </div>
            </Section>

            <Section title="Users">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Total" value={stats.users.total.toLocaleString()} />
                <StatCard label="New Today" value={stats.users.newToday.toLocaleString()} />
                <StatCard label="Active 7d" value={stats.users.active7d.toLocaleString()} />
              </div>
            </Section>

            <Section title="Engagement">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total Messages" value={stats.messages.total.toLocaleString()} />
                <StatCard label="Messages 24h" value={stats.messages.last24h.toLocaleString()} />
                <StatCard label="Active Subs" value={stats.subscriptions.active.toLocaleString()} sub={`of ${stats.subscriptions.total} total`} />
                <StatCard
                  label="Cart Recovery"
                  value={`${stats.abandonedCheckouts.conversionRate}%`}
                  sub={`${stats.abandonedCheckouts.converted}/${stats.abandonedCheckouts.total} recovered`}
                />
              </div>
            </Section>

            {revenueChart.length > 0 && (
              <Section title="Revenue — Last 30 Days">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.15)" }}
                >
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={revenueChart} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                        tickFormatter={(v) => v.slice(5)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<RevenueTooltip />} />
                      <Bar dataKey="revenue" fill="hsl(348 76% 49%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="txCount" fill="rgba(225,29,72,0.3)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}
          </>
        )}

        {/* ── Companions ───────────────────────────────────────────── */}
        {tab === "companions" && (
          <>
            {companions.length > 0 && (
              <Section title="Messages per Companion">
                <div
                  className="rounded-2xl p-4 mb-4"
                  style={{ background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.15)" }}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={companions.slice(0, 12)} layout="vertical" barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.55)" }}
                        width={90}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.split(" ")[0]}
                      />
                      <Tooltip content={<CompanionTooltip />} />
                      <Bar dataKey="messages" fill="hsl(348 76% 49%)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="avgAffinity" fill="rgba(225,29,72,0.3)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            <Section title="All Companions">
              <div className="flex flex-col gap-2">
                {companions.map((c) => (
                  <div
                    key={c.companionId}
                    className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: "rgba(225,29,72,0.07)", border: "1px solid rgba(225,29,72,0.15)" }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.conversations} convos · avg ❤️ {c.avgAffinity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-rose-400">{c.messages.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">messages</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── Whales ───────────────────────────────────────────────── */}
        {tab === "whales" && (
          <Section title="Top Spenders">
            <div className="flex flex-col gap-2">
              {whales.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No purchases yet</p>
              )}
              {whales.map((w, i) => (
                <div
                  key={w.userId}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: i < 3 ? "rgba(225,29,72,0.12)" : "rgba(225,29,72,0.05)",
                    border: `1px solid ${i < 3 ? "rgba(225,29,72,0.3)" : "rgba(225,29,72,0.12)"}`,
                  }}
                >
                  <span className="text-base font-bold text-muted-foreground w-6 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {w.firstName ?? w.username ?? `User ${w.telegramId.slice(-4)}`}
                      {w.username && <span className="text-xs text-muted-foreground ml-1">@{w.username}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      🔥 {w.streakDays}d streak · 💎 {w.credits} credits left
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-rose-400">⭐ {w.totalSpent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">spent</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Transactions ─────────────────────────────────────────── */}
        {tab === "transactions" && (
          <Section title="Recent Transactions">
            <div className="flex flex-col gap-2">
              {transactions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
              )}
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.13)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.firstName ?? tx.username ?? "anon"} ·{" "}
                      {new Date(tx.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {tx.dynamicPriceApplied != null && (
                      <p className="text-xs text-rose-400/70">dynamic ×{Number(tx.dynamicPriceApplied).toFixed(2)}</p>
                    )}
                  </div>
                  <span
                    className="text-sm font-bold shrink-0 ml-3"
                    style={{ color: tx.amount > 0 ? "hsl(142 71% 50%)" : "hsl(348 76% 60%)" }}
                  >
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("admin_token"));

  if (!token) return <LoginScreen onLogin={setToken} />;
  return <Dashboard token={token} />;
}
