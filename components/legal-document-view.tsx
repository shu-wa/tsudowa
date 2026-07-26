import { LegalDocumentKey, legalDocuments } from '@/constants/legal';
import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LegalDocumentView({ document }: { document: LegalDocumentKey }) {
  const content = legalDocuments[document];
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.icon}><Ionicons name="document-text" size={26} color={palette.surface} /></View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.summary}>{content.summary}</Text>
          <Text style={styles.version}>改定日 {content.version}</Text>
        </View>
        {content.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.heading}>{section.title}</Text>
            <Text style={styles.body} selectable>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: 20, paddingBottom: 40 },
  hero: { borderRadius: 24, backgroundColor: palette.primary, padding: 22, marginBottom: 14 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  title: { color: palette.surface, fontSize: 25, fontWeight: '900' },
  summary: { color: '#D4E4DB', fontSize: 14, lineHeight: 21, marginTop: 7 },
  version: { color: '#C3D8CC', fontSize: 12, marginTop: 12 },
  section: { borderRadius: 20, backgroundColor: palette.surface, padding: 17, marginTop: 10 },
  heading: { color: palette.ink, fontSize: 16, lineHeight: 22, fontWeight: '900', marginBottom: 8 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 23 },
});
