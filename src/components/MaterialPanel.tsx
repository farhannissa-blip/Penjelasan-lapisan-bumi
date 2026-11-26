import { useState } from 'react';
import { Volume2, Square, Eye, Sparkles, Mic, Play } from 'lucide-react';
import {
  EARTH_LAYERS,
  LAYER_MAP,
  type AtmosSubLayerId,
  type LayerCategory,
  type LayerId,
} from '../data/earthContent';

interface MaterialPanelProps {
  selectedLayerId: LayerId;
  activeAtmosSubId?: AtmosSubLayerId | null;
  onSelectLayer: (layerId: LayerId) => void;
  onSelectAtmosSubLayer?: (subId: AtmosSubLayerId) => void;
  onStartAtmosTour?: () => void;
  onOpenNarrationForLayer: (layerId: LayerId) => void;
  onPlayVoiceoverTrack: (trackKey: LayerId) => void;
  onStopVoiceover: () => void;
  playingTrack: string | null;
  hasCustomVoiceover: (trackKey: string) => boolean;
}

export function MaterialPanel({
  selectedLayerId,
  activeAtmosSubId = null,
  onSelectLayer,
  onSelectAtmosSubLayer,
  onStartAtmosTour,
  onOpenNarrationForLayer,
  onPlayVoiceoverTrack,
  onStopVoiceover,
  playingTrack,
  hasCustomVoiceover,
}: MaterialPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<'semua' | LayerCategory>('semua');

  const activeLayer = LAYER_MAP[selectedLayerId];
  const filteredLayers =
    categoryFilter === 'semua'
      ? EARTH_LAYERS
      : EARTH_LAYERS.filter((l) => l.category === categoryFilter);
  const hasVo = hasCustomVoiceover(activeLayer.id);
  const isPlayingThis = playingTrack === activeLayer.id;

  return (
    <div className="space-y-4">
      {/* Category segmented filter + layer selector strip */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800 self-start"
          role="tablist"
          aria-label="Filter kategori materi"
        >
          {(
            [
              { key: 'semua', label: 'Semua (8)' },
              { key: 'lapisan-dalam', label: 'Lapisan Dalam (4)' },
              { key: 'komponen-bumi', label: 'Komponen Bumi (4)' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={categoryFilter === item.key}
              onClick={() => setCategoryFilter(item.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === item.key
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-400">
          Sentuh bagian pada globe 3D atau pilih daftar di bawah
        </p>
      </div>

      {/* Horizontal scrollable layer selector buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 earth-scroll">
        {filteredLayers.map((layer) => {
          const isActive = layer.id === selectedLayerId;
          const layerHasVo = hasCustomVoiceover(layer.id);
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onSelectLayer(layer.id)}
              className={`flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-800 border-sky-400 text-white'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: layer.accentHex }}
                aria-hidden="true"
              />
              <span>{layer.name}</span>
              {layerHasVo && (
                <Volume2 className="w-3 h-3 text-sky-400 shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active layer detail content */}
      <div className="rounded-xl border border-slate-800 bg-[#0E172A] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{activeLayer.categoryLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{activeLayer.englishName}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              {activeLayer.name}
            </h2>
            <p className="text-sm text-sky-300">{activeLayer.shortTagline}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeLayer.id === 'atmosfer' && onStartAtmosTour && (
              <button
                type="button"
                onClick={onStartAtmosTour}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:bg-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Animasi Atmosfer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectLayer(activeLayer.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {activeLayer.category === 'komponen-bumi'
                  ? 'Lihat 3D Permukaan'
                  : 'Fokus 3D'}
              </span>
            </button>

            {hasVo ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    isPlayingThis ? onStopVoiceover() : onPlayVoiceoverTrack(activeLayer.id)
                  }
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isPlayingThis
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  }`}
                >
                  {isPlayingThis ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Hentikan Suara</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Putar Voiceover</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenNarrationForLayer(activeLayer.id)}
                  title="Buka naskah & pengaturan voiceover"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-sky-400" />
                  <span>Naskah</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOpenNarrationForLayer(activeLayer.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Narasi Audio</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean unboxed tabular scientific metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/90">
          <div>
            <p className="text-[11px] text-slate-400">Ketebalan / Jangkauan</p>
            <p className="mt-0.5 text-sm font-semibold text-white font-mono-tabular">
              {activeLayer.thickness}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Suhu Rata-rata</p>
            <p className="mt-0.5 text-sm font-semibold text-amber-300 font-mono-tabular">
              {activeLayer.temperature}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Wujud & Penyusun</p>
            <p className="mt-0.5 text-sm font-medium text-slate-100">
              {activeLayer.stateAndMaterial}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Fungsi Utama</p>
            <p className="mt-0.5 text-sm font-medium text-slate-100">
              {activeLayer.keyFunction}
            </p>
          </div>
        </div>

        {/* Grade 5 SD Explanation */}
        <div className="space-y-3 pt-3 border-t border-slate-800/90">
          <p className="text-sm leading-relaxed text-slate-200">{activeLayer.summary}</p>
          <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">
            {activeLayer.bulletPoints.map((point, idx) => (
              <li key={idx} className="leading-relaxed">
                {point}
              </li>
            ))}
          </ul>

          {/* Sub-layers breakdown for Komponen Permukaan Bumi (e.g. Troposfer-Termosfer, Siklus Air, dll.) */}
          {activeLayer.subLayers && activeLayer.subLayers.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-sky-300">
                  Bagian & Lapisan Penyusun {activeLayer.name}
                </p>
                {activeLayer.id === 'atmosfer' && onSelectAtmosSubLayer && (
                  <span className="text-[11px] text-slate-400">
                    Klik untuk sorot di 3D
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeLayer.subLayers.map((sub, idx) => {
                  const atmosId = sub.id;
                  const isInteractive = Boolean(atmosId && onSelectAtmosSubLayer);
                  const isSubActive = Boolean(atmosId && activeAtmosSubId === atmosId);
                  if (isInteractive && atmosId && onSelectAtmosSubLayer) {
                    return (
                      <button
                        key={atmosId}
                        type="button"
                        onClick={() => onSelectAtmosSubLayer(atmosId)}
                        className={`text-left rounded-lg border p-2.5 space-y-1 transition-colors cursor-pointer ${
                          isSubActive
                            ? 'bg-sky-950/55 border-sky-400'
                            : 'border-slate-800 bg-slate-900/75 hover:border-sky-500/60 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ backgroundColor: sub.accentHex }}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-semibold text-white truncate">
                              {sub.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">
                            {sub.range}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs leading-relaxed text-slate-300">
                          {sub.detail}
                        </p>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: sub.accentHex }}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-semibold text-white truncate">
                            {sub.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">
                          {sub.range}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs leading-relaxed text-slate-300">
                        {sub.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fun Fact box (clean hairline border, zero border-l-4) */}
        <div className="rounded-lg border border-sky-500/25 bg-sky-950/30 p-3.5 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            <span className="font-semibold text-sky-300">Tahukah Kamu? </span>
            {activeLayer.funFact}
          </div>
        </div>
      </div>
    </div>
  );
}
