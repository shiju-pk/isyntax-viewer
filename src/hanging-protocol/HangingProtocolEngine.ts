/**
 * HangingProtocolEngine — Manages protocol registration, matching, and
 * application to viewport layouts.
 *
 * Usage:
 *   const engine = new HangingProtocolEngine();
 *   engine.registerProtocol(myProtocol);
 *   const best = engine.match(studyContext);
 *   if (best) engine.apply(best.protocol);
 */

import type {
  HangingProtocol,
  ProtocolMatchResult,
  StudyMatchContext,
} from './types';
import { matchProtocols, getBestProtocol } from './ProtocolMatcher';

export class HangingProtocolEngine {
  private _protocols: HangingProtocol[] = [];
  private _activeProtocol: HangingProtocol | null = null;

  /** Register a single protocol. */
  registerProtocol(protocol: HangingProtocol): void {
    // Replace if same ID exists
    const idx = this._protocols.findIndex((p) => p.id === protocol.id);
    if (idx !== -1) {
      this._protocols[idx] = protocol;
    } else {
      this._protocols.push(protocol);
    }
  }

  /** Register multiple protocols at once. */
  registerProtocols(protocols: HangingProtocol[]): void {
    for (const p of protocols) {
      this.registerProtocol(p);
    }
  }

  /** Unregister a protocol by ID. */
  unregisterProtocol(id: string): void {
    this._protocols = this._protocols.filter((p) => p.id !== id);
    if (this._activeProtocol?.id === id) {
      this._activeProtocol = null;
    }
  }

  /** Get all registered protocols. */
  getProtocols(): readonly HangingProtocol[] {
    return this._protocols;
  }

  /** Get the currently active protocol. */
  getActiveProtocol(): HangingProtocol | null {
    return this._activeProtocol;
  }

  /** Set the active protocol directly (e.g., from user selection). */
  setActiveProtocol(protocol: HangingProtocol | null): void {
    this._activeProtocol = protocol;
  }

  /**
   * Match all registered protocols against a study context.
   * Returns sorted match results (highest score first).
   */
  match(context: StudyMatchContext): ProtocolMatchResult[] {
    return matchProtocols(this._protocols, context);
  }

  /**
   * Auto-select the best matching protocol for a study.
   * Sets it as active and returns it, or null if no match.
   */
  autoSelect(context: StudyMatchContext): HangingProtocol | null {
    const best = getBestProtocol(this._protocols, context);
    this._activeProtocol = best;
    return best;
  }

  /** Get a protocol by ID. */
  getProtocolById(id: string): HangingProtocol | undefined {
    return this._protocols.find((p) => p.id === id);
  }

  /** Clear all registered protocols. */
  clear(): void {
    this._protocols = [];
    this._activeProtocol = null;
  }
}
