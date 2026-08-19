"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals its children when they scroll into view, once.
 *
 * Uses IntersectionObserver rather than scroll listeners: the browser does
 * the work off the main thread, so a grid of twelve cards costs nothing.
 * Respects prefers-reduced-motion by showing everything immediately.
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
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
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(22px)",
        transition: `opacity .8s var(--ease-spring) ${delay}ms, transform .8s var(--ease-spring) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
