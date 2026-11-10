"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLanguage } from "@/lib/language";
import { useDocuments } from "@/lib/use-documents";
import { Icon } from "@/components/icon";

export function StudyOverview() {
  const { t } = useLanguage();
  const { documents, loading, error } = useDocuments();
  useEffect(() => {
    if (window.location.hash === "#practice") window.location.replace("/practice");
    else if (window.location.hash === "#library") window.location.replace("/documents");
  }, []);
  return <div className="overview desk-page">
    <div className="page-intro desk-heading"><div><h1>{t("අධ්‍යයන මේසය", "Study desk")}</h1><p>{t("ඔබේ සටහන් සමඟ නැවත පටන් ගන්න.", "Pick up where you left off.")}</p></div><Link className="primary-button" href="/documents#upload"><Icon name="plus" size={18} />{t("ලේඛනයක් එක් කරන්න")}</Link></div>
    <div className="desk-actions"><Link href="/chat" className="desk-action ask-action"><span className="action-glyph"><Icon name="chat" size={27} /></span><span><h2>{t("සටහන්වලින් ප්‍රශ්නයක් අහන්න", "Ask your notes")}</h2><p>{t("සිංහල, Singlish හෝ English", "Sinhala, Singlish or English")}</p></span><Icon name="arrow" size={21} /></Link><Link href="/practice" className="desk-action"><span className="action-glyph"><Icon name="quiz" size={25} /></span><span><h2>{t("දැනුම පරීක්ෂා කරන්න", "Practice")}</h2><p>{t("ඔබේ සටහන් ඇසුරින් ප්‍රශ්න", "A short quiz from your notes")}</p></span><Icon name="arrow" size={21} /></Link></div>
    <section className="desk-library" aria-labelledby="recent-heading"><div className="section-heading"><h2 id="recent-heading">{t("මෑත ලේඛන", "Recent sources")}</h2><Link href="/documents" className="text-button">{t("සියල්ල බලන්න", "View all")}<Icon name="arrow" size={15} /></Link></div>
      {error && <p className="notice error" role="alert">{t(error)}</p>}
      {loading ? <p className="empty-state" role="status">{t("ලේඛන ලබාගනිමින්…")}</p> : documents.length ? <div className="notebook-grid">{documents.slice(0, 6).map((document, i) => <Link href={document.status === "ready" ? `/documents/${document.id}` : "/documents"} className={`notebook-card cover-${i % 4}`} key={document.id}><div className="notebook-card-cover"><span>{document.filename.split(".").pop()?.toUpperCase()}</span><Icon name="document" size={36} /><span className="cover-lines" /></div><div className="notebook-card-info"><h3>{document.title}</h3><p>{document.subject} <span>· {document.page_count} {t("පිටු")}</span></p><span className={`document-status ${document.status}`}>{t(document.status === "ready" ? "සූදානම්" : document.status === "failed" ? "සැකසීම අසාර්ථකයි" : "සකසමින්…")}</span></div></Link>)}</div> : <div className="desk-empty"><Icon name="book" size={40} /><h3>{t("ඔබේ පළමු පාඩම එක් කරන්න")}</h3><p>{t("PDF එකක් එක් කරන්න හෝ සටහනක් ලියන්න.", "Add a PDF or paste a note to begin.")}</p><Link href="/documents#upload" className="secondary-button">{t("ලේඛනයක් එක් කරන්න")}</Link></div>}
    </section>
  </div>;
}
