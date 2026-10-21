"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * 3D depth wrapper for interactive cards (styles: `.tilt*` in globals.css).
 *
 * Mouse/pen pointers tilt the card and drive its parallax layers through three
 * CSS variables on the wrapper: --px/--py (pointer position, -1..1) and --a
 * (hover amount, 0..1). Values ease towards their target in a rAF loop that
 * stops once settled, so nothing re-renders and nothing runs at rest.
 * Touch pointers are ignored (scrolling stays native); touch gets CSS press
 * feedback instead. Cards below the fold fade in once when first scrolled to.
 * Everything is skipped under prefers-reduced-motion.
 */
export function TiltCard({ children, index = 0, className = "" }: { children: ReactNode; index?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cur = { x: 0, y: 0, a: 0 };
    const target = { x: 0, y: 0, a: 0 };
    let frame = 0;
    let last = 0;

    const write = () => {
      el.style.setProperty("--px", cur.x.toFixed(4));
      el.style.setProperty("--py", cur.y.toFixed(4));
      el.style.setProperty("--a", cur.a.toFixed(4));
    };
    const step = (now: number) => {
      // Frame-rate independent easing (same feel at 60 and 120 Hz).
      const k = 1 - Math.pow(1 - 0.16, Math.min(64, now - (last || now - 16.7)) / 16.7);
      last = now;
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      cur.a += (target.a - cur.a) * k;
      const settled = Math.abs(target.x - cur.x) < 0.002 && Math.abs(target.y - cur.y) < 0.002 && Math.abs(target.a - cur.a) < 0.002;
      if (settled) Object.assign(cur, target);
      write();
      if (settled) {
        frame = 0;
        last = 0;
        if (cur.a === 0) el.removeAttribute("data-active");
      } else frame = requestAnimationFrame(step);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      target.a = 1;
      el.setAttribute("data-active", "");
      kick();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      Object.assign(target, { x: 0, y: 0, a: el.contains(document.activeElement) && document.activeElement?.matches(":focus-visible") ? 1 : 0 });
      kick();
    };
    // Keyboard focus lifts the card flat (no tilt) so the focus ring stays readable.
    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target as Element).matches(":focus-visible")) return;
      Object.assign(target, { x: 0, y: 0, a: 1 });
      el.setAttribute("data-active", "");
      kick();
    };
    const onFocusOut = () => {
      if (!el.matches(":hover")) Object.assign(target, { x: 0, y: 0, a: 0 });
      kick();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);

    // Entrance: only for cards that start below the fold, so visible content never flashes.
    let io: IntersectionObserver | undefined;
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.setAttribute("data-reveal", "pending");
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          el.setAttribute("data-reveal", "shown");
          io?.disconnect();
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      io.observe(el);
    }

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      if (frame) cancelAnimationFrame(frame);
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={`tilt ${className}`} style={{ "--i": index % 3 } as CSSProperties}>
      <span aria-hidden className="tilt-shadow" />
      {children}
    </div>
  );
}
