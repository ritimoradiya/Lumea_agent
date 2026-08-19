"use client";

import { useEffect, useRef } from "react";

/**
 * Gives the product a slow float and a tilt toward the cursor.
 *
 * The tilt is what sells it: a still image reads as a picture, whereas one
 * that responds to the pointer reads as an object sitting in space. Values
 * are deliberately small — past a few degrees it stops looking like a
 * photograph and starts looking like a toy.
 */
export default function FloatingProduct({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

    const onMove = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      tx = (e.clientX - (box.left + box.width / 2)) / box.width;
      ty = (e.clientY - (box.top + box.height / 2)) / box.height;
    };

    const loop = (t: number) => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      const bob = Math.sin(t * 0.0011) * 5;
      el.style.transform =
        `perspective(1000px) translateY(${bob}px) ` +
        `rotateY(${cx * 7}deg) rotateX(${-cy * 5}deg)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
