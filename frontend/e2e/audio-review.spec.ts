import { test, expect } from "@playwright/test";

let documentId: string;
test.beforeAll(async ({ request }) => {
  const response = await request.post("http://localhost:8001/documents/text", { data: {
    title: "Audio revision test", content: "Plants use sunlight to produce glucose through photosynthesis. Chlorophyll absorbs light energy. Roots absorb water and minerals from the soil. Oxygen is released during photosynthesis. ".repeat(3),
  } });
  expect(response.status()).toBe(202);
  documentId = (await response.json()).id;
  await expect.poll(async () => (await (await request.get(`http://localhost:8001/documents/${documentId}`)).json()).status).toBe("ready");
});

// A real playable WAV fixture tests the browser; provider validation and actual
// Gemini synthesis are checked independently by backend tests and live smoke QA.
function wav() {
  const bytes = Buffer.alloc(44 + 24000 * 2 * 3);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24); bytes.writeUInt32LE(48000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < 72000; i++) bytes.writeInt16LE(Math.round(Math.sin(i * 440 * 2 * Math.PI / 24000) * 2000), 44 + i * 2);
  return bytes;
}

for (const language of ["en", "si"] as const) {
  test(`audio generation, playback, download and saved replay in ${language}`, async ({ page }, info) => {
    await page.addInitScript(lang => localStorage.setItem("akura-language", lang), language);
    let scriptSaved = false, audioSaved = false, calls = 0;
    const point = { text: language === "si" ? "හරිත ශාක සූර්යාලෝකයෙන් ආහාර නිපදවයි." : "Green plants produce food using sunlight.", source: { document_id: documentId, title: "Audio revision test", page: 1 } };
    const summary = { document_id: documentId, title: language === "si" ? "ශාකවල ක්‍රියාවලි" : "Plant processes", language, focus: "", mode: "gemini", generated_at: "2026-11-14T00:00:00Z", sections: [{ heading: language === "si" ? "ආහාර නිෂ්පාදනය" : "Food production", points: [point] }], key_terms: [], revision_points: [point], coverage: { text_truncated: false, included_pages: 1, total_pages: 1 } };
    const review = { id: "a".repeat(64), document_id: documentId, language, text: point.text, duration_seconds: 3, generated_at: summary.generated_at, url: `/documents/${documentId}/audio/${"a".repeat(64)}` };
    await page.route(/^http:\/\/localhost:8000\//, async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/summary")) {
        if (route.request().method() === "POST") { scriptSaved = true; return route.fulfill({ json: summary }); }
        return route.fulfill({ json: { summary: scriptSaved ? summary : null } });
      }
      if (url.pathname.endsWith("/audio-review")) {
        if (route.request().method() === "POST") { calls++; audioSaved = true; return route.fulfill({ json: review }); }
        return route.fulfill({ json: { audio: audioSaved ? review : null } });
      }
      if (url.pathname === review.url) return route.fulfill({ body: wav(), contentType: "audio/wav", headers: url.searchParams.has("download") ? { "Content-Disposition": "attachment; filename=review.wav" } : {} });
      return route.fulfill({ response: await route.fetch({ url: `http://localhost:8001${url.pathname}${url.search}` }) });
    });
    await page.goto(`/audio-review?document=${documentId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(language === "si" ? "හඬ සමාලෝචනය" : "Audio Review");
    await page.getByRole("button", { name: language === "si" ? "කියවන සාරාංශය සකසන්න" : "Prepare review script", exact: true }).click();
    const create = page.getByRole("button", { name: language === "si" ? "හඬ සමාලෝචනය සාදන්න" : "Create audio review", exact: true });
    await expect(create).toBeEnabled();
    await create.click();
    const player = page.locator("audio");
    await expect(player).toBeVisible();
    await expect.poll(() => player.evaluate(el => (el as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(1);
    await player.evaluate(el => (el as HTMLAudioElement).play());
    await expect.poll(() => player.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0.1);
    await player.evaluate(el => (el as HTMLAudioElement).pause());
    await page.getByLabel(language === "si" ? "කියවන වේගය" : "Playback speed").selectOption("1.5");
    expect(await player.evaluate(el => (el as HTMLAudioElement).playbackRate)).toBe(1.5);
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /Download audio|හඬ බාගන්න/ }).click();
    expect((await download).suggestedFilename()).toBe("review.wav");
    await page.reload();
    await expect(player).toBeVisible();
    expect(calls).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../.artifacts/qa/audio-${language}-${info.project.name}.png`, fullPage: true });
    await page.unrouteAll({ behavior: "wait" });
  });
}
