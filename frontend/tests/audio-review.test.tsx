import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioReviewPlayer, type AudioOptions } from "@/components/audio-review-player";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: vi.fn(), apiUrl: (path: string) => `http://localhost:8000${path}` }));
const options: AudioOptions = { language: "si", focus: "", length: "short", include: ["definitions"], provider: "gemini" };
const recording = { id: "saved", document_id: "source", language: "si", text: "සිංහල පාඩමේ සාරාංශය", duration_seconds: 30, generated_at: "now", url: "/documents/source/audio/saved" };
afterEach(() => vi.resetAllMocks());

describe("audio review", () => {
  it("generates only on request, then offers controls, script and download", async () => {
    vi.mocked(api).mockResolvedValueOnce({ audio: null }).mockResolvedValueOnce(recording);
    render(<AudioReviewPlayer documentId="source" options={options} />);
    const button = await screen.findByRole("button", { name: "හඬ සමාලෝචනය සාදන්න" });
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    const player = await screen.findByLabelText("පාඩමේ හඬ සමාලෝචනය") as HTMLAudioElement;
    expect(player).toHaveAttribute("controls");
    expect(player).not.toHaveAttribute("autoplay");
    fireEvent.change(screen.getByLabelText("කියවන වේගය"), { target: { value: "1.5" } });
    expect(player.playbackRate).toBe(1.5);
    expect(screen.getByRole("link", { name: /හඬ බාගන්න/ })).toHaveAttribute("href", "http://localhost:8000/documents/source/audio/saved?download=true");
    expect(screen.getByText(recording.text)).toBeInTheDocument();
    expect(JSON.parse(vi.mocked(api).mock.calls[1][1]!.body as string)).toEqual(options);
  });

  it("restores saved audio without generating again", async () => {
    vi.mocked(api).mockResolvedValueOnce({ audio: recording });
    render(<AudioReviewPlayer documentId="source" options={options} />);
    expect(await screen.findByLabelText("පාඩමේ හඬ සමාලෝචනය")).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows provider failures and allows retry", async () => {
    vi.mocked(api).mockResolvedValueOnce({ audio: null }).mockRejectedValueOnce(new Error("සේවාව අක්‍රියයි"));
    render(<AudioReviewPlayer documentId="source" options={options} />);
    fireEvent.click(await screen.findByRole("button", { name: "හඬ සමාලෝචනය සාදන්න" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("සේවාව අක්‍රියයි");
    expect(screen.getByRole("button", { name: "හඬ සමාලෝචනය සාදන්න" })).toBeEnabled();
  });

  it("aborts generation on source changes and ignores a stale response", async () => {
    let resolve!: (value: typeof recording) => void;
    vi.mocked(api).mockResolvedValueOnce({ audio: null }).mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ audio: null });
    const { rerender } = render(<AudioReviewPlayer documentId="source" options={options} />);
    fireEvent.click(await screen.findByRole("button", { name: "හඬ සමාලෝචනය සාදන්න" }));
    const signal = vi.mocked(api).mock.calls[1][1]!.signal!;
    rerender(<AudioReviewPlayer documentId="other-source" options={options} />);
    expect(signal.aborted).toBe(true);
    resolve(recording);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
    expect(screen.queryByLabelText("පාඩමේ හඬ සමාලෝචනය")).not.toBeInTheDocument();
  });
});
