# Guide: Building Login & Sign-Up Screens (Hungry Deliverer pattern)

A recipe for a coding agent to reproduce the auth screens in this repo — the navy
full-bleed vector backdrop, the white bottom-sheet card, the one-time
landing → login reveal animation, and the form/validation stack.

Reference implementation in this repo:

| Piece | File |
| --- | --- |
| Login screen (+ intro animation) | `src/app/index.tsx` |
| Sign-up screen | `src/app/register.tsx` |
| Backdrop (SVG artwork layer) | `src/components/auth/auth-backdrop.tsx` |
| Shared auth chrome (Or / Google / terms) | `src/components/auth/auth-common.tsx` |
| Labelled input bound to RHF | `src/components/auth/text-field.tsx` |
| Pill CTA | `src/components/ui/primary-button.tsx` |
| Poppins `Text` wrapper | `src/components/ui/text.tsx` |
| Design tokens | `src/constants/theme.ts` |
| Zod schemas | `src/features/auth/schemas.ts` |
| Font loading + Stack | `src/app/_layout.tsx` |

> **Expo has changed.** Before writing code, read the versioned docs at
> <https://docs.expo.dev/versions/v57.0.0/>. Do not rely on memory of older SDKs.

---

## 1. Stack and prerequisites

Expo SDK 57 / React Native 0.86 / React 19.2 / expo-router 57, with the React
Compiler enabled.

```jsonc
// dependencies that this pattern actually needs
"@expo-google-fonts/poppins": "^0.4.1",
"@expo/vector-icons": "^15.0.2",
"@hookform/resolvers": "^3.10.0",
"expo-font": "~57.0.0",
"expo-router": "~57.0.4",
"expo-splash-screen": "~57.0.2",
"expo-status-bar": "~57.0.0",
"react-hook-form": "^7.82.0",
"react-native-reanimated": "4.5.0",
"react-native-safe-area-context": "~5.7.0",
"react-native-svg": "15.15.4",
"react-native-worklets": "0.10.0",   // required by Reanimated 4
"zod": "^3.25.76"
// dev
"react-native-svg-transformer": "^1.5.3"
```

Install with `npx expo install <pkg>` so versions match the SDK.

### 1.1 SVG-as-component (Metro)

The backdrop artwork is an `.svg` imported as a React component so it stays crisp
while it slides. `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
```

Plus the ambient type (`src/types/svg.d.ts`) or TS will reject the import:

```ts
declare module '*.svg' {
  import type * as React from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: React.FC<SvgProps>;
  export default content;
}
```

Restart Metro with `--clear` after touching `metro.config.js`.

### 1.2 Fonts

Bundle Poppins through the `expo-font` config plugin **and** load it with
`useFonts` — the plugin makes native builds resolve instantly, `useFonts` is what
makes it work in Expo Go. In `app.json`:

```jsonc
["expo-font", {
  "fonts": [
    "./node_modules/@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf",
    "./node_modules/@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf",
    "./node_modules/@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf",
    "./node_modules/@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf"
  ]
}]
```

Set the splash background to the same navy as the backdrop
(`"backgroundColor": "#03324A"`) so the app opens without a colour flash.

### 1.3 Path aliases

`tsconfig.json` maps `@/*` → `./src/*` and `@/assets/*` → `./assets/*`. All
imports below use `@/`.

---

## 2. Design tokens

Never hardcode colours, radii, or spacing in a screen. Everything comes from
`src/constants/theme.ts`:

```ts
export const Colors = {
  navy: '#03324A',        // backdrop + status-bar context
  navyDeep: '#022639',
  orange: '#E8890C',      // primary CTA, "SIGN UP" / "LOGIN" cross-links
  orangeDeep: '#B26A08',  // countdown sweep fill
  orangeMuted: '#BF8437', // disabled CTA
  teal: '#17A08D',        // "Forgot Password"
  text: '#111418',
  textSecondary: '#6B7280',
  textMuted: '#9AA0A6',   // placeholders, fine print
  border: '#E5E7EB',      // input + Google button stroke
  white: '#FFFFFF',
} as const;

export const Fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const Spacing = { one: 4, two: 8, three: 12, four: 16, five: 24, six: 32 } as const;
export const Radius  = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 } as const;

export const Shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  pill: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8,  shadowOffset: { width: 0, height: 3 }, elevation: 5 },
} as const;
```

Named `Spacing` keys (`one`…`six`) are deliberate — spacing is chosen from the
scale, not typed as a number.

**Known gap:** the field-error red `#D64545` is inlined in `text-field.tsx` and
`register.tsx`. If you add tokens, add `Colors.error` and use it in both places
rather than copying the literal a third time.

### Typography component

Every text node goes through the Poppins wrapper, never bare `<Text>` from RN:

```tsx
// src/components/ui/text.tsx
export function Text({ weight = 'regular', size = 15, color = Colors.text, style, ...rest }: Props) {
  return <RNText {...rest} style={[{ fontFamily: Fonts[weight], fontSize: size, color }, style]} />;
}
```

Auth type scale actually used: heading `weight="bold" size={24}`, subtitle
`size={15} color={Colors.textSecondary}`, field label `weight="semibold"
size={15}`, input text `16`, helper/links `14`, field error `13`, terms `12`.

---

## 3. Screen anatomy

Both screens are the same two layers inside a navy `View`:

```
<View style={{ flex: 1, backgroundColor: Colors.navy }}>
  <StatusBar style="light" />         // light glyphs over navy
  <AuthBackdrop />                    // absolute fill, pointerEvents="none"
  <View style={styles.cardWrap}>      // absolute bottom sheet, white
    <KeyboardAvoidingView>
      <ScrollView>  … form …  </ScrollView>
    </KeyboardAvoidingView>
  </View>
</View>
```

### 3.1 Backdrop

One `Animated.View` holding the vector artwork, pinned top-left, sized from the
window width times the art's aspect ratio so it never distorts. It accepts an
optional animated style so the *screen* owns the animation and the backdrop stays
dumb.

```tsx
const ART_RATIO = 917 / 412; // height / width of the source viewBox

export function AuthBackdrop({ heroStyle }: Props) {
  const { width } = useWindowDimensions();
  const artHeight = width * ART_RATIO;

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.hero, { width, height: artHeight }, heroStyle]}>
        <AuthArt width={width} height={artHeight} />
      </Animated.View>
    </View>
  );
}
```

- `pointerEvents="none"` — the artwork must never eat taps meant for the card.
- `overflow: 'hidden'` on the fill so the taller-than-screen art is clipped.
- Update `ART_RATIO` if you swap in different artwork; read it off the SVG's
  `viewBox`, don't guess.

### 3.2 Card (bottom sheet)

```ts
cardWrap: {
  position: 'absolute',
  left: 0, right: 0, bottom: 0,
  maxHeight: '68%',            // login; register uses '82%' (more fields)
  backgroundColor: Colors.white,
  borderTopLeftRadius: Radius.xl,
  borderTopRightRadius: Radius.xl,
  ...Shadow.card,
},
cardContent: {
  paddingHorizontal: Spacing.five,
  paddingTop: Spacing.six,
},
```

`maxHeight` (not a fixed height) is what lets the artwork above stay visible
while the card grows only as far as its content needs. Pick the percentage from
the field count.

### 3.3 Keyboard + scroll

```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  style={{ flex: 1 }}>
  <ScrollView
    contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + Spacing.five }]}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
    bounces={false}>
```

- `behavior` only on iOS — Android's `adjustResize` already handles it, and
  setting `padding` there double-shifts the card.
- `insets.bottom` from `useSafeAreaInsets()`, added to the *content* padding, not
  as a wrapper — the white card should bleed to the screen edge behind the home
  indicator.
- `keyboardShouldPersistTaps="handled"` so tapping the CTA while the keyboard is
  open submits on the first tap.
- `bounces={false}` — an overscrolling sheet reveals the navy behind it and looks
  broken.

---

## 4. The intro animation (login only)

A single `progress` shared value drives both layers: `0` = the landing frame
(artwork roughly centred, form off-screen), `1` = the login frame (artwork risen,
form in view). It plays once per app session.

```tsx
// Module scope, so it survives remounts within a session.
let introPlayed = false;

const INTRO_DELAY = 650;
const INTRO_DURATION = 850;

export default function LoginScreen() {
  const { height } = useWindowDimensions();

  // Resting position (translateY 0) is the final login state. The landing frame
  // starts pushed down by this much, then rises into place.
  const heroShift = height * 0.26;

  const shouldPlayIntro = !introPlayed;
  const progress = useSharedValue(shouldPlayIntro ? 0 : 1);

  useEffect(() => {
    if (!shouldPlayIntro) return;
    introPlayed = true;
    progress.value = withDelay(INTRO_DELAY, withTiming(1, { duration: INTRO_DURATION }));
  }, [shouldPlayIntro, progress]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [heroShift, 0]) }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height, 0]) }],
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0, 1]),
  }));
  // …
  <AuthBackdrop heroStyle={heroStyle} />
  <Animated.View style={[styles.cardWrap, cardStyle]}> … </Animated.View>
```

Why it is built this way:

- **One shared value, two derived styles.** The card and artwork can never desync,
  and the whole reveal is one timing curve to tune.
- **Only `transform` and `opacity`** are animated — GPU-only properties, no
  layout on the UI thread. Never animate `height`, `top`, or `marginTop` here.
- **Staged opacity.** `[0, 0.4, 1] → [0, 0, 1]` holds the card invisible for the
  first 40% of the travel, so it fades in on approach instead of being a white
  slab dragged up the screen.
- **`heroShift` from window height**, not a magic pixel count, so the framing
  holds on small and tall devices.
- **`introPlayed` at module scope** — a `useRef` resets on remount and the intro
  would replay every time the user navigated back from sign-up. Module scope
  resets on app reload, which is the intended lifetime. (It is deliberately not
  persisted; a fresh launch replays it.)
- **The delay** lets the splash hand off to a static landing frame before motion
  starts; without it the animation begins mid-splash-dismiss and reads as jank.

The sign-up screen renders `<AuthBackdrop />` with no `heroStyle` and a plain
`View` for the card — it inherits the artwork's resting position and lets the
navigator's `slide_from_right` provide the transition. Do not add a second intro
there.

### React Compiler note

`app.json` sets `experiments.reactCompiler: true`. With the compiler on, prefer
`progress.get()` / `progress.set(...)` over reading and writing `.value` — the
compiler can't track property access, and `.value` opts the component out. The
existing screens still use `.value`; **write new animation code with
`.get()`/`.set()`** and don't copy the older form.

```tsx
progress.set(withDelay(INTRO_DELAY, withTiming(1, { duration: INTRO_DURATION })));
const heroStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: interpolate(progress.get(), [0, 1], [heroShift, 0]) }],
}));
```

Reanimated 4 also requires `react-native-worklets` installed, and
`GestureHandlerRootView` at the app root (already in `_layout.tsx`).

---

## 5. Forms: react-hook-form + Zod

Schemas live apart from the screens in `src/features/auth/schemas.ts`, with types
inferred rather than declared:

```ts
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().min(1, 'Phone number is required')
      .regex(/^[0-9\s]{6,}$/, 'Enter a valid phone number'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    verifyPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((v) => v.password === v.verifyPassword, {
    message: 'Passwords do not match',
    path: ['verifyPassword'],   // attaches the error to the confirm field
  });
export type RegisterValues = z.infer<typeof registerSchema>;
```

Messages are user-facing sentences, since they render verbatim under the field.
Cross-field rules go in `.refine` with an explicit `path`.

In the screen:

```tsx
const { control, handleSubmit } = useForm<LoginValues>({
  resolver: zodResolver(loginSchema),
  defaultValues: { email: '', password: '' },
});

const onSubmit = (values: LoginValues) => { /* … */ };
// <PrimaryButton label="LOG IN" onPress={handleSubmit(onSubmit)} />
```

Always pass `defaultValues` for every field — an undefined value makes the
`TextInput` uncontrolled on first render and React warns when it later becomes
controlled.

### The `TextField` component

Generic over the form's field values, so `name` is autocompleted and type-checked
against the schema. It owns its own show/hide password state.

```tsx
type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  containerStyle?: ViewStyle;
};

export function TextField<T extends FieldValues>({ control, name, label, secureTextEntry, ... }: Props<T>) {
  const [hidden, setHidden] = useState(true);
  const canToggle = Boolean(secureTextEntry);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View style={containerStyle}>
          <Text weight="semibold" size={15} style={styles.label}>{label}</Text>
          <View style={[styles.inputWrap, error && styles.inputWrapError]}>
            <TextInput
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={canToggle && hidden}
              style={styles.input}
              /* …keyboardType / autoComplete / textContentType passthrough… */
            />
            {canToggle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
                onPress={() => setHidden((prev) => !prev)}
                hitSlop={10}
                style={styles.eye}>
                <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {error ? <Text size={13} color="#D64545" style={styles.error}>{error.message}</Text> : null}
        </View>
      )}
    />
  );
}
```

Field styling, reused by every input including the phone number:

```ts
inputWrap: {
  flexDirection: 'row',
  alignItems: 'center',
  height: 56,                    // same height as the CTA and Google button
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Colors.border,
  backgroundColor: Colors.white,
  paddingHorizontal: Spacing.four,
},
inputWrapError: { borderColor: '#D64545' },
input: {
  flex: 1,
  fontFamily: Fonts.regular,
  fontSize: 16,
  color: Colors.text,
  padding: 0,                    // kills Android's default input padding
},
```

Non-negotiables:

- `padding: 0` on the `TextInput`; the wrapper owns spacing. Without it Android
  fields are visibly taller than iOS.
- `value={value ?? ''}` — never let the value go undefined.
- `error ? <Text/> : null`, never `error && <Text/>` — a falsy non-boolean would
  render as a stray text node in React Native.
- `autoComplete` / `textContentType` on every field so password managers work:
  `email`/`emailAddress`, `password`/`password` on login,
  `password-new`/`newPassword` on sign-up (both password fields),
  `name-given`, `name-family`, `tel`/`telephoneNumber`.
- `autoCapitalize` defaults to `'none'`; pass `'words'` for name fields.
- Every `Pressable` gets `accessibilityRole="button"` and `hitSlop` (8–10) — the
  targets are small text links.

### Composite field (phone)

A field that needs bespoke chrome still goes through `Controller` and reuses the
same 56pt/`Radius.md`/`Colors.border` shell — see `PhoneField` in
`src/app/register.tsx`: a static country pill (flag + `+216` + chevron) beside a
flexed number input, error text below the whole row. The country code is fixed
until multi-country support lands, and only the number is validated.

---

## 6. Shared auth chrome

`src/components/auth/auth-common.tsx` holds the three pieces both screens end
with, in this order: `<OrDivider />`, `<GoogleButton onPress={…} />`,
`<TermsFooter />`.

- `OrDivider` — a centred "Or" with `marginVertical: Spacing.three`.
- `GoogleButton` — white, `height: 56`, `Radius.pill`, 1pt `Colors.border`,
  Ionicons `logo-google` in Google blue `#4285F4`, label
  `weight="semibold" size={15}`, `pressed && { opacity: 0.7 }`.
- `TermsFooter` — 12pt `textMuted` sentence with three underlined
  `textSecondary` inline `Text` spans, `lineHeight: 18`, `textAlign: 'center'`.

### Primary CTA

`PrimaryButton`: `height: 56`, `Radius.pill`, `Colors.orange`, `Shadow.pill`,
label `weight="semibold" size={17}` in white, `pressed && { opacity: 0.85 }`,
`disabled` → `Colors.orangeMuted`. Auth labels are uppercase: `LOG IN`,
`SIGN UP`.

It also supports an optional `countdownMs` sweep (used by the delivery flow, not
auth) implemented as a `scaleX` animation with `transformOrigin: 'right'` — GPU
only, no layout. Leave the prop off on auth screens.

### Cross-links

Login → sign-up uses `router.push('/register')`; sign-up → login uses
`router.back()` so the stack doesn't grow when the user ping-pongs. Both render
as `Text weight="bold" size={14} color={Colors.orange}` inside a row with
`flexWrap: 'wrap'`. "Forgot Password" is `weight="semibold" size={14}` in
`Colors.teal`, `alignSelf: 'flex-end'`.

On successful submit, use `router.replace('/<app-route>')` — never `push` — so
back doesn't return to the auth screen.

---

## 7. Routing and root layout

`src/app/index.tsx` **is** the login screen (the app's entry route), and
`register.tsx` sits beside it. In `src/app/_layout.tsx`:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
  {/* …app routes… */}
</Stack>
```

The root layout also gates render on fonts and hides the splash itself:

```tsx
SplashScreen.preventAutoHideAsync();          // module scope

const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
if (!fontsLoaded) return null;
```

Returning `null` until fonts load is what prevents a flash of fallback-font text
in the auth heading. Wrap everything in `GestureHandlerRootView` (flex 1) and
`SafeAreaProvider`.

Note the root sets `<StatusBar style="dark" />` for the app generally; both auth
screens override it with `style="light"` because their backdrop is navy.

---

## 8. Build order

1. Install deps (`npx expo install`), wire `metro.config.js` + `src/types/svg.d.ts`,
   add the `expo-font` plugin and splash colour.
2. Write `src/constants/theme.ts`, then `src/components/ui/text.tsx` and
   `primary-button.tsx`.
3. Root layout: font gate, splash handoff, `Stack` with `headerShown: false`.
4. Drop the artwork at `assets/images/auth-bg.svg`, read its `viewBox`, build
   `AuthBackdrop` with the matching `ART_RATIO`.
5. Schemas in `src/features/auth/schemas.ts`.
6. `TextField`, then `auth-common.tsx`.
7. Login screen static first — backdrop + card + form, `progress` pinned at `1`.
   Verify layout and keyboard behaviour before adding motion.
8. Add the intro animation last, then the sign-up screen (no intro).

## 9. Verification checklist

- [ ] Fresh launch: splash → landing frame → artwork rises and card fades up once.
- [ ] Navigate to sign-up and back: the intro does **not** replay.
- [ ] Reload the app: it plays again.
- [ ] Keyboard open on both screens: submit reachable, card not double-shifted on
      Android, no navy showing through an overscroll.
- [ ] Submit empty: per-field errors, red borders, layout doesn't jump.
- [ ] Sign-up with mismatched passwords: error lands on **Verify Password**.
- [ ] Password eye toggles, announces show/hide, and doesn't submit the form.
- [ ] Tall and small devices: artwork framing holds, card `maxHeight` still leaves
      the logo visible.
- [ ] Status bar glyphs are light over the navy on both screens.
- [ ] `npm run lint` clean; new animation code uses `.get()`/`.set()`.
