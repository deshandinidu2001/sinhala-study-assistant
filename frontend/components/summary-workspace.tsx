"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, type DocumentSummary } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { useDocuments } from "@/lib/use-documents";
import { Icon } from "@/components/icon";
import { SourceLink } from "@/components/source-link";

export function SummaryWorkspace() {
  const params = useSearchParams();
  const { language, t } = useLanguage();
  const { documents, loading, error: documentsError } = useDocuments();
  const cacheVersion = useRef(0);
  const [selected, setSelected] = useState(params.get("document") ?? "");
  const [outputLanguage, setOutputLanguage] = useState<"si" | "en">(language);
  const [length, setLength] = useState("medium");
  const [provider, setProvider] = useState("gemini");
  const contentChoices = [
    ["definitions", t("අර්ථ දැක්වීම්", "Definitions")], ["comparisons", t("සැසඳීම් හා වෙනස්කම්", "Comparisons")],
    ["advantages", t("වාසි", "Advantages")], ["disadvantages", t("අවාසි හා සීමා", "Disadvantages")],
    ["functions", t("කාර්යයන්", "Functions")], ["examples", t("උදාහරණ", "Examples")], ["processes", t("ක්‍රියාවලි", "Processes")],
  ];
  const [include, setInclude] = useState<string[]>(["definitions", "comparisons", "advantages", "disadvantages", "functions", "examples", "processes"]);
  const optionQuery = `&length=${length}&provider=${provider}&include=${include.join(",")}`;
  const [focus, setFocus] = useState("");
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = documents.filter(document => document.status === "ready");
  const documentId = ready.some(document => document.id === selected) ? selected : ready[0]?.id ?? "";
  useEffect(() => setOutputLanguage(language), [language]);
  useEffect(() => setSelected(params.get("document") ?? ""), [params]);
  useEffect(() => {
    const version = ++cacheVersion.current;
    setSummary(null); setError("");
    if (!documentId) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      api<{ summary: DocumentSummary | null }>(`/documents/${documentId}/summary?language=${outputLanguage}&focus=${encodeURIComponent(focus.trim())}${optionQuery}`, { signal: abort.signal })
        .then(result => { if (cacheVersion.current === version) setSummary(result.summary); }).catch(failure => { if (!abort.signal.aborted) setError(failure.message); });
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [documentId, outputLanguage, focus, optionQuery]);
  async function generate() {
    if (!documentId || busy) return;
    const version = ++cacheVersion.current;
    setBusy(true); setError("");
    try {
      const next = await api<DocumentSummary>(`/documents/${documentId}/summary`, { method: "POST", signal: AbortSignal.timeout(200_000),
        body: JSON.stringify({ language: outputLanguage, focus: focus.trim(), regenerate: Boolean(summary), length, include, provider }) });
      if (cacheVersion.current === version) setSummary(next);
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("සාරාංශය සෑදිය නොහැක.", "Could not create the summary.")); }
    finally { setBusy(false); }
  }
  return <div className="overview tool-page summary-page">
    <div className="page-intro"><h1>{t("සාරාංශ", "Summaries")}</h1><p>{t("වැදගත් කරුණු, සරලව.", "The points worth keeping.")}</p></div>
    {documentsError && <p className="notice error" role="alert">{t(documentsError)}</p>}
    {!loading && !ready.length ? <div className="empty-state tool-card"><Icon name="summary" size={34} /><h2>{t("සාරාංශයක් සඳහා ලේඛනයක් එක් කරන්න", "Add a source to summarize")}</h2><Link className="primary-button" href="/documents#upload">{t("ලේඛනයක් එක් කරන්න")}</Link></div> : <section className="tool-card summary-setup" aria-label={t("සාරාංශය සකසන්න", "Summary settings")}>
      <div className="scope-bar"><label>{t("ලේඛනය")}<select value={documentId} disabled={busy} onChange={event => setSelected(event.target.value)}>{ready.map(document => <option value={document.id} key={document.id}>{document.title}</option>)}</select></label><label>{t("සාරාංශ භාෂාව", "Summary language")}<select value={outputLanguage} disabled={busy} onChange={event => setOutputLanguage(event.target.value as "si" | "en")}><option value="si">සිංහල</option><option value="en">English</option></select></label></div>
      <label>{t("අවධානය යොමු කළ යුතු කරුණු", "Focus on")}<input value={focus} maxLength={500} disabled={busy} onChange={event => setFocus(event.target.value)} placeholder={t("විකල්පයි: අර්ථ දැක්වීම්, වෙනස්කම්, කාර්යයන්…", "Optional: definitions, differences, functions…")} /></label>
      <div className="scope-bar summary-options">
        <label>{t("ඡේදවල දිග", "Paragraph length")}<select disabled={busy} value={length} onChange={event => setLength(event.target.value)}>
          <option value="short">{t("කෙටි · වචන 30–50", "Short · 30–50 words")}</option><option value="medium">{t("මධ්‍යම · වචන 50–80", "Medium · 50–80 words")}</option><option value="long">{t("විස්තරාත්මක · වචන 80–120", "Detailed · 80–120 words")}</option>
        </select></label>
        <label>{t("සාරාංශ සේවාව", "Summary provider")}<select disabled={busy} value={provider} onChange={event => setProvider(event.target.value)}><option value="gemini">Gemini</option><option value="kimi">Kimi K3 · Docker</option></select></label>
      </div>
      <fieldset className="summary-content" disabled={busy}><legend>{t("ඇතුළත් කළ යුතු කරුණු", "Include in the summary")}</legend>
        <label><input type="checkbox" checked={include.length === contentChoices.length} onChange={event => setInclude(event.target.checked ? contentChoices.map(([key]) => key) : ["definitions"])} />{t("සියල්ල", "All topics")}</label>
        {contentChoices.map(([key, label]) => <label key={key}><input type="checkbox" checked={include.includes(key)} onChange={event => setInclude(current => event.target.checked ? [...current, key] : current.length > 1 ? current.filter(value => value !== key) : current)} />{label}</label>)}
      </fieldset>
      <p className="summary-hint">{t("වචන ගණන ආසන්න අගයකි. මුල් ලේඛනයේ ඇති තොරතුරු පමණක් ඇතුළත් වේ. නොමැති කරුණු සඳහන් කරයි.", "Word counts are approximate. Only source-supported information is included; missing topics are noted.")}</p>
      <div className="form-actions"><p>{t("ප්‍රධාන කරුණු, වචන අර්ථ සහ මතක තබාගත යුතු දේ.", "Key concepts, definitions and revision points.")}</p><button className="primary-button" onClick={generate} disabled={busy || !documentId}><Icon name="summary" size={17} />{busy ? t("සකසමින්…") : summary ? t("නැවත සකසන්න", "Regenerate") : t("සාරාංශ කරන්න", "Summarize")}</button></div>
    </section>}
    {error && <p className="notice error" role="alert">{t(error)}</p>}
    {busy && <p className="thinking" role="status">{t("පාඩමේ වැදගත් කරුණු සකසමින්…", "Finding the key points in your document…")}</p>}
    {summary && <section className="summary-result" aria-label={t("පාඩම් සාරාංශය", "Study summary")}>
      <div className="summary-title"><h2>{summary.title}</h2><Link className="text-button" href={`/documents/${documentId}`}>{t("මුල් ලේඛනය", "Read original")}<Icon name="source" size={15} /></Link></div>
      {summary.coverage.text_truncated && <p className="notice">{t("දිගු පිටුවල තෝරාගත් අකුරු කොටස් ඇසුරින් මෙම සාරාංශය සකසා ඇත.", "This summary uses selected text from long pages. Check the original for full detail.")}</p>}
      <div className="summary-columns"><div className="summary-sections">{summary.sections.map((section, index) => <article className="summary-section" key={index}><h3>{section.heading}</h3><div className="summary-paragraphs">{section.points.map((point, pointIndex) => <div key={pointIndex}><p>{point.text}</p><SourceLink source={point.source} /></div>)}</div></article>)}
      <article className="revision-points"><h3><Icon name="check" size={19} />{t("මතක තබාගන්න", "For revision")}</h3><ul>{summary.revision_points.map((point, index) => <li key={index}><p>{point.text}</p><SourceLink source={point.source} /></li>)}</ul></article></div>
      {summary.key_terms.length > 0 && <aside className="summary-terms"><h3>{t("ප්‍රධාන වචන", "Key terms")}</h3><dl>{summary.key_terms.map((term, index) => <div key={index}><dt>{term.term}</dt><dd><p>{term.text}</p><SourceLink source={term.source} /></dd></div>)}</dl></aside>}</div>
    </section>}
  </div>;
}
