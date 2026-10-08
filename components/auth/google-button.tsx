import GoogleG from '@/assets/brand/google-g.svg';
import { SecondaryButton } from '@/components/ds';

/** Google is the secondary path: an outlined button with the official "G". */
export function GoogleButton({
  onPress,
  loading = false,
  disabled = false,
  label = 'Continue with Google',
}: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <SecondaryButton
      label={label}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      leading={<GoogleG width={20} height={20} />}
    />
  );
}
