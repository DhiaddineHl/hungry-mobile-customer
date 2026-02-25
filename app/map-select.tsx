import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, Crosshair } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Fonts } from '@/constants/theme';
import { AddressType } from '@/types/location';
import { AddressTypeSelector } from '@/components/location/address-type-selector';
import { MapPlaceholder } from '@/components/location/map-placeholder';

const DEFAULT_REGION = {
  latitude: 35.8256,
  longitude: 10.6369,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type BottomSheetState = 'deliver' | 'address-type';

export default function MapSelectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>('deliver');
  const [selectedCoords, setSelectedCoords] = useState(DEFAULT_REGION);
  const [addressText, setAddressText] = useState('RM4+4QR2, Sousse');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsLoadingAddress(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.city, r.country].filter(Boolean);
        if (parts.length > 0) setAddressText(parts.join(', '));
      }
    } catch {
      setAddressText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleMapPress = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedCoords((prev) => ({ ...prev, latitude, longitude }));
    reverseGeocode(latitude, longitude);
  };

  const handleCenterOnUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        setSelectedCoords((prev) => ({ ...prev, latitude, longitude }));
        reverseGeocode(latitude, longitude);
      }
    } catch {
      console.log('Could not get location');
    }
  };

  const handleDeliverHere = () => {
    setBottomSheet('address-type');
  };

  const handleAddressTypeSelect = (type: AddressType) => {
    router.push({
      pathname: '/address-info',
      params: {
        addressType: type,
        addressText,
        latitude: selectedCoords.latitude.toString(),
        longitude: selectedCoords.longitude.toString(),
      },
    });
  };

  const handleBack = () => {
    if (bottomSheet === 'address-type') {
      setBottomSheet('deliver');
    } else {
      router.back();
    }
  };

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return <MapPlaceholder />;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeMapView } = require('@/components/location/map-view-native');
    return (
      <NativeMapView
        region={selectedCoords}
        addressText={addressText}
        isLoadingAddress={isLoadingAddress}
        onMapPress={handleMapPress}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderMap()}

      <View style={[styles.searchBar, { top: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={18} color="#1A2B3D" />
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for location"
          placeholderTextColor="#AAAAAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.searchIcon}>
          <Search size={18} color="#AAAAAA" />
        </TouchableOpacity>
      </View>

      {bottomSheet === 'deliver' && (
        <View style={[styles.deliverContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.centerButton} onPress={handleCenterOnUser}>
            <Crosshair size={20} color="#F5A623" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deliverButton} onPress={handleDeliverHere} activeOpacity={0.9}>
            <Text style={styles.deliverButtonText}>Deliver to this point</Text>
          </TouchableOpacity>
        </View>
      )}

      {bottomSheet === 'address-type' && (
        <View style={[styles.addressTypeSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <AddressTypeSelector onSelect={handleAddressTypeSelect} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
    padding: 0,
  },
  searchIcon: {
    padding: 4,
  },
  deliverContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  centerButton: {
    position: 'absolute',
    right: 20,
    bottom: 72,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  deliverButton: {
    backgroundColor: '#1A2B3D',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deliverButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  addressTypeSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
});
