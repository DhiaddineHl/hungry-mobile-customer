import { z } from 'zod';

/**
 * Runtime shape of `GET /announcements/live`
 * (org.jfwk.content.application.model.announcement.AnnouncementOutputData).
 *
 * Only `id` and `title` are required — the backend refuses an announcement
 * without a title — everything else is nullish for the same reason as the
 * restaurant schema: nothing in the OpenAPI document is marked `required`.
 */
export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  /** Backend-relative `/files/announcements/...` path. */
  imageUrl: z.string().nullish(),
  ctaLabel: z.string().nullish(),
  /** An http(s) URL, or an in-app route starting with `/`. */
  ctaLink: z.string().nullish(),
  position: z.number().nullish(),
});

export const announcementListSchema = z.array(announcementSchema);

export type Announcement = z.infer<typeof announcementSchema>;
