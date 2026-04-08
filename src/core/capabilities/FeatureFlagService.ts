import type { CapabilitySet } from '../domain/CapabilitySet';

/**
 * Provides runtime feature-flag queries backed by a CapabilitySet.
 * Supports local overrides for development / testing.
 */
export class FeatureFlagService {
  private capabilities: CapabilitySet;
  private overrides = new Map<keyof CapabilitySet, boolean>();

  constructor(capabilities: CapabilitySet) {
    this.capabilities = capabilities;
  }

  /** Check whether a given capability flag is enabled. */
  isEnabled(flag: keyof CapabilitySet): boolean {
    const override = this.overrides.get(flag);
    if (override !== undefined) return override;
    return this.capabilities[flag];
  }

  /** Apply a local override for a capability flag. */
  override(flag: keyof CapabilitySet, value: boolean): void {
    this.overrides.set(flag, value);
  }

  /** Remove all local overrides. */
  clearOverrides(): void {
    this.overrides.clear();
  }

  /** Remove a single override, reverting to the backend-reported value. */
  clearOverride(flag: keyof CapabilitySet): void {
    this.overrides.delete(flag);
  }

  /** Replace the entire capability set (e.g. after re-discovery). */
  updateCapabilities(capabilities: CapabilitySet): void {
    this.capabilities = capabilities;
  }

  /** Return the raw capability set (without overrides). */
  getRawCapabilities(): Readonly<CapabilitySet> {
    return this.capabilities;
  }
}
