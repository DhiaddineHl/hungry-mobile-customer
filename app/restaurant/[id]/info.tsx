import { View, Text, StyleSheet, TouchableOpacity, Clipboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Clock, ThumbsUp, TriangleAlert, Phone, Mail, Copy, ChevronDown, ArrowLeft } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { MapPlaceholder } from '@/components/location/map-placeholder';

const RESTAURANT_INFO = {
  name: 'Tacoth',
  categories: 'Tacos - Tacos Bowls',
  address: 'RJW9+VMG, Avenue 14 Janvier, Sousse, Tunisia',
  openUntil: 'Open Until 11:00 PM',
  rating: '92% (1000+ ratings)',
  phone: '+21671724000',
  email: 'chokri.jammazi@gmail.com',
  allergyNote: 'In case of possible alergies or other dietary restrictions, please contact the restaurant. The restaurant will provide food-specific information upon request.',
  coordinates: { latitude: 35.8245, longitude: 10.6346 },
};

export default function RestaurantInfoModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapPlaceholder />
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#1A2B3D" />
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.restaurantName}>{RESTAURANT_INFO.name}</Text>
        <Text style={styles.categories}>{RESTAURANT_INFO.categories}</Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <MapPin size={20} color="#8A8A8A" />
          <Text style={styles.infoText}>{RESTAURANT_INFO.address}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(RESTAURANT_INFO.address)}>
            <Copy size={18} color="#8A8A8A" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Clock size={20} color="#8A8A8A" />
          <Text style={styles.infoText}>{RESTAURANT_INFO.openUntil}</Text>
          <ChevronDown size={18} color="#8A8A8A" />
        </View>

        <View style={styles.infoRow}>
          <ThumbsUp size={20} color="#8A8A8A" />
          <Text style={styles.infoText}>{RESTAURANT_INFO.rating}</Text>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>i</Text>
          </View>
        </View>

        <View style={[styles.infoRow, styles.allergyRow]}>
          <TriangleAlert size={20} color="#F5A623" />
          <Text style={[styles.infoText, styles.allergyText]}>{RESTAURANT_INFO.allergyNote}</Text>
        </View>

        <View style={styles.infoRow}>
          <Phone size={20} color="#8A8A8A" />
          <Text style={styles.infoText}>{RESTAURANT_INFO.phone}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(RESTAURANT_INFO.phone)}>
            <Copy size={18} color="#8A8A8A" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Mail size={20} color="#8A8A8A" />
          <Text style={styles.infoText}>{RESTAURANT_INFO.email}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(RESTAURANT_INFO.email)}>
            <Copy size={18} color="#8A8A8A" />
          </TouchableOpacity>
        </View>

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
  mapContainer: {
    height: '38%',
    position: 'relative',
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
  infoIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#8A8A8A',
  },
});
