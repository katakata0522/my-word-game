// ==================================================================
// 言葉当てゲーム Ver.2 (JavaScript コード: game.js) - 修正版
// ==================================================================

// --- 1. 画面の部品 (HTML要素) をJavaScriptで使うための準備 ---
const wordDisplayElement = document.getElementById('word-display');
const turnInfoElement = document.getElementById('turn-info');
const messageElement = document.getElementById('message');
const letterInputElement = document.getElementById('letter-input');
const guessButton = document.getElementById('guess-button');
const answerInputElement = document.getElementById('answer-input');
const answerButton = document.getElementById('answer-button');
const usedLettersElement = document.getElementById('used-letters');
const resetButton = document.getElementById('reset-button');
const categoryInfoElement = document.getElementById('category-info');
const lifeInfoElement = document.getElementById('life-info');
const scoreInfoElement = document.getElementById('score-info');
const hintButton = document.getElementById('hint-button');
const bgmAudio = document.getElementById('bgm');
const soundCorrect = document.getElementById('sound-correct');
const soundWrong = document.getElementById('sound-wrong');
const soundWin = document.getElementById('sound-win');
const soundLose = document.getElementById('sound-lose');
const soundHint = document.getElementById('sound-hint');


// --- 2. ゲームの状態を覚えておくための箱 (変数) ---

let wordList = [
    // 果物
    { word: "りんご", category: "果物" }, { word: "ばなな", category: "果物" },
    { word: "みかん", category: "果物" }, { word: "いちご", category: "果物" },
    { word: "ぶどう", category: "果物" }, { word: "もも", category: "果物" },
    { word: "すいか", category: "果物" }, { word: "めろん", category: "果物" },
    // 動物
    { word: "いぬ", category: "動物" }, { word: "ねこ", category: "動物" },
    { word: "うさぎ", category: "動物" }, { word: "ぱんだ", category: "動物" },
    { word: "ぞう", category: "動物" }, { word: "きりん", category: "動物" },
    { word: "らいおん", category: "動物" }, { word: "とら", category: "動物" },
    // 野菜
    { word: "とまと", category: "野菜" }, { word: "きゅうり", category: "野菜" },
    { word: "なす", category: "野菜" }, { word: "ぴーまん", category: "野菜" },
    { word: "きゃべつ", category: "野菜" }, { word: "にんじん", category: "野菜" },
    // その他
    { word: "つくえ", category: "その他" }, { word: "いす", category: "その他" },
    { word: "くるま", category: "その他" }, { word: "でんしゃ", category: "その他" },
    { word: "たいよう", category: "その他" }, { word: "ほし", category: "その他" },
];

let currentWord = '';
let currentCategory = '';
let wordDisplay = [];
let usedLetters = [];
let currentPlayer = 1;
let gameOver = false;
const MAX_MISSES = 10;
let missCount = 0;
let startTime = 0;
let score = 0;             // ★重複削除
let hintUsed = false;          // ★重複削除
let timerIntervalId = null;    // タイマーID

// --- 3. ゲームで使う色々な機能 (関数) ---

/**
 * 経過時間を計算して表示する関数
 */
function updateTimerDisplay() {
    if (gameOver) return;
    const currentTime = Date.now();
    const elapsedTime = Math.floor((currentTime - startTime) / 1000);
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = `経過時間: ${elapsedTime}秒`;
    }
}

/**
 * 画面の表示を最新の状態にする関数
 */
function updateDisplay() {
    // 伏字表示
    wordDisplayElement.textContent = wordDisplay.join(' ');
    // カテゴリ表示
    categoryInfoElement.textContent = `カテゴリ: ${currentCategory}`;
    // 残りライフ表示
    const lifeHearts = '💖'.repeat(MAX_MISSES - missCount) + '🤍'.repeat(missCount);
    lifeInfoElement.textContent = `のこり: ${lifeHearts}`;
    // スコア表示
    scoreInfoElement.textContent = `スコア: ${score}`;
    // 使用済み文字表示
    const sortedUsedLetters = usedLetters.slice().sort();
    usedLettersElement.textContent = `使用済み: ${sortedUsedLetters.join(', ')}`;

    // ゲーム状態による表示・操作の切り替え
    if (gameOver) {
        turnInfoElement.textContent = '';
        letterInputElement.disabled = true;
        guessButton.disabled = true;
        answerInputElement.disabled = true;
        answerButton.disabled = true;
        hintButton.disabled = true;
    } else {
        turnInfoElement.textContent = `プレイヤー ${currentPlayer} の番です`;
        letterInputElement.disabled = false;
        guessButton.disabled = false;
        answerInputElement.disabled = false;
        answerButton.disabled = false;
        hintButton.disabled = hintUsed;
        messageElement.classList.remove('win-animation', 'game-over-message');
    }
}

/**
 * プレイヤーを交代する関数
 */
function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
}

/**
 * 文字が全て当てられたか (勝利したか) をチェックする関数
 */
function checkWin() {
    return !wordDisplay.includes('?');
}

/**
 * スコアを計算する関数
 */
function calculateScore() {
    const endTime = Date.now();
    const timeTaken = Math.floor((endTime - startTime) / 1000);
    let calculatedScore = 1000 - missCount * 100 - timeTaken * 5;
    if (hintUsed) {
        calculatedScore -= 200;
    }
    return Math.max(0, calculatedScore);
}

/**
 * ゲーム終了処理 (正解 or ミス上限)
 */
function handleGameOver(isWin) {
    // ▼▼▼ タイマーを停止 ▼▼▼ （関数の最初に移動）
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }
    // ▲▲▲ ここまで移動 ▲▲▲

    gameOver = true;
    bgmAudio.pause();

    if (isWin) {
        score = calculateScore();
        messageElement.textContent = `正解！おめでとう！答えは「${currentWord}」でした！ スコア: ${score}`;
        messageElement.classList.add('win-animation');
        playSound(soundWin);
        // 紙吹雪
        if (typeof confetti === 'function') { // confetti関数が存在するか確認
             confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        }
        wordDisplay = currentWord.split('');
    } else {
        messageElement.textContent = `ゲームオーバー… 正解は「${currentWord}」でした。`;
        messageElement.classList.add('game-over-message');
        playSound(soundLose);
    }
    updateDisplay();
}

/**
 * 不正解時の処理 (ミス回数カウント、ゲームオーバー判定)
 */
function handleIncorrectGuess() {
    missCount++;
    playSound(soundWrong);
    if (missCount >= MAX_MISSES) {
        handleGameOver(false);
    } else {
        switchPlayer();
        updateDisplay();
    }
}

/**
 * ゲームを初期化する関数
 */
function initializeGame() {
    // 古いタイマーを停止
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
    }

    // 新しいお題を選択
    const randomIndex = Math.floor(Math.random() * wordList.length);
    currentWord = wordList[randomIndex].word;
    currentCategory = wordList[randomIndex].category;

    // ゲーム状態をリセット
    wordDisplay = Array(currentWord.length).fill('?');
    usedLetters = [];
    currentPlayer = 1;
    gameOver = false;
    missCount = 0;
    score = 0;
    hintUsed = false;
    startTime = Date.now();

    // メッセージ欄や入力欄をクリア
    messageElement.textContent = 'ゲーム開始！';
    letterInputElement.value = '';
    answerInputElement.value = '';

    // 画面表示を最新の状態にする
    updateDisplay();

    // 新しいタイマーを開始
    updateTimerDisplay(); // 最初に0秒を表示
    timerIntervalId = setInterval(updateTimerDisplay, 1000); // 1秒ごとに更新

}

/**
 * 効果音を再生する関数
 */
function playSound(audio) {
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(error => console.log("効果音再生エラー:", error));
    }
}

/**
 * BGMの再生を試みる関数
 */
function playBgm() {
    if (bgmAudio && bgmAudio.paused) {
        bgmAudio.play().catch(error => console.log("BGM再生エラー:", error));
    }
}


// --- 4. ボタン操作やキー入力に対する処理 (イベントリスナー) ---

// 「決定」ボタン (1文字入力)
guessButton.addEventListener('click', () => {
    if (gameOver) return;
    playBgm();
    const guessedLetter = letterInputElement.value.trim();
    letterInputElement.value = '';
    if (!guessedLetter || !guessedLetter.match(/^[ぁ-んーゔ゛゜]+$/) || guessedLetter.length !== 1) {
         messageElement.textContent = 'ひらがな一文字を入力してください。'; return;
    }
    if (usedLetters.includes(guessedLetter)) {
        messageElement.textContent = `「${guessedLetter}」は既に使用されています。`; return;
    }
    usedLetters.push(guessedLetter);
    let hit = false;
    for (let i = 0; i < currentWord.length; i++) {
        if (currentWord[i] === guessedLetter && wordDisplay[i] === '?') {
            wordDisplay[i] = guessedLetter; hit = true;
        }
    }
    if (hit) {
        messageElement.textContent = `あたり！ 「${guessedLetter}」がありました！`;
        playSound(soundCorrect);
        if (checkWin()) { handleGameOver(true); } else { updateDisplay(); }
    } else {
        messageElement.textContent = `はずれ… 「${guessedLetter}」はありませんでした。`;
        handleIncorrectGuess();
    }
});

// 「解答」ボタン (答え入力)
answerButton.addEventListener('click', () => {
    if (gameOver) return;
    playBgm();
    const answerAttempt = answerInputElement.value.trim();
    answerInputElement.value = '';
    if (!answerAttempt) {
        messageElement.textContent = '解答を入力してください。'; return;
    }
    if (answerAttempt === currentWord) {
        handleGameOver(true);
    } else {
        messageElement.textContent = `残念！「${answerAttempt}」ではありませんでした。`;
        handleIncorrectGuess();
    }
});

// 「やり直す」ボタン
resetButton.addEventListener('click', () => {
    initializeGame();
});

// 「ヒントを見る」ボタン
hintButton.addEventListener('click', () => {
    if (gameOver || hintUsed) return;
    const hiddenIndexes = [];
    wordDisplay.forEach((char, index) => { if (char === '?') hiddenIndexes.push(index); });
    if (hiddenIndexes.length > 0) {
        const randomIndex = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
        const hintLetter = currentWord[randomIndex];
        wordDisplay[randomIndex] = hintLetter;
        hintUsed = true;
        messageElement.textContent = `ヒント！ 「${hintLetter}」がありました！`;
        playSound(soundHint);
        if (checkWin()) { handleGameOver(true); } else { updateDisplay(); }
    } else {
        messageElement.textContent = 'もう開ける文字がありません。';
    }
});

// Enterキー対応
letterInputElement.addEventListener('keydown', (event) => {
    if (!gameOver && (event.key === 'Enter' || event.keyCode === 13)) {
        event.preventDefault(); guessButton.click();
    }
});
answerInputElement.addEventListener('keydown', (event) => {
    if (!gameOver && (event.key === 'Enter' || event.keyCode === 13)) {
        event.preventDefault(); answerButton.click();
    }
});

// --- 5. ゲーム開始！ ---
initializeGame(); // 最初のゲームを準備・開始