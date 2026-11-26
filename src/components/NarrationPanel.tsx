import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Check,
  Copy,
  FileAudio,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ATMOSFER_SUB_LAYERS,
  ATMOSFER_SUB_MAP,
  ATMOSFER_TOUR_INTRO,
  buildFullNarrationScript,
  EARTH_LAYERS,
  FULL_NARRATION_INTRO,
  LAYER_MAP,
  SURFACE_TOUR_INTRO,
  type AtmosSubLayerId,
  type LayerId,
} from '../data/earthContent';

export interface UploadedVoiceover {
  url: string;
  fileName: string;
  fileSizeBytes?: number;
  isBuiltIn?: boolean;
}

export type NarrationTrackKey =
  | 'pembukaan'
  | 'pembukaan-permukaan'
  | 'pembukaan-atmosfer'
  | 'full'
  | LayerId
  | AtmosSubLayerId;

interface NarrationPanelProps {
  activeTrack: NarrationTrackKey;
  onChangeTrack: (track: NarrationTrackKey) => void;
  voiceovers: Record<string, UploadedVoiceover>;
  hasDefaultVoiceover: (track: NarrationTrackKey) => boolean;
  onUploadVoiceover: (track: NarrationTrackKey, file: File) => void;
  onRemoveVoiceover: (track: NarrationTrackKey) => void;
  onRestoreDefaultVoiceover: (track: NarrationTrackKey) => void;
  onBeforePlayAudio: () => void;
  onFocusLayer: (layerId: LayerId) => void;
  onFocusAtmosSubLayer?: (subId: AtmosSubLayerId) => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAtmosSubTrack(track: NarrationTrackKey): track is AtmosSubLayerId {
  return (
    track === 'troposfer' ||
    track === 'stratosfer' ||
    track === 'mesosfer' ||
    track === 'termosfer'
  );
}

function getDefaultScript(track: NarrationTrackKey): string {
  if (track === 'pembukaan') return FULL_NARRATION_INTRO;
  if (track === 'pembukaan-permukaan') return SURFACE_TOUR_INTRO;
  if (track === 'pembukaan-atmosfer') return ATMOSFER_TOUR_INTRO;
  if (track === 'full') return buildFullNarrationScript();
  if (isAtmosSubTrack(track)) {
    return ATMOSFER_SUB_MAP[track].narration ?? ATMOSFER_SUB_MAP[track].detail;
  }
  return LAYER_MAP[track].narrationScript;
}

export function NarrationPanel({
  activeTrack,
  onChangeTrack,
  voiceovers,
  hasDefaultVoiceover,
  onUploadVoiceover,
  onRemoveVoiceover,
  onRestoreDefaultVoiceover,
  onBeforePlayAudio,
  onFocusLayer,
  onFocusAtmosSubLayer,
}: NarrationPanelProps) {
  const [customScripts, setCustomScripts] = useState<Record<string, string>>({});
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Uploaded Voiceover HTML5 Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);

  // Built-in Web Speech Synthesis state (id-ID narrator fallback when no VO uploaded)
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsRate, setTtsRate] = useState<number>(1.0);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const currentVoiceover = voiceovers[activeTrack];
  const currentScript = customScripts[activeTrack] ?? getDefaultScript(activeTrack);
  const trackLabel =
    activeTrack === 'pembukaan'
      ? 'Narasi Pembukaan (Pengenalan Bumi)'
      : activeTrack === 'pembukaan-permukaan'
        ? 'Narasi Pembukaan (Komponen Permukaan Bumi)'
        : activeTrack === 'pembukaan-atmosfer'
          ? 'Narasi Pembukaan (Lapisan Atmosfer)'
          : activeTrack === 'full'
            ? 'Narasi Lengkap (Pembukaan – Penutup)'
            : isAtmosSubTrack(activeTrack)
              ? `Narasi Lapisan ${ATMOSFER_SUB_MAP[activeTrack].name} (${ATMOSFER_SUB_MAP[activeTrack].range})`
              : `Narasi ${LAYER_MAP[activeTrack].name}`;

  // Stop audio & TTS when switching tracks
  useEffect(() => {
    setAudioPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setUploadError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (ttsSupported) {
      window.speechSynthesis.cancel();
      setTtsPlaying(false);
    }
  }, [activeTrack, currentVoiceover?.url, ttsSupported]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSelectTrack = (track: NarrationTrackKey) => {
    onChangeTrack(track);
    if (isAtmosSubTrack(track)) {
      onFocusAtmosSubLayer?.(track);
    } else if (
      track !== 'full' &&
      track !== 'pembukaan' &&
      track !== 'pembukaan-permukaan' &&
      track !== 'pembukaan-atmosfer'
    ) {
      onFocusLayer(track);
    }
  };

  const validateAndAcceptFile = (file: File) => {
    const validType =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|ogg|aac|webm|flac)$/i.test(file.name);
    if (!validType) {
      setUploadError('Format berkas tidak didukung. Unggah file audio MP3, WAV, M4A, atau OGG.');
      return;
    }
    setUploadError(null);
    onUploadVoiceover(activeTrack, file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndAcceptFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndAcceptFile(file);
  };

  const toggleAudioPlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (ttsSupported && ttsPlaying) {
      window.speechSynthesis.cancel();
      setTtsPlaying(false);
    }
    if (audioPlaying) {
      el.pause();
      setAudioPlaying(false);
    } else {
      onBeforePlayAudio();
      try {
        await el.play();
        setAudioPlaying(true);
      } catch {
        setUploadError('Audio gagal diputar. Coba klik putar lagi atau unggah ulang file audio.');
      }
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setAudioCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  };

  const toggleMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const handleStartTTS = () => {
    if (!ttsSupported) return;
    onBeforePlayAudio();
    if (audioRef.current && audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentScript);
    utterance.lang = 'id-ID';
    utterance.rate = ttsRate;
    utterance.onend = () => setTtsPlaying(false);
    utterance.onerror = () => setTtsPlaying(false);
    setTtsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopTTS = () => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setTtsPlaying(false);
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(currentScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback copy unavailable in restricted contexts
    }
  };

  const uploadedCount = Object.keys(voiceovers).length;

  return (
    <div className="space-y-4">
      {/* Track selector: Full narration or any of the 8 Earth layers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-300">
            Pilih Bagian Naskah & Voiceover
          </p>
          <p className="text-xs text-slate-400 font-mono-tabular">
            {uploadedCount} audio tersedia
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 earth-scroll">
          <button
            type="button"
            onClick={() => handleSelectTrack('pembukaan')}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTrack === 'pembukaan'
                ? 'bg-sky-500 border-sky-400 text-slate-950 font-semibold'
                : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-600'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Pembukaan</span>
            {voiceovers.pembukaan && <span className="text-[10px] opacity-80">· VO</span>}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTrack('pembukaan-permukaan')}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTrack === 'pembukaan-permukaan'
                ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-semibold'
                : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-600'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Pembukaan Permukaan</span>
            {voiceovers['pembukaan-permukaan'] && (
              <span className="text-[10px] opacity-80">· VO</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTrack('pembukaan-atmosfer')}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTrack === 'pembukaan-atmosfer'
                ? 'bg-cyan-400 border-cyan-300 text-slate-950 font-semibold'
                : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-600'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Pembukaan Atmosfer</span>
            {voiceovers['pembukaan-atmosfer'] && (
              <span className="text-[10px] opacity-80">· VO</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTrack('full')}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTrack === 'full'
                ? 'bg-sky-500 border-sky-400 text-slate-950 font-semibold'
                : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-600'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Naskah Lengkap</span>
            {voiceovers.full && <span className="text-[10px] opacity-80">· VO</span>}
          </button>

          {EARTH_LAYERS.map((layer) => {
            const isActive = activeTrack === layer.id;
            const hasVo = Boolean(voiceovers[layer.id]);
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => handleSelectTrack(layer.id)}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 border-sky-400 text-white'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: layer.accentHex }}
                  aria-hidden="true"
                />
                <span>{layer.name}</span>
                {hasVo && <span className="text-[10px] text-sky-400">· VO</span>}
              </button>
            );
          })}

          {ATMOSFER_SUB_LAYERS.map((sub) => {
            const isActive = activeTrack === sub.id;
            const hasVo = Boolean(voiceovers[sub.id]);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => handleSelectTrack(sub.id)}
                className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 border-cyan-400 text-white'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: sub.accentHex }}
                  aria-hidden="true"
                />
                <span>{sub.name}</span>
                {hasVo && <span className="text-[10px] text-cyan-300">· VO</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-column grid on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Top: Voiceover Upload & Custom Audio Player */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0E172A] p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Upload Voiceover Guru / Siswa
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{trackLabel}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {currentVoiceover ? (
            <div className="space-y-3">
              <audio
                ref={audioRef}
                src={currentVoiceover.url}
                preload="metadata"
                onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime || 0)}
                onEnded={() => setAudioPlaying(false)}
              />

              <div className="rounded-lg border border-slate-700/80 bg-slate-900/90 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {currentVoiceover.fileName}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono-tabular">
                      {currentVoiceover.isBuiltIn
                        ? 'Voiceover terpasang · Siap diputar'
                        : currentVoiceover.fileSizeBytes
                          ? `${formatFileSize(currentVoiceover.fileSizeBytes)} · Siap diputar`
                          : 'Siap diputar'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-md border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveVoiceover(activeTrack)}
                      aria-label="Hapus voiceover"
                      className="p-2 rounded-md border border-slate-700 text-rose-300 hover:bg-rose-950/60 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Audio playback controls */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={toggleAudioPlay}
                    aria-label={audioPlaying ? 'Jeda voiceover' : 'Putar voiceover'}
                    className="w-10 h-10 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center hover:bg-sky-400 transition-colors shrink-0 cursor-pointer"
                  >
                    {audioPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={audioDuration || 1}
                      step={0.1}
                      value={audioCurrentTime}
                      onChange={handleSeek}
                      aria-label="Posisi putar voiceover"
                      className="w-full earth-slider"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono-tabular">
                      <span>{formatTime(audioCurrentTime)}</span>
                      <span>{formatTime(audioDuration)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={audioMuted ? 'Nyalakan suara' : 'Bisukan suara'}
                    className="p-2 min-w-[36px] min-h-[36px] rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                  >
                    {audioMuted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
                dragOver
                  ? 'border-sky-400 bg-sky-950/40'
                  : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              <Upload className="w-6 h-6 text-sky-400 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-xs sm:text-sm font-medium text-slate-200">
                Unggah rekaman voiceover untuk bagian ini
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Mendukung MP3, WAV, M4A, atau OGG (bisa ditarik ke sini)
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih File Audio</span>
                </button>
                {hasDefaultVoiceover(activeTrack) && (
                  <button
                    type="button"
                    onClick={() => onRestoreDefaultVoiceover(activeTrack)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Pakai VO Bawaan</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-lg px-3 py-2">
              {uploadError}
            </p>
          )}

          {/* Built-in Browser Narrator (Speech Synthesis) */}
          {ttsSupported && (
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400">
                Suara Pembaca Naskah (Otomatis)
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Kecepatan suara"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 font-mono-tabular cursor-pointer"
                >
                  <option value={0.85}>0.85x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.15}>1.15x</option>
                </select>
                {ttsPlaying ? (
                  <button
                    type="button"
                    onClick={handleStopTTS}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-medium hover:bg-rose-500/30 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Hentikan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartTTS}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-xs font-medium hover:bg-slate-700 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Bacakan</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right/Bottom: Narration Script Viewer & Inline Editor */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0E172A] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Naskah Narasi Siap Rekam
              </h3>
              <p className="text-xs text-slate-400">
                Gunakan naskah ini untuk merekam voiceover atau ubah sesuai kebutuhan kelas
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsEditingScript((v) => !v)}
                className={`px-2.5 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium cursor-pointer ${
                  isEditingScript
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {isEditingScript ? 'Selesai Ubah' : 'Ubah Naskah'}
              </button>

              {customScripts[activeTrack] !== undefined && (
                <button
                  type="button"
                  onClick={() =>
                    setCustomScripts((prev) => {
                      const next = { ...prev };
                      delete next[activeTrack];
                      return next;
                    })
                  }
                  aria-label="Kembalikan naskah asli"
                  className="p-2 min-h-[36px] rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isEditingScript ? (
            <textarea
              value={currentScript}
              onChange={(e) =>
                setCustomScripts((prev) => ({
                  ...prev,
                  [activeTrack]: e.target.value,
                }))
              }
              rows={7}
              className="w-full rounded-lg border border-sky-500/50 bg-slate-950 p-3 text-sm leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 select-text"
            />
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-3.5 max-h-[210px] overflow-y-auto earth-scroll select-text">
              <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
                {currentScript}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
