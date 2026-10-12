import { create } from 'zustand';

/**
 * The hand-off between the three screens of a forgotten-password reset:
 * `/forgot-password` (address) → `/reset-code` (the mailed code) →
 * `/new-password` (the password itself).
 *
 * Deliberately NOT persisted, like [[pending-verification-store]] and for the
 * same reason: the ticket is a live authorization to change someone's
 * password, and that does not belong in AsyncStorage. It lives in memory for
 * the length of the flow and is dropped the moment the password is set (or the
 * user backs out). If the app is killed mid-reset the ticket is simply gone
 * and the user starts again — the backend expires it on its own clock anyway.
 */
interface PasswordResetState {
  /** The address a code was mailed to, and the login username. */
  email: string | null;
  /**
   * The single-use secret returned by `/password-reset/verify`, spent by
   * `/password-reset/confirm`. Null until the code has been accepted.
   */
  ticket: string | null;

  /** Begins a reset for an address (clears any ticket from a previous run). */
  start: (email: string) => void;
  /** Records the ticket the accepted code bought. */
  setTicket: (ticket: string) => void;
  clear: () => void;
}

const EMPTY = {
  email: null,
  ticket: null,
} as const;

export const usePasswordResetStore = create<PasswordResetState>()((set) => ({
  ...EMPTY,

  start: (email) => set({ email, ticket: null }),

  setTicket: (ticket) => set({ ticket }),

  clear: () => set({ ...EMPTY }),
}));
