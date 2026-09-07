const completionSoundToggle = document.querySelector('#completion-sound-toggle');
const completionSoundStatus = document.querySelector('#completion-sound-status');

const COMPLETION_SOUND_STORAGE_KEY = 'one.completionSound.v1';
const CompletionAudioContext = window.AudioContext || window.webkitAudioContext;

let completionSoundEnabled = safeRead(COMPLETION_SOUND_STORAGE_KEY) === '1';
let completionAudioContext = null;

function syncCompletionSoundUi(message = null) {
  const supported = typeof CompletionAudioContext === 'function';
  if (!supported) completionSoundEnabled = false;

  completionSoundToggle.disabled = !supported;
  completionSoundToggle.setAttribute('aria-pressed', String(completionSoundEnabled));
  completionSoundToggle.classList.toggle('active', completionSoundEnabled);
  completionSoundToggle.textContent = supported
    ? `完了音 ${completionSoundEnabled ? 'ON' : 'OFF'}`
    : '完了音 非対応';

  if (message !== null) {
    completionSoundStatus.textContent = message;
  } else if (!supported) {
    completionSoundStatus.textContent = 'このブラウザでは完了音を利用できません。';
  } else if (completionSoundEnabled) {
    completionSoundStatus.textContent = '完了音はオンです。タイマーが0:00になったときだけ短く鳴ります。';
  } else {
    completionSoundStatus.textContent = '完了音はオフです。オンにすると短い試聴音が鳴ります。';
  }
}

function getCompletionAudioContext() {
  if (typeof CompletionAudioContext !== 'function') return null;
  if (!completionAudioContext || completionAudioContext.state === 'closed') {
    completionAudioContext = new CompletionAudioContext();
  }
  return completionAudioContext;
}

async function unlockCompletionAudio() {
  const context = getCompletionAudioContext();
  if (!context) return null;

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      return null;
    }
  }

  return context.state === 'running' ? context : null;
}

function scheduleCompletionChime(context) {
  const tones = [
    { frequency: 660, offset: 0, duration: 0.11 },
    { frequency: 880, offset: 0.14, duration: 0.16 },
  ];

  tones.forEach(({ frequency, offset, duration }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    const end = start + duration;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.035, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}

async function playCompletionSound({ preview = false } = {}) {
  if (!completionSoundEnabled) return;

  const context = await unlockCompletionAudio();
  if (!context) {
    syncCompletionSoundUi('ブラウザの音声再生制限により完了音を鳴らせませんでした。ページを操作してから再度お試しください。');
    return;
  }

  scheduleCompletionChime(context);
  if (preview) {
    syncCompletionSoundUi('完了音をオンにしました。いまの短い音がタイマー完了時に鳴ります。');
  }
}

async function toggleCompletionSound() {
  if (typeof CompletionAudioContext !== 'function') return;

  if (completionSoundEnabled) {
    completionSoundEnabled = false;
    safeWrite(COMPLETION_SOUND_STORAGE_KEY, '0');
    syncCompletionSoundUi('完了音をオフにしました。');
    return;
  }

  const context = await unlockCompletionAudio();
  if (!context) {
    completionSoundEnabled = false;
    syncCompletionSoundUi('完了音を有効にできませんでした。ブラウザの音声設定を確認してください。');
    return;
  }

  completionSoundEnabled = true;
  safeWrite(COMPLETION_SOUND_STORAGE_KEY, '1');
  syncCompletionSoundUi();
  await playCompletionSound({ preview: true });
}

function primeCompletionAudioFromGesture() {
  if (!completionSoundEnabled) return;
  void unlockCompletionAudio();
}

const finishTimerWithoutCompletionSound = finishTimer;
finishTimer = function finishTimerWithCompletionSound() {
  finishTimerWithoutCompletionSound();
  void playCompletionSound();
};

completionSoundToggle.addEventListener('click', () => {
  void toggleCompletionSound();
});
document.addEventListener('pointerdown', primeCompletionAudioFromGesture, true);
document.addEventListener('keydown', primeCompletionAudioFromGesture, true);

syncCompletionSoundUi();
