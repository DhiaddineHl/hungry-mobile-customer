import MapView, { Marker } from 'react-native-maps';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts } from '@/constants/theme';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface NativeMapViewProps {
  region: Region;
  addressText: string;
  isLoadingAddress: boolean;
  onMapPress: (e: any) => void;
}

export function NativeMapView({ region, addressText, isLoadingAddress, onMapPress }: NativeMapViewProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      region={region}
      onPress={onMapPress}
      showsUserLocation
      showsMyLocationButton={false}
    >
      <Marker
        coordinate={{ latitude: region.latitude, longitude: region.longitude }}
        anchor={{ x: 0.5, y: 1 }}
      >
        <View style={styles.markerContainer}>
          <View style={styles.markerBubble}>
            <Text style={styles.markerText} numberOfLines={1}>
              {isLoadingAddress ? '...' : addressText}
            </Text>
          </View>
          <View style={styles.markerStem} />
          <View style={styles.markerDot} />
        </View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    backgroundColor: '#1A2B3D',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 180,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  markerStem: {
    width: 2,
    height: 10,
    backgroundColor: '#1A2B3D',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A2B3D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
