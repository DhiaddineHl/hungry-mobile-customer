import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Clipboard, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Clock, TriangleAlert, Phone, Mail, Copy, ArrowLeft } from 'lucide-react-native';
import { Fonts, Palette } from '@/constants/theme';
import { MapPlaceholder } from '@/components/location/map-placeholder';
import { QueryEmpty, QueryError } from '@/components/ui/query-state';
import { useRestaurant } from '@/hooks/use-restaurants';
import MapView, { Marker } from 'react-native-maps';

const ALLERGY_NOTE =
  'In case of possible alergies or other dietary restrictions, please contact the restaurant. The restaurant will provide food-specific information upon request.';

export default function RestaurantInfoModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();

  const { data: restaurant, isPending, error, refetch } = useRestaurant(restaurantId);

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
  };

  if (isPending) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <QueryError error={error} onRetry={refetch} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={[styles.container, styles.centered]}>
        <QueryEmpty
          title="Restaurant not found"
          body="This restaurant is no longer available."
        />
      </View>
    );
  }

  const address = restaurant.address?.formattedAddress;
  const phone = restaurant.phones[0];
  const { coordinates } = restaurant;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {/* Without real coordinates a MapView would centre on 0,0 in the Gulf
            of Guinea and plant a marker there — worse than no map at all. */}
        {Platform.OS !== 'web' && coordinates ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={coordinates} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.markerContainer}>
                <View style={styles.markerPin}>
                  <View style={styles.markerPinInner} />
                </View>
                <View style={styles.markerStem} />
              </View>
            </Marker>
          </MapView>
        ) : (
          <MapPlaceholder />
        )}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#1A2B3D" />
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        {restaurant.categories ? (
          <Text style={styles.categories}>{restaurant.categories}</Text>
        ) : null}

        <View style={styles.divider} />

        {/* Each row renders only when the backend actually supplies it — the
            rating row is gone entirely because no ratings service exists yet. */}
        {address ? (
          <View style={styles.infoRow}>
            <MapPin size={20} color="#8A8A8A" />
            <Text style={styles.infoText}>{address}</Text>
            <TouchableOpacity onPress={() => copyToClipboard(address)}>
              <Copy size={18} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
        ) : null}

        {restaurant.isOpen !== null ? (
          <View style={styles.infoRow}>
            <Clock size={20} color="#8A8A8A" />
            <Text style={styles.infoText}>
              {restaurant.isOpen ? 'Open now' : 'Closed now'}
            </Text>
          </View>
        ) : null}

        <View style={[styles.infoRow, styles.allergyRow]}>
          <TriangleAlert size={20} color="#F5A623" />
          <Text style={[styles.infoText, styles.allergyText]}>{ALLERGY_NOTE}</Text>
        </View>

        {phone ? (
          <View style={styles.infoRow}>
            <Phone size={20} color="#8A8A8A" />
            <Text style={styles.infoText}>{phone}</Text>
            <TouchableOpacity onPress={() => copyToClipboard(phone)}>
              <Copy size={18} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
        ) : null}

        {restaurant.email ? (
          <View style={styles.infoRow}>
            <Mail size={20} color="#8A8A8A" />
            <Text style={styles.infoText}>{restaurant.email}</Text>
            <TouchableOpacity onPress={() => copyToClipboard(restaurant.email!)}>
              <Copy size={18} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: Math.max(insets.bottom, 16) }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    height: '38%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerPinInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  markerStem: {
    width: 3,
    height: 10,
    backgroundColor: '#F5A623',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  restaurantName: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    marginBottom: 4,
  },
  categories: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  allergyRow: {
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
    lineHeight: 22,
  },
  allergyText: {
    color: '#444444',
    fontSize: 13,
  },
});
