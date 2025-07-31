"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressDisplay = void 0;
class ProgressDisplay {
    constructor() {
        this.currentPhase = '';
        this.subPhases = new Map();
        this.startTime = Date.now();
    }
    updatePhase(phase) {
        this.currentPhase = phase;
        this.render();
    }
    updateSubPhase(name, current, total) {
        this.subPhases.set(name, { current, total });
        this.render();
    }
    showDiscoveryProgress(explorerAlpha, explorerBeta, synthesizerProgress, deepenerProgress, totalInvariants) {
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
    showChallengeProgress(agentType, round, maxRounds, newDiscoveries, convergenceScore) {
        const roundProgress = Math.round((round / maxRounds) * 100);
        console.log(`
┌─────────────── ${agentType} Challenge Progress ───────────────┐
│ Round: ${round}/${maxRounds} ${this.renderBar(roundProgress, 30)}         │
│ New Discoveries: ${newDiscoveries} | Convergence: ${(convergenceScore * 100).toFixed(1)}%     │
└──────────────────────────────────────────────────────┘
`);
    }
    showBatchProgress(currentMaterial, completed, total, currentInvariants) {
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
    render() {
        if (this.currentPhase && this.subPhases.size > 0) {
            console.log(`\n=== ${this.currentPhase} ===`);
            for (const [name, progress] of this.subPhases) {
                const percentage = Math.round((progress.current / progress.total) * 100);
                console.log(`${name}: ${this.renderBar(percentage, 20)} ${progress.current}/${progress.total}`);
            }
        }
    }
    renderBar(percentage, width = 40) {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    truncate(text, maxLength) {
        if (text.length <= maxLength) {
            return text.padEnd(maxLength);
        }
        return text.substring(0, maxLength - 3) + '...';
    }
    showConvergenceAnalysis(lengthRatio, wordOverlap, keyTermSimilarity, overallScore) {
        console.log(`
┌─────────────── Convergence Analysis ─────────────────┐
│ Length Ratio:     ${this.renderMiniBar(lengthRatio)} ${(lengthRatio * 100).toFixed(1)}%     │
│ Word Overlap:     ${this.renderMiniBar(wordOverlap)} ${(wordOverlap * 100).toFixed(1)}%     │
│ Key Terms:        ${this.renderMiniBar(keyTermSimilarity)} ${(keyTermSimilarity * 100).toFixed(1)}%     │
│ Overall Score:    ${this.renderMiniBar(overallScore)} ${(overallScore * 100).toFixed(1)}%     │
└──────────────────────────────────────────────────────┘
`);
    }
    renderMiniBar(value, width = 15) {
        const filled = Math.round(value * width);
        const empty = width - filled;
        return '▓'.repeat(filled) + '░'.repeat(empty);
    }
}
exports.ProgressDisplay = ProgressDisplay;
//# sourceMappingURL=ProgressDisplay.js.map