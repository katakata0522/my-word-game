const assert = require("node:assert/strict");
const game = require("../game-state.js");

const word = (value, category = "テスト") => ({
    word: value,
    category,
    difficulty: "normal",
    hint: "テスト用"
});

assert.equal(game.normalizeJapanese("  リンゴ  "), "りんご");
assert.equal(game.normalizeJapanese("ﾊﾟﾝﾀﾞ"), "ぱんだ");
assert.equal(game.isHiraganaWord("りんご"), true);
assert.equal(game.isHiraganaWord("apple"), false);

const solo = game.createSession({
    mode: "solo",
    difficulty: "normal",
    roundCount: 3,
    words: [word("りんご"), word("ばなな"), word("みかん")],
    now: 0
});

assert.equal(solo.phase, "playing");
assert.equal(solo.lives, 7);
assert.deepEqual(game.getMaskedCharacters(solo), ["？", "？", "？"]);

let result = game.submitLetter(solo, "リ", 1_000);
assert.equal(result.accepted, true);
assert.equal(result.correct, true);
assert.equal(solo.players[0].score, 100);
assert.deepEqual(game.getMaskedCharacters(solo), ["り", "？", "？"]);

const lifeBeforeDuplicate = solo.lives;
result = game.submitLetter(solo, "り", 2_000);
assert.equal(result.accepted, false);
assert.equal(result.reason, "duplicate");
assert.equal(solo.lives, lifeBeforeDuplicate);

result = game.submitAnswer(solo, "みかん", 3_000);
assert.equal(result.correct, false);
assert.equal(result.lostLives, 2);
assert.equal(solo.lives, 5);

const livesBeforeDuplicateAnswer = solo.lives;
result = game.submitAnswer(solo, "みかん", 4_000);
assert.equal(result.accepted, false);
assert.equal(result.reason, "duplicate");
assert.equal(solo.lives, livesBeforeDuplicateAnswer);

result = game.useHint(solo, () => 0, 5_000);
assert.equal(result.accepted, true);
assert.equal(solo.hintsRemaining[0], 0);
assert.equal(solo.players[0].score, 0);

result = game.submitAnswer(solo, "りんご", 10_000);
assert.equal(result.correct, true);
assert.equal(solo.phase, "round-end");
assert.equal(solo.roundOutcome.won, true);
assert.equal(solo.roundOutcome.breakdown.clear, 500);
assert.equal(solo.roundOutcome.breakdown.answer, 300);
assert.equal(solo.roundOutcome.breakdown.lives, 250);
assert.equal(solo.roundOutcome.breakdown.time, 300);
assert.equal(solo.players[0].score, 1_350);

assert.equal(game.continueSession(solo, 11_000), true);
assert.equal(solo.currentRoundIndex, 1);
assert.equal(solo.lives, 7);
assert.equal(solo.usedAnswers.length, 0);

const versus = game.createSession({
    mode: "versus",
    difficulty: "normal",
    roundCount: 3,
    playerNames: ["あお", "あか"],
    words: [word("こころ"), word("ばなな"), word("みかん"), word("すいか")],
    now: 0
});

assert.equal(versus.currentPlayer, 0);
result = game.submitLetter(versus, "こ", 1_000);
assert.equal(result.revealedCount, 2);
assert.equal(versus.players[0].score, 200);
assert.equal(versus.currentPlayer, 1);

result = game.submitLetter(versus, "あ", 2_000);
assert.equal(result.correct, false);
assert.equal(versus.lives, 6);
assert.equal(versus.currentPlayer, 0);

result = game.submitAnswer(versus, "こころ", 3_000);
assert.equal(result.correct, true);
assert.equal(versus.players[0].score, 700);
assert.equal(versus.roundOutcome.roundScores[0], 700);
assert.equal(versus.roundOutcome.roundScores[1], 0);

versus.players[1].score = 50;
assert.equal(game.continueSession(versus, 4_000), true);
assert.equal(versus.currentPlayer, 1);
assert.deepEqual(versus.hintsRemaining, [1, 1]);

result = game.useHint(versus, () => 0, 5_000);
assert.equal(result.accepted, true);
assert.equal(versus.players[1].score, 50);
assert.equal(versus.roundBreakdown[1].hint, 0);
assert.equal(versus.currentPlayer, 0);

const tie = game.createSession({
    mode: "versus",
    difficulty: "normal",
    roundCount: 1,
    words: [word("ねこ"), word("いぬ")],
    now: 0
});
for (const answer of ["あ", "い", "う", "え"]) {
    game.submitAnswer(tie, answer, 1_000);
}
assert.equal(tie.phase, "round-end");
assert.equal(tie.roundOutcome.won, false);
assert.equal(game.continueSession(tie, 2_000), false);
assert.equal(tie.phase, "session-end");
assert.equal(game.getWinner(tie), -1);
assert.equal(game.canStartOvertime(tie), true);
assert.equal(game.startOvertime(tie, 3_000), true);
assert.equal(tie.phase, "playing");
assert.equal(tie.isOvertime, true);
assert.equal(tie.wordData.word, "いぬ");

console.log("1人用・2人用・延長戦の主要進行を確認しました");
