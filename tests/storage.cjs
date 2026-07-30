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

let record = api.recordSoloScore("hard", 3, 1200);
assert.equal(record.isNewBest, true);
assert.equal(record.best, 1200);
record = api.recordSoloScore("hard", 3, 900);
assert.equal(record.isNewBest, false);
assert.equal(record.best, 1200);
assert.equal(api.getBestScore("hard", 3), 1200);
assert.equal(api.getBestScore("hard", 1), 0);

const recent = api.rememberWords([
    "りんご", "みかん", "りんご", "ばなな", "すいか",
    "めろん", "なし", "かき", "くり", "ゆず", "うめ", "びわ"
]);
assert.equal(recent.length, 10);
assert.equal(new Set(recent).size, 10);

assert.equal(api.incrementPlayCount(), 1);
assert.equal(api.incrementPlayCount(), 2);

let stats = api.recordCompletedSession({
    roundsWon: 2,
    roundsLost: 1,
    totalTime: 75
});
assert.equal(stats.gamesCompleted, 1);
assert.equal(stats.roundsWon, 2);

let daily = api.recordDailyResult("2026-07-29", {
    score: 800,
    won: true,
    elapsedSeconds: 20
});
assert.equal(daily.isFirstAttempt, true);
assert.equal(daily.stats.currentDailyStreak, 1);
daily = api.recordDailyResult("2026-07-30", {
    score: 900,
    won: true,
    elapsedSeconds: 18
});
assert.equal(daily.stats.currentDailyStreak, 2);
assert.equal(daily.stats.bestDailyStreak, 2);
const duplicateDaily = api.recordDailyResult("2026-07-30", {
    score: 9999,
    won: true,
    elapsedSeconds: 1
});
assert.equal(duplicateDaily.isFirstAttempt, false);
assert.equal(duplicateDaily.record.score, 900);

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
