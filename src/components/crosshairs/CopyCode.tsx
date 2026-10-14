'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import styles from './crosshairs.module.css';

/** Code de partage + bouton « Copier » (repli : sélection manuelle si le presse-papiers est refusé). */
export function CopyCode({
  code,
  label,
  compact = false,
}: {
  code: string;
  label: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1800);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <div className={`${styles.code} ${compact ? styles.compactCode : ''}`}>
      {!compact ? <code title={code}>{code}</code> : null}
      <button
        type="button"
        data-done={done ? '' : undefined}
        aria-label={`Copier le code de « ${label} »`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setDone(true);
            toast('Code copié : colle-le dans CS2 pour l’importer.');
          } catch {
            window.prompt('Copie ce code :', code);
          }
        }}
      >
        <Icon name={done ? 'check' : 'copy'} /> {done ? 'Copié' : compact ? 'Copier le code' : 'Copier'}
      </button>
    </div>
  );
}
