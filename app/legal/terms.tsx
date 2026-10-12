import { LegalDocumentScreen } from '@/components/profile';
import { TERMS_OF_USE_URL } from '@/constants/support';
import { TERMS_OF_USE } from '@/i18n/legal';

export default function TermsOfUseScreen() {
  return <LegalDocumentScreen document={TERMS_OF_USE} onlineUrl={TERMS_OF_USE_URL} />;
}
