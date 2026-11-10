import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const note = `ප්‍රභාසංස්ලේෂණය යනු හරිත ශාක සූර්යාලෝකය භාවිතයෙන් ආහාර නිපදවන ක්‍රියාවලියයි.
ශාක පත්‍රවල ඇති හරිතප්‍රද මගින් සූර්යාලෝක ශක්තිය අවශෝෂණය කරයි.
ප්‍රභාසංස්ලේෂණයේදී කාබන් ඩයොක්සයිඩ් සහ ජලය යොදා ග්ලූකෝස් නිපදවයි.
මෙම ක්‍රියාවලියේදී ඔක්සිජන් වායුව අතුරු ඵලයක් ලෙස පරිසරයට මුදාහරියි.
පත්‍රවල පූටිකා මගින් ශාකයට අවශ්‍ය වායු හුවමාරුව සිදු කරයි.
ශාකයේ මූල පද්ධතිය මගින් පසෙන් ජලය සහ ඛනිජ ලවණ අවශෝෂණය කරයි.`;

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test.beforeAll(async ({ request }) => {
  const response = await request.post("http://localhost:8001/documents/text", { data: { title: "පරීක්ෂණ පාඩම", content: note } });
  expect(response.status()).toBe(202);
  const { id } = await response.json();
  await expect.poll(async () => (await (await request.get(`http://localhost:8001/documents/${id}`)).json()).status).toBe("ready");
});

test.beforeEach(async ({ page }) => {
  await page.route(/^http:\/\/localhost:8000\//, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `http://localhost:8001${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
});

test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "wait" }); });

test("upload → ready → reader → cited answer → saved history → scored quiz", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "ලේඛනයක් එක් කරන්න", exact: true }).click();
  await expect(page).toHaveURL(/\/documents$/);
  const title = `ජීව විද්‍යාව ${info.project.name}`;
  await page.getByPlaceholder("උදා: ප්‍රභාසංස්ලේෂණය").fill(title);
  await page.getByPlaceholder("උදා: විද්‍යාව").fill("විද්‍යාව");
  await page.getByLabel("ගොනු තෝරන්න", { exact: true }).setInputFiles({ name: "science.txt", mimeType: "text/plain", buffer: Buffer.from(note) });
  const uploaded = page.waitForResponse(response => response.url().endsWith("/documents") && response.request().method() === "POST");
  await page.getByRole("button", { name: "ගොනු එක් කරන්න", exact: true }).click();
  const response = await uploaded;
  expect(response.status()).toBe(202);
  const document = await response.json();
  const card = page.locator(".document-card").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card.getByText("සූදානම්", { exact: true })).toBeVisible({ timeout: 45_000 });
  await noOverflow(page);
  await page.screenshot({ path: `../.artifacts/qa/${info.project.name}-library.png`, fullPage: true });
  await card.getByRole("link", { name: "කියවන්න", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${document.id}$`));
  await expect(page.locator("article.source-page")).toContainText("හරිතප්‍රද");
  await page.getByRole("link", { name: "මෙම පාඩමෙන් ප්‍රශ්න අහන්න", exact: true }).click();
  await page.getByLabel("ඔබේ ප්‍රශ්නය", { exact: true }).fill("ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?");
  await page.getByRole("button", { name: "ප්‍රශ්නය යවන්න", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "ඔබේ ප්‍රශ්නය", exact: true })).toHaveValue("");
  const exchange = page.locator(".chat-exchange").last();
  await expect(exchange.locator(".answer-bubble")).toContainText("ආහාර නිපදවන");
  await expect(exchange.locator(".source-link")).toHaveAttribute("href", `/documents/${document.id}?page=1`);
  await noOverflow(page);
  await page.screenshot({ path: `../.artifacts/qa/${info.project.name}-chat.png`, fullPage: true });
  await exchange.locator(".source-link").click();
  await expect(page.locator("article.source-page")).toContainText("ප්‍රභාසංස්ලේෂණය");
  await page.getByRole("link", { name: "මෙම පාඩමෙන් ප්‍රශ්න අහන්න", exact: true }).click();
  await expect(page.locator(".chat-exchange").last()).toContainText("ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?");
  await page.getByLabel("ඔබේ ප්‍රශ්නය", { exact: true }).fill("ගිනිකඳු යනු කුමක්ද?");
  await page.getByRole("button", { name: "ප්‍රශ්නය යවන්න", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "ඔබේ ප්‍රශ්නය", exact: true })).toHaveValue("");
  await expect(page.locator(".chat-exchange").last().locator(".answer-bubble")).toContainText("තොරතුරු හමු නොවීය");
  await page.goto(`/practice?document=${document.id}`);
  await page.getByRole("button", { name: "පුහුණුව අරඹන්න", exact: true }).click();
  await expect(page.locator(".quiz-question")).toHaveCount(5);
  for (const fieldset of await page.locator(".quiz-question").all()) await fieldset.getByRole("radio").first().check();
  await page.getByRole("button", { name: "ලකුණු බලන්න", exact: true }).click();
  await expect(page.locator(".quiz-score")).toContainText(/ඔබේ ලකුණු: \d \/ 5/);
  await expect(page.locator(".quiz-explanation .source-link")).toHaveCount(5);
  await noOverflow(page);
  await page.screenshot({ path: `../.artifacts/qa/${info.project.name}-practice.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("pasted notes, failed upload recovery, filters, and confirmed removal", async ({ page }, info) => {
  await page.goto("/documents");
  await page.getByLabel("ගොනු තෝරන්න", { exact: true }).setInputFiles({ name: "bad.exe", mimeType: "application/octet-stream", buffer: Buffer.from("invalid") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("සහාය නොදක්වන");
  await page.getByLabel("ගොනු තෝරන්න", { exact: true }).setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("invalid pdf") });
  await page.getByRole("button", { name: "ගොනු එක් කරන්න", exact: true }).click();
  const broken = page.locator(".document-card").filter({ has: page.getByRole("heading", { name: "broken", exact: true }) }).first();
  await expect(broken.getByText("සැකසීම අසාර්ථකයි", { exact: true })).toBeVisible();
  await broken.getByRole("button", { name: "නැවත උත්සාහ කරන්න", exact: true }).click();
  await expect(broken.getByText("සැකසීම අසාර්ථකයි", { exact: true })).toBeVisible();
  await broken.getByRole("button", { name: "ඉවත් කරන්න", exact: true }).click();
  await broken.getByRole("button", { name: "ඔව්, ඉවත් කරන්න", exact: true }).click();
  await page.getByRole("button", { name: "සටහනක් ලියන්න", exact: true }).click();
  const title = `ලියූ සටහන ${info.project.name}`;
  await page.getByLabel("ලේඛනයේ නම", { exact: true }).fill(title);
  await page.getByLabel("සටහනේ අන්තර්ගතය", { exact: true }).fill(note);
  await page.getByRole("button", { name: "සටහන සුරකින්න", exact: true }).click();
  const card = page.locator(".document-card").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card.getByText("සූදානම්", { exact: true })).toBeVisible();
  await page.getByLabel("ලේඛන සොයන්න", { exact: true }).fill("no such document");
  await expect(page.getByRole("heading", { name: "ගැළපෙන ලේඛන නැත", exact: true })).toBeVisible();
  await page.getByLabel("ලේඛන සොයන්න", { exact: true }).fill(title);
  await card.getByRole("button", { name: "ඉවත් කරන්න", exact: true }).click();
  await card.getByRole("button", { name: "අවලංගු කරන්න", exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "ඉවත් කරන්න", exact: true }).click();
  await card.getByRole("button", { name: "ඔව්, ඉවත් කරන්න", exact: true }).click();
  await expect(card).toHaveCount(0);
});

test("unavailable API keeps the question and permits retry", async ({ page }) => {
  await page.goto("/chat");
  const question = page.getByRole("textbox", { name: "ඔබේ ප්‍රශ්නය", exact: true });
  await expect(question).toBeEnabled();
  await page.route("**/chat", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "සේවාව තාවකාලිකව නොමැත." }) }));
  await question.fill("ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?");
  await page.getByRole("button", { name: "ප්‍රශ්නය යවන්න", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("සේවාව තාවකාලිකව නොමැත");
  await expect(question).toHaveValue("ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?");
  await expect(page.getByRole("button", { name: "ප්‍රශ්නය යවන්න", exact: true })).toBeEnabled();
});

test("dictation remains editable and never sends automatically", async ({ page }) => {
  await page.addInitScript(() => {
    class TestRecognition {
      lang = ""; interimResults = false; continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() { this.onresult?.({ results: [[{ transcript: "හරිතප්‍රද යනු කුමක්ද?" }]] }); this.onend?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: TestRecognition });
  });
  await page.goto("/chat");
  const question = page.getByRole("textbox", { name: "ඔබේ ප්‍රශ්නය", exact: true });
  await expect(question).toBeEnabled();
  const count = await page.locator(".chat-exchange").count();
  await page.getByRole("button", { name: "හඬින් ලියන්න", exact: true }).click();
  await expect(question).toHaveValue("හරිතප්‍රද යනු කුමක්ද?");
  await question.fill("හරිතප්‍රද ආලෝකය අවශෝෂණය කරන්නේ කෙසේද?");
  await expect(page.locator(".chat-exchange")).toHaveCount(count);
});

test("late history responses preserve a newly answered question", async ({ page }) => {
  let release: () => void = () => {};
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/chats", async route => { await delayed; await route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
  try {
    await page.goto("/chat");
    const question = page.getByRole("textbox", { name: "ඔබේ ප්‍රශ්නය", exact: true });
    await expect(question).toBeEnabled();
    await question.fill("හරිතප්‍රද යනු කුමක්ද?");
    await page.getByRole("button", { name: "ප්‍රශ්නය යවන්න", exact: true }).click();
    await expect(page.locator(".chat-exchange")).toHaveCount(1);
    const response = page.waitForResponse(r => r.url().endsWith("/chats"));
    release(); await response;
    await expect(page.locator(".chat-exchange")).toHaveCount(1);
    await expect(page.locator(".chat-exchange")).toContainText("හරිතප්‍රද යනු කුමක්ද?");
  } finally { release(); }
});

test("legacy links reach real tools and narrow screens do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/#practice");
  await expect(page).toHaveURL(/\/practice$/);
  await noOverflow(page);
  await page.getByRole("navigation", { name: "ප්‍රධාන මෙනුව" }).getByRole("link", { name: "මගේ ලේඛන", exact: true }).click();
  await expect(page).toHaveURL(/\/documents$/);
  await noOverflow(page);
  await page.getByRole("navigation", { name: "ප්‍රධාන මෙනුව" }).getByRole("link", { name: "ප්‍රශ්න හා පිළිතුරු", exact: true }).click();
  await noOverflow(page);
});

test("Sinhala image OCR reads a rendered study note", async ({ page, request }, info) => {
  const font = readFileSync("node_modules/@fontsource-variable/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-wght-normal.woff2").toString("base64");
  await page.setViewportSize({ width: 1500, height: 600 });
  await page.setContent(`<html lang="si"><style>@font-face{font-family:Note;src:url(data:font/woff2;base64,${font})}body{margin:0;background:white;padding:50px;font:34px/2.4 Note;color:black}</style><body>ශාක පත්‍රවල ඇති හරිතප්‍රද මගින් සූර්යාලෝකය අවශෝෂණය කරයි.<br>ශාකයේ මූල පද්ධතිය මගින් පසෙන් ජලය අවශෝෂණය කරයි.</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const buffer = await page.screenshot({ path: `../.artifacts/qa/${info.project.name}-sinhala-ocr-input.png` });
  const uploaded = await request.post("http://localhost:8001/documents", { multipart: { title: "සිංහල ස්කෑන් සටහන", file: { name: "sinhala-scan.png", mimeType: "image/png", buffer } } });
  expect(uploaded.status()).toBe(202);
  const { id } = await uploaded.json();
  await expect.poll(async () => (await (await request.get(`http://localhost:8001/documents/${id}`)).json()).status, { timeout: 30_000 }).toBe("ready");
  const document = await (await request.get(`http://localhost:8001/documents/${id}`)).json();
  expect(document.pages[0].ocr).toBe(true);
  expect(document.pages[0].text).toContain("ශාක");
  expect(document.pages[0].text).toContain("ජලය");
});


function twoPagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...["Photosynthesis uses sunlight to produce food in green plants.", "Chlorophyll absorbs light energy inside the chloroplast."].map(text => {
      const stream = `BT /F1 18 Tf 40 700 Td (${text}) Tj ET`;
      return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    }),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("original PDF pages, extracted text, citations and reprocessing", async ({ page, request }, info) => {
  const uploaded = await request.post("http://localhost:8001/documents", { multipart: { file: { name: "reader.pdf", mimeType: "application/pdf", buffer: twoPagePdf() } } });
  expect(uploaded.status()).toBe(202);
  const { id } = await uploaded.json();
  await expect.poll(async () => (await (await request.get(`http://localhost:8001/documents/${id}`)).json()).status).toBe("ready");
  await page.goto(`/documents/${id}?page=2`);
  const image = page.getByRole("img", { name: "reader · පිටුව 2", exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(600);
  await expect(page.getByLabel("පිටුව තෝරන්න", { exact: true })).toHaveValue("2");
  await noOverflow(page);
  await page.screenshot({ path: `../.artifacts/qa/${info.project.name}-pdf-reader.png`, fullPage: true });
  await page.getByRole("button", { name: "හඳුනාගත් අකුරු", exact: true }).click();
  await expect(page.locator("article.source-page")).toContainText("Chlorophyll");
  await page.getByRole("button", { name: "අකුරු නැවත හඳුනාගන්න", exact: true }).click();
  await expect(page.locator("article.source-page")).toContainText("Chlorophyll");
  await page.getByRole("link", { name: "පෙර", exact: true }).click();
  await expect(page.getByLabel("පිටුව තෝරන්න", { exact: true })).toHaveValue("1");
  const broken = page.waitForResponse(response => response.url().endsWith("/pages/1/image"));
  await page.route(`**/documents/${id}/pages/1/image`, route => route.fulfill({ status: 503, body: "unavailable" }));
  // Force a fresh document mount so the error and retry path runs even if cached.
  await page.goto("/documents");
  await page.goto(`/documents/${id}`);
  await broken;
  await expect(page.getByRole("main").getByRole("alert")).toContainText("PDF පිටුව පූරණය කළ නොහැක");
  await page.unroute(`**/documents/${id}/pages/1/image`);
  await page.getByRole("button", { name: "නැවත උත්සාහ කරන්න", exact: true }).click();
  await expect(page.getByRole("img", { name: "reader · පිටුව 1", exact: true })).toBeVisible();
});

test("Singlish preview stays editable and retrieves a Sinhala cited answer", async ({ page, request }, info) => {
  const uploaded = await request.post("http://localhost:8001/documents/text", { data: { title: "ජීව පටක", content: "ජීව පටක යනු සමාන කෘත්‍යයක් ඉටු කරන සෛල සමූහයකි. ශාක පටක වර්ග කිහිපයකින් සමන්විත වේ." } });
  const { id } = await uploaded.json();
  await expect.poll(async () => (await (await request.get(`http://localhost:8001/documents/${id}`)).json()).status).toBe("ready");
  await page.goto(`/chat?document=${id}`);
  const question = page.getByRole("textbox", { name: "ඔබේ ප්‍රශ්නය", exact: true });
  await expect(question).toBeEnabled();
  await expect(page.getByText("පෙර ප්‍රශ්න ලබාගනිමින්…", { exact: true })).toHaveCount(0);
  const count = await page.locator(".chat-exchange").count();
  await question.fill("MKD JIWA PATAKA KIYANNE");
  await page.getByRole("button", { name: "සිංහලෙන් බලන්න", exact: true }).click();
  const preview = page.getByRole("textbox", { name: "සිංහල ප්‍රශ්නය පරීක්ෂා කරන්න", exact: true });
  await expect(preview).toHaveValue(/ජීව පටක/);
  await preview.fill("ජීව පටක යනු කුමක්ද?");
  await expect(page.locator(".chat-exchange")).toHaveCount(count);
  await page.getByRole("button", { name: "මෙම ප්‍රශ්නය භාවිත කරන්න", exact: true }).click();
  await expect(question).toHaveValue("ජීව පටක යනු කුමක්ද?");
  await question.fill("MKD JIWA PATAKA KIYANNE");
  await page.getByLabel("ලියන ආකාරය", { exact: true }).selectOption("singlish");
  await page.getByRole("button", { name: "ප්‍රශ්නය යවන්න", exact: true }).click();
  await expect(question).toHaveValue("");
  const exchange = page.locator(".chat-exchange").last();
  await expect(exchange).toContainText("සිංහලෙන්: මොකක්ද ජීව පටක කියන්නේ");
  await expect(exchange.locator(".answer-bubble")).toContainText("සෛල සමූහයකි");
  await expect(exchange.locator(".source-link")).toHaveAttribute("href", `/documents/${id}?page=1`);
  await noOverflow(page);
  await page.screenshot({ path: `../.artifacts/qa/${info.project.name}-singlish.png`, fullPage: true });
  await page.reload();
  await expect(page.locator(".chat-exchange").last()).toContainText("සිංහලෙන්: මොකක්ද ජීව පටක කියන්නේ");
});
