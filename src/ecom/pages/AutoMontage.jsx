import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi';

// ─────────────────────────────────────────────────────────────────────────────
// Montage Auto — outil de montage vidéo automatique (séparé du Creative Center).
// Upload d'une vidéo brute → cuts dynamiques, sous-titres animés, b-rolls
// Grok Imagine, motion design, musique + SFX → MP4 finaux 9:16 / 16:9.
// Pattern : POST /auto-montage/start (202 + jobId) puis polling du job.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VIDEO_MB = 200;

const Spinner = ({ className = 'w-4 h-4' }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const AutoMontage = () => {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [musicFile, setMusicFile] = useState(null);

  const [formats, setFormats] = useState(['9:16']);
  const [captionStyle, setCaptionStyle] = useState('bold');
  const [brollCount, setBrollCount] = useState(3);
  const [brollMode, setBrollMode] = useState('kenburns');
  const [removeSilences, setRemoveSilences] = useState(true);

  const [phase, setPhase] = useState('setup'); // setup | processing | done | error
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [needCredits, setNeedCredits] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    ecomApi.get('/auto-montage/meta/options').then((r) => setMeta(r.data)).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (!videoFile) { setVideoPreview(null); return undefined; }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const pickVideo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('Choisissez un fichier vidéo (MP4, MOV, WebM…)'); return; }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`Vidéo trop lourde (${MAX_VIDEO_MB} Mo maximum)`); return; }
    setError('');
    setVideoFile(file);
  };

  const toggleFormat = (f) => {
    setFormats((prev) => {
      const next = prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f];
      return next.length ? next : prev; // toujours au moins un format
    });
  };

  const startPolling = (jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await ecomApi.get(`/auto-montage/jobs/${jobId}`);
        const j = r.data?.job;
        if (!j) return;
        setJob(j);
        if (j.status === 'done') { clearInterval(pollRef.current); setPhase('done'); }
        if (j.status === 'error') { clearInterval(pollRef.current); setError(j.error || 'Échec du montage.'); setPhase('error'); }
      } catch { /* erreur réseau transitoire : on continue de poller */ }
    }, 2500);
  };

  const handleStart = async () => {
    if (!videoFile) return;
    setError('');
    setNeedCredits(null);
    setPhase('processing');
    setJob({ progress: 1, stage: 'Envoi de la vidéo…' });
    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      if (musicFile) fd.append('music', musicFile);
      fd.append('formats', formats.join(','));
      fd.append('captionStyle', captionStyle);
      fd.append('brollCount', String(brollCount));
      fd.append('brollMode', brollMode);
      fd.append('removeSilences', String(removeSilences));
      const r = await ecomApi.post('/auto-montage/start', fd, { timeout: 0 });
      startPolling(r.data.jobId);
    } catch (err) {
      if (err.response?.status === 402) {
        setNeedCredits(err.response.data);
        setPhase('setup');
        return;
      }
      setError(err.response?.data?.message || 'Impossible de lancer le montage. Réessayez.');
      setPhase('setup');
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('setup');
    setJob(null);
    setError('');
  };

  const card = 'bg-white border border-gray-200 rounded-2xl p-6 shadow-sm';
  const chip = (active) => `px-4 py-2.5 rounded-xl text-sm font-semibold border transition cursor-pointer ${active ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-600/20' : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Montage Auto</h1>
        <p className="text-sm text-gray-600 mt-1">
          Uploadez votre vidéo brute — l'IA coupe les temps morts, ajoute sous-titres animés,
          b-rolls, motion design, musique et effets sonores.
        </p>
      </div>

      {needCredits && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-amber-800 text-sm">Crédits insuffisants</p>
            <p className="text-xs text-amber-700 mt-1">
              Ce montage coûte {meta?.credits ?? 4} crédits. Rechargez vos crédits créatifs pour continuer.
            </p>
          </div>
          <button onClick={() => navigate('/ecom/billing')} className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition">
            Recharger
          </button>
        </div>
      )}

      {error && phase !== 'error' && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {phase === 'setup' && (
        <>
          {/* Upload */}
          <div className={card}>
            <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">1 · Votre vidéo brute</label>
            {videoFile ? (
              <div className="flex items-center gap-4">
                <video src={videoPreview} className="w-28 h-40 object-cover rounded-xl border border-gray-200 bg-black" muted playsInline />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{videoFile.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{(videoFile.size / (1024 * 1024)).toFixed(1)} Mo</p>
                  <button onClick={() => setVideoFile(null)} className="mt-2 text-xs text-red-500 hover:text-red-600 transition">Changer de vidéo</button>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl py-10 cursor-pointer hover:border-primary-400 transition"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickVideo(e.dataTransfer.files?.[0]); }}
              >
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <span className="text-sm font-medium text-gray-700">Glissez votre vidéo ici ou cliquez</span>
                <span className="text-xs text-gray-500">MP4, MOV, WebM · {MAX_VIDEO_MB} Mo max · 12 min max</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
          </div>

          {/* Options */}
          <div className={card}>
            <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">2 · Options de montage</label>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Formats de sortie</p>
                <div className="flex gap-2">
                  <button type="button" className={chip(formats.includes('9:16'))} onClick={() => toggleFormat('9:16')}>9:16 · Reels/TikTok</button>
                  <button type="button" className={chip(formats.includes('16:9'))} onClick={() => toggleFormat('16:9')}>16:9 · YouTube</button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Style des sous-titres</p>
                <div className="flex gap-2 flex-wrap">
                  {(meta?.captionStyles || [
                    { id: 'bold', label: 'Impact (jaune)' }, { id: 'clean', label: 'Clean (blanc)' }, { id: 'neon', label: 'Néon (vert)' },
                  ]).map((s) => (
                    <button key={s.id} type="button" className={chip(captionStyle === s.id)} onClick={() => setCaptionStyle(s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">B-rolls générés par IA (Grok Imagine)</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setBrollCount(n)}
                        className={`w-9 h-9 rounded-lg text-sm font-bold border transition ${brollCount === n ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {brollCount > 0 && (
                    <select value={brollMode} onChange={(e) => setBrollMode(e.target.value)}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {(meta?.brollModes || [
                        { id: 'kenburns', label: 'Images animées (rapide)' }, { id: 'animated', label: 'Clips vidéo IA (plus lent)' },
                      ]).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={removeSilences} onChange={(e) => setRemoveSilences(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">Couper les silences et temps morts (cuts dynamiques)</span>
                </label>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Musique de fond <span className="normal-case">(optionnel — mixée avec baisse automatique sous la voix)</span></p>
                {musicFile ? (
                  <div className="flex items-center gap-3 text-sm text-gray-800">
                    <span className="truncate">{musicFile.name}</span>
                    <button onClick={() => setMusicFile(null)} className="text-xs text-red-500 hover:text-red-600 transition">Retirer</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 cursor-pointer hover:border-primary-400 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                    Ajouter un MP3
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => { setMusicFile(e.target.files?.[0] || null); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleStart} disabled={!videoFile}
            className="w-full py-4 rounded-2xl text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Lancer le montage automatique{meta?.credits ? ` · ${meta.credits} crédits` : ''}
          </button>
        </>
      )}

      {phase === 'processing' && (
        <div className={`${card} text-center py-10`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 mb-4">
            <Spinner className="w-7 h-7" />
          </div>
          <p className="text-lg font-bold text-gray-900">{job?.stage || 'Montage en cours…'}</p>
          <p className="text-xs text-gray-500 mt-1">Vous pouvez rester sur cette page — le rendu prend quelques minutes.</p>
          <div className="mt-5 max-w-sm mx-auto h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 rounded-full transition-all duration-700" style={{ width: `${Math.max(2, job?.progress || 0)}%` }} />
          </div>
          <p className="text-xs font-semibold text-gray-600 mt-2">{Math.round(job?.progress || 0)}%</p>
        </div>
      )}

      {phase === 'error' && (
        <div className={`${card} text-center py-10`}>
          <p className="text-lg font-bold text-red-600">Le montage a échoué</p>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
          <p className="text-xs text-gray-500 mt-1">Vos crédits ont été automatiquement remboursés.</p>
          <button onClick={reset} className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition">
            Réessayer
          </button>
        </div>
      )}

      {phase === 'done' && job && (
        <>
          <div className={card}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <p className="text-sm font-bold text-gray-900">Montage terminé</p>
              <div className="text-xs text-gray-500">
                {job.cutsRemovedSec > 0 && <span>{job.cutsRemovedSec}s de temps morts coupés · </span>}
                {job.brollCount > 0 && <span>{job.brollCount} b-roll(s) · </span>}
                {job.language && <span>langue : {job.language}</span>}
              </div>
            </div>
            {job.warning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">{job.warning}</p>
            )}
            <div className={`grid gap-4 ${job.outputs.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {job.outputs.map((o) => (
                <div key={o.format} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">{o.format === '9:16' ? '9:16 · Reels/TikTok' : '16:9 · YouTube'}</p>
                  <video src={o.url} controls playsInline className={`w-full rounded-xl border border-gray-200 bg-black ${o.format === '9:16' ? 'aspect-[9/16] max-h-[480px]' : 'aspect-video'}`} />
                  <a href={o.url} download target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Télécharger le MP4
                  </a>
                </div>
              ))}
            </div>
            {job.srtUrl && (
              <a href={job.srtUrl} download target="_blank" rel="noreferrer" className="inline-block mt-4 text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 transition">
                Télécharger les sous-titres (.srt)
              </a>
            )}
          </div>
          <button onClick={reset} className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">
            Monter une autre vidéo
          </button>
        </>
      )}
    </div>
  );
};

export default AutoMontage;
