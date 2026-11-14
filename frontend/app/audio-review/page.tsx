import { Suspense } from "react";
import { SummaryWorkspace } from "@/components/summary-workspace";
export default function AudioReviewPage() {
  return <Suspense><SummaryWorkspace audioReview /></Suspense>;
}
