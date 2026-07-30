const assert = require("node:assert/strict");
const wordsApi = require("../words.js");

assert.equal(wordsApi.words.length, 200);
assert.equal(Object.keys(wordsApi.groups).length, 8);

const uniqueWords = new Set(wordsApi.words.map(item => item.word));
assert.equal(uniqueWords.size, wordsApi.words.length);

for (const item of wordsApi.words) {
    assert.match(item.word, /^[ぁ-ゖー]+$/u, `不正な単語です: ${item.word}`);
    assert.ok(item.category);
    assert.ok(["easy", "normal", "hard"].includes(item.difficulty));
    assert.ok(item.hint.length >= 8, `ヒントが短すぎます: ${item.word}`);
    assert.equal(item.difficulty, wordsApi.difficultyFor(item.word));
}

for (const difficulty of ["easy", "normal", "hard"]) {
    const selected = wordsApi.selectWords({
        difficulty,
        count: 6,
        recentWords: [],
        random: () => 0.25
    });
    assert.equal(selected.length, 6);
    assert.equal(new Set(selected.map(item => item.word)).size, 6);
    assert.ok(selected.every(item => item.difficulty === difficulty));
}

const recent = wordsApi.words
    .filter(item => item.difficulty === "easy")
    .slice(0, 10)
    .map(item => item.word);
const selectedWithoutRecent = wordsApi.selectWords({
    difficulty: "easy",
    count: 5,
    recentWords: recent,
    random: () => 0.5
});
assert.ok(selectedWithoutRecent.every(item => !recent.includes(item.word)));

console.log("200語・難易度・重複防止を確認しました");
