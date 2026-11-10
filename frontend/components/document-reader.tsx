"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, apiUrl, type DocumentDetail } from "@/lib/api";
export function DocumentReader({ id }: {
    id: string;
}) {
    const { t } = useLanguage();
    const search = useSearchParams();
    const [document, setDocument] = useState<DocumentDetail | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [textView, setTextView] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [reprocessing, setReprocessing] = useState(false);
    const [actionError, setActionError] = useState("");
    const requestedPage = search.get("page");
    useEffect(() => { setImageError(false); setImageLoading(true); }, [id, requestedPage]);
    useEffect(() => {
        if (!document || document.status === "ready" || document.status === "failed")
            return;
        const timer = setTimeout(() => setAttempt(n => n + 1), 2500);
        return () => clearTimeout(timer);
    }, [document]);
    async function reprocess() {
        setReprocessing(true);
        setActionError("");
        try {
            await api(`/documents/${id}/reprocess`, { method: "POST" });
            setAttempt(n => n + 1);
        }
        catch (failure) {
            setActionError(failure instanceof Error ? failure.message : t("නැවත සකස් කළ නොහැක."));
        }
        finally {
            setReprocessing(false);
        }
    }
    useEffect(() => {
        const abort = new AbortController();
        setDocument(null);
        setError("");
        api<DocumentDetail>(`/documents/${id}`, { signal: abort.signal }).then(setDocument).catch(failure => { if (!abort.signal.aborted)
            setError(failure.message); });
        return () => abort.abort();
    }, [id, attempt]);
    if (error)
        return <div className="overview tool-page"><p className="notice error" role="alert">{t(error)}</p><button className="secondary-button" onClick={() => setAttempt(n => n + 1)}>{t("නැවත උත්සාහ කරන්න")}</button><Link className="text-button" href="/documents">{t("ලේඛන එකතුවට යන්න")}</Link></div>;
    if (!document)
        return <div className="overview"><p role="status">{t("ලේඛනය ලබාගනිමින්…")}</p></div>;
    const requested = Number(search.get("page") ?? 1);
    const number = Number.isFinite(requested) ? Math.max(1, Math.min(document.page_count || 1, Math.floor(requested))) : 1;
    const page = document.pages.find(p => p.page === number);
    const pdf = /\.pdf$/i.test(document.filename);
    const section = document.extraction_method === "sections" || /\.(txt|md)$/i.test(document.filename);
    return <div className="overview tool-page reader-page">
    <Link className="back-link" href="/documents">{t("← ලේඛන එකතුව")}</Link>
    <div className="page-intro"><p className="welcome">{document.subject}</p><h1>{document.title}</h1><p>{document.filename} · {document.page_count} {section ? t("කොටස්") : t("පිටු")}</p></div>
    <div className="reader-actions"><Link className="primary-button" href={`/chat?document=${id}`}>{t("මෙම පාඩමෙන් ප්‍රශ්න අහන්න")}</Link><Link className="secondary-button" href={`/summaries?document=${id}`}>{t("සාරාංශ කරන්න", "Summarize")}</Link><Link className="secondary-button" href={`/practice?document=${id}`}>{t("පුහුණු වන්න")}</Link><a className="text-button" href={apiUrl(`/documents/${id}/file`)} target="_blank" rel="noreferrer">{t("මුල් ගොනුව විවෘත කරන්න ↗")}</a></div>
    {actionError && <p className="notice error" role="alert">{t(actionError)}</p>}
    {pdf && <div className="reader-view-controls"><div role="group" aria-label={t("කියවීමේ ආකාරය")}><button className="secondary-button" aria-pressed={!textView} onClick={() => setTextView(false)}>{t("මුල් PDF පිටුව")}</button><button className="secondary-button" aria-pressed={textView} onClick={() => setTextView(true)}>{t("හඳුනාගත් අකුරු")}</button></div><button className="text-button" onClick={reprocess} disabled={reprocessing || !["ready", "failed"].includes(document.status)}>{reprocessing ? t("සකසමින්…") : t("අකුරු නැවත හඳුනාගන්න")}</button></div>}
    {section && <p className="notice">{t("මෙම ගොනු වර්ගයේ ස්ථාවර පිටු අංක නැති නිසා අකුරු කොටස් ලෙස පෙන්වයි. මූලාශ්‍රවල අංක මෙම කොටස්වලට යොමු වේ.")}</p>}
    {document.status !== "ready" ? <div className="empty-state"><h2>{t("ලේඛනය තවම සූදානම් නැත")}</h2><p>{document.error ?? t("අකුරු කියවමින් පවතී. ලේඛන එකතුවේ තත්ත්වය බලන්න.")}</p><Link href="/documents" className="primary-button">{t("ලේඛන එකතුව බලන්න")}</Link></div> : <>
      <nav className="page-controls" aria-label={t("ලේඛනයේ පිටු")}><Link className={`secondary-button${number === 1 ? " disabled" : ""}`} href={`/documents/${id}?page=${Math.max(1, number - 1)}`} aria-disabled={number === 1} tabIndex={number === 1 ? -1 : 0}>{t("පෙර")}</Link><label>{section ? t("කොටස") : t("පිටුව")}<select aria-label={section ? t("කොටස තෝරන්න") : t("පිටුව තෝරන්න")} value={number} onChange={e => { window.location.assign(`/documents/${id}?page=${e.target.value}`); }}>{document.pages.map(p => <option key={p.page} value={p.page}>{p.page} / {document.page_count}</option>)}</select></label><Link className={`secondary-button${number === document.page_count ? " disabled" : ""}`} href={`/documents/${id}?page=${Math.min(document.page_count, number + 1)}`} aria-disabled={number === document.page_count} tabIndex={number === document.page_count ? -1 : 0}>{t("ඊළඟ")}</Link></nav>
      {(!pdf || textView) && page?.ocr && <p className="notice">{t("මෙම පිටුවේ අකුරු ස්වයංක්‍රීයව හඳුනාගෙන ඇත. අංක සහ අක්ෂර මුල් පිටුව සමඟ පරීක්ෂා කරන්න.")}</p>}
      {pdf && !textView ? <div className="pdf-page" aria-label={`${t("මුල් PDF පිටුව")} ${number}`}>
        {imageLoading && !imageError && <p role="status">{t("PDF පිටුව පූරණය වෙමින්…")}</p>}
        {imageError ? <p className="notice error" role="alert">{t("PDF පිටුව පූරණය කළ නොහැක.")}<button className="text-button" onClick={() => { setImageError(false); setImageLoading(true); }}>{t("නැවත උත්සාහ කරන්න")}</button>{t("හෝ ඉහත මුල් ගොනුව විවෘත කරන්න.")}</p> : <a href={apiUrl(`/documents/${id}/file#page=${number}`)} target="_blank" rel="noreferrer" aria-label={t("PDF විශාල කර බලන්න")}><img src={apiUrl(`/documents/${id}/pages/${number}/image`)} alt={`${document.title} · ${t("පිටුව")} ${number}`} onLoad={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }}/></a>}
      </div> : <article className="source-page" aria-label={`${section ? t("කොටස") : t("පිටුව")} ${number}`}><span className="source-page-number">{section ? t("කොටස") : t("පිටුව")} {number}</span><p>{page?.text || t("මෙම පිටුවේ කියවිය හැකි අකුරු නැත. මුල් ගොනුව බලන්න.")}</p></article>}

    </>}
  </div>;
}
