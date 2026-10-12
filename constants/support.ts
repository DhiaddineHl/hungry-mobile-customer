/**
 * Where the help, report and legal screens point.
 *
 * Both stores require the privacy policy to ALSO be reachable at a public URL
 * (it is entered in App Store Connect and the Play Console, and Play's
 * account-deletion policy asks for a web page describing how to delete an
 * account). The in-app copies in `i18n/legal.ts` are the source of truth for
 * what the app shows; the URLs below, when set, add a "View online" link to
 * the same text.
 */

export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@hungry.tn';

/** Hosted copy of the privacy policy — optional, shown as "View online". */
export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? null;

/** Hosted copy of the terms of use — optional, shown as "View online". */
export const TERMS_OF_USE_URL = process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ?? null;

/** The legal entity named in the terms and privacy policy. */
export const COMPANY_NAME = process.env.EXPO_PUBLIC_COMPANY_NAME ?? 'Hungry';
