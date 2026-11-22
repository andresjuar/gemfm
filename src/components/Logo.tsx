// gem.fm logo: faceted gem with a music note, plus the "gem.fm" wordmark.

export function GemMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg width={size * 1.25} height={size} viewBox="0 0 80 64" role={title ? 'img' : undefined}
      aria-label={title} aria-hidden={title ? undefined : true} className="gem-mark">
      <defs>
        <linearGradient id="gem-note" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E36BC0" />
          <stop offset="1" stopColor="#9B5BD6" />
        </linearGradient>
      </defs>
      {/* Crown */}
      <polygon points="13,12 2,26 19,26" fill="#F59AC9" />
      <polygon points="13,12 30,12 19,26" fill="#F7B6DA" />
      <polygon points="30,12 19,26 41,26" fill="#EC5FA8" />
      <polygon points="30,12 47,12 41,26" fill="#C04BB0" />
      <polygon points="47,12 41,26 58,26" fill="#8E44AD" />
      {/* Pavilion */}
      <polygon points="2,26 19,26 30,60" fill="#D63A8C" />
      <polygon points="19,26 41,26 30,60" fill="#EE5BA6" />
      <polygon points="41,26 58,26 30,60" fill="#6E3AA0" />
      {/* Music note, outlined in the background colour so it reads on top of the gem */}
      <g stroke="var(--logo-ring, #120E1A)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
        <path d="M62 46 q5 -5 10 0 t8 -1" fill="none" stroke="url(#gem-note)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M60 52 q6 -4 11 0 t7 -1" fill="none" stroke="url(#gem-note)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M57 46 L63 4 L66 4 Q66 12 72 17 Q77 22 71 29 Q72 21 64 17 L59 50 Z" fill="url(#gem-note)" />
        <ellipse cx="51" cy="50" rx="8.5" ry="6.5" transform="rotate(-22 51 50)" fill="url(#gem-note)" />
      </g>
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <GemMark size={size * 1.1} />
      <span className="wordmark">gem<span>.fm</span></span>
    </span>
  );
}
