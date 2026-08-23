// Keycloak is addressed DIRECTLY (:8081), not through the jfwk-gateway that fronts
// the backend API (:8082, see services/api/client.ts). The gateway routes everything
// to hungry-app and is itself a resource server — it has no /realms/** route, and
// pointing this at it would 404 every token request.
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
  // No Admin REST endpoints here on purpose: account creation and profile
  // updates go through the backend (POST/PUT /customers), which holds the
  // service-account credentials. See docs/keycloak-setup.md.
};
