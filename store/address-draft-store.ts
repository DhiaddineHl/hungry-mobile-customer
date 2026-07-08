import { create } from "zustand";
import { AddressData } from "@/types/location";

/**
 * Addresses collected during the post-sign-up onboarding, before they are
 * committed to the backend in one update. Lives outside the address-info
 * screen because "Add Another Address" round-trips through the map picker,
 * which mounts a fresh screen instance. Deliberately not persisted — an
 * abandoned onboarding should not leak stale drafts into the next one.
 */
interface AddressDraftState {
  drafts: AddressData[];
  /**
   * Which address is the customer's default. Indexes the conceptual list
   * `[...drafts, currentForm]` — a value of `drafts.length` means the
   * form still being filled in on the address-info screen.
   */
  defaultIndex: number;
  addDraft: (draft: AddressData) => void;
  removeDraft: (index: number) => void;
  setDefaultIndex: (index: number) => void;
  clear: () => void;
}

export const useAddressDraftStore = create<AddressDraftState>()((set) => ({
  drafts: [],
  defaultIndex: 0,

  addDraft: (draft) => set((state) => ({ drafts: [...state.drafts, draft] })),

  removeDraft: (index) =>
    set((state) => ({
      drafts: state.drafts.filter((_, i) => i !== index),
      defaultIndex:
        state.defaultIndex === index
          ? 0
          : state.defaultIndex > index
            ? state.defaultIndex - 1
            : state.defaultIndex,
    })),

  setDefaultIndex: (index) => set({ defaultIndex: index }),

  clear: () => set({ drafts: [], defaultIndex: 0 }),
}));
