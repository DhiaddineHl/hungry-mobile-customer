import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { Skeleton, Text, Touchable } from '@/components/ds';
import { useLiveAnnouncements } from '@/hooks/use-announcements';
import { useRestaurantImageSourceFromPath } from '@/hooks/use-restaurant-image';
import type { Announcement } from '@/schemas/announcement';
import { resolveCtaTarget } from '@/services/api/announcement-service';
import { createStyles, Icon, useTheme } from '@/theme';

/** Gap between two cards; the next card peeks by nothing — one banner per page. */
const CARD_GAP = 12;
/** Banner image ratio (the back office asks for ~16:9 artwork). */
const IMAGE_RATIO = 16 / 9;
/** Auto-advance cadence; paused while the finger is on the slider. */
const AUTO_ADVANCE_MS = 5000;

/**
 * Promotions and offers from the back office, right below the search bar:
 * a paged rail of banners (image, title, description, call to action) with
 * dots underneath. It steps aside entirely when nothing is live or the
 * request fails — it is a bonus on Home, never a blocker.
 */
export function AnnouncementsSlider() {
  const styles = useStyles();
  const { screenPadding } = useTheme();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const imageSource = useRestaurantImageSourceFromPath();
  const { data: announcements, isPending } = useLiveAnnouncements();

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  const cardWidth = width - screenPadding * 2;
  const interval = cardWidth + CARD_GAP;
  const count = announcements?.length ?? 0;

  // A shorter list after a refresh must not leave the dots past the end.
  const current = Math.min(index, Math.max(0, count - 1));

  useEffect(() => {
    if (count < 2 || dragging || reduceMotion) return;
    const timer = setTimeout(() => {
      const next = (current + 1) % count;
      scrollRef.current?.scrollTo({ x: next * interval, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [current, count, dragging, reduceMotion, interval]);

  if (isPending) {
    return (
      <View style={styles.section}>
        <Skeleton width={cardWidth} height={cardWidth / IMAGE_RATIO + 64} radius={styles.card.borderRadius} />
      </View>
    );
  }
  if (count === 0) return null;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / interval));
    setDragging(false);
  };

  const open = (announcement: Announcement) => {
    const target = resolveCtaTarget(announcement.ctaLink);
    if (!target) return;
    if (target.kind === 'route') router.push(target.path as Href);
    else Linking.openURL(target.url).catch(() => {});
  };

  return (
    <View style={styles.section}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={interval}
        disableIntervalMomentum
        contentContainerStyle={styles.rail}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={onMomentumEnd}
        accessibilityRole="adjustable"
        accessibilityLabel={`Announcements, ${current + 1} of ${count}`}
      >
        {announcements!.map((announcement) => {
          const actionable = !!resolveCtaTarget(announcement.ctaLink);
          return (
            <Touchable
              key={announcement.id}
              onPress={() => open(announcement)}
              disabled={!actionable}
              accessibilityRole={actionable ? 'button' : 'none'}
              accessibilityLabel={[announcement.title, announcement.description, announcement.ctaLabel]
                .filter(Boolean)
                .join('. ')}
              style={[styles.card, { width: cardWidth }]}
            >
              <View style={[styles.imageWell, { height: cardWidth / IMAGE_RATIO }]}>
                <Image source={imageSource(announcement.imageUrl)} style={styles.fill} contentFit="cover" transition={150} />
              </View>
              <View style={styles.body}>
                <View style={styles.flex}>
                  <Text variant="itemTitle" numberOfLines={1}>
                    {announcement.title}
                  </Text>
                  {announcement.description ? (
                    <Text variant="caption" color="inkMuted" numberOfLines={2}>
                      {announcement.description}
                    </Text>
                  ) : null}
                </View>
                {actionable ? (
                  <View style={styles.cta}>
                    <Text variant="label" color="onInk" numberOfLines={1}>
                      {announcement.ctaLabel || 'See more'}
                    </Text>
                    <Icon name="chevronRight" size={14} color="onInk" />
                  </View>
                ) : null}
              </View>
            </Touchable>
          );
        })}
      </ScrollView>

      {count > 1 ? (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants">
          {announcements!.map((announcement, i) => (
            <View key={announcement.id} style={[styles.dot, i === current && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  section: { marginTop: t.space[20], paddingHorizontal: 0, alignItems: 'center' },
  rail: { paddingHorizontal: t.screenPadding, gap: CARD_GAP },
  card: {
    borderRadius: t.radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.colors.divider,
    backgroundColor: t.colors.surface,
  },
  imageWell: { width: '100%', backgroundColor: t.colors.surfaceSunken },
  fill: { width: '100%', height: '100%' },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[12],
    paddingHorizontal: t.space[16],
    paddingVertical: t.space[12],
  },
  flex: { flex: 1, gap: t.space[2] },
  // Navy acts: the call to action is an ink pill, never an orange one.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[4],
    maxWidth: 140,
    paddingHorizontal: t.space[12],
    paddingVertical: t.space[6],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.ink,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: t.space[6], marginTop: t.space[10] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.outline },
  // The current page is a signal, so orange.
  dotActive: { width: 18, backgroundColor: t.colors.primary },
}));
