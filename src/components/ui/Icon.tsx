import type { SVGProps } from 'react';

/** Pictogrammes Forge (repris de la V2). Décoratifs par défaut (aria-hidden). */
const PATHS = {
  spk: { vb: '0 0 20 40', d: 'M10 0 L15 24 L10 40 L5 24 Z' },
  arrow: { vb: '0 0 44 20', d: 'M0 8 H30 L26 0 L44 10 L26 20 L30 12 H0 Z' },
  play: { vb: '0 0 24 24', d: 'M5 2 L22 12 L5 22 L9 12 Z' },
  ext: { vb: '0 0 24 24', d: 'M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z' },
  lock: {
    vb: '0 0 24 24',
    d: 'M7 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10H7zm2 0h6V7a3 3 0 0 0-6 0v3z',
  },
  search: {
    vb: '0 0 24 24',
    d: 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  },
  home: { vb: '0 0 24 24', d: 'M12 2.5 22 11h-3v10h-5.5v-6h-3v6H5V11H2l10-8.5z' },
  grid: { vb: '0 0 24 24', d: 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z' },
  map: { vb: '0 0 24 24', d: 'M9 3 15 5.5 21 3v16l-6 2.5L9 19l-6 2.5v-16L9 3zm1 2.6v11.8l4 1.7V7.3l-4-1.7z' },
  pin: { vb: '0 0 24 24', d: 'M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  upload: { vb: '0 0 24 24', d: 'M11 16V7.8L7.4 11.4 6 10l6-6 6 6-1.4 1.4L13 7.8V16h-2zM4 18h16v2H4z' },
  share: {
    vb: '0 0 24 24',
    d: 'M17 3a3 3 0 1 1-2.8 4.1L9.6 9.7a3 3 0 0 1 0 4.6l4.6 2.6A3 3 0 1 1 13.5 19l-4.9-2.8a3 3 0 1 1 0-8.4L13.5 5A3 3 0 0 1 17 3z',
  },
  trophy: {
    vb: '0 0 24 24',
    d: 'M6 3h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 16v3h4v2H7v-2h4v-3a6 6 0 0 1-3.4-3A5 5 0 0 1 3 8V5h3V3zm0 4H5v1a3 3 0 0 0 1.4 2.5A6 6 0 0 1 6 9V7zm12 0v2a6 6 0 0 1-.4 1.5A3 3 0 0 0 19 8V7h-1z',
  },
  target: {
    vb: '0 0 24 24',
    d: 'M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1V2zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  },
  nade: {
    vb: '0 0 24 24',
    d: 'M10 1h4v3h-4zM12 5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
    evenodd: true,
  },
  menu: { vb: '0 0 24 24', d: 'M5 6h15l-1 2H4zM4 11h15l-1 2H3zM3 16h15l-1 2H2z' },
  wall: {
    vb: '0 0 24 24',
    d: 'M2 4h20v16H2V4zm2 2v3h7V6H4zm9 0v3h7V6h-7zM4 11v3h3v-3H4zm5 0v3h7v-3H9zm9 0v3h2v-3h-2zM4 16v2h7v-2H4zm9 0v2h7v-2h-7z',
  },
  users: {
    vb: '0 0 24 24',
    d: 'M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1zm15.5-5.9c2.6.4 4.5 2.4 4.5 4.9v1h-4.2v-1c0-1.9-.8-3.6-2.1-4.9z',
  },
  smoke: { vb: '0 0 24 24', d: 'M7 19a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.6 8.6 5 5 0 0 1 17.5 19H7z' },
  flash: { vb: '0 0 24 24', d: 'M12 1 L14 9 L22 6 L16 12 L22 18 L14 15 L12 23 L10 15 L2 18 L8 12 L2 6 L10 9 Z' },
  molotov: { vb: '0 0 24 24', d: 'M12 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z' },
  he: {
    vb: '0 0 24 24',
    d: 'M10 1h4v3h-4z M12 5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17z M12 9a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9z',
    evenodd: true,
  },
  plus: { vb: '0 0 24 24', d: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z' },
  edit: { vb: '0 0 24 24', d: 'M15.5 3.5l5 5L9 20H4v-5L15.5 3.5zm0 2.8L6 15.8V18h2.2l9.5-9.5-2.2-2.2z' },
  archive: { vb: '0 0 24 24', d: 'M3 3h18v5H3V3zm1 6h16v12H4V9zm5 3v2h6v-2H9z' },
  restore: { vb: '0 0 24 24', d: 'M12 4a8 8 0 1 1-7.7 10h2.1A6 6 0 1 0 12 6v3L7 5l5-4v3z' },
  trash: { vb: '0 0 24 24', d: 'M9 2h6l1 2h5v2H3V4h5l1-2zM5 8h14l-1 14H6L5 8z' },
  check: { vb: '0 0 24 24', d: 'M9.5 16.2 4.8 11.5l-1.4 1.4 6.1 6.1L21 7.5l-1.4-1.4z' },
  close: { vb: '0 0 24 24', d: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z' },
  refresh: { vb: '0 0 24 24', d: 'M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h7V4l-2.3 2.3z' },
  link: {
    vb: '0 0 24 24',
    d: 'M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2-1.4-1.4 2-2a1 1 0 1 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0zM13.4 10.6a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2 1.4 1.4-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0z',
  },
  alert: { vb: '0 0 24 24', d: 'M12 2 1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z' },
  info: { vb: '0 0 24 24', d: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 8v8h2v-8h-2zm0-4v2h2V6h-2z' },
  logout: { vb: '0 0 24 24', d: 'M10 3h9v18h-9v-2h7V5h-7V3zm-.6 5.4L6.8 11H15v2H6.8l2.6 2.6L8 17l-5-5 5-5 1.4 1.4z' },
  user: { vb: '0 0 24 24', d: 'M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM4 21c0-4 3.6-7 8-7s8 3 8 7v1H4v-1z' },
  video: { vb: '0 0 24 24', d: 'M3 5h13v14H3V5zm14 5 5-3v10l-5-3v-4z' },
  copy: { vb: '0 0 24 24', d: 'M8 3h11v13h-2V5H8V3zM4 7h11v14H4V7zm2 2v10h7V9H6z' },
  flag: { vb: '0 0 24 24', d: 'M5 2h2v1h12l-2 5 2 5H7v9H5V2zm2 3v6h9l-1.2-3L16 5H7z' },
  chevron: { vb: '0 0 24 24', d: 'M7 9l5 5 5-5 1.4 1.4L12 16.8 5.6 10.4z' },
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, title, ...rest }: { name: IconName; title?: string } & SVGProps<SVGSVGElement>) {
  const p = PATHS[name];
  return (
    <svg
      viewBox={p.vb}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={p.d} fillRule={'evenodd' in p ? 'evenodd' : undefined} />
    </svg>
  );
}
