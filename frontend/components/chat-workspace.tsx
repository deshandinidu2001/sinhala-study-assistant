"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Chat } from "@/lib/api";
import { useDocuments } from "@/lib/use-documents";
import { Icon } from "@/components/icon";
import { SourceLink } from "@/components/source-link";

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: { transcript: string }[][] }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function ChatWorkspace() {
  const params = useSearchParams();
  const { documents, loading, error: documentsError } = useDocuments();
  const [selected, setSelected] = useState(params.get("document") ?? "");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const answerEnd = useRef<HTMLDivElement>(null);
  const ready = documents.filter(d => d.status === "ready");
  const subjects = [...new Set(ready.map(d => d.subject))].sort();
  const validSelected = ready.some(d => d.id === selected) ? selected : "";
  useEffect(() => { setSelected(params.get("document") ?? ""); }, [params]);
  useEffect(() => {
    const controller = new AbortController(); setHistoryLoading(true); setHistoryError("");
    api<Chat[]>("/chats", { signal: controller.signal }).then(history => {
      setChats(current => [...new Map([...history, ...current].map(chat => [chat.id, chat])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    }).catch(failure => { if (!controller.signal.aborted) setHistoryError(failure.message); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { const voiceWindow = window as VoiceWindow; setVoiceSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition)); return () => recognition.current?.abort(); }, []);
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || !question.trim()) return;
    recognition.current?.abort(); setBusy(true); setError("");
    try {
      const chat = await api<Chat>("/chat", { method: "POST", body: JSON.stringify({ question: question.trim(), subject: subject || null, document_id: validSelected || null }) });
      setChats(previous => [...previous, chat]); setQuestion("");
      requestAnimationFrame(() => answerEnd.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "පිළිතුර ලබාගත නොහැක."); }
    finally { setBusy(false); }
  }
  function voice() {
    if (listening) { recognition.current?.stop(); return; }
    const voiceWindow = window as VoiceWindow;
    const Constructor = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    const instance = new Constructor(); recognition.current = instance;
    instance.lang = "si-LK"; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => { const transcript = event.results[0]?.[0]?.transcript; if (transcript) { setQuestion(previous => `${previous} ${transcript}`.trim().slice(0, 2000)); setVoiceNotice("ඇසුණු ප්‍රශ්නය පහත පෙනේ. නිවැරදි කර යවන්න."); } };
    instance.onerror = event => { setListening(false); setVoiceNotice(event.error === "not-allowed" ? "මයික්‍රෆෝන අවසරය නොලැබිණි. ප්‍රශ්නය ලියන්න හෝ බ්‍රවුසරයේ අවසර පරීක්ෂා කරන්න." : "හඬ හඳුනාගත නොහැකි විය. නැවත උත්සාහ කරන්න හෝ ප්‍රශ්නය ලියන්න."); };
    instance.onend = () => setListening(false);
    try { setListening(true); setVoiceNotice("සවන් දෙමින්… සිංහලෙන් කතා කරන්න."); instance.start(); }
    catch { setListening(false); setVoiceNotice("හඬ ආරම්භ කළ නොහැක. ප්‍රශ්නය ලියන්න."); }
  }
  return <div className="overview tool-page chat-page">
    <div className="page-intro"><p className="welcome">මූලාශ්‍රය සමඟ තේරුම් ගන්න</p><h1>ප්‍රශ්න හා පිළිතුරු</h1><p>ඔබේ පාඩමේ ප්‍රධාන වචන භාවිතයෙන් ප්‍රශ්නය අසන්න. අදාළ කොටස සහ එය හමු වූ පිටුව බලන්න.</p></div>
    <p className="notice mode-note">දැනට පිළිතුරු ලෙස ඔබේ ලේඛනවල අදාළ කොටස් උපුටා පෙන්වයි. අලුත් පැහැදිලි කිරීම් නිපදවන AI සේවාවක් සම්බන්ධ කර නැත.</p>
    {documentsError && <p className="notice error" role="alert">{documentsError}</p>}
    {!loading && ready.length === 0 && <div className="empty-state compact"><Icon name="book" size={30} /><h2>ප්‍රශ්න අහන්න, පළමුව පාඩමක් එක් කරන්න</h2><p>ඔබේ ලේඛන සූදානම් වූ පසු ඒවා ඇසුරින් පිළිතුරු ලබාගත හැක.</p><Link href="/documents" className="primary-button">ලේඛනයක් එක් කරන්න</Link></div>}
    <div className="scope-bar"><label>විෂය<select value={subject} onChange={e => { setSubject(e.target.value); setSelected(""); }} disabled={busy}><option value="">සියලු විෂයන්</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label>ලේඛනය<select value={validSelected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">සියලු සූදානම් ලේඛන</option>{ready.filter(d => !subject || d.subject === subject).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></div>
    <section className="chat-thread" aria-label="ප්‍රශ්න හා පිළිතුරු ඉතිහාසය" aria-live="polite">
      {historyLoading && <p role="status">පෙර ප්‍රශ්න ලබාගනිමින්…</p>}{historyError && <div className="notice error" role="alert"><p>{historyError}</p><button className="text-button" onClick={() => setAttempt(n => n + 1)}>නැවත උත්සාහ කරන්න</button></div>}
      {!historyLoading && !chats.length && ready.length > 0 && <div className="empty-state"><Icon name="chat" size={36} /><h2>පාඩමේ අපැහැදිලි තැනක් තිබේද?</h2><p>පහතින් ප්‍රශ්නය ලියන්න. උදා: “ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?”<br />ඔබ එක් කළ සටහනට අදාළ ප්‍රශ්නයක් අසන්න.</p></div>}
      {chats.map(chat => <article className="chat-exchange" key={chat.id}><div className="question-bubble"><span>ඔබේ ප්‍රශ්නය</span><p>{chat.question}</p></div><div className={`answer-bubble ${chat.mode === "no_match" ? "no-match" : ""}`}><span className="answer-label"><Icon name="leaf" size={18} />අකුර · {chat.mode === "no_match" ? "තොරතුරු හමු නොවීය" : "ලේඛන උපුටාගැනීම්"}</span><p>{chat.answer}</p>{chat.sources.length > 0 && <div className="source-links" aria-label="පිළිතුරේ මූලාශ්‍ර">{chat.sources.map((source, i) => <SourceLink key={`${source.document_id}-${source.page}`} source={source} index={i} />)}</div>}{chat.sources.some(s => s.ocr) && <small>හඳුනාගත් අකුරු මුල් ගොනුව සමඟ පරීක්ෂා කරන්න.</small>}</div></article>)}
      {busy && <p className="thinking" role="status">ලේඛනවල අදාළ තොරතුරු සොයමින්…</p>}<div ref={answerEnd} />
    </section>
    <form className="question-form tool-card" onSubmit={send}><label htmlFor="question">ඔබේ ප්‍රශ්නය</label><textarea id="question" rows={3} value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} minLength={2} required disabled={busy || !ready.length} placeholder="ප්‍රශ්නය සිංහලෙන් ලියන්න…" /><div className="question-actions">{voiceSupported ? <button className={`secondary-button${listening ? " recording" : ""}`} type="button" disabled={busy || !ready.length} onClick={voice}>{listening ? "හඬ නවත්වන්න" : "හඬින් ලියන්න"}</button> : <span>මෙම බ්‍රවුසරයේ හඬින් ලිවීම නොමැත. ප්‍රශ්නය ලියන්න.</span>}<button className="primary-button" type="submit" disabled={busy || question.trim().length < 2 || !ready.length}>{busy ? "සොයමින්…" : "ප්‍රශ්නය යවන්න"}<Icon name="arrow" size={17} /></button></div>{voiceSupported && <p className="voice-notice">හඬින් ලිවීම බ්‍රවුසරයේ හඬ සේවාව භාවිත කරයි. ලැබෙන ප්‍රශ්නය යැවීමට පෙර නිවැරදි කළ හැක.</p>}{voiceNotice && <p className="voice-notice" role="status">{voiceNotice}</p>}{error && <p className="notice error" role="alert">{error}</p>}</form>
  </div>;
}
