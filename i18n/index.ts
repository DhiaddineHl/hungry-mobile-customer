import { useSettingsStore, type Language } from '@/store/settings-store';
import { getLocales } from 'expo-localization';
import { useCallback } from 'react';
import { en, fr, type TranslationKey } from './translations';

/**
 * Minimal, dependency-free translation layer.
 *
 * Two languages and a few hundred strings do not justify a library: the
 * dictionary is a typed object (see `./translations.ts`), the active language
 * is a value in the settings store, and `useTranslation()` re-renders whatever
 * reads it when that value changes — which is what makes the language switch
 * on the profile screen take effect immediately, with no restart.
 */

export type { Language } from '@/store/settings-store';
export type { TranslationKey } from './translations';

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, fr };

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'fr'];

/** How each language names itself — a language picker always shows endonyms. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
};

type Params = Record<string, string | number>;

/**
 * The device language, reduced to one we ship. Anything that is not French
 * gets English, the reference dictionary.
 */
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return code === 'fr' ? 'fr' : 'en';
}

/** The customer's explicit choice, or the device language until they make one. */
export function resolveLanguage(preference: Language | null): Language {
  return preference ?? deviceLanguage();
}

export function translate(language: Language, key: TranslationKey, params?: Params): string {
  const template = DICTIONARIES[language][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/** Formats an ISO date for the active language, e.g. "19 September 2026". */
export function formatDate(language: Language, iso: string): string {
  return new Date(iso).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function useTranslation() {
  const preference = useSettingsStore((state) => state.language);
  const language = resolveLanguage(preference);
  const t = useCallback(
    (key: TranslationKey, params?: Params) => translate(language, key, params),
    [language]
  );
  return { t, language };
}
