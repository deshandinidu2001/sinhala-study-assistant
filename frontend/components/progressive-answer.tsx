"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/language";

export function answerLines(text: string): string[] {
  const result: string[] = [];
  // Split at word boundaries so Sinhala vowel signs and conjuncts stay intact.
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph.trim()) { result.push(""); continue; }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (current.length + word.length > 85 && current) {
        result.push(current);
        current = "";
      }
      current = current ? `${current} ${word}` : word;
    }
    if (current) result.push(current);
  }
  if (result.at(-1) === "") result.pop();
  return result;
}

export function ProgressiveAnswer({ text, animate = false, onProgress, onComplete }: {
  text: string; animate?: boolean; onProgress?: () => void; onComplete?: () => void;
}) {
  const { t } = useLanguage();
  const lines = useMemo(() => answerLines(text), [text]);
  const [visible, setVisible] = useState(animate ? 0 : lines.length);
  const [reduced, setReduced] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacks = useRef({ onProgress, onComplete });
  callbacks.current = { onProgress, onComplete };
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(preference.matches);
    const update = () => setReduced(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!animate || reduced || !lines.length) {
      setVisible(lines.length);
      if (animate) callbacks.current.onComplete?.();
      return;
    }
    setVisible(0);
    const delay = Math.max(100, Math.min(480, 14_000 / lines.length));
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (lines[count - 1] === "") count += 1;
      setVisible(Math.min(count, lines.length));
      requestAnimationFrame(() => callbacks.current.onProgress?.());
      if (count >= lines.length) {
        clearInterval(timer);
        callbacks.current.onComplete?.();
      }
    }, delay);
    timerRef.current = timer;
    return () => { clearInterval(timer); timerRef.current = null; };
  }, [animate, reduced, lines]);
  const complete = !animate || reduced || visible >= lines.length;
  function showAll() { if (timerRef.current) clearInterval(timerRef.current); setVisible(lines.length); callbacks.current.onComplete?.(); }
  return <div className="progressive-answer" data-revealing={!complete}>
    <p className="sr-only">{text}</p>
    <div className="answer-lines" aria-hidden="true">{lines.slice(0, complete ? lines.length : visible).map((line, index) => <span className={`answer-line${!line ? " paragraph-gap" : ""}`} key={index}>{line || "\u00a0"}</span>)}{!complete && <span className="answer-cursor" />}</div>
    {!complete && <button type="button" className="reveal-button" onClick={showAll}>{t("සම්පූර්ණ පිළිතුර බලන්න", "Show full answer")}</button>}
  </div>;
}
