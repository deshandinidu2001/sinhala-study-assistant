import { Suspense } from "react";
import { ChatWorkspace } from "@/components/chat-workspace";
export default function ChatPage() { return <Suspense fallback={<p className="overview">ප්‍රශ්න අවකාශය ලබාගනිමින්…</p>}><ChatWorkspace /></Suspense>; }
