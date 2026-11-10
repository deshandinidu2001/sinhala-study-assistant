import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "@/lib/language";
function Example() {
  const { language, setLanguage, t } = useLanguage();
  return <><button onClick={() => setLanguage(language === "si" ? "en" : "si")}>Switch</button><h1>{t("ලේඛනයක් එක් කරන්න")}</h1><p>{t("පුහුණුව", "Practice")}</p><article>රුධිර පටකයේ කාර්යයන්</article></>;
}
beforeEach(() => localStorage.clear());
afterEach(() => { localStorage.clear(); document.documentElement.lang = "si"; });
describe("interface language", () => {
  it("switches interface text and document language, preserves source text, and persists", async () => {
    const { unmount } = render(<LanguageProvider><Example /></LanguageProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(screen.getByRole("heading")).toHaveTextContent("Add source");
    expect(screen.getByText("Practice")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent("රුධිර පටකයේ කාර්යයන්");
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(localStorage.getItem("akura-language")).toBe("en");
    unmount();
    render(<LanguageProvider><Example /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole("heading")).toHaveTextContent("Add source"));
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(screen.getByRole("heading")).toHaveTextContent("ලේඛනයක් එක් කරන්න");
  });
});
