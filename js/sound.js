/* ===========================================================
   Fusion — Sound engine
   All sounds are synthesized live with the Web Audio API, so
   there are no audio files to download or cache. Works offline.
   =========================================================== */
(function () {
  "use strict";

  const MUTE_KEY = "fusion.muted.v1";
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* A single shaped oscillator note with a soft attack + exp decay. */
  function tone(opts) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const {
      freq,
      type = "sine",
      dur = 0.18,
      gain = 0.2,
      attack = 0.005,
      when = 0,
    } = opts;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* Short filtered noise burst — used for the airy "swoosh" on moves. */
  function noise(opts) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const { dur = 0.1, gain = 0.08, when = 0, type = "bandpass", freq = 900 } = opts;
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len); // decaying white noise
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /* Map a tile value to a pleasant pentatonic pitch so merges always
     sound musical and climb as the numbers grow. */
  const PENTA = [0, 2, 4, 7, 9];
  const BASE = 261.63; // C4
  function freqForValue(value) {
    const idx = Math.max(0, Math.round(Math.log2(value)) - 2); // 4 -> 0
    const octave = Math.floor(idx / 5);
    const note = PENTA[idx % 5] + 12 * octave;
    const capped = Math.min(note, 36); // keep it from getting shrill
    return BASE * Math.pow(2, capped / 12);
  }

  const Sound = {
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = !!m;
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch (e) {}
      if (!muted) {
        ensure();
        this.click();
      }
    },
    toggle() {
      this.setMuted(!muted);
      return muted;
    },
    // call from a user gesture so the AudioContext is allowed to start
    resume() {
      if (!muted) ensure();
    },

    /* soft, airy swoosh for a slide */
    move() {
      noise({ dur: 0.085, gain: 0.045, type: "bandpass", freq: 850 });
      tone({ freq: 175, type: "sine", dur: 0.07, gain: 0.035 });
    },

    /* satisfying bell-pop; pitch climbs with the resulting value.
       index lets a cascade of merges form a gentle chord. */
    merge(value, index) {
      index = index || 0;
      const base = freqForValue(value);
      const when = Math.min(index, 6) * 0.012;
      const g = Math.max(0.07, 0.2 - index * 0.018);
      tone({ freq: base, type: "triangle", dur: 0.34, gain: g, when, attack: 0.004 });
      tone({ freq: base * 2, type: "sine", dur: 0.22, gain: g * 0.45, when, attack: 0.004 });
      tone({ freq: base * 3, type: "sine", dur: 0.13, gain: g * 0.16, when, attack: 0.004 });
    },

    /* tiny blip when a new tile appears */
    spawn() {
      tone({ freq: 640, type: "sine", dur: 0.08, gain: 0.045, attack: 0.003 });
    },

    /* crisp UI tick */
    click() {
      tone({ freq: 520, type: "square", dur: 0.045, gain: 0.05 });
      tone({ freq: 880, type: "sine", dur: 0.06, gain: 0.035, when: 0.012 });
    },

    /* full glass shatter — sharp crack + tinkling shards + soft body.
       Fired as a reward when a big tile (128+) is formed. */
    glassShatter(value) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      // initial sharp crack
      noise({ dur: 0.13, gain: 0.17, type: "highpass", freq: 3600 });
      noise({ dur: 0.06, gain: 0.13, type: "bandpass", freq: 6200 });
      // scattered shards tinkling as they fall
      const shards = 10;
      for (let i = 0; i < shards; i++) {
        const f = 1700 + Math.random() * 4300;
        const when = Math.random() * 0.26;
        const dur = 0.05 + Math.random() * 0.16;
        const g = 0.04 + Math.random() * 0.05;
        tone({ freq: f, type: i % 2 ? "sine" : "triangle", dur, gain: g, when, attack: 0.002 });
      }
      // a lingering sparkle for the higher tiles
      if (value >= 512) {
        noise({ dur: 0.22, gain: 0.05, type: "highpass", freq: 5000, when: 0.05 });
      }
      // soft low body so it feels weighty, not just brittle
      tone({ freq: 150, type: "sine", dur: 0.18, gain: 0.07 });
    },

    /* happy ascending arpeggio on reaching 2048 */
    win() {
      const seq = [0, 4, 7, 12, 16];
      seq.forEach((semi, i) => {
        const f = BASE * Math.pow(2, semi / 12);
        tone({ freq: f, type: "triangle", dur: 0.42, gain: 0.17, when: i * 0.12, attack: 0.006 });
        tone({ freq: f * 2, type: "sine", dur: 0.3, gain: 0.07, when: i * 0.12 });
      });
    },

    /* gentle descending tones on game over */
    gameover() {
      const seq = [7, 4, 0, -3];
      seq.forEach((semi, i) => {
        const f = BASE * Math.pow(2, semi / 12);
        tone({ freq: f, type: "sine", dur: 0.5, gain: 0.13, when: i * 0.16, attack: 0.012 });
      });
    },
  };

  window.Sound = Sound;
})();
