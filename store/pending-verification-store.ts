import { create } from 'zustand';

/**
 * The hand-off between sign-up and the verification screen.
 *
 * Registration no longer signs the user in — the account exists but its e-mail
 * is unproven, so the app holds them on `/verification` until the mailed code
 * comes back. The sign-in that used to happen at sign-up now happens there,
 * which means the password has to survive one screen transition.
 *
 * Deliberately NOT persisted, unlike every other store in this folder: a
 * password does not belong in AsyncStorage. It lives in memory for the length
 * of the flow and is dropped the moment the session exists (or the user backs
 * out). If the app is killed mid-flow the credentials are simply gone and the
 * user signs in from `/login`, where the same verification gate catches them
 * again — the account state lives on the server, not here.
 */
interface PendingVerificationState {
  /** The address a code was mailed to, and the login username. */
  email: string | null;
  /**
   * The password chosen at sign-up, used once to sign in after the code is
   * accepted. Null when the flow was entered from an already-signed-in but
   * unverified session, where no sign-in is needed.
   */
  password: string | null;
  /** Greeting name for the screen copy. */
  firstName: string | null;
  /** Whether the address onboarding still has to run after signing in. */
  needsAddress: boolean;

  start: (pending: {
    email: string;
    password: string;
    firstName?: string | null;
    needsAddress: boolean;
  }) => void;
  clear: () => void;
}

const EMPTY = {
  email: null,
  password: null,
  firstName: null,
  needsAddress: false,
} as const;

export const usePendingVerificationStore = create<PendingVerificationState>()((set) => ({
  ...EMPTY,

  start: ({ email, password, firstName = null, needsAddress }) =>
    set({ email, password, firstName, needsAddress }),

  clear: () => set({ ...EMPTY }),
}));
