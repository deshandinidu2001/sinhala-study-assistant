"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, apiUrl, type DocumentDetail } from "@/lib/api";

export function DocumentReader({ id }: { id: string }) {
  const search = useSearchParams();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setDocument(null); setError("");
    api<DocumentDetail>(`/documents/${id}`, { signal: abort.signal }).then(setDocument).catch(failure => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [id, attempt]);
  if (error) return <div className="overview tool-page"><p className="notice error" role="alert">{error}</p><button className="secondary-button" onClick={() => setAttempt(n => n + 1)}>නැවත උත්සාහ කරන්න</button><Link className="text-button" href="/documents">ලේඛන එකතුවට යන්න</Link></div>;
  if (!document) return <div className="overview"><p role="status">ලේඛනය ලබාගනිමින්…</p></div>;
  const requested = Number(search.get("page") ?? 1);
  const number = Number.isFinite(requested) ? Math.max(1, Math.min(document.page_count || 1, Math.floor(requested))) : 1;
  const page = document.pages.find(p => p.page === number);
  const section = document.extraction_method === "sections" || /\.(txt|md)$/i.test(document.filename);
  return <div className="overview tool-page reader-page">
    <Link className="back-link" href="/documents">← ලේඛන එකතුව</Link>
    <div className="page-intro"><p className="welcome">{document.subject}</p><h1>{document.title}</h1><p>{document.filename} · {document.page_count} {section ? "කොටස්" : "පිටු"}</p></div>
    <div className="reader-actions"><Link className="primary-button" href={`/chat?document=${id}`}>මෙම පාඩමෙන් ප්‍රශ්න අහන්න</Link><Link className="secondary-button" href={`/practice?document=${id}`}>පුහුණු වන්න</Link><a className="text-button" href={apiUrl(`/documents/${id}/file`)} target="_blank" rel="noreferrer">මුල් ගොනුව විවෘත කරන්න ↗</a></div>
    {section && <p className="notice">මෙම ගොනු වර්ගයේ ස්ථාවර පිටු අංක නැති නිසා අකුරු කොටස් ලෙස පෙන්වයි. මූලාශ්‍රවල අංක මෙම කොටස්වලට යොමු වේ.</p>}
    {document.status !== "ready" ? <div className="empty-state"><h2>ලේඛනය තවම සූදානම් නැත</h2><p>{document.error ?? "අකුරු කියවමින් පවතී. ලේඛන එකතුවේ තත්ත්වය බලන්න."}</p><Link href="/documents" className="primary-button">ලේඛන එකතුව බලන්න</Link></div> : <>
      <nav className="page-controls" aria-label="ලේඛනයේ පිටු"><Link className={`secondary-button${number === 1 ? " disabled" : ""}`} href={`/documents/${id}?page=${Math.max(1, number - 1)}`} aria-disabled={number === 1} tabIndex={number === 1 ? -1 : 0}>පෙර</Link><label>{section ? "කොටස" : "පිටුව"}<select aria-label={section ? "කොටස තෝරන්න" : "පිටුව තෝරන්න"} value={number} onChange={e => { window.location.assign(`/documents/${id}?page=${e.target.value}`); }}>{document.pages.map(p => <option key={p.page} value={p.page}>{p.page} / {document.page_count}</option>)}</select></label><Link className={`secondary-button${number === document.page_count ? " disabled" : ""}`} href={`/documents/${id}?page=${Math.min(document.page_count, number + 1)}`} aria-disabled={number === document.page_count} tabIndex={number === document.page_count ? -1 : 0}>ඊළඟ</Link></nav>
      {page?.ocr && <p className="notice">මෙම පිටුවේ අකුරු ස්වයංක්‍රීයව හඳුනාගෙන ඇත. අංක සහ අක්ෂර මුල් පිටුව සමඟ පරීක්ෂා කරන්න.</p>}
      <article className="source-page" aria-label={`${section ? "කොටස" : "පිටුව"} ${number}`}><span className="source-page-number">{section ? "කොටස" : "පිටුව"} {number}</span><p>{page?.text || "මෙම පිටුවේ කියවිය හැකි අකුරු නැත. මුල් ගොනුව බලන්න."}</p></article>
    </>}
  </div>;
}
