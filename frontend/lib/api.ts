export type Health = { status: "ok"; database: "ok" };

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
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
