import { FormField } from '@/components/form-field';
import { UserAvatar } from '@/components/user-avatar';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { ChatImageInput } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const avatarColors = ['#173E33', '#843B2D', '#354A59', '#51435D', '#6B551D'];

export default function ProfileEditScreen() {
  const { profile, updateProfile } = useEvents();
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle.replace('@', ''));
  const [city, setCity] = useState(profile.city);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);
  const [avatarImage, setAvatarImage] = useState<ChatImageInput>();
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('写真へのアクセスを許可してください');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (!asset) return;
    setAvatarImage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      fileName: asset.fileName ?? undefined,
    });
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('名前を入力してください');
    const normalizedHandle = handle.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{2,30}$/.test(normalizedHandle)) {
      return Alert.alert('表示IDを確認してください', '英数字とアンダーバーを使い、2〜30文字で入力してください。');
    }
    const initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
    setSaving(true);
    const error = await updateProfile({
      ...profile,
      name: name.trim(),
      handle: `@${normalizedHandle}`,
      city: city.trim(),
      initials,
      avatarColor,
      avatarUri: avatarImage?.uri ?? profile.avatarUri,
    }, avatarImage);
    setSaving(false);
    if (error) return Alert.alert('保存できませんでした', error);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          <View style={styles.preview}>
            <View style={styles.cropFrame}>
              <UserAvatar uri={avatarImage?.uri ?? profile.avatarUri} initials={name.trim().slice(0, 2) || 'ME'} color={avatarColor} size={108} radius={36} />
              <View pointerEvents="none" style={styles.frameOutline} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="プロフィール写真を選択" style={styles.camera} onPress={pickAvatar}>
                <Ionicons name="camera" size={20} color={palette.surface} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={pickAvatar}><Text style={styles.photoAction}>枠に合わせてプロフィール写真を選ぶ</Text></TouchableOpacity>
            <Text style={styles.previewText}>選択後に正方形の枠で位置を調整できます</Text>
          </View>
          <FormField label="表示名" icon="person-outline" value={name} onChangeText={setName} placeholder="例：佐藤 美咲" autoFocus />
          <FormField label="表示ID" icon="at-outline" value={handle} onChangeText={setHandle} placeholder="misaki" autoCapitalize="none" />
          <FormField label="地域" icon="location-outline" value={city} onChangeText={setCity} placeholder="例：東京都" />
          <Text style={styles.label}>写真がない場合のカラー</Text>
          <View style={styles.colors}>{avatarColors.map((color) => (
            <TouchableOpacity key={color} style={[styles.color, { backgroundColor: color }, avatarColor === color && styles.colorActive]} onPress={() => setAvatarColor(color)}>
              {avatarColor === color && <Ionicons name="checkmark" size={19} color={palette.surface} />}
            </TouchableOpacity>
          ))}</View>
        </ScrollView>
        <View style={styles.bottom}>
          <TouchableOpacity style={[styles.save, saving && styles.disabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.saveText}>変更を保存</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  flex: { flex: 1 },
  content: { padding: 20 },
  preview: { alignItems: 'center', marginVertical: 8, marginBottom: 28 },
  cropFrame: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  frameOutline: { position: 'absolute', width: 114, height: 114, borderRadius: 39, borderWidth: 2, borderColor: palette.surface },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 40, height: 40, borderRadius: 15, backgroundColor: palette.primary, borderWidth: 3, borderColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
  photoAction: { color: palette.primary, fontSize: 13, fontWeight: '900', marginTop: 12 },
  previewText: { color: palette.muted, fontSize: 12, marginTop: 5 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  colors: { flexDirection: 'row', gap: 12 },
  color: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  colorActive: { borderWidth: 3, borderColor: palette.surface },
  bottom: { padding: 14, backgroundColor: palette.surface },
  save: { height: 54, borderRadius: 18, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  saveText: { color: palette.surface, fontSize: 14, fontWeight: '800' },
});
