// brainmux "Signal" logo family — one system, per-tool accent + glyph.
// Source of truth mirrors /brand/*.svg. Used across the landing page.
type MarkProps = { size?: number };

export function BrainmuxMark({ size = 28 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="#4FD1C5" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 16H13" /><path d="M15 16 27 7" /><path d="M15 16H27" /><path d="M15 16 27 25" />
      </g>
      <g fill="#4FD1C5">
        <circle cx="5" cy="16" r="2.2" /><circle cx="15" cy="16" r="3.1" />
        <circle cx="27" cy="7" r="2.4" /><circle cx="27" cy="16" r="2.4" /><circle cx="27" cy="25" r="2.4" />
      </g>
    </svg>
  );
}

export function LlmproxyMark({ size = 28 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="#E8B341" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 11.5H24" /><path d="M21 8.5 24 11.5 21 14.5" />
        <path d="M24 20.5H8" /><path d="M11 17.5 8 20.5 11 23.5" />
      </g>
    </svg>
  );
}

export function GraphmuxMark({ size = 28 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="#8B8CF9" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 16 9 10" /><path d="M16 16 24 9" /><path d="M16 16 8.5 24" /><path d="M16 16 24 23" /><path d="M9 10 24 9" />
      </g>
      <g fill="#8B8CF9">
        <circle cx="16" cy="16" r="3" /><circle cx="9" cy="10" r="2.3" /><circle cx="24" cy="9" r="2.3" />
        <circle cx="8.5" cy="24" r="2.3" /><circle cx="24" cy="23" r="2.3" />
      </g>
    </svg>
  );
}
