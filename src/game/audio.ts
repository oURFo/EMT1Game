let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    sharedContext = new window.AudioContext();
  }
  if (sharedContext.state === "suspended") {
    void sharedContext.resume();
  }
  return sharedContext;
}

export function playFrequency(
  frequency: number,
  duration: number,
  volume = 0.025,
) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

export function playClickSound(enabled: boolean) {
  if (enabled) playFrequency(520, 0.035);
}

export function playToneSound(enabled: boolean) {
  if (enabled) playFrequency(720, 0.09);
}
