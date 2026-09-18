export class SoundBoard {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  ensureContext() {
    if (!this.enabled) return null;
    this.context ||= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.68;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  voice({ frequency, duration = 0.08, volume = 0.035, wave = "sine", delay = 0, endFrequency = null }) {
    const context = this.ensureContext();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  noise({ duration = 0.08, volume = 0.02, delay = 0, highpass = 700 }) {
    const context = this.ensureContext();
    if (!context) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + duration);
  }

  tone(frequency, duration = 0.08, volume = 0.03, wave = "sine") {
    this.voice({ frequency, duration, volume, wave });
  }

  move() {
    this.voice({ frequency: 255, endFrequency: 220, duration: 0.028, volume: 0.012, wave: "triangle" });
  }

  rotate() {
    this.voice({ frequency: 410, endFrequency: 565, duration: 0.075, volume: 0.022, wave: "sine" });
    this.voice({ frequency: 820, duration: 0.055, volume: 0.008, wave: "triangle", delay: 0.018 });
  }

  drop() {
    this.voice({ frequency: 115, endFrequency: 58, duration: 0.11, volume: 0.045, wave: "sine" });
    this.noise({ duration: 0.055, volume: 0.014, highpass: 1200 });
  }

  hold() {
    this.voice({ frequency: 430, endFrequency: 610, duration: 0.09, volume: 0.02, wave: "sine" });
    this.voice({ frequency: 645, endFrequency: 760, duration: 0.11, volume: 0.014, wave: "sine", delay: 0.045 });
  }

  clear(lines) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const count = Math.min(4, Math.max(1, lines + 1));
    for (let index = 0; index < count; index += 1) {
      this.voice({
        frequency: notes[index],
        endFrequency: notes[index] * 1.015,
        duration: 0.22 + index * 0.035,
        volume: 0.026,
        wave: "sine",
        delay: index * 0.045,
      });
      this.voice({
        frequency: notes[index] * 2,
        duration: 0.12,
        volume: 0.008,
        wave: "triangle",
        delay: index * 0.045,
      });
    }
    this.noise({ duration: 0.28, volume: 0.008 + lines * 0.003, delay: 0.02, highpass: 2600 });
  }

  attack(lines = 1) {
    const power = Math.min(4, Math.max(1, lines));
    this.voice({
      frequency: 330 + power * 48,
      endFrequency: 980 + power * 105,
      duration: 0.24,
      volume: 0.018 + power * 0.004,
      wave: "sawtooth",
      delay: 0.08,
    });
    this.voice({
      frequency: 148 - power * 8,
      endFrequency: 72,
      duration: 0.17,
      volume: 0.025 + power * 0.005,
      wave: "sine",
      delay: 0.24,
    });
    this.noise({ duration: 0.11, volume: 0.009 + power * 0.003, delay: 0.24, highpass: 1700 });
  }

  gameOver() {
    [392, 329.63, 261.63].forEach((frequency, index) => {
      this.voice({ frequency, endFrequency: frequency * 0.96, duration: 0.24, volume: 0.018, wave: "sine", delay: index * 0.11 });
    });
  }
}
