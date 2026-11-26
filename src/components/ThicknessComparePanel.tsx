import { useEffect, useState } from 'react';
import { Eye, Info, Ruler } from 'lucide-react';
import { MAIN_INTERNAL_LAYERS, type LayerId } from '../data/earthContent';

interface ThicknessComparePanelProps {
  selectedLayerId: LayerId;
  onSelectLayer: (layerId: LayerId) => void;
}

export function ThicknessComparePanel({
  selectedLayerId,
  onSelectLayer,
}: ThicknessComparePanelProps) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const totalRadiusKm = 6371;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-sky-400 font-medium">
          <Ruler className="w-3.5 h-3.5" />
          <span>Perbandingan Skala Nyata (Jari-jari Bumi ± 6.371 km)</span>
        </div>
        <h2 className="font-display text-lg sm:text-xl font-bold text-white">
          Seberapa Tebal Tiap Lapisan Bumi?
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Kerak Bumi tempat kita tinggal ternyata jauh lebih tipis dibandingkan Mantel dan Inti Bumi. Klik setiap lapisan di bawah untuk melihatnya pada model 3D.
        </p>
      </div>

      {/* Stacked Proportional Strip (Full Radius 0% -> 100%) */}
      <div className="rounded-xl border border-slate-800 bg-[#0E172A] p-4 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
          <span>Permukaan (0 km)</span>
          <span>Pusat Bumi (6.371 km)</span>
        </div>

        <div className="w-full h-9 rounded-lg overflow-hidden flex border border-slate-700/80 bg-slate-950">
          {MAIN_INTERNAL_LAYERS.map((layer) => {
            // Give Crust a minimum 3% visual sliver so it remains clickable while clearly looking ultra-thin
            const visualPct =
              layer.id === 'kerak' ? 3 : layer.percentOfRadius * 0.98;
            const isSelected = selectedLayerId === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => onSelectLayer(layer.id)}
                title={`${layer.name}: ${layer.thickness}`}
                style={{
                  width: animateIn ? `${visualPct}%` : '0%',
                  backgroundColor: layer.accentHex,
                  transition: 'width 650ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className={`h-full relative flex items-center justify-center overflow-hidden cursor-pointer border-r border-slate-950/60 last:border-r-0 ${
                  isSelected ? 'ring-2 ring-inset ring-white' : 'hover:brightness-110'
                }`}
              >
                {layer.percentOfRadius >= 18 && (
                  <span className="text-[11px] font-bold text-slate-950 truncate px-1">
                    {layer.name.replace(' Bumi', '')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Ordered Comparison Bars */}
        <div className="space-y-3 pt-2">
          {MAIN_INTERNAL_LAYERS.map((layer, idx) => {
            const isSelected = selectedLayerId === layer.id;
            const barWidthPct = Math.max(
              2.5,
              Math.round((layer.thicknessKmApprox / totalRadiusKm) * 100 * 2.05),
            );
            const labelNote =
              layer.id === 'kerak'
                ? 'Paling tipis (ibarat kulit apel)'
                : layer.id === 'mantel'
                  ? 'Lapisan paling tebal'
                  : layer.id === 'inti-luar'
                    ? 'Logam besi & nikel cair'
                    : 'Bola logam padat pusat Bumi';

            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => onSelectLayer(layer.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-sky-400 bg-slate-800/80'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: layer.accentHex }}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-white truncate">
                      {idx + 1}. {layer.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono-tabular font-semibold text-sky-300">
                      {layer.thickness}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>

                {/* Animated proportional horizontal bar */}
                <div className="mt-2 h-2.5 w-full rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: animateIn ? `${Math.min(100, barWidthPct)}%` : '0%',
                      backgroundColor: layer.accentHex,
                      transition: `width ${550 + idx * 120}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                    }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{labelNote}</span>
                  <span className="font-mono-tabular">
                    ± {layer.percentOfRadius}% jari-jari
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explicit Educational Scale Disclaimer */}
      <div className="rounded-lg border border-sky-500/25 bg-sky-950/30 p-3.5 flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <span className="font-semibold text-sky-300">Catatan Skala Model 3D: </span>
          Ketebalan visual pada model 3D tidak sepenuhnya sesuai skala nyata—Kerak Bumi dibuat sedikit lebih tebal agar mudah diamati dan disentuh oleh siswa.
        </p>
      </div>
    </div>
  );
}
