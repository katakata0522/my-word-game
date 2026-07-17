const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

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

console.log("音声参照とスクリプト読込順を確認しました");
