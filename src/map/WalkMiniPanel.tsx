import { ChevronRight, Footprints } from 'lucide-react';
import type { WalkState } from './WalkPanel';
import { formatMeters } from './geo';

/** In-app navigation companion. Uses the live map state, never a second route. */
export function WalkMiniPanel({ walk, onOpen }: { walk: WalkState; onOpen: () => void }) {
  const meters = walk.remainingMeters ?? walk.route?.meters;
  const instruction = !walk.gpsActive ? 'Posizione non disponibile · apri la mappa'
    : walk.loading || !walk.route ? 'Calcolo il percorso…'
    : walk.arrived ? 'Sei arrivato'
    : walk.offRoute ? 'Sei fuori percorso · apri la mappa'
    : walk.route.estimated ? 'Distanza stimata in linea d’aria'
    : walk.nextStep?.text ?? 'Segui il percorso';

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="walk-mini-panel"
      aria-label={`Torna al percorso verso ${walk.target.italianName}`}
      className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[45] flex items-center gap-3 rounded-xl bg-[#152231] px-4 py-3 text-left text-[#eaf0f6] shadow-[0_6px_24px_rgba(0,0,0,0.35)] motion-safe:transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]"
    >
      <Footprints className="h-5 w-5 shrink-0 text-[#52d9e6]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-[Outfit] text-base font-medium">{walk.target.italianName}</span>
          {walk.gpsActive && !walk.arrived && meters != null && (
            <span className="shrink-0 text-xs tabular-nums text-[#52d9e6]">{walk.route?.estimated ? '≈ ' : ''}{formatMeters(meters)}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-[#b2c2d4]">{instruction}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#b2c2d4]" aria-hidden="true" />
    </button>
  );
}
