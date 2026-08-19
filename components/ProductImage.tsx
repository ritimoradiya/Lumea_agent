/**
 * Product illustrations, drawn rather than photographed.
 *
 * No photography budget and no stock-photo look: a flat editorial silhouette
 * per category, which reads as a deliberate brand choice rather than as a
 * missing asset. Being SVG they are a few hundred bytes, scale to any size,
 * and need no image pipeline.
 *
 * The silhouette comes from the category, so a new product picks up the right
 * vessel automatically.
 */

type Props = {
  category: string;
  /** Used to vary tint and proportion slightly, so twelve cards don't look stamped. */
  seed: string;
  className?: string;
};

/** Deterministic small integer from the product id. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

const VESSELS: Record<string, (id: string) => React.ReactNode> = {
  // Tall pump bottle.
  Cleanse: (id) => (
    <>
      <rect x="66" y="96" width="68" height="118" rx="10" fill={`url(#g-${id})`} />
      <rect x="86" y="76" width="28" height="22" rx="3" fill="#3a362e" />
      <path d="M100 76V64h16a6 6 0 0 1 6 6v6" stroke="#3a362e" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="74" y="140" width="52" height="44" rx="3" fill="#faf8f5" opacity=".72" />
    </>
  ),
  // Dropper bottle with a pipette cap.
  Treat: (id) => (
    <>
      <rect x="74" y="112" width="52" height="102" rx="9" fill={`url(#g-${id})`} />
      <rect x="90" y="86" width="20" height="28" rx="2.5" fill="#3a362e" />
      <rect x="97" y="60" width="6" height="28" rx="3" fill="#3a362e" opacity=".55" />
      <rect x="81" y="148" width="38" height="38" rx="2.5" fill="#faf8f5" opacity=".72" />
    </>
  ),
  // Wide squat jar.
  Hydrate: (id) => (
    <>
      <rect x="58" y="132" width="84" height="82" rx="12" fill={`url(#g-${id})`} />
      <rect x="52" y="112" width="96" height="24" rx="7" fill="#3a362e" />
      <rect x="70" y="158" width="60" height="34" rx="3" fill="#faf8f5" opacity=".72" />
    </>
  ),
  // Tapered tube with a flip cap.
  Protect: (id) => (
    <>
      <path d="M80 108h40l8 88a10 10 0 0 1-10 11H82a10 10 0 0 1-10-11l8-88Z" fill={`url(#g-${id})`} />
      <rect x="86" y="88" width="28" height="22" rx="3" fill="#3a362e" />
      <rect x="80" y="146" width="40" height="40" rx="3" fill="#faf8f5" opacity=".72" />
    </>
  ),
};

export default function ProductImage({ category, seed, className }: Props) {
  const id = hash(seed).toString(36).slice(0, 6);
  const n = hash(seed);

  // Two tints, alternating deterministically: warm stone and a sage-leaning
  // stone, so a grid of twelve has rhythm without looking random.
  const warm = n % 2 === 0;
  const from = warm ? "#e3d9c8" : "#d8ddcd";
  const to = warm ? "#c9bca6" : "#bcc6ae";

  const draw = VESSELS[category] ?? VESSELS.Treat;

  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      role="img"
      aria-label={`${category} product illustration`}
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`bg-${id}`} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#f3eee5" />
          <stop offset="100%" stopColor="#e9e2d6" />
        </radialGradient>
        <radialGradient id={`sh-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8a7a5c" stopOpacity=".26" />
          <stop offset="100%" stopColor="#8a7a5c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="200" height="240" rx="10" fill={`url(#bg-${id})`} />
      <ellipse cx="100" cy="216" rx="46" ry="9" fill={`url(#sh-${id})`} />
      {draw(id)}
    </svg>
  );
}
