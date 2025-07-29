# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InvariantX is a system that combines rigid program control with AI intelligent analysis to automatically discover invariants and rules in Solidity smart contracts. The core principle is that the program acts as a meeting facilitator while AI agents conduct deep discussions to autonomously discover invariants.

## Key Implementation Principles

1. **System Philosophy**: This is NOT a vulnerability scanner or attack tool. It's an invariant discovery system focused on understanding contract constraints - "永远为真的属性" (always-true properties) and "必须遵守的规则" (must-follow rules).

2. **AI Agent Architecture**: The system uses 3 core AI agents with Alpha-Beta Challenge system:
   - Explorer: Comprehensive invariant discovery with integrated importance evaluation (formerly separate ValueAssessor)
   - Deepener: Relationship analysis and constraint deepening
   - Synthesizer: Organizes and consolidates final results
   - Each Explorer and Deepener has Alpha-Beta roles that challenge each other's findings for thoroughness

3. **No Preset Invariant Types**: Let AI fully utilize its creativity without limiting thinking to specific categories.

## Development Commands

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Start compiled version
npm start

# Run linting
npm run lint

# Clean build directory
npm run clean

# Test the CLI
npx invariantx discover ./examples/SimpleToken.sol --verbose
npx invariantx config --check
npx invariantx config --init
```

## Core Architecture

### Alpha-Beta Challenge Discovery Workflow
1. **Explorer Challenge Phase**: Explorer Alpha-Beta roles challenge each other to comprehensively discover invariants with integrated importance evaluation
2. **Core Identification**: Synthesizer identifies 3-5 most critical invariants from challenge results
3. **Deepener Challenge Phase**: Deepener Alpha-Beta roles challenge each other to analyze relationships and derive new constraints from core invariants
4. **Final Synthesis**: Synthesizer consolidates all findings into final results

### Key Components

**InvariantDiscoveryOrchestrator** (`src/core/`): 
- Central coordinator managing the Alpha-Beta challenge workflow
- Manages agent calling sequence with challenge convergence detection
- Implements challenge-based feedback loop where core invariants are fed to Deepener challenges

**AI Agent System** (`src/agents/`):
- `BaseAgent`: Abstract base with shared system prompts emphasizing invariant discovery over vulnerability finding
- `ExplorerAgent`: Enhanced with comprehensive internal prompts covering 6 analysis dimensions and integrated ValueAssessor functionality
- `DeepenerAgent`: Enhanced with 6-part deepening analysis framework and relationship discovery
- `SynthesizerAgent`: Consolidates results from challenge outputs
- All agents use rich internal prompts to reduce config file dependency

**Challenge System** (`src/core/ChallengeSystem.ts`):
- Implements Alpha-Beta role challenges for Explorer and Deepener agents
- Manages convergence detection based on rounds limit and content novelty
- Enforces systematic debates to ensure comprehensive invariant discovery
- Tracks discovery patterns and prevents premature convergence

**Configuration System** (`src/config/`):
- `ConfigManager`: Environment-driven singleton for API and convergence settings
- `DynamicConfigLoader`: Completely dynamic JSON config without hardcoded keys
- Supports template expansion (`{variable}`) and function pattern matching

**API Management** (`src/api/`):
- Supports any LLM provider via environment configuration
- Robust retry logic with exponential backoff and 429 handling
- No hardcoded temperature/max_tokens - lets APIs use their defaults

### Configuration Architecture

**Environment Variables** (`.env`):
```env
# API Configuration
API_ENDPOINT=https://your-llm-endpoint/v1/chat
API_KEY=your-api-key
MODEL_NAME=your-model-name

# Error Handling
RETRY_ENABLED=true
MAX_RETRIES=5
RETRY_DELAY_MS=1000
HANDLE_429=true

# Original Convergence Control
MIN_ROUNDS=3
MAX_ROUNDS=10

# Challenge System Configuration
MAX_CHALLENGE_ROUNDS=5
CHALLENGE_CONVERGENCE_THRESHOLD=0.2
```

**Dynamic JSON Config** (`configs/default-config.json`):
- Keys are completely dynamic - no hardcoded configuration keys in code
- System reads JSON and generates ExplorationTasks for any key-value pairs
- Supports categories like "基础数学关系探索", "状态转换规律", "访问控制模式" etc.
- Template expansion for `{variable}` placeholders and function pattern matching

## Important Implementation Notes

1. **Invariant vs Vulnerability Focus**: All prompts and logic emphasize finding "永远为真的属性" rather than security vulnerabilities. This is enforced throughout BaseAgent system prompts.

2. **Challenge-Based Feedback Loop**: Core invariants identified by Synthesizer are fed back to Deepener Alpha-Beta challenges for deeper relational analysis - this ensures comprehensive exploration through systematic debates.

3. **Error Handling**: Comprehensive API error handling with exponential backoff, 429 handling, and graceful fallbacks when JSON parsing fails.

4. **CLI Interface**: Full-featured CLI with `discover`, `prompt`, and `config` commands. Built with Commander.js.

5. **Type Safety**: Complete TypeScript interfaces for AgentMessage, Invariant, DiscoveryResult, SharedContext, etc.

## Configuration Extension

To add new exploration categories:
1. Add new key-value pairs to `configs/default-config.json`
2. System automatically discovers and uses them - no code changes needed
3. Supports prompt arrays, template variables, and function matching patterns

## Testing and Examples

- Example contract: `examples/SimpleToken.sol`
- Test compilation and functionality with existing commands
- System logs discovery progress and loads 10+ exploration task categories from config