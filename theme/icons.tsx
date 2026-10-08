// Hungry customer app — icon registry. Every icon in the app goes through <Icon />.
//   <Icon name="search" />                       // 20, ink
//   <Icon name="back" size="nav" />              // 22
//   <Icon name="favourite" filled />             // saved heart, primary fill
//   <Icon name="delivery" color="success" size="inline" />
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Banknote, Bell, BellOff, Briefcase, Building2, Check, ChefHat, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, CircleAlert, CircleCheck, CircleHelp, Clock, Copy, Eye, EyeOff, FileText, Flag, Heart, House,
  Info, Languages, LocateFixed, LogOut, Mail, MapPin, MapPinOff, MessageCircle, Minus, Motorbike, Navigation,
  Package, Pencil, Phone, Plus, Receipt, RefreshCw, RotateCcw, Search, SearchX, Send, ShieldCheck, ShoppingBag,
  ShoppingCart, Star, Store, ThumbsUp, Trash2, User, UserCog, WifiOff, X,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from './theme';
import type { ColorToken } from './colors';

export const icons = {
  back: ChevronLeft, chevronDown: ChevronDown, chevronRight: ChevronRight, close: X, search: Search,
  bell: Bell, bellOff: BellOff, home: House, favourite: Heart, cart: ShoppingCart, profile: User,
  liked: ThumbsUp, time: Clock, delivery: Motorbike, add: Plus, remove: Minus, delete: Trash2,
  check: Check, success: CircleCheck, error: CircleAlert, info: Info, offline: WifiOff, noResults: SearchX,
  pin: MapPin, pinOff: MapPinOff, locate: LocateFixed, apartment: Building2, office: Briefcase, house: House,
  phone: Phone, cash: Banknote, mail: Mail, showPassword: Eye,
  receipt: Receipt, preparing: ChefHat, ready: ShoppingBag, delivered: Package, reorder: RotateCcw, star: Star,
  accountSettings: UserCog, language: Languages, help: CircleHelp, report: Flag, terms: FileText, privacy: ShieldCheck,
  logout: LogOut,
  // Not on the board — screens the board does not draw (order detail, tracking,
  // support, password visibility toggle). Same Lucide set, same stroke.
  hidePassword: EyeOff, chevronUp: ChevronUp, retry: RefreshCw, edit: Pencil, navigate: Navigation,
  message: MessageCircle, send: Send, copy: Copy, store: Store,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;
type SizeToken = keyof ReturnType<typeof useTheme>['size']['icon'];

export function Icon({
  name, size = 'field', color = 'ink', filled = false, accessibilityLabel, style,
}: {
  name: IconName;
  size?: SizeToken | number;
  color?: ColorToken;
  filled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const Cmp = icons[name];
  const px = typeof size === 'number' ? size : theme.size.icon[size];
  const stroke = theme.colors[filled && color === 'ink' ? 'primary' : color];
  return (
    <Cmp
      size={px}
      color={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={filled ? stroke : 'none'}
      // Decorative unless labelled; only a labelled icon is an a11y element.
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel } : null)}
      style={style}
    />
  );
}
