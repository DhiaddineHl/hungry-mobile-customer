import { resolveLanguage, translate } from '@/i18n';
import { PRIVACY_POLICY, TERMS_OF_USE } from '@/i18n/legal';
import { en, fr, type TranslationKey } from '@/i18n/translations';
import { useSettingsStore } from '@/store/settings-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockLocales = jest.fn(() => [{ languageCode: 'en' }]);
jest.mock('expo-localization', () => ({
  getLocales: () => mockLocales(),
}));

const KEYS = Object.keys(en) as TranslationKey[];

describe('translations', () => {
  it('has a non-empty French string for every English key', () => {
    for (const key of KEYS) {
      expect(fr[key]?.trim()).not.toBe('');
    }
    expect(Object.keys(fr).sort()).toEqual([...KEYS].sort());
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
    for (const key of KEYS) {
      expect(placeholders(fr[key])).toEqual(placeholders(en[key]));
    }
  });

  it('interpolates params and leaves unknown placeholders alone', () => {
    expect(translate('en', 'profile.version', { version: '1.2.3' })).toBe('Hungry v1.2.3');
    expect(translate('fr', 'delete.typeToConfirm', { word: 'SUPPRIMER' })).toBe(
      'Saisissez SUPPRIMER pour confirmer'
    );
    expect(translate('en', 'profile.version')).toBe('Hungry v{{version}}');
  });
});

describe('resolveLanguage', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: null });
  });

  it('follows the device locale until the customer picks one', () => {
    mockLocales.mockReturnValue([{ languageCode: 'fr' }]);
    expect(resolveLanguage(null)).toBe('fr');
    mockLocales.mockReturnValue([{ languageCode: 'ar' }]);
    expect(resolveLanguage(null)).toBe('en');
  });

  it('prefers the explicit choice over the device', () => {
    mockLocales.mockReturnValue([{ languageCode: 'fr' }]);
    expect(resolveLanguage('en')).toBe('en');
  });
});

describe('legal documents', () => {
  it.each([
    ['terms', TERMS_OF_USE],
    ['privacy', PRIVACY_POLICY],
  ])('%s: both languages have the same structure and a dated version', (_name, doc) => {
    expect(doc.en.updatedAt).toBe(doc.fr.updatedAt);
    expect(doc.en.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(doc.fr.sections).toHaveLength(doc.en.sections.length);
    doc.en.sections.forEach((section, index) => {
      expect(doc.fr.sections[index].paragraphs).toHaveLength(section.paragraphs.length);
    });
  });
});
