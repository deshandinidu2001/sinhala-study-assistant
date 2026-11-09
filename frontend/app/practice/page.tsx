import { Suspense } from "react";
import { PracticeWorkspace } from "@/components/practice-workspace";
export default function PracticePage() { return <Suspense fallback={<p className="overview">පුහුණුව ලබාගනිමින්…</p>}><PracticeWorkspace /></Suspense>; }
