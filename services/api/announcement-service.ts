import { announcementListSchema, type Announcement } from '@/schemas/announcement';
import { ApiError, apiClient } from './client';

/**
 * The home-page slider's announcements (promotions, offers), managed in the
 * back office.
 *
 * `/announcements/live` already does the selection server-side — active, and
 * inside the optional start/end window — and returns them in slider order, so
 * the app renders the list as is.
 */
export async function fetchLiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await apiClient.get('/announcements/live');
  const result = announcementListSchema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ApiError(
    `Unexpected announcement list from the server: ${path} — ${issue.message}. ` +
      `The app may need updating to match the backend.`
  );
}

export type CtaTarget = { kind: 'route'; path: string } | { kind: 'url'; url: string } | null;

/**
 * Where a call-to-action leads. Mirrors the backend rule: an in-app route
 * starts with a single `/`, an external link is http(s). Anything else (the
 * backend refuses it, but this is the last line before `Linking`) goes nowhere.
 */
export function resolveCtaTarget(link: string | null | undefined): CtaTarget {
  const value = link?.trim();
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return { kind: 'route', path: value };
  if (/^https?:\/\/\S+$/i.test(value)) return { kind: 'url', url: value };
  return null;
}
