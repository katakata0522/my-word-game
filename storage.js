(function(root, factory) {
    const api = factory(root && root.localStorage);
    if (typeof module === "object" && module.exports) module.exports = factory;
    if (root) root.WordGameStorage = api;
})(typeof window !== "undefined" ? window : globalThis, function(storage) {
    "use strict";

    const PREFIX = "myWordGameV3";
    const keys = {
        settings: `${PREFIX}:settings`,
        bestScores: `${PREFIX}:bestScores`,
        recentWords: `${PREFIX}:recentWords`,
        playCount: `${PREFIX}:playCount`,
        lifetimeStats: `${PREFIX}:lifetimeStats`,
        dailyResults: `${PREFIX}:dailyResults`
    };

    function read(key, fallback) {
        try {
            const value = storage?.getItem(key);
            return value === null || value === undefined ? fallback : JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            storage?.setItem(key, JSON.stringify(value));
            return Boolean(storage);
        } catch (_) {
            return false;
        }
    }

    function loadSettings() {
        return {
            mode: "solo",
            difficulty: "normal",
            roundCount: 3,
            soundEnabled: true,
            ...read(keys.settings, {})
        };
    }

    function saveSettings(settings) {
        return write(keys.settings, {
            mode: settings.mode,
            difficulty: settings.difficulty,
            roundCount: Number(settings.roundCount),
            soundEnabled: Boolean(settings.soundEnabled)
        });
    }

    function getBestScores() {
        return read(keys.bestScores, {});
    }

    function bestScoreKey(difficulty, roundCount) {
        return `${difficulty}:${Number(roundCount) || 3}`;
    }

    function getBestScore(difficulty, roundCount) {
        const scores = getBestScores();
        const key = bestScoreKey(difficulty, roundCount);
        const legacyScore = Number(roundCount) === 3
            ? Number(scores[difficulty]) || 0
            : 0;
        return Number(scores[key]) || legacyScore;
    }

    function recordSoloScore(difficulty, roundCount, score) {
        const scores = getBestScores();
        const key = bestScoreKey(difficulty, roundCount);
        const previous = getBestScore(difficulty, roundCount);
        const next = Math.max(previous, Number(score) || 0);
        scores[key] = next;
        write(keys.bestScores, scores);
        return { previous, best: next, isNewBest: next > previous };
    }

    function getRecentWords() {
        const words = read(keys.recentWords, []);
        return Array.isArray(words) ? words.slice(0, 10) : [];
    }

    function rememberWords(words) {
        const current = getRecentWords();
        const merged = [...words, ...current].filter(
            (word, index, list) => list.indexOf(word) === index
        ).slice(0, 10);
        write(keys.recentWords, merged);
        return merged;
    }

    function incrementPlayCount() {
        const next = Math.max(0, Number(read(keys.playCount, 0)) || 0) + 1;
        write(keys.playCount, next);
        return next;
    }

    function getLifetimeStats() {
        return {
            gamesCompleted: 0,
            roundsWon: 0,
            roundsLost: 0,
            totalTime: 0,
            currentDailyStreak: 0,
            bestDailyStreak: 0,
            lastDailyDate: null,
            ...read(keys.lifetimeStats, {})
        };
    }

    function recordCompletedSession(summary) {
        const stats = getLifetimeStats();
        stats.gamesCompleted++;
        stats.roundsWon += Math.max(0, Number(summary.roundsWon) || 0);
        stats.roundsLost += Math.max(0, Number(summary.roundsLost) || 0);
        stats.totalTime += Math.max(0, Number(summary.totalTime) || 0);
        write(keys.lifetimeStats, stats);
        return stats;
    }

    function getDailyResults() {
        const results = read(keys.dailyResults, {});
        return results && typeof results === "object" && !Array.isArray(results)
            ? results
            : {};
    }

    function getDailyResult(dateKey) {
        return getDailyResults()[dateKey] || null;
    }

    function previousDateKey(dateKey) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
        if (!match) return null;
        const date = new Date(Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        ));
        date.setUTCDate(date.getUTCDate() - 1);
        return date.toISOString().slice(0, 10);
    }

    function recordDailyResult(dateKey, result) {
        const results = getDailyResults();
        if (results[dateKey]) {
            return {
                record: results[dateKey],
                isFirstAttempt: false,
                stats: getLifetimeStats()
            };
        }

        const record = {
            score: Number(result.score) || 0,
            won: Boolean(result.won),
            elapsedSeconds: Math.max(0, Number(result.elapsedSeconds) || 0)
        };
        results[dateKey] = record;
        const recentEntries = Object.entries(results)
            .sort(([left], [right]) => right.localeCompare(left))
            .slice(0, 31);
        write(keys.dailyResults, Object.fromEntries(recentEntries));

        const stats = getLifetimeStats();
        stats.currentDailyStreak = stats.lastDailyDate === previousDateKey(dateKey)
            ? stats.currentDailyStreak + 1
            : 1;
        stats.bestDailyStreak = Math.max(
            stats.bestDailyStreak,
            stats.currentDailyStreak
        );
        stats.lastDailyDate = dateKey;
        write(keys.lifetimeStats, stats);
        return { record, isFirstAttempt: true, stats };
    }

    return {
        loadSettings,
        saveSettings,
        getBestScores,
        getBestScore,
        recordSoloScore,
        getRecentWords,
        rememberWords,
        incrementPlayCount,
        getLifetimeStats,
        recordCompletedSession,
        getDailyResult,
        recordDailyResult
    };
});
