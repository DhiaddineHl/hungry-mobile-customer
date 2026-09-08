import { getTokens } from '@/services/keycloak/token-storage';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';

/**
 * One shared STOMP connection to hungry-notification (the dispatch-notification
 * service — see `delivery-dispatch-architecture.md`), for live driver-assignment
 * updates. First (and only, for now) STOMP usage in this app; everything else
 * is `axios` + polling.
 *
 * Connects with a raw WebSocket, not SockJS: `withSockJS()` on the server
 * still exposes a plain `/websocket` sub-path any STOMP-over-WebSocket client
 * can use directly, and React Native ships a native `WebSocket` — there is no
 * old-browser gap for SockJS's fallback transports to paper over here.
 *
 * The WebSocket handshake itself can't carry an `Authorization` header
 * (neither React Native's nor a browser's `WebSocket` lets a client set
 * arbitrary headers on it), so the token travels as a STOMP CONNECT header
 * instead (`connectHeaders`), which `@stomp/stompjs` sends as part of the
 * STOMP frame — matching hungry-notification's `StompAuthChannelInterceptor`,
 * which reads it from there.
 */

type Listener = (payload: unknown) => void;

interface Registration {
  destination: string;
  listener: Listener;
  subscription: StompSubscription | null;
}

let client: Client | null = null;
const registrations = new Set<Registration>();

function resolveBrokerUrl(): string {
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.100.93:8082';
  // http(s):// -> ws(s):// — same host/port, the gateway proxies /ws/** to
  // hungry-notification (see jfwk-gateway's hungry-notification-ws route).
  return `${apiBase.replace(/^http/, 'ws')}/ws/websocket`;
}

function parseBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function ensureClient(): Client {
  if (client) return client;

  const stomp = new Client({
    brokerURL: resolveBrokerUrl(),
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  // Read fresh on every (re)connect attempt, not once at client creation — a
  // long-lived app can easily outlive the access token this started with.
  stomp.beforeConnect = async () => {
    const tokens = await getTokens();
    stomp.connectHeaders = tokens?.accessToken
      ? { Authorization: `Bearer ${tokens.accessToken}` }
      : {};
  };

  // Replays every still-active registration on connect AND on every
  // reconnect — a dropped socket (backgrounded app, network blip) would
  // otherwise come back with none of the previous subscriptions.
  stomp.onConnect = () => {
    for (const registration of registrations) {
      registration.subscription = stomp.subscribe(registration.destination, (message: IMessage) => {
        registration.listener(parseBody(message.body));
      });
    }
  };

  stomp.activate();
  client = stomp;
  return stomp;
}

/**
 * Subscribes to one STOMP destination for as long as the caller wants.
 * Reconnect-safe (see {@link ensureClient}'s `onConnect`). Returns an
 * unsubscribe function — call it on unmount; the underlying connection stays
 * open for other subscribers and reconnects on its own otherwise.
 */
export function subscribeToTopic(destination: string, listener: Listener): () => void {
  const stomp = ensureClient();
  const registration: Registration = { destination, listener, subscription: null };
  registrations.add(registration);

  if (stomp.connected) {
    registration.subscription = stomp.subscribe(destination, (message: IMessage) => {
      listener(parseBody(message.body));
    });
  }

  return () => {
    registrations.delete(registration);
    registration.subscription?.unsubscribe();
  };
}
