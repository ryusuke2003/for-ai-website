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

function persistCompletionSoundPreference(enabled) {
  const value = enabled ? '1' : '0';
  if (!safeWrite(COMPLETION_SOUND_STORAGE_KEY, value)) return false;

  const persisted = safeRead(COMPLETION_SOUND_STORAGE_KEY) === value;
  if (!persisted && !storageAccessFailed) reportStorageFailure();
  return persisted && !storageAccessFailed;
}

function getCompletionAudioContext() {
  if (typeof CompletionAudioContext !== 'function') return null;
  if (!completionAudioContext || completionAudioContext.state === 'closed') {
    try {
      completionAudioContext = new CompletionAudioContext();
    } catch {
      completionAudioContext = null;
      return null;
    }
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
  try {
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
    return true;
  } catch {
    return false;
  }
}

async function playCompletionSound({ preview = false, previewMessage = null } = {}) {
  if (!completionSoundEnabled) return;

  const context = await unlockCompletionAudio();
  if (!context || !scheduleCompletionChime(context)) {
    syncCompletionSoundUi('ブラウザの音声再生制限により完了音を鳴らせませんでした。タイマー機能はそのまま利用できます。');
    return;
  }

  if (preview) {
    syncCompletionSoundUi(
      previewMessage ?? '完了音をオンにしました。いまの短い音がタイマー完了時に鳴ります。',
    );
  }
}

async function toggleCompletionSound() {
  if (typeof CompletionAudioContext !== 'function') return;

  if (completionSoundEnabled) {
    completionSoundEnabled = false;
    const persisted = persistCompletionSoundPreference(false);
    syncCompletionSoundUi(
      persisted
        ? '完了音をオフにしました。'
        : '完了音をオフにしましたが、このブラウザには設定を保存できませんでした。再読み込みすると以前の設定へ戻る可能性があります。',
    );
    return;
  }

  const context = await unlockCompletionAudio();
  if (!context) {
    completionSoundEnabled = false;
    syncCompletionSoundUi('完了音を有効にできませんでした。タイマー機能はそのまま利用できます。');
    return;
  }

  completionSoundEnabled = true;
  const persisted = persistCompletionSoundPreference(true);
  syncCompletionSoundUi();
  await playCompletionSound({
    preview: true,
    previewMessage: persisted
      ? '完了音をオンにしました。いまの短い音がタイマー完了時に鳴ります。'
      : '完了音をオンにしました。今のタブでは鳴りますが、このブラウザには設定を保存できませんでした。再読み込みすると以前の設定へ戻る可能性があります。',
  });
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
