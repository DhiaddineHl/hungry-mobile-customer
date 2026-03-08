const KEYCLOAK_URL = process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://192.168.242.25:8081';
const REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'hungry';
const CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'hungry-customer-app';

const realmUrl = `${KEYCLOAK_URL}/realms/${REALM}`;

export const keycloakConfig = {
  url: KEYCLOAK_URL,
  realm: REALM,
  clientId: CLIENT_ID,
  realmUrl,
  authorizationEndpoint: `${realmUrl}/protocol/openid-connect/auth`,
  tokenEndpoint: `${realmUrl}/protocol/openid-connect/token`,
  endSessionEndpoint: `${realmUrl}/protocol/openid-connect/logout`,
  userInfoEndpoint: `${realmUrl}/protocol/openid-connect/userinfo`,
  registrationEndpoint: `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
};
