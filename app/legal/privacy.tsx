import { LegalDocumentScreen } from '@/components/profile';
import { PRIVACY_POLICY_URL } from '@/constants/support';
import { PRIVACY_POLICY } from '@/i18n/legal';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} onlineUrl={PRIVACY_POLICY_URL} />;
}
