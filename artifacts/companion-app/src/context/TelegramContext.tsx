import React, { createContext, useContext, useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramContextValue {
  initData: string;
  telegramUser: TelegramUser | null;
  photoUrl: string | null;
  isPremium: boolean;
  isReady: boolean;
  adultConfirmed: boolean;
  setAdultConfirmed: (v: boolean) => void;
  haptic: (type?: "light" | "medium" | "heavy" | "soft" | "rigid") => void;
}

const TelegramContext = createContext<TelegramContextValue | undefined>(undefined);

function parseTelegramUser(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(decodeURIComponent(userStr)) as TelegramUser;
  } catch {
    return null;
  }
}

// Inject initData header into every fetch request
let _initData = "";
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (_initData) {
    init = init ?? {};
    const headers = new Headers(init.headers);
    if (!headers.has("x-telegram-init-data")) {
      headers.set("x-telegram-init-data", _initData);
    }
    init.headers = headers;
  }
  return originalFetch(input, init);
};

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [initData, setInitData] = useState("");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    let data = "";

    if (tg) {
      tg.ready();
      tg.expand();
      data = tg.initData || "";

      // photo_url is only in initDataUnsafe (not HMAC-signed but safe for display)
      const unsafeUser = tg.initDataUnsafe?.user as TelegramUser | undefined;
      if (unsafeUser?.photo_url) {
        setPhotoUrl(unsafeUser.photo_url);
      }
    }

    _initData = data;
    setInitData(data);

    const user = parseTelegramUser(data);
    setTelegramUser(user);
    setIsReady(true);
  }, []);

  const isPremium = telegramUser?.is_premium === true;

  const haptic = (type: "light" | "medium" | "heavy" | "soft" | "rigid" = "light") => {
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
    } catch {}
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "hsl(348 76% 49%)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <TelegramContext.Provider value={{ initData, telegramUser, photoUrl, isPremium, isReady, adultConfirmed, setAdultConfirmed, haptic }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) throw new Error("useTelegram must be used within TelegramProvider");
  return context;
}
