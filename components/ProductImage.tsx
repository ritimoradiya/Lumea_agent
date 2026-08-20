import Image from "next/image";
import { photoFor, type Product } from "@/lib/company";

/**
 * Product renderings, drawn rather than photographed.
 *
 * Modelled on how premium skincare actually presents itself — Aesop being the
 * clearest reference. Two things carry that look, and neither is detail:
 *
 * 1. Cylindrical shading. A dark edge where the surface turns away, a narrow
 *    specular band facing the light, and a rim light on the far side. A flat
 *    fill with an outline always reads as a diagram.
 * 2. A dominant label. On a real bottle the cream label covers a third of the
 *    height and carries a dense block of tiny ingredient text. That text block
 *    is the signature, so it is drawn as fine rules — at this scale real
 *    lettering would only be mud.
 *
 * All SVG: a few hundred bytes, resolution independent, no image pipeline.
 */

type Props = {
  product: Product;
  className?: string;
  /** Cards are small; drop the fine print but keep the brand mark. */
  compact?: boolean;
};

const DEFAULT_TINT = "#7d6f5c";

/** Break a product name into lines that fit across the bottle. */
function wrap(name: string, perLine = 18): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of name.split(" ")) {
    if ((current + " " + word).trim().length > perLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

/** Lighten or darken a hex colour by mixing toward white or black. */
function shift(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (to - c) * t);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/**
 * Which vessel a product comes in — by product name before category, because
 * a serum belongs in a dropper bottle whether or not it is filed under
 * Hydrate, and a serum drawn as a jar is immediately wrong to anyone who buys
 * skincare.
 */
function vesselFor(product: Product): keyof typeof VESSELS {
  const name = product.name.toLowerCase();
  if (/serum|concentrate/.test(name)) return "dropper";
  if (/balm|cream/.test(name)) return "jar";
  if (/cleanser|wash/.test(name)) return "pump";
  if (/spf|sunscreen|tinted/.test(name)) return "tube";
  if (/toner|mist|essence/.test(name)) return "tall";
  return (
    ({ Cleanse: "pump", Treat: "dropper", Hydrate: "jar", Protect: "tube" } as const)[
      product.category as "Cleanse" | "Treat" | "Hydrate" | "Protect"
    ] ?? "dropper"
  );
}

/**
 * Geometry. Each vessel has a neck the cap sits over, drawn in the order
 * neck → body → cap so the cap always overlaps cleanly instead of floating
 * above a gap.
 *
 * Keys are `width`/`height`, not `w`/`h`: these objects are spread directly
 * onto <rect>, and abbreviating them silently produced zero-size rectangles —
 * the cap disappeared entirely with no error anywhere.
 */
const VESSELS = {
  dropper: {
    body: "M74 120q0-9 9-11h34q9 2 9 11v76q0 9-9 9H83q-9 0-9-9z",
    neck: { x: 92, y: 100, width: 16, height: 24 },
    cap: { x: 86, y: 72, width: 28, height: 32, rx: 3 },
    pipette: true,
    label: { y: 138, h: 52 },
  },
  jar: {
    body: "M58 136q0-8 8-8h68q8 0 8 8v52q0 9-9 9H67q-9 0-9-9z",
    neck: { x: 66, y: 122, width: 68, height: 18 },
    cap: { x: 54, y: 104, width: 92, height: 26, rx: 4 },
    label: { y: 146, h: 36 },
  },
  pump: {
    body: "M64 116q0-10 9-12l9-2h36l9 2q9 2 9 12v78q0 9-9 9H73q-9 0-9-9z",
    neck: { x: 92, y: 96, width: 16, height: 24 },
    cap: { x: 84, y: 64, width: 32, height: 34, rx: 4 },
    spout: true,
    label: { y: 132, h: 50 },
  },
  tube: {
    body: "M80 114h40l6 78q1 11-10 11H84q-11 0-10-11z",
    neck: { x: 92, y: 98, width: 16, height: 20 },
    cap: { x: 85, y: 74, width: 30, height: 26, rx: 4 },
    label: { y: 130, h: 46 },
  },
  tall: {
    body: "M76 104q0-8 8-10h32q8 2 8 10v90q0 9-9 9H85q-9 0-9-9z",
    neck: { x: 92, y: 84, width: 16, height: 24 },
    cap: { x: 87, y: 58, width: 26, height: 28, rx: 3 },
    label: { y: 124, h: 56 },
  },
} as const;

/** Horizontal stops that turn a flat shape into a lit cylinder. */
function Cylinder({ id, base }: { id: string; base: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={shift(base, -0.4)} />
      <stop offset="8%" stopColor={shift(base, -0.16)} />
      <stop offset="24%" stopColor={shift(base, 0.16)} />
      <stop offset="32%" stopColor={shift(base, 0.52)} />
      <stop offset="40%" stopColor={shift(base, 0.14)} />
      <stop offset="66%" stopColor={shift(base, -0.14)} />
      <stop offset="86%" stopColor={shift(base, -0.42)} />
      {/* Rim light: the far edge catches the backdrop, so it is not the darkest point. */}
      <stop offset="96%" stopColor={shift(base, 0.1)} />
      <stop offset="100%" stopColor={shift(base, -0.34)} />
    </linearGradient>
  );
}

export default function ProductImage({ product, className, compact }: Props) {
  // A real photograph beats any drawing, so use one the moment it exists.
  const photo = photoFor(product.id);
  if (photo) {
    /**
     * `fill` positions the image against its container, so the container must
     * have a height. An SVG carries its own aspect ratio from the viewBox and
     * needs none, which is why the drawings rendered at any width and the
     * photographs silently collapsed to nothing on the detail page — it passes
     * a width but no height.
     *
     * So supply a square aspect unless the caller has already given a height.
     */
    const sized = /(?:^|\s)(?:h-|aspect-)/.test(className ?? "");
    return (
      <div
        className={`relative overflow-hidden ${sized ? "" : "aspect-square"} ${className ?? ""}`}
      >
        <Image
          src={photo}
          alt={`${product.name}, ${product.category}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
          className="object-cover"
          priority={!compact}
        />
      </div>
    );
  }

  const uid = product.id.replace(/[^a-z0-9]/gi, "");
  const tint = product.tint ?? DEFAULT_TINT;
  const v = VESSELS[vesselFor(product)];
  const size = product.details?.Size ?? "";

  // Fine rules standing in for the ingredient block. Real type at this scale
  // is illegible mush; rules read correctly as dense small print.
  const rules = compact ? 0 : Math.max(0, Math.floor((v.label.h - 44) / 3.6));

  return (
    <svg
      viewBox="0 0 200 250"
      className={className}
      role="img"
      aria-label={`${product.name}, ${product.category}`}
    >
      <defs>
        <Cylinder id={`b${uid}`} base={tint} />
        <Cylinder id={`c${uid}`} base="#211f1c" />
        <Cylinder id={`n${uid}`} base={shift(tint, -0.12)} />
        <Cylinder id={`l${uid}`} base="#efe9dc" />

        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7f3ec" />
          <stop offset="100%" stopColor="#eae3d6" />
        </linearGradient>

        <linearGradient id={`f${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity=".22" />
          <stop offset="30%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#2b2418" stopOpacity=".2" />
        </linearGradient>

        <radialGradient id={`s${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4a3d24" stopOpacity=".34" />
          <stop offset="60%" stopColor="#4a3d24" stopOpacity=".08" />
          <stop offset="100%" stopColor="#4a3d24" stopOpacity="0" />
        </radialGradient>

        <clipPath id={`cl${uid}`}>
          <path d={v.body} />
        </clipPath>
        <filter id={`sf${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <rect width="200" height="250" rx="10" fill={`url(#bg${uid})`} />
      <ellipse cx="100" cy="207" rx="52" ry="9" fill={`url(#s${uid})`} />

      <g transform="translate(0,-6)">
        {/* Pipette stem, visible above a dropper cap. */}
        {"pipette" in v && v.pipette && (
          <rect x="97.5" y="60" width="5" height="16" rx="2.5" fill="#211f1c" opacity=".5" />
        )}
        {/* Pump spout. */}
        {"spout" in v && v.spout && (
          <path
            d="M100 64V54h14a5 5 0 0 1 5 5v5"
            stroke="#211f1c"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        )}

        <rect {...v.neck} fill={`url(#n${uid})`} />
        <path d={v.body} fill={`url(#b${uid})`} />
        <path d={v.body} fill={`url(#f${uid})`} />

        {/* Specular reflections, drawn BEFORE the label so print sits on top.
            They travel with --spin: on a rotating cylinder the highlight moves
            across the surface rather than staying put. */}
        <g
          clipPath={`url(#cl${uid})`}
          style={{
            transform: "translateX(calc(var(--spin, 0) * 13px))",
            transition: "transform .05s linear",
          }}
        >
          <rect x="79" y="112" width="6.5" height="96" rx="3.2" fill="#fff" opacity=".42" filter={`url(#sf${uid})`} />
          <rect x="130" y="120" width="3" height="80" rx="1.5" fill="#fff" opacity=".2" filter={`url(#sf${uid})`} />
        </g>

        {/* The label — dominant, as on a real bottle. It compresses and
            slides as the bottle turns, which is what actually sells the
            rotation; a flat skew alone reads as a tilted picture. */}
        <g
          clipPath={`url(#cl${uid})`}
          style={{
            transform:
              "translateX(calc(var(--spin, 0) * 9px)) scaleX(var(--spin-flat, 1))",
            transformOrigin: "100px center",
            transition: "transform .05s linear",
          }}
        >
          <rect x="44" y={v.label.y} width="112" height={v.label.h} fill={`url(#l${uid})`} />
          <text
            x="100"
            y={v.label.y + (compact ? v.label.h / 2 + 4 : 13)}
            textAnchor="middle"
            fontSize={compact ? 11 : 7.6}
            letterSpacing={compact ? 3.4 : 2.4}
            fill="#221f19"
            fontFamily="-apple-system, sans-serif"
            fontWeight="500"
          >
            LUMEA
          </text>

          {!compact && (
            <>
              {/* Wrapped, because a full product name is wider than the
                  bottle at any legible size. */}
              {wrap(product.name).map((line, i) => (
                <text
                  key={i}
                  x="100"
                  y={v.label.y + 22 + i * 6}
                  textAnchor="middle"
                  fontSize="4.6"
                  letterSpacing=".2"
                  fill="#221f19"
                  fontFamily="-apple-system, sans-serif"
                >
                  {line}
                </text>
              ))}
              {/* Dense small print, as fine rules. */}
              {Array.from({ length: rules }).map((_, i) => (
                <line
                  key={i}
                  x1={i % 3 === 2 ? 68 : 60}
                  y1={v.label.y + 36 + i * 3.6}
                  x2={i % 3 === 1 ? 132 : 140}
                  y2={v.label.y + 36 + i * 3.6}
                  stroke="#221f19"
                  strokeOpacity=".3"
                  strokeWidth="1.1"
                />
              ))}
              {size && (
                <text
                  x="100"
                  y={v.label.y + v.label.h - 5}
                  textAnchor="middle"
                  fontSize="5"
                  letterSpacing="1.1"
                  fill="#5d564a"
                  fontFamily="-apple-system, sans-serif"
                >
                  {size.toUpperCase()}
                </text>
              )}
            </>
          )}
        </g>

        {/* Cap last, so it always sits over the neck. */}
        <rect {...v.cap} fill={`url(#c${uid})`} />
        {/* Shadow the cap casts onto the shoulder below it. */}
        <rect
          x={v.cap.x}
          y={v.cap.y + v.cap.height - 3}
          width={v.cap.width}
          height="3"
          fill="#000"
          opacity=".28"
        />
      </g>
    </svg>
  );
}
