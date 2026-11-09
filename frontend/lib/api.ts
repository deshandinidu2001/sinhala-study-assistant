export type Health = { status: "ok"; database: "ok" };

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export type StudyDocument = {
  id: string; title: string; subject: string; filename: string; page_count: number;
  status: "pending" | "processing" | "ready" | "failed"; file_size: number;
  error: string | null; extraction_method: string | null; uploaded_at: string;
};
export type Source = { document_id: string; title: string; page: number; excerpt?: string; ocr?: boolean; section?: boolean };
export type Chat = { id: string; question: string; answer: string; sources: Source[]; mode: "extractive" | "no_match"; created_at: string };
export type QuizQuestion = { prompt: string; options: string[] };
export type Quiz = { id: string; subject: string; questions: QuizQuestion[] };
export type QuizResult = { score: number; total: number; questions: (QuizQuestion & { answer_index: number; selected_index: number; correct: boolean; explanation: string; source: Source })[] };
export type DocumentDetail = StudyDocument & { pages: { page: number; text: string; ocr: boolean }[] };

export function apiUrl(path: string): string {
  return `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}${path}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const timeout = AbortSignal.timeout(60_000);
  try {
    response = await fetch(apiUrl(path), { ...options, cache: "no-store", signal: options.signal ?? timeout,
      headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options.headers } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && options.signal?.aborted) throw error;
    throw new ApiError(0, "සේවාවට සම්බන්ධ විය නොහැක. සම්බන්ධතාව පරීක්ෂා කර නැවත උත්සාහ කරන්න.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof data?.detail === "string" ? data.detail : "ඉල්ලීම සම්පූර්ණ කළ නොහැක. නැවත උත්සාහ කරන්න.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const response = await fetch(`${origin.replace(/\/$/, "")}/health`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ApiError(response.status, "සේවාවට සම්බන්ධ විය නොහැක.");
  }
  const data: unknown = await response.json();
  if (
    typeof data !== "object" || data === null ||
    !("status" in data) || data.status !== "ok" ||
    !("database" in data) || data.database !== "ok"
  ) {
    throw new ApiError(502, "සේවාවේ තත්ත්වය තහවුරු කළ නොහැක.");
  }
  return { status: "ok", database: "ok" };
}
