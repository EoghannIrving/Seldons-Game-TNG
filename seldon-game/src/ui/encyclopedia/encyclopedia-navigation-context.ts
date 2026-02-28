export interface SimulationNavigationContextSnapshot {
  selectedStarId: string | null;
  phase: number;
  eventCategory: string;
}

export function captureSimulationNavigationContextSnapshot(args: {
  selectedStarId: string | null;
  phase: number;
  eventCategory: string;
}): SimulationNavigationContextSnapshot {
  return {
    selectedStarId: args.selectedStarId,
    phase: args.phase,
    eventCategory: args.eventCategory,
  };
}

export function restoreSimulationNavigationContextSnapshot<TStar>(args: {
  currentPhase: number;
  context: SimulationNavigationContextSnapshot;
  goToPhase: (phase: number) => boolean;
  setSelectedStar: (starId: string | null) => void;
  resolveStar: (starId: string) => TStar | null;
  panToStar: (star: TStar) => void;
}): void {
  const { currentPhase, context, goToPhase, setSelectedStar, resolveStar, panToStar } = args;

  if (currentPhase !== context.phase) {
    goToPhase(context.phase);
  }

  setSelectedStar(context.selectedStarId);
  if (context.selectedStarId) {
    const star = resolveStar(context.selectedStarId);
    if (star) {
      panToStar(star);
    }
  }
}
