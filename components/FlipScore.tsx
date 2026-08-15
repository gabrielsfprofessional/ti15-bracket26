"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a series score and flips it when the number actually changes.
 *
 * The poll in TournamentView replaces the whole tournament object every 60s, so
 * a plain re-render gives no signal that anything moved. This watches the value
 * itself and animates only on a real transition — never on mount, never on a
 * poll that returned the same score.
 *
 * The number is always in the DOM and always readable; the animation decorates
 * it and cannot delay or obscure access to the data.
 */
export function FlipScore({ value, className = "" }: { value: number; className?: string }) {
  const previous = useRef(value);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlipping(true);
    const id = window.setTimeout(() => setFlipping(false), 500);
    return () => window.clearTimeout(id);
  }, [value]);

  return (
    <span className={`flip-score ${className}`.trim()} data-flipping={flipping ? "true" : "false"}>
      {value}
    </span>
  );
}
