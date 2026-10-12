import { z } from 'zod';

/**
 * Spring's flat `PageImpl` envelope, shared by every paged endpoint this app
 * reads (`/restaurants/all`, `/configurable-products/all`, …).
 *
 * Lives in its own module rather than beside one resource's schemas because
 * two resources now depend on it, and a second copy would be free to drift
 * from the first.
 */

/**
 * The five fields of Spring's flat `PageImpl` serialization this app uses.
 * `size`, `first`, `numberOfElements`, `empty`, `sort` and `pageable` are
 * deliberately unmodelled so a future Boot upgrade that reshapes the envelope
 * breaks here rather than everywhere.
 *
 * `content` is NOT `.catch([])`: an item that fails to parse must surface as an
 * error, not vanish into an empty list.
 */
export function pageSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    content: z.array(itemSchema),
    number: z.number().nullish(),
    totalPages: z.number().nullish(),
    totalElements: z.number().nullish(),
    last: z.boolean().nullish(),
  });
}

/** The page envelope with a concrete item type; shape derived from `pageSchema`. */
type PageEnvelope = z.infer<ReturnType<typeof pageSchema<z.ZodUnknown>>>;

export type Page<T> = Omit<PageEnvelope, 'content'> & {
  content: T[];
};
