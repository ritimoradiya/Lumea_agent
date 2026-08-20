"use client";

import { useState } from "react";
import SpinViewer from "./SpinViewer";
import type { Product } from "@/lib/company";

/**
 * Switches between the photograph and the turnable drawing.
 *
 * The photograph is the default because it is more convincing, but it cannot
 * rotate — a flat image turned past twenty degrees is just the edge of a
 * picture. Only the drawing can be redrawn at an arbitrary angle, so a full
 * turn means showing the drawing and saying so.
 *
 * The photo itself is rendered on the server and handed in as a child, which
 * keeps the filesystem lookup out of this client component.
 */
export default function ProductViewer({
  product,
  photo,
}: {
  product: Product;
  photo: React.ReactNode;
}) {
  const [spinning, setSpinning] = useState(false);

  return (
    <div>
      <div className="relative">
        {spinning ? (
          <SpinViewer product={product} className="w-full" />
        ) : (
          photo
        )}
      </div>

      <div className="mt-4 flex items-center gap-1.5">
        {(
          [
            [false, "Photo"],
            [true, "Turn it"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            onClick={() => setSpinning(value)}
            aria-pressed={spinning === value}
            className={`rounded-full px-4 py-2 text-[12.5px] transition-colors duration-300 ${
              spinning === value
                ? "bg-ink text-paper"
                : "border hairline text-muted hover:bg-paper-2"
            }`}
          >
            {label}
          </button>
        ))}
        {spinning && (
          <span className="ml-2 text-[11.5px] text-faint">
            An illustration — a photograph cannot turn.
          </span>
        )}
      </div>
    </div>
  );
}
