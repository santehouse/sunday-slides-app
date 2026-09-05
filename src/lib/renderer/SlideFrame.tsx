"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./types";

/**
 * Client-only scaling wrapper: measures its own box with a `ResizeObserver` and scales a
 * fixed 1920×1080 child down (or up) via CSS `transform`, preserving 16:9 regardless of
 * the container's aspect ratio. Use around `<SlideCanvas />` anywhere it's shown at less
 * than full resolution (Sunday Flow cards, Slide Editor preview, template thumbnails).
 */
export function SlideFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / SLIDE_WIDTH, height / SLIDE_HEIGHT));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
