"use client";

import { useEffect, useRef } from "react";

/**
 * Tilts the product toward the cursor, with a slow float underneath.
 *
 * A subtle tilt, nothing more. A flat image cannot be turned — past about ten
 * degrees you are looking at the edge of a picture — so this stays within a
 * range that reads as an object catching the light rather than a photograph
 * being skewed.
 */
export default function FloatingProduct({
  children,
  className,
  /**
   * Only react while the pointer is over this element. Without it, twelve
   * bottles on a grid all tilt in unison to a cursor nowhere near them, which
   * looks like a glitch rather than an interaction.
   */
  hoverOnly = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    let active = !hoverOnly;

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const box = el.getBoundingClientRect();
      tx = (e.clientX - (box.left + box.width / 2)) / box.width;
      ty = (e.clientY - (box.top + box.height / 2)) / box.height;
    };

    const onEnter = () => { active = true; };
    const onLeave = () => { active = false; tx = 0; ty = 0; };
    if (hoverOnly) {
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
    }

    const loop = (t: number) => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      const bob = hoverOnly ? 0 : Math.sin(t * 0.0011) * 5;
      const tilt = Math.max(-1, Math.min(1, cx * 2));

      el.style.transform =
        `perspective(1000px) translateY(${bob}px) ` +
        `rotateY(${tilt * 7}deg) rotateX(${-cy * 4}deg)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [hoverOnly]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
