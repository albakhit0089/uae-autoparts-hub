import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...p }: P) {
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p };
}

export const Icon = {
  search: (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  globe: (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>),
  sun: (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>),
  moon: (p: P) => (<svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>),
  menu: (p: P) => (<svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>),
  close: (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>),
  user: (p: P) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>),
  store: (p: P) => (<svg {...base(p)}><path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6" /></svg>),
  pin: (p: P) => (<svg {...base(p)}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>),
  shield: (p: P) => (<svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>),
  heart: (p: P) => (<svg {...base(p)}><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z" /></svg>),
  heartFill: (p: P) => (<svg {...base(p)} fill="currentColor"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z" /></svg>),
  flag: (p: P) => (<svg {...base(p)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>),
  scale: (p: P) => (<svg {...base(p)}><path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7ZM8 21h8" /></svg>),
  truck: (p: P) => (<svg {...base(p)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>),
  clock: (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  upload: (p: P) => (<svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>),
  download: (p: P) => (<svg {...base(p)}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>),
  plus: (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>),
  check: (p: P) => (<svg {...base(p)}><path d="m5 12 5 5 9-10" /></svg>),
  alert: (p: P) => (<svg {...base(p)}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg>),
  sparkle: (p: P) => (<svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg>),
  car: (p: P) => (<svg {...base(p)}><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM5 11h14" /><circle cx="7.5" cy="13.5" r="1" /><circle cx="16.5" cy="13.5" r="1" /></svg>),
  whatsapp: (p: P) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  ),
};

/** Category illustrations used for categories and for sample listings without real photos. */
export function CategoryGlyph({ id, size = 40, className = "" }: { id: string; size?: number; className?: string }) {
  const s = { width: size, height: size, viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, "aria-hidden": true };
  switch (id) {
    case "engine":
      return (<svg {...s}><path d="M10 18h6l3-4h10l3 4h4v6h4v-4h2v12h-2v-4h-4v6h-6l-3 3H19l-3-3h-6z" /><path d="M6 22h4v8H6zM20 14v-4h8v4" /></svg>);
    case "transmission":
      return (<svg {...s}><circle cx="17" cy="20" r="8" /><circle cx="17" cy="20" r="3" /><circle cx="32" cy="30" r="6" /><circle cx="32" cy="30" r="2" /><path d="M17 9v3M17 28v3M6 20h3M25 20h3M9.2 12.2l2.1 2.1M22.7 25.7l2.1 2.1M32 21v3M32 36v3M41 30h-3" /></svg>);
    case "electrical":
      return (<svg {...s}><path d="M27 5 13 27h10l-3 16 15-23H25l2-15Z" /></svg>);
    case "brakes":
      return (<svg {...s}><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="5" /><path d="M10 14c4-6 10-8 16-8M38 34c-4 6-10 8-16 8" strokeWidth="5" opacity=".35" /><circle cx="24" cy="12" r="1.2" /><circle cx="36" cy="24" r="1.2" /><circle cx="24" cy="36" r="1.2" /><circle cx="12" cy="24" r="1.2" /></svg>);
    case "suspension":
      return (<svg {...s}><path d="M24 4v6M18 10h12M18 38h12M24 38v6" /><path d="M18 14l12 3-12 3 12 3-12 3 12 3-12 3 12 3" /></svg>);
    case "body":
      return (<svg {...s}><path d="M5 30v-6l5-2 6-8h15l7 8 5 2v6h-4M13 30h20" /><circle cx="10" cy="31" r="4" /><circle cx="37" cy="31" r="4" /><path d="M17 14l-3 8h22l-6-8" /></svg>);
    case "cooling":
      return (<svg {...s}><circle cx="24" cy="24" r="3" /><path d="M24 21c0-8 2-13 7-13 4 0 4 6-1 10M27 24c8 0 13 2 13 7 0 4-6 4-10-1M24 27c0 8-2 13-7 13-4 0-4-6 1-10M21 24c-8 0-13-2-13-7 0-4 6-4 10 1" /></svg>);
    case "wheels":
      return (<svg {...s}><circle cx="24" cy="24" r="18" /><circle cx="24" cy="24" r="11" /><circle cx="24" cy="24" r="3" /><path d="M24 13v8M24 27v8M13 24h8M27 24h8M16.2 16.2l5.7 5.7M26.1 26.1l5.7 5.7M31.8 16.2l-5.7 5.7M21.9 26.1l-5.7 5.7" /></svg>);
    case "interior":
      return (<svg {...s}><path d="M16 6h9a3 3 0 0 1 3 3l-2 18H14L13 9a3 3 0 0 1 3-3Z" /><path d="M12 27h20a4 4 0 0 1 4 4v3H12zM16 34v8M30 34v8" /></svg>);
    default:
      return (<svg {...s}><circle cx="24" cy="24" r="16" /></svg>);
  }
}
