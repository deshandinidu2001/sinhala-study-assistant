import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PracticeWorkspace } from "@/components/practice-workspace";
import { LanguageProvider } from "@/lib/language";
import { api } from "@/lib/api";

const params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params, useParams: () => ({}) }));
vi.mock("@/lib/use-documents", () => ({ useDocuments: () => ({
  documents: [{ id: "source", title: "Science", subject: "Science", status: "ready" }], loading: false, error: "",
}) }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

it.each([1, 5, 10])("requests and displays the selected %i-question quiz", async count => {
  localStorage.setItem("akura-language", "en");
  vi.mocked(api).mockResolvedValue({ id: "quiz", questions: Array.from({ length: count }, (_, i) => ({
    prompt: `Question ${i + 1}`, options: ["A", "B", "C", "D"],
  })) });
  render(<LanguageProvider><PracticeWorkspace /></LanguageProvider>);
  const selector = await screen.findByRole("combobox", { name: "Number of questions" });
  expect(selector).toHaveValue("5");
  expect(selector.querySelectorAll("option")).toHaveLength(10);
  fireEvent.change(selector, { target: { value: String(count) } });
  expect(screen.getByText(`${count} ${count === 1 ? "question" : "questions"} · 4 options · Based on your sources`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
  await waitFor(() => expect(api).toHaveBeenCalledOnce());
  expect(JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string)).toMatchObject({ count, language: "en" });
  expect(await screen.findAllByRole("group")).toHaveLength(count);
});

it("labels quiz length in Sinhala and locks it during generation", async () => {
  vi.mocked(api).mockReturnValue(new Promise(() => {}));
  render(<LanguageProvider><PracticeWorkspace /></LanguageProvider>);
  const selector = screen.getByRole("combobox", { name: "ප්‍රශ්න ගණන" });
  fireEvent.change(selector, { target: { value: "3" } });
  expect(screen.getByText("ප්‍රශ්න 3 · පිළිතුරු 4 · පාඩම ඇසුරින්")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "පුහුණුව අරඹන්න" }));
  expect(selector).toBeDisabled();
});
