import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Volume2 } from 'lucide-react';
import {
  ATMOSFER_SUB_LAYERS,
  type AtmosSubLayerId,
  type LayerId,
} from '../data/earthContent';
import {
  EarthSceneController,
  type CutawayMode,
  type ProjectedAtmosLabelPoint,
  type ProjectedLabelPoint,
  type TourStage,
} from '../three/earthScene';

export interface EarthViewportHandle {
  focusLayer: (layerId: LayerId, applyRecommendedCutaway?: boolean) => void;
  focusAtmosSubLayer: (subId: AtmosSubLayerId) => void;
  setActiveLayerHighlight: (layerId: LayerId | null) => void;
  setActiveAtmosSubLayer: (subId: AtmosSubLayerId | null) => void;
  setCutaway: (amount: number) => void;
  setCutawayMode: (mode: CutawayMode) => void;
  setAutoRotate: (enabled: boolean) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  setEcoMode: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  setAstroVisible: (visible: boolean) => void;
  setTourStage: (stage: TourStage) => void;
  playLayerTourAnimation: () => void;
  stopLayerTourAnimation: () => void;
  zoomBy: (deltaDistance: number) => void;
  resetView: () => void;
}

interface EarthViewportProps {
  cutawayMode: CutawayMode;
  initialCutaway: number;
  initialCutawayMode: CutawayMode;
  initialAutoRotate: boolean;
  initialShadows: boolean;
  initialEcoMode: boolean;
  showLabels: boolean;
  activeLayerId: LayerId | null;
  activeAtmosSubId: AtmosSubLayerId | null;
  onSelectLayer: (layerId: LayerId) => void;
  onSelectAtmosSubLayer: (subId: AtmosSubLayerId) => void;
  onTourStageChange: (stage: TourStage, cutawayProgress: number) => void;
}

const INTERNAL_LABEL_SLOTS: Array<{ id: LayerId; text: string }> = [
  { id: 'kerak', text: 'Kerak Bumi' },
  { id: 'mantel', text: 'Mantel Bumi' },
  { id: 'inti-luar', text: 'Inti Luar' },
  { id: 'inti-dalam', text: 'Inti Dalam' },
];

const SURFACE_LABEL_SLOTS: Array<{ id: LayerId; text: string }> = [
  { id: 'litosfer', text: 'Litosfer' },
  { id: 'hidrosfer', text: 'Hidrosfer' },
  { id: 'biosfer', text: 'Biosfer' },
  { id: 'atmosfer', text: 'Atmosfer' },
];

export const EarthViewport = forwardRef<EarthViewportHandle, EarthViewportProps>(
  function EarthViewport(
    {
      cutawayMode,
      initialCutaway,
      initialCutawayMode,
      initialAutoRotate,
      initialShadows,
      initialEcoMode,
      showLabels,
      activeLayerId,
      activeAtmosSubId,
      onSelectLayer,
      onSelectAtmosSubLayer,
      onTourStageChange,
    },
    ref,
  ) {
    const labelSlots =
      cutawayMode === 'permukaan' ? SURFACE_LABEL_SLOTS : INTERNAL_LABEL_SLOTS;
    const mountRef = useRef<HTMLDivElement | null>(null);
    const controllerRef = useRef<EarthSceneController | null>(null);
    const labelRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const atmosLabelRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const lastLabelStateRef = useRef<Array<{ x: number; y: number; visible: boolean }>>(
      INTERNAL_LABEL_SLOTS.map(() => ({ x: -9999, y: -9999, visible: false })),
    );
    const lastAtmosLabelStateRef = useRef<Array<{ x: number; y: number; visible: boolean }>>(
      ATMOSFER_SUB_LAYERS.map(() => ({ x: -9999, y: -9999, visible: false })),
    );
    const showLabelsRef = useRef(showLabels);
    const onSelectRef = useRef(onSelectLayer);
    const onSelectAtmosRef = useRef(onSelectAtmosSubLayer);
    const onTourRef = useRef(onTourStageChange);
    const [contextLost, setContextLost] = useState(false);

    showLabelsRef.current = showLabels;
    onSelectRef.current = onSelectLayer;
    onSelectAtmosRef.current = onSelectAtmosSubLayer;
    onTourRef.current = onTourStageChange;

    // Reset cached DOM label coordinates whenever switching between Internal Earth and Surface Diorama
    useEffect(() => {
      const cache = lastLabelStateRef.current;
      for (let i = 0; i < cache.length; i++) {
        cache[i].x = -9999;
        cache[i].y = -9999;
        cache[i].visible = false;
        const el = labelRefs.current[i];
        if (el) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
      }
      const atmosCache = lastAtmosLabelStateRef.current;
      for (let i = 0; i < atmosCache.length; i++) {
        atmosCache[i].x = -9999;
        atmosCache[i].y = -9999;
        atmosCache[i].visible = false;
        const el = atmosLabelRefs.current[i];
        if (el) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
      }
    }, [cutawayMode]);

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const handleProjectLabels = (points: ProjectedLabelPoint[]) => {
        const allow = showLabelsRef.current;
        const cache = lastLabelStateRef.current;
        for (let i = 0; i < points.length; i++) {
          const el = labelRefs.current[i];
          if (!el) continue;
          const p = points[i];
          const prev = cache[i];
          const nextVisible = allow && p.visible;

          if (!nextVisible) {
            if (prev.visible) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              prev.visible = false;
            }
          } else {
            const rx = Math.round(p.x);
            const ry = Math.round(p.y);
            if (rx !== prev.x || ry !== prev.y) {
              el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
              prev.x = rx;
              prev.y = ry;
            }
            if (!prev.visible) {
              el.style.opacity = '1';
              el.style.pointerEvents = 'auto';
              prev.visible = true;
            }
          }
        }
      };

      const handleProjectAtmosLabels = (points: ProjectedAtmosLabelPoint[]) => {
        const allow = showLabelsRef.current;
        const cache = lastAtmosLabelStateRef.current;
        const maxWidth = container.clientWidth;
        for (let i = 0; i < points.length; i++) {
          const el = atmosLabelRefs.current[i];
          if (!el) continue;
          const p = points[i];
          const prev = cache[i];
          const nextVisible = allow && p.visible;

          if (!nextVisible) {
            if (prev.visible) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
              prev.visible = false;
            }
          } else {
            const labelW = el.offsetWidth || 185;
            const safeMaxX = Math.max(12, maxWidth - labelW - 12);
            const rx = Math.min(Math.round(p.x), safeMaxX);
            const ry = Math.round(p.y);
            if (rx !== prev.x || ry !== prev.y) {
              el.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
              prev.x = rx;
              prev.y = ry;
            }
            if (!prev.visible) {
              el.style.opacity = '1';
              el.style.pointerEvents = 'auto';
              prev.visible = true;
            }
          }
        }
      };

      const controller = new EarthSceneController(
        container,
        {
          initialCutaway,
          initialCutawayMode,
          initialAutoRotate,
          initialShadows,
          initialEcoMode,
        },
        {
          onSelectLayer: (layerId) => onSelectRef.current(layerId),
          onSelectAtmosSubLayer: (subId) => onSelectAtmosRef.current(subId),
          onProjectLabels: handleProjectLabels,
          onProjectAtmosLabels: handleProjectAtmosLabels,
          onTourStageChange: (stage, progress) => onTourRef.current(stage, progress),
          onWebGLContextLost: () => setContextLost(true),
          onWebGLContextRestored: () => setContextLost(false),
        },
      );

      controllerRef.current = controller;

      return () => {
        controller.dispose();
        controllerRef.current = null;
      };
      // Mount WebGL scene strictly once so UI state updates never recreate canvas
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focusLayer: (layerId, applyRecommendedCutaway = true) => {
          controllerRef.current?.focusLayer(layerId, applyRecommendedCutaway);
        },
        focusAtmosSubLayer: (subId) => {
          controllerRef.current?.focusAtmosSubLayer(subId);
        },
        setActiveLayerHighlight: (layerId) => {
          controllerRef.current?.setActiveLayerHighlight(layerId);
        },
        setActiveAtmosSubLayer: (subId) => {
          controllerRef.current?.setActiveAtmosSubLayer(subId);
        },
        setCutaway: (amount) => {
          controllerRef.current?.setCutaway(amount);
        },
        setCutawayMode: (mode) => {
          controllerRef.current?.setCutawayMode(mode);
        },
        setAutoRotate: (enabled) => {
          controllerRef.current?.setAutoRotate(enabled);
        },
        setShadowsEnabled: (enabled) => {
          controllerRef.current?.setShadowsEnabled(enabled);
        },
        setEcoMode: (enabled) => {
          controllerRef.current?.setEcoMode(enabled);
        },
        setPaused: (paused) => {
          controllerRef.current?.setPaused(paused);
        },
        setAstroVisible: (visible) => {
          controllerRef.current?.setAstroVisible(visible);
        },
        setTourStage: (stage) => {
          controllerRef.current?.setTourStage(stage);
        },
        playLayerTourAnimation: () => {
          controllerRef.current?.playLayerTourAnimation();
        },
        stopLayerTourAnimation: () => {
          controllerRef.current?.stopLayerTourAnimation();
        },
        zoomBy: (deltaDistance) => {
          controllerRef.current?.zoomBy(deltaDistance);
        },
        resetView: () => {
          controllerRef.current?.resetView();
        },
      }),
      [],
    );

    return (
      <div className="fixed inset-0 w-full h-full bg-[#050914]">
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Scene 3D interaktif lapisan dan komponen Bumi"
        />

        {/* Projected 3D Leader-Line Labels (zero-rerender DOM transforms) */}
        <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
          {labelSlots.map((slot, idx) => {
            const isSelected = activeLayerId === slot.id && !activeAtmosSubId;
            const hasOtherFocus = Boolean(activeLayerId || activeAtmosSubId) && !isSelected;
            return (
              <button
                key={slot.id}
                ref={(el) => {
                  labelRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => onSelectLayer(slot.id)}
                style={{ opacity: 0, willChange: 'transform, opacity' }}
                className={`absolute top-0 left-0 -translate-y-1/2 flex items-center gap-1.5 group cursor-pointer transition-opacity duration-200 ${
                  isSelected ? 'z-20' : 'z-10'
                }`}
              >
                <span
                  className={`rounded-full shrink-0 transition-all ${
                    isSelected
                      ? 'w-3.5 h-3.5 bg-amber-300 border-2 border-white shadow-[0_0_14px_rgba(251,191,36,1)]'
                      : 'w-2.5 h-2.5 bg-white border border-slate-900'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`shrink-0 transition-all ${
                    isSelected
                      ? 'h-[2px] w-8 sm:w-11 bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.95)]'
                      : 'h-px w-5 sm:w-8 bg-white/80'
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md whitespace-nowrap border transition-all ${
                    isSelected
                      ? 'px-2.5 py-1 text-xs sm:text-sm font-bold bg-amber-400 text-slate-950 border-white ring-2 ring-amber-200/90 shadow-[0_0_24px_rgba(251,191,36,0.95)] scale-105'
                      : hasOtherFocus
                        ? 'px-2 py-0.5 text-[11px] sm:text-xs font-medium bg-[#060B18]/75 text-slate-300 border-white/15 opacity-70 group-hover:opacity-100 group-hover:border-sky-400'
                        : 'px-2 py-0.5 text-[11px] sm:text-xs font-medium bg-[#060B18]/88 text-white border-white/25 group-hover:border-sky-400'
                  }`}
                >
                  {isSelected && <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  <span>{slot.text}</span>
                </span>
              </button>
            );
          })}

          {/* Projected 3D Atmospheric Strata Explanations (Troposfer -> Termosfer) in Permukaan mode */}
          {cutawayMode === 'permukaan' &&
            ATMOSFER_SUB_LAYERS.map((sub, idx) => {
              const subId = sub.id as AtmosSubLayerId;
              const isSelected = activeAtmosSubId === subId;
              const isAllAtmosHighlighted = !activeAtmosSubId && activeLayerId === 'atmosfer';
              const isDimmed = Boolean(activeAtmosSubId) && !isSelected;
              const showHint = isSelected || isAllAtmosHighlighted;
              return (
                <button
                  key={subId}
                  ref={(el) => {
                    atmosLabelRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => onSelectAtmosSubLayer(subId)}
                  style={{ opacity: 0, willChange: 'transform, opacity' }}
                  className={`absolute top-0 left-0 -translate-y-1/2 flex items-center gap-1.5 group cursor-pointer transition-opacity duration-200 text-left ${
                    isSelected ? 'z-20' : 'z-10'
                  }`}
                >
                  <span
                    className={`rounded-full shrink-0 transition-all ${
                      isSelected
                        ? 'w-3.5 h-3.5 border-2 border-white'
                        : 'w-2.5 h-2.5 border border-slate-950'
                    }`}
                    style={{
                      backgroundColor: isSelected ? '#fef08a' : sub.accentHex,
                      boxShadow: isSelected ? `0 0 14px ${sub.accentHex}` : undefined,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className={`shrink-0 transition-all ${
                      isSelected ? 'h-[2px] w-7 sm:w-10' : 'h-px w-4 sm:w-7'
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? sub.accentHex
                        : isAllAtmosHighlighted
                          ? sub.accentHex
                          : 'rgba(226, 232, 240, 0.72)',
                      boxShadow: isSelected ? `0 0 10px ${sub.accentHex}` : undefined,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className={`rounded-md border transition-all ${
                      isSelected
                        ? 'px-2.5 py-1.5 border-white ring-2 ring-white/90 scale-105'
                        : isAllAtmosHighlighted
                          ? 'px-2 py-1 bg-[#0B1730]/95 text-white border-sky-400/80 shadow-[0_0_16px_rgba(56,189,248,0.45)]'
                          : isDimmed
                            ? 'px-2 py-1 bg-[#060B18]/75 text-slate-300 border-white/15 opacity-60 group-hover:opacity-100 group-hover:border-sky-400'
                            : 'px-2 py-1 bg-[#060B18]/88 text-slate-100 border-white/25 group-hover:border-sky-400'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: sub.accentHex,
                            boxShadow: `0 0 26px ${sub.accentHex}`,
                          }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {isSelected && (
                        <Volume2
                          className="w-3.5 h-3.5 text-slate-950 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`leading-tight ${
                          isSelected
                            ? 'text-[11px] sm:text-xs font-extrabold text-slate-950'
                            : 'text-[10px] sm:text-[11px] font-semibold text-white'
                        }`}
                      >
                        {sub.name}
                      </span>
                      <span
                        className={`text-[9px] sm:text-[10px] font-mono-tabular ${
                          isSelected ? 'text-slate-900 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {sub.range}
                      </span>
                    </span>
                    {sub.short3dHint && (
                      <span
                        className={`block leading-tight mt-0.5 whitespace-nowrap ${
                          isSelected
                            ? 'text-[10px] sm:text-[11px] font-semibold text-slate-950'
                            : 'text-[9px] sm:text-[10px] text-slate-300'
                        } ${showHint ? 'block' : 'hidden sm:block'}`}
                      >
                        {sub.short3dHint}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
        </div>

        {contextLost && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#050914] px-6 text-center">
            <div className="max-w-sm rounded-xl border border-slate-700 bg-[#0B1222] p-6">
              <p className="font-display text-lg font-semibold text-white">
                Tampilan 3D sedang memulihkan grafis
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Muat ulang halaman jika tampilan 3D belum kembali secara otomatis.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
