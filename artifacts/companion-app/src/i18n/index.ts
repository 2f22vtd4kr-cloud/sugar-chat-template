import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en.json";
import es from "../locales/es.json";
import ru from "../locales/ru.json";
import de from "../locales/de.json";
import it from "../locales/it.json";
import uk from "../locales/uk.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es }, ru: { translation: ru }, de: { translation: de }, it: { translation: it }, uk: { translation: uk } },
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
    missingKeyHandler: (lngs, ns, key) => {
      console.warn(`[i18n] Missing translation key: ${ns}.${key} (${lngs.join(", ")})`);
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "sugar_lang",
    },
  });

export default i18n;
