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
  const [language, setLanguage] = useState("auto");
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [interpretNotice, setInterpretNotice] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    api<{ gemini_configured: boolean }>("/capabilities", { signal: abort.signal }).then(result => setGeminiConfigured(result.gemini_configured)).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => { setInterpretation(""); setInterpretNotice(""); }, [question, language]);
  async function interpret() {
    setInterpreting(true); setError("");
    try {
      const result = await api<{ question: string; notice?: string }>("/questions/normalize", { method: "POST", body: JSON.stringify({ question, language }) });
      setInterpretation(result.question); setInterpretNotice(result.notice ?? "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "ප්‍රශ්නය කියවිය නොහැක."); }
    finally { setInterpreting(false); }
  }
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
      const chat = await api<Chat>("/chat", { method: "POST", body: JSON.stringify({ question: question.trim(), language, subject: subject || null, document_id: validSelected || null }) });
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
    <p className="notice mode-note">{geminiConfigured === true ? "Gemini යතුර සකසා ඇත. ප්‍රශ්නය සහ අදාළ ලේඛන කොටස් Google වෙත යවා මූලාශ්‍ර සමඟ සිංහල පැහැදිලි කිරීමක් සකසයි. පිළිතුර මුල් මූලාශ්‍ර සමඟ පරීක්ෂා කරන්න." : geminiConfigured === false ? "දැනට දේශීය Singlish පරිවර්තනය සහ ලේඛන උපුටාගැනීම් භාවිත කරයි. Gemini යතුර එක් කළ පසු මූලාශ්‍ර ඇසුරින් සිංහල පැහැදිලි කිරීම් ලබාගත හැක." : "පිළිතුරේ භාවිත කළ ආකාරය සහ මූලාශ්‍ර එක් එක් පිළිතුර සමඟ පෙන්වයි."}</p>
    {documentsError && <p className="notice error" role="alert">{documentsError}</p>}
    {!loading && ready.length === 0 && <div className="empty-state compact"><Icon name="book" size={30} /><h2>ප්‍රශ්න අහන්න, පළමුව පාඩමක් එක් කරන්න</h2><p>ඔබේ ලේඛන සූදානම් වූ පසු ඒවා ඇසුරින් පිළිතුරු ලබාගත හැක.</p><Link href="/documents" className="primary-button">ලේඛනයක් එක් කරන්න</Link></div>}
    <div className="scope-bar"><label>විෂය<select value={subject} onChange={e => { setSubject(e.target.value); setSelected(""); }} disabled={busy || interpreting}><option value="">සියලු විෂයන්</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label>ලේඛනය<select value={validSelected} onChange={e => setSelected(e.target.value)} disabled={busy || interpreting}><option value="">සියලු සූදානම් ලේඛන</option>{ready.filter(d => !subject || d.subject === subject).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></div>
    <section className="chat-thread" aria-label="ප්‍රශ්න හා පිළිතුරු ඉතිහාසය" aria-live="polite">
      {historyLoading && <p role="status">පෙර ප්‍රශ්න ලබාගනිමින්…</p>}{historyError && <div className="notice error" role="alert"><p>{historyError}</p><button className="text-button" onClick={() => setAttempt(n => n + 1)}>නැවත උත්සාහ කරන්න</button></div>}
      {!historyLoading && !chats.length && ready.length > 0 && <div className="empty-state"><Icon name="chat" size={36} /><h2>පාඩමේ අපැහැදිලි තැනක් තිබේද?</h2><p>පහතින් ප්‍රශ්නය ලියන්න. උදා: “ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?”<br />ඔබ එක් කළ සටහනට අදාළ ප්‍රශ්නයක් අසන්න.</p></div>}
      {chats.map(chat => <article className="chat-exchange" key={chat.id}><div className="question-bubble"><span>ඔබේ ප්‍රශ්නය</span><p>{chat.question}</p>{chat.normalized_question && chat.normalized_question !== chat.question && <small>සිංහලෙන්: {chat.normalized_question}</small>}</div><div className={`answer-bubble ${chat.mode === "no_match" ? "no-match" : ""}`}><span className="answer-label"><Icon name="leaf" size={18} />අකුර · {chat.mode === "no_match" ? "තොරතුරු හමු නොවීය" : chat.mode === "gemini" ? "Gemini පැහැදිලි කිරීම" : "ලේඛන උපුටාගැනීම්"}</span><p>{chat.answer}</p>{chat.notice && <p className="notice">{chat.notice}</p>}{chat.sources.length > 0 && <div className="source-links" aria-label="පිළිතුරේ මූලාශ්‍ර">{chat.sources.map((source, i) => <SourceLink key={`${source.document_id}-${source.page}`} source={source} index={i} />)}</div>}{chat.sources.some(s => s.ocr) && <small>හඳුනාගත් අකුරු මුල් ගොනුව සමඟ පරීක්ෂා කරන්න.</small>}</div></article>)}
      {busy && <p className="thinking" role="status">ලේඛනවල අදාළ තොරතුරු සොයමින්…</p>}<div ref={answerEnd} />
    </section>
    <form className="question-form tool-card" onSubmit={send}><label htmlFor="question-language">ලියන ආකාරය</label><select id="question-language" value={language} disabled={busy || interpreting} onChange={e => setLanguage(e.target.value)}><option value="auto">ස්වයංක්‍රීයව හඳුනාගන්න</option><option value="singlish">Singlish (Sinhala in English letters)</option><option value="original">සිංහල / English (ලියූ ආකාරයෙන්)</option></select><p className="voice-notice">උදා: mkd jiwa pataka kiyanne · Singlish අක්ෂර වෙනස් විය හැකි නිසා සිංහල ප්‍රශ්නය පරීක්ෂා කර නිවැරදි කළ හැක.</p><label htmlFor="question">ඔබේ ප්‍රශ්නය</label><textarea id="question" rows={3} value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} minLength={2} required disabled={busy || interpreting || !ready.length} placeholder="සිංහල හෝ Singlish: jiwa pataka kiyanne mokakda?" />{interpretNotice && <p className="notice" role="status">{interpretNotice}</p>}{interpretation && <div className="question-interpretation"><label htmlFor="interpreted-question">සිංහල ප්‍රශ්නය පරීක්ෂා කරන්න</label><textarea id="interpreted-question" value={interpretation} onChange={e => setInterpretation(e.target.value)} rows={2} maxLength={2000} /><button type="button" className="text-button" disabled={busy || !interpretation.trim()} onClick={() => { setQuestion(interpretation); setLanguage("original"); }}>මෙම ප්‍රශ්නය භාවිත කරන්න</button><p className="voice-notice">භාවිත කරන්න බොත්තමෙන් ප්‍රශ්නය මාරු වේ. යැවීමට ප්‍රශ්නය යවන්න ඔබන්න.</p></div>}<div className="question-actions"><button type="button" className="secondary-button" disabled={busy || interpreting || question.trim().length < 2} onClick={interpret}>{interpreting ? "කියවමින්…" : "සිංහලෙන් බලන්න"}</button>{voiceSupported ? <button className={`secondary-button${listening ? " recording" : ""}`} type="button" disabled={busy || interpreting || !ready.length} onClick={voice}>{listening ? "හඬ නවත්වන්න" : "හඬින් ලියන්න"}</button> : <span>මෙම බ්‍රවුසරයේ හඬින් ලිවීම නොමැත. ප්‍රශ්නය ලියන්න.</span>}<button className="primary-button" type="submit" disabled={busy || interpreting || question.trim().length < 2 || !ready.length}>{busy ? "සොයමින්…" : "ප්‍රශ්නය යවන්න"}<Icon name="arrow" size={17} /></button></div>{voiceSupported && <p className="voice-notice">හඬින් ලිවීම බ්‍රවුසරයේ හඬ සේවාව භාවිත කරයි. ලැබෙන ප්‍රශ්නය යැවීමට පෙර නිවැරදි කළ හැක.</p>}{voiceNotice && <p className="voice-notice" role="status">{voiceNotice}</p>}{error && <p className="notice error" role="alert">{error}</p>}</form>
  </div>;
}
