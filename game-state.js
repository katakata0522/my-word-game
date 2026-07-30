(function(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.WordGameState = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";

    const DIFFICULTIES = {
        easy: { label: "かんたん", lives: 8, soloHints: 2 },
        normal: { label: "ふつう", lives: 7, soloHints: 1 },
        hard: { label: "むずかしい", lives: 6, soloHints: 1 }
    };

    const SCORE = {
        letterPerPosition: 80,
        soloClear: 400,
        soloAnswerPerHidden: 120,
        versusAnswerBase: 200,
        versusAnswerPerHidden: 100,
        versusWrongAnswerPenalty: 100,
        lifeBonus: 50,
        maxTimeBonus: 400,
        timeTargetBase: 15,
        timeTargetPerCharacter: 7,
        hintPenalty: 150
    };

    function splitCharacters(text) {
        if (typeof Intl !== "undefined" && Intl.Segmenter) {
            return [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(text)]
                .map(part => part.segment);
        }
        return Array.from(text);
    }

    function normalizeJapanese(value) {
        return String(value ?? "")
            .trim()
            .normalize("NFKC")
            .replace(/[ァ-ヶ]/g, char =>
                String.fromCharCode(char.charCodeAt(0) - 0x60)
            );
    }

    function isHiraganaWord(value) {
        return /^[ぁ-ゖー]+$/u.test(value);
    }

    function createPlayers(mode, playerNames = []) {
        if (mode === "versus") {
            return [
                { name: playerNames[0]?.trim() || "プレイヤー1", score: 0 },
                { name: playerNames[1]?.trim() || "プレイヤー2", score: 0 }
            ];
        }
        return [{ name: "あなた", score: 0 }];
    }

    function createSession(options) {
        const mode = options.mode === "versus" ? "versus" : "solo";
        const difficulty = DIFFICULTIES[options.difficulty] ? options.difficulty : "normal";
        const roundCount = [1, 3, 5].includes(Number(options.roundCount))
            ? Number(options.roundCount)
            : 3;
        const words = Array.isArray(options.words) ? options.words.slice() : [];
        const requiredWords = mode === "versus" ? roundCount + 1 : roundCount;
        if (words.length < requiredWords) {
            throw new Error(`ゲームには${requiredWords}語以上必要です`);
        }

        const state = {
            mode,
            challenge: options.challenge === "daily" ? "daily" : "standard",
            dailyDateKey: options.dailyDateKey || null,
            difficulty,
            roundCount,
            originalRoundCount: roundCount,
            words,
            players: createPlayers(mode, options.playerNames),
            currentRoundIndex: 0,
            phase: "playing",
            roundHistory: [],
            isOvertime: false,
            stats: {
                correctRounds: 0,
                failedRounds: 0,
                misses: 0,
                livesLost: 0,
                hintsUsed: 0,
                totalTime: 0
            }
        };
        startRound(state, 0, options.now ?? Date.now());
        return state;
    }

    function startRound(state, roundIndex, now = Date.now()) {
        const difficulty = DIFFICULTIES[state.difficulty];
        const wordData = state.words[roundIndex];
        if (!wordData) throw new Error("次の単語がありません");

        state.currentRoundIndex = roundIndex;
        state.wordData = wordData;
        state.characters = splitCharacters(wordData.word);
        state.revealed = state.characters.map(() => false);
        state.lives = difficulty.lives;
        state.maxLives = difficulty.lives;
        state.usedLetters = [];
        state.usedAnswers = [];
        state.hintsRemaining = state.mode === "solo"
            ? [difficulty.soloHints]
            : [1, 1];
        state.currentPlayer = state.mode === "versus" ? roundIndex % 2 : 0;
        state.startingPlayer = state.currentPlayer;
        state.roundStartAt = now;
        state.pausedDuration = 0;
        state.pauseStartedAt = null;
        state.roundScoreStart = state.players.map(player => player.score);
        state.roundBreakdown = state.players.map(() => ({
            letters: 0,
            answer: 0,
            hint: 0,
            clear: 0,
            lives: 0,
            time: 0
        }));
        state.roundOutcome = null;
        state.phase = "playing";
        state.message = "ゲーム開始！";
        return state;
    }

    function getMaskedCharacters(state) {
        return state.characters.map((character, index) =>
            state.revealed[index] ? character : "？"
        );
    }

    function isSolved(state) {
        return state.revealed.every(Boolean);
    }

    function revealCharacter(state, character) {
        let revealedCount = 0;
        state.characters.forEach((current, index) => {
            if (current === character && !state.revealed[index]) {
                state.revealed[index] = true;
                revealedCount++;
            }
        });
        return revealedCount;
    }

    function switchPlayer(state) {
        if (state.mode === "versus") {
            state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
        }
    }

    function addScore(state, playerIndex, points) {
        state.players[playerIndex].score += points;
    }

    function getElapsedSeconds(state, now) {
        const activePause = state.pauseStartedAt === null
            ? 0
            : Math.max(0, now - state.pauseStartedAt);
        return Math.max(
            0,
            Math.floor(
                (now - state.roundStartAt - state.pausedDuration - activePause) / 1000
            )
        );
    }

    function getTimeTargetSeconds(state) {
        return SCORE.timeTargetBase
            + state.characters.length * SCORE.timeTargetPerCharacter;
    }

    function finishRound(state, won, method, now = Date.now()) {
        if (state.phase !== "playing") return state.roundOutcome;

        const elapsedSeconds = getElapsedSeconds(state, now);
        const breakdown = {
            clear: 0,
            answer: 0,
            lives: 0,
            time: 0
        };

        if (state.mode === "solo" && won) {
            breakdown.clear = SCORE.soloClear;
            breakdown.answer = state.roundBreakdown[0].answer;
            breakdown.lives = state.lives * SCORE.lifeBonus;
            const timeTarget = getTimeTargetSeconds(state);
            breakdown.time = Math.round(
                SCORE.maxTimeBonus
                * Math.max(0, timeTarget - elapsedSeconds)
                / timeTarget
            );
            state.roundBreakdown[0].clear = breakdown.clear;
            state.roundBreakdown[0].lives = breakdown.lives;
            state.roundBreakdown[0].time = breakdown.time;
            addScore(
                state,
                0,
                breakdown.clear + breakdown.lives + breakdown.time
            );
        }

        if (won) {
            state.revealed = state.revealed.map(() => true);
            state.stats.correctRounds++;
        } else {
            state.stats.failedRounds++;
        }
        state.stats.totalTime += elapsedSeconds;

        const roundScores = state.players.map(
            (player, index) => player.score - state.roundScoreStart[index]
        );
        const outcome = {
            roundNumber: state.currentRoundIndex + 1,
            word: state.wordData.word,
            category: state.wordData.category,
            won,
            method,
            elapsedSeconds,
            remainingLives: state.lives,
            roundScores,
            totalScores: state.players.map(player => player.score),
            breakdown,
            playerBreakdowns: state.roundBreakdown.map(item => ({ ...item }))
        };
        state.roundOutcome = outcome;
        state.roundHistory.push(outcome);
        state.phase = "round-end";
        return outcome;
    }

    function submitLetter(state, input, now = Date.now()) {
        if (state.phase !== "playing") {
            return { accepted: false, reason: "not-playing" };
        }

        const letter = normalizeJapanese(input);
        if (splitCharacters(letter).length !== 1 || !isHiraganaWord(letter)) {
            state.message = "ひらがな一文字を入力してください。";
            return { accepted: false, reason: "invalid", message: state.message };
        }
        if (state.usedLetters.includes(letter)) {
            state.message = `「${letter}」は既に使用されています。`;
            return { accepted: false, reason: "duplicate", message: state.message };
        }

        const actingPlayer = state.currentPlayer;
        state.usedLetters.push(letter);
        const revealedCount = revealCharacter(state, letter);

        if (revealedCount > 0) {
            const points = revealedCount * SCORE.letterPerPosition;
            addScore(state, actingPlayer, points);
            state.roundBreakdown[actingPlayer].letters += points;
            state.message = `あたり！「${letter}」が${revealedCount}個ありました。`;
        } else {
            state.lives = Math.max(0, state.lives - 1);
            state.stats.misses++;
            state.stats.livesLost++;
            state.message = `はずれ…「${letter}」はありませんでした。`;
        }

        if (isSolved(state)) {
            finishRound(state, true, "letters", now);
        } else if (state.lives === 0) {
            finishRound(state, false, "lives", now);
        } else {
            switchPlayer(state);
        }

        return {
            accepted: true,
            correct: revealedCount > 0,
            revealedCount,
            actingPlayer,
            roundEnded: state.phase === "round-end",
            message: state.message
        };
    }

    function submitAnswer(state, input, now = Date.now()) {
        if (state.phase !== "playing") {
            return { accepted: false, reason: "not-playing" };
        }

        const answer = normalizeJapanese(input);
        if (!answer || !isHiraganaWord(answer)) {
            state.message = "ひらがなで答えを入力してください。";
            return { accepted: false, reason: "invalid", message: state.message };
        }
        if (state.usedAnswers.includes(answer)) {
            state.message = `「${answer}」は既に解答済みです。`;
            return { accepted: false, reason: "duplicate", message: state.message };
        }

        const actingPlayer = state.currentPlayer;
        state.usedAnswers.push(answer);
        const acceptedAnswers = (state.wordData.acceptedAnswers || [state.wordData.word])
            .map(normalizeJapanese);
        if (acceptedAnswers.includes(answer)) {
            const hiddenCount = state.revealed.filter(value => !value).length;
            const answerPoints = state.mode === "versus"
                ? SCORE.versusAnswerBase + hiddenCount * SCORE.versusAnswerPerHidden
                : hiddenCount * SCORE.soloAnswerPerHidden;
            addScore(state, actingPlayer, answerPoints);
            state.roundBreakdown[actingPlayer].answer += answerPoints;
            state.message = `正解！答えは「${state.wordData.word}」でした。`;
            finishRound(state, true, "answer", now);
            return {
                accepted: true,
                correct: true,
                actingPlayer,
                answerPoints,
                roundEnded: true,
                message: state.message
            };
        }

        if (state.mode === "versus") {
            addScore(state, actingPlayer, -SCORE.versusWrongAnswerPenalty);
            state.roundBreakdown[actingPlayer].answer -= SCORE.versusWrongAnswerPenalty;
            state.stats.misses++;
            state.message = `残念！「${answer}」ではありません。${SCORE.versusWrongAnswerPenalty}点減点です。`;
            switchPlayer(state);
            return {
                accepted: true,
                correct: false,
                actingPlayer,
                scorePenalty: SCORE.versusWrongAnswerPenalty,
                lostLives: 0,
                roundEnded: false,
                message: state.message
            };
        }

        const lostLives = Math.min(2, state.lives);
        state.lives -= lostLives;
        state.stats.misses++;
        state.stats.livesLost += lostLives;
        state.message = `残念！「${answer}」ではありません。ライフが${lostLives}減りました。`;

        if (state.lives === 0) {
            finishRound(state, false, "lives", now);
        } else {
            switchPlayer(state);
        }
        return {
            accepted: true,
            correct: false,
            actingPlayer,
            lostLives,
            roundEnded: state.phase === "round-end",
            message: state.message
        };
    }

    function useHint(state, random = Math.random, now = Date.now()) {
        if (state.phase !== "playing") {
            return { accepted: false, reason: "not-playing" };
        }
        const actingPlayer = state.currentPlayer;
        if (state.hintsRemaining[actingPlayer] <= 0) {
            state.message = "このラウンドのヒントは使い切りました。";
            return { accepted: false, reason: "no-hints", message: state.message };
        }

        const hiddenIndexes = state.revealed
            .map((isRevealed, index) => isRevealed ? -1 : index)
            .filter(index => index >= 0);
        if (hiddenIndexes.length === 0) {
            return { accepted: false, reason: "solved" };
        }

        const selectedIndex = hiddenIndexes[Math.floor(random() * hiddenIndexes.length)];
        const character = state.characters[selectedIndex];
        const revealedCount = revealCharacter(state, character);
        state.hintsRemaining[actingPlayer]--;
        state.stats.hintsUsed++;
        addScore(state, actingPlayer, -SCORE.hintPenalty);
        state.roundBreakdown[actingPlayer].hint -= SCORE.hintPenalty;
        state.message = `ヒント！「${character}」が${revealedCount}個開きました。`;

        if (isSolved(state)) {
            finishRound(state, true, "hint", now);
        } else {
            switchPlayer(state);
        }
        return {
            accepted: true,
            character,
            revealedCount,
            actingPlayer,
            roundEnded: state.phase === "round-end",
            message: state.message
        };
    }

    function continueSession(state, now = Date.now()) {
        if (state.phase !== "round-end") return false;
        const nextRoundIndex = state.currentRoundIndex + 1;
        if (nextRoundIndex >= state.roundCount) {
            state.phase = "session-end";
            return false;
        }
        startRound(state, nextRoundIndex, now);
        return true;
    }

    function canStartOvertime(state) {
        return state.mode === "versus"
            && state.phase === "session-end"
            && state.players[0].score === state.players[1].score
            && state.words.length > state.currentRoundIndex + 1;
    }

    function startOvertime(state, now = Date.now()) {
        if (!canStartOvertime(state)) return false;
        state.roundCount++;
        state.isOvertime = true;
        startRound(state, state.currentRoundIndex + 1, now);
        return true;
    }

    function pauseRound(state, now = Date.now()) {
        if (state.phase !== "playing" || state.pauseStartedAt !== null) return false;
        state.pauseStartedAt = now;
        return true;
    }

    function resumeRound(state, now = Date.now()) {
        if (state.pauseStartedAt === null) return false;
        state.pausedDuration += Math.max(0, now - state.pauseStartedAt);
        state.pauseStartedAt = null;
        return true;
    }

    function getWinner(state) {
        if (state.mode !== "versus" || state.phase !== "session-end") return null;
        if (state.players[0].score === state.players[1].score) return -1;
        return state.players[0].score > state.players[1].score ? 0 : 1;
    }

    return {
        DIFFICULTIES,
        SCORE,
        splitCharacters,
        normalizeJapanese,
        isHiraganaWord,
        createSession,
        startRound,
        getMaskedCharacters,
        getElapsedSeconds,
        getTimeTargetSeconds,
        submitLetter,
        submitAnswer,
        useHint,
        finishRound,
        continueSession,
        canStartOvertime,
        startOvertime,
        pauseRound,
        resumeRound,
        getWinner
    };
});
