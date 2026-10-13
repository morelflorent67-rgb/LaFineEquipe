'use client';

import { useCallback, useRef } from 'react';

/**
 * Boîtes de dialogue ouvertes par programme (sans « Trigger » Radix) : on mémorise l'élément
 * qui avait le focus à l'ouverture et on le lui rend à la fermeture (Échap, Annuler, clic dehors).
 */
export function useReturnFocus() {
  const last = useRef<HTMLElement | null>(null);
  const remember = useCallback(() => {
    last.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);
  const onCloseAutoFocus = useCallback((event: Event) => {
    const el = last.current;
    if (el && el.isConnected) {
      event.preventDefault();
      el.focus();
    }
  }, []);
  return { remember, onCloseAutoFocus };
}
