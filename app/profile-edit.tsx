import { FormField } from '@/components/form-field';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const avatarColors = ['#285943', '#E88A64', '#7A8EB0', '#A66F82', '#8B6B21'];

export default function ProfileEditScreen() {
  const { profile, updateProfile } = useEvents();
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle.replace('@', ''));
  const [city, setCity] = useState(profile.city);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);

  const save = () => {
    if (!name.trim()) return Alert.alert('名前を入力してください');
    const initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
    updateProfile({ name: name.trim(), handle: `@${handle.trim().replace(/^@/, '') || 'user'}`, city: city.trim() || '未設定', initials, avatarColor });
    router.back();
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
    <View style={styles.preview}><View style={[styles.avatar, { backgroundColor: avatarColor }]}><Text style={styles.avatarText}>{name.trim().slice(0, 2) || 'ME'}</Text></View><Text style={styles.previewText}>イベント内で表示されるプロフィール</Text></View>
    <FormField label="表示名" icon="person-outline" value={name} onChangeText={setName} placeholder="例：佐藤 美咲" autoFocus />
    <FormField label="表示ID" icon="at-outline" value={handle} onChangeText={setHandle} placeholder="misaki" autoCapitalize="none" />
    <FormField label="地域" icon="location-outline" value={city} onChangeText={setCity} placeholder="例：東京都" />
    <Text style={styles.label}>プロフィールカラー</Text><View style={styles.colors}>{avatarColors.map((color) => <TouchableOpacity key={color} style={[styles.color, { backgroundColor: color }, avatarColor === color && styles.colorActive]} onPress={() => setAvatarColor(color)}>{avatarColor === color && <Ionicons name="checkmark" size={19} color={palette.surface} />}</TouchableOpacity>)}</View>
  </ScrollView><View style={styles.bottom}><TouchableOpacity style={styles.save} onPress={save}><Text style={styles.saveText}>変更を保存</Text></TouchableOpacity></View></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, content: { padding: 20 }, preview: { alignItems: 'center', marginVertical: 8, marginBottom: 28 }, avatar: { width: 78, height: 78, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.surface, fontSize: 20, fontWeight: '900' }, previewText: { color: palette.muted, fontSize: 13, marginTop: 10 }, label: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 10 }, colors: { flexDirection: 'row', gap: 12 }, color: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, colorActive: { borderWidth: 3, borderColor: palette.surface }, bottom: { padding: 14, backgroundColor: palette.surface }, save: { height: 54, borderRadius: 18, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { color: palette.surface, fontSize: 14, fontWeight: '800' } });
