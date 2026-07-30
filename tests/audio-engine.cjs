const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const oscillators = [];

class FakeOscillator {
    constructor() {
        this.frequency = { setValueAtTime() {} };
        this.listeners = new Map();
        this.stoppedImmediately = false;
        oscillators.push(this);
    }

    connect() {}
    disconnect() {}
    start() {}

    stop(at) {
        if (at === undefined) {
            this.stoppedImmediately = true;
            this.listeners.get("ended")?.();
        }
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }
}

class FakeGain {
    constructor() {
        this.gain = {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {}
        };
    }

    connect() {}
    disconnect() {}
}

class FakeAudioContext {
    constructor() {
        this.currentTime = 0;
        this.state = "running";
        this.destination = {};
    }

    createOscillator() {
        return new FakeOscillator();
    }

    createGain() {
        return new FakeGain();
    }

    resume() {
        return Promise.resolve();
    }
}

const window = { AudioContext: FakeAudioContext };
const context = vm.createContext({
    window,
    setInterval() {
        return 1;
    },
    clearInterval() {}
});
const source = fs.readFileSync(path.join(__dirname, "..", "audio-engine.js"), "utf8");
vm.runInContext(source, context, { filename: "audio-engine.js" });

window.gameAudio.bgm.play();
assert.equal(window.gameAudio.bgm.paused, false);
assert.equal(oscillators.length, 8);

window.gameAudio.setMuted(true);
assert.equal(window.gameAudio.isMuted(), true);
assert.equal(window.gameAudio.bgm.paused, true);
assert.ok(oscillators.every(oscillator => oscillator.stoppedImmediately));

const countWhileMuted = oscillators.length;
window.gameAudio.effects.correct.play();
assert.equal(oscillators.length, countWhileMuted);

window.gameAudio.setMuted(false);
window.gameAudio.effects.correct.play();
assert.equal(window.gameAudio.isMuted(), false);
assert.equal(oscillators.length, countWhileMuted + 2);

console.log("音声停止とミュート動作を確認しました");
