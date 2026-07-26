import { LegalDocumentView } from '@/components/legal-document-view';
import { LegalDocumentKey } from '@/constants/legal';
import { useLocalSearchParams } from 'expo-router';

export default function LegalDocumentScreen() {
  const { document } = useLocalSearchParams<{ document: string }>();
  const supported = ['terms', 'privacy', 'community', 'acknowledgements'] satisfies LegalDocumentKey[];
  const key: LegalDocumentKey = supported.includes(document as LegalDocumentKey) ? document as LegalDocumentKey : 'terms';
  return <LegalDocumentView document={key} />;
}
