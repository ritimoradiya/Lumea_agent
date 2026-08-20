"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals its children when they scroll into view, once.
 *
 * Uses IntersectionObserver rather than scroll listeners: the browser does
 * the work off the main thread, so a grid of twelve cards costs nothing.
 *
 * prefers-reduced-motion is honoured in CSS rather than here. Reading the
 * media query in the effect meant calling setState synchronously inside it,
 * which is exactly the cascading-render pattern React warns about — and it is
 * a presentational concern, so CSS is the right place for it anyway.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-revealed={shown ? "" : undefined}
      className={`reveal ${className ?? ""}`}
      style={
        {
          "--reveal-delay": `${delay}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
