// Renders ONE option group from the database: swatches, a list of buttons, or a checkbox.
import { Pressable, Text, View } from 'react-native';
import { formatPrice, type OptionGroup, type OptionValue } from '@marketplace/shared';
import { colors } from '../lib/theme';

export function OptionPicker({
  group,
  selectedId,
  onChoose,
  onClear,
}: {
  group: OptionGroup;
  selectedId: string | null;
  onChoose: (v: OptionValue) => void;
  onClear: () => void;
}) {
  const selected = group.option_values.find((v) => v.id === selectedId);

  if (group.type === 'checkbox') {
    const value = group.option_values[0];
    if (!value) return null;
    const on = selectedId === value.id;
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        onPress={() => (on ? onClear() : onChoose(value))}
        style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: on ? colors.primary : '#fff', alignItems: 'center', justifyContent: 'center' }}>
          {on && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
        </View>
        <Text style={{ flex: 1, fontWeight: '600', color: colors.text }}>{value.label}</Text>
        <Text style={{ fontWeight: '700' }}>+{formatPrice(value.price_delta)}</Text>
      </Pressable>
    );
  }

  return (
    <View>
      <Text style={{ fontWeight: '700', marginBottom: 8, color: colors.text }}>
        {group.name}: <Text style={{ fontWeight: '400', color: colors.muted }}>{selected?.label}</Text>
      </Text>
      {group.type === 'swatch' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {group.option_values.map((v) => {
            const on = v.id === selectedId;
            return (
              <Pressable
                key={v.id}
                accessibilityLabel={v.label}
                accessibilityState={{ selected: on }}
                onPress={() => onChoose(v)}
                style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: on ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: v.hex ?? '#ccc', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {group.option_values.map((v) => {
            const on = v.id === selectedId;
            return (
              <Pressable
                key={v.id}
                accessibilityState={{ selected: on }}
                onPress={() => onChoose(v)}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryLight : '#fff' }}
              >
                <Text style={{ flex: 1, color: colors.text }}>{v.label}</Text>
                <Text style={{ fontWeight: '700' }}>{v.price_delta > 0 ? `+${formatPrice(v.price_delta)}` : 'Free'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
