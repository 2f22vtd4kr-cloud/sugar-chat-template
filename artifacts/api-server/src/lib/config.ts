const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramBotUsername: required("TELEGRAM_BOT_USERNAME"),
  openrouterApiKey: required("OPENROUTER_API_KEY"),
  openrouterBaseUrl: process.env["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1",
  openrouterModel: process.env["OPENROUTER_MODEL"] ?? "openrouter/auto",
  adminPass: required("ADMIN_PASS"),
  databaseUrl: required("DATABASE_URL"),
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  miniAppUrl: process.env["MINI_APP_URL"] ?? "https://sugar-chat-template--levovychveniamy.replit.app",
};
