import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cloud,
  Globe,
  HelpCircle,
  Layers,
  Mic,
  Minus,
  Mountain,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  Square,
  Sun,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { LAYER_MAP, type LayerId } from '../data/earthContent';
import type { CutawayMode } from '../three/earthScene';

export type DrawerTab = 'materi' | 'ketebalan' | 'narasi' | 'kuis';

interface ControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  cutaway: number;
  onChangeCutaway: (value: number) => void;
  cutawayMode: CutawayMode;
  onChangeCutawayMode: (mode: CutawayMode) => void;
  tourRunning: boolean;
  onStartInternalTour: () => void;
  onStartSurfaceTour: () => void;
  onStartAtmosTour: () => void;
  onStopTour: () => void;
  onShowWholeEarth: () => void;
  onToggleCutawayOpenClose: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  shadowsEnabled: boolean;
  onToggleShadows: () => void;
  ecoMode: boolean;
  onToggleEcoMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onOpenDrawer: (tab: DrawerTab) => void;
  activeDrawerTab: DrawerTab | null;
  tappedLayerId: LayerId | null;
  onDismissTappedLayer: () => void;
  quizAnsweredCount: number;
  uploadedVoiceoverCount: number;
}

export function ControlDock({
  collapsed,
  onToggleCollapse,
  cutaway,
  onChangeCutaway,
  cutawayMode,
  onChangeCutawayMode,
  tourRunning,
  onStartInternalTour,
  onStartSurfaceTour,
  onStartAtmosTour,
  onStopTour,
  onShowWholeEarth,
  onToggleCutawayOpenClose,
  showLabels,
  onToggleLabels,
  autoRotate,
  onToggleAutoRotate,
  shadowsEnabled,
  onToggleShadows,
  ecoMode,
  onToggleEcoMode,
  onZoomIn,
  onZoomOut,
  onResetView,
  onOpenDrawer,
  activeDrawerTab,
  tappedLayerId,
  onDismissTappedLayer,
  quizAnsweredCount,
  uploadedVoiceoverCount,
}: ControlDockProps) {
  const tappedLayer = tappedLayerId ? LAYER_MAP[tappedLayerId] : null;
  const cutawayPercent = Math.round(cutaway * 100);
  const isSurfaceMode = cutawayMode === 'permukaan';
  const isCutawayOpen = cutaway > 0.15;

  return (
    <div className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-16px)] max-w-[980px] flex flex-col items-center pointer-events-none">
      {/* Collapse / Expand Handle (Zen Mode toggle) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg border border-b-0 border-slate-700/80 bg-[#0B1222]/95 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
            <span>Tampilkan Kontrol & Menu Belajar</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sembunyikan Kontrol</span>
          </>
        )}
      </button>

      {/* Main Dock Container */}
      {!collapsed && (
        <div className="pointer-events-auto w-full rounded-xl border border-slate-700/80 bg-[#0B1222]/95 shadow-2xl overflow-hidden">
          {/* Compact 1-line tapped layer callout (shown when drawer is closed on mobile) */}
          {tappedLayer && !activeDrawerTab && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#111C33] border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: tappedLayer.accentHex }}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-white truncate">
                  {tappedLayer.name}
                </span>
                <span className="hidden sm:inline text-xs text-slate-400 truncate">
                  · {tappedLayer.shortTagline}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenDrawer('materi')}
                  className="px-2.5 py-1 rounded-md bg-sky-500 text-slate-950 text-[11px] font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Baca Penjelasan
                </button>
                <button
                  type="button"
                  onClick={onDismissTappedLayer}
                  aria-label="Tutup info lapisan"
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Row 1: Exploration Actions & Learning Tabs (horizontal scroll on very narrow phones) */}
          <div className="px-2 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto earth-scroll">
            {/* Primary Guided Tour Button: "Jelajahi Bagian Dalam Bumi" / "Putar Animasi Lapisan" */}
            {tourRunning ? (
              <button
                type="button"
                onClick={onStopTour}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Hentikan Animasi</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStartInternalTour}
                  title="Putar animasi penjelasan 4 lapisan dalam Bumi (Kerak hingga Inti Dalam)"
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Animasi Lapisan</span>
                </button>

                <button
                  type="button"
                  onClick={onStartSurfaceTour}
                  title="Putar animasi penjelasan 4 komponen permukaan Bumi (Litosfer, Hidrosfer, Biosfer, Atmosfer)"
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-emerald-400 text-slate-950 text-xs font-semibold hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Mountain className="w-3.5 h-3.5" />
                  <span>Animasi Permukaan</span>
                </button>

                <button
                  type="button"
                  onClick={onStartAtmosTour}
                  title="Putar animasi penjelasan 4 lapisan atmosfer (Troposfer hingga Termosfer)"
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Animasi Atmosfer</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                onChangeCutawayMode(isSurfaceMode ? 'teleskop' : 'permukaan')
              }
              title="Beralih ke Scene 3D Komponen Permukaan Bumi (Litosfer, Hidrosfer, Biosfer, Atmosfer)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSurfaceMode
                  ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
                  : 'bg-slate-900 border-slate-700/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Mountain className="w-3.5 h-3.5 text-emerald-400" />
              <span>Komponen Permukaan</span>
            </button>

            <button
              type="button"
              onClick={onShowWholeEarth}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !isSurfaceMode && !isCutawayOpen
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                  : 'bg-slate-900 border-slate-700/80 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>Bumi Utuh</span>
            </button>

            <button
              type="button"
              onClick={onToggleCutawayOpenClose}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border border-slate-700/80 bg-slate-900 text-slate-200 text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isSurfaceMode
                  ? isCutawayOpen
                    ? 'Rapatkan Lapisan'
                    : 'Pisahkan Lapisan'
                  : isCutawayOpen
                    ? 'Tutup Potongan'
                    : 'Buka Potongan'}
              </span>
            </button>

            <span className="h-5 w-px bg-slate-800 shrink-0 mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={() => onOpenDrawer('materi')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDrawerTab === 'materi'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Jelajahi Lapisan</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('ketebalan')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDrawerTab === 'ketebalan'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-700'
              }`}
            >
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span>Bandingkan Ketebalan</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('narasi')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDrawerTab === 'narasi'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span>Narasi & VO</span>
              {uploadedVoiceoverCount > 0 && (
                <span className="font-mono-tabular text-[11px] text-sky-300">
                  ({uploadedVoiceoverCount})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('kuis')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDrawerTab === 'kuis'
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-700'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kuis</span>
              <span className="font-mono-tabular text-[11px] text-slate-400">
                {quizAnsweredCount}/15
              </span>
            </button>
          </div>

          {/* Row 2: Cutaway Mode + Slider + Camera / Shadow / Auto-Rotate Controls */}
          <div className="px-2 pb-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            {/* Teleskop / Oktan / Permukaan switcher + Cutaway/Separation Slider */}
            <div className="flex items-center gap-2 flex-1 min-w-[225px] max-w-[440px]">
              <div
                className="inline-flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800 shrink-0"
                role="group"
                aria-label="Mode tampilan 3D Bumi"
              >
                <button
                  type="button"
                  onClick={() => onChangeCutawayMode('teleskop')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    cutawayMode === 'teleskop'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Teleskop
                </button>
                <button
                  type="button"
                  onClick={() => onChangeCutawayMode('oktan')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    cutawayMode === 'oktan'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Oktan 1/8
                </button>
                <button
                  type="button"
                  onClick={() => onChangeCutawayMode('permukaan')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    cutawayMode === 'permukaan'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Permukaan
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-1 min-w-[100px]">
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {isSurfaceMode ? 'Pisah' : 'Potongan'}
                </span>
                <input
                  id="cutaway-slider"
                  aria-label={
                    isSurfaceMode
                      ? 'Pisahkan lapisan atmosfer dan permukaan Bumi'
                      : 'Buka potongan lapisan Bumi'
                  }
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={cutaway}
                  onChange={(e) => onChangeCutaway(Number(e.target.value))}
                  className="flex-1 earth-slider"
                />
                <span className="w-8 text-right text-[11px] font-mono-tabular text-sky-300">
                  {cutawayPercent}%
                </span>
              </div>
            </div>

            {/* Scene Utility Controls */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={onToggleLabels}
                aria-pressed={showLabels}
                title="Tampilkan label 3D"
                className={`inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  showLabels
                    ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Label</span>
              </button>

              <button
                type="button"
                onClick={onToggleAutoRotate}
                aria-pressed={autoRotate}
                title="Rotasi otomatis"
                className={`inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  autoRotate
                    ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Rotasi</span>
              </button>

              <button
                type="button"
                onClick={onToggleShadows}
                aria-pressed={shadowsEnabled}
                title="Bayangan dinamis"
                className={`inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  shadowsEnabled
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Bayangan</span>
              </button>

              <button
                type="button"
                onClick={onToggleEcoMode}
                aria-pressed={ecoMode}
                title={
                  ecoMode
                    ? 'Mode Ringan aktif (optimal untuk HP & PID) — klik untuk Mode HD'
                    : 'Mode HD aktif — klik untuk Mode Ringan (hemat daya HP & PID)'
                }
                className={`inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  ecoMode
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{ecoMode ? 'Ringan' : 'HD'}</span>
              </button>

              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
                <button
                  type="button"
                  onClick={onZoomOut}
                  aria-label="Perkecil tampilan"
                  title="Zoom out"
                  className="w-8 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onZoomIn}
                  aria-label="Perbesar tampilan"
                  title="Zoom in"
                  className="w-8 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 border-l border-slate-800 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={onResetView}
                aria-label="Reset tampilan 3D"
                title="Reset Tampilan"
                className="inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
