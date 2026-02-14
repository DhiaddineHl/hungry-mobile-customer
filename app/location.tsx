import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';

export default function LocationScreen() {
  const handleAllowLocation = () => {
    console.log('Allow location access');
  };

  const handleChooseOnMap = () => {
    console.log('Choose on map');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={require('@/assets/localisation-logo.svg')}
            style={styles.image}
            contentFit="contain"
          />
        </View>

        <TouchableOpacity style={styles.allowButton} onPress={handleAllowLocation}>
          <Text style={styles.allowButtonText}>Allow Location Access</Text>
          <MapPin size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.description}>
          Hungry Will Access Your Location{'\n'}Only When Using The App
        </Text>

        <TouchableOpacity onPress={handleChooseOnMap}>
          <Text style={styles.mapLink}>Choose On The Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  imageContainer: {
    width: 240,
    height: 240,
    marginBottom: 48,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  allowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    marginBottom: 24,
    width: '100%',
  },
  allowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  mapLink: {
    fontSize: 15,
    color: '#F5A623',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});
