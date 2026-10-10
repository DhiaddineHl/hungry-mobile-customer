import { announcementKeys } from '@/services/api/query-keys';
import { fetchLiveAnnouncements } from '@/services/api/announcement-service';
import { useQuery } from '@tanstack/react-query';

// Campaigns are scheduled in minutes-to-days, not seconds; pull-to-refresh on
// Home covers anything more urgent.
const ANNOUNCEMENT_STALE_TIME = 5 * 60 * 1000;

/** The announcements to show in the home-page slider right now, in slider order. */
export function useLiveAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.live(),
    queryFn: fetchLiveAnnouncements,
    staleTime: ANNOUNCEMENT_STALE_TIME,
  });
}
