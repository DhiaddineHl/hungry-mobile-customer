export type AddressType = 'apartment' | 'office' | 'house' | 'other';
export type AddressLabel = 'home' | 'work' | 'custom';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface AddressData {
  coords: LocationCoords;
  addressText: string;
  addressType: AddressType;
  label: AddressLabel;
  customLabel?: string;
  floorNumber?: string;
  doorNumber?: string;
  additionalInfo?: string;
}
