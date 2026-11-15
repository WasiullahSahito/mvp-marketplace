// Generated placeholder (no real photos): a simple bed drawing tinted with the chosen colour.
// `view` picks which part of the drawing is zoomed, so the 5 gallery images look different.
const VIEWBOXES = ["0 0 400 300", "-40 20 400 300", "60 0 200 150", "40 120 240 180", "120 60 160 120"];
const CAPTIONS = ["Front view", "Side view", "Headboard", "Drawers", "Detail"];

export function PlaceholderImage({
  hex,
  view = 0,
  title = "Prague Divan Bed",
  className = "",
}: {
  hex: string;
  view?: number;
  title?: string;
  className?: string;
}) {
  const i = view % VIEWBOXES.length;
  return (
    <svg
      viewBox={VIEWBOXES[i]}
      className={className}
      role="img"
      aria-label={`${title} – ${CAPTIONS[i]}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect x="-100" y="-100" width="700" height="600" fill="#ece9e4" />
      <rect x="-100" y="235" width="700" height="200" fill="#d9d3ca" />
      {/* headboard */}
      <rect x="70" y="60" width="260" height="110" rx="8" fill={hex} />
      <rect x="70" y="60" width="260" height="110" rx="8" fill="#000" opacity="0.12" />
      {/* mattress */}
      <rect x="55" y="150" width="290" height="45" rx="10" fill="#fdfcfb" stroke="#cfc9c0" />
      {/* base */}
      <rect x="55" y="190" width="290" height="55" rx="6" fill={hex} />
      <rect x="70" y="203" width="120" height="30" rx="3" fill="#000" opacity="0.14" />
      <rect x="210" y="203" width="120" height="30" rx="3" fill="#000" opacity="0.14" />
      {/* feet */}
      <rect x="70" y="245" width="14" height="12" fill="#6b5b4b" />
      <rect x="316" y="245" width="14" height="12" fill="#6b5b4b" />
      <text x="200" y="285" textAnchor="middle" fontSize="12" fill="#6b645b">
        {title} · {CAPTIONS[i]}
      </text>
    </svg>
  );
}
