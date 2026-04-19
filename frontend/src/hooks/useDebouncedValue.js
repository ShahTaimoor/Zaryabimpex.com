import { useState, useEffect } from 'react';

/**
 * Returns `value` after it has stayed unchanged for `delay` ms.
 * Use for search boxes so RTK Query / APIs are not hit on every keystroke.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
