"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, apiUrl, type AudioReview } from "@/lib/api";
import { useLanguage } from "@/lib/language";
type Output = { id: string; type: string; title: string; language: string; created_at: string; document_id: string | null };
export function SavedStudio({ workspaceId }: { workspaceId: string }) {
  const { t } = useLanguage(); const params = useSearchParams(); const [items,setItems] = useState<Output[]>([]); const [error,setError] = useState("");
  useEffect(() => { const controller = new AbortController(); const refresh = () => api<Output[]>("/studio", {signal:controller.signal}).then(setItems).catch(e => { if(!controller.signal.aborted) setError(e.message); }); void refresh(); window.addEventListener("akura:sources",refresh); return () => { controller.abort(); window.removeEventListener("akura:sources",refresh); }; }, [workspaceId,params]);
  return <section className="saved-studio"><h3>{t("සුරැකි පාඩම්", "Saved study outputs")}</h3>{error && <p role="alert">{t(error)}</p>}{!items.length && <p>{t("ඔබ සාදන සාරාංශ, ප්‍රශ්න සහ හඬ මෙහි පෙන්වයි.", "Your summaries, quizzes, and recordings will appear here.")}</p>}{items.map(item => <Link key={`${item.type}-${item.id}`} href={`/workspaces/${workspaceId}?${new URLSearchParams({tool:item.type === "quiz" ? "practice" : item.type === "audio" ? "saved-audio" : "summaries", ...(item.document_id ? {document:item.document_id}:{}), [item.type === "quiz" ? "quiz" : item.type === "audio" ? "audio" : "summary"]:item.id})}`}><strong>{item.title}</strong><span>{t(item.type === "quiz" ? "ප්‍රශ්න" : item.type === "audio" ? "හඬ" : "සාරාංශය",item.type)} · {item.language === "si" ? "සිංහල" : "English"}</span><time>{new Date(item.created_at).toLocaleDateString()}</time></Link>)}</section>;
}
export function SavedAudio({ documentId, identity }: {documentId:string;identity:string}) {
  const {t}=useLanguage(); const [review,setReview]=useState<AudioReview|null>(null); const [error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController(); api<AudioReview>(`/documents/${documentId}/saved-audio/${identity}`,{signal:controller.signal}).then(setReview).catch(e=>{if(!controller.signal.aborted)setError(e.message)}); return()=>controller.abort()},[documentId,identity]);
  return <section className="saved-audio tool-card"><h2>{t("හඬ සමාලෝචනය","Audio Overview")}</h2>{error && <p role="alert">{t(error)}</p>}{review && <><audio controls onError={()=>setError(t("හඬ වාදනය කළ නොහැක. නැවත විවෘත කර බලන්න.","Could not play this recording. Reopen it and try again."))} src={apiUrl(review.url)} aria-label={t("සුරැකි හඬ","Saved recording")} id="saved-recording"/><label>{t("කියවන වේගය","Playback speed")}<select aria-label={t("කියවන වේගය","Playback speed")} defaultValue="1" onChange={e=>{const player=document.getElementById("saved-recording") as HTMLAudioElement; player.playbackRate=Number(e.target.value)}}>{[0.75,1,1.25,1.5,2].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label><a className="secondary-button" href={apiUrl(`${review.url}?download=true`)}>{t("හඬ බාගන්න","Download audio")}</a><p className="audio-transcript" lang={review.language}>{review.text}</p></>}</section>;
}
