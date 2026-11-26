import {
  BookOpen,
  HelpCircle,
  Maximize2,
  Mic,
  Minimize2,
  Ruler,
  X,
} from 'lucide-react';
import type { AtmosSubLayerId, LayerId } from '../data/earthContent';
import type { DrawerTab } from './ControlDock';
import { MaterialPanel } from './MaterialPanel';
import {
  NarrationPanel,
  type NarrationTrackKey,
  type UploadedVoiceover,
} from './NarrationPanel';
import { QuizPanel } from './QuizPanel';
import { ThicknessComparePanel } from './ThicknessComparePanel';

interface LearningDrawerProps {
  open: boolean;
  expanded: boolean;
  activeTab: DrawerTab;
  onChangeTab: (tab: DrawerTab) => void;
  onToggleExpand: () => void;
  onClose: () => void;
  // Material props
  selectedLayerId: LayerId;
  activeAtmosSubId: AtmosSubLayerId | null;
  onSelectLayer: (layerId: LayerId) => void;
  onSelectAtmosSubLayer: (subId: AtmosSubLayerId) => void;
  onStartAtmosTour: () => void;
  onOpenNarrationForLayer: (layerId: LayerId) => void;
  // Narration props
  narrationTrack: NarrationTrackKey;
  onChangeNarrationTrack: (track: NarrationTrackKey) => void;
  voiceovers: Record<string, UploadedVoiceover>;
  playingTrack: NarrationTrackKey | null;
  onPlayVoiceoverTrack: (track: NarrationTrackKey) => void;
  onStopVoiceover: () => void;
  hasDefaultVoiceover: (track: NarrationTrackKey) => boolean;
  onUploadVoiceover: (track: NarrationTrackKey, file: File) => void;
  onRemoveVoiceover: (track: NarrationTrackKey) => void;
  onRestoreDefaultVoiceover: (track: NarrationTrackKey) => void;
  // Quiz props
  quizAnswers: Record<number, number>;
  onAnswerQuiz: (questionId: number, optionIndex: number) => void;
  onResetQuiz: () => void;
}

export function LearningDrawer({
  open,
  expanded,
  activeTab,
  onChangeTab,
  onToggleExpand,
  onClose,
  selectedLayerId,
  activeAtmosSubId,
  onSelectLayer,
  onSelectAtmosSubLayer,
  onStartAtmosTour,
  onOpenNarrationForLayer,
  narrationTrack,
  onChangeNarrationTrack,
  voiceovers,
  playingTrack,
  onPlayVoiceoverTrack,
  onStopVoiceover,
  hasDefaultVoiceover,
  onUploadVoiceover,
  onRemoveVoiceover,
  onRestoreDefaultVoiceover,
  quizAnswers,
  onAnswerQuiz,
  onResetQuiz,
}: LearningDrawerProps) {
  if (!open) return null;

  const answeredCount = Object.keys(quizAnswers).length;

  return (
    <aside
      aria-label="Panel pembelajaran IPA Kelas 5 SD"
      className={`fixed z-30 flex flex-col border border-slate-700/80 bg-[#0B1222]/95 shadow-2xl transition-[height,width] duration-150
        bottom-0 left-0 right-0 rounded-t-2xl border-b-0 ${expanded ? 'h-[80dvh]' : 'h-[48dvh]'}
        lg:bottom-32 lg:top-4 lg:left-auto lg:right-4 lg:h-auto lg:rounded-2xl lg:border-b ${
          expanded ? 'lg:w-[540px]' : 'lg:w-[410px] xl:w-[435px]'
        }`}
    >
      {/* Header: Segmented Navigation + Expand/Close */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800 shrink-0">
        <div
          className="flex items-center gap-1 overflow-x-auto earth-scroll"
          role="tablist"
          aria-label="Tab panel pembelajaran"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'materi'}
            onClick={() => onChangeTab('materi')}
            className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'materi'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Materi</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ketebalan'}
            onClick={() => onChangeTab('ketebalan')}
            className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'ketebalan'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Ketebalan</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'narasi'}
            onClick={() => onChangeTab('narasi')}
            className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'narasi'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Narasi</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kuis'}
            onClick={() => onChangeTab('kuis')}
            className={`inline-flex items-center gap-1 px-2.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'kuis'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Kuis ({answeredCount}/15)</span>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Perkecil panel' : 'Perluas panel'}
            title={expanded ? 'Ringkas panel' : 'Perluas panel'}
            className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel pembelajaran"
            title="Tutup panel"
            className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-4 earth-scroll">
        {activeTab === 'materi' && (
          <MaterialPanel
            selectedLayerId={selectedLayerId}
            activeAtmosSubId={activeAtmosSubId}
            onSelectLayer={onSelectLayer}
            onSelectAtmosSubLayer={onSelectAtmosSubLayer}
            onStartAtmosTour={onStartAtmosTour}
            onOpenNarrationForLayer={onOpenNarrationForLayer}
            onPlayVoiceoverTrack={(layerId) => onPlayVoiceoverTrack(layerId)}
            onStopVoiceover={onStopVoiceover}
            playingTrack={playingTrack}
            hasCustomVoiceover={(key) => Boolean(voiceovers[key])}
          />
        )}

        {activeTab === 'ketebalan' && (
          <ThicknessComparePanel
            selectedLayerId={selectedLayerId}
            onSelectLayer={onSelectLayer}
          />
        )}

        {activeTab === 'narasi' && (
          <NarrationPanel
            activeTrack={narrationTrack}
            onChangeTrack={onChangeNarrationTrack}
            voiceovers={voiceovers}
            hasDefaultVoiceover={hasDefaultVoiceover}
            onUploadVoiceover={onUploadVoiceover}
            onRemoveVoiceover={onRemoveVoiceover}
            onRestoreDefaultVoiceover={onRestoreDefaultVoiceover}
            onBeforePlayAudio={onStopVoiceover}
            onFocusLayer={onSelectLayer}
            onFocusAtmosSubLayer={onSelectAtmosSubLayer}
          />
        )}

        {activeTab === 'kuis' && (
          <QuizPanel
            answers={quizAnswers}
            onAnswer={onAnswerQuiz}
            onResetQuiz={onResetQuiz}
            onInspectLayer3D={(layerId) => {
              onSelectLayer(layerId);
              if (expanded) onToggleExpand();
            }}
          />
        )}
      </div>
    </aside>
  );
}
