// Vertical snapshot types — the curated workspace's Pipelines surface.

/** The four pipelines a vertical snapshot ships. */
export type PipelineKey =
  | 'customer-support'
  | 'admin-support'
  | 'revenue-growth'
  | 'lead-gen';

/** Which execution engine runs a pipeline. Display only. */
export type PipelineEngine = 'stage' | 'sequence';

/** The knob types a snapshot manifest may declare. */
export type KnobType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'phone'
  | 'time'
  | 'list';

export type KnobOption = string | { value: string; label: string };

export interface KnobDefinition {
  key: string;
  label: string;
  type: KnobType;
  help?: string;
  required?: boolean;
  default?: unknown;
  /** select / multiselect */
  options?: KnobOption[];
  /** number */
  min?: number;
  max?: number;
  integer?: boolean;
  /** text / textarea */
  maxLength?: number;
  /** list */
  maxItems?: number;
}

export type KnobValues = Record<string, unknown>;

export interface SnapshotPipeline {
  key: PipelineKey;
  name: string;
  blurb: string;
  engine: PipelineEngine | null;
  /** The pipeline's goal event, e.g. 'rebooked'. */
  goal: string | null;
  /** Build state from the snapshot manifest, e.g. 'planned' | 'live'. */
  state: string | null;
  /**
   * Whether the workspace is ENTITLED to this pipeline. Admin-controlled — the
   * on/off switch on the page cannot change this.
   */
  entitled: boolean;
  /** Whether the tenant has switched it on. Only meaningful when entitled. */
  active: boolean;
  campaignCount: number;
  /** The settings form to render — shared knobs first, then this pipeline's. */
  knobs: KnobDefinition[];
  /**
   * Current values, already resolved through the schema (manifest defaults
   * overlaid with what the tenant set). Contains only knobs this snapshot
   * version declares — values stored by a newer version are kept server-side
   * but deliberately not returned.
   */
  knobValues: KnobValues;
}

export interface PipelineOverview {
  /** null for a tenant outside a snapshot — the page renders a neutral state. */
  vertical: string | null;
  version: string | null;
  pipelines: SnapshotPipeline[];
}
