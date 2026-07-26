import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function KeyboardDismissBar() {
  const [visible, setVisible] = useState(Keyboard.isVisible());

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (!visible) return null;
  return <View style={styles.bar}>
    <View style={styles.copy}><Ionicons name="keypad-outline" size={16} color={palette.muted} /><Text style={styles.text}>入力が終わったら</Text></View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="入力を完了してキーボードを閉じる" style={styles.button} onPress={Keyboard.dismiss}><Text style={styles.buttonText}>入力を完了</Text><Ionicons name="chevron-down" size={15} color={palette.surface} /></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: palette.canvas, padding: 8, marginBottom: 9 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  button: { minHeight: 34, borderRadius: 10, backgroundColor: palette.primary, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  buttonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
});
