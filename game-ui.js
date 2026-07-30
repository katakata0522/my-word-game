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
        const label = game.DIFFICULTIES[difficulty].label;
        const best = storage.getBestScores()[difficulty] || 0;
        elements.bestScore.textContent = `${label}の自己ベスト: ${best}点`;
        elements.bestScore.hidden = selectedMode() !== "solo";
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
        const elapsed = Math.max(
            0,
            Math.floor((Date.now() - session.roundStartAt) / 1000)
        );
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
        game.getMaskedCharacters(session).forEach(character => {
            const span = document.createElement("span");
            span.className = "word-character";
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
        elements.modeLabel.textContent = session.mode === "solo"
            ? "1人プレイ"
            : "2人対戦";
        elements.roundHeading.textContent = session.isOvertime
            ? "延長戦"
            : `ラウンド ${roundNumber} / ${session.roundCount}`;
        elements.category.textContent = `カテゴリ: ${session.wordData.category}`;
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
                addResultRow(
                    elements.roundResultScores,
                    player.name,
                    `+${outcome.roundScores[index]}点（合計 ${outcome.totalScores[index]}点）`
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
        if (typeof window.confetti === "function") {
            window.confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.65 },
                colors: ["#1267a3", "#18794e", "#f0b429"]
            });
        }
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
            const record = finalResultRecorded
                ? { best: storage.getBestScores()[session.difficulty], isNewBest: false }
                : storage.recordSoloScore(session.difficulty, totalScore);
            finalResultRecorded = true;
            elements.finalResultTitle.textContent = session.stats.correctRounds === session.roundCount
                ? "全ラウンドクリア！"
                : "チャレンジ終了";
            elements.finalSummary.textContent = record.isNewBest
                ? `新記録！ 合計 ${totalScore}点`
                : `合計 ${totalScore}点・自己ベスト ${record.best}点`;
            addResultRow(elements.finalScores, "合計スコア", `${totalScore}点`);
            shouldCelebrate = record.isNewBest || session.stats.correctRounds === session.roundCount;
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
        storage.rememberWords(session.roundHistory.map(round => round.word));
        updateBestScore();
        if (shouldCelebrate) celebrate();
    }

    function startNewSession() {
        const settings = currentSettings();
        const recentWords = storage.getRecentWords();
        const extraWords = settings.mode === "versus" ? 1 : 0;
        try {
            const selectedWords = wordsApi.selectWords({
                difficulty: settings.difficulty,
                count: settings.roundCount + extraWords,
                recentWords
            });
            session = game.createSession({
                ...settings,
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
        storage.saveSettings(settings);
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
            ? `${player.name}が最大150点を使ってヒントを見ます。ヒントを使うとターンを交代します。`
            : "最大150点を使ってヒントを見ます。";
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
        showScreen(byId("start-screen"));
    }

    document.querySelectorAll('input[name="game-mode"]').forEach(input => {
        input.addEventListener("change", () => setMode(input.value));
    });
    elements.difficulty.addEventListener("change", updateBestScore);
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
    elements.replayButton.addEventListener("click", startNewSession);
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

    initialize();
})();
