"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDocuments } from "@/lib/use-documents";
import { useLanguage } from "@/lib/language";
import { api } from "@/lib/api";
export function WorkspaceSources({ id, selected, onSelect }: { id: string; selected: string[]; onSelect: (ids: string[]) => void }) {
  const { documents, loading, error, refresh } = useDocuments(); const { t } = useLanguage();
  const [search, setSearch] = useState(""); const [failure, setFailure] = useState(""); const [busy, setBusy] = useState(false);
  const ready = documents.filter(d => d.status === "ready");
  const readyKey = ready.map(d => d.id).join(",");
  useEffect(() => { if (!loading) onSelect(selected.filter(id => readyKey.split(",").includes(id))); }, [readyKey, loading]);
  async function action(path: string, method: string) { setBusy(true); setFailure(""); try { await api(path,{method}); await refresh(); } catch(e) { setFailure((e as Error).message); } finally { setBusy(false); } }
  return <><div className="section-heading"><h2>{t("මූලාශ්‍ර","Sources")}</h2><span>{documents.length}</span></div><Link className="primary-button source-upload" href={`/workspaces/${id}?tool=documents#upload`}>{t("ගොනු හෝ සටහන් එක් කරන්න","Add files or notes")}</Link>
    <input aria-label={t("මූලාශ්‍ර සොයන්න","Search sources")} placeholder={t("මූලාශ්‍ර සොයන්න…","Search sources…")} value={search} onChange={e => setSearch(e.target.value)}/>
    {loading && <p role="status">{t("පූරණය වෙමින්…","Loading…")}</p>}{(error || failure) && <p className="notice error" role="alert">{t(error || failure)}</p>}
    <label className="workspace-source-check"><input type="checkbox" checked={!!ready.length && selected.length === ready.length} onChange={e => onSelect(e.target.checked ? ready.map(d => d.id) : [])}/>{t("සියලු සූදානම් මූලාශ්‍ර","All ready sources")}</label>
    {!selected.length && <p className="source-selection-hint">{t("සංවාදයට මූලාශ්‍රයක් තෝරන්න.","Select a source to start chatting.")}</p>}
    {!loading && !documents.length && <p className="source-selection-hint">{t("පාඩමක් එක් කර පටන් ගන්න.","Add your first note or document.")}</p>}
    {documents.filter(d => d.title.toLowerCase().includes(search.toLowerCase())).map(d => <article className="workspace-source" key={d.id}><label className="workspace-source-check"><input type="checkbox" disabled={d.status !== "ready"} checked={selected.includes(d.id)} onChange={e => onSelect(e.target.checked ? [...selected,d.id] : selected.filter(value => value !== d.id))}/><span>{d.title}</span></label><small>{t(d.status === "ready" ? "සූදානම්" : d.status === "failed" ? "අසාර්ථකයි" : "සකසමින්…", d.status)}</small>{d.error && <p className="notice error">{t(d.error)}</p>}<div className="workspace-source-actions">{d.status === "ready" && <Link href={`/workspaces/${id}?tool=reader&document=${d.id}`}>{t("කියවන්න","Read")}</Link>}{d.status === "failed" && <button disabled={busy} onClick={() => action(`/documents/${d.id}/retry`,"POST")}>{t("නැවත උත්සාහ කරන්න","Retry")}</button>}<button disabled={busy} onClick={() => { if (window.confirm(t("මෙම ලේඛනය සහ සුරැකි හඬ ඉවත් කරන්නද?","Remove this source and its saved recordings?"))) void action(`/documents/${d.id}`,"DELETE"); }}>{t("ඉවත් කරන්න","Remove")}</button></div></article>)}
  </>;
}
