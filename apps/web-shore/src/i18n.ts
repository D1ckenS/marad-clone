import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import de from './locales/de.json';
import nl from './locales/nl.json';
import tl from './locales/tl.json';
import ru from './locales/ru.json';
import el from './locales/el.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English', dir: 'ltr' as const },
  { code: 'de', label: 'DE', name: 'Deutsch', dir: 'ltr' as const },
  { code: 'nl', label: 'NL', name: 'Nederlands', dir: 'ltr' as const },
  { code: 'tl', label: 'FIL', name: 'Filipino', dir: 'ltr' as const },
  { code: 'ru', label: 'RU', name: 'Русский', dir: 'ltr' as const },
  { code: 'el', label: 'GR', name: 'Ελληνικά', dir: 'ltr' as const },
  { code: 'zh', label: 'ZH', name: '中文', dir: 'ltr' as const },
  { code: 'ar', label: 'AR', name: 'العربية', dir: 'rtl' as const },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];

const savedLang = localStorage.getItem('fleetops-lang') ?? 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    nl: { translation: nl },
    tl: { translation: tl },
    ru: { translation: ru },
    el: { translation: el },
    zh: { translation: zh },
    ar: { translation: ar },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function applyLang(code: string): void {
  document.documentElement.lang = code;
  // RTL layout (dir="rtl") is not yet implemented — setting it flips the
  // entire app layout. Will be enabled once inline styles use CSS logical
  // properties. Until then, keep dir=ltr regardless of language.
  localStorage.setItem('fleetops-lang', code);
  void i18n.changeLanguage(code);
}

// Apply on boot — also clear any stale dir="rtl" set by earlier app versions
document.documentElement.dir = 'ltr';
applyLang(savedLang);

export default i18n;
