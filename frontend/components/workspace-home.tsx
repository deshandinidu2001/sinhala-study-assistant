"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { Icon } from "@/components/icon";

export type Workspace = { id: string; name: string; description: string; source_count: number; updated_at: string };
export function WorkspaceForm({ initial, onSaved, onCancel }: { initial?: Workspace; onSaved: (workspace: Workspace) => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); if (!name.trim() || busy) return;
    setBusy(true); setError("");
    try { onSaved(await api<Workspace>(initial ? `/workspaces/${initial.id}` : "/workspaces", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim() }) })); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  return <form className="workspace-editor" onSubmit={save} onKeyDown={event => { if (event.key === "Escape" && !busy) onCancel(); }} aria-label={initial ? t("නම වෙනස් කරන්න", "Rename workspace") : t("අලුත් අවකාශයක්", "Create workspace")}>
    <label>{t("අවකාශයේ නම", "Workspace name")}<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
    <label>{t("කෙටි විස්තරයක් (විකල්පයි)", "Description (optional)")}<input maxLength={500} value={description} onChange={e => setDescription(e.target.value)} disabled={busy} /></label>
    {error && <p role="alert" className="notice error">{t(error)}</p>}
    <div className="form-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>{t("අවලංගු කරන්න", "Cancel")}</button><button className="primary-button" disabled={busy || !name.trim()}>{busy ? t("සුරකිමින්…", "Saving…") : t("සුරකින්න", "Save workspace")}</button></div>
  </form>;
}
export function WorkspaceHome() {
  const { t, language } = useLanguage(); const router = useRouter();
  const [items, setItems] = useState<Workspace[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Workspace | "new" | null>(null); const [attempt, setAttempt] = useState(0);
  useEffect(() => { const controller = new AbortController(); setLoading(true);
    api<Workspace[]>("/workspaces", { signal: controller.signal }).then(data => { setItems(data); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const filtered = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="workspace-home">
    <section className="workspace-intro"><div><h1>{t("ඔබේ සටහන්. පැහැදිලි ඉගෙනීමක්.", "Your notes. A clearer way to learn.")}</h1><p>{t("පාඩම් එකතු කර, මූලාශ්‍ර සමඟ ප්‍රශ්න අසන්න. සාරාංශ, ප්‍රශ්න සහ හඬ සමාලෝචන සමඟ නැවත පාඩම් කරන්න.", "Bring your study materials together, ask questions with sources, and turn your notes into summaries, quizzes, and audio overviews.")}</p></div><button className="primary-button" onClick={() => setEditing("new")}><Icon name="plus" size={18}/>{t("අවකාශයක් සාදන්න", "Create workspace")}</button></section>
    {editing && <WorkspaceForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSaved={workspace => { if (editing === "new") router.push(`/workspaces/${workspace.id}`); else { setItems(current => current.map(w => w.id === workspace.id ? workspace : w)); setEditing(null); } }} />}
    <div className="workspace-list-heading"><h2>{t("ඔබේ අධ්‍යයන අවකාශ", "Your workspaces")}</h2><input aria-label={t("අවකාශ සොයන්න", "Search workspaces")} placeholder={t("නමින් සොයන්න…", "Search by name…")} value={search} onChange={e => setSearch(e.target.value)} /></div>
    {loading && <p role="status">{t("පූරණය වෙමින්…", "Loading workspaces…")}</p>}
    {error && <div role="alert" className="notice error">{t(error)} <button onClick={() => setAttempt(n => n + 1)}>{t("නැවත උත්සාහ කරන්න", "Retry")}</button></div>}
    {!loading && !error && !filtered.length && <div className="workspace-empty"><Icon name="book" size={40}/><h2>{search ? t("ගැළපෙන අවකාශ නැත", "No matching workspaces") : t("ඔබේ පළමු පාඩමෙන් පටන් ගන්න", "Make room for your first subject")}</h2><p>{search ? t("වෙනත් නමක් සොයන්න.", "Try another name.") : t("අවකාශයක් සාදා ඔබේ සටහන් එක් කරන්න.", "Create a workspace and add your notes.")}</p></div>}
    <div className="workspace-grid">{filtered.map(item => <article className="workspace-card" key={item.id}><Link href={`/workspaces/${item.id}`} className="workspace-card-open"><span className="workspace-book"><Icon name="book" size={28}/></span><h3>{item.name}</h3><p>{item.description || t("ඔබේ ඊළඟ පාඩම සඳහා අවකාශයක්.", "A place for your next study session.")}</p><div className="workspace-card-meta"><span>{item.source_count} {t("මූලාශ්‍ර", "sources")}</span><time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleDateString(language === "si" ? "si-LK" : "en-GB")}</time></div></Link><button className="text-button" onClick={() => setEditing(item)} aria-label={`${t("නම වෙනස් කරන්න", "Rename")} ${item.name}`}>{t("නම වෙනස් කරන්න", "Rename")}</button></article>)}</div>
  </div>;
}
