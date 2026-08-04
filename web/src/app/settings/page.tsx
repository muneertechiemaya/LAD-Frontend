'use client';
// Force dynamic rendering
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCompanyName, setCompanyLogo } from '../../store/slices/settingsSlice';
import { IntegrationsSettings } from '../../components/settings/IntegrationsSettings';
import { VoiceAgentSettings } from '../../components/voice-agent/VoiceAgentSettings';
import { ChatSettings } from '../../components/settings/ChatSettings';
import { BillingSettings } from '../../components/settings/BillingSettings';
import { CreditsSettings } from '../../components/settings/CreditsSettings';
import { BusinessProfileSettings } from '../../components/settings/BusinessProfileSettings';
import { TeamManagement } from '../../components/settings/TeamManagement';
import { Toaster, toast } from 'sonner';
import { cn } from '../../lib/utils';

// Encapsulated Proposal Settings Components
import { QuotationTemplates } from '../../components/settings/QuotationTemplates';
import { LeadRequirements } from '../../components/settings/LeadRequirements';
import { ConceptManagement } from '../../components/settings/ConceptManagement';
import { PricingRules } from '../../components/settings/PricingRules';

// Preserved Email Templates Code
import { EmailTemplates, Template } from './EmailTemplates';
import QuotationEmailTemplateEditor from '@/app/settings/QuotationEmailTemplateEditor';
import { EmailTemplatesDragDrop } from './EmailTemplatesDragDrop';

import {
  Building2, Users, UserCircle, Globe, Plug,
  Terminal, CreditCard, Coins, Upload, ClipboardCheck,
  X, Sparkles, Tag, Settings, DollarSign,
  MessageSquare, Mail, FileText, ChevronDown,
  Target, Crosshair
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { motion, AnimatePresence } from 'motion/react';
import { getApiBaseUrl, getApiBaseUrlForLocal } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

type ActiveTab = 'businessprofile' | 'team' | 'accounts' | 'website' | 'integrations' | 'chat' | 'api' | 'billing' | 'credits' | 'proposal_settings';

const SettingsPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { tenant } = useTenant();
  const { user, isLoading: isAuthLoading } = useAuth();

  const companyName = useSelector((state: any) => state.settings.companyName);
  const companyLogo = useSelector((state: any) => state.settings.companyLogo);
  const [activeTab, setActiveTab] = useState<ActiveTab>('integrations');
  const [renewalDate, setRenewalDate] = useState<string>('');
  const [logoError, setLogoError] = useState(false);
  const [proposalSubTab, setProposalSubTab] = useState<'lead_config' | 'concepts' | 'pricing_rules' | 'quotation-templates' | ''>('lead_config');

  // Preserved Email Templates State
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Redirect if not authenticated and not loading
  useEffect(() => {
    if (!isAuthLoading && !user) {
      const redirect = encodeURIComponent('/settings');
      router.replace(`/login?redirect_url=${redirect}`);
    }
  }, [isAuthLoading, user, router]);

  // Update company name from tenant or user profile
  useEffect(() => {
    if (!user) return;
    const sessionName = (tenant?.name && tenant.name !== "Default")
      ? tenant.name
      : ((user as any)?.company_name || user?.name);

    if (sessionName && sessionName !== companyName && sessionName !== "Default") {
      dispatch(setCompanyName(sessionName));
    }
  }, [tenant?.name, user, companyName, dispatch]);

  const displayCompanyName = (tenant?.name && tenant.name !== "Default")
    ? tenant.name
    : ((user as any)?.company_name || user?.name || (companyName !== "My Organization" ? companyName : ""));

  useEffect(() => {
    if (!user) return;
    const tabParam = (searchParams.get('tab') || '').toLowerCase();
    const allowed: ActiveTab[] = ['businessprofile', 'team', 'accounts', 'website', 'integrations', 'chat', 'api', 'billing', 'credits', 'proposal_settings'];
    
    if (tabParam === 'company') {
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.set('tab', 'businessprofile');
      router.replace(`/settings?${sp.toString()}`);
      setActiveTab('businessprofile');
    } else if (allowed.includes(tabParam as ActiveTab)) {
      const targetTab = tabParam as ActiveTab;
      setActiveTab(targetTab);
    }

    const fetchRenewalDate = async () => {
      try {
        const periodEnd = Date.now() + 86400 * 15 * 1000;
        const date = new Date(periodEnd);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        setRenewalDate(formattedDate);
      } catch (error) {
        console.error('Error fetching renewal date:', error);
        setRenewalDate('November 29th, 2025');
      }
    };
    fetchRenewalDate();
  }, [user, searchParams]);

  // Preserved Email Templates API Handlers (Dead Code)
  const fetchEmailTemplates = async (targetTenantId: string) => {
    try {
      const res = await fetch(`${getApiBaseUrlForLocal()}/api/quotation-email-template/${targetTenantId}`);
      if (!res.ok) {
        logger.error(`Failed to fetch email templates: HTTP ${res.status}`);
        setEmailTemplates([]);
        return;
      }
      const data = await res.json();
      setEmailTemplates(Array.isArray(data) ? data : (data?.data && Array.isArray(data.data) ? data.data : []));
    } catch (error) {
      logger.error("Failed to fetch email templates", error);
      setEmailTemplates([]);
    }
  };

  const handleUploadEmailTemplate = async (template_name: string, subjectLine: string, isDefault: boolean, file: File) => {
    const targetTenantId = tenant?.id;
    if (!targetTenantId) return;
    try {
      const formData = new FormData();
      formData.append('template_name', template_name);
      formData.append('is_default', String(isDefault));
      formData.append('subject_line', subjectLine);
      formData.append('file', file);

      const response = await fetch(`${getApiBaseUrlForLocal()}/api/email-templates/upload/${targetTenantId}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        toast.success('Email template uploaded and saved');
        fetchEmailTemplates(targetTenantId);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload email template');
      }
    } catch (error: any) {
      console.error('Upload email template failed:', error);
      toast.error(error.message || 'Failed to upload email template');
    }
  };

  const handlePreviewTemplate = async (template: Template) => {
    try {
      const response = await fetch(`${getApiBaseUrlForLocal()}/api/email-templates/${template.id}/preview`);
      if (!response.ok) throw new Error("Failed to fetch preview");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewModalOpen(true);
    } catch (error) {
      toast.error("Visual preview failed to load");
      console.error(error);
    }
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsPreviewModalOpen(false);
  };

  const handleSetDefaultEmailTemplate = async (id: string) => {
    const targetTenantId = tenant?.id;
    if (!targetTenantId) return;
    try {
      await fetch(`${getApiBaseUrlForLocal()}/api/quotation-email-template/${targetTenantId}/set-default/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      });

      toast.success('Default email template updated');
      fetchEmailTemplates(targetTenantId);
    } catch (error) {
      console.error('Set default email template failed:', error);
    }
  };

  const handleDeleteEmailTemplate = async (id: string) => {
    const targetTenantId = tenant?.id;
    if (!targetTenantId) return;
    if (!confirm('Are you sure you want to delete this email template?')) return;
    try {
      const res = await fetch(`${getApiBaseUrlForLocal()}/api/quotation-email-template/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Email template deleted');
        fetchEmailTemplates(targetTenantId);
      }
    } catch (error) {
      console.error('Delete email template failed:', error);
      toast.error('Failed to delete email template');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B1957]"></div>
      </div>
    );
  }

  if (!user) return null;

  const tabs = [
    { id: 'businessprofile' as ActiveTab, label: 'Business Profile', icon: Target },
    { id: 'team' as ActiveTab, label: 'Team', icon: Users },
    { id: 'integrations' as ActiveTab, label: 'Integrations', icon: Plug },
    { id: 'chat' as ActiveTab, label: 'Chat Settings', icon: MessageSquare },
    { id: 'api' as ActiveTab, label: 'Voice Settings', icon: Terminal },
    { id: 'billing' as ActiveTab, label: 'Billing', icon: CreditCard },
    { id: 'credits' as ActiveTab, label: 'Credits', icon: Coins },
    { id: 'proposal_settings' as ActiveTab, label: 'Proposal Settings', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FE] dark:bg-[#000724] p-4 sm:p-6 space-y-6">
      {/* Combined Header with Logo, Company Name, Renewal Date, and Tabs */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Top Section: Logo, Company Name, and Renewal */}
        <div className="p-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white dark:bg-gray-800 shadow-md flex items-center justify-center border-2 border-white dark:border-gray-700">
                {logoError || !companyLogo ? (
                  <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                ) : (
                  <img
                    src={companyLogo}
                    alt="Company Logo"
                    className="w-full h-full object-cover"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
              <div>
                <h1 className="text-gray-900 dark:text-gray-100 font-semibold text-xl">{displayCompanyName}</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Renews on {renewalDate || 'Loading...'}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Bottom Section: Tabs Navigation */}
        <div className="border-t border-gray-200/50 dark:border-gray-800/60 bg-white/30 dark:bg-black/20 backdrop-blur-sm">
          <div className="flex space-x-1 overflow-x-auto p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  const sp = new URLSearchParams(Array.from(searchParams.entries()));
                  sp.set('tab', tab.id);
                  router.replace(`/settings?${sp.toString()}`);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-[#0B1957] dark:text-blue-400 shadow-md font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => router.push('/settings/icp-search-strategy')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-800/50"
            >
              <Crosshair className="w-4 h-4" />
              ICP Strategy
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'businessprofile' && <BusinessProfileSettings />}
        {activeTab === 'integrations' && <IntegrationsSettings />}
        {activeTab === 'chat' && <ChatSettings />}
        {activeTab === 'api' && <VoiceAgentSettings />}
        {activeTab === 'team' && <TeamManagement />}
        {activeTab === 'billing' && <BillingSettings />}
        {activeTab === 'credits' && <CreditsSettings />}

        {/* Proposal Settings */}
        {activeTab === 'proposal_settings' && (
          <div className="flex flex-col gap-4">
            {[
              { id: 'lead_config', label: 'Lead requirement', icon: Settings, count: 'Define dynamic fields extracted from lead emails' },
              { id: 'concepts', label: 'Concept management', icon: Sparkles, count: 'Manage event concepts and minimum package costs' },
              { id: 'pricing_rules', label: 'Pricing rules', icon: DollarSign, count: 'Set up automated volume discounts and surcharge rules' },
              { id: 'quotation-templates', label: 'Quotation template', icon: FileText, count: 'Manage document layouts and placeholder tags' },
            ].map((sub) => {
              const isExpanded = proposalSubTab === sub.id;
              return (
                <div
                  key={sub.id}
                  className={cn(
                    "bg-white dark:bg-slate-900 rounded-2xl border transition-all overflow-hidden flex flex-col",
                    isExpanded ? "border-slate-200 dark:border-slate-800 shadow-sm" : "border-slate-100 dark:border-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700"
                  )}
                >
                  <button
                    onClick={() => setProposalSubTab(isExpanded ? '' as any : sub.id as any)}
                    className="flex items-center justify-between p-6 w-full text-left transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                        isExpanded ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400" : "bg-slate-50 dark:bg-slate-800 text-slate-400"
                      )}>
                        <sub.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{sub.label}</p>
                        <p className="text-xs text-slate-400 font-medium">{sub.count}</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-slate-400 transition-transform duration-300",
                      isExpanded && "rotate-180"
                    )} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="border-t border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900"
                      >
                        <div className="p-8">
                          {sub.id === 'lead_config' && <LeadRequirements />}
                          {sub.id === 'concepts' && <ConceptManagement />}
                          {sub.id === 'pricing_rules' && <PricingRules />}
                          {sub.id === 'quotation-templates' && <QuotationTemplates />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* Preserved Email Template Preview Modal */}
        <AnimatePresence>
          {isPreviewModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                  <h2 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Email Template Preview</h2>
                  <button onClick={closePreview} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4">
                  {previewUrl && (
                    <iframe
                      src={`${previewUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full rounded-xl border-none shadow-lg"
                      title="Visual Preview"
                    />
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SettingsPage;
