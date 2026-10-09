import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import {
  Avatar,
  Badge,
  Card,
  Checkbox,
  Counter,
  ErrorBanner,
  FilterChip,
  IconButton,
  InfoNote,
  InfoRow,
  InfoTag,
  ListGroup,
  ListRow,
  MetaRow,
  PasswordToggle,
  PillButton,
  PrimaryButton,
  PromoTag,
  Radio,
  Screen,
  SearchField,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  Spinner,
  StateView,
  StatusPill,
  Stepper,
  SummaryLine,
  Text,
  TextField,
  TextLink,
  Toggle,
  TopBar,
  UnreadDot,
  toast,
} from '@/components/ds';
import { createStyles } from '@/theme';

/**
 * Dev-only gallery of the design-system primitives (DESIGN_SYSTEM.md §13:
 * "Primitives built and shown in a dev screen"). Reachable at /dev/design-system
 * in development builds; the root guard lets it through only under __DEV__.
 */
export default function DesignSystemGalleryRoute() {
  // Release builds still register this route, so a deep link could open it.
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignSystemGallery />;
}

function DesignSystemGallery() {
  const styles = useStyles();
  const router = useRouter();
  const [qty, setQty] = useState(2);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const [chip, setChip] = useState(true);
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(true);

  return (
    <Screen>
      <TopBar title="Design system" onBack={() => router.back()} divider />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display">Display 28</Text>
        <Text variant="title">Title 24</Text>
        <Text variant="heading">Heading 20</Text>
        <Text variant="sectionTitle">Section title 18</Text>
        <Text variant="itemTitle">Item title 15</Text>
        <Text variant="meta" color="inkMuted">Meta 13 · inkMuted</Text>
        <Text variant="overline" color="inkMuted">Overline</Text>

        <SectionHeader title="Buttons" />
        <PrimaryButton label="Continue" />
        <PrimaryButton label="Add to cart" right="21,36 DT" />
        <PrimaryButton label="Choose a sauce" disabled />
        <PrimaryButton label="Log in" loading loadingLabel="Logging in…" />
        <SecondaryButton label="Continue with Google" />
        <View style={styles.row}>
          <IconButton icon="back" accessibilityLabel="Back" />
          <IconButton icon="favourite" variant="filled" accessibilityLabel="Bell" badge={<Counter count={2} ring />} />
          <IconButton icon="add" variant="add" accessibilityLabel="Add" />
          <IconButton icon="add" variant="addSmall" accessibilityLabel="Add" />
          <PillButton label="Order again" icon="reorder" />
          <PillButton label="Add items" icon="add" variant="outline" />
        </View>
        <TextLink label="Forgot password?" />

        <SectionHeader title="Inputs" />
        <TextField label="Email" placeholder="Email" />
        <TextField
          label="Password"
          secureTextEntry={!show}
          defaultValue="secret"
          trailing={<PasswordToggle visible={show} onToggle={() => setShow(!show)} />}
        />
        <TextField label="Phone number" defaultValue="+216 52 3" error="Enter an 8-digit Tunisian number." />
        <TextField label="Additional information" area placeholder="Building name, landmark, entry code" />
        <SearchField placeholder="Restaurants, dishes, cuisines" onPress={() => {}} />

        <SectionHeader title="Selection" />
        <View style={styles.row}>
          <Checkbox checked={checked} onPress={() => setChecked(!checked)} accessibilityLabel="Check" />
          <Radio selected />
          <Radio selected={false} />
          <Toggle value={on} onValueChange={setOn} accessibilityLabel="Toggle" />
        </View>
        <View style={styles.row}>
          <FilterChip label="Free delivery" selected={chip} onPress={() => setChip(!chip)} />
          <FilterChip label="Promotions" />
        </View>
        <SegmentedControl
          segments={[
            { key: 'a', label: 'In progress · 3' },
            { key: 'b', label: 'Completed · 1' },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <SegmentedControl
          size="small"
          segments={[
            { key: 'en', label: 'English' },
            { key: 'fr', label: 'Français' },
          ]}
          value={lang}
          onChange={setLang}
          style={styles.selfStart}
        />
        <View style={styles.row}>
          <Stepper value={qty} onIncrement={() => setQty(qty + 1)} onDecrement={() => setQty(qty - 1)} />
          <Stepper
            size="compact"
            trashAtMin
            value={qty}
            onIncrement={() => setQty(qty + 1)}
            onDecrement={() => setQty(Math.max(1, qty - 1))}
          />
        </View>

        <SectionHeader title="Badges" />
        <View style={styles.row}>
          <Badge label="-25%" variant="discount" />
          <Badge label="Required" variant="required" />
          <Badge label="Optional" variant="optional" />
          <Badge label="Closed · Opens at 10:00" variant="closed" />
          <Counter count={2} />
          <UnreadDot />
        </View>
        <View style={styles.row}>
          <PromoTag label="Up to 20% off" />
          <InfoTag label="Top rated" icon="star" />
          <StatusPill label="Delivered" />
        </View>
        <MetaRow likedPercent={92} time="30–45 min" fee="free" />
        <MetaRow likedPercent={89} time="30–45 min" fee="2,5 DT" />

        <SectionHeader title="Content" />
        <Card>
          <InfoRow icon="pin" caption="Deliver to" value="Home · Sahloul" onPress={() => {}} />
          <InfoRow icon="cash" caption="Payment" value="Cash on delivery" onPress={() => {}} />
        </Card>
        <Card padded style={styles.gap}>
          <SummaryLine label="Delivery" value="2,5 DT" />
          <SummaryLine label="Service" value="0,5 DT" />
          <SummaryLine label="Total" value="22,5 DT" total />
        </Card>
        <ListGroup title="Account">
          <ListRow icon="accountSettings" label="Account settings" onPress={() => {}} />
          <ListRow icon="bell" label="Order notifications" sub="Know when your order is confirmed" trailing={<Toggle value={on} onValueChange={setOn} />} />
        </ListGroup>
        <ListGroup title="Danger zone" danger>
          <ListRow icon="delete" label="Delete account" destructive onPress={() => {}} />
        </ListGroup>
        <Avatar name="Med Ridha Chemchik" />

        <SectionHeader title="Feedback" />
        <View style={styles.row}>
          <Spinner />
          <Skeleton width={120} height={14} />
        </View>
        <InfoNote>You can browse the menu now. Ordering opens at 10:00.</InfoNote>
        <ErrorBanner title="Couldn't add to cart" body="Check your connection and try again." actionLabel="Try again" onAction={() => {}} />
        <PrimaryButton label="Show toast" onPress={() => toast.show({ message: 'Added to cart', actionLabel: 'Undo', onAction: () => {} })} />
        <View style={styles.state}>
          <StateView icon="favourite" tone="warm" title="No favourites yet" body="Tap the heart on a restaurant to save it here." actions={[{ label: 'Browse restaurants', onPress: () => {} }]} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  content: { padding: t.screenPadding, gap: t.space[12], paddingBottom: 80 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space[10], flexWrap: 'wrap' },
  gap: { gap: t.space[8] },
  selfStart: { alignSelf: 'flex-start' },
  state: { height: 420 },
}));
