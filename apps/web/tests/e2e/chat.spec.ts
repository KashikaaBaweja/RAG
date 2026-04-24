import { test, expect } from "@playwright/test";

test.describe("Prometheus metrics", () => {
  test("GET /api/metrics returns exposition text", async ({ request }) => {
    const res = await request.get("/api/metrics");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toMatch(/rag_queries_total|^# HELP/m);
  });
});

test.describe("Dashboard upload → chat", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.DATABASE_URL ||
        !process.env.REDIS_URL ||
        !process.env.OPENAI_API_KEY ||
        !process.env.PINECONE_API_KEY ||
        !process.env.PINECONE_INDEX_NAME,
      "Set DATABASE_URL, REDIS_URL, OPENAI_API_KEY, PINECONE_* for full e2e"
    );
  });

  test("register, upload txt, send question", async ({ page, request }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = "e2e-password-ok-9";

    const reg = await request.post("/api/auth/register", {
      data: { email, password, name: "Playwright" },
    });
    expect(reg.ok()).toBeTruthy();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard**", { timeout: 60_000 });

    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "RAG E2E fixture: the designated test phrase is AURORA-42 for retrieval checks."
      ),
    });

    await expect(page.getByText(/Queued for ingestion/i)).toBeVisible({ timeout: 60_000 });

    await page.getByPlaceholder("Question…").fill("What is the designated test phrase?");
    const send = page.getByRole("button", { name: "Send" });
    await send.click();
    await expect(send).toBeEnabled({ timeout: 120_000 });

    const chatSection = page.locator("section").filter({ hasText: "Ask your knowledge base" });
    const assistantBubble = chatSection.locator("div.max-w-\\[95\\%\\]").last();
    await expect(assistantBubble).toHaveText(/.{2,}/, { timeout: 10_000 });
    await expect(assistantBubble).not.toContainText(/^Error: Missing OPENAI/);
  });
});
