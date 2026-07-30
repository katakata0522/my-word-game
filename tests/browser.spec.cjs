const playwrightTest = require("@playwright/test");

const test = process.env.BROWSER_URL
    ? playwrightTest.test.extend({
        browser: [async ({ playwright }, use) => {
            const browser = await playwright.chromium.connectOverCDP(
                process.env.BROWSER_URL
            );
            await use(browser);
            await browser.close();
        }, { scope: "worker" }]
    })
    : playwrightTest.test;
const { expect } = playwrightTest;

async function openCleanPage(page) {
    await page.addInitScript(() => {
        Math.random = () => 0.1;
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
}

async function answerWord(page, answer) {
    const panel = page.locator("#answer-panel");
    if (await panel.isHidden()) await page.locator("#answer-toggle").click();
    await page.locator("#answer-input").fill(answer);
    await page.locator("#answer-form button[type='submit']").click();
}

test("今日の一問を完走し、最初の結果を保存できる", async ({ page }) => {
    await openCleanPage(page);
    await expect(page.locator("#daily-status")).toContainText("まだありません");
    await page.locator("#daily-start-button").click();
    await expect(page.locator("#mode-label")).toHaveText("日替わりチャレンジ");
    await expect(page.locator("#meaning-hint")).not.toHaveText("");

    const answer = await page.evaluate(() => {
        const now = new Date();
        const dateKey = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");
        return window.WordGameWords.selectDailyWord({
            dateKey,
            difficulty: "normal"
        }).word;
    });
    await answerWord(page, answer);
    await page.locator("#next-round-button").click();

    await expect(page.locator("#final-result-title")).toContainText("正解");
    await expect(page.locator("#share-button")).toBeVisible();
    const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("myWordGameV3:dailyResults"))
    );
    expect(Object.keys(saved)).toHaveLength(1);
});

test("通常1人用の自己ベストをラウンド数別に保存する", async ({ page }) => {
    await openCleanPage(page);
    await page.locator("#round-count-select").selectOption("1");
    const answer = await page.evaluate(() =>
        window.WordGameWords.selectWords({
            difficulty: "normal",
            count: 1,
            recentWords: [],
            random: () => 0.1
        })[0].word
    );
    await page.locator("#setup-form button[type='submit']").click();
    await answerWord(page, answer);
    await page.locator("#next-round-button").click();

    const scores = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("myWordGameV3:bestScores"))
    );
    expect(scores["normal:1"]).toBeGreaterThan(0);
    expect(scores["normal:3"]).toBeUndefined();
});

test("2人用の単語誤答は回答者だけを減点する", async ({ page }) => {
    await openCleanPage(page);
    await page.locator('input[name="game-mode"][value="versus"]').check();
    await page.locator("#round-count-select").selectOption("1");
    await page.locator("#player-one-name").fill("あお");
    await page.locator("#player-two-name").fill("あか");
    const answer = await page.evaluate(() =>
        window.WordGameWords.selectWords({
            difficulty: "normal",
            count: 2,
            recentWords: [],
            random: () => 0.1
        })[0].word
    );
    await page.locator("#setup-form button[type='submit']").click();

    await answerWord(page, "ぜったいにちがう");
    await expect(page.locator("#life-status")).toContainText("7 / 7");
    await expect(page.locator("#scoreboard .score-card").nth(0)).toContainText("-100点");
    await expect(page.locator("#turn-info")).toContainText("あか");

    await answerWord(page, answer);
    await page.locator("#next-round-button").click();
    await expect(page.locator("#final-result-title")).toContainText("あか");
});

for (const width of [375, 320]) {
    test(`${width}pxで横スクロールと小さな操作領域がない`, async ({ page }) => {
        await page.setViewportSize({ width, height: 820 });
        await openCleanPage(page);
        const start = await page.evaluate(() => ({
            viewportWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            smallTargets: [...document.querySelectorAll("button, input, select")]
                .filter(element => element.getClientRects().length > 0)
                .filter(element => element.getBoundingClientRect().height < 44)
                .map(element => element.id || element.tagName)
        }));
        expect(start.scrollWidth).toBe(start.viewportWidth);
        expect(start.smallTargets).toEqual([]);

        await page.locator("#daily-start-button").click();
        const game = await page.evaluate(() => ({
            viewportWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            clueWidth: Math.round(
                document.querySelector(".meaning-clue").getBoundingClientRect().width
            )
        }));
        expect(game.scrollWidth).toBe(game.viewportWidth);
        expect(game.clueWidth).toBeLessThanOrEqual(width - 20);
    });
}
