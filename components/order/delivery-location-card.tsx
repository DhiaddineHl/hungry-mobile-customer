import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface DeliveryLocationCardProps {
  addressLabel: string;
  addressText: string;
  latitude?: number;
  longitude?: number;
  onPress?: () => void;
}

export function DeliveryLocationCard({
  addressLabel,
  addressText,
  latitude = 35.8256,
  longitude = 10.6369,
  onPress,
}: DeliveryLocationCardProps) {
  const renderMap = () => {
    if (Platform.OS === 'web') {
      return <View style={styles.mapPlaceholder} />;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MapView = require('react-native-maps').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Marker } = require('react-native-maps');

    const region = {
      latitude,
      longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    };

    return (
      <MapView
        style={styles.map}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.markerContainer}>
            <View style={styles.markerBubble}>
              <Text style={styles.markerText} numberOfLines={1}>
                {addressText}
              </Text>
            </View>
            <View style={styles.markerStem} />
            <View style={styles.markerDot} />
          </View>
        </Marker>
      </MapView>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.mapContainer}>{renderMap()}</View>
      <TouchableOpacity style={styles.labelRow} onPress={onPress} activeOpacity={0.7}>
        <MapPin size={16} color="#1A2B3D" />
        <Text style={styles.labelText}>{addressLabel}</Text>
        <ChevronRight size={18} color="#8A8A8A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  mapContainer: {
    height: 140,
    backgroundColor: '#E8E8E8',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#D8E0E8',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    backgroundColor: '#1A2B3D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: 160,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  markerStem: {
    width: 2,
    height: 8,
    backgroundColor: '#1A2B3D',
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A2B3D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  labelText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
});
