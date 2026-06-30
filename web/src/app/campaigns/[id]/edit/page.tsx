'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Save, Play, Loader2 } from 'lucide-react';
import { useCampaign, updateCampaign } from '@lad/frontend-features/campaigns';
import { useToast } from '@/components/ui/app-toaster';
import { useCampaignStore } from '@/store/campaignStore';
import { StepLibrary, FlowCanvas, StepSettings } from '@/components/campaigns';
import { logger } from '@/lib/logger';

// Campaign workflow editor.
//
// This page previously rendered the onboarding `Screen3ManualEditor`, whose
// StepLibrary/StepSettings were stubbed out as "Coming Soon" — so Edit Workflow
// showed no steps and couldn't add/remove steps or edit messages. It now uses the
// SAME campaignStore-wired editor the campaign detail page uses (StepLibrary +
// FlowCanvas + StepSettings), so the existing steps load, steps can be added/
// removed, and LinkedIn connection/message text can be edited.
export default function CampaignEditPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);

  // The campaign editor store: nodes/edges + add/update/delete/select, plus
  // loadCampaign() (steps → nodes) and serialize() (nodes → steps).
  const { name, nodes, setName, loadCampaign, serialize } = useCampaignStore();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useCampaign(
    campaignId && campaignId !== 'new' ? campaignId : null
  );

  // Hydrate the editor from the campaign's saved steps once it loads.
  useEffect(() => {
    if (campaign) {
      loadCampaign({ name: campaign.name, steps: campaign.steps || [] });
      setLoading(false);
    } else if (campaignError) {
      push({
        variant: 'error',
        title: 'Error',
        description: (campaignError as Error)?.message || 'Failed to load campaign',
      });
      router.push('/campaigns');
    } else if (campaignId === 'new') {
      setLoading(false);
    } else if (!campaignLoading) {
      setLoading(false);
    }
  }, [campaign, campaignId, campaignLoading, campaignError, loadCampaign, push, router]);

  const handleSave = async (startAfterSave = false) => {
    if (!name.trim()) {
      push({ variant: 'error', title: 'Error', description: 'Campaign name is required' });
      return;
    }
    // Ignore the synthetic start/end nodes when checking for real steps.
    const realSteps = nodes.filter((n) => n.type !== 'start' && n.type !== 'end');
    if (realSteps.length === 0) {
      push({ variant: 'error', title: 'Error', description: 'Please add at least one step to your campaign' });
      return;
    }
    try {
      setSaving(true);
      const campaignData = serialize();
      await updateCampaign(campaignId, {
        name: campaignData.name,
        status: startAfterSave ? 'running' : 'draft',
        steps: campaignData.steps,
      });
      push({
        variant: 'success',
        title: 'Success',
        description: startAfterSave ? 'Campaign saved and started!' : 'Campaign saved successfully',
      });
      router.push(startAfterSave ? '/campaigns' : `/campaigns/${campaignId}`);
    } catch (error: any) {
      logger.error('Failed to save campaign:', error);
      push({
        variant: 'error',
        title: 'Error',
        description: error.message || 'Failed to save campaign',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b p-4 sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex gap-4 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/campaigns/${campaignId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Input
            size="default"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="flex-1 max-w-md"
          />
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowStartDialog(true)}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Save & Start
            </Button>
          </div>
        </div>
      </div>

      {/* Workflow editor — 3-column campaignStore-wired layout (StepLibrary →
          FlowCanvas → StepSettings), identical to the campaign detail editor. */}
      <div className="flex-1 flex overflow-hidden">
        <StepLibrary />
        <div className="flex-1 relative">
          <FlowCanvas />
        </div>
        <StepSettings />
      </div>

      {/* Start Confirmation Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Campaign</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to save and start this campaign? It will begin executing immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setShowStartDialog(false);
                handleSave(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Start Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
