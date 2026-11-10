"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Quiz, type QuizResult } from "@/lib/api";
import { useDocuments } from "@/lib/use-documents";
import { SourceLink } from "@/components/source-link";
import { Icon } from "@/components/icon";
export function PracticeWorkspace() {
    const { t } = useLanguage();
    const params = useSearchParams();
    const { documents, loading, error: documentsError } = useDocuments();
    const [selected, setSelected] = useState(params.get("document") ?? "");
    const [subject, setSubject] = useState("");
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [answers, setAnswers] = useState<number[]>([]);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const ready = documents.filter(d => d.status === "ready");
    const subjects = [...new Set(ready.map(d => d.subject))].sort();
    const validSelected = ready.some(d => d.id === selected) ? selected : "";
    useEffect(() => { setSelected(params.get("document") ?? ""); }, [params]);
    async function create() {
        setBusy(true);
        setError("");
        try {
            const next = await api<Quiz>("/quizzes", { method: "POST", body: JSON.stringify({ subject: subject || null, document_id: validSelected || null, count: 5 }) });
            setQuiz(next);
            setAnswers(next.questions.map(() => -1));
            setResult(null);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : t("ප්‍රශ්න සෑදිය නොහැක."));
        }
        finally {
            setBusy(false);
        }
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!quiz || busy || answers.includes(-1))
            return;
        setBusy(true);
        setError("");
        try {
            setResult(await api<QuizResult>(`/quizzes/${quiz.id}/submit`, { method: "POST", body: JSON.stringify({ answers }) }));
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : t("ලකුණු ලබාගත නොහැක."));
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="overview tool-page practice-page"><div className="page-intro"><h1>{t("පුහුණුව", "Practice")}</h1><p>{t("සටහන් ඇසුරින් ප්‍රශ්න 5ක්.", "Five questions from your notes.")}</p></div>
    {documentsError && <p className="notice error" role="alert">{documentsError}</p>}
    {!loading && ready.length === 0 ? <div className="empty-state tool-card"><Icon name="quiz" size={36}/><h2>{t("පුහුණුව සඳහා පාඩමක් එක් කරන්න")}</h2><p>{t("සම්පූර්ණ වාක්‍ය සහිත සටහනක් එක් කර එය සූදානම් වන තෙක් රැඳී සිටින්න.")}</p><Link href="/documents" className="primary-button">{t("ලේඛනයක් එක් කරන්න")}</Link></div> : <section className="tool-card practice-setup" aria-label={t("පුහුණුව සකසන්න")}><div className="scope-bar"><label>{t("විෂය")}<select value={subject} onChange={e => { setSubject(e.target.value); setSelected(""); }} disabled={busy}><option value="">{t("සියලු විෂයන්")}</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label>{t("ලේඛනය")}<select value={validSelected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">{t("සියලු සූදානම් ලේඛන")}</option>{ready.filter(d => !subject || d.subject === subject).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label></div><div className="form-actions"><p>{t("ප්‍රශ්න 5 දක්වා. කෙටි සටහනක් නම් ලැබෙන ප්‍රශ්න ගණන අඩු විය හැක.")}</p><button className="primary-button" onClick={() => void create()} disabled={busy || !ready.length}>{busy && !quiz ? t("ප්‍රශ්න සකසමින්…") : quiz ? t("අලුත් පුහුණුවක්") : t("පුහුණුව අරඹන්න")}<Icon name="arrow" size={17}/></button></div></section>}
    {error && <p className="notice error" role="alert">{t(error)}</p>}
    {quiz && <form className="quiz-form" onSubmit={submit}>
      {result && <div className="quiz-score" role="status"><Icon name="check" size={28}/><div><h2>{t("ඔබේ ලකුණු:", "Your score:")} {result.score} / {result.total}</h2><p>{t("පහතින් නිවැරදි පිළිතුරු සහ මූලාශ්‍ර කියවා බලන්න.")}</p></div></div>}
      <div className="section-heading"><h2>{quiz.questions.length} {t("ප්‍රශ්න", "questions")}</h2><span>{answers.filter(a => a >= 0).length} / {quiz.questions.length} {t("පිළිතුරු තෝරා ඇත", "answered")}</span></div>
      {quiz.questions.map((question, i) => { const graded = result?.questions[i]; return <fieldset className={`quiz-question tool-card${graded ? graded.correct ? " correct" : " incorrect" : ""}`} key={`${quiz.id}-${i}`} disabled={busy || !!result}><legend>{t("ප්‍රශ්නය", "Question")} {i + 1}</legend><p className="quiz-prompt">{question.prompt.replace("හිස්තැනට සුදුසු වචනය තෝරන්න.", t("හිස්තැනට සුදුසු වචනය තෝරන්න.", "Choose the missing word."))}</p><div className="quiz-options">{question.options.map((option, j) => <label key={j} className={`${answers[i] === j ? "selected " : ""}${graded?.answer_index === j ? "correct-option" : ""}`}><input type="radio" name={`question-${i}`} value={j} checked={answers[i] === j} onChange={() => setAnswers(previous => previous.map((a, n) => n === i ? j : a))} required/><span>{option}</span>{graded?.answer_index === j && <Icon name="check" size={17}/>}</label>)}</div>{graded && <div className="quiz-explanation"><strong>{graded.correct ? t("නිවැරදියි") : `${t("නිවැරදි පිළිතුර:", "Correct answer:")} ${question.options[graded.answer_index]}`}</strong><p>{graded.explanation}</p><SourceLink source={graded.source}/></div>}</fieldset>; })}
      {!result && <div className="quiz-submit"><p>{t("ලකුණු බැලීමට සියලු ප්‍රශ්නවලට පිළිතුරු තෝරන්න.")}</p><button className="primary-button" disabled={busy || answers.includes(-1)} type="submit">{busy ? t("පරීක්ෂා කරමින්…") : t("ලකුණු බලන්න")}</button></div>}
    </form>}
  </div>;
}
