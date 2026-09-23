import type { AddCartItemInput } from '@/schemas/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCartItem } from './cart-service';

/**
 * One-time carry-over of a cart an OLDER version of the app kept on the device.
 *
 * That version owned the cart: lines (with their options and notes) lived in a
 * persisted store under {@link LEGACY_CART_KEY}, and only a thin copy reached
 * the server. The cart is the server's now, so a customer who updates with dishes
 * still in their basket would otherwise open the app to an empty one. The
 * device's lines are replayed onto the server cart — options and notes intact —
 * and the old storage is then removed.
 *
 * Deliberately conservative:
 *   - it only replays when the server cart is EMPTY. A non-empty one means the
 *     customer already has a cart on the new model (another device, an earlier
 *     run); merging two baskets would order things twice, so the server wins;
 *   - it is best effort per line: a dish that no longer exists is skipped, not
 *     fatal;
 *   - the old storage is kept when nothing could be carried over because the
 *     network failed, so the next launch can try again.
 */

/** The persisted key of the removed local cart store. */
export const LEGACY_CART_KEY = 'hungry-cart';
/** The persisted key of the removed on-device order price snapshots (the server prices orders now). */
export const LEGACY_ORDER_PRICES_KEY = 'hungry-order-prices';

/** The parts of an old cart line that still mean something. */
export interface LegacyCartLine {
  foodId: string;
  quantity: number;
  note?: string;
  addonIds: string[];
}

/**
 * Reads the lines out of the old store's JSON (`{"state":{"items":[…]},"version":n}`).
 * Anything malformed yields no lines rather than throwing: this runs unattended
 * at startup.
 */
export function parseLegacyCart(raw: string | null | undefined): LegacyCartLine[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const items = (parsed as { state?: { items?: unknown } } | null)?.state?.items;
  if (!Array.isArray(items)) return [];

  const lines: LegacyCartLine[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const line = item as {
      foodId?: unknown;
      quantity?: unknown;
      note?: unknown;
      addons?: unknown;
    };
    if (typeof line.foodId !== 'string' || !line.foodId) continue;
    if (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity < 1) continue;

    const addonIds = Array.isArray(line.addons)
      ? line.addons
          .map((addon) => (addon as { id?: unknown })?.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    lines.push({
      foodId: line.foodId,
      quantity: Math.min(Math.floor(line.quantity), 99),
      note: typeof line.note === 'string' && line.note.trim() ? line.note.trim() : undefined,
      addonIds,
    });
  }
  return lines;
}

/** An old line as the server's add-to-cart request. */
export function toAddCartItemInput(line: LegacyCartLine): AddCartItemInput {
  return {
    productId: line.foodId,
    quantity: line.quantity,
    note: line.note,
    attributes: line.addonIds.map((attributeId) => ({ attributeId, checked: true })),
  };
}

interface Storage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

interface MigrationOptions {
  /** Whether the customer's server cart has no lines. Only then are the old ones replayed. */
  serverCartIsEmpty: boolean;
  /** Injected in tests. */
  storage?: Storage;
  add?: (input: AddCartItemInput) => Promise<unknown>;
}

/**
 * Carries the old cart over. Returns how many lines reached the server.
 * Never throws.
 */
export async function migrateLegacyCart({
  serverCartIsEmpty,
  storage = AsyncStorage,
  add = addCartItem,
}: MigrationOptions): Promise<number> {
  try {
    // Old price snapshots are dead weight either way; the server prices orders now.
    await storage.removeItem(LEGACY_ORDER_PRICES_KEY);

    const raw = await storage.getItem(LEGACY_CART_KEY);
    if (raw === null) return 0;

    const lines = parseLegacyCart(raw);
    let migrated = 0;
    let failed = 0;
    if (serverCartIsEmpty) {
      for (const line of lines) {
        try {
          await add(toAddCartItemInput(line));
          migrated += 1;
        } catch {
          failed += 1;
        }
      }
    }

    // Keep the old cart only when there was something to carry over and none of it made it.
    if (lines.length > 0 && serverCartIsEmpty && migrated === 0 && failed > 0) return 0;

    await storage.removeItem(LEGACY_CART_KEY);
    return migrated;
  } catch {
    return 0;
  }
}
