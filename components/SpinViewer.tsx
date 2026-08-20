"use client";

import { useEffect, useRef, useState } from "react";
import ProductDrawing from "./ProductDrawing";
import type { Product } from "@/lib/company";

/**
 * Drag to turn the bottle a full circle.
 *
 * This works because a bottle is a shape of revolution: its silhouette is the
 * same from every angle, so a genuine 360° rotation is entirely a matter of
 * moving the printed label — sliding it across the face, foreshortening it at
 * the edge, and taking it round the back. No second image and no 3D geometry.
 *
 * Momentum on release, and a slow drift when untouched so it reads as
 * interactive without being asked.
 */
export default function SpinViewer({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Refs, not state: these change every frame and nothing renders from them
  // directly, so keeping them out of React avoids a re-render per pointer move.
  const velocity = useRef(0);
  const lastX = useRef(0);
  const held = useRef(false);

  useEffect(() => {
    let raf = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      setAngle((a) => {
        if (held.current) return a;
        // Friction on the throw, and a gentle idle drift underneath so it is
        // visibly a thing you can turn.
        velocity.current *= 0.94;
        const drift = Math.abs(velocity.current) < 0.0015 ? 0.0045 : 0;
        return a + velocity.current + drift;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!held.current) return;
      const width = box.current?.clientWidth ?? 400;
      // A full drag across the element is roughly one and a half turns, which
      // feels neither sticky nor twitchy.
      const delta = ((e.clientX - lastX.current) / width) * Math.PI * 3;
      lastX.current = e.clientX;
      velocity.current = delta;
      setAngle((a) => a + delta);
    };

    const onUp = () => {
      held.current = false;
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      ref={box}
      onPointerDown={(e) => {
        held.current = true;
        lastX.current = e.clientX;
        velocity.current = 0;
        setDragging(true);
      }}
      className={`relative touch-none select-none ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      } ${className ?? ""}`}
    >
      <ProductDrawing product={product} angle={angle} className="w-full" />

      <span
        className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2
                    rounded-full bg-ink/70 px-3 py-1 text-[11px] tracking-wide
                    text-paper backdrop-blur-sm transition-opacity duration-500
                    ${dragging ? "opacity-0" : "opacity-100"}`}
      >
        Drag to turn
      </span>
    </div>
  );
}
