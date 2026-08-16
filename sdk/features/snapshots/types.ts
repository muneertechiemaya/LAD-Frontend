// Vertical snapshot types — the curated workspace's Pipelines surface.

/** The four pipelines a vertical snapshot ships. */
export type PipelineKey =
  | 'customer-support'
  | 'admin-support'
  | 'revenue-growth'
  | 'lead-gen';

/** Which execution engine runs a pipeline. Display only. */
export type PipelineEngine = 'stage' | 'sequence';

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
}

export interface PipelineOverview {
  /** null for a tenant outside a snapshot — the page renders a neutral state. */
  vertical: string | null;
  version: string | null;
  pipelines: SnapshotPipeline[];
}
