import type { ReactNode } from 'react';

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const I = (children: ReactNode, sw = 1.8) => <svg {...base} strokeWidth={sw}>{children}</svg>;

export const Icon = {
  car: I(<><path d="M3 14l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4h-2v-1H5v1H3z" /><circle cx="7.5" cy="14" r="1" /><circle cx="16.5" cy="14" r="1" /></>),
  pulse: I(<path d="M3 12h4l2-6 4 12 2-6h6" />),
  shield: I(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />),
  pin: I(<><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  doc: I(<><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 12h6M10 16h6" /></>),
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
  obd: I(<><path d="M3 7h18l-2 10H5z" /><path d="M7 11h.01M10 11h.01M14 11h.01M17 11h.01M8.5 14h.01M12 14h.01M15.5 14h.01" /></>),
  check: I(<path d="M5 12.5l4.5 4.5L19 7.5" />, 2.6),
  log: I(<path d="M4 6h16M4 12h16M4 18h10" />),
  restart: I(<><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></>),
  chev: I(<path d="M9 5l7 7-7 7" />, 1.6),
  back: I(<path d="M15 5l-7 7 7 7" />),
  mark: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4h-2v-1H5v1H3z" /></svg>,
  orbit: I(<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.5h-4.5" /></>, 1.6),
  front: I(<><path d="M5 15v-4l1.5-3.4a2 2 0 0 1 1.8-1.2h7.4a2 2 0 0 1 1.8 1.2L19 11v4" /><path d="M4 15h16v3H4z" /><path d="M8 12.5h.01M16 12.5h.01" /></>, 1.6),
  side: I(<><path d="M3 15.5l1.4-4a2 2 0 0 1 1.9-1.4h6.2c.7 0 1.3.3 1.8.7l2 1.9 2.6.6v2.2" /><circle cx="7.5" cy="15.5" r="1.7" /><circle cx="16.5" cy="15.5" r="1.7" /></>, 1.6),
  top: I(<><rect x="8" y="3" width="8" height="18" rx="3.5" /><path d="M9.5 8h5M9.5 16h5" /></>, 1.6),
};

export function Silhouette({ body, hex, className }: { body: string; hex: string; className?: string }) {
  const P: any = {
    sedan: { d: 'M16 112 L16 94 Q18 84 38 80 L96 74 L140 48 Q148 42 162 42 L232 42 Q250 42 262 52 L300 76 L360 84 Q382 88 382 100 L382 112 Z', w: [98, 304] },
    minivan: { d: 'M14 112 L14 70 Q16 56 34 52 L84 44 L190 36 Q206 36 218 46 L262 74 L366 84 Q388 88 388 100 L388 112 Z', w: [98, 312] },
  };
  const p = P[body] || P.sedan;
  return (
    <svg className={className} viewBox="0 0 400 140" fill="none" aria-hidden="true">
      <path d={p.d} fill={hex} fillOpacity=".92" />
      <path d={p.d} stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
      {p.w.map((x: number) => (
        <g key={x}><circle cx={x} cy="114" r="24" fill="#0b0d11" stroke="#9aa4b5" strokeWidth="3" /><circle cx={x} cy="114" r="10" fill="#2a303b" /></g>
      ))}
    </svg>
  );
}
