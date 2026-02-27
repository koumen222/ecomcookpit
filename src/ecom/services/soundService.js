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
