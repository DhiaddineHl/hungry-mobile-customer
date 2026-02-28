import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Plus, Minus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Fonts } from '@/constants/theme';

interface FrequentItem {
  id: string;
  name: string;
  description?: string;
  price: string;
  image: ReturnType<typeof require>;
  isPopular?: boolean;
}

interface FrequentlyBoughtTogetherProps {
  items: FrequentItem[];
}

export function FrequentlyBoughtTogether({ items }: FrequentlyBoughtTogetherProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAdd = (id: string) => {
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const handleIncrement = (id: string) => {
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const handleDecrement = (id: string) => {
    setQuantities((prev) => {
      const next = (prev[id] ?? 0) - 1;
      if (next <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionDivider} />
      <Text style={styles.title}>Frequently bought together</Text>
      <View style={styles.list}>
        {items.map((item, index) => {
          const qty = quantities[item.id] ?? 0;
          return (
            <View key={item.id}>
              {index > 0 && <View style={styles.itemDivider} />}
              <View style={styles.item}>
                <View style={styles.itemInfo}>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{item.price}</Text>
                    {item.isPopular && (
                      <Text style={styles.popular}>Popular</Text>
                    )}
                  </View>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.description && (
                    <Text style={styles.description} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>

                <View style={styles.imageWrapper}>
                  <Image source={item.image} style={styles.image} contentFit="cover" />
                  {qty === 0 ? (
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(item.id)}>
                      <Plus size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleDecrement(item.id)}
                      >
                        {qty === 1 ? (
                          <Trash2 size={14} color="#1A2B3D" />
                        ) : (
                          <Minus size={14} color="#1A2B3D" />
                        )}
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleIncrement(item.id)}
                      >
                        <Plus size={14} color="#1A2B3D" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  sectionDivider: {
    height: 8,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 20,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#F5A623',
  },
  popular: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#F5A623',
  },
  name: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  description: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  imageWrapper: {
    width: 90,
    height: 80,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  addBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyControl: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    marginHorizontal: 4,
    paddingVertical: 4,
    gap: 6,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    minWidth: 16,
    textAlign: 'center',
  },
});
