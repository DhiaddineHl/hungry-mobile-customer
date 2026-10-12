import { View } from 'react-native';
import { StateView } from '@/components/ds';
import { createStyles } from '@/theme';

/** Stand-in for the map where react-native-maps cannot render (web). */
export function MapPlaceholder() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <StateView icon="pin" title="Map available on the app" body="Open Hungry on your phone to drop the pin." />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.surfaceSunken },
}));
