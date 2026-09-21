import { describeCoordinates } from '@/services/location/delivery-point';
import type { LocationCoords } from '@/types/location';
import { useCallback, useRef, useState } from 'react';

/**
 * Names the point the customer is currently pointing at.
 *
 * Its own hook because the guard it carries is easy to leave out and invisible
 * when missing: a customer dragging a map fires one lookup per settle, and the
 * platform geocoder answers out of order often enough that a slow EARLIER
 * lookup will otherwise overwrite the label of the point they are looking at
 * now. Only the newest request may write.
 *
 * `text` is `null` until something resolves, so callers can fall back to the
 * saved address rather than rendering an empty bubble.
 */
export function useReverseGeocode() {
  const [text, setText] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const requestRef = useRef(0);

  const describe = useCallback(async (coords: LocationCoords) => {
    const requestId = ++requestRef.current;
    setIsResolving(true);

    const resolved = await describeCoordinates(coords);

    // A newer point (or a reset) has been asked for since — this answer
    // describes somewhere the customer has already moved away from.
    if (requestId !== requestRef.current) return;

    setText(resolved);
    setIsResolving(false);
  }, []);

  /** Forgets the current label AND abandons any lookup still in flight. */
  const reset = useCallback(() => {
    requestRef.current += 1;
    setText(null);
    setIsResolving(false);
  }, []);

  return { text, isResolving, describe, reset };
}
