/**
 * Service de sons pour les notifications importantes
 * Utilise Web Audio API - aucun fichier audio requis
 */

const playSound = (buildFn) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    buildFn(ctx);
  } catch (e) {
    // Silently fail if audio not supported
  }
};

// ─── Alarme courses disponibles (style Yaango) ────────────────────────────────
let _alarmActive = false;
let _alarmTimeout = null;
let _alarmCtx = null;

function _playAlarmJingle() {
  if (!_alarmActive) return;
  try {
    // Crée un nouveau contexte si nécessaire
    if (!_alarmCtx || _alarmCtx.state === 'closed') {
      _alarmCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = _alarmCtx;
    const now = ctx.currentTime;
    // Mélodie Do-Mi-Sol-Do (C5-E5-G5-C6) rapide et joyeuse
    const notes = [
      { freq: 523.25, t: 0.00 },  // C5
      { freq: 659.25, t: 0.13 },  // E5
      { freq: 783.99, t: 0.26 },  // G5
      { freq: 1046.50, t: 0.39 }, // C6
    ];
    notes.forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + t);
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(0.38, now + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.22);
      osc.start(now + t);
      osc.stop(now + t + 0.22);
    });
  } catch (e) { /* silencieux */ }
  // Rejoue après la pause (jingle 0.6s + silence 1.9s = 2.5s total)
  _alarmTimeout = setTimeout(_playAlarmJingle, 2500);
}

export function startOrderAlarm() {
  if (_alarmActive) return;
  _alarmActive = true;
  _playAlarmJingle();
}

export function stopOrderAlarm() {
  _alarmActive = false;
  if (_alarmTimeout) {
    clearTimeout(_alarmTimeout);
    _alarmTimeout = null;
  }
}

/**
 * Son de caisse enregistreuse pour commande livrée
 * "Ka-ching!" - deux notes montantes + ding final
 */
export function playCashRegisterSound() {
  playSound((ctx) => {
    const now = ctx.currentTime;

    // Note 1 - "Ka" (court, grave)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(600, now);
    osc1.frequency.exponentialRampToValueAtTime(900, now + 0.08);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Note 2 - "Ching" (plus aigu)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1100, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.2);
    gain2.gain.setValueAtTime(0.5, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);

    // Ding final - cloche métallique
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1800, now + 0.28);
    gain3.gain.setValueAtTime(0.35, now + 0.28);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc3.start(now + 0.28);
    osc3.stop(now + 0.9);
  });
}

/**
 * Son notification chat — double ding ascendant (nouvelle commande disponible)
 */
export function playNewOrderSound() {
  playSound((ctx) => {
    const now = ctx.currentTime;

    // Premier ding
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.connect(g1); g1.connect(ctx.destination);
    o1.type = 'sine';
    o1.frequency.setValueAtTime(1046, now); // Do6
    g1.gain.setValueAtTime(0.0, now);
    g1.gain.linearRampToValueAtTime(0.45, now + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o1.start(now); o1.stop(now + 0.22);

    // Deuxième ding (tierce au-dessus)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1318, now + 0.16); // Mi6
    g2.gain.setValueAtTime(0.0, now + 0.16);
    g2.gain.linearRampToValueAtTime(0.5, now + 0.17);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    o2.start(now + 0.16); o2.stop(now + 0.55);
  });
}

/**
 * Son simple de confirmation (pour autres changements de statut)
 */
export function playConfirmSound() {
  playSound((ctx) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  });
}
