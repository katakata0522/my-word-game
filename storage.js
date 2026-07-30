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
        playCount: `${PREFIX}:playCount`
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
        return {
            easy: 0,
            normal: 0,
            hard: 0,
            ...read(keys.bestScores, {})
        };
    }

    function recordSoloScore(difficulty, score) {
        const scores = getBestScores();
        const previous = scores[difficulty] || 0;
        const next = Math.max(previous, Number(score) || 0);
        scores[difficulty] = next;
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

    return {
        loadSettings,
        saveSettings,
        getBestScores,
        recordSoloScore,
        getRecentWords,
        rememberWords,
        incrementPlayCount
    };
});
