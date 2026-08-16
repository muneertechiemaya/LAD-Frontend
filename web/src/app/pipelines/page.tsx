'use client';

/**
 * Pipelines — the curated workspace's home screen.
 *
 * This is the surface that REPLACES the workflow builder for a tenant on a
 * vertical snapshot. They do not compose nodes; they switch prebuilt pipelines
 * on and off. Every card is one of three states, which is the whole model:
 *
 *   locked     not entitled — shown, with what it would do, and no switch
 *   off        entitled, tenant has not switched it on
 *   on         entitled and running
 *
 * "Locked" is deliberately shown rather than hidden: hiding everything a
 * workspace lacks removes the only route by which they discover it exists.
 *
 * The switch changes ACTIVATION only. It cannot grant an entitlement — the
 * server refuses, and the optimistic update in usePipelines rolls back.
 */

import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { usePipelines } from '@lad/frontend-features/snapshots';
import type { SnapshotPipeline, KnobValues } from '@lad/frontend-features/snapshots';
import { KnobForm } from '@/components/pipelines/KnobForm';
import { useAuth } from '@/contexts/AuthContext';

function EngineHint({ pipeline }: { pipeline: SnapshotPipeline }) {
  if (!pipeline.goal) return null;
  return (
    <span className="text-xs text-gray-500">
      Aims for: <span className="font-medium text-gray-700">{pipeline.goal.replace(/-/g, ' ')}</span>
    </span>
  );
}

function PipelineCard({
  pipeline,
  pending,
  saving,
  onToggle,
  onSaveKnobs,
}: {
  pipeline: SnapshotPipeline;
  pending: boolean;
  saving: boolean;
  onToggle: (active: boolean) => void;
  onSaveKnobs: (values: KnobValues) => Promise<string[]>;
}) {
  const { key, name, blurb, entitled, active, campaignCount, knobs, knobValues } = pipeline;
  const toggleId = `pipeline-toggle-${key}`;
  const [showSettings, setShowSettings] = useState(false);
  const hasKnobs = entitled && knobs.length > 0;

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 transition-colors ${
        entitled ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">{name}</h3>
            {!entitled && <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden="true" />}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{blurb}</p>
        </div>

        {entitled ? (
          <label htmlFor={toggleId} className="flex items-center gap-2 shrink-0 cursor-pointer">
            <span className="sr-only">
              {active ? `Turn ${name} off` : `Turn ${name} on`}
            </span>
            <input
              id={toggleId}
              type="checkbox"
              role="switch"
              checked={active}
              disabled={pending}
              onChange={(e) => onToggle(e.target.checked)}
              className="h-5 w-9 appearance-none rounded-full bg-gray-300 checked:bg-emerald-600 relative cursor-pointer transition-colors disabled:opacity-50 before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
            />
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" aria-hidden="true" />}
          </label>
        ) : (
          <span className="shrink-0 rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
            Not in your plan
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <EngineHint pipeline={pipeline} />
        {entitled && (
          <span className="text-xs text-gray-500 tabular-nums">
            {campaignCount === 0
              ? 'No campaigns yet'
              : `${campaignCount} campaign${campaignCount === 1 ? '' : 's'}`}
          </span>
        )}
      </div>

      {hasKnobs && (
        <>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-expanded={showSettings}
            className="-mt-1 flex items-center gap-1 self-start text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            {showSettings
              ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            Settings
          </button>

          {/* Mounted only when open so each card keeps its own draft state and
              a collapse discards edits rather than holding them invisibly. */}
          {showSettings && (
            <KnobForm
              knobs={knobs}
              values={knobValues}
              saving={saving}
              onSave={onSaveKnobs}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function PipelinesPage() {
  const { overview, isLoading, error, pendingKey, savingKey, toggle, saveKnobs } = usePipelines();
  const { isCuratedWorkspace } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
        Loading your pipelines…
      </div>
    );
  }

  // A tenant outside a snapshot reaching this route is not an error — they
  // simply run the general-purpose product, where campaigns are built rather
  // than switched on.
  if (!isCuratedWorkspace || !overview?.vertical) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Pipelines aren&apos;t set up for this workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Curated pipelines come with an industry edition of Mr LAD. Your workspace builds
          campaigns directly instead.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Pipelines</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
          Switch on the work you want Mr LAD doing. Each pipeline is built for your industry
          and runs on its own.
        </p>
        {overview.version && (
          <p className="mt-2 text-xs text-gray-400 tabular-nums">
            {overview.vertical} edition · v{overview.version}
          </p>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 items-start">
        {overview.pipelines.map((pipeline) => (
          <PipelineCard
            key={pipeline.key}
            pipeline={pipeline}
            pending={pendingKey === pipeline.key}
            saving={savingKey === pipeline.key}
            onToggle={(active) => void toggle(pipeline.key, active)}
            onSaveKnobs={(values) => saveKnobs(pipeline.key, values)}
          />
        ))}
      </div>
    </div>
  );
}
