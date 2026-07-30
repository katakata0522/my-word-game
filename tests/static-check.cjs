const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const audioEngine = fs.readFileSync(path.join(root, "audio-engine.js"), "utf8");

for (const filename of ["bgm.mp3", "correct.mp3", "wrong.mp3", "win.mp3", "lose.mp3", "hint.mp3"]) {
    assert.equal(html.includes(filename), false, `${filename} の欠落参照が残っています`);
}

const scripts = [
    "words.js",
    "game-state.js",
    "storage.js",
    "audio-engine.js",
    "game-ui.js"
];
let previousPosition = -1;
for (const filename of scripts) {
    assert.ok(fs.existsSync(path.join(root, filename)), `${filename} が存在しません`);
    const position = html.indexOf(`src="${filename}"`);
    assert.ok(position >= 0, `${filename} が読み込まれていません`);
    assert.ok(position > previousPosition, `${filename} の読込順が不正です`);
    previousPosition = position;
}

assert.equal(html.includes('src="game_ver2.js"'), false, "旧ゲーム本体が読み込まれています");
assert.match(html, /<title>言葉当てゲーム Ver\.3<\/title>/);
assert.ok(html.includes('value="solo"'));
assert.ok(html.includes('value="versus"'));
assert.ok(html.includes('id="daily-start-button"'));
assert.ok(html.includes('id="meaning-hint"'));
assert.ok(html.includes('id="share-button"'));
assert.ok(html.includes('id="overtime-button"'));
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"));
assert.ok(css.includes("@media (max-width: 360px)"));

assert.equal(html.includes("cdn.jsdelivr.net"), false, "外部CDN依存が残っています");

const buttonTags = html.match(/<button\b[^>]*>/g) || [];
assert.ok(buttonTags.length >= 12, "必要な操作ボタンが不足しています");
for (const buttonTag of buttonTags) {
    assert.match(buttonTag, /\btype="(?:button|submit)"/, `type属性がないボタンです: ${buttonTag}`);
}

assert.ok(audioEngine.includes("activeOscillators"), "再生中の音を追跡していません");
assert.ok(audioEngine.includes("setMuted"), "音声ミュート機能がありません");

console.log("静的参照、画面、レスポンシブ、操作UIを確認しました");
