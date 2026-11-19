"use client";

import { useEffect, useRef } from "react";

export function Mascot({
  size = "small",
}: {
  size?: "small" | "large" | "medium";
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mascot = ref.current;
    if (!mascot) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pointer: { x: number; y: number } | null = null;
    let frame: number | null = null;

    function reset() {
      pointer = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      mascot!.style.removeProperty("--gaze-x");
      mascot!.style.removeProperty("--gaze-y");
    }

    function update() {
      frame = null;
      if (!pointer || reducedMotion.matches) return;

      const bounds = mascot!.getBoundingClientRect();
      const dx = pointer.x - (bounds.left + bounds.width / 2);
      const dy = pointer.y - (bounds.top + bounds.height / 2);
      // Scale with the mascot and ease toward the center as the cursor approaches.
      const distance = Math.max(Math.hypot(dx, dy), 180);
      const range = bounds.width * 0.085;
      mascot!.style.setProperty("--gaze-x", `${(dx / distance) * range}px`);
      mascot!.style.setProperty("--gaze-y", `${(dy / distance) * range}px`);
    }

    function scheduleUpdate() {
      if (pointer && !reducedMotion.matches && frame === null) {
        frame = requestAnimationFrame(update);
      }
    }

    function move(event: PointerEvent) {
      if (event.pointerType === "touch" || reducedMotion.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    }

    function leave(event: PointerEvent) {
      if (event.relatedTarget === null) reset();
    }

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    window.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    reducedMotion.addEventListener("change", reset);

    return () => {
      reset();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      reducedMotion.removeEventListener("change", reset);
    };
  }, []);

  return (
    <span ref={ref} aria-hidden="true" className={`mascot mascot-${size}`}>
      <i />
      <i />
    </span>
  );
}
