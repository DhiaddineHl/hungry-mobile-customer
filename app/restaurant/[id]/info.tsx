import { Clipboard, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import {
  Card,
  IconButton,
  InfoNote,
  InfoRow,
  MapPin,
  MapSheet,
  Screen,
  Separated,
  Skeleton,
  StateView,
  Text,
  TopBar,
  toast,
} from '@/components/ds';
import { MapPlaceholder } from '@/components/location/map-placeholder';
import { useRestaurant } from '@/hooks/use-restaurants';
import { createStyles } from '@/theme';

const ALLERGY_NOTE =
  'Allergies or dietary needs? Contact the restaurant — it will share what is in each dish on request.';

/**
 * Restaurant "About": where it is and how to reach it. Not drawn on the board;
 * composed from the map, sheet and info-row primitives.
 */
export default function RestaurantInfoModal() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();
  const { data: restaurant, isPending, error, refetch } = useRestaurant(restaurantId);

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    toast.show({ message: `${label} copied` });
  };

  if (isPending) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} />
        <View style={styles.loading}>
          <Skeleton height={200} radius={20} />
          <Skeleton width="50%" height={24} />
          <Skeleton height={60} radius={20} />
        </View>
      </Screen>
    );
  }

  if (error || !restaurant) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} />
        {error ? (
          <StateView
            icon="offline"
            title="Couldn't load this restaurant"
            body="Check your connection, then try again."
            actions={[{ label: 'Try again', onPress: () => refetch() }]}
          />
        ) : (
          <StateView icon="store" title="Restaurant not found" body="This restaurant is no longer available." />
        )}
      </Screen>
    );
  }

  const address = restaurant.address?.formattedAddress;
  const phone = restaurant.phones[0];
  const { coordinates } = restaurant;
  const copyButton = (label: string, text: string) => (
    <IconButton icon="copy" variant="plain" iconColor="inkMuted" onPress={() => copy(label, text)} accessibilityLabel={`Copy ${label.toLowerCase()}`} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.map}>
        {/* Without real coordinates a MapView would centre on 0,0 in the Gulf
            of Guinea and plant a marker there — worse than no map at all. */}
        {Platform.OS !== 'web' && coordinates ? (
          <MapView
            style={styles.fill}
            initialRegion={{ ...coordinates, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={coordinates} anchor={{ x: 0.5, y: 1 }}>
              <MapPin />
            </Marker>
          </MapView>
        ) : (
          <MapPlaceholder />
        )}
        <IconButton
          icon="back"
          variant="floating"
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={[styles.back, { top: insets.top + 8 }]}
        />
      </View>

      <MapSheet bottomInset={insets.bottom}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <View>
            <Text variant="heading" accessibilityRole="header">
              {restaurant.name}
            </Text>
            {restaurant.categories ? (
              <Text variant="meta" color="inkMuted">
                {restaurant.categories.replace(/ - /g, ' · ')}
              </Text>
            ) : null}
          </View>

          {/* Each row renders only when the backend actually supplies it. */}
          <Card>
            <Separated inset={66}>
              {address ? <InfoRow icon="pin" caption="Address" value={address} trailing={copyButton('Address', address)} /> : null}
              {restaurant.isOpen !== null ? (
                <InfoRow icon="time" caption="Right now" value={restaurant.isOpen ? 'Open' : 'Closed'} />
              ) : null}
              {phone ? <InfoRow icon="phone" caption="Phone" value={phone} trailing={copyButton('Phone number', phone)} /> : null}
              {restaurant.email ? (
                <InfoRow icon="mail" caption="Email" value={restaurant.email} trailing={copyButton('Email', restaurant.email)} />
              ) : null}
            </Separated>
          </Card>

          <InfoNote>{ALLERGY_NOTE}</InfoNote>
        </ScrollView>
      </MapSheet>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.background },
  fill: { flex: 1 },
  map: { flex: 1, minHeight: 220, backgroundColor: t.colors.surfaceSunken },
  back: { position: 'absolute', left: t.chromePadding },
  loading: { padding: t.screenPadding, gap: t.space[16] },
  sheetContent: { gap: t.space[16], paddingBottom: t.space[8] },
}));
