(function(root) {
    'use strict';

    let audioContext = null;
    let bgmIntervalId = null;
    let bgmSession = 0;

    function getAudioContext() {
        const AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) return null;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
        return audioContext;
    }

    function playTone(frequency, duration, type = 'sine', volume = 0.05, delay = 0) {
        const context = getAudioContext();
        if (!context) return;

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + delay;
        const endAt = startAt + duration;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.02);
    }

    function playSequence(notes, type = 'sine', volume = 0.05) {
        notes.forEach(note => {
            playTone(note.frequency, note.duration, type, volume, note.delay);
        });
    }

    function createAudioHandle(playCallback, pauseCallback = null) {
        return {
            currentTime: 0,
            _paused: true,
            get paused() {
                return this._paused;
            },
            play() {
                this._paused = false;
                playCallback();
                return Promise.resolve();
            },
            pause() {
                this._paused = true;
                if (pauseCallback) pauseCallback();
            }
        };
    }

    function playBgmLoop(session) {
        if (session !== bgmSession) return;
        playSequence([
            { frequency: 261.63, duration: 0.22, delay: 0.00 },
            { frequency: 329.63, duration: 0.22, delay: 0.30 },
            { frequency: 392.00, duration: 0.22, delay: 0.60 },
            { frequency: 329.63, duration: 0.22, delay: 0.90 },
            { frequency: 293.66, duration: 0.22, delay: 1.20 },
            { frequency: 349.23, duration: 0.22, delay: 1.50 },
            { frequency: 440.00, duration: 0.22, delay: 1.80 },
            { frequency: 349.23, duration: 0.22, delay: 2.10 }
        ], 'sine', 0.018);
    }

    function startBgm() {
        if (bgmIntervalId !== null) return;
        const session = ++bgmSession;
        playBgmLoop(session);
        bgmIntervalId = setInterval(() => playBgmLoop(session), 2400);
    }

    function stopBgm() {
        bgmSession++;
        if (bgmIntervalId !== null) {
            clearInterval(bgmIntervalId);
            bgmIntervalId = null;
        }
    }

    const effects = {
        correct: createAudioHandle(() => playSequence([
            { frequency: 523.25, duration: 0.12, delay: 0.00 },
            { frequency: 659.25, duration: 0.18, delay: 0.10 }
        ], 'sine', 0.07)),
        wrong: createAudioHandle(() => playSequence([
            { frequency: 220.00, duration: 0.16, delay: 0.00 },
            { frequency: 164.81, duration: 0.22, delay: 0.12 }
        ], 'square', 0.04)),
        win: createAudioHandle(() => playSequence([
            { frequency: 523.25, duration: 0.16, delay: 0.00 },
            { frequency: 659.25, duration: 0.16, delay: 0.14 },
            { frequency: 783.99, duration: 0.16, delay: 0.28 },
            { frequency: 1046.50, duration: 0.45, delay: 0.42 }
        ], 'sine', 0.08)),
        lose: createAudioHandle(() => playSequence([
            { frequency: 293.66, duration: 0.24, delay: 0.00 },
            { frequency: 246.94, duration: 0.24, delay: 0.20 },
            { frequency: 196.00, duration: 0.45, delay: 0.40 }
        ], 'triangle', 0.07)),
        hint: createAudioHandle(() => playSequence([
            { frequency: 880.00, duration: 0.10, delay: 0.00 },
            { frequency: 1174.66, duration: 0.18, delay: 0.10 }
        ], 'sine', 0.055))
    };

    root.gameAudio = {
        bgm: createAudioHandle(startBgm, stopBgm),
        effects
    };
})(window);
