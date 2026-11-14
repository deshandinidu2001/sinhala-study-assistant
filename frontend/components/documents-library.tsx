"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { api, type StudyDocument } from "@/lib/api";
import { useDocuments } from "@/lib/use-documents";
import { Icon } from "@/components/icon";
const statusLabels = { ready: "සූදානම්", pending: "පොරොත්තුවේ", processing: "අකුරු කියවමින්…", failed: "සැකසීම අසාර්ථකයි" };
export function DocumentsLibrary() {
    const { t } = useLanguage();
    const { documents, loading, error, refresh } = useDocuments();
    const [mode, setMode] = useState<"file" | "text">("file");
    const [files, setFiles] = useState<File[]>([]);
    const [title, setTitle] = useState("");
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [search, setSearch] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const [busy, setBusy] = useState(false);
    const [actionId, setActionId] = useState("");
    const [confirmId, setConfirmId] = useState("");
    const [message, setMessage] = useState("");
    const [failure, setFailure] = useState("");
    const [dragging, setDragging] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const subjects = [...new Set(documents.map(d => d.subject))].sort();
    function chooseFiles(list: File[]) {
        const valid: File[] = [];
        const rejected: string[] = [];
        for (const file of list) {
            if (!/\.(pdf|txt|md|docx|png|jpe?g|webp)$/i.test(file.name))
                rejected.push(`${file.name}: ${t("සහාය නොදක්වන ගොනුවකි.", "Unsupported file.")}`);
            else if (file.size > 25 * 1024 * 1024)
                rejected.push(`${file.name}: ${t("25 MB ඉක්මවයි.", "Exceeds 25 MB.")}`);
            else if (file.size === 0)
                rejected.push(`${file.name}: ${t("ගොනුව හිස්ය.", "Empty file.")}`);
            else
                valid.push(file);
        }
        setFiles(valid);
        setFailure(rejected.join("\n"));
        setMessage("");
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        setFailure("");
        setMessage("");
        if (mode === "file" && files.length === 0) {
            setFailure(t("එක් කිරීමට ගොනුවක් තෝරන්න."));
            return;
        }
        setBusy(true);
        try {
            if (mode === "text") {
                await api<StudyDocument>("/documents/text", { method: "POST", body: JSON.stringify({ title: title.trim(), subject, content: content.trim() }) });
                setContent("");
                setTitle("");
                setMessage(t("සටහන සුරැකිණි. අකුරු කියවා සූදානම් කරමින් පවතී."));
            }
            else {
                let uploaded = 0;
                const remaining: File[] = [];
                const errors: string[] = [];
                for (const file of files) {
                    setMessage(`${file.name}: ${t("එක් කරමින්…")}`);
                    const data = new FormData();
                    data.append("file", file);
                    data.append("subject", subject);
                    data.append("title", files.length === 1 ? title : "");
                    try {
                        await api<StudyDocument>("/documents", { method: "POST", body: data });
                        uploaded++;
                    }
                    catch (failure) {
                        remaining.push(file);
                        errors.push(`${file.name}: ${failure instanceof Error ? failure.message : t("එක් කළ නොහැක.")}`);
                    }
                }
                setFiles(remaining);
                if (fileInput.current)
                    fileInput.current.value = "";
                setFailure(errors.join("\n"));
                setMessage(uploaded ? t(`ගොනු ${uploaded}ක් එක් කෙරිණි`, `${uploaded} files added`) : "");
                if (!remaining.length)
                    setTitle("");
            }
            await refresh();
        }
        catch (failure) {
            setFailure(failure instanceof Error ? failure.message : t("සටහන සුරැකිය නොහැක."));
        }
        finally {
            setBusy(false);
        }
    }
    async function documentAction(id: string, action: "delete" | "retry") {
        setActionId(id);
        setFailure("");
        try {
            await api(`/documents/${id}${action === "retry" ? "/retry" : ""}`, { method: action === "retry" ? "POST" : "DELETE" });
            setConfirmId("");
            setMessage(action === "retry" ? t("ලේඛනය නැවත සකසමින් පවතී.") : t("ලේඛනය ඉවත් කෙරිණි."));
            await refresh();
        }
        catch (failure) {
            setFailure(failure instanceof Error ? failure.message : t("ඉල්ලීම සම්පූර්ණ කළ නොහැක."));
        }
        finally {
            setActionId("");
        }
    }
    const visible = documents.filter(d => (!subjectFilter || d.subject === subjectFilter) && `${d.title} ${d.filename} ${d.subject}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    return <div className="overview tool-page">
    <div className="page-intro"><h1>{t("මගේ ලේඛන", "Sources")}</h1></div>
    <div className="library-layout">
    <section id="upload" className="tool-card upload-panel" aria-labelledby="upload-heading">
      <div className="section-heading"><h2 id="upload-heading">{t("ලේඛනයක් එක් කරන්න")}</h2><Icon name="document"/></div>
      <div className="segmented" aria-label={t("එක් කරන ආකාරය")}><button type="button" aria-pressed={mode === "file"} onClick={() => setMode("file")} disabled={busy}>{t("ගොනුවක් එක් කරන්න")}</button><button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")} disabled={busy}>{t("සටහනක් ලියන්න")}</button></div>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-grid"><label>{t("ලේඛනයේ නම")}{mode === "file" && <small>{t("විකල්පයි; ගොනු කිහිපයක් නම් ගොනු නම භාවිත වේ")}</small>}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={255} required={mode === "text"} placeholder={t("උදා: ප්‍රභාසංස්ලේෂණය")}/></label><label>{t("විෂය")}<small>{t("විකල්පයි")}</small><input value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} list="subject-list" placeholder={t("උදා: විද්‍යාව")}/><datalist id="subject-list">{subjects.map(s => <option key={s} value={s}/>)}</datalist></label></div>
          {mode === "file" ? <div className={`drop-zone${dragging ? " dragging" : ""}`} onDragOver={e => { e.preventDefault(); if (!busy)
            setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy)
            chooseFiles(Array.from(e.dataTransfer.files)); }}>
            <Icon name="document" size={32}/><strong>{t("ගොනු තෝරන්න හෝ මෙතැනට ඇද දමන්න")}</strong><p>{t("PDF, TXT, MD, DOCX, PNG, JPG, WEBP · ගොනුවකට උපරිම 25 MB")}</p>
            <input ref={fileInput} aria-label={t("ගොනු තෝරන්න")} type="file" multiple accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg,.webp" onChange={e => chooseFiles(Array.from(e.target.files ?? []))}/>
            {files.length > 0 && <ul className="selected-files">{files.map((file, i) => <li key={`${file.name}-${i}`}>{file.name} <span>({(file.size / 1024).toFixed(1)} KB)</span></li>)}</ul>}
          </div> : <label className="note-input">{t("සටහනේ අන්තර්ගතය")}<textarea value={content} onChange={e => setContent(e.target.value)} minLength={20} maxLength={200000} required rows={8} placeholder={t("ඔබේ පාඩම් සටහන මෙතැනට පිටපත් කරන්න…")}/></label>}
          <div className="form-actions"><p>{t("ස්කෑන් කළ පිටු සඳහා සිංහල සහ ඉංග්‍රීසි අකුරු හඳුනාගැනීම භාවිත වේ.")}</p><button className="primary-button" type="submit">{busy ? t("එක් කරමින්…") : mode === "file" ? t("ගොනු එක් කරන්න") : t("සටහන සුරකින්න")}<Icon name="arrow" size={17}/></button></div>
        </fieldset>
      </form>
      {message && <p className="notice success" role="status">{message}</p>}{failure && <p className="notice error" role="alert">{failure}</p>}
    </section>
    <section className="library-list" aria-labelledby="documents-heading">
      <div className="section-heading"><h2 id="documents-heading">{t("ලේඛන එකතුව")}<span className="count-badge">{documents.length}</span></h2><button className="text-button" onClick={() => void refresh()}>{t("නැවත පූරණය කරන්න")}</button></div>
      <div className="filter-row"><input type="search" aria-label={t("ලේඛන සොයන්න")} placeholder={t("නම හෝ විෂය අනුව සොයන්න…")} value={search} onChange={e => setSearch(e.target.value)}/><select aria-label={t("විෂය අනුව පෙරන්න")} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}><option value="">{t("සියලු විෂයන්")}</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></div>
      {error && <p className="notice error" role="alert">{t(error)}</p>}
      {loading ? <p className="empty-state" role="status">{t("ලේඛන ලබාගනිමින්…")}</p> : visible.length === 0 ? <div className="empty-state"><Icon name="book" size={32}/><h3>{documents.length ? t("ගැළපෙන ලේඛන නැත") : t("ඔබේ පළමු පාඩම එක් කරන්න")}</h3><p>{documents.length ? t("සෙවුම හෝ විෂය වෙනස් කරන්න.") : t("ඉහත ගොනු තේරීම භාවිත කරන්න, නැත්නම් සටහනක් ලියන්න.")}</p></div> : <div className="document-grid">{visible.map(d => <article key={d.id} className="document-card">
        <div className="document-card-top"><span className="method-icon blue"><Icon name="document"/></span><span className={`document-status ${d.status}`}>{t(statusLabels[d.status])}</span></div>
        <h3>{d.title}</h3><p className="document-meta">{d.subject} · {(d.file_size / 1024).toFixed(1)} KB{d.page_count > 0 && ` · ${d.page_count} ${d.extraction_method === "sections" || /\.(txt|md)$/i.test(d.filename) ? t("කොටස්") : t("පිටු")}`}</p><p className="filename">{d.filename}</p>
        {d.error && <p className="document-error">{t(d.error)}</p>}
        {d.status === "ready" && <div className="card-links"><Link href={`/documents/${d.id}`}>{t("කියවන්න")}</Link><Link href={`/chat?document=${d.id}`}>{t("ප්‍රශ්න අහන්න")}</Link><Link href={`/audio-review?document=${d.id}`}>{t("හඬ සමාලෝචනය", "Audio Review")}</Link><Link href={`/practice?document=${d.id}`}>{t("පුහුණු වන්න")}</Link></div>}
        {(d.status === "pending" || d.status === "processing") && <p className="processing-hint" role="status">{t("අකුරු කියවූ පසු ස්වයංක්‍රීයව යාවත්කාලීන වේ. ස්කෑන් කළ පිටුවකට තත්පර කිහිපයක් ගත විය හැක.")}</p>}
        <div className="document-actions">{d.status === "failed" && <button className="text-button" disabled={actionId === d.id} onClick={() => void documentAction(d.id, "retry")}>{t("නැවත උත්සාහ කරන්න")}</button>}{confirmId !== d.id ? <button className="text-button danger" disabled={actionId === d.id} onClick={() => setConfirmId(d.id)}>{t("ඉවත් කරන්න")}</button> : <div className="delete-confirm"><p>{t("මෙම ලේඛනය සහ එහි සුරැකි අකුරු ඉවත් කරන්නද?")}</p><button className="text-button danger" disabled={actionId === d.id} onClick={() => void documentAction(d.id, "delete")}>{t("ඔව්, ඉවත් කරන්න")}</button><button className="text-button" disabled={actionId === d.id} onClick={() => setConfirmId("")}>{t("අවලංගු කරන්න")}</button></div>}</div>
      </article>)}</div>}
    </section>
    </div>
  </div>;
}
