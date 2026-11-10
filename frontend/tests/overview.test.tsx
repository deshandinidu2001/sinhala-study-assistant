import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudyOverview } from "@/components/study-overview";
vi.mock("@/lib/use-documents", () => ({ useDocuments: () => ({ documents: [], loading: false, error: "" }) }));
describe("study desk", () => {
  it("links directly to sources, questions and practice without promotional sections", () => {
    render(<StudyOverview />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("අධ්‍යයන මේසය");
    expect(screen.getByRole("link", { name: /සටහන්වලින් ප්‍රශ්නයක් අහන්න/ })).toHaveAttribute("href", "/chat");
    expect(screen.getByRole("link", { name: /දැනුම පරීක්ෂා කරන්න/ })).toHaveAttribute("href", "/practice");
    expect(screen.getAllByRole("link", { name: "ලේඛනයක් එක් කරන්න" })[0]).toHaveAttribute("href", "/documents#upload");
    expect(screen.getByRole("region", { name: "මෑත ලේඛන" })).toBeInTheDocument();
  });
});
