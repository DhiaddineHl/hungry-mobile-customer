// Hungry customer app — icon registry. Every icon in the app goes through <Icon />.
//   <Icon name="search" />                       // 20, ink
//   <Icon name="back" size="nav" />              // 22
//   <Icon name="favourite" filled />             // saved heart, primary fill
//   <Icon name="delivery" color="success" size="inline" />
import React from 'react';
import {
  Banknote, Bell, BellOff, Briefcase, Building2, Check, ChefHat, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheck, CircleHelp, Clock, Eye, FileText, Flag, Heart, House, Info, Languages,
  LocateFixed, LogOut, Mail, MapPin, MapPinOff, Minus, Motorbike, Package, Phone, Plus, Receipt, RotateCcw,
  Search, SearchX, ShieldCheck, ShoppingBag, ShoppingCart, Star, ThumbsUp, Trash2, User, UserCog, WifiOff, X,
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
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;
type SizeToken = keyof ReturnType<typeof useTheme>['size']['icon'];

export function Icon({
  name, size = 'field', color = 'ink', filled = false, accessibilityLabel,
}: { name: IconName; size?: SizeToken | number; color?: ColorToken; filled?: boolean; accessibilityLabel?: string }) {
  const theme = useTheme();
  const Cmp = icons[name];
  const px = typeof size === 'number' ? size : theme.size.icon[size];
  const stroke = theme.colors[filled && color === 'ink' ? 'primary' : color];
  return (
    <Cmp
      size={px}
      color={stroke}
      strokeWidth={2}
      fill={filled ? stroke : 'none'}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
