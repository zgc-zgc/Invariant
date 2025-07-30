export class ProgressDisplay {
  private startTime: number;
  private currentPhase: string = '';
  private subPhases: Map<string, { current: number; total: number }> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  public updatePhase(phase: string): void {
    this.currentPhase = phase;
    this.render();
  }

  public updateSubPhase(name: string, current: number, total: number): void {
    this.subPhases.set(name, { current, total });
    this.render();
  }

  public showDiscoveryProgress(
    explorerAlpha: number, 
    explorerBeta: number, 
    synthesizerProgress: number,
    deepenerProgress: number,
    totalInvariants: number
  ): void {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    console.clear();
    console.log(`
╔══════════════════════════════════════════════════════╗
║           InvariantX Discovery Progress              ║
╠══════════════════════════════════════════════════════╣
║ Explorer Alpha:  ${this.renderBar(explorerAlpha)} (${explorerAlpha}%)    ║
║ Explorer Beta:   ${this.renderBar(explorerBeta)} (${explorerBeta}%)    ║
║ Synthesizer:     ${this.renderBar(synthesizerProgress)} (${synthesizerProgress}%)    ║
║ Deepener:        ${this.renderBar(deepenerProgress)} (${deepenerProgress}%)    ║
╠══════════════════════════════════════════════════════╣
║ Found: ${totalInvariants} invariants | Time: ${minutes}m ${seconds}s              ║
╚══════════════════════════════════════════════════════╝
`);
  }

  public showChallengeProgress(
    agentType: string,
    round: number,
    maxRounds: number,
    newDiscoveries: number,
    convergenceScore: number
  ): void {
    // Visualization disabled by user.
  }

  public showBatchProgress(
    currentMaterial: string,
    completed: number,
    total: number,
    currentInvariants: number
  ): void {
    const percentage = Math.round((completed / total) * 100);
    
    console.log(`
╔══════════════════════════════════════════════════════╗
║           Batch Analysis Progress                    ║
╠══════════════════════════════════════════════════════╣
║ Current: ${this.truncate(currentMaterial, 40)}     ║
║ Progress: ${this.renderBar(percentage)} (${completed}/${total})      ║
║ Current Invariants: ${currentInvariants}                        ║
╚══════════════════════════════════════════════════════╝
`);
  }

  private render(): void {
    if (this.currentPhase && this.subPhases.size > 0) {
      console.log(`\n=== ${this.currentPhase} ===`);
      for (const [name, progress] of this.subPhases) {
        const percentage = Math.round((progress.current / progress.total) * 100);
        console.log(`${name}: ${this.renderBar(percentage, 20)} ${progress.current}/${progress.total}`);
      }
    }
  }

  private renderBar(percentage: number, width: number = 40): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text.padEnd(maxLength);
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  public showConvergenceAnalysis(
    lengthRatio: number,
    wordOverlap: number,
    keyTermSimilarity: number,
    overallScore: number
  ): void {
    // Visualization disabled by user.
  }

  private renderMiniBar(value: number, width: number = 15): string {
    const filled = Math.round(value * width);
    const empty = width - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }
}