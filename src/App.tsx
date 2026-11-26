import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ControlDock, type DrawerTab } from './components/ControlDock';
import { EarthViewport, type EarthViewportHandle } from './components/EarthViewport';
import { LearningDrawer } from './components/LearningDrawer';
import type {
  NarrationTrackKey,
  UploadedVoiceover,
} from './components/NarrationPanel';
import {
  ASTRO_BUMI_INTRO,
  ASTRO_BUMI_WHOLE,
  ATMOSFER_SUB_MAP,
  ATMOSFER_TOUR_INTRO,
  ATMOSFER_TOUR_OUTRO,
  FULL_NARRATION_INTRO,
  FULL_NARRATION_OUTRO,
  LAYER_MAP,
  SURFACE_BUMI_INTRO,
  SURFACE_TOUR_INTRO,
  SURFACE_TOUR_OUTRO,
  type AtmosSubLayerId,
  type LayerId,
} from './data/earthContent';
import {
  detectLightweightDevice,
  type CutawayMode,
  type TourStage,
} from './three/earthScene';

const INITIAL_ECO_MODE = detectLightweightDevice();

const DEFAULT_VOICEOVERS: Partial<Record<NarrationTrackKey, UploadedVoiceover>> = {
  pembukaan: {
    url: '/assets/aistudio/pembukaan_5d70396e.wav',
    fileName: 'pembukaan.wav',
    isBuiltIn: true,
  },
  kerak: {
    url: '/assets/aistudio/kerak_bumi_1db1cd0a.wav',
    fileName: 'kerak_bumi.wav',
    isBuiltIn: true,
  },
  mantel: {
    url: '/assets/aistudio/mantel_bumi_95708ba8.wav',
    fileName: 'mantel_bumi.wav',
    isBuiltIn: true,
  },
  'inti-luar': {
    url: '/assets/aistudio/inti_luar_bumi_8d581d90.wav',
    fileName: 'inti_luar_bumi.wav',
    isBuiltIn: true,
  },
  'inti-dalam': {
    url: '/assets/aistudio/inti_dalam_bumi_c4d368a1.wav',
    fileName: 'inti_dalam_bumi.wav',
    isBuiltIn: true,
  },
  'pembukaan-permukaan': {
    url: '/assets/aistudio/pembukaan_penjelasan_permukaan_bumi_dfc9aa45.wav',
    fileName: 'pembukaan_penjelasan_permukaan_bumi.wav',
    isBuiltIn: true,
  },
  litosfer: {
    url: '/assets/aistudio/litosfer_8be98c7b.wav',
    fileName: 'litosfer.wav',
    isBuiltIn: true,
  },
  hidrosfer: {
    url: '/assets/aistudio/hidrosfer_067d8dff.wav',
    fileName: 'hidrosfer.wav',
    isBuiltIn: true,
  },
  biosfer: {
    url: '/assets/aistudio/biosfer_3dcbc6d2.wav',
    fileName: 'biosfer.wav',
    isBuiltIn: true,
  },
  atmosfer: {
    url: '/assets/aistudio/atmosfer_000e3579.wav',
    fileName: 'atmosfer.wav',
    isBuiltIn: true,
  },
  'pembukaan-atmosfer': {
    url: '/assets/aistudio/pembukaan_atmosfer_df307b88.wav',
    fileName: 'pembukaan_atmosfer.wav',
    isBuiltIn: true,
  },
  troposfer: {
    url: '/assets/aistudio/troposfer_26bd04e1.wav',
    fileName: 'troposfer.wav',
    isBuiltIn: true,
  },
  stratosfer: {
    url: '/assets/aistudio/stratosfer_3176f3c5.wav',
    fileName: 'stratosfer.wav',
    isBuiltIn: true,
  },
  mesosfer: {
    url: '/assets/aistudio/mesosfer_cfb8ff11.wav',
    fileName: 'mesosfer.wav',
    isBuiltIn: true,
  },
  termosfer: {
    url: '/assets/aistudio/termosfer_dan_eksosfer_b9b2ffae.wav',
    fileName: 'termosfer_dan_eksosfer.wav',
    isBuiltIn: true,
  },
};

interface TourChapter {
  stage: Exclude<TourStage, 'idle' | 'done'>;
  track: NarrationTrackKey | null;
  label: string;
  script: string;
}

const INTERNAL_TOUR_CHAPTERS: TourChapter[] = [
  {
    stage: 'whole',
    track: 'pembukaan',
    label: 'Tahap 1/5 · Pembukaan',
    script: FULL_NARRATION_INTRO,
  },
  {
    stage: 'kerak',
    track: 'kerak',
    label: 'Tahap 2/5 · Kerak Bumi',
    script: LAYER_MAP.kerak.narrationScript,
  },
  {
    stage: 'mantel',
    track: 'mantel',
    label: 'Tahap 3/5 · Mantel Bumi',
    script: LAYER_MAP.mantel.narrationScript,
  },
  {
    stage: 'inti-luar',
    track: 'inti-luar',
    label: 'Tahap 4/5 · Inti Luar',
    script: LAYER_MAP['inti-luar'].narrationScript,
  },
  {
    stage: 'inti-dalam',
    track: 'inti-dalam',
    label: 'Tahap 5/5 · Inti Dalam',
    script: LAYER_MAP['inti-dalam'].narrationScript,
  },
];

const SURFACE_TOUR_CHAPTERS: TourChapter[] = [
  {
    stage: 'surface-intro',
    track: 'pembukaan-permukaan',
    label: 'Tahap 1/5 · Permukaan Bumi',
    script: SURFACE_TOUR_INTRO,
  },
  {
    stage: 'litosfer',
    track: 'litosfer',
    label: 'Tahap 2/5 · Litosfer',
    script: LAYER_MAP.litosfer.narrationScript,
  },
  {
    stage: 'hidrosfer',
    track: 'hidrosfer',
    label: 'Tahap 3/5 · Hidrosfer',
    script: LAYER_MAP.hidrosfer.narrationScript,
  },
  {
    stage: 'biosfer',
    track: 'biosfer',
    label: 'Tahap 4/5 · Biosfer',
    script: LAYER_MAP.biosfer.narrationScript,
  },
  {
    stage: 'atmosfer',
    track: 'atmosfer',
    label: 'Tahap 5/5 · Atmosfer',
    script: LAYER_MAP.atmosfer.narrationScript,
  },
];

const ATMOS_TOUR_CHAPTERS: TourChapter[] = [
  {
    stage: 'atmos-intro',
    track: 'pembukaan-atmosfer',
    label: 'Tahap 1/5 · Lapisan Atmosfer',
    script: ATMOSFER_TOUR_INTRO,
  },
  {
    stage: 'troposfer',
    track: 'troposfer',
    label: 'Tahap 2/5 · Troposfer (0–12 km)',
    script: ATMOSFER_SUB_MAP.troposfer.narration ?? ATMOSFER_SUB_MAP.troposfer.detail,
  },
  {
    stage: 'stratosfer',
    track: 'stratosfer',
    label: 'Tahap 3/5 · Stratosfer & Ozon (12–50 km)',
    script: ATMOSFER_SUB_MAP.stratosfer.narration ?? ATMOSFER_SUB_MAP.stratosfer.detail,
  },
  {
    stage: 'mesosfer',
    track: 'mesosfer',
    label: 'Tahap 4/5 · Mesosfer (50–85 km)',
    script: ATMOSFER_SUB_MAP.mesosfer.narration ?? ATMOSFER_SUB_MAP.mesosfer.detail,
  },
  {
    stage: 'termosfer',
    track: 'termosfer',
    label: 'Tahap 5/5 · Termosfer & Eksosfer (> 85 km)',
    script: ATMOSFER_SUB_MAP.termosfer.narration ?? ATMOSFER_SUB_MAP.termosfer.detail,
  },
];

function createInitialVoiceovers(): Record<string, UploadedVoiceover> {
  const initial: Record<string, UploadedVoiceover> = {};
  (Object.keys(DEFAULT_VOICEOVERS) as NarrationTrackKey[]).forEach((key) => {
    const entry = DEFAULT_VOICEOVERS[key];
    if (entry) initial[key] = entry;
  });
  return initial;
}

function revokeIfBlob(vo?: UploadedVoiceover) {
  if (vo && !vo.isBuiltIn && vo.url.startsWith('blob:')) {
    URL.revokeObjectURL(vo.url);
  }
}

export default function App() {
  const viewportRef = useRef<EarthViewportHandle | null>(null);

  // 3D Scene state (auto-enables Mode Ringan on phones, tablets, touch PIDs & low-power devices)
  const [cutawayMode, setCutawayMode] = useState<CutawayMode>('teleskop');
  const [cutaway, setCutaway] = useState(0.68);
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [ecoMode, setEcoMode] = useState<boolean>(INITIAL_ECO_MODE);
  const [shadowsEnabled, setShadowsEnabled] = useState<boolean>(!INITIAL_ECO_MODE);
  const [tourStage, setTourStage] = useState<TourStage>('idle');
  const [tourChapterIndex, setTourChapterIndex] = useState<number>(-1);
  const [activeTourKind, setActiveTourKind] = useState<'internal' | 'surface' | 'atmosfer'>('internal');
  const activeTourKindRef = useRef<'internal' | 'surface' | 'atmosfer'>('internal');

  // Astro Bumi thought-bubble narration state
  const [astroMessage, setAstroMessage] = useState<string>(ASTRO_BUMI_INTRO);
  const [astroSubtitle, setAstroSubtitle] = useState<string | null>(null);
  const [astroBubbleOpen, setAstroBubbleOpen] = useState(true);

  // Selected layer & responsive learning panel state
  const [selectedLayerId, setSelectedLayerId] = useState<LayerId>('kerak');
  const [tappedLayerId, setTappedLayerId] = useState<LayerId | null>(null);
  const [activeAtmosSubId, setActiveAtmosSubId] = useState<AtmosSubLayerId | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('materi');

  // Narration & preloaded + custom voiceover state
  const [narrationTrack, setNarrationTrack] = useState<NarrationTrackKey>('pembukaan');
  const [voiceovers, setVoiceovers] = useState<Record<string, UploadedVoiceover>>(
    createInitialVoiceovers,
  );
  const voiceoversRef = useRef(voiceovers);
  voiceoversRef.current = voiceovers;

  // Global synchronized audio player & tour timer refs
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioOnEndedRef = useRef<(() => void) | null>(null);
  const tourTimerRef = useRef<number | null>(null);
  const tourChapterIdxRef = useRef<number>(-1);
  const [playingTrack, setPlayingTrack] = useState<NarrationTrackKey | null>(null);
  const [autoVoiceover, setAutoVoiceover] = useState(true);
  const autoVoiceoverRef = useRef(autoVoiceover);
  autoVoiceoverRef.current = autoVoiceover;

  // 15-question quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  const clearTourTimer = useCallback(() => {
    if (tourTimerRef.current !== null) {
      window.clearTimeout(tourTimerRef.current);
      tourTimerRef.current = null;
    }
  }, []);

  const [ttsSpeaking, setTtsSpeaking] = useState(false);

  const stopVoiceover = useCallback(() => {
    audioOnEndedRef.current = null;
    const audio = voiceoverAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setTtsSpeaking(false);
    setPlayingTrack(null);
  }, []);

  const speakIndonesianText = useCallback(
    (text: string, onEnded?: () => void): boolean => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return false;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 0.98;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          setTtsSpeaking(false);
          if (onEnded) onEnded();
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        setTtsSpeaking(true);
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        setTtsSpeaking(false);
        return false;
      }
    },
    [],
  );

  const playVoiceoverTrack = useCallback(
    (track: NarrationTrackKey, onEnded?: () => void): boolean => {
      const vo = voiceoversRef.current[track];
      audioOnEndedRef.current = null;

      if (!vo) {
        if (voiceoverAudioRef.current) {
          voiceoverAudioRef.current.pause();
          voiceoverAudioRef.current.currentTime = 0;
        }
        setPlayingTrack(null);
        return false;
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setTtsSpeaking(false);

      let audio = voiceoverAudioRef.current;
      if (!audio) {
        audio = new Audio();
        audio.preload = 'none';
        audio.onended = () => {
          setPlayingTrack(null);
          const cb = audioOnEndedRef.current;
          audioOnEndedRef.current = null;
          if (cb) cb();
        };
        audio.onerror = () => {
          setPlayingTrack(null);
          const cb = audioOnEndedRef.current;
          audioOnEndedRef.current = null;
          if (cb) cb();
        };
        voiceoverAudioRef.current = audio;
      }

      audio.pause();
      if (audio.src !== new URL(vo.url, window.location.href).href) {
        audio.src = vo.url;
      }
      audio.currentTime = 0;
      audioOnEndedRef.current = onEnded ?? null;
      setPlayingTrack(track);

      audio.play().catch(() => {
        setPlayingTrack(null);
        audioOnEndedRef.current = null;
        if (onEnded) {
          clearTourTimer();
          tourTimerRef.current = window.setTimeout(onEnded, 6000);
        }
      });
      return true;
    },
    [clearTourTimer],
  );

  // Advances to a specific chapter in Internal Earth, Surface Components, or Atmosfer 5-part 3D tour
  const runTourChapter = useCallback(
    (index: number, kind?: 'internal' | 'surface' | 'atmosfer') => {
      const resolvedKind = kind ?? activeTourKindRef.current;
      const chapters =
        resolvedKind === 'atmosfer'
          ? ATMOS_TOUR_CHAPTERS
          : resolvedKind === 'surface'
            ? SURFACE_TOUR_CHAPTERS
            : INTERNAL_TOUR_CHAPTERS;

      clearTourTimer();
      stopVoiceover();

      if (index < 0 || index >= chapters.length) {
        tourChapterIdxRef.current = -1;
        setTourChapterIndex(-1);
        setTourStage('done');
        setTappedLayerId(null);
        setActiveAtmosSubId(null);
        setAstroSubtitle('Selesai · Jelajahi Bebas');
        setAstroMessage(
          resolvedKind === 'atmosfer'
            ? ATMOSFER_TOUR_OUTRO
            : resolvedKind === 'surface'
              ? SURFACE_TOUR_OUTRO
              : FULL_NARRATION_OUTRO,
        );
        viewportRef.current?.setTourStage('done');
        return;
      }

      const chapter = chapters[index];
      activeTourKindRef.current = resolvedKind;
      setActiveTourKind(resolvedKind);
      tourChapterIdxRef.current = index;
      setTourChapterIndex(index);
      setTourStage(chapter.stage);
      setAstroSubtitle(chapter.label);
      setAstroMessage(chapter.script);
      setAstroBubbleOpen(true);

      if (
        chapter.stage === 'troposfer' ||
        chapter.stage === 'stratosfer' ||
        chapter.stage === 'mesosfer' ||
        chapter.stage === 'termosfer'
      ) {
        setSelectedLayerId('atmosfer');
        setTappedLayerId('atmosfer');
        setActiveAtmosSubId(chapter.stage);
      } else if (chapter.stage === 'atmos-intro') {
        setSelectedLayerId('atmosfer');
        setTappedLayerId('atmosfer');
        setActiveAtmosSubId(null);
      } else if (chapter.stage !== 'whole' && chapter.stage !== 'surface-intro') {
        setSelectedLayerId(chapter.stage);
        setTappedLayerId(chapter.stage);
        setActiveAtmosSubId(null);
      } else {
        setTappedLayerId(null);
        setActiveAtmosSubId(null);
      }

      // Direct 3D camera, cutaway/separation, label reveal, and pulsing spotlight highlight
      viewportRef.current?.setTourStage(chapter.stage);

      const scheduleNext = () => {
        if (tourChapterIdxRef.current !== index) return;
        clearTourTimer();
        tourTimerRef.current = window.setTimeout(() => {
          if (tourChapterIdxRef.current === index) {
            runTourChapter(index + 1, resolvedKind);
          }
        }, 650);
      };

      let startedAudio = false;
      if (autoVoiceoverRef.current) {
        if (chapter.track && playVoiceoverTrack(chapter.track, scheduleNext)) {
          startedAudio = true;
        } else if (speakIndonesianText(chapter.script, scheduleNext)) {
          startedAudio = true;
        }
      }

      if (!startedAudio) {
        // Fallback auto-advance if sound is muted or speech API unavailable
        tourTimerRef.current = window.setTimeout(() => {
          if (tourChapterIdxRef.current === index) {
            runTourChapter(index + 1, resolvedKind);
          }
        }, 6500);
      }
    },
    [clearTourTimer, playVoiceoverTrack, speakIndonesianText, stopVoiceover],
  );

  const cancelActiveTour = useCallback(() => {
    clearTourTimer();
    if (tourChapterIdxRef.current !== -1) {
      tourChapterIdxRef.current = -1;
      setTourChapterIndex(-1);
      setTourStage('idle');
      setAstroSubtitle(null);
      viewportRef.current?.stopLayerTourAnimation();
    }
  }, [clearTourTimer]);

  useEffect(() => {
    return () => {
      clearTourTimer();
      audioOnEndedRef.current = null;
      if (voiceoverAudioRef.current) {
        voiceoverAudioRef.current.pause();
        voiceoverAudioRef.current.src = '';
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      Object.values(voiceoversRef.current).forEach(revokeIfBlob);
    };
  }, [clearTourTimer]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        if (drawerOpen) {
          setDrawerOpen(false);
        } else {
          setDockCollapsed((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  // Pause 3D WebGL rendering when mobile bottom sheet is expanded over screen so scrolling is silky-smooth
  useEffect(() => {
    const syncPause = () => {
      const mobileExpanded = drawerOpen && drawerExpanded && window.innerWidth < 1024;
      viewportRef.current?.setPaused(mobileExpanded);
    };
    syncPause();
    window.addEventListener('resize', syncPause);
    return () => window.removeEventListener('resize', syncPause);
  }, [drawerOpen, drawerExpanded]);

  const handleSelectAtmosSubLayer = useCallback(
    (subId: AtmosSubLayerId) => {
      cancelActiveTour();
      stopVoiceover();
      const sub = ATMOSFER_SUB_MAP[subId];
      if (!sub) return;
      const text = sub.narration ?? sub.detail;

      setCutawayMode('permukaan');
      setCutaway(0.72);
      setSelectedLayerId('atmosfer');
      setTappedLayerId('atmosfer');
      setActiveAtmosSubId(subId);
      setAstroSubtitle(`${sub.name} (${sub.range})`);
      setAstroMessage(text);
      setAstroBubbleOpen(true);
      setDockCollapsed(false);
      viewportRef.current?.focusAtmosSubLayer(subId);

      if (autoVoiceoverRef.current) {
        const played = playVoiceoverTrack(subId);
        if (!played) {
          speakIndonesianText(text);
        }
      }
    },
    [cancelActiveTour, playVoiceoverTrack, speakIndonesianText, stopVoiceover],
  );

  const handleSelectLayerFrom3D = useCallback(
    (layerId: LayerId) => {
      cancelActiveTour();
      setSelectedLayerId(layerId);
      setTappedLayerId(layerId);
      setActiveAtmosSubId(null);
      setAstroSubtitle(LAYER_MAP[layerId].name);
      setAstroMessage(LAYER_MAP[layerId].narrationScript);
      setAstroBubbleOpen(true);
      setDockCollapsed(false);
      if (autoVoiceoverRef.current) {
        const played = playVoiceoverTrack(layerId);
        if (!played) {
          speakIndonesianText(LAYER_MAP[layerId].narrationScript);
        }
      }
      // On wide desktop/PID screens, immediately open the right-side explanation panel on layer click
      if (window.innerWidth >= 1024) {
        setActiveTab('materi');
        setDrawerOpen(true);
      }
    },
    [cancelActiveTour, playVoiceoverTrack, speakIndonesianText],
  );

  const handleFocusLayerFromUI = useCallback(
    (layerId: LayerId) => {
      cancelActiveTour();
      const info = LAYER_MAP[layerId];
      setSelectedLayerId(layerId);
      setTappedLayerId(layerId);
      setActiveAtmosSubId(null);
      setAstroSubtitle(info.name);
      setAstroMessage(info.narrationScript);
      setAstroBubbleOpen(true);

      if (info.category === 'komponen-bumi') {
        setCutawayMode('permukaan');
        setCutaway(layerId === 'atmosfer' ? 0.68 : 0.2);
      } else if (cutawayMode === 'permukaan') {
        setCutawayMode('teleskop');
        setCutaway(info.camera.recommendedCutaway);
      } else {
        setCutaway(info.camera.recommendedCutaway);
      }

      viewportRef.current?.focusLayer(layerId, true);
      if (autoVoiceoverRef.current) {
        const played = playVoiceoverTrack(layerId);
        if (!played) {
          speakIndonesianText(info.narrationScript);
        }
      }
    },
    [cancelActiveTour, cutawayMode, playVoiceoverTrack, speakIndonesianText],
  );

  const handleTourStageChange = useCallback((stage: TourStage, progress: number) => {
    setTourStage(stage);
    setCutaway(progress);
  }, []);

  const handleStartInternalTour = useCallback(() => {
    setCutawayMode('teleskop');
    setActiveAtmosSubId(null);
    setShowLabels(true);
    setDrawerOpen(false);
    setAstroBubbleOpen(true);
    runTourChapter(0, 'internal');
  }, [runTourChapter]);

  const handleStartSurfaceTour = useCallback(() => {
    setCutawayMode('permukaan');
    setActiveAtmosSubId(null);
    setShowLabels(true);
    setDrawerOpen(false);
    setAstroBubbleOpen(true);
    runTourChapter(0, 'surface');
  }, [runTourChapter]);

  const handleStartAtmosTour = useCallback(() => {
    setCutawayMode('permukaan');
    setActiveAtmosSubId(null);
    setShowLabels(true);
    setDrawerOpen(false);
    setAstroBubbleOpen(true);
    runTourChapter(0, 'atmosfer');
  }, [runTourChapter]);

  const handleNextTourChapter = useCallback(() => {
    if (tourChapterIdxRef.current >= 0) {
      runTourChapter(tourChapterIdxRef.current + 1, activeTourKindRef.current);
    }
  }, [runTourChapter]);

  const handleStopTour = useCallback(() => {
    clearTourTimer();
    stopVoiceover();
    tourChapterIdxRef.current = -1;
    setTourChapterIndex(-1);
    setTourStage('idle');
    setActiveAtmosSubId(null);
    setAstroSubtitle(cutawayMode === 'permukaan' ? 'Komponen Permukaan Bumi' : null);
    setAstroMessage(cutawayMode === 'permukaan' ? SURFACE_BUMI_INTRO : ASTRO_BUMI_INTRO);
    viewportRef.current?.stopLayerTourAnimation();
  }, [clearTourTimer, cutawayMode, stopVoiceover]);

  const handleShowWholeEarth = useCallback(() => {
    cancelActiveTour();
    if (cutawayMode === 'permukaan') {
      setCutawayMode('teleskop');
      viewportRef.current?.setCutawayMode('teleskop');
    }
    setCutaway(0);
    setTappedLayerId(null);
    setActiveAtmosSubId(null);
    setAstroSubtitle(null);
    setAstroMessage(ASTRO_BUMI_WHOLE);
    viewportRef.current?.setActiveLayerHighlight(null);
    viewportRef.current?.setCutaway(0);
    stopVoiceover();
  }, [cancelActiveTour, cutawayMode, stopVoiceover]);

  const handleToggleCutawayOpenClose = useCallback(() => {
    cancelActiveTour();
    setCutaway((prev) => {
      const next = prev > 0.15 ? 0 : 0.72;
      viewportRef.current?.setCutaway(next);
      if (cutawayMode === 'permukaan') {
        setAstroSubtitle('Komponen Permukaan Bumi');
        setAstroMessage(
          next === 0
            ? SURFACE_BUMI_INTRO
            : 'Lapisan Atmosfer (Troposfer, Stratosfer, Mesosfer, Termosfer) diangkat terpisah agar mudah diamati! Klik langsung tiap komponennya.',
        );
      } else {
        setAstroSubtitle(null);
        setAstroMessage(
          next === 0
            ? ASTRO_BUMI_WHOLE
            : 'Potongan melintang Bumi terbuka! Klik langsung tiap lapisan untuk membaca dan mendengarkan penjelasannya.',
        );
      }
      return next;
    });
  }, [cancelActiveTour, cutawayMode]);

  const handleChangeCutaway = useCallback(
    (val: number) => {
      cancelActiveTour();
      setCutaway(val);
      viewportRef.current?.setCutaway(val);
    },
    [cancelActiveTour],
  );

  const handleChangeCutawayMode = useCallback(
    (mode: CutawayMode) => {
      cancelActiveTour();
      stopVoiceover();
      setCutawayMode(mode);
      setTappedLayerId(null);
      setActiveAtmosSubId(null);
      viewportRef.current?.setActiveLayerHighlight(null);
      viewportRef.current?.setCutawayMode(mode);
      if (mode === 'permukaan') {
        setCutaway(0.22);
        viewportRef.current?.setCutaway(0.22);
        setAstroSubtitle('Komponen Permukaan Bumi');
        setAstroMessage(SURFACE_BUMI_INTRO);
        setAstroBubbleOpen(true);
      } else {
        setAstroSubtitle(null);
        setAstroMessage(ASTRO_BUMI_INTRO);
        setCutaway((prev) => {
          const next = prev < 0.35 ? 0.68 : prev;
          viewportRef.current?.setCutaway(next);
          return next;
        });
      }
    },
    [cancelActiveTour, stopVoiceover],
  );

  const handleToggleAutoRotate = useCallback(() => {
    setAutoRotate((prev) => {
      const next = !prev;
      viewportRef.current?.setAutoRotate(next);
      return next;
    });
  }, []);

  const handleToggleShadows = useCallback(() => {
    setShadowsEnabled((prev) => {
      const next = !prev;
      viewportRef.current?.setShadowsEnabled(next);
      return next;
    });
  }, []);

  const handleToggleEcoMode = useCallback(() => {
    setEcoMode((prev) => {
      const next = !prev;
      viewportRef.current?.setEcoMode(next);
      return next;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    viewportRef.current?.zoomBy(-1.1);
  }, []);

  const handleZoomOut = useCallback(() => {
    viewportRef.current?.zoomBy(1.1);
  }, []);

  const handleResetView = useCallback(() => {
    clearTourTimer();
    tourChapterIdxRef.current = -1;
    setTourChapterIndex(-1);
    setCutaway(cutawayMode === 'permukaan' ? 0.22 : 0.68);
    setTappedLayerId(null);
    setActiveAtmosSubId(null);
    setTourStage('idle');
    setAstroSubtitle(cutawayMode === 'permukaan' ? 'Komponen Permukaan Bumi' : null);
    setAstroMessage(cutawayMode === 'permukaan' ? SURFACE_BUMI_INTRO : ASTRO_BUMI_INTRO);
    stopVoiceover();
    viewportRef.current?.resetView();
  }, [clearTourTimer, cutawayMode, stopVoiceover]);

  const handleOpenDrawer = useCallback((tab: DrawerTab) => {
    setActiveTab(tab);
    setDrawerOpen(true);
    setDrawerExpanded(false);
  }, []);

  const handleOpenNarrationForLayer = useCallback(
    (layerId: LayerId) => {
      cancelActiveTour();
      stopVoiceover();
      setNarrationTrack(layerId);
      setActiveTab('narasi');
      setDrawerOpen(true);
    },
    [cancelActiveTour, stopVoiceover],
  );

  const handleUploadVoiceover = useCallback((track: NarrationTrackKey, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setVoiceovers((prev) => {
      revokeIfBlob(prev[track]);
      return {
        ...prev,
        [track]: {
          url: objectUrl,
          fileName: file.name,
          fileSizeBytes: file.size,
          isBuiltIn: false,
        },
      };
    });
  }, []);

  const handleRemoveVoiceover = useCallback(
    (track: NarrationTrackKey) => {
      if (playingTrack === track) stopVoiceover();
      setVoiceovers((prev) => {
        revokeIfBlob(prev[track]);
        const next = { ...prev };
        delete next[track];
        return next;
      });
    },
    [playingTrack, stopVoiceover],
  );

  const handleRestoreDefaultVoiceover = useCallback((track: NarrationTrackKey) => {
    const def = DEFAULT_VOICEOVERS[track];
    if (!def) return;
    setVoiceovers((prev) => {
      revokeIfBlob(prev[track]);
      return { ...prev, [track]: def };
    });
  }, []);

  const handleToggleAutoVoiceover = useCallback(() => {
    setAutoVoiceover((prev) => {
      const next = !prev;
      if (!next) {
        stopVoiceover();
        // If tour is currently running, switch active chapter to timed auto-advance
        const idx = tourChapterIdxRef.current;
        if (idx >= 0) {
          clearTourTimer();
          tourTimerRef.current = window.setTimeout(() => {
            if (tourChapterIdxRef.current === idx) {
              runTourChapter(idx + 1);
            }
          }, 5500);
        }
      }
      return next;
    });
  }, [clearTourTimer, runTourChapter, stopVoiceover]);

  const handleAnswerQuiz = useCallback((questionId: number, optionIndex: number) => {
    setQuizAnswers((prev) => {
      if (prev[questionId] !== undefined) return prev;
      return { ...prev, [questionId]: optionIndex };
    });
  }, []);

  const handleResetQuiz = useCallback(() => {
    setQuizAnswers({});
  }, []);

  const activeChapters =
    activeTourKind === 'atmosfer'
      ? ATMOS_TOUR_CHAPTERS
      : activeTourKind === 'surface'
        ? SURFACE_TOUR_CHAPTERS
        : INTERNAL_TOUR_CHAPTERS;
  const isTourRunning = tourChapterIndex >= 0 && tourStage !== 'idle' && tourStage !== 'done';

  // Determine which voiceover track the Astro Bumi quick-play button should play
  const astroVoiceoverTrack: NarrationTrackKey | null = isTourRunning
    ? activeChapters[tourChapterIndex]?.track ?? null
    : activeAtmosSubId
      ? voiceovers[activeAtmosSubId]
        ? activeAtmosSubId
        : null
      : tappedLayerId && voiceovers[tappedLayerId]
        ? tappedLayerId
        : cutawayMode === 'permukaan'
          ? 'pembukaan-permukaan'
          : 'pembukaan';
  const astroHasVoiceover = Boolean(
    astroVoiceoverTrack && voiceovers[astroVoiceoverTrack],
  );
  const isAstroSpeaking =
    (astroVoiceoverTrack !== null && playingTrack === astroVoiceoverTrack) || ttsSpeaking;
  const canSpeakNarration =
    astroHasVoiceover || (typeof window !== 'undefined' && 'speechSynthesis' in window);

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#050914]">
      {/* Full-Bleed Isolated 3D WebGL Viewport (Earth + Surface Diorama + 3D Astro Bumi Character) */}
      <EarthViewport
        ref={viewportRef}
        cutawayMode={cutawayMode}
        initialCutaway={0.68}
        initialCutawayMode="teleskop"
        initialAutoRotate={true}
        initialShadows={!INITIAL_ECO_MODE}
        initialEcoMode={INITIAL_ECO_MODE}
        showLabels={showLabels}
        activeLayerId={tappedLayerId}
        activeAtmosSubId={activeAtmosSubId}
        onSelectLayer={handleSelectLayerFrom3D}
        onSelectAtmosSubLayer={handleSelectAtmosSubLayer}
        onTourStageChange={handleTourStageChange}
      />

      {/* Minimal Top-Left Brand Header (Never blocks 3D Earth center) */}
      <header className="fixed top-3 left-3 sm:top-4 sm:left-5 z-10 pointer-events-none max-w-[calc(100vw-104px)] sm:max-w-[calc(100vw-340px)]">
        <div className="inline-flex flex-col px-3.5 py-2 rounded-xl bg-[#0B1222]/90 border border-slate-800/90">
          <h1 className="font-display text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
            Berkenalan dengan Bumi Kita
            <span className="hidden sm:inline text-sky-400 font-semibold">
              {' '}
              — Menjelajahi Lapisan Bumi
            </span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Media Pembelajaran IPA Kelas 5 SD
          </p>
        </div>
      </header>

      {/* Astro Bumi Thought Bubble ("Balon Pikiran Astronot")
          - During guided animation (isTourRunning): docked cleanly as a slim cinema subtitle thought-bubble at the bottom edge (while ControlDock hides), keeping the entire 3D center 100% unobstructed!
          - During free exploration: tucked neatly in the top-right corner (hidden when drawer is open) so it never blocks the 3D Earth! */}
      {(!drawerOpen || isTourRunning) && (
        <div
          className={
            isTourRunning
              ? 'fixed bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-20px)] max-w-[740px]'
              : astroBubbleOpen
                ? 'fixed top-[68px] right-3 sm:top-4 sm:right-5 z-20'
                : 'fixed top-3 right-3 sm:top-4 sm:right-5 z-20'
          }
        >
          {astroBubbleOpen || isTourRunning ? (
            <div
              className={
                isTourRunning
                  ? 'relative flex items-end gap-2.5'
                  : 'relative max-w-[235px] sm:max-w-[295px]'
              }
            >
              {/* Desktop/PID thought-bubble tail circles on the left pointing toward 3D Astro Bumi during tour */}
              {isTourRunning && (
                <div
                  className="hidden sm:flex items-center gap-1.5 mb-3 shrink-0 pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0B1222]/95 border border-sky-400/60" />
                  <span className="w-3.5 h-3.5 rounded-full bg-[#0B1222]/95 border border-sky-400/60" />
                </div>
              )}

              {/* Thought Bubble Cloud Body */}
              <div
                className={`flex-1 rounded-2xl border border-sky-400/50 bg-[#0B1222]/95 shadow-2xl ${
                  isTourRunning ? 'px-3.5 py-2.5 sm:px-4 sm:py-3' : 'px-3.5 py-2.5'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-display font-bold text-sky-300 shrink-0">
                      Astro Bumi
                    </span>
                    {astroSubtitle && (
                      <span className="text-[11px] font-medium text-amber-300 truncate">
                        · {astroSubtitle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canSpeakNarration && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isAstroSpeaking) {
                            stopVoiceover();
                          } else if (astroHasVoiceover && astroVoiceoverTrack) {
                            playVoiceoverTrack(astroVoiceoverTrack);
                          } else {
                            speakIndonesianText(astroMessage);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          isAstroSpeaking
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'bg-sky-500/20 border border-sky-500/50 text-sky-200 hover:bg-sky-500/30'
                        }`}
                      >
                        {isAstroSpeaking ? (
                          <>
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>Hentikan Suara</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span className="hidden sm:inline">
                              {astroHasVoiceover &&
                              (astroVoiceoverTrack === 'pembukaan' ||
                                astroVoiceoverTrack === 'pembukaan-permukaan' ||
                                astroVoiceoverTrack === 'pembukaan-atmosfer')
                                ? 'Putar Pembukaan'
                                : astroHasVoiceover &&
                                    (astroVoiceoverTrack === 'troposfer' ||
                                      astroVoiceoverTrack === 'stratosfer' ||
                                      astroVoiceoverTrack === 'mesosfer' ||
                                      astroVoiceoverTrack === 'termosfer')
                                  ? `Putar ${ATMOSFER_SUB_MAP[astroVoiceoverTrack].name}`
                                  : astroHasVoiceover && astroVoiceoverTrack
                                    ? `Putar ${LAYER_MAP[astroVoiceoverTrack as LayerId].name}`
                                    : 'Bacakan'}
                            </span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleToggleAutoVoiceover}
                      title={
                        autoVoiceover
                          ? 'Suara voiceover otomatis aktif — klik untuk bisukan'
                          : 'Suara voiceover dibisukan — klik untuk aktifkan'
                      }
                      aria-pressed={autoVoiceover}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        autoVoiceover
                          ? 'text-sky-300 hover:bg-slate-800'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {autoVoiceover ? (
                        <Volume2 className="w-3.5 h-3.5" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isTourRunning ? (
                      <>
                        <button
                          type="button"
                          onClick={handleNextTourChapter}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-semibold hover:bg-sky-400 transition-colors cursor-pointer"
                        >
                          <span>
                            {tourChapterIndex < activeChapters.length - 1 ? 'Lanjut' : 'Selesai'}
                          </span>
                          <SkipForward className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={handleStopTour}
                          aria-label="Hentikan animasi penjelasan"
                          title="Hentikan Animasi"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <Square className="w-2.5 h-2.5 fill-current text-amber-400" />
                          <span className="hidden sm:inline">Stop</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAstroBubbleOpen(false)}
                        aria-label="Sembunyikan balon pikiran Astro Bumi"
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Narration Text synced with active voiceover */}
                <div
                  className={`mt-1.5 overflow-y-auto pr-1 earth-scroll ${
                    isTourRunning ? 'max-h-[76px] sm:max-h-[88px]' : 'max-h-[82px] sm:max-h-[115px]'
                  }`}
                >
                  <p className="text-xs sm:text-[13px] leading-relaxed text-slate-100">
                    {astroMessage}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAstroBubbleOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-500/40 bg-[#0B1222]/92 text-xs font-medium text-sky-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Balon Astro Bumi</span>
              <span className="sm:hidden">Astro</span>
            </button>
          )}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Auto-hides during active guided animation so bottom thought bubble sits cleanly without stacking) */}
      <div className={isTourRunning ? 'hidden' : drawerOpen ? 'hidden lg:block' : 'block'}>
        <ControlDock
          collapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((c) => !c)}
          cutaway={cutaway}
          onChangeCutaway={handleChangeCutaway}
          cutawayMode={cutawayMode}
          onChangeCutawayMode={handleChangeCutawayMode}
          tourRunning={isTourRunning}
          onStartInternalTour={handleStartInternalTour}
          onStartSurfaceTour={handleStartSurfaceTour}
          onStartAtmosTour={handleStartAtmosTour}
          onStopTour={handleStopTour}
          onShowWholeEarth={handleShowWholeEarth}
          onToggleCutawayOpenClose={handleToggleCutawayOpenClose}
          showLabels={showLabels}
          onToggleLabels={() => setShowLabels((v) => !v)}
          autoRotate={autoRotate}
          onToggleAutoRotate={handleToggleAutoRotate}
          shadowsEnabled={shadowsEnabled}
          onToggleShadows={handleToggleShadows}
          ecoMode={ecoMode}
          onToggleEcoMode={handleToggleEcoMode}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onOpenDrawer={handleOpenDrawer}
          activeDrawerTab={drawerOpen ? activeTab : null}
          tappedLayerId={tappedLayerId}
          onDismissTappedLayer={() => {
            cancelActiveTour();
            setTappedLayerId(null);
            setActiveAtmosSubId(null);
            setAstroSubtitle(null);
            viewportRef.current?.setActiveLayerHighlight(null);
            stopVoiceover();
          }}
          quizAnsweredCount={Object.keys(quizAnswers).length}
          uploadedVoiceoverCount={Object.keys(voiceovers).length}
        />
      </div>

      {/* Responsive Learning Panel (Right Side Panel on Laptop/PID, Expandable Bottom Sheet on Mobile) */}
      <LearningDrawer
        open={drawerOpen}
        expanded={drawerExpanded}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onToggleExpand={() => setDrawerExpanded((e) => !e)}
        onClose={() => setDrawerOpen(false)}
        selectedLayerId={selectedLayerId}
        activeAtmosSubId={activeAtmosSubId}
        onSelectLayer={handleFocusLayerFromUI}
        onSelectAtmosSubLayer={handleSelectAtmosSubLayer}
        onStartAtmosTour={handleStartAtmosTour}
        onOpenNarrationForLayer={handleOpenNarrationForLayer}
        narrationTrack={narrationTrack}
        onChangeNarrationTrack={setNarrationTrack}
        voiceovers={voiceovers}
        playingTrack={playingTrack}
        onPlayVoiceoverTrack={(track) => playVoiceoverTrack(track)}
        onStopVoiceover={stopVoiceover}
        hasDefaultVoiceover={(track) => Boolean(DEFAULT_VOICEOVERS[track])}
        onUploadVoiceover={handleUploadVoiceover}
        onRemoveVoiceover={handleRemoveVoiceover}
        onRestoreDefaultVoiceover={handleRestoreDefaultVoiceover}
        quizAnswers={quizAnswers}
        onAnswerQuiz={handleAnswerQuiz}
        onResetQuiz={handleResetQuiz}
      />
    </main>
  );
}
