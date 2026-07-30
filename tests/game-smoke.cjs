const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(...names) {
        names.forEach(name => this.values.add(name));
    }

    remove(...names) {
        names.forEach(name => this.values.delete(name));
    }

    contains(name) {
        return this.values.has(name);
    }
}

class FakeElement {
    constructor(id) {
        this.id = id;
        this.textContent = "";
        this.value = "";
        this.disabled = false;
        this.classList = new FakeClassList();
        this.attributes = new Map();
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    click() {
        if (!this.disabled) {
            this.listeners.get("click")?.({ preventDefault() {} });
        }
    }
}

function createAudioHandle() {
    return {
        paused: true,
        currentTime: 0,
        playCount: 0,
        pauseCount: 0,
        play() {
            this.paused = false;
            this.playCount++;
            return Promise.resolve();
        },
        pause() {
            this.paused = true;
            this.pauseCount++;
        }
    };
}

const ids = [
    "word-display",
    "turn-info",
    "message",
    "letter-input",
    "guess-button",
    "answer-input",
    "answer-button",
    "used-letters",
    "reset-button",
    "category-info",
    "life-info",
    "score-info",
    "hint-button",
    "audio-toggle-button",
    "timer"
];
const elements = Object.fromEntries(ids.map(id => [id, new FakeElement(id)]));
const bgm = createAudioHandle();
const effects = Object.fromEntries(
    ["correct", "wrong", "win", "lose", "hint"].map(name => [name, createAudioHandle()])
);
const gameAudio = {
    bgm,
    effects,
    muted: false,
    isMuted() {
        return this.muted;
    },
    setMuted(value) {
        this.muted = Boolean(value);
        if (this.muted) this.bgm.pause();
    }
};

let intervalId = 0;
const context = vm.createContext({
    window: { gameAudio },
    document: {
        getElementById(id) {
            return elements[id] || null;
        }
    },
    console,
    confetti() {},
    setInterval() {
        intervalId++;
        return intervalId;
    },
    clearInterval() {},
    Date: class extends Date {
        static now() {
            return 1_000_000;
        }
    },
    Math: Object.assign(Object.create(Math), { random: () => 0 })
});

const source = fs.readFileSync(path.join(__dirname, "..", "game_ver2.js"), "utf8");
vm.runInContext(source, context, { filename: "game_ver2.js" });

assert.equal(elements["turn-info"].textContent, "プレイヤー 1 の番です");
assert.equal(elements["life-info"].textContent, `のこり: ${"💖".repeat(10)}`);
assert.equal(elements["audio-toggle-button"].textContent, "音声: オン");

elements["letter-input"].value = "あ";
elements["guess-button"].click();
assert.equal(elements["turn-info"].textContent, "プレイヤー 2 の番です");
assert.equal((elements["life-info"].textContent.match(/🤍/g) || []).length, 1);
assert.equal(bgm.paused, false);

const lifeAfterMiss = elements["life-info"].textContent;
elements["letter-input"].value = "あ";
elements["guess-button"].click();
assert.equal(elements["life-info"].textContent, lifeAfterMiss);
assert.match(elements["message"].textContent, /既に使用されています/);

const displayBeforeHint = elements["word-display"].textContent;
elements["hint-button"].click();
assert.notEqual(elements["word-display"].textContent, displayBeforeHint);
assert.equal(elements["hint-button"].disabled, true);

const currentWord = vm.runInContext("currentWord", context);
elements["answer-input"].value = currentWord;
elements["answer-button"].click();
assert.match(elements["message"].textContent, /正解！/);
assert.equal(elements["answer-button"].disabled, true);
assert.equal(bgm.paused, true);

elements["reset-button"].click();
assert.equal(elements["turn-info"].textContent, "プレイヤー 1 の番です");
assert.equal(elements["answer-button"].disabled, false);
assert.equal(elements["score-info"].textContent, "スコア: 0");

elements["audio-toggle-button"].click();
assert.equal(gameAudio.isMuted(), true);
assert.equal(elements["audio-toggle-button"].textContent, "音声: オフ");
assert.equal(elements["audio-toggle-button"].getAttribute("aria-pressed"), "false");

elements["audio-toggle-button"].click();
assert.equal(gameAudio.isMuted(), false);
assert.equal(elements["audio-toggle-button"].textContent, "音声: オン");
assert.equal(bgm.paused, false);

for (let i = 0; i < 10; i++) {
    elements["answer-input"].value = "ぜったいにちがう";
    elements["answer-button"].click();
}
assert.match(elements["message"].textContent, /ゲームオーバー/);
assert.equal(elements["answer-button"].disabled, true);
assert.equal((elements["life-info"].textContent.match(/🤍/g) || []).length, 10);

console.log("主要なゲーム進行を確認しました");
