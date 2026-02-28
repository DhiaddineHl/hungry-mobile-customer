import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Heart, Home, ShoppingCart, User } from 'lucide-react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const TAB_ICONS = {
  index: Home,
  favorites: Heart,
  cart: ShoppingCart,
  profile: User,
};

interface TabIconProps {
  routeName: string;
  isFocused: boolean;
  cartItemCount?: number;
}

function TabIcon({ routeName, isFocused, cartItemCount = 0 }: TabIconProps) {
  const IconComponent = TAB_ICONS[routeName as keyof typeof TAB_ICONS];

  if (!IconComponent) return null;

  const iconColor = isFocused ? '#F5A623' : '#1A2B3D';
  const showBadge = routeName === 'cart' && cartItemCount > 0;

  return (
    <View style={[styles.iconContainer, isFocused && styles.iconContainerActive]}>
      <IconComponent size={24} color={iconColor} strokeWidth={2} />
      {showBadge && (
        <View style={styles.badge}>
          <View style={styles.badgeInner} />
        </View>
      )}
    </View>
  );
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
            >
              <TabIcon
                routeName={route.name}
                isFocused={isFocused}
                cartItemCount={route.name === 'cart' ? 2 : 0}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    paddingTop: 6,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainerActive: {
    backgroundColor: '#FFF5E6',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F5A623',
  },
});
