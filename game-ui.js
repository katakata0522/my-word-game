(function() {
    "use strict";

    const game = window.WordGameState;
    const wordsApi = window.WordGameWords;
    const storage = window.WordGameStorage;
    const audio = window.gameAudio;

    const byId = id => document.getElementById(id);
    const screens = [
        byId("start-screen"),
        byId("game-screen"),
        byId("round-result-screen"),
        byId("final-result-screen")
    ];
    const elements = {
        setupForm: byId("setup-form"),
        dailyStartButton: byId("daily-start-button"),
        dailyStatus: byId("daily-status"),
        lifetimeStats: byId("lifetime-stats"),
        playerSettings: byId("player-settings"),
        playerOneName: byId("player-one-name"),
        playerTwoName: byId("player-two-name"),
        difficulty: byId("difficulty-select"),
        roundCount: byId("round-count-select"),
        bestScore: byId("best-score"),
        modeLabel: byId("mode-label"),
        roundHeading: byId("round-heading"),
        scoreboard: byId("scoreboard"),
        category: byId("category-label"),
        meaningHint: byId("meaning-hint"),
        wordDisplay: byId("word-display"),
        life: byId("life-status"),
        timer: byId("timer"),
        turn: byId("turn-info"),
        message: byId("message"),
        letterForm: byId("letter-form"),
        letterInput: byId("letter-input"),
        usedLetters: byId("used-letters"),
        answerToggle: byId("answer-toggle"),
        answerPanel: byId("answer-panel"),
        answerForm: byId("answer-form"),
        answerInput: byId("answer-input"),
        usedAnswersDetails: byId("used-answers-details"),
        usedAnswers: byId("used-answers"),
        hintButton: byId("hint-button"),
        quitButton: byId("quit-button"),
        roundResultKicker: byId("round-result-kicker"),
        roundResultTitle: byId("round-result-title"),
        roundResultWord: byId("round-result-word"),
        roundResultScores: byId("round-result-scores"),
        nextRoundButton: byId("next-round-button"),
        finalResultTitle: byId("final-result-title"),
        finalSummary: byId("final-summary"),
        finalScores: byId("final-scores"),
        sessionStats: byId("session-stats"),
        replayButton: byId("replay-button"),
        shareButton: byId("share-button"),
        overtimeButton: byId("overtime-button"),
        settingsButton: byId("settings-button"),
        confirmDialog: byId("confirm-dialog"),
        confirmMessage: byId("confirm-message"),
        confirmActionButton: byId("confirm-action-button")
    };

    let session = null;
    let timerIntervalId = null;
    let pendingConfirmAction = null;
    let soundEnabled = true;
    let finalResultRecorded = false;
    let sessionStatsRecorded = false;
    let lastStartWasDaily = false;
    let dailyShareText = "";

    function selectedMode() {
        return document.querySelector('input[name="game-mode"]:checked')?.value || "solo";
    }

    function showScreen(screen) {
        screens.forEach(item => {
            item.hidden = item !== screen;
        });
        window.scrollTo({ top: 0, behavior: "auto" });
        const heading = screen.querySelector("h1, h2");
        if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
        }
    }

    function setMode(mode) {
        const input = document.querySelector(`input[name="game-mode"][value="${mode}"]`);
        if (input) input.checked = true;
        elements.playerSettings.hidden = mode !== "versus";
        updateBestScore();
    }

    function updateBestScore() {
        const difficulty = elements.difficulty.value;
        const roundCount = Number(elements.roundCount.value);
        const label = game.DIFFICULTIES[difficulty].label;
        const best = storage.getBestScore(difficulty, roundCount);
        elements.bestScore.textContent = `${label}・${roundCount}ラウンドの自己ベスト: ${best}点`;
        elements.bestScore.hidden = selectedMode() !== "solo";
    }

    function localDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function updateStartStats() {
        const stats = storage.getLifetimeStats();
        elements.lifetimeStats.textContent = stats.gamesCompleted
            ? `通算 ${stats.gamesCompleted}ゲーム・正解 ${stats.roundsWon}問・最長連続挑戦 ${stats.bestDailyStreak}日`
            : "最初のゲームを遊ぶと、ここに通算成績が残ります。";

        const daily = storage.getDailyResult(localDateKey());
        elements.dailyStatus.textContent = daily
            ? `挑戦済み：${daily.won ? "正解" : "失敗"}・${daily.score}点`
            : "今日の記録はまだありません。最初の結果が記録されます。";
        elements.dailyStartButton.textContent = daily ? "練習する" : "挑戦する";
    }

    function updateAudioButtons() {
        document.querySelectorAll(".audio-toggle").forEach(button => {
            button.textContent = `音声: ${soundEnabled ? "オン" : "オフ"}`;
            button.setAttribute("aria-pressed", String(soundEnabled));
        });
    }

    function currentSettings() {
        return {
            mode: selectedMode(),
            difficulty: elements.difficulty.value,
            roundCount: Number(elements.roundCount.value),
            soundEnabled
        };
    }

    function setSoundEnabled(enabled, shouldStartBgm = false) {
        soundEnabled = Boolean(enabled);
        audio.setMuted(!soundEnabled);
        updateAudioButtons();
        storage.saveSettings(currentSettings());
        if (soundEnabled && shouldStartBgm && session?.phase === "playing") {
            playBgm();
        }
    }

    function toggleSound() {
        setSoundEnabled(!soundEnabled, true);
    }

    function playEffect(name) {
        if (!soundEnabled) return;
        const effect = audio.effects[name];
        if (effect) {
            effect.currentTime = 0;
            effect.play().catch(() => {});
        }
    }

    function playBgm() {
        if (soundEnabled && audio.bgm.paused) {
            audio.bgm.play().catch(() => {});
        }
    }

    function stopTimer() {
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
    }

    function startTimer() {
        stopTimer();
        renderTimer();
        timerIntervalId = setInterval(renderTimer, 1000);
    }

    function renderTimer() {
        if (!session || session.phase !== "playing") return;
        const elapsed = game.getElapsedSeconds(session, Date.now());
        elements.timer.textContent = `経過時間: ${elapsed}秒`;
    }

    function renderScoreboard() {
        elements.scoreboard.replaceChildren();
        elements.scoreboard.classList.toggle("is-solo", session.mode === "solo");
        session.players.forEach((player, index) => {
            const card = document.createElement("div");
            card.className = "score-card";
            if (session.mode === "versus" && session.currentPlayer === index) {
                card.classList.add("is-current");
            }
            const name = document.createElement("span");
            name.className = "score-name";
            name.textContent = player.name;
            const score = document.createElement("strong");
            score.className = "score-value";
            score.textContent = `${player.score}点`;
            card.append(name, score);
            elements.scoreboard.append(card);
        });
    }

    function renderWord() {
        elements.wordDisplay.replaceChildren();
        game.getMaskedCharacters(session).forEach((character, index) => {
            const span = document.createElement("span");
            span.className = session.revealed[index]
                ? "word-character is-revealed"
                : "word-character is-hidden";
            span.textContent = character;
            elements.wordDisplay.append(span);
        });
        elements.wordDisplay.setAttribute(
            "aria-label",
            `隠された言葉: ${game.getMaskedCharacters(session).join("、")}`
        );
    }

    function renderMessage(tone = "neutral") {
        elements.message.textContent = session.message;
        elements.message.classList.toggle("is-success", tone === "success");
        elements.message.classList.toggle("is-error", tone === "error");
    }

    function renderGame(tone = "neutral") {
        const roundNumber = session.currentRoundIndex + 1;
        elements.modeLabel.textContent = session.challenge === "daily"
            ? "日替わりチャレンジ"
            : session.mode === "solo"
                ? "1人プレイ"
                : "2人対戦";
        elements.roundHeading.textContent = session.challenge === "daily"
            ? "今日の一問"
            : session.isOvertime
                ? "延長戦"
                : `ラウンド ${roundNumber} / ${session.roundCount}`;
        elements.category.textContent = `カテゴリ: ${session.wordData.category}`;
        elements.meaningHint.textContent = session.wordData.hint;
        elements.life.textContent = `残りライフ ${session.lives} / ${session.maxLives}`;
        elements.life.setAttribute(
            "aria-label",
            `残りライフは${session.lives}、最大${session.maxLives}です`
        );
        elements.turn.textContent = session.mode === "versus"
            ? `${session.players[session.currentPlayer].name}の番です`
            : "";

        renderWord();
        renderScoreboard();
        renderMessage(tone);

        elements.usedLetters.textContent = session.usedLetters.length
            ? `使用済み: ${session.usedLetters.join("、")}`
            : "使用済み: なし";
        elements.usedAnswersDetails.hidden = session.usedAnswers.length === 0;
        elements.usedAnswers.textContent = session.usedAnswers.join("、");

        const hintOwner = session.mode === "versus"
            ? session.players[session.currentPlayer].name
            : "あなた";
        const remainingHints = session.hintsRemaining[session.currentPlayer];
        elements.hintButton.textContent = session.mode === "versus"
            ? `${hintOwner}のヒント（残り${remainingHints}）`
            : `ヒントを見る（残り${remainingHints}）`;
        elements.hintButton.disabled = remainingHints <= 0;
        renderTimer();
    }

    function collapseAnswerPanel() {
        elements.answerPanel.hidden = true;
        elements.answerToggle.setAttribute("aria-expanded", "false");
        elements.answerInput.value = "";
    }

    function showGameScreen() {
        showScreen(byId("game-screen"));
        collapseAnswerPanel();
        renderGame();
        startTimer();
        playBgm();
        elements.letterInput.value = "";
        elements.letterInput.focus();
    }

    function addResultRow(container, label, value) {
        const row = document.createElement("div");
        row.className = "result-score-row";
        const name = document.createElement("span");
        name.textContent = label;
        const score = document.createElement("strong");
        score.textContent = value;
        row.append(name, score);
        container.append(row);
    }

    function showRoundResult() {
        stopTimer();
        audio.bgm.pause();
        const outcome = session.roundOutcome;
        showScreen(byId("round-result-screen"));
        elements.roundResultKicker.textContent = session.isOvertime
            ? "延長戦の結果"
            : `ラウンド ${outcome.roundNumber} の結果`;
        elements.roundResultTitle.textContent = outcome.won ? "正解！" : "ゲームオーバー";
        elements.roundResultWord.textContent = `答えは「${outcome.word}」でした。`;
        elements.roundResultScores.replaceChildren();

        if (session.mode === "solo") {
            const detail = outcome.playerBreakdowns[0];
            if (detail.letters) addResultRow(elements.roundResultScores, "一文字正解", `+${detail.letters}点`);
            if (detail.answer) addResultRow(elements.roundResultScores, "単語正解", `+${detail.answer}点`);
            if (detail.clear) addResultRow(elements.roundResultScores, "クリア", `+${detail.clear}点`);
            if (detail.lives) addResultRow(elements.roundResultScores, "残りライフ", `+${detail.lives}点`);
            if (detail.time) addResultRow(elements.roundResultScores, "早解き", `+${detail.time}点`);
            if (detail.hint) addResultRow(elements.roundResultScores, "ヒント", `${detail.hint}点`);
            addResultRow(elements.roundResultScores, "ラウンド得点", `${outcome.roundScores[0]}点`);
            addResultRow(elements.roundResultScores, "合計", `${outcome.totalScores[0]}点`);
        } else {
            session.players.forEach((player, index) => {
                const roundScore = outcome.roundScores[index];
                addResultRow(
                    elements.roundResultScores,
                    player.name,
                    `${roundScore >= 0 ? "+" : ""}${roundScore}点（合計 ${outcome.totalScores[index]}点）`
                );
            });
        }

        const isLast = session.currentRoundIndex + 1 >= session.roundCount;
        elements.nextRoundButton.textContent = isLast
            ? "最終結果を見る"
            : "次のラウンドへ";
        playEffect(outcome.won ? "win" : "lose");
    }

    function celebrate() {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const resultCard = byId("final-result-screen");
        resultCard.classList.remove("is-celebrating");
        requestAnimationFrame(() => resultCard.classList.add("is-celebrating"));
        window.setTimeout(
            () => resultCard.classList.remove("is-celebrating"),
            700
        );
    }

    function showFinalResult() {
        stopTimer();
        audio.bgm.pause();
        showScreen(byId("final-result-screen"));
        elements.finalScores.replaceChildren();
        elements.sessionStats.replaceChildren();

        const totalScore = session.players[0].score;
        let shouldCelebrate = false;
        if (session.mode === "solo") {
            if (session.challenge === "daily") {
                const dailyResult = finalResultRecorded
                    ? {
                        record: storage.getDailyResult(session.dailyDateKey),
                        isFirstAttempt: false,
                        stats: storage.getLifetimeStats()
                    }
                    : storage.recordDailyResult(session.dailyDateKey, {
                        score: totalScore,
                        won: session.stats.correctRounds === 1,
                        elapsedSeconds: session.stats.totalTime
                    });
                elements.finalResultTitle.textContent = session.stats.correctRounds
                    ? "今日の一問、正解！"
                    : "今日の挑戦は終了";
                elements.finalSummary.textContent = dailyResult.isFirstAttempt
                    ? `今日の記録は${totalScore}点・連続挑戦${dailyResult.stats.currentDailyStreak}日です。`
                    : `練習結果は${totalScore}点です。今日の正式記録は${dailyResult.record.score}点です。`;
                dailyShareText = [
                    `言葉当てゲーム 今日の一問 ${session.dailyDateKey}`,
                    `${session.stats.correctRounds ? "正解" : "失敗"}・${totalScore}点・${session.stats.totalTime}秒`,
                    session.stats.correctRounds ? "🟩 今日もひらめいた！" : "⬜ また明日挑戦！"
                ].join("\n");
                shouldCelebrate = session.stats.correctRounds === 1;
            } else {
                const record = finalResultRecorded
                    ? {
                        best: storage.getBestScore(
                            session.difficulty,
                            session.originalRoundCount
                        ),
                        isNewBest: false
                    }
                    : storage.recordSoloScore(
                        session.difficulty,
                        session.originalRoundCount,
                        totalScore
                    );
                elements.finalResultTitle.textContent = session.stats.correctRounds === session.roundCount
                    ? "全ラウンドクリア！"
                    : "チャレンジ終了";
                elements.finalSummary.textContent = record.isNewBest
                    ? `新記録！ 合計 ${totalScore}点`
                    : `合計 ${totalScore}点・自己ベスト ${record.best}点`;
                shouldCelebrate = record.isNewBest
                    || session.stats.correctRounds === session.roundCount;
            }
            finalResultRecorded = true;
            addResultRow(elements.finalScores, "合計スコア", `${totalScore}点`);
        } else {
            const winner = game.getWinner(session);
            if (winner === -1) {
                elements.finalResultTitle.textContent = "引き分け！";
                elements.finalSummary.textContent = "同じ得点で対戦終了です。";
            } else {
                elements.finalResultTitle.textContent = `${session.players[winner].name}の勝ち！`;
                elements.finalSummary.textContent = `${session.players[winner].score}点で勝利しました。`;
                shouldCelebrate = true;
            }
            session.players.forEach(player => {
                addResultRow(elements.finalScores, player.name, `${player.score}点`);
            });
        }

        if (!sessionStatsRecorded) {
            storage.recordCompletedSession({
                roundsWon: session.stats.correctRounds,
                roundsLost: session.stats.failedRounds,
                totalTime: session.stats.totalTime
            });
            sessionStatsRecorded = true;
        }

        const stats = [
            ["正解", `${session.stats.correctRounds}問`],
            ["失敗", `${session.stats.failedRounds}問`],
            ["ミス", `${session.stats.misses}回`],
            ["ヒント", `${session.stats.hintsUsed}回`],
            ["失ったライフ", `${session.stats.livesLost}`],
            ["合計時間", `${session.stats.totalTime}秒`]
        ];
        stats.forEach(([label, value]) => {
            const wrapper = document.createElement("div");
            const term = document.createElement("dt");
            const description = document.createElement("dd");
            term.textContent = label;
            description.textContent = value;
            wrapper.append(term, description);
            elements.sessionStats.append(wrapper);
        });

        elements.overtimeButton.hidden = !game.canStartOvertime(session);
        elements.shareButton.hidden = session.challenge !== "daily";
        elements.replayButton.textContent = session.challenge === "daily"
            ? "練習でもう一度"
            : "同じ設定でもう一度";
        storage.rememberWords(session.roundHistory.map(round => round.word));
        updateBestScore();
        updateStartStats();
        if (shouldCelebrate) celebrate();
    }

    function startNewSession(options = {}) {
        const isDaily = options.daily === true;
        const settings = isDaily
            ? {
                mode: "solo",
                difficulty: "normal",
                roundCount: 1,
                soundEnabled
            }
            : currentSettings();
        const recentWords = isDaily ? [] : storage.getRecentWords();
        const extraWords = settings.mode === "versus" ? 1 : 0;
        try {
            const dateKey = localDateKey();
            const selectedWords = isDaily
                ? [wordsApi.selectDailyWord({
                    dateKey,
                    difficulty: settings.difficulty
                })]
                : wordsApi.selectWords({
                    difficulty: settings.difficulty,
                    count: settings.roundCount + extraWords,
                    recentWords
                });
            session = game.createSession({
                ...settings,
                challenge: isDaily ? "daily" : "standard",
                dailyDateKey: isDaily ? dateKey : null,
                playerNames: [
                    elements.playerOneName.value,
                    elements.playerTwoName.value
                ],
                words: selectedWords,
                now: Date.now()
            });
        } catch (_) {
            elements.bestScore.hidden = false;
            elements.bestScore.textContent = "ゲームの準備に失敗しました。もう一度お試しください。";
            return;
        }

        finalResultRecorded = false;
        sessionStatsRecorded = false;
        lastStartWasDaily = isDaily;
        dailyShareText = "";
        if (!isDaily) storage.saveSettings(settings);
        storage.incrementPlayCount();
        showGameScreen();
    }

    function handleLetterSubmit(event) {
        event.preventDefault();
        const result = game.submitLetter(session, elements.letterInput.value, Date.now());
        if (result.accepted) {
            elements.letterInput.value = "";
            playEffect(result.correct ? "correct" : "wrong");
        }
        if (result.roundEnded) {
            showRoundResult();
        } else {
            renderGame(result.accepted ? (result.correct ? "success" : "error") : "error");
            elements.letterInput.focus();
        }
    }

    function handleAnswerSubmit(event) {
        event.preventDefault();
        const result = game.submitAnswer(session, elements.answerInput.value, Date.now());
        if (result.accepted) {
            elements.answerInput.value = "";
            playEffect(result.correct ? "correct" : "wrong");
        }
        if (result.roundEnded) {
            showRoundResult();
        } else {
            renderGame(result.accepted ? (result.correct ? "success" : "error") : "error");
            elements.answerInput.focus();
        }
    }

    function openConfirm(message, confirmLabel, action) {
        elements.confirmMessage.textContent = message;
        elements.confirmActionButton.textContent = confirmLabel;
        pendingConfirmAction = action;
        if (typeof elements.confirmDialog.showModal === "function") {
            elements.confirmDialog.returnValue = "cancel";
            elements.confirmDialog.showModal();
        } else {
            if (window.confirm(message)) action();
            pendingConfirmAction = null;
        }
    }

    function requestHint() {
        const player = session.players[session.currentPlayer];
        const message = session.mode === "versus"
            ? `${player.name}が150点を使って文字を一つ開きます。使用後はターンを交代します。`
            : "150点を使って文字を一つ開きます。";
        openConfirm(message, "ヒントを見る", () => {
            const result = game.useHint(session, Math.random, Date.now());
            if (result.accepted) playEffect("hint");
            if (result.roundEnded) {
                showRoundResult();
            } else {
                renderGame(result.accepted ? "success" : "error");
                elements.letterInput.focus();
            }
        });
    }

    function returnToSettings() {
        stopTimer();
        audio.bgm.pause();
        session = null;
        showScreen(byId("start-screen"));
        updateBestScore();
        updateStartStats();
    }

    async function shareDailyResult() {
        if (!dailyShareText) return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: "言葉当てゲーム 今日の一問",
                    text: dailyShareText
                });
                return;
            }
            await navigator.clipboard.writeText(dailyShareText);
            elements.shareButton.textContent = "結果をコピーしました";
        } catch (_) {
            elements.shareButton.textContent = "共有できませんでした";
        }
    }

    function initialize() {
        const settings = storage.loadSettings();
        elements.difficulty.value = game.DIFFICULTIES[settings.difficulty]
            ? settings.difficulty
            : "normal";
        elements.roundCount.value = [1, 3, 5].includes(Number(settings.roundCount))
            ? String(settings.roundCount)
            : "3";
        soundEnabled = settings.soundEnabled !== false;
        audio.setMuted(!soundEnabled);
        setMode(settings.mode === "versus" ? "versus" : "solo");
        updateAudioButtons();
        updateBestScore();
        updateStartStats();
        showScreen(byId("start-screen"));
    }

    document.querySelectorAll('input[name="game-mode"]').forEach(input => {
        input.addEventListener("change", () => setMode(input.value));
    });
    elements.difficulty.addEventListener("change", updateBestScore);
    elements.roundCount.addEventListener("change", updateBestScore);
    elements.dailyStartButton.addEventListener("click", () => {
        startNewSession({ daily: true });
    });
    elements.setupForm.addEventListener("submit", event => {
        event.preventDefault();
        startNewSession();
    });
    document.querySelectorAll(".audio-toggle").forEach(button => {
        button.addEventListener("click", toggleSound);
    });
    elements.letterForm.addEventListener("submit", handleLetterSubmit);
    elements.answerForm.addEventListener("submit", handleAnswerSubmit);
    elements.answerToggle.addEventListener("click", () => {
        const shouldOpen = elements.answerPanel.hidden;
        elements.answerPanel.hidden = !shouldOpen;
        elements.answerToggle.setAttribute("aria-expanded", String(shouldOpen));
        if (shouldOpen) elements.answerInput.focus();
    });
    elements.hintButton.addEventListener("click", requestHint);
    elements.quitButton.addEventListener("click", () => {
        openConfirm(
            "現在のゲームを中断して設定画面に戻ります。今回のスコアは保存されません。",
            "中断する",
            returnToSettings
        );
    });
    elements.nextRoundButton.addEventListener("click", () => {
        if (game.continueSession(session, Date.now())) {
            showGameScreen();
        } else {
            showFinalResult();
        }
    });
    elements.replayButton.addEventListener("click", () => {
        startNewSession({ daily: lastStartWasDaily });
    });
    elements.shareButton.addEventListener("click", shareDailyResult);
    elements.settingsButton.addEventListener("click", returnToSettings);
    elements.overtimeButton.addEventListener("click", () => {
        if (game.startOvertime(session, Date.now())) {
            finalResultRecorded = false;
            showGameScreen();
        }
    });
    elements.confirmDialog.addEventListener("close", () => {
        if (elements.confirmDialog.returnValue === "confirm" && pendingConfirmAction) {
            pendingConfirmAction();
        }
        pendingConfirmAction = null;
    });
    document.addEventListener("visibilitychange", () => {
        if (!session || session.phase !== "playing") return;
        if (document.hidden) {
            game.pauseRound(session, Date.now());
            stopTimer();
            audio.bgm.pause();
        } else {
            game.resumeRound(session, Date.now());
            startTimer();
            playBgm();
        }
    });

    initialize();
})();
