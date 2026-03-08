import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'keycloak_access_token';
const REFRESH_TOKEN_KEY = 'keycloak_refresh_token';
const ID_TOKEN_KEY = 'keycloak_id_token';

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function saveTokens(tokens: TokenSet): Promise<void> {
  await setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  if (tokens.idToken) {
    await setItem(ID_TOKEN_KEY, tokens.idToken);
  }
}

export async function getTokens(): Promise<TokenSet | null> {
  const accessToken = await getItem(ACCESS_TOKEN_KEY);
  const refreshToken = await getItem(REFRESH_TOKEN_KEY);
  const idToken = await getItem(ID_TOKEN_KEY);

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    idToken: idToken ?? undefined,
  };
}

export async function clearTokens(): Promise<void> {
  await deleteItem(ACCESS_TOKEN_KEY);
  await deleteItem(REFRESH_TOKEN_KEY);
  await deleteItem(ID_TOKEN_KEY);
}
