"use client";

import { useEffect, useRef, useState } from "react";

const sentences = [
  "LaporKUY! Laporkan kerusakan infrastruktur. Pantau sampai tuntas.",
  "Satu langkah kecilmu, berarti untuk perjalanan banyak orang.",
];

export function HeroTypewriter() {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [frame, setFrame] = useState({
    sentence: 0,
    length: sentences[0].length,
    deleting: false,
  });
  const [animated, setAnimated] = useState(false),
    [running, setRunning] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    const update = () => {
      setAnimated(!media.matches);
      setRunning(!media.matches && !document.hidden && inView);
    };
    const observer = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? false;
      update();
    });
    if (paragraph.current) observer.observe(paragraph.current);
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    const complete = frame.length === sentences[frame.sentence].length;
    const delay = frame.deleting
      ? frame.length === 0
        ? 300
        : 28
      : complete
        ? 2400
        : 55;
    const timer = setTimeout(
      () =>
        setFrame((previous) => {
          if (previous.deleting && previous.length === 0)
            return {
              sentence: (previous.sentence + 1) % sentences.length,
              length: 0,
              deleting: false,
            };
          if (
            !previous.deleting &&
            previous.length === sentences[previous.sentence].length
          )
            return { ...previous, deleting: true };
          return {
            ...previous,
            length: previous.length + (previous.deleting ? -1 : 1),
          };
        }),
      delay,
    );
    return () => clearTimeout(timer);
  }, [frame, running]);
  return (
    <p
      ref={paragraph}
      className="hero-typewriter"
      data-animated={animated}
      data-running={running}
    >
      <span className="sr-only">{sentences.join(" ")}</span>
      <span className="hero-typewriter-static" aria-hidden="true">
        {sentences[0]}
        <br className="desktop-break" /> {sentences[1]}
      </span>
      {animated && (
        <span className="hero-typewriter-live" aria-hidden="true">
          {sentences[frame.sentence].slice(0, frame.length)}
          <span className="hero-typewriter-caret" />
        </span>
      )}
    </p>
  );
}
