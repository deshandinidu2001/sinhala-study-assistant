"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Chat } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { useDocuments } from "@/lib/use-documents";
import { Icon } from "@/components/icon";
import { SourceLink } from "@/components/source-link";

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: { transcript: string }[][] }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function ChatWorkspace() {
  const params = useSearchParams();
  const { language: interfaceLanguage, t } = useLanguage();
  const { documents, loading, error: documentsError } = useDocuments();
  const [selected, setSelected] = useState(params.get("document") ?? "");
  const [subject, setSubject] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [inputLanguage, setInputLanguage] = useState("auto");
  const [question, setQuestion] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpretNotice, setInterpretNotice] = useState("");
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const thread = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const ready = documents.filter(document => document.status === "ready");
  const subjects = [...new Set(ready.map(document => document.subject))].sort();
  const validSelected = ready.some(document => document.id === selected && (!subject || document.subject === subject)) ? selected : "";
  const scope = { subject: subject || null, document_id: validSelected || null };
  const sourceOptions = ready.filter(document => (!subject || document.subject === subject) && `${document.title} ${document.subject}`.toLowerCase().includes(sourceSearch.toLowerCase()));
  const scopedChats = chats.filter(chat => (!subject || chat.subject === subject || chat.sources.some(source => ready.some(document => document.id === source.document_id && document.subject === subject))) && (!validSelected || chat.document_id === validSelected || chat.sources.some(source => source.document_id === validSelected)));
  const visibleChats = scopedChats.slice(-visibleCount);
  useEffect(() => { setSelected(params.get("document") ?? ""); }, [params]);
  useEffect(() => { setInterpretation(""); setInterpretNotice(""); }, [question, inputLanguage, selected, subject]);
  useEffect(() => { if (window.matchMedia("(max-width: 1100px)").matches) setSourcesOpen(false); }, []);
  useEffect(() => {
    const abort = new AbortController();
    api<{ gemini_configured: boolean }>("/capabilities", { signal: abort.signal }).then(result => setGeminiConfigured(result.gemini_configured)).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController(); setHistoryLoading(true); setHistoryError("");
    api<Chat[]>("/chats", { signal: abort.signal }).then(history => {
      setChats(current => [...new Map([...history, ...current].map(chat => [chat.id, chat])).values()].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    }).catch(failure => { if (!abort.signal.aborted) setHistoryError(failure.message); }).finally(() => { if (!abort.signal.aborted) setHistoryLoading(false); });
    return () => abort.abort();
  }, [attempt]);
  useEffect(() => { const voiceWindow = window as VoiceWindow; setVoiceSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition)); return () => recognition.current?.abort(); }, []);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }); }, [chats.length, selected, historyLoading]);
  async function interpret() {
    if (busy || interpreting || question.trim().length < 2) return;
    recognition.current?.abort(); setInterpreting(true); setError("");
    try {
      const result = await api<{ question: string; notice?: string }>("/questions/normalize", { method: "POST", body: JSON.stringify({ question, language: inputLanguage, ...scope }) });
      setInterpretation(result.question); setInterpretNotice(result.notice ?? "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("ප්‍රශ්නය කියවිය නොහැක.", "Could not interpret this question.")); }
    finally { setInterpreting(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || interpreting || question.trim().length < 2 || !ready.length) return;
    recognition.current?.abort(); setBusy(true); setError(""); setVoiceNotice("");
    try {
      const chat = await api<Chat>("/chat", { method: "POST", body: JSON.stringify({ question: question.trim(), language: inputLanguage, answer_language: interfaceLanguage, ...scope }) });
      setChats(previous => [...previous, chat]); setQuestion("");
      requestAnimationFrame(() => composer.current?.focus());
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("පිළිතුර ලබාගත නොහැක.", "Could not get an answer.")); }
    finally { setBusy(false); }
  }
  function voice() {
    if (listening) { recognition.current?.stop(); return; }
    const voiceWindow = window as VoiceWindow;
    const Constructor = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    const instance = new Constructor(); recognition.current = instance;
    instance.lang = interfaceLanguage === "en" && inputLanguage === "original" ? "en-US" : "si-LK"; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => { const transcript = event.results[0]?.[0]?.transcript; if (transcript) { setQuestion(previous => `${previous} ${transcript}`.trim().slice(0, 2000)); setVoiceNotice(t("ඇසුණු ප්‍රශ්නය නිවැරදි කර යවන්න.", "Review the question before sending.")); } };
    instance.onerror = event => { setListening(false); setVoiceNotice(event.error === "not-allowed" ? t("මයික්‍රෆෝනයට අවසර දෙන්න හෝ ප්‍රශ්නය ලියන්න.", "Allow microphone access or type your question.") : t("හඬ හඳුනාගත නොහැකි විය. නැවත උත්සාහ කරන්න.", "Could not hear you. Try again.")); };
    instance.onend = () => setListening(false);
    try { setListening(true); setVoiceNotice(t("සවන් දෙමින්…", "Listening…")); instance.start(); }
    catch { setListening(false); setVoiceNotice(t("හඬ ආරම්භ කළ නොහැක.", "Could not start the microphone.")); }
  }
  return <div className={`chat-layout${sourcesOpen ? " sources-visible" : ""}`}>
    <section className="chat-main" aria-labelledby="chat-title">
      <header className="chat-header"><div><h1 id="chat-title">{t("සංවාදය", "Ask your notes")}</h1><details className="mode-info"><summary><i />{geminiConfigured ? "Gemini" : t("ලේඛන ඇසුරින්", "Source passages")}</summary><p>{geminiConfigured ? t("ප්‍රශ්නය සහ අදාළ කොටස් Google වෙත යවයි. පිළිතුරු මූලාශ්‍ර සමඟ පරීක්ෂා කරන්න.", "Questions and relevant excerpts are sent to Google. Check answers against the sources.") : t("පිළිතුරු ඔබේ ලේඛනවල අදාළ කොටස් පෙන්වයි.", "Answers show relevant passages from your notes.")}</p></details></div><button className={`secondary-button source-toggle${sourcesOpen ? " selected" : ""}`} aria-expanded={sourcesOpen} aria-controls="chat-sources" onClick={() => setSourcesOpen(value => !value)}><Icon name="book" size={17} />{t("මූලාශ්‍ර", "Sources")}<span>{validSelected ? 1 : ready.filter(document => !subject || document.subject === subject).length}</span></button></header>
      <div ref={thread} className="chat-thread" role="log" aria-label={t("ප්‍රශ්න හා පිළිතුරු ඉතිහාසය", "Conversation")} aria-live="polite" tabIndex={0}>
        {historyLoading && <p className="thinking" role="status">{t("පෙර ප්‍රශ්න ලබාගනිමින්…", "Loading conversation…")}</p>}
        {historyError && <div className="notice error" role="alert">{t(historyError)} <button className="text-button" onClick={() => setAttempt(value => value + 1)}>{t("නැවත උත්සාහ කරන්න")}</button></div>}
        {!historyLoading && !visibleChats.length && <div className="chat-empty"><span className="chat-empty-symbol">අ<span>?</span></span><h2>{ready.length ? t("මොනවද පැහැදිලි කරගන්න ඕනේ?", "What would you like to understand?") : t("සටහනකින් පටන් ගන්න", "Start with your notes.")}</h2><p>{ready.length ? t("සිංහල, Singlish හෝ English", "Sinhala, Singlish or English") : t("PDF එකක් එක් කරන්න හෝ සටහනක් ලියන්න.", "Add a PDF or paste a note to begin.")}</p>{!loading && !ready.length && <Link href="/documents#upload" className="primary-button"><Icon name="plus" size={17} />{t("ලේඛනයක් එක් කරන්න")}</Link>}</div>}
        {scopedChats.length > visibleCount && <button className="earlier-button" onClick={() => setVisibleCount(value => value + 10)}>{t("පෙර ප්‍රශ්න", "Earlier questions")}</button>}
        {visibleChats.map(chat => <article className="chat-exchange" key={chat.id}>
          <div className="question-bubble"><span className="sr-only">{t("ඔබේ ප්‍රශ්නය", "Your question")}</span><p>{chat.question}</p>{chat.normalized_question && chat.normalized_question !== chat.question && <details className="interpretation-note"><summary>{t("සිංහල අර්ථකථනය", "Interpreted question")}</summary><p>{chat.normalized_question}</p></details>}</div>
          <div className={`answer-bubble${chat.mode === "no_match" ? " no-match" : ""}`}><span className="answer-mark" aria-hidden="true">අ</span><div className="answer-content"><span className="answer-label">{chat.mode === "gemini" ? "Gemini" : chat.mode === "no_match" ? t("ගැළපීමක් නැත", "No matching passage") : t("ලේඛන උපුටාගැනීම්", "From your notes")}</span><p>{chat.mode === "no_match" ? t("පාඩමේ වචනයක් භාවිත කරන්න හෝ වෙනත් ලේඛනයක් තෝරන්න.", "Try a key term from your notes or choose another source.") : chat.answer.replace("ඔබේ ලේඛනවලින් හමු වූ අදාළ කොටස්:\n\n", "").replace("Relevant passages from your sources:\n\n", "")}</p>
          {!!chat.sources.length && <div className="source-links" aria-label={t("පිළිතුරේ මූලාශ්‍ර", "Answer sources")}>{chat.sources.map((source, index) => <SourceLink key={`${source.document_id}-${source.page}`} source={source} index={index} />)}</div>}
          {(chat.notice || chat.sources.some(source => source.ocr)) && <details className="answer-details"><summary>{t("පිළිතුර ගැන", "About this answer")}</summary>{chat.notice && <p>{t(chat.notice)}</p>}{chat.sources.some(source => source.ocr) && <p>{t("OCR අකුරු මුල් පිටුව සමඟ බලන්න.", "Check OCR text against the original page.")}</p>}</details>}
          </div></div>
        </article>)}
        {busy && <p className="thinking" role="status">{t("සොයමින්…", "Looking through your notes…")}</p>}
      </div>
      <div className="composer-wrap">
        {documentsError && <p className="notice error" role="alert">{t(documentsError)}</p>}
        {error && <p className="notice error" role="alert">{t(error)}</p>}
        {voiceNotice && <p className="voice-notice" role="status">{voiceNotice}</p>}
        <form className="question-form" onSubmit={send}>
          {interpretation && <div className="question-interpretation"><div className="section-heading"><label htmlFor="interpreted-question">{t("සිංහල ප්‍රශ්නය පරීක්ෂා කරන්න", "Check the Sinhala question")}</label><button type="button" className="icon-button" aria-label={t("අවලංගු කරන්න")} onClick={() => { setInterpretation(""); setInterpretNotice(""); }}><Icon name="close" size={17} /></button></div><textarea id="interpreted-question" value={interpretation} onChange={event => setInterpretation(event.target.value)} rows={2} maxLength={2000} /><button type="button" className="text-button" disabled={busy || !interpretation.trim()} onClick={() => { setQuestion(interpretation); setInputLanguage("original"); composer.current?.focus(); }}>{t("මෙම ප්‍රශ්නය භාවිත කරන්න", "Use this question")}</button>{interpretNotice && <p className="voice-notice">{t(interpretNotice)}</p>}</div>}
          <label className="sr-only" htmlFor="question">{t("ඔබේ ප්‍රශ්නය", "Your question")}</label><textarea ref={composer} id="question" rows={2} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={2000} minLength={2} required disabled={busy || interpreting || !ready.length} placeholder={t("ප්‍රශ්නයක් ලියන්න…", "Ask a question about your notes…")} />
          <div className="question-actions"><label className="input-language"><span className="sr-only">{t("ලියන ආකාරය", "Input language")}</span><select aria-label={t("ලියන ආකාරය", "Input language")} id="question-language" value={inputLanguage} disabled={busy || interpreting} onChange={event => setInputLanguage(event.target.value)}><option value="auto">{t("ස්වයංක්‍රීය", "Auto")}</option><option value="singlish">Singlish</option><option value="original">සිංහල / English</option></select></label><button type="button" className="preview-button" disabled={busy || interpreting || question.trim().length < 2} onClick={interpret}>{interpreting ? t("කියවමින්…", "Checking…") : t("සිංහලෙන් බලන්න", "Check Singlish")}</button><div className="composer-end">{question.length > 1800 && <small>{question.length}/2000</small>}{voiceSupported && <button className={`icon-button${listening ? " recording" : ""}`} type="button" aria-label={listening ? t("හඬ නවත්වන්න", "Stop dictation") : t("හඬින් ලියන්න", "Dictate question")} disabled={busy || interpreting || !ready.length} onClick={voice}><Icon name="mic" size={18} /></button>}<button className="send-button" type="submit" aria-label={t("ප්‍රශ්නය යවන්න", "Send question")} disabled={busy || interpreting || question.trim().length < 2 || !ready.length}><Icon name="arrow" size={19} /></button></div></div>
        </form><p className="composer-hint">{validSelected ? ready.find(document => document.id === validSelected)?.title : t("සියලු සූදානම් ලේඛන")}<span>{t("මූලාශ්‍ර සමඟ පරීක්ෂා කරන්න.", "Check answers against your sources.")}</span></p>
      </div>
    </section>
    {sourcesOpen && <aside id="chat-sources" className="source-rail" aria-label={t("සංවාද මූලාශ්‍ර", "Conversation sources")}><div className="section-heading"><h2>{t("මූලාශ්‍ර", "Sources")}</h2><button className="icon-button" aria-label={t("මූලාශ්‍ර වසන්න", "Close sources")} onClick={() => setSourcesOpen(false)}><Icon name="close" size={17} /></button></div><label htmlFor="chat-subject">{t("විෂය")}</label><select id="chat-subject" value={subject} onChange={event => { setSubject(event.target.value); setSelected(""); }} disabled={busy || interpreting}><option value="">{t("සියලු විෂයන්")}</option>{subjects.map(value => <option key={value}>{value}</option>)}</select><input className="source-search" aria-label={t("ලේඛන සොයන්න")} placeholder={t("ලේඛන සොයන්න", "Find a source…")} value={sourceSearch} onChange={event => setSourceSearch(event.target.value)} />
      <div className="source-picker" role="radiogroup" aria-label={t("ලේඛනය තෝරන්න", "Choose source")}><label className={`source-choice all-sources${!validSelected ? " active" : ""}`}><input type="radio" name="chat-source" checked={!validSelected} onChange={() => setSelected("")} disabled={busy || interpreting} /><Icon name="book" size={19} /><span>{t("සියලු සූදානම් ලේඛන")}<small>{ready.filter(document => !subject || document.subject === subject).length} {t("ලේඛන", "sources")}</small></span></label>{sourceOptions.map(document => <label key={document.id} className={`source-choice${validSelected === document.id ? " active" : ""}`}><input type="radio" name="chat-source" checked={validSelected === document.id} onChange={() => { setSelected(document.id); if (window.innerWidth <= 1100) setSourcesOpen(false); }} disabled={busy || interpreting} /><Icon name="document" size={19} /><span>{document.title}<small>{document.page_count} {t("පිටු")} · {document.subject}</small></span></label>)}</div>
      {!sourceOptions.length && <p className="rail-empty">{loading ? t("ලේඛන ලබාගනිමින්…") : t("ගැළපෙන ලේඛන නැත")}</p>}<Link className="rail-add" href="/documents#upload"><Icon name="plus" size={16} />{t("ලේඛනයක් එක් කරන්න")}</Link>{validSelected && <div className="rail-tools"><Link className="secondary-button" href={`/documents/${validSelected}`}><Icon name="book" size={16} />{t("කියවන්න")}</Link><Link className="secondary-button" href={`/practice?document=${validSelected}`}><Icon name="quiz" size={16} />{t("පුහුණු වන්න")}</Link></div>}
    </aside>}
  </div>;
}
