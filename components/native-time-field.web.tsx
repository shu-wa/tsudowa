import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ChangeEvent, createElement, FormEvent } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const toTimeDate = (value?: string) => {
  const [hours, minutes] = (value || '09:00').split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

export const toTimeString = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export function NativeTimeField({ label, value, onChange, open, onOpenChange }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, open && styles.fieldOpen]}>
        <View style={styles.icon}><Ionicons name="time-outline" size={20} color={palette.primary} /></View>
        <View style={styles.copy}>
          {createElement('input', {
            'aria-label': label,
            type: 'time',
            value,
            step: 300,
            onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
            onInput: (event: FormEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
            onFocus: () => onOpenChange(true),
            onBlur: () => onOpenChange(false),
            style: webInputStyle,
          })}
          <Text style={styles.system}>ブラウザ標準の時刻選択（5分単位）</Text>
        </View>
      </View>
    </View>
  );
}

const webInputStyle = {
  width: '100%',
  height: 34,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: palette.ink,
  fontFamily: 'system-ui, sans-serif',
  fontSize: 18,
  fontWeight: 800,
  colorScheme: 'light',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  field: { minHeight: 68, borderRadius: 17, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginLeft: 10 },
  system: { color: palette.muted, fontSize: 11, marginTop: 1 },
});
