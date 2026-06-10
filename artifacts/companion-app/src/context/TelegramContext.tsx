import React, { createContext, useContext, useEffect, useState } from "react";
import { setInitData } from "../lib/api";

interface TelegramContextValue {
  initData: string;
  isReady: boolean;
}

const TelegramContext = createContext<TelegramContextValue | undefined>(undefined);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [initData, setLocalInitData] = useState("");

  useEffect(() => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const data = tg.initData || "";
      setLocalInitData(data);
      setInitData(data);
    } else {
      // Fallback for dev mode outside Telegram
      const fallback = "dev-fallback-init-data";
      setLocalInitData(fallback);
      setInitData(fallback);
    }
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Initializing...</div>;
  }

  return (
    <TelegramContext.Provider value={{ initData, isReady }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error("useTelegram must be used within TelegramProvider");
  }
  return context;
}
