const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const audioEngine = fs.readFileSync(path.join(root, "audio-engine.js"), "utf8");

for (const filename of ["bgm.mp3", "correct.mp3", "wrong.mp3", "win.mp3", "lose.mp3", "hint.mp3"]) {
    assert.equal(html.includes(filename), false, `${filename} の欠落参照が残っています`);
}

const audioEnginePosition = html.indexOf('src="audio-engine.js"');
const gamePosition = html.indexOf('src="game_ver2.js"');
assert.ok(audioEnginePosition >= 0, "audio-engine.js が読み込まれていません");
assert.ok(gamePosition >= 0, "game_ver2.js が読み込まれていません");
assert.ok(audioEnginePosition < gamePosition, "audio-engine.js はゲーム本体より先に読み込む必要があります");

for (const filename of ["audio-engine.js", "game_ver2.js"]) {
    assert.ok(fs.existsSync(path.join(root, filename)), `${filename} が存在しません`);
}

assert.ok(html.includes('id="audio-toggle-button"'), "音声切替ボタンがありません");
assert.ok(html.includes("@media (max-width: 600px)"), "スマホ用レイアウトがありません");
assert.match(
    html,
    /<script\s+defer\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/canvas-confetti@1\.9\.3\/dist\/confetti\.browser\.min\.js"><\/script>/,
    "紙吹雪スクリプトが初期表示をブロックする可能性があります"
);

const buttonTags = html.match(/<button\b[^>]*>/g) || [];
assert.ok(buttonTags.length > 0, "ボタンが見つかりません");
for (const buttonTag of buttonTags) {
    assert.match(buttonTag, /\btype="button"/, `type="button" がないボタンです: ${buttonTag}`);
}

assert.ok(audioEngine.includes("activeOscillators"), "再生中の音を追跡していません");
assert.ok(audioEngine.includes("setMuted"), "音声ミュート機能がありません");

console.log("静的な音声参照、読込順、操作UIを確認しました");
