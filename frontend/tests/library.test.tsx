import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentsLibrary } from "@/components/documents-library";
import { api } from "@/lib/api";

const refresh = vi.fn();
vi.mock("@/lib/use-documents", () => ({ useDocuments: () => ({ documents: [], loading: false, error: "", refresh }) }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("working library forms", () => {
  it("rejects unsupported and empty files before sending a request", () => {
    render(<DocumentsLibrary />);
    fireEvent.change(screen.getByLabelText("ගොනු තෝරන්න"), { target: { files: [new File(["abc"], "malware.exe"), new File([], "empty.txt")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("සහාය නොදක්වන");
    expect(screen.getByRole("alert")).toHaveTextContent("හිස්ය");
    expect(api).not.toHaveBeenCalled();
  });

  it("sends actual file bytes and keeps failed uploads available to retry", async () => {
    vi.mocked(api).mockRejectedValueOnce(new Error("සේවාව අක්‍රියයි"));
    render(<DocumentsLibrary />);
    const file = new File(["සිංහල සටහන"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("ගොනු තෝරන්න"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "ගොනු එක් කරන්න" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("සේවාව අක්‍රියයි"));
    const options = vi.mocked(api).mock.calls[0][1]!;
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("file")).toBe(file);
    expect(screen.getByRole("button", { name: "ගොනු එක් කරන්න" })).toBeEnabled();
    expect(screen.getByRole("listitem")).toHaveTextContent("notes.txt");
    vi.mocked(api).mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "ගොනු එක් කරන්න" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ගොනු 1ක් එක් කෙරිණි"));
  });

  it("saves pasted notes through the persistent text endpoint", async () => {
    vi.mocked(api).mockResolvedValueOnce({});
    render(<DocumentsLibrary />);
    fireEvent.click(screen.getByRole("button", { name: "සටහනක් ලියන්න" }));
    fireEvent.change(screen.getByLabelText("ලේඛනයේ නම"), { target: { value: "විද්‍යාව සටහන්" } });
    fireEvent.change(screen.getByLabelText("සටහනේ අන්තර්ගතය"), { target: { value: "ශාක සූර්යාලෝකය මගින් ආහාර නිපදවයි. ප්‍රභාසංස්ලේෂණය ශාකවල වැදගත් ක්‍රියාවලියකි." } });
    fireEvent.click(screen.getByRole("button", { name: "සටහන සුරකින්න" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/documents/text", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(vi.mocked(api).mock.calls[0][1]!.body as string).title).toBe("විද්‍යාව සටහන්");
  });
});
