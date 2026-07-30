const assert = require("node:assert/strict");
const createStorage = require("../storage.js");

function fakeStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, value);
        }
    };
}

const api = createStorage(fakeStorage());
assert.deepEqual(api.loadSettings(), {
    mode: "solo",
    difficulty: "normal",
    roundCount: 3,
    soundEnabled: true
});

assert.equal(api.saveSettings({
    mode: "versus",
    difficulty: "hard",
    roundCount: 5,
    soundEnabled: false
}), true);
assert.deepEqual(api.loadSettings(), {
    mode: "versus",
    difficulty: "hard",
    roundCount: 5,
    soundEnabled: false
});

let record = api.recordSoloScore("hard", 1200);
assert.equal(record.isNewBest, true);
assert.equal(record.best, 1200);
record = api.recordSoloScore("hard", 900);
assert.equal(record.isNewBest, false);
assert.equal(record.best, 1200);

const recent = api.rememberWords([
    "りんご", "みかん", "りんご", "ばなな", "すいか",
    "めろん", "なし", "かき", "くり", "ゆず", "うめ", "びわ"
]);
assert.equal(recent.length, 10);
assert.equal(new Set(recent).size, 10);

assert.equal(api.incrementPlayCount(), 1);
assert.equal(api.incrementPlayCount(), 2);

const broken = createStorage({
    getItem() {
        throw new Error("blocked");
    },
    setItem() {
        throw new Error("blocked");
    }
});
assert.deepEqual(broken.loadSettings(), {
    mode: "solo",
    difficulty: "normal",
    roundCount: 3,
    soundEnabled: true
});
assert.equal(broken.saveSettings({
    mode: "solo",
    difficulty: "easy",
    roundCount: 1,
    soundEnabled: true
}), false);

console.log("設定・自己ベスト・直近出題の保存を確認しました");
