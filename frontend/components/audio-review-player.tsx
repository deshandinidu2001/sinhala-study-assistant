"use client";
import { useEffect, useRef, useState } from "react";
import { api, apiUrl, type AudioReview } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { Icon } from "@/components/icon";

export type AudioOptions = { language: "si" | "en"; focus: string; length: string; include: string[]; provider: string };

export function AudioReviewPlayer({ documentId, options }: { documentId: string; options: AudioOptions }) {
  const { t } = useLanguage();
  const [review, setReview] = useState<AudioReview | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const generation = useRef<AbortController | null>(null);
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    const controller = new AbortController();
    setReview(null); setError(""); setChecking(true); setBusy(false);
    const value: AudioOptions = JSON.parse(optionsKey);
    const query = new URLSearchParams({ ...value, include: value.include.join(",") });
    api<{ audio: AudioReview | null }>(`/documents/${documentId}/audio-review?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setReview(result.audio); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => { controller.abort(); generation.current?.abort(); };
  }, [documentId, optionsKey]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = speed; }, [speed, review]);

  async function generate() {
    if (busy || checking) return;
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true); setError("");
    try {
      const result = await api<AudioReview>(`/documents/${documentId}/audio-review`, {
        method: "POST", body: optionsKey,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(150_000)]),
      });
      if (!controller.signal.aborted) setReview(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t("හඬ සමාලෝචනය සෑදිය නොහැක.", "Could not create the audio review."));
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <section className="audio-review tool-card" aria-label={t("හඬ සමාලෝචනය", "Audio Review")} aria-busy={busy || checking}>
    <div className="audio-review-heading"><span className="audio-review-icon"><Icon name="headphones" size={24} /></span><div><h3>{t("අසා මතක තබාගන්න", "Listen and revise")}</h3><p>{t("ඔබේ පාඩමේ සාරාංශය, හඬින්.", "Your study summary, read aloud.")}</p></div><span className="audio-language">{options.language === "si" ? "සිංහල" : "English"}</span></div>
    <p className="summary-hint">{t("හඬ සෑදීමට සාරාංශයේ අකුරු Google වෙත යවයි. මෙය AI හඬකි. කරුණු පහත මූලාශ්‍ර සමඟ පරීක්ෂා කරන්න. සුරැකි හඬ නැවත ඇසීමට සේවාව අවශ්‍ය නැත.", "Creating audio sends the summary text to Google. This is an AI voice; check facts using the sources below. Saved recordings replay without another generation request.")}</p>
    {checking && <p role="status">{t("සුරැකි හඬ පරීක්ෂා කරමින්…", "Checking for saved audio…")}</p>}
    {!checking && !review && <button className="primary-button" onClick={generate} disabled={busy}><Icon name="headphones" size={17} />{busy ? t("හඬ සකසමින්…", "Creating audio…") : t("හඬ සමාලෝචනය සාදන්න", "Create audio review")}</button>}
    {busy && <p className="thinking" role="status">{t("හඬ සෑදීමට මිනිත්තු දෙකක් පමණ ගත විය හැක.", "Audio generation may take up to two minutes.")}</p>}
    {error && <p className="notice error" role="alert">{t(error)}</p>}
    {review && <>
      <audio key={review.id} ref={audio} controls preload="metadata" src={apiUrl(review.url)} aria-label={t("පාඩමේ හඬ සමාලෝචනය", "Study audio review")}
        onLoadedMetadata={() => { if (audio.current) audio.current.playbackRate = speed; }}
        onError={() => setError(t("හඬ පූරණය කළ නොහැක. පිටුව නැවත පූරණය කරන්න හෝ ගොනුව බාගන්න.", "Could not load audio. Reload the page or download the recording."))} />
      <div className="audio-review-controls"><label>{t("කියවන වේගය", "Playback speed")}<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
        <a className="secondary-button" href={apiUrl(`${review.url}?download=true`)} download>{t("හඬ බාගන්න", "Download audio")} · WAV</a>
      </div>
      <details className="audio-transcript"><summary>{t("කියවන අකුරු බලන්න", "View narration script")}</summary><p lang={review.language}>{review.text}</p></details>
    </>}
  </section>;
}
