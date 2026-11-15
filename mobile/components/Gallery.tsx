// Swipeable gallery (horizontal paging) with dots. Uses real image urls if present, else the placeholder.
import { useState } from 'react';
import { FlatList, Image, View, useWindowDimensions } from 'react-native';
import type { ProductImage } from '@marketplace/shared';
import { colors } from '../lib/theme';
import { Placeholder } from './Placeholder';

export function Gallery({ images, tint }: { images: ProductImage[]; tint: string }) {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 0.75);
  const [index, setIndex] = useState(0);
  const slides = images.length ? images : [{ id: 'x', url: '', alt: '', position: 0 }];

  return (
    <View>
      <FlatList
        data={slides}
        keyExtractor={(i) => i.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) =>
          item.url ? (
            <Image source={{ uri: item.url }} style={{ width, height }} resizeMode="cover" accessibilityLabel={item.alt} />
          ) : (
            <Placeholder hex={tint} view={i} width={width} height={height} />
          )
        }
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 }}>
        {slides.map((_, i) => (
          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.primary : colors.border }} />
        ))}
      </View>
    </View>
  );
}
