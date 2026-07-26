import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

type Props = TextInputProps & {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  hint?: string;
};

export function FormField({ label, icon, hint, multiline, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}><Text style={styles.label}>{label}</Text>{hint && <Text style={styles.hint}>{hint}</Text>}</View>
      <View style={[styles.field, multiline && styles.fieldMultiline]}>
        <Ionicons name={icon} size={19} color={palette.primary} style={multiline && styles.multilineIcon} />
        <TextInput
          {...inputProps}
          multiline={multiline}
          placeholderTextColor="#9AA29D"
          style={[styles.input, multiline && styles.inputMultiline]}
          selectionColor={palette.primary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  hint: { color: palette.muted, fontSize: 13 },
  field: { minHeight: 54, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  fieldMultiline: { minHeight: 112, alignItems: 'flex-start', paddingTop: 16 },
  multilineIcon: { marginTop: 1 },
  input: { flex: 1, color: palette.ink, fontSize: 14, marginLeft: 11, paddingVertical: 0 },
  inputMultiline: { minHeight: 78, textAlignVertical: 'top' },
});
