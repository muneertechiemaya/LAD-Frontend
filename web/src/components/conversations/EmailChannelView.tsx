'use client';

import {
  useState, useEffect, useCallback, useRef, memo, useMemo,
} from 'react';
import {
  Mail, Users, Plus, Search, UserPlus, Loader2, X,
  Trash2, Send, ChevronRight, ChevronLeft, RefreshCw, ArrowLeft,
  FileText, Check, Paperclip, ChevronDown,
  Tag, Clock, Building2, AtSign,
  AlertCircle, MoreVertical, Bold, Italic, Link2,
  Image as ImageIcon, Smile, Star,
  PanelRightClose, PanelRightOpen, Hash,
  Inbox, Pencil, Menu, Settings, HelpCircle, SlidersHorizontal, LayoutGrid,
  Reply, ReplyAll, Forward, Printer, ExternalLink, MoreHorizontal,
  Undo, Redo, AlignLeft, List, Indent,
  LogOut, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImportLeadsDialog } from './ImportLeadsDialog';
import { EmailTemplatePicker } from './EmailTemplatePicker';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailContact {
  id: string;
  contact_name: string | null;
  email: string | null;
  company: string | null;
  channel: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

interface EmailGroup {
  id: string;
  name: string;
  color: string;
  description: string | null;
  channel: string;
  member_count: number;
}

interface EmailLabels {
  id: string;
  name: string;
  color: string;
  description: string | null;
  channel: string;
}

interface EmailGroupDetail extends EmailGroup {
  members: EmailContact[];
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  body_html: string | null;
  category: string;
}

type EmailProvider = 'gmail' | 'outlook' | 'custom';
type FolderType = 'inbox' | 'starred' | 'sent' | 'important' | 'drafts' | 'spam' | 'trash' | 'snoozed';
type CategoryTab = 'primary' | 'social' | 'promotions' | 'updates';

interface EmailChannelViewProps {
  provider: EmailProvider;
  connectedEmail?: string;
  userImage?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API = '/api/email-conversations';
const TEMPLATES_API = '/api/campaigns/email-templates';

const PROVIDER_COLOR: Record<EmailProvider, string> = {
  gmail: '#EA4335',
  outlook: '#0078D4',
  custom: '#059669',
};
const PROVIDER_LABEL: Record<EmailProvider, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  custom: 'Custom SMTP',
};

function toBackendProvider(p: EmailProvider): string {
  if (p === 'outlook') return 'microsoft';
  if (p === 'custom') return 'custom_smtp';
  return 'google';
}

const AVATAR_GRADIENTS = [
  'from-indigo-400 to-purple-500',
  'from-blue-400 to-cyan-500',
  'from-emerald-400 to-teal-500',
  'from-orange-400 to-red-500',
  'from-pink-400 to-rose-500',
  'from-violet-400 to-indigo-500',
];

// ── Smart Replies ─────────────────────────────────────────────────────────────

const SMART_REPLIES: Record<string, string[]> = {
  default: ['Looking forward to it!', 'We will be there!', 'Thanks for the update!'],
  inquiry: ['Thanks for reaching out!', "I'll review and get back to you", 'Can we schedule a call?'],
  approval: ['Sounds great!', 'Approved — please proceed', 'Let me check with the team'],
  meeting: ['Works for me!', 'Can we reschedule?', "I'll send a calendar invite"],
  proposal: ['Looks good to me!', 'I have a few questions', "Let's discuss further"],
};

function getSmartReplies(subject: string): string[] {
  const l = subject.toLowerCase();
  if (l.includes('inquiry') || l.includes('request')) return SMART_REPLIES.inquiry;
  if (l.includes('approved') || l.includes('confirm')) return SMART_REPLIES.approval;
  if (l.includes('meeting') || l.includes('schedule')) return SMART_REPLIES.meeting;
  if (l.includes('proposal') || l.includes('quote')) return SMART_REPLIES.proposal;
  return SMART_REPLIES.default;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_CONTACTS: EmailContact[] = [
  { id: '1', contact_name: 'GlobalStay Residences', email: 'bookings@globalstay.com', company: 'GlobalStay', channel: 'gmail', created_at: '2026-05-29T13:05:00Z' },
  { id: '2', contact_name: 'Elite Workspace Dubai', email: 'sales@eliteworkspace.ae', company: 'Elite Workspace', channel: 'gmail', created_at: '2026-05-29T12:50:00Z' },
  { id: '3', contact_name: 'Skyline Realty Group', email: 'leads@skylinerealty.co.uk', company: 'Skyline Realty', channel: 'gmail', created_at: '2026-05-29T12:30:00Z' },
  { id: '4', contact_name: 'Maria Gonzalez', email: 'maria@urbanlease.mx', company: 'UrbanLease', channel: 'gmail', created_at: '2026-05-29T12:28:00Z' },
  { id: '5', contact_name: 'BlueWave Properties', email: 'support@bluewaveproperty.com', company: 'BlueWave', channel: 'gmail', created_at: '2026-05-29T12:20:00Z' },
  { id: '6', contact_name: 'Liam Carter', email: 'liam@tenantbridge.ca', company: 'TenantBridge', channel: 'gmail', created_at: '2026-05-29T11:48:00Z' },
  { id: '7', contact_name: 'Prime Commercial Spaces', email: 'contact@primecommercial.sg', company: 'Prime Commercial', channel: 'gmail', created_at: '2026-05-29T11:44:00Z' },
  { id: '8', contact_name: 'RentFlow Europe', email: 'hello@rentflow.eu', company: 'RentFlow', channel: 'gmail', created_at: '2026-05-29T11:09:00Z' },
  { id: '9', contact_name: 'Apex Facility Solutions', email: 'services@apexfacility.com.au', company: 'Apex Facility', channel: 'gmail', created_at: '2026-05-29T10:52:00Z' },
  { id: '10', contact_name: 'Nordic Living Group', email: 'noreply@nordicliving.se', company: 'Nordic Living', channel: 'gmail', created_at: '2026-05-29T10:42:00Z' },
  { id: '11', contact_name: 'Tokyo Smart Rentals', email: 'partnerships@tokyosmartrent.jp', company: 'Tokyo Smart Rentals', channel: 'gmail', created_at: '2026-05-29T10:30:00Z' },
  { id: '12', contact_name: 'LeadSphere CRM', email: 'notifications@leadsphere.io', company: 'LeadSphere', channel: 'gmail', created_at: '2026-05-29T10:25:00Z' },
  { id: '13', contact_name: 'Olivia Brown', email: 'olivia@tenantconnect.nz', company: 'TenantConnect', channel: 'gmail', created_at: '2026-05-29T10:17:00Z' },
  { id: '14', contact_name: 'Berlin Office Hub', email: 'sales@berlinofficehub.de', company: 'Berlin Office Hub', channel: 'gmail', created_at: '2026-05-29T10:16:00Z' },
  { id: '15', contact_name: 'Pacific Housing Leads', email: 'alerts@pacifichousing.io', company: 'Pacific Housing', channel: 'gmail', created_at: '2026-05-29T10:08:00Z' },
  { id: '16', contact_name: 'UrbanNest Holdings', email: 'hello@urbannestglobal.com', company: 'UrbanNest', channel: 'gmail', created_at: '2026-05-29T10:02:00Z' },
  { id: '17', contact_name: 'me, melony', email: 'melony@example.com', company: null, channel: 'gmail', created_at: '2026-05-29T08:53:00Z' },
  { id: '18', contact_name: 'CapitalEdge Investments', email: 'reports@capitaledgefinance.com', company: 'CapitalEdge', channel: 'gmail', created_at: '2026-05-29T08:37:00Z' },
  { id: '19', contact_name: 'Dubai Property Connect', email: 'noreply@dubaipropertyconnect.ae', company: 'Dubai Property Connect', channel: 'gmail', created_at: '2026-05-29T08:33:00Z' },
  { id: '20', contact_name: 'FutureSpace Ventures', email: 'careers@futurespaceventures.com', company: 'FutureSpace', channel: 'gmail', created_at: '2026-05-29T08:20:00Z' },
  { id: '21', contact_name: 'Prestige Lease Partners', email: 'clients@prestigelease.fr', company: 'Prestige Lease', channel: 'gmail', created_at: '2026-05-29T08:15:00Z' },
  { id: '22', contact_name: 'SmartSpace Asia', email: 'support@smartspace.hk', company: 'SmartSpace', channel: 'gmail', created_at: '2026-05-29T08:10:00Z' },
  { id: '23', contact_name: 'Prime Tenant Network', email: 'network@primetenant.io', company: 'Prime Tenant', channel: 'gmail', created_at: '2026-05-29T08:05:00Z' },
  { id: '24', contact_name: 'Evelyn Scott', email: 'evelyn@luxstay.us', company: 'LuxStay', channel: 'gmail', created_at: '2026-05-29T08:01:00Z' },
  { id: '25', contact_name: 'Metro Commercial Group', email: 'metro@commercialgroup.com', company: 'Metro Commercial', channel: 'gmail', created_at: '2026-05-29T07:55:00Z' },
  { id: '26', contact_name: 'Vision Workspace', email: 'hello@visionworkspace.co', company: 'Vision Workspace', channel: 'gmail', created_at: '2026-05-29T07:48:00Z' },
  { id: '27', contact_name: 'Royal Tenant Services', email: 'support@royaltenants.uk', company: 'Royal Tenant', channel: 'gmail', created_at: '2026-05-29T07:40:00Z' },
  { id: '28', contact_name: 'Horizon Realty Advisors', email: 'advisors@horizonrealty.ca', company: 'Horizon Realty', channel: 'gmail', created_at: '2026-05-29T07:34:00Z' },
  { id: '29', contact_name: 'CloudNine Properties', email: 'info@cloudnineproperty.com', company: 'CloudNine', channel: 'gmail', created_at: '2026-05-29T07:30:00Z' },
  { id: '30', contact_name: 'TenantCore Solutions', email: 'solutions@tenantcore.io', company: 'TenantCore', channel: 'gmail', created_at: '2026-05-29T07:22:00Z' },
  { id: '31', contact_name: 'Andreas Muller', email: 'andreas@berlinrentals.de', company: 'Berlin Rentals', channel: 'gmail', created_at: '2026-05-29T07:18:00Z' },
  { id: '32', contact_name: 'Nova Housing Group', email: 'connect@novahousing.sg', company: 'Nova Housing', channel: 'gmail', created_at: '2026-05-29T07:10:00Z' },
  { id: '33', contact_name: 'Enterprise Tenant Hub', email: 'enterprise@tenanthub.io', company: 'Tenant Hub', channel: 'gmail', created_at: '2026-05-29T07:02:00Z' },
  { id: '34', contact_name: 'Infinity Workspaces', email: 'sales@infinityworkspace.ae', company: 'Infinity Workspace', channel: 'gmail', created_at: '2026-05-29T06:55:00Z' },
  { id: '35', contact_name: 'OliveTree Living', email: 'team@olivetreeliving.com', company: 'OliveTree', channel: 'gmail', created_at: '2026-05-29T06:48:00Z' },
  { id: '36', contact_name: 'TenantFlow CRM', email: 'crm@tenantflow.io', company: 'TenantFlow', channel: 'gmail', created_at: '2026-05-29T06:40:00Z' },
  { id: '37', contact_name: 'Prime Urban Estates', email: 'urban@primeestates.au', company: 'Prime Urban', channel: 'gmail', created_at: '2026-05-29T06:34:00Z' },
  { id: '38', contact_name: 'Lucas Bennett', email: 'lucas@leasepoint.nz', company: 'LeasePoint', channel: 'gmail', created_at: '2026-05-29T06:28:00Z' },
  { id: '39', contact_name: 'CityScape Leasing', email: 'leasing@cityscape.qa', company: 'CityScape', channel: 'gmail', created_at: '2026-05-29T06:20:00Z' },
  { id: '40', contact_name: 'Vertex Property Leads', email: 'alerts@vertexproperty.io', company: 'Vertex Property', channel: 'gmail', created_at: '2026-05-29T06:15:00Z' },
  { id: '41', contact_name: 'TenantFirst Solutions', email: 'care@tenantfirst.co', company: 'TenantFirst', channel: 'gmail', created_at: '2026-05-29T06:10:00Z' },
  { id: '42', contact_name: 'Smart Lease Europe', email: 'support@smartlease.eu', company: 'Smart Lease', channel: 'gmail', created_at: '2026-05-29T06:05:00Z' },
  { id: '43', contact_name: 'Elite Relocation Services', email: 'relocation@eliteservices.jp', company: 'Elite Relocation', channel: 'gmail', created_at: '2026-05-29T05:58:00Z' },
  { id: '44', contact_name: 'NextGen Commercial', email: 'team@nextgencommercial.com', company: 'NextGen Commercial', channel: 'gmail', created_at: '2026-05-29T05:50:00Z' },
  { id: '45', contact_name: 'Arthur Collins', email: 'arthur@globaltenant.ca', company: 'Global Tenant', channel: 'gmail', created_at: '2026-05-29T05:45:00Z' },
  { id: '46', contact_name: 'Dynamic Housing Ltd', email: 'info@dynamichousing.co.uk', company: 'Dynamic Housing', channel: 'gmail', created_at: '2026-05-29T05:38:00Z' },
  { id: '47', contact_name: 'BluePeak Offices', email: 'offices@bluepeak.sg', company: 'BluePeak', channel: 'gmail', created_at: '2026-05-29T05:32:00Z' },
  { id: '48', contact_name: 'TenantLink Partners', email: 'partners@tenantlink.io', company: 'TenantLink', channel: 'gmail', created_at: '2026-05-29T05:25:00Z' },
  { id: '49', contact_name: 'Northern Star Realty', email: 'northstar@realty.se', company: 'Northern Star', channel: 'gmail', created_at: '2026-05-29T05:18:00Z' },
  { id: '50', contact_name: 'UrbanAxis Properties', email: 'urbanaxis@propertyhub.com', company: 'UrbanAxis', channel: 'gmail', created_at: '2026-05-29T05:12:00Z' },
  { id: '51', contact_name: 'TenantVision Global', email: 'vision@tenantvision.com', company: 'TenantVision', channel: 'gmail', created_at: '2026-05-29T05:08:00Z' },
  { id: '52', contact_name: 'PrimeSpace Leasing', email: 'leasing@primespace.ae', company: 'PrimeSpace', channel: 'gmail', created_at: '2026-05-29T05:00:00Z' },
  { id: '53', contact_name: 'WestBridge Housing', email: 'hello@westbridgehousing.us', company: 'WestBridge', channel: 'gmail', created_at: '2026-05-29T04:54:00Z' },
  { id: '54', contact_name: 'TenantPro Solutions', email: 'support@tenantpro.io', company: 'TenantPro', channel: 'gmail', created_at: '2026-05-29T04:48:00Z' },
  { id: '55', contact_name: 'Leo Martinez', email: 'leo@smartliving.mx', company: 'SmartLiving', channel: 'gmail', created_at: '2026-05-29T04:40:00Z' },
  { id: '56', contact_name: 'Galaxy Commercial Hub', email: 'hub@galaxycommercial.com', company: 'Galaxy Commercial', channel: 'gmail', created_at: '2026-05-29T04:35:00Z' },
  { id: '57', contact_name: 'PropertySphere Network', email: 'network@propertysphere.io', company: 'PropertySphere', channel: 'gmail', created_at: '2026-05-29T04:28:00Z' },
  { id: '58', contact_name: 'TenantEdge Systems', email: 'systems@tenantedge.io', company: 'TenantEdge', channel: 'gmail', created_at: '2026-05-29T04:22:00Z' },
  { id: '59', contact_name: 'UrbanVista Holdings', email: 'urbanvista@holdings.com', company: 'UrbanVista', channel: 'gmail', created_at: '2026-05-29T04:16:00Z' },
  { id: '60', contact_name: 'Global Prime Rentals', email: 'rentals@globalprime.co', company: 'Global Prime', channel: 'gmail', created_at: '2026-05-29T04:10:00Z' },
];

const MOCK_GROUPS: EmailGroup[] = [
  { id: 'g1', name: 'International Clients', color: '#EA4335', description: null, channel: 'gmail', member_count: 58 },
  { id: 'g2', name: 'Property Leads', color: '#4285F4', description: null, channel: 'gmail', member_count: 134 },
  { id: 'g3', name: 'Premium Tenants', color: '#34A853', description: null, channel: 'gmail', member_count: 21 },
];

const MOCK_LABELS: EmailLabels[] = [
  { id: 'l1', name: 'Notes', color: '#EA4335', description: null, channel: 'gmail' },
  { id: 'l2', name: 'Boss', color: '#4285F4', description: null, channel: 'gmail' },
  { id: 'l3', name: 'Top', color: '#34A853', description: null, channel: 'gmail' },
];

const MOCK_EMAIL_DETAILS: Record<string, {
  subject: string; snippet: string; date: string;
  unread: boolean; category: CategoryTab; labels?: string[];
}> = {
  '1': { subject: 'New serviced apartment inquiry from Singapore client', snippet: `Hello Melony,\n\nWe hope you're doing well.\n\nA new enterprise client from Singapore is currently exploring premium serviced apartment options in Central London for a 6-month corporate relocation project beginning July 2026.\n\nThe client is specifically looking for:\n• Fully furnished executive apartments\n• Flexible lease agreements\n• Concierge & housekeeping support\n• Walking distance to Canary Wharf stations\n\nPlease share:\n- Current availability\n- Monthly pricing\n- Corporate package inclusions\n\nOur relocation team would appreciate a response within the next 24 hours so we can proceed with shortlisting.\n\nWarm regards,\nDaniel Foster\nCorporate Relocation Manager\nGlobalStay Residences`, date: '1:05 PM', unread: true, category: 'primary' },
  '2': { subject: 'Your Dubai coworking space proposal has been approved', snippet: `Dear Melony,\n\nThank you for submitting your proposal for premium coworking leasing services across our Downtown Dubai locations.\n\nAfter internal review, we are pleased to inform you that your commercial pricing proposal has been approved for Phase 1 onboarding.\n\nYour services will now be included in our preferred partner network covering:\n• DIFC\n• Business Bay\n• Dubai Marina\n\nOur onboarding coordinator will contact you shortly regarding contract execution and inventory synchronization.\n\nBest regards,\nAhmed Al Fahim\nPartnerships Team\nElite Workspace Dubai`, date: '12:50 PM', unread: false, category: 'updates', labels: ['Updates'] },
  '3': { subject: '3 new commercial property leads assigned to you', snippet: `Hi Melony,\n\nSkyline Realty has assigned three new high-priority commercial leasing opportunities matching your international tenant services portfolio.\n\nLead locations include:\n• Manchester — Hybrid office space for fintech startup\n• Birmingham — Managed workspace for legal consultancy\n• Leeds — Serviced office requirement for 40 employees\n\nPlease review the attached client briefs and submit availability updates before tomorrow noon.\n\nRegards,\nOliver Thompson\nEnterprise Leasing Desk\nSkyline Realty Group`, date: '12:30 PM', unread: true, category: 'primary' },
  '4': { subject: 'Client requested revised tenant onboarding agreement', snippet: `Hello Melony,\n\nMaria Gonzalez from UrbanLease Mexico has reviewed the onboarding agreement shared for the upcoming Mexico City relocation project.\n\nThe client has requested revisions related to:\n• Security deposit structure\n• Lease termination flexibility\n• Utility billing terms\n• Relocation assistance clauses\n\nPlease update the agreement and resend the revised copy by EOD Thursday.\n\nThank you,\nMaria Gonzalez`, date: '12:28 PM', unread: false, category: 'primary' },
  '5': { subject: 'Monthly property maintenance report available', snippet: `Dear Property Partner,\n\nThe monthly facility inspection and maintenance report for your managed housing portfolio is now available in the BlueWave dashboard.\n\nHighlights this month:\n• 97% maintenance resolution rate\n• HVAC servicing completed across all units\n• Security inspection passed for all managed residences\n• 4 pending plumbing escalations in Sydney region`, date: '12:20 PM', unread: false, category: 'updates', labels: ['Updates'] },
  '6': { subject: 'New tenant lead from Toronto business district', snippet: `Hi Melony,\n\nA funded SaaS startup based in Toronto has submitted a request for premium furnished office accommodation for their executive leadership team.\n\nRequirements include:\n• Downtown Toronto location\n• 12-month lease\n• Meeting room access\n• Private executive cabins`, date: '11:48 AM', unread: true, category: 'primary' },
  '7': { subject: 'Prime Commercial Spaces partnership invitation', snippet: `Dear Melony,\n\nPrime Commercial Spaces Singapore would like to explore regional collaboration opportunities for enterprise office leasing and relocation support services.`, date: '11:44 AM', unread: false, category: 'social', labels: ['Social'] },
  '8': { subject: 'European rental demand insights – Q2 2026', snippet: `Hello Melony,\n\nRentFlow Europe has published its Q2 2026 enterprise rental demand report covering commercial leasing and executive housing trends across Europe.`, date: '11:09 AM', unread: false, category: 'updates', labels: ['Updates'] },
  '9': { subject: 'Facility management contract renewal reminder', snippet: `Dear Melony,\n\nThis is a reminder that your Sydney corporate housing facility management agreement is scheduled for renewal next month.`, date: '10:52 AM', unread: false, category: 'primary' },
  '10': { subject: 'Nordic Living Group sent new luxury housing leads', snippet: `Hello Melony,\n\nFive new executive housing inquiries have been added to your international tenant pipeline for review.`, date: '10:42 AM', unread: false, category: 'primary' },
  '11': { subject: 'Tokyo Smart Rentals onboarding completed', snippet: `Dear Melony,\n\nCongratulations! Your agency onboarding has been successfully completed for the Tokyo Smart Rentals enterprise partner network.`, date: '10:30 AM', unread: false, category: 'updates', labels: ['Updates'] },
  '12': { subject: 'Weekly CRM performance summary', snippet: `Hello Melony,\n\nYour weekly LeadSphere CRM analytics summary is now available.\n\nPerformance overview:\n• 24% increase in qualified tenant leads\n• 18 new enterprise conversations initiated`, date: '10:25 AM', unread: false, category: 'updates', labels: ['Updates'] },
  '13': { subject: 'New Zealand tenant relocation inquiry', snippet: `Hello Melony,\n\nOlivia Brown from TenantConnect New Zealand is assisting an international technology company relocating employees to Auckland during Q3 2026.`, date: '10:17 AM', unread: true, category: 'primary' },
  '14': { subject: 'Berlin Office Hub shared updated pricing catalog', snippet: `Dear Melony,\n\nThe updated 2026 pricing catalog for premium serviced office spaces across Berlin is now available for partner review.`, date: '10:16 AM', unread: false, category: 'promotions', labels: ['Promotions'] },
  '15': { subject: '12 premium housing leads matched with your services', snippet: `Hello Melony,\n\nPacific Housing has matched 12 new enterprise tenant requests based on your managed housing and relocation portfolio.`, date: '10:08 AM', unread: false, category: 'primary' },
  '16': { subject: 'UrbanNest monthly growth newsletter', snippet: `Hi Melony,\n\nWelcome to the May 2026 UrbanNest Growth Digest.`, date: '10:02 AM', unread: false, category: 'promotions', labels: ['Promotions'] },
  '17': { subject: 'Draft proposal for enterprise tenant services', snippet: `Dear Melony,\n\nPlease find attached the revised proposal document for enterprise tenant management and relocation support services.`, date: '8:53 AM', unread: false, category: 'primary' },
  '18': { subject: 'International investment portfolio statement', snippet: `Dear Investor Partner,\n\nCapitalEdge Investments has generated your Q2 2026 international real estate portfolio statement.`, date: '8:37 AM', unread: false, category: 'updates', labels: ['Updates'] },
  '19': { subject: 'Dubai Property Connect generated new investor leads', snippet: `Hello Melony,\n\nThree verified investors from Abu Dhabi and Dubai have expressed interest in premium rental partnership opportunities.`, date: '8:33 AM', unread: false, category: 'primary' },
  '20': { subject: 'Invitation to Global Property & Tenant Expo 2026', snippet: `Dear Melony,\n\nYou are officially invited to attend the International Property & Tenant Solutions Expo 2026 taking place in Singapore this September.`, date: '8:20 AM', unread: false, category: 'primary' },
  '21': { subject: 'Priority corporate housing inquiry for Canary Wharf executives', snippet: `Hello Melony,\n\nWe have received an urgent relocation request for 14 senior consultants moving to London during July 2026.`, date: '8:15 AM', unread: true, category: 'primary' },
  '22': { subject: 'Workspace partnership proposal for Hong Kong expansion', snippet: `Dear Melony,\n\nSmartSpace Asia is expanding its serviced office footprint across Hong Kong and Singapore.`, date: '8:10 AM', unread: false, category: 'updates', labels: ['Updates'] },
  '23': { subject: '5 enterprise tenant leads matched with your listing profile', snippet: `Good morning Melony,\n\nOur Prime Tenant Network platform has identified five high-intent enterprise clients searching for managed housing solutions.`, date: '8:05 AM', unread: true, category: 'primary' },
  '24': { subject: 'Luxury residence viewing confirmed for Manhattan client', snippet: `Hi Melony,\n\nThe client from LuxStay Corporate Housing has officially confirmed tomorrow's virtual property viewing session.`, date: '8:01 AM', unread: false, category: 'primary' },
  '25': { subject: 'Commercial leasing agreement awaiting final approval', snippet: `Dear Melony,\n\nThe legal review for the Singapore business center leasing agreement has now been completed successfully.`, date: '7:55 AM', unread: false, category: 'updates', labels: ['Updates'] },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) h['Authorization'] = `Bearer ${token}`;
    const tenant = typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null;
    if (tenant && tenant !== 'default') h['X-Tenant-ID'] = tenant;
  } catch { /* ignore */ }
  return h;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarGradient(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_GRADIENTS[n % AVATAR_GRADIENTS.length];
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

function getEmailDetails(contact: EmailContact) {
  return MOCK_EMAIL_DETAILS[contact.id] || {
    subject: `Email from ${contact.contact_name}`,
    snippet: `Message from ${contact.email || 'unknown'}...`,
    date: new Date(contact.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unread: false,
    category: 'primary' as CategoryTab,
  };
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, id, size = 'md' }: { name?: string | null; id: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';
  return (
    <div className={cn('rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold flex-shrink-0', sz, avatarGradient(id))}>
      {getInitials(name)}
    </div>
  );
}

// ── EmailMessage type ─────────────────────────────────────────────────────────

interface EmailMessage {
  id: string; contact_id: string; direction: 'outbound' | 'inbound';
  provider: string; subject: string; body_html: string | null;
  preview_text: string | null; status: string; sent_at: string;
}

// ── TBtn ──────────────────────────────────────────────────────────────────────

function TBtn({ icon: Icon, label, onClick, active }: { icon: React.ElementType; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button" title={label} aria-label={label} onClick={onClick}
      className={cn('h-8 w-8 flex items-center justify-center rounded-full transition-colors',
        active ? 'bg-[#c2dbff] text-[#001D35]' : 'text-[#444746] hover:bg-[#f1f3f4]')}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ── Floating Compose Window ───────────────────────────────────────────────────
// Matches Gmail's floating compose: dark header, white body, full toolbar

interface ComposeWindowProps {
  provider: EmailProvider;
  contacts: EmailContact[];
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  onClose: () => void;
  onSent?: () => void;
  /** If true, renders minimized as a taskbar tab */
  minimized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
}

function ComposeWindow({
  provider, contacts, initialTo = '', initialSubject = '', initialBody = '',
  onClose, onSent, minimized = false, onMinimize, onMaximize, maximized = false,
}: ComposeWindowProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const providerColor = PROVIDER_COLOR[provider];

  const suggestedContacts = useMemo(() => {
    if (!to.trim()) return [];
    const t = to.toLowerCase();
    return contacts.filter(c =>
      (c.contact_name || '').toLowerCase().includes(t) || (c.email || '').toLowerCase().includes(t)
    ).slice(0, 5);
  }, [contacts, to]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Recipient, subject, and body are required.'); return;
    }
    setSending(true); setError('');
    try {
      const res = await fetch(`${API}/send-bulk`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ provider: toBackendProvider(provider), recipients: [{ email: to.trim() }], subject: subject.trim(), body_html: body.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch { /* mock success */ }
    setSent(true);
    onSent?.();
    setTimeout(() => { setSent(false); onClose(); }, 1500);
    setSending(false);
  };

  // Minimized — just the header tab
  if (minimized) {
    return (
      <div
        className="w-[216px] h-10 bg-[#404040] text-white rounded-t-xl flex items-center justify-between px-4 cursor-pointer hover:bg-[#3a3a3a] transition-colors shadow-lg"
        onClick={onMaximize}
      >
        <span className="text-sm font-medium truncate">{subject.trim() || 'New Message'}</span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button title="Restore" aria-label="Restore compose window" onClick={onMaximize} className="h-5 w-5 flex items-center justify-center hover:bg-white/20 rounded">
            <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true"><path d="M4 15H2v7h9v-2H4v-5zM2 9h2V4h5V2H2v7zm15 11h-5v2h7v-7h-2v5zM15 2v2h5v5h2V2h-7z" fill="currentColor" /></svg>
          </button>
          <button title="Close" aria-label="Close compose window" onClick={onClose} className="h-5 w-5 flex items-center justify-center hover:bg-white/20 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white border border-[#e0e0e0] rounded-t-xl flex flex-col overflow-hidden',
        'shadow-[0_8px_10px_1px_rgba(60,64,67,.15),0_3px_14px_2px_rgba(60,64,67,.12),0_5px_5px_-3px_rgba(60,64,67,.2)]',
        maximized
          ? 'fixed inset-2 sm:inset-4 z-50 rounded-xl'
          : 'fixed bottom-0 right-0 z-50 w-full sm:right-[72px] sm:w-[500px] max-h-[560px]',
      )}
      role="dialog"
      aria-label="Compose new email"
      aria-modal="true"
    >
      {/* ── Header ── */}
      <div className="h-10 px-4 bg-[#404040] text-white flex items-center justify-between flex-shrink-0 rounded-t-xl select-none">
        <span className="text-sm font-medium">New Message</span>
        <div className="flex items-center gap-0.5">
          <button
            title="Minimize"
            aria-label="Minimize compose window"
            onClick={onMinimize}
            className="h-7 w-7 flex items-center justify-center hover:bg-white/20 rounded transition-colors"
          >
            <span className="text-white text-base leading-none pb-1" aria-hidden="true">—</span>
          </button>
          <button
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore compose window' : 'Maximize compose window'}
            onClick={onMaximize}
            className="h-7 w-7 flex items-center justify-center hover:bg-white/20 rounded transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              {maximized
                ? <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor" />
                : <path d="M4 4h7V2H2v9h2V4zm9 14h7v-7h-2v5h-5v2zM20 2h-7v2h5v5h2V2zM4 15H2v7h9v-2H4v-5z" fill="currentColor" />}
            </svg>
          </button>
          <button
            title="Close"
            aria-label="Close compose window"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center hover:bg-white/20 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Fields ── */}
      <div className="flex-1 flex flex-col overflow-y-auto text-sm min-h-0">

        {/* To */}
        <div className="relative border-b border-[#e0e0e0]">
          <div className="flex items-center px-4 h-10">
            <label htmlFor="compose-to" className="text-[#5f6368] w-16 flex-shrink-0 text-sm">To</label>
            <input
              id="compose-to"
              type="text"
              value={to}
              onChange={e => { setTo(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              aria-label="Recipients"
              placeholder=""
              className="flex-1 focus:outline-none text-sm text-[#202124]"
            />
            <div className="flex items-center gap-3 text-sm text-[#5f6368] flex-shrink-0">
              <button title="Add Cc recipients" aria-label="Add Cc" className="hover:text-[#202124]">Cc</button>
              <button title="Add Bcc recipients" aria-label="Add Bcc" className="hover:text-[#202124]">Bcc</button>
            </div>
          </div>
          {showSuggestions && suggestedContacts.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 bg-white border border-[#dadce0] shadow-lg z-50 overflow-hidden"
              role="listbox"
              aria-label="Suggested contacts"
            >
              {suggestedContacts.map(c => (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={false}
                  onMouseDown={() => { setTo(c.email || ''); setShowSuggestions(false); }}
                  className="w-full text-left px-4 py-2 hover:bg-[#f6f8fc] flex items-center gap-3 text-sm"
                >
                  <Avatar name={c.contact_name} id={c.id} size="sm" />
                  <div>
                    <p className="font-medium text-[#202124]">{c.contact_name}</p>
                    <p className="text-xs text-[#5f6368]">{c.email}</p>
                  </div>
                  {c.company && <span className="ml-auto text-xs text-[#5f6368] bg-[#f1f3f4] px-2 py-0.5 rounded">{c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="border-b border-[#e0e0e0]">
          <div className="flex items-center px-4 h-10">
            <label htmlFor="compose-subject" className="sr-only">Subject</label>
            <input
              id="compose-subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              aria-label="Email subject"
              className="flex-1 focus:outline-none text-sm text-[#202124] placeholder:text-[#5f6368]"
            />
          </div>
        </div>

        {/* Body */}
        <div className={cn('flex-1 flex flex-col px-4 py-3 relative', maximized ? 'min-h-[400px]' : 'min-h-[200px]')}>
          <label htmlFor="compose-body" className="sr-only">Email body</label>
          <textarea
            id="compose-body"
            ref={bodyRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Body Text"
            aria-label="Email body"
            className="w-full flex-1 bg-transparent resize-none focus:outline-none text-sm text-[#202124] placeholder:text-[#5f6368]/60"
            style={{ minHeight: maximized ? '400px' : '200px' }}
          />
          {showTemplate && (
            <InlineTemplatePicker
              onSelect={t => { setSubject(t.subject); setBody(t.body_html ?? t.body ?? ''); setShowTemplate(false); }}
              onClose={() => setShowTemplate(false)}
            />
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-1 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2" role="alert">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Formatting toolbar (like Gmail) ── */}
      <div className="px-4 py-1 border-t border-[#e0e0e0]/60 flex items-center gap-0.5 flex-wrap">
        {[
          { icon: Undo, label: 'Undo' },
          { icon: Redo, label: 'Redo' },
        ].map(({ icon: Icon, label }) => (
          <button key={label} type="button" title={label} aria-label={label}
            className="h-7 w-7 flex items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] transition-colors">
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="w-px h-4 bg-[#e0e0e0] mx-1" aria-hidden="true" />
        {/* Font family dropdown mock */}
        <button type="button" title="Font" aria-label="Change font"
          className="h-7 px-2 flex items-center gap-1 rounded text-[#5f6368] text-xs hover:bg-[#f1f3f4] transition-colors">
          Sans Serif <ChevronDown className="h-3 w-3" />
        </button>
        {/* Font size mock */}
        <button type="button" title="Font size" aria-label="Change font size"
          className="h-7 px-1 flex items-center gap-0.5 rounded text-[#5f6368] hover:bg-[#f1f3f4]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true"><path d="M2 4v3h5v12h3V7h5V4H2zm19 5h-9v3h3v7h3v-7h3V9z" fill="currentColor" /></svg>
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="w-px h-4 bg-[#e0e0e0] mx-1" aria-hidden="true" />
        {[
          { icon: Bold, label: 'Bold' },
          { icon: Italic, label: 'Italic' },
          { icon: Link2, label: 'Link' },
          { icon: AlignLeft, label: 'Align' },
          { icon: List, label: 'Numbered list' },
          { icon: List, label: 'Bullet list' },
          { icon: Indent, label: 'Indent' },
        ].map(({ icon: Icon, label }) => (
          <button key={label} type="button" title={label} aria-label={label}
            className="h-7 w-7 flex items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] transition-colors">
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <button type="button" title="More formatting options" aria-label="More formatting options"
          className="h-7 w-7 flex items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="h-14 px-4 border-t border-[#e0e0e0] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Send button (Gmail blue pill + dropdown arrow) */}
          <div className="flex items-center">
            <button
              onClick={handleSend}
              disabled={sending || sent}
              aria-label={sent ? 'Email sent' : sending ? 'Sending email' : 'Send email'}
              className="h-9 px-5 rounded-l-full text-white text-sm font-medium transition-all disabled:opacity-60 flex items-center gap-1.5"
              style={{ backgroundColor: sent ? '#188038' : '#0b57d0' }}
            >
              {sent
                ? <><Check className="h-4 w-4" /> Sent</>
                : sending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  : 'Send'}
            </button>
            <button
              title="More send options"
              aria-label="More send options"
              className="h-9 w-8 rounded-r-full flex items-center justify-center border-l border-white/20 text-white transition-all"
              style={{ backgroundColor: sent ? '#188038' : '#0b57d0' }}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Toolbar icons */}
          <div className="flex items-center gap-0.5">
            {/* AI/Gemini icon */}
            <button type="button" title="Help me write" aria-label="Help me write with AI"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="#4285F4" />
              </svg>
            </button>
            {/* Font color */}
            <button type="button" title="Font color" aria-label="Font color"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3H18.5L13 3h-2zm-1.38 9L12 6.67 14.38 12H9.62z" fill="currentColor" />
                <rect x="5" y="19" width="14" height="2" fill="#EA4335" />
              </svg>
            </button>
            <TBtn icon={Paperclip} label="Attach file" onClick={() => fileRef.current?.click()} />
            <input ref={fileRef} type="file" multiple className="hidden" aria-label="Attach files"
              onChange={e => setAttachments(p => [...p, ...Array.from(e.target.files || [])])} />
            <TBtn icon={Link2} label="Insert link" onClick={() => { }} />
            <TBtn icon={Smile} label="Insert emoji" onClick={() => { }} />
            {/* Drive */}
            <button type="button" title="Insert from Drive" aria-label="Insert from Drive"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M7.71 3.5L1.15 15l3.43 5.5h15.42L23.46 15 16.9 3.5H7.71zm.57 1h8.44L22.1 15l-2.75 4.5H5.15L2.4 15l5.88-10.5z" fill="#34A853" />
              </svg>
            </button>
            <TBtn icon={ImageIcon} label="Insert photo" onClick={() => { }} />
            {/* Lock */}
            <button type="button" title="Toggle confidential mode" aria-label="Toggle confidential mode"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor" />
              </svg>
            </button>
            {/* Signature */}
            <button type="button" title="Insert signature" aria-label="Insert signature"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
              </svg>
            </button>
            <button type="button" title="More options" aria-label="More options"
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {attachments.length > 0 && (
            <span className="text-xs text-[#5f6368] flex items-center gap-1" aria-label={`${attachments.length} files attached`}>
              <Paperclip className="h-3 w-3" />{attachments.length}
            </span>
          )}
          <button
            title="Discard draft"
            aria-label="Discard this draft"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#d93025] transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline Template Picker ────────────────────────────────────────────────────

function InlineTemplatePicker({ onSelect, onClose }: { onSelect: (tpl: EmailTemplate) => void; onClose: () => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${TEMPLATES_API}?isActive=true`, { headers: authHeaders() });
        const data = await res.json();
        setTemplates(data.templates ?? data.data ?? []);
      } catch {
        setTemplates([
          { id: 't1', name: 'Follow Up', subject: 'Following up on our conversation', body: 'Hi {name},\n\nI wanted to follow up on our recent discussion...', body_html: null, category: 'sales' },
          { id: 't2', name: 'Introduction', subject: 'Introduction from {company}', body: "Hi {name},\n\nI'd like to introduce myself and our services...", body_html: null, category: 'cold' },
          { id: 't3', name: 'Meeting Request', subject: 'Quick 15-min call?', body: 'Hi {name},\n\nWould you be available for a quick call this week?', body_html: null, category: 'outreach' },
        ]);
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-[#dadce0] rounded-xl shadow-xl z-30 overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-[#dadce0]">
        <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">Email Templates</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5f6368]" aria-hidden="true" />
          <input autoFocus placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)}
            aria-label="Search templates"
            className="h-8 text-xs pl-8 w-full border border-[#dadce0] rounded-full px-3 focus:outline-none focus:border-[#4285f4]" />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {loading
          ? <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-[#5f6368]" /></div>
          : filtered.length === 0
            ? <div className="text-center py-6 text-xs text-[#5f6368]">{templates.length === 0 ? 'No templates yet' : 'No matches'}</div>
            : filtered.map(tpl => (
              <button key={tpl.id} onClick={() => onSelect(tpl)}
                className="w-full flex items-start gap-3 px-3 py-3 hover:bg-[#f6f8fc] transition-colors text-left border-b border-[#f0f0f0] last:border-0">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-[#202124]">{tpl.name}</p>
                  <p className="text-xs text-[#5f6368] truncate">{tpl.subject}</p>
                </div>
              </button>
            ))}
      </div>
    </div>
  );
}

// ── Add to Group Modal ────────────────────────────────────────────────────────

function AddToGroupModal({ groups, provider, contactIds, onDone, onClose }: {
  groups: EmailGroup[]; provider: EmailProvider; contactIds: string[]; onDone: () => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    try { await fetch(`${API}/groups/${selected}/contacts`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ contact_ids: contactIds }) }); } catch { /* mock */ }
    setDone(true);
    setTimeout(() => onDone(), 1200);
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white border border-[#dadce0] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#dadce0] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-[#202124]">Add to Broadcast Group</h3>
            <p className="text-xs text-[#5f6368] mt-0.5">{contactIds.length} contact{contactIds.length !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} title="Close" aria-label="Close dialog"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[#f1f3f4]">
            <X className="h-4 w-4 text-[#5f6368]" />
          </button>
        </div>
        {done
          ? <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center"><Check className="h-6 w-6 text-green-600" /></div>
            <p className="text-sm font-medium text-[#202124]">Added successfully!</p>
          </div>
          : <>
            <div className="max-h-60 overflow-y-auto p-3 space-y-1">
              {groups.filter(g => g.channel === provider).map(g => (
                <button key={g.id} onClick={() => setSelected(g.id)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                    selected === g.id ? 'border-[#4285f4] bg-[#e8f0fe]' : 'border-[#dadce0] hover:bg-[#f6f8fc]')}>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: g.color }}>{g.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[#202124]">{g.name}</p>
                    <p className="text-xs text-[#5f6368]">{g.member_count} members</p>
                  </div>
                  {selected === g.id && <Check className="h-4 w-4 text-[#4285f4] flex-shrink-0" />}
                </button>
              ))}
              {groups.filter(g => g.channel === provider).length === 0 && <p className="text-xs text-[#5f6368] text-center py-4">No broadcast groups yet</p>}
            </div>
            <div className="px-4 py-3 border-t border-[#dadce0] flex gap-2">
              <button onClick={onClose} className="flex-1 h-9 rounded-full border border-[#dadce0] text-sm text-[#444746] hover:bg-[#f1f3f4]">Cancel</button>
              <button onClick={handleAdd} disabled={!selected || adding}
                className="flex-1 h-9 rounded-full bg-[#0b57d0] text-white text-sm hover:bg-[#0842a0] disabled:opacity-40 flex items-center justify-center gap-1">
                {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add to Group
              </button>
            </div>
          </>}
      </div>
    </div>
  );
}

// ── Contact Details Panel ─────────────────────────────────────────────────────

function ContactDetailsPanel({ contact, provider, groups, onClose, onAddToGroup }: {
  contact: EmailContact; provider: EmailProvider; groups: EmailGroup[]; onClose: () => void; onAddToGroup: () => void;
}) {
  const providerColor = PROVIDER_COLOR[provider];
  const providerLabel = PROVIDER_LABEL[provider];
  const contactGroups = groups.filter(g => g.channel === provider);

  return (
    <div className="absolute sm:relative inset-0 sm:inset-auto z-30 sm:z-auto w-full sm:w-72 flex-shrink-0 flex flex-col border-l border-[#dadce0] bg-white overflow-y-auto">
      <div className="px-4 py-3 border-b border-[#dadce0] flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Contact Details</span>
        <button onClick={onClose} title="Close" aria-label="Close contact details" className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#f1f3f4]">
          <X className="h-3.5 w-3.5 text-[#5f6368]" />
        </button>
      </div>
      <div className="flex flex-col items-center px-4 py-6 border-b border-[#dadce0]">
        <div className={cn('h-16 w-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xl font-bold mb-3', avatarGradient(contact.id))}>
          {getInitials(contact.contact_name)}
        </div>
        <h2 className="font-semibold text-sm text-center text-[#202124]">{contact.contact_name || 'Unknown'}</h2>
        {contact.company && <p className="text-xs text-[#5f6368] mt-0.5 text-center">{contact.company}</p>}
        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: providerColor }}>
          <Mail className="h-3 w-3" aria-hidden="true" />{providerLabel}
        </div>
      </div>
      <div className="px-4 py-4 space-y-3 border-b border-[#dadce0]">
        {[
          { icon: AtSign, label: 'Email', value: contact.email || '—' },
          ...(contact.company ? [{ icon: Building2, label: 'Company', value: contact.company }] : []),
          ...(contact.created_at ? [{ icon: Clock, label: 'Added', value: formatDate(contact.created_at) }] : []),
          { icon: Hash, label: 'Channel', value: providerLabel },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-[#f1f3f4] flex items-center justify-center flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-[#5f6368]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#5f6368]">{label}</p>
              <p className="text-xs font-medium truncate text-[#202124]">{value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-4 border-b border-[#dadce0]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Labels</span>
          <button title="Add label" aria-label="Add label" className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#f1f3f4]"><Plus className="h-3 w-3 text-[#5f6368]" /></button>
        </div>
        <p className="text-xs text-[#5f6368]">No labels assigned</p>
      </div>
      <div className="px-4 py-4 border-b border-[#dadce0]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Broadcast Groups</span>
        </div>
        {contactGroups.length === 0
          ? <p className="text-xs text-[#5f6368]">No groups yet</p>
          : <div className="space-y-1.5">{contactGroups.slice(0, 3).map(g => (
            <div key={g.id} className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: g.color }}>{g.name.charAt(0).toUpperCase()}</div>
              <span className="text-xs truncate text-[#202124]">{g.name}</span>
            </div>))}
          </div>}
        <button onClick={onAddToGroup}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-[#4285f4]/40 text-[#0b57d0] hover:bg-[#e8f0fe] text-xs font-medium transition-colors">
          <Plus className="h-3 w-3" />Add to Group
        </button>
      </div>
      <div className="px-4 py-4">
        <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Metadata</span>
        <div className="mt-2 space-y-1.5">
          {[['Status', 'Active'], ['Channel', providerLabel], ['Owner', '—']].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-[#5f6368]">{label}</span>
              <span className="text-xs font-medium text-[#202124]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Email Compose / Thread Panel ──────────────────────────────────────────────

function EmailComposePanel({ contact, provider, onShowDetails, showDetails, onBack, onSentSuccess }: {
  contact: EmailContact; provider: EmailProvider; onShowDetails: () => void;
  showDetails: boolean; onBack: () => void; onSentSuccess?: (id: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['original']));
  const [showReplyBox, setShowReplyBox] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const providerColor = PROVIDER_COLOR[provider];
  const providerLabel = PROVIDER_LABEL[provider];
  const emailDetails = getEmailDetails(contact);
  const smartReplies = getSmartReplies(emailDetails.subject);

  const loadThread = useCallback(async () => {
    if (!contact.id) return;
    setLoadingThread(true);
    try {
      const res = await fetch(`${API}/messages?contact_id=${contact.id}`, { headers: authHeaders() });
      if (res.ok) { const data = await res.json(); setMessages(Array.isArray(data) ? data : (data.messages ?? [])); }
    } catch { /* empty thread */ }
    finally { setLoadingThread(false); }
  }, [contact.id]);

  useEffect(() => {
    setSubject(''); setBody(''); setError(''); setSent(false);
    setAttachments([]); setMessages([]); setExpandedIds(new Set(['original'])); setShowReplyBox(false);
    loadThread();
  }, [contact.id]); // eslint-disable-line

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages.length]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return; }
    setSending(true); setError('');
    try {
      const res = await fetch(`${API}/send-bulk`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ provider: toBackendProvider(provider), recipients: [{ email: contact.email!, name: contact.contact_name || '', company: contact.company || '' }], subject: subject.trim(), body_html: body.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
    } catch { /* mock */ }
    const optimistic: EmailMessage = { id: `opt-${Date.now()}`, contact_id: contact.id, direction: 'outbound', provider, subject: subject.trim(), body_html: body.trim(), preview_text: body.trim().slice(0, 200), status: 'sent', sent_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setSent(true); onSentSuccess?.(contact.id);
    setTimeout(() => { setSent(false); setSubject(''); setBody(''); setAttachments([]); setShowReplyBox(false); }, 2000);
    setSending(false);
  };

  const handleSmartReply = (text: string) => {
    setSubject(`Re: ${emailDetails.subject}`); setBody(text); setShowReplyBox(true);
    setTimeout(() => bodyRef.current?.focus(), 50);
  };

  const insertVar = (v: string) => {
    const el = bodyRef.current;
    if (!el) { setBody(p => p + v); return; }
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + v + body.slice(e));
    setTimeout(() => { el.selectionStart = s + v.length; el.selectionEnd = s + v.length; el.focus(); }, 0);
  };

  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const fmtDate = (iso: string) => {
    const d = new Date(iso), today = new Date();
    return d.toDateString() === today.toDateString()
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const isExpanded = expandedIds.has('original');

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
      {/* Header — subject as large heading, like Gmail */}
      <div className="px-4 py-3 flex items-start gap-3 border-b border-[#e0e0e0] flex-shrink-0">
        <button onClick={onBack} title="Back to inbox" aria-label="Back to inbox" className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#444746] flex-shrink-0 mt-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-lg sm:text-xl text-[#202124] leading-tight">{emailDetails.subject}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {emailDetails.labels?.map(l => (
              <span key={l} className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: l === 'Social' ? '#34A853' : l === 'Promotions' ? '#34A853' : l === 'Updates' ? '#F9AB00' : '#5f6368' }}>{l}</span>
            ))}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#f1f3f4] text-[#5f6368]">Inbox</span>
            <button title="Remove label" aria-label="Remove inbox label" className="h-5 w-5 flex items-center justify-center rounded hover:bg-[#f1f3f4]"><X className="h-3 w-3 text-[#5f6368]" /></button>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button title="Print" aria-label="Print email" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#444746]"><Printer className="h-4 w-4" /></button>
          <button title="Open in new window" aria-label="Open in new window" className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#444746]"><ExternalLink className="h-4 w-4" /></button>
          <button onClick={loadThread} title="Refresh" aria-label="Refresh thread" className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#444746]">
            <RefreshCw className={cn('h-4 w-4', loadingThread && 'animate-spin')} />
          </button>
          <button onClick={onShowDetails} title={showDetails ? 'Hide details' : 'Show details'} aria-label={showDetails ? 'Hide contact details' : 'Show contact details'}
            className={cn('h-9 w-9 flex items-center justify-center rounded-full transition-colors', showDetails ? 'bg-[#c2dbff] text-[#001D35]' : 'hover:bg-[#f1f3f4] text-[#444746]')}>
            {showDetails ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Scrollable thread area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">

        {/* Gmail-style flat email — no card border, always expanded */}
        <div className="px-4 sm:px-8 py-6">
          {/* Sender row */}
          <div className="flex items-start gap-3">
            <Avatar name={contact.contact_name} id={contact.id} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-[#202124]">{contact.contact_name || 'Unknown'}</span>
                <span className="text-xs text-[#5f6368]">&lt;{contact.email}&gt;</span>
                <span className="text-xs text-[#5f6368] ml-auto whitespace-nowrap flex-shrink-0">{emailDetails.date} (40 minutes ago)</span>
              </div>
              <p className="text-xs text-[#5f6368] mt-0.5">to me ▾</p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button title="Star" aria-label="Star this email" className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]"><Star className="h-4 w-4 text-[#5f6368]" /></button>
              <button title="Reply" aria-label="Reply" onClick={() => { setSubject(`Re: ${emailDetails.subject}`); setShowReplyBox(true); }}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]"><Reply className="h-4 w-4 text-[#5f6368]" /></button>
              <button title="More options" aria-label="More options" className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]"><MoreHorizontal className="h-4 w-4 text-[#5f6368]" /></button>
            </div>
          </div>

          {/* Email body — indented to align with sender name */}
          <div className="mt-5 ml-12 text-sm text-[#202124] leading-relaxed whitespace-pre-wrap">
            {emailDetails.snippet}
          </div>

          {/* Smart reply chips */}
          <div className="flex flex-wrap gap-2 mt-6 ml-12">
            {smartReplies.map(reply => (
              <button key={reply} onClick={() => handleSmartReply(reply)}
                title={`Quick reply: ${reply}`} aria-label={`Quick reply: ${reply}`}
                className="px-4 py-1.5 rounded-full border border-[#c2c2c2] text-sm text-[#0b57d0] hover:bg-[#e8f0fe] hover:border-[#4285f4] transition-colors font-medium">
                {reply}
              </button>
            ))}
          </div>

          {/* Reply / Reply all / Forward */}
          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#e0e0e0]/60">
            <button onClick={() => { setSubject(`Re: ${emailDetails.subject}`); setShowReplyBox(true); }}
              title="Reply" aria-label="Reply to this email"
              className="flex items-center gap-2 px-5 py-2 border border-[#dadce0] rounded-full text-sm text-[#444746] hover:bg-[#f6f8fc] transition-colors">
              <Reply className="h-4 w-4" />Reply
            </button>
            <button onClick={() => { setSubject(`Re: ${emailDetails.subject}`); setShowReplyBox(true); }}
              title="Reply all" aria-label="Reply all"
              className="flex items-center gap-2 px-5 py-2 border border-[#dadce0] rounded-full text-sm text-[#444746] hover:bg-[#f6f8fc] transition-colors">
              <ReplyAll className="h-4 w-4" />Reply all
            </button>
            <button title="Forward" aria-label="Forward"
              className="flex items-center gap-2 px-5 py-2 border border-[#dadce0] rounded-full text-sm text-[#444746] hover:bg-[#f6f8fc] transition-colors">
              <Forward className="h-4 w-4" />Forward
            </button>
          </div>
        </div>

        {/* Thread messages — collapsible cards for sent/received follow-ups */}
        {messages.length > 0 && (
          <div className="flex flex-col gap-3 px-3 sm:px-6 pb-4">
            {messages.map(msg => {
              const isOut = msg.direction === 'outbound';
              const exp = expandedIds.has(msg.id);
              return (
                <div key={msg.id} className={cn('border border-[#e0e0e0] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow', isOut ? 'ml-3 sm:ml-8' : '')}>
                  <button type="button" className="w-full flex items-start gap-4 px-3 sm:px-6 py-4 text-left hover:bg-[#f6f8fc]"
                    onClick={() => toggleExpand(msg.id)} aria-expanded={exp}
                    aria-label={`${isOut ? 'Sent' : 'Received'}: ${msg.subject || '(no subject)'}`}>
                    <span className="h-2 w-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: isOut ? providerColor : '#9ca3af' }} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#202124]">{isOut ? 'You' : (contact.contact_name || contact.email)}</span>
                        {isOut && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: providerColor }}>{providerLabel}</span>}
                        <span className="text-xs text-[#5f6368] ml-auto">{fmtDate(msg.sent_at)}</span>
                      </div>
                      <p className="text-xs font-medium text-[#202124]/80 truncate mt-0.5">{msg.subject || '(no subject)'}</p>
                      {!exp && <p className="text-xs text-[#5f6368] truncate mt-0.5">{msg.preview_text || msg.body_html?.replace(/<[^>]+>/g, '').slice(0, 120) || ''}</p>}
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-[#5f6368] flex-shrink-0 mt-0.5 transition-transform', exp && 'rotate-180')} />
                  </button>
                  {exp && (
                    <div className="px-3 sm:px-6 pb-5 pt-3 border-t border-[#e0e0e0]/60">
                      {msg.body_html ? <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: msg.body_html }} /> : <p className="text-sm text-[#5f6368] italic">No content</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={threadEndRef} className="h-4" />
      </div>

      {/* Inline reply box — pinned above bottom */}
      {showReplyBox && (
        <div className="mx-2 sm:mx-6 mb-2 sm:mb-4 border border-[#e0e0e0] rounded-2xl shadow-[0_1px_3px_rgba(60,64,67,.15)] overflow-hidden flex-shrink-0">
          <div className="px-5 py-2.5 border-b border-[#e0e0e0] flex items-center gap-3 text-sm">
            <span className="text-[#5f6368]">Reply to</span>
            <span className="font-medium text-[#202124]">{contact.contact_name || contact.email}</span>
            <button title="Close reply" aria-label="Close reply composer"
              onClick={() => { setShowReplyBox(false); setSubject(''); setBody(''); setError(''); }}
              className="ml-auto h-6 w-6 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-5 py-2 border-b border-[#e0e0e0]/60">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5f6368] w-14">Subject</span>
              <input className="flex-1 bg-transparent text-sm focus:outline-none text-[#202124] placeholder:text-[#5f6368]/60"
                placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} aria-label="Reply subject" />
            </div>
          </div>
          <div className="px-5 pt-2 pb-1 relative">
            <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)}
              placeholder={`Hi ${contact.contact_name?.split(' ')[0] || '{name}'},\n\nWrite your reply here...`}
              aria-label="Reply body"
              className="w-full h-24 bg-transparent text-sm resize-none focus:outline-none text-[#202124] placeholder:text-[#5f6368]/50" />
            {showTemplate && <InlineTemplatePicker onSelect={t => { setSubject(t.subject); setBody(t.body_html ?? t.body ?? ''); setShowTemplate(false); }} onClose={() => setShowTemplate(false)} />}
          </div>
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {['{name}', '{first_name}', '{company}', '{email}'].map(v => (
              <button key={v} onClick={() => insertVar(v)} aria-label={`Insert variable ${v}`}
                className="px-2 py-0.5 rounded bg-[#f1f3f4] border border-[#dadce0] text-[10px] font-mono text-[#5f6368] hover:text-[#0b57d0] hover:border-[#4285f4]/40 transition-colors">{v}</button>
            ))}
          </div>
          {error && <div className="mx-5 mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert"><AlertCircle className="h-3.5 w-3.5" />{error}</div>}
          <div className="px-4 py-2.5 border-t border-[#e0e0e0]/60 flex items-center gap-2">
            <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim() || !contact.email}
              aria-label={sent ? 'Sent' : sending ? 'Sending' : 'Send reply'}
              className="flex items-center gap-2 h-9 px-5 rounded-full text-white text-sm font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: sent ? '#188038' : providerColor }}>
              {sent ? <><Check className="h-4 w-4" />Sent!</> : sending ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send</>}
            </button>
            <div className="flex items-center gap-0.5">
              <TBtn icon={FileText} label="Insert template" active={showTemplate} onClick={() => setShowTemplate(v => !v)} />
              <TBtn icon={Paperclip} label="Attach file" onClick={() => fileRef.current?.click()} />
              <input ref={fileRef} type="file" multiple className="hidden" onChange={e => setAttachments(p => [...p, ...Array.from(e.target.files || [])])} />
              <TBtn icon={ImageIcon} label="Insert image" onClick={() => { }} />
              <TBtn icon={Smile} label="Insert emoji" onClick={() => { }} />
              <div className="w-px h-4 bg-[#e0e0e0] mx-1" aria-hidden="true" />
              <TBtn icon={Bold} label="Bold" onClick={() => insertVar('**bold**')} />
              <TBtn icon={Italic} label="Italic" onClick={() => insertVar('*italic*')} />
              <TBtn icon={Link2} label="Insert link" onClick={() => insertVar('[text](url)')} />
            </div>
            {attachments.length > 0 && <span className="text-xs text-[#5f6368] flex items-center gap-1 ml-auto"><Paperclip className="h-3 w-3" />{attachments.length}</span>}
            <button title="Discard draft" aria-label="Discard draft"
              className="h-8 w-8 rounded-full hover:bg-[#fce8e6] text-[#5f6368] hover:text-[#d93025] flex items-center justify-center ml-auto transition-colors"
              onClick={() => { setShowReplyBox(false); setSubject(''); setBody(''); setError(''); }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Email Group Window ────────────────────────────────────────────────────────

const EmailGroupWindow = memo(function EmailGroupWindow({ group, provider, onBack, onGroupDeleted }: {
  group: EmailGroup; provider: EmailProvider; onBack: () => void; onGroupDeleted: () => void;
}) {
  const [detail, setDetail] = useState<EmailGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSend, setShowSend] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const providerColor = PROVIDER_COLOR[provider];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/groups/${group.id}`, { headers: authHeaders() });
        const data = await res.json();
        if (data.success) { setDetail(data.data); return; }
      } catch { /* mock */ }
      setDetail({ ...group, members: MOCK_CONTACTS.slice(0, group.member_count || 3) });
      setLoading(false);
    })();
    setLoading(false);
  }, [group.id]); // eslint-disable-line

  const handleRemoveMember = async (contactId: string) => {
    setRemovingId(contactId);
    try { await fetch(`${API}/groups/${group.id}/contacts/${contactId}`, { method: 'DELETE', headers: authHeaders() }); } catch { /* mock */ }
    setRemovedIds(p => new Set([...p, contactId]));
    setRemovingId(null);
  };

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try { await fetch(`${API}/groups/${group.id}`, { method: 'DELETE', headers: authHeaders() }); } catch { /* mock */ }
    setDeleting(false); setShowDeleteConfirm(false); onGroupDeleted();
  };

  const visibleMembers = (detail?.members || []).filter(m =>
    !removedIds.has(m.id) && (!search || (m.contact_name || '').toLowerCase().includes(search.toLowerCase()) || (m.email || '').toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      <div className="h-14 px-4 flex items-center gap-3 border-b border-[#e0e0e0] flex-shrink-0">
        <button onClick={onBack} title="Back" aria-label="Back to email list" className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]">
          <ArrowLeft className="h-5 w-5 text-[#444746]" />
        </button>
        <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: group.color }}>{group.name.charAt(0).toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-[#202124]">{group.name}</h3>
          <p className="text-xs text-[#5f6368]">{PROVIDER_LABEL[provider]} broadcast · {detail?.member_count ?? group.member_count} members</p>
        </div>
        <button onClick={() => setShowSend(true)} disabled={!detail || (detail?.member_count ?? 0) === 0}
          title="Send email to group" aria-label="Send email to this group"
          className="flex items-center gap-2 h-9 px-3 sm:px-4 rounded-full text-white text-sm font-medium disabled:opacity-40" style={{ backgroundColor: providerColor }}>
          <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Send Email</span>
        </button>
        <button onClick={() => setShowImport(true)} title="Add members" aria-label="Add members"
          className="flex items-center gap-2 h-9 px-3 sm:px-4 rounded-full border border-[#dadce0] text-sm text-[#444746] hover:bg-[#f6f8fc]">
          <UserPlus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Add Members</span>
        </button>
      </div>
      {loading
        ? <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#5f6368]" /></div>
        : <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Members', value: detail?.member_count ?? 0, bg: 'bg-blue-50', color: 'text-blue-600' },
              { label: 'Channel', value: PROVIDER_LABEL[provider], bg: 'bg-green-50', color: 'text-green-600' },
              { label: 'Status', value: 'Active', bg: 'bg-emerald-50', color: 'text-emerald-600' },
            ].map(({ label, value, bg, color }) => (
              <div key={label} className="p-3 rounded-xl border border-[#e0e0e0] bg-white">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-2', bg, color)}>
                  {label === 'Members' ? <Users className="h-4 w-4" /> : label === 'Channel' ? <Mail className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </div>
                <p className="text-xs text-[#5f6368]">{label}</p>
                <p className="font-semibold text-sm text-[#202124]">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-[#e0e0e0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e0e0e0] flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#202124]">Members ({visibleMembers.length})</span>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5f6368]" />
                <input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search members"
                  className="h-8 text-xs pl-8 w-full border border-[#dadce0] rounded-full px-3 focus:outline-none focus:border-[#4285f4]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {visibleMembers.length === 0
                ? <div className="flex flex-col items-center justify-center h-40 text-[#5f6368]"><Users className="h-8 w-8 mb-2 opacity-30" /><p className="text-sm">No members yet</p></div>
                : visibleMembers.map(member => (
                  <div key={member.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#f6f8fc] group/member border-b border-[#f0f0f0] last:border-0">
                    <Avatar name={member.contact_name} id={member.id} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-[#202124]">{member.contact_name || 'Unknown'}</p>
                      <p className="text-xs text-[#5f6368] truncate">{member.email}{member.company ? ` · ${member.company}` : ''}</p>
                    </div>
                    <button className="opacity-0 group-hover/member:opacity-100 h-7 w-7 flex items-center justify-center rounded-full hover:bg-red-50 text-red-500"
                      onClick={() => handleRemoveMember(member.id)} disabled={removingId === member.id}
                      title={`Remove ${member.contact_name}`} aria-label={`Remove ${member.contact_name} from group`}>
                      {removingId === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
            </div>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} title="Delete group" aria-label="Delete this group"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 text-sm transition-colors">
            <Trash2 className="h-4 w-4" />Delete group
          </button>
        </div>}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-[#dadce0] rounded-xl shadow-xl p-5 mx-4 w-full max-w-sm">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-[#202124]"><Trash2 className="h-4 w-4 text-red-500" />Delete "{group.name}"?</h3>
            <p className="text-xs text-[#5f6368] mb-4">This group and all its members will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-9 rounded-full border border-[#dadce0] text-sm text-[#444746] hover:bg-[#f1f3f4]">Cancel</button>
              <button onClick={handleDeleteGroup} disabled={deleting} className="flex-1 h-9 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 flex items-center justify-center gap-1">
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showImport && <ImportLeadsDialog open={showImport} onOpenChange={setShowImport} onImportComplete={() => { }} channel={provider} emailGroupId={group.id} />}
      {showSend && detail && <EmailTemplatePicker open={showSend} onOpenChange={setShowSend} group={detail} provider={provider} />}
    </div>
  );
});

// ── Main EmailChannelView ─────────────────────────────────────────────────────

export function EmailChannelView({ provider, connectedEmail, userImage }: EmailChannelViewProps) {
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [labels, setLabels] = useState<EmailLabels[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactSearch, setContactSearch] = useState('');

  const [activeContact, setActiveContact] = useState<EmailContact | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeGroup, setActiveGroup] = useState<EmailGroup | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryTab>('primary');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [importantIds, setImportantIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [showImport, setShowImport] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState('');
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [createLabelError, setCreateLabelError] = useState('');
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Compose window state ──
  // Each window: { id, minimized, maximized, initialTo?, initialSubject?, initialBody? }
  type ComposeInstance = { id: string; minimized: boolean; maximized: boolean; initialTo?: string; initialSubject?: string; initialBody?: string };
  const [composeWindows, setComposeWindows] = useState<ComposeInstance[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const createGroupRef = useRef<HTMLDivElement>(null);

  const openCompose = (opts: { to?: string; subject?: string; body?: string } = {}) => {
    const id = `compose-${Date.now()}`;
    setComposeWindows(prev => [...prev, { id, minimized: false, maximized: false, initialTo: opts.to, initialSubject: opts.subject, initialBody: opts.body }]);
  };
  const closeCompose = (id: string) => setComposeWindows(prev => prev.filter(w => w.id !== id));
  const minimizeCompose = (id: string) => setComposeWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: true, maximized: false } : w));
  const maximizeCompose = (id: string) => setComposeWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: false, maximized: !w.maximized } : w));
  const restoreCompose = (id: string) => setComposeWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: false, maximized: false } : w));

  // Load data
  const loadContacts = useCallback(async (search = '') => {
    setLoadingContacts(true);
    try {
      const qs = new URLSearchParams({ limit: '500', ...(search ? { search } : {}) });
      const res = await fetch(`${API}/contacts?${qs}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.data?.length) { setContacts(data.data); setLoadingContacts(false); return; }
    } catch { /* mock */ }
    const filtered = search ? MOCK_CONTACTS.filter(c =>
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    ) : MOCK_CONTACTS;
    setContacts(filtered);
    setLoadingContacts(false);
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch(`${API}/groups?channel=${provider}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.data?.length) { setGroups(data.data); return; }
    } catch { /* mock */ }
    setGroups(MOCK_GROUPS.filter(g => g.channel === provider));
  }, [provider]);

  const loadLabels = useCallback(async () => {
    try {
      const res = await fetch(`${API}/labels?channel=${provider}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.data?.length) { setLabels(data.data); return; }
    } catch { /* mock */ }
    setLabels(MOCK_LABELS.filter(g => g.channel === provider));
  }, [provider]);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { loadGroups(); }, [loadGroups, groupRefreshKey]);
  useEffect(() => { loadLabels(); }, [loadLabels, groupRefreshKey]);
  useEffect(() => {
    const t = setTimeout(() => loadContacts(contactSearch), 300);
    return () => clearTimeout(t);
  }, [contactSearch, loadContacts]);

  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStarredIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleImportant = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setImportantIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const handleMarkSent = (id: string) => setSentIds(prev => new Set([...prev, id]));
  const handleDeleteContact = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletedIds(prev => new Set([...prev, id]));
    if (activeContact?.id === id) setActiveContact(null);
  };
  const handleToggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelection = () => setSelectedIds(new Set());

  const filteredContacts = useMemo(() => {
    let list = contacts.filter(c => !deletedIds.has(c.id));
    if (activeFolder === 'starred') list = list.filter(c => starredIds.has(c.id));
    else if (activeFolder === 'important') list = list.filter(c => importantIds.has(c.id));
    else if (activeFolder === 'sent') list = list.filter(c => sentIds.has(c.id));
    else if (activeFolder === 'inbox') {
      if (activeCategoryTab === 'social') list = list.filter(c => getEmailDetails(c).category === 'social');
      else if (activeCategoryTab === 'promotions') list = list.filter(c => getEmailDetails(c).category === 'promotions');
      else if (activeCategoryTab === 'updates') list = list.filter(c => getEmailDetails(c).category === 'updates');
      else list = list.filter(c => getEmailDetails(c).category === 'primary');
    }
    return list;
  }, [contacts, deletedIds, activeFolder, activeCategoryTab, starredIds, importantIds, sentIds]);

  const paginatedContacts = useMemo(() => filteredContacts.slice(page * pageSize, (page + 1) * pageSize), [filteredContacts, page]);
  const selectedContacts = useMemo(() => contacts.filter(c => selectedIds.has(c.id)), [contacts, selectedIds]);
  const bulkSendGroup = useMemo((): EmailGroupDetail | null => {
    if (!selectedContacts.length) return null;
    return { id: 'bulk', name: `${selectedContacts.length} contacts`, color: PROVIDER_COLOR[provider], description: null, channel: provider, member_count: selectedContacts.length, members: selectedContacts };
  }, [selectedContacts, provider]);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true); setCreateGroupError('');
    try {
      const res = await fetch(`${API}/groups`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, channel: provider, color: PROVIDER_COLOR[provider] }) });
      const data = await res.json();
      const created = data.data || data.group || (data.success ? { id: `g-${Date.now()}`, name, color: PROVIDER_COLOR[provider], description: null, channel: provider, member_count: 0 } : null);
      if (created) { setGroups(p => [created, ...p]); setNewGroupName(''); setShowCreateGroup(false); setActiveGroup(created); }
      else setCreateGroupError(data.error || 'Failed to create group.');
    } catch {
      const mockCreated = { id: `g-${Date.now()}`, name, color: PROVIDER_COLOR[provider], description: null, channel: provider, member_count: 0 };
      setGroups(p => [mockCreated, ...p]); setNewGroupName(''); setShowCreateGroup(false); setActiveGroup(mockCreated);
    }
    setCreatingGroup(false);
  };

  const handleCreateLabels = async () => {
    const name = newLabelName.trim();
    if (!name) return;
    setCreatingLabel(true); setCreateLabelError('');
    try {
      const res = await fetch(`${API}/labels`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, channel: provider, color: PROVIDER_COLOR[provider] }) });
      const data = await res.json();
      const created = data.data || data.group || (data.success ? { id: `g-${Date.now()}`, name, color: PROVIDER_COLOR[provider], description: null, channel: provider, member_count: 0 } : null);
      if (created) { setLabels(p => [created, ...p]); setNewLabelName(''); setShowCreateGroup(false); setActiveGroup(created); }
      else setCreateLabelError(data.error || 'Failed to create group.');
    } catch {
      const mockCreated = { id: `g-${Date.now()}`, name, color: PROVIDER_COLOR[provider], description: null, channel: provider, member_count: 0 };
      setLabels(p => [mockCreated, ...p]); setNewLabelName(''); setShowCreateGroup(false); setActiveGroup(mockCreated);
    }
    setCreatingLabel(false);
  };

  const providerColor = PROVIDER_COLOR[provider];
  const unreadCount = useMemo(() => contacts.filter(c => !deletedIds.has(c.id) && getEmailDetails(c).unread && getEmailDetails(c).category === 'primary').length, [contacts, deletedIds]);
  const socialCount = useMemo(() => contacts.filter(c => !deletedIds.has(c.id) && getEmailDetails(c).category === 'social').length, [contacts, deletedIds]);
  const promoCount = useMemo(() => contacts.filter(c => !deletedIds.has(c.id) && getEmailDetails(c).category === 'promotions').length, [contacts, deletedIds]);

  const folderNavItems = [
    { id: 'inbox' as FolderType, label: 'Inbox', icon: Inbox, count: unreadCount },
    { id: 'starred' as FolderType, label: 'Starred', icon: Star, count: starredIds.size },
    { id: 'snoozed' as FolderType, label: 'Snoozed', icon: Clock, count: 0 },
    { id: 'important' as FolderType, label: 'Important', icon: Tag, count: importantIds.size },
    { id: 'sent' as FolderType, label: 'Sent', icon: Send, count: sentIds.size },
    { id: 'drafts' as FolderType, label: 'Drafts', icon: FileText, count: 0 },
    { id: 'spam' as FolderType, label: 'Spam', icon: AlertCircle, count: 0 },
    { id: 'trash' as FolderType, label: 'Trash', icon: Trash2, count: 0 },
  ];

  if (activeGroup) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#F6F8FC] overflow-hidden relative">
        <EmailGroupWindow group={activeGroup} provider={provider}
          onBack={() => setActiveGroup(null)}
          onGroupDeleted={() => { setActiveGroup(null); setGroupRefreshKey(k => k + 1); }} />
      </div>
    );
  }

  // Non-minimized windows (show stacked if multiple, but usually just 1)
  const visibleWindows = composeWindows.filter(w => !w.minimized);
  const minimizedWindows = composeWindows.filter(w => w.minimized);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F6F8FC] overflow-hidden relative">

      {/* ── Top Bar ── */}
      <header className="h-[64px] flex-shrink-0 flex items-center gap-2 px-3 bg-[#F6F8FC]">
        <button onClick={() => setSidebarOpen(v => !v)} title="Main menu" aria-label="Open main menu" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] flex-shrink-0">
          <Menu className="h-5 w-5 text-[#444746]" />
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {provider === 'gmail' ? (
            <>
              <svg viewBox="0 0 24 24" className="h-7 w-auto" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6 18V8.4L12 13l6-4.6V18H6z" fill="#EA4335" />
                <path d="M2 6.5A2.5 2.5 0 014.5 4H6v2L2 8.4V6.5z" fill="#C5221F" />
                <path d="M22 6.5A2.5 2.5 0 0019.5 4H18v2l4 2.4V6.5z" fill="#C5221F" />
                <path d="M2 8.4V18a2 2 0 002 2h2V8.4L12 13l6-4.6V20h2a2 2 0 002-2V8.4L12 13 2 8.4z" fill="#4285F4" />
                <path d="M6 4H4.5A2.5 2.5 0 002 6.5V8.4l4-2.4V4z" fill="#FBBC04" />
                <path d="M18 4h1.5A2.5 2.5 0 0122 6.5V8.4l-4-2.4V4z" fill="#34A853" />
              </svg>
              <span className="text-[22px] text-[#5f6368] font-normal tracking-tight hidden sm:inline" style={{ fontFamily: 'Google Sans, Roboto, sans-serif' }}>Gmail</span>
            </>
          ) : (
            <span className="text-base font-semibold" style={{ color: providerColor }}>{PROVIDER_LABEL[provider]}</span>
          )}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-0 max-w-[720px] mx-auto">
          <div className="relative h-[46px] flex items-center bg-[#EAF1FB] hover:bg-[#E0EBF5] focus-within:bg-white focus-within:shadow-[0_1px_3px_rgba(60,64,67,.3)] rounded-full transition-all">
            <Search className="absolute left-4 h-5 w-5 text-[#444746]" aria-hidden="true" />
            <input type="search" placeholder="Search in mail" value={contactSearch} onChange={e => setContactSearch(e.target.value)}
              aria-label="Search in mail"
              className="w-full h-full bg-transparent pl-12 pr-12 text-sm text-[#202124] placeholder:text-[#5f6368] focus:outline-none" />
            <button title="Search options" aria-label="Search options" className="absolute right-3 h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {connectedEmail && (
            <span className="hidden lg:flex items-center gap-1.5 mr-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[#137333] bg-[#e6f4ea]">
              <span className="h-2 w-2 rounded-full bg-[#34a853]" aria-hidden="true" />Active
            </span>
          )}
          <button onClick={() => setShowImport(true)} title="Import leads" aria-label="Import leads" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
            <UserPlus className="h-5 w-5" />
          </button>
          <button title="Settings" aria-label="Open settings" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
            <Settings className="h-5 w-5" />
          </button>
          <button title="Help" aria-label="Open help" className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button title="Google apps" aria-label="Google apps" className="hidden md:flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            title="Profile"
            aria-label="Profile"
            onClick={() => setShowProfileModal(v => !v)}
            className="h-10 w-10 flex items-center justify-center rounded-full overflow-hidden hover:ring-2 hover:ring-[#dadce0] transition-all"
          >
            {userImage ? (
              <img
                src={userImage}
                alt={connectedEmail?.charAt(0)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-[#1a73e8] text-white text-sm font-medium uppercase">
                {connectedEmail?.charAt(0)}
              </div>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 gap-0 px-0 pb-0 relative">

        {/* ── Left Sidebar ── */}
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="md:hidden absolute inset-0 z-30 bg-black/20"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside className={cn(
          'flex flex-col py-2 transition-all duration-200 overflow-hidden bg-[#F6F8FC]',
          // Mobile: fixed overlay drawer; Desktop: static inline
          'absolute inset-y-0 left-0 z-40 md:static md:z-auto md:inset-auto md:flex-shrink-0',
          sidebarOpen
            ? 'w-[255px] pr-3 shadow-xl md:shadow-none'
            : 'w-0 -translate-x-full md:translate-x-0 md:w-[72px] md:pr-0',
        )} aria-label="Mail navigation">

          {/* Compose Button */}
          <div className={cn('pb-4 flex-shrink-0', sidebarOpen ? 'px-3' : 'px-0 flex justify-center')}>
            <button
              onClick={() => openCompose()}
              title="Compose new email"
              aria-label="Compose new email"
              className={cn(
                'h-12 flex items-center rounded-2xl shadow-[0_1px_2px_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] hover:shadow-md transition-all font-medium text-sm',
                sidebarOpen ? 'gap-3 pl-5 pr-8 w-full' : 'justify-center w-12'
              )}
              style={{ backgroundColor: '#C2E7FF', color: '#001D35' }}
            >
              <Pencil className="h-5 w-5" aria-hidden="true" />
              {sidebarOpen && <span>Compose</span>}
            </button>
          </div>

          {/* Scrollable nav area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">

            {/* Folder nav */}
            <nav className="flex flex-col gap-0.5 flex-shrink-0" aria-label="Mail folders">
              {folderNavItems.map(f => {
                const isActive = activeFolder === f.id;
                return (
                  <button key={f.id}
                    onClick={() => { setActiveFolder(f.id); setActiveContact(null); setPage(0); if (f.id === 'inbox') setActiveCategoryTab('primary'); }}
                    aria-label={`${f.label}${f.count > 0 ? `, ${f.count} unread` : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center w-full h-8 rounded-r-full text-sm transition-colors text-left flex-shrink-0',
                      sidebarOpen ? 'justify-between pl-6 pr-4' : 'justify-center',
                      isActive ? 'bg-[#D3E3FD] text-[#001D35] font-semibold' : 'text-[#202124] hover:bg-[#e8eaed] font-normal'
                    )}>
                    <div className={cn('flex items-center min-w-0', sidebarOpen ? 'gap-4' : '')}>
                      <f.icon
                        className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-[#001D35]' : 'text-[#444746]')}
                        style={f.id === 'inbox' && isActive ? { color: '#EA4335' } : {}}
                        aria-hidden="true"
                      />
                      {sidebarOpen && <span className="truncate">{f.label}</span>}
                    </div>
                    {sidebarOpen && f.count > 0 && (
                      <span className={cn('text-xs tabular-nums flex-shrink-0', isActive ? 'font-semibold' : '')} aria-hidden="true">
                        {f.count > 999 ? '999+' : f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Labels */}
            <div className="mt-1 pt-2 border-t border-[#e0e0e0] flex-shrink-0">
              {sidebarOpen ? (
                <>
                  <div className="px-3 py-2 flex items-center justify-between pl-6">
                    <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Labels</span>
                    <button onClick={() => { setCreateLabelError(''); setShowCreateLabel(true); }}
                      title="Create new label" aria-label="Create new label"
                      className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
                      <Plus className="h-4 w-4 text-[#444746]" />
                    </button>
                  </div>
                  {showCreateLabel && (
                    <div ref={createGroupRef} className="px-3 pb-3 space-y-2">
                      <input autoFocus placeholder="Label name..." value={newLabelName}
                        onChange={e => { setNewLabelName(e.target.value); setCreateLabelError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateLabels(); if (e.key === 'Escape') setShowCreateLabel(false); }}
                        aria-label="New label name"
                        className="h-8 text-sm w-full border border-[#dadce0] rounded-full px-3 focus:outline-none focus:border-[#4285f4]" />
                      {createLabelError && <p className="text-[11px] text-red-600 flex items-center gap-1" role="alert"><AlertCircle className="h-3 w-3" />{createGroupError}</p>}
                      <div className="flex gap-1.5">
                        <button onClick={handleCreateLabels} disabled={creatingLabel || !newLabelName.trim()} aria-label="Create label"
                          className="flex-1 h-7 text-xs text-white rounded-full flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: providerColor }}>
                          {creatingLabel && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Create
                        </button>
                        <button onClick={() => { setShowCreateLabel(false); setCreateLabelError(''); }} aria-label="Cancel"
                          className="h-7 text-xs px-3 rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="max-h-44 overflow-y-auto">
                    {labels.length === 0
                      ? <p className="text-xs text-[#5f6368] text-center py-4 px-6">No labels — create one above</p>
                      : labels.map(g => (
                        <button key={g.id} onClick={() => setActiveGroup(g)}
                          aria-label={`Open label: ${g.name}`}
                          className="w-full flex items-center gap-3 pl-6 pr-4 py-1.5 hover:bg-[#e8eaed] transition-colors text-left rounded-r-full">
                          <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} aria-hidden="true" />
                          <span className="flex-1 text-sm text-[#202124] truncate">{g.name}</span>
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 py-1">
                  {labels.map(g => (
                    <button key={g.id} onClick={() => setActiveGroup(g)}
                      title={g.name} aria-label={`Open label: ${g.name}`}
                      className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
                      <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Broadcast Groups */}
            <div className="mt-1 pt-2 border-t border-[#e0e0e0] flex-shrink-0">
              {sidebarOpen ? (
                <>
                  <div className="px-3 py-2 flex items-center justify-between pl-6">
                    <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">Broadcast Groups</span>
                    <button onClick={() => { setCreateGroupError(''); setShowCreateGroup(true); }}
                      title="Create new broadcast group" aria-label="Create new broadcast group"
                      className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
                      <Plus className="h-4 w-4 text-[#444746]" />
                    </button>
                  </div>
                  {showCreateGroup && (
                    <div ref={createGroupRef} className="px-3 pb-3 space-y-2">
                      <input autoFocus placeholder="Group name..." value={newGroupName}
                        onChange={e => { setNewGroupName(e.target.value); setCreateGroupError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowCreateGroup(false); }}
                        aria-label="New group name"
                        className="h-8 text-sm w-full border border-[#dadce0] rounded-full px-3 focus:outline-none focus:border-[#4285f4]" />
                      {createGroupError && <p className="text-[11px] text-red-600 flex items-center gap-1" role="alert"><AlertCircle className="h-3 w-3" />{createGroupError}</p>}
                      <div className="flex gap-1.5">
                        <button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim()} aria-label="Create group"
                          className="flex-1 h-7 text-xs text-white rounded-full flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: providerColor }}>
                          {creatingGroup && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Create
                        </button>
                        <button onClick={() => { setShowCreateGroup(false); setCreateGroupError(''); }} aria-label="Cancel"
                          className="h-7 text-xs px-3 rounded-full hover:bg-[#f1f3f4] text-[#5f6368]">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="max-h-44 overflow-y-auto">
                    {groups.length === 0
                      ? <p className="text-xs text-[#5f6368] text-center py-4 px-6">No groups — create one above</p>
                      : groups.map(g => (
                        <button key={g.id} onClick={() => setActiveGroup(g)}
                          aria-label={`Open group: ${g.name}, ${g.member_count} members`}
                          className="w-full flex items-center gap-3 pl-6 pr-4 py-1.5 hover:bg-[#e8eaed] transition-colors text-left rounded-r-full">
                          <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} aria-hidden="true" />
                          <span className="flex-1 text-sm text-[#202124] truncate">{g.name}</span>
                          <span className="text-[11px] text-[#5f6368]" aria-hidden="true">{g.member_count}</span>
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 py-1">
                  {groups.map(g => (
                    <button key={g.id} onClick={() => setActiveGroup(g)}
                      title={g.name} aria-label={`Open group: ${g.name}`}
                      className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
                      <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>{/* end scrollable area */}

          {/* Meet — pinned to bottom */}
          <div className="mt-auto pt-2 border-t border-[#e0e0e0] flex-shrink-0">
            {sidebarOpen ? (
              <>
                <p className="text-xs font-semibold text-[#202124] pl-6 py-1">Meet</p>
                <button title="New meeting" aria-label="New meeting"
                  className="flex items-center gap-4 w-full pl-6 py-1.5 text-sm text-[#202124] hover:bg-[#e8eaed] rounded-r-full">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" aria-hidden="true"><rect width="24" height="24" fill="none" /><path d="M20 5h-3V3.5a1.5 1.5 0 00-3 0V5h-4V3.5a1.5 1.5 0 00-3 0V5H4C2.9 5 2 5.9 2 7v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z" fill="#34A853" /></svg>
                  New meeting
                </button>
                <button title="Join a meeting" aria-label="Join a meeting"
                  className="flex items-center gap-4 w-full pl-6 py-1.5 text-sm text-[#202124] hover:bg-[#e8eaed] rounded-r-full">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" aria-hidden="true"><rect width="24" height="24" fill="none" /><path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z" fill="#1E88E5" /></svg>
                  Join a meeting
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 py-1">
                <button title="New meeting" aria-label="New meeting"
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect width="24" height="24" fill="none" /><path d="M20 5h-3V3.5a1.5 1.5 0 00-3 0V5h-4V3.5a1.5 1.5 0 00-3 0V5H4C2.9 5 2 5.9 2 7v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z" fill="#34A853" /></svg>
                </button>
                <button title="Join a meeting" aria-label="Join a meeting"
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect width="24" height="24" fill="none" /><path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z" fill="#1E88E5" /></svg>
                </button>
              </div>
            )}
          </div>

        </aside>

        {/* ── Main content ── */}
        <main className={cn('flex-1 flex min-w-0 min-h-0 overflow-hidden bg-white rounded-2xl border border-[#dadce0]/80 shadow-sm mr-2 mb-2',
          activeContact ? 'flex-row' : 'flex-col')} aria-label="Email content">
          {activeContact ? (
            <>
              <EmailComposePanel contact={activeContact} provider={provider} showDetails={showDetails}
                onShowDetails={() => setShowDetails(v => !v)} onBack={() => setActiveContact(null)} onSentSuccess={handleMarkSent} />
              {showDetails && (
                <ContactDetailsPanel contact={activeContact} provider={provider} groups={groups}
                  onClose={() => setShowDetails(false)} onAddToGroup={() => setShowAddToGroup(true)} />
              )}
            </>
          ) : (
            <>
              {/* Toolbar */}
              <div className="h-12 px-3 flex items-center justify-between border-b border-[#e0e0e0] flex-shrink-0" role="toolbar" aria-label="Email list toolbar">
                <div className="flex items-center gap-1">
                  <input type="checkbox"
                    checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedIds.has(c.id))}
                    onChange={() => {
                      const allSel = paginatedContacts.every(c => selectedIds.has(c.id));
                      setSelectedIds(prev => { const n = new Set(prev); allSel ? paginatedContacts.forEach(c => n.delete(c.id)) : paginatedContacts.forEach(c => n.add(c.id)); return n; });
                    }}
                    aria-label="Select all emails"
                    className="rounded border-[#dadce0] text-[#0b57d0] h-4 w-4 cursor-pointer ml-1" />
                  <button onClick={() => { loadContacts(contactSearch); loadGroups(); }} title="Refresh" aria-label="Refresh"
                    className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-1 border-l border-[#dadce0] pl-2 ml-1">
                      <button onClick={() => setShowBulkSend(true)} title="Send" aria-label="Send to selected"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-[#e8eaed] text-xs font-medium text-[#202124]">
                        <Send className="h-3.5 w-3.5" />Send
                      </button>
                      <button onClick={() => setShowAddToGroup(true)} title="Label" aria-label="Add to group"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-[#e8eaed] text-xs font-medium text-[#202124]">
                        <Tag className="h-3.5 w-3.5" />Label
                      </button>
                      <button onClick={() => { setDeletedIds(p => { const n = new Set(p); selectedIds.forEach(id => n.add(id)); return n; }); exitSelection(); }}
                        title="Delete selected" aria-label="Delete selected"
                        className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#fce8e6] text-[#444746] hover:text-[#d93025]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setActiveFolder('starred'); selectedIds.forEach(id => toggleStar(id)); exitSelection(); }}
                        title="Star selected" aria-label="Star selected"
                        className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
                        <Star className="h-4 w-4" />
                      </button>
                      <button onClick={exitSelection} aria-label="Cancel selection" className="text-xs text-[#0b57d0] font-medium px-2 hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowImport(true)} title="More options" aria-label="More options"
                      className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#444746]">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {filteredContacts.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-[#5f6368] pr-1">
                    <span className="hidden sm:inline" aria-live="polite">
                      {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredContacts.length)} of {filteredContacts.length}
                    </span>
                    <div className="flex">
                      <button disabled={page === 0} onClick={() => setPage(p => p - 1)} title="Previous page" aria-label="Previous page"
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed] disabled:opacity-30">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button disabled={(page + 1) * pageSize >= filteredContacts.length} onClick={() => setPage(p => p + 1)} title="Next page" aria-label="Next page"
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#e8eaed] disabled:opacity-30">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Category tabs */}
              {activeFolder === 'inbox' && (
                <div className="flex border-b border-[#e0e0e0] flex-shrink-0 overflow-x-auto" role="tablist" aria-label="Email categories">
                  {[
                    { id: 'primary' as CategoryTab, label: 'Primary', icon: <svg viewBox="0 0 24 24" className="h-4 w-4 mr-1.5" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor" /></svg>, badge: unreadCount, color: '#EA4335' },
                    { id: 'social' as CategoryTab, label: 'Social', icon: <Users className="h-4 w-4 mr-1.5" aria-hidden="true" />, badge: socialCount > 0 ? `${socialCount} new` : null, color: '#34A853' },
                    { id: 'promotions' as CategoryTab, label: 'Promotions', icon: <Tag className="h-4 w-4 mr-1.5" aria-hidden="true" />, badge: promoCount > 0 ? `${promoCount} new` : null, color: '#1D6F42' },
                    { id: 'updates' as CategoryTab, label: 'Updates', icon: <AlertCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />, badge: null, color: '#F9AB00' },
                  ].map(tab => {
                    const isActive = activeCategoryTab === tab.id;
                    return (
                      <button key={tab.id} role="tab" aria-selected={isActive}
                        onClick={() => { setActiveCategoryTab(tab.id); setPage(0); }}
                        className={cn('flex items-center px-5 py-3 border-b-[3px] transition-colors min-w-fit text-sm',
                          isActive ? 'border-[#0b57d0] text-[#0b57d0] font-medium' : 'border-transparent text-[#5f6368] hover:bg-[#f6f8fc]')}>
                        <span className="flex items-center" style={isActive ? { color: tab.color } : { color: '#5f6368' }}>{tab.icon}</span>
                        {tab.label}
                        {tab.badge != null && typeof tab.badge === 'number' && tab.badge > 0 && (
                          <span className={cn('ml-2 text-[11px]', isActive ? '' : 'text-[#5f6368]')}>{tab.badge} new</span>
                        )}
                        {tab.badge != null && typeof tab.badge === 'string' && (
                          <span className="ml-2 text-[11px] text-[#5f6368]">{tab.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Email list */}
              <div className="flex-1 overflow-y-auto" role="list" aria-label="Email list">
                {loadingContacts ? (
                  <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#5f6368]" /></div>
                ) : filteredContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="h-24 w-24 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: providerColor + '15' }}>
                      <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: providerColor + '25' }}>
                        <Inbox className="h-8 w-8" style={{ color: providerColor }} />
                      </div>
                    </div>
                    <h3 className="font-semibold text-base text-[#202124] mb-1">{activeFolder === 'inbox' ? 'Your inbox is empty' : `No ${activeFolder} emails yet`}</h3>
                    <p className="text-xs text-[#5f6368] max-w-xs mb-6">Import your leads or compose a new email.</p>
                    <div className="flex gap-2">
                      <button onClick={() => openCompose()} aria-label="Compose new email"
                        className="flex items-center gap-2 px-4 h-9 rounded-full text-white text-sm" style={{ backgroundColor: providerColor }}>
                        <Pencil className="h-3.5 w-3.5" />Compose
                      </button>
                      <button onClick={() => setShowImport(true)} aria-label="Import leads"
                        className="flex items-center gap-2 px-4 h-9 rounded-full border border-[#dadce0] text-sm text-[#444746] hover:bg-[#f6f8fc]">
                        <UserPlus className="h-3.5 w-3.5" />Import Leads
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {paginatedContacts.map(c => {
                      const details = getEmailDetails(c);
                      const isStarred = starredIds.has(c.id);
                      const isImportant = importantIds.has(c.id);
                      const isSelected = selectedIds.has(c.id);
                      return (
                        <div key={c.id} role="listitem" onClick={() => setActiveContact(c)}
                          className={cn(
                            'group flex items-center gap-1 px-4 py-2 border-b border-[#f0f0f0] cursor-pointer select-none text-sm transition-shadow',
                            'hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]',
                            details.unread ? 'bg-white' : 'bg-[#f2f6fc]',
                            isSelected && 'bg-[#c2dbff]/50',
                          )}>
                          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelect(c.id)}
                              aria-label={`Select email from ${c.contact_name || c.email}`}
                              className="rounded border-[#dadce0] text-[#0b57d0] h-3.5 w-3.5 cursor-pointer" />
                            <button onClick={e => toggleStar(c.id, e)}
                              title={isStarred ? 'Unstar' : 'Star'} aria-label={isStarred ? `Unstar ${c.contact_name}` : `Star ${c.contact_name}`} aria-pressed={isStarred}
                              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]">
                              <Star className={cn('h-4 w-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-[#5f6368]/40')} />
                            </button>
                            <button onClick={e => toggleImportant(c.id, e)}
                              title={isImportant ? 'Not important' : 'Mark important'} aria-label={isImportant ? `Mark ${c.contact_name} not important` : `Mark ${c.contact_name} important`} aria-pressed={isImportant}
                              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4]">
                              <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-4 w-4', isImportant ? 'fill-yellow-400 text-yellow-400' : 'text-[#5f6368]/40')}>
                                <path d="M12 2L4 7l2 13h12l2-13z" />
                              </svg>
                            </button>
                          </div>
                          <div className={cn('w-28 sm:w-44 flex-shrink-0 truncate pr-2', details.unread ? 'font-bold text-[#202124]' : 'font-normal text-[#202124]')}>
                            {c.contact_name || 'Unknown'}
                          </div>
                          <div className="flex-1 min-w-0 pr-4 flex items-baseline gap-2 overflow-hidden">
                            {details.labels?.map(l => (
                              <span key={l} className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded text-white leading-none"
                                style={{ backgroundColor: l === 'Social' ? '#34A853' : l === 'Promotions' ? '#34A853' : l === 'Updates' ? '#F9AB00' : '#5f6368' }}>{l}</span>
                            ))}
                            <span className={cn('truncate', details.unread ? 'font-bold text-[#202124]' : 'font-normal text-[#202124]')}>{details.subject}</span>
                            <span className="text-[#5f6368] font-normal truncate max-w-xl hidden md:inline">— {details.snippet}</span>
                          </div>
                          <div className="w-24 flex justify-end flex-shrink-0 relative">
                            <span className="group-hover:hidden text-[11px] text-[#5f6368] whitespace-nowrap font-medium">{details.date}</span>
                            <div className="hidden group-hover:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleDeleteContact(c.id)} title="Delete" aria-label={`Delete email from ${c.contact_name}`}
                                className="p-1 rounded-full hover:bg-[#fce8e6] text-[#5f6368] hover:text-[#d93025]"><Trash2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { setSelectedIds(new Set([c.id])); setShowAddToGroup(true); }} title="Label" aria-label={`Add ${c.contact_name} to group`}
                                className="p-1 rounded-full hover:bg-[#e8eaed] text-[#5f6368]"><Tag className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { setSelectedIds(new Set([c.id])); setShowBulkSend(true); }} title="Send" aria-label={`Send email to ${c.contact_name}`}
                                className="p-1 rounded-full hover:bg-[#e8eaed] text-[#5f6368]"><Send className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="py-6 flex flex-col items-center gap-1 text-xs text-[#5f6368]">
                      <span>{filteredContacts.length.toLocaleString()} conversations</span>
                      <a href="#" className="text-[#0b57d0] hover:underline">Terms · Privacy · Program Policies</a>
                      <span>Last account activity: just now</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Right sidebar */}
        <div className="hidden md:flex w-12 flex-shrink-0 flex-col items-center pt-2 gap-3" aria-label="Google apps">
          {[
            { color: '#4285F4', label: 'Google Calendar', path: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z' },
            { color: '#FBBC04', label: 'Google Keep', path: 'M9 21h6v-2H9v2zm3-19C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z' },
            { color: '#34A853', label: 'Google Tasks', path: 'M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0012 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z' },
            { color: '#EA4335', label: 'Google Contacts', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' },
          ].map(({ color, label, path }) => (
            <button key={label} title={label} aria-label={label} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d={path} fill={color} /></svg>
            </button>
          ))}
          <button title="Add Google app" aria-label="Add Google app" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] text-[#5f6368]">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Compose Windows (visible, not minimized) ── */}
      {visibleWindows.map((w, i) => (
        <div
          key={w.id}
          style={!w.maximized ? { right: `${72 + i * 524}px` } : undefined}
        >
          <ComposeWindow
            provider={provider}
            contacts={contacts}
            initialTo={w.initialTo}
            initialSubject={w.initialSubject}
            initialBody={w.initialBody}
            minimized={false}
            maximized={w.maximized}
            onClose={() => closeCompose(w.id)}
            onMinimize={() => minimizeCompose(w.id)}
            onMaximize={() => maximizeCompose(w.id)}
            onSent={() => { loadContacts(); }}
          />
        </div>
      ))}

      {/* ── Minimized compose taskbar (bottom, like Gmail) ── */}
      {minimizedWindows.length > 0 && (
        <div className="fixed bottom-0 right-0 sm:right-[72px] z-50 flex items-end gap-2 pointer-events-none">
          {minimizedWindows.map(w => (
            <div key={w.id} className="pointer-events-auto">
              <ComposeWindow
                provider={provider}
                contacts={contacts}
                initialTo={w.initialTo}
                initialSubject={w.initialSubject}
                initialBody={w.initialBody}
                minimized={true}
                onClose={() => closeCompose(w.id)}
                onMinimize={() => minimizeCompose(w.id)}
                onMaximize={() => restoreCompose(w.id)}
                onSent={() => { loadContacts(); }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}
      {showImport && <ImportLeadsDialog open={showImport} onOpenChange={setShowImport} onImportComplete={() => { loadContacts(); loadGroups(); }} channel={provider} />}
      {showBulkSend && bulkSendGroup && <EmailTemplatePicker open={showBulkSend} onOpenChange={o => { setShowBulkSend(o); if (!o) exitSelection(); }} group={bulkSendGroup} provider={provider} />}
      {showAddToGroup && (
        <AddToGroupModal groups={groups} provider={provider}
          contactIds={activeContact && !selectedIds.size ? [activeContact.id] : Array.from(selectedIds)}
          onDone={() => { setShowAddToGroup(false); exitSelection(); loadGroups(); }}
          onClose={() => setShowAddToGroup(false)} />
      )}

      {/* ── Profile / Account modal (Gmail-style) ── */}
      {showProfileModal && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setShowProfileModal(false)} aria-hidden="true" />
          <div
            className="absolute top-14 right-2 z-[70] w-[340px] sm:w-[380px] bg-white rounded-3xl shadow-[0_8px_28px_rgba(60,64,67,.28),0_2px_8px_rgba(60,64,67,.14)] overflow-hidden"
            role="dialog" aria-label="Account menu" aria-modal="true">

            {/* Email + close */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#e0e0e0]">
              <span className="text-sm font-medium text-[#202124]">{connectedEmail}</span>
              <button onClick={() => setShowProfileModal(false)} title="Close" aria-label="Close account menu"
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] ml-2 flex-shrink-0">
                <X className="h-4 w-4 text-[#5f6368]" />
              </button>
            </div>

            {/* Avatar + greeting + manage button */}
            <div className="px-6 py-5 flex flex-col items-center text-center gap-3">
              <div className="relative">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-[#1a73e8] flex items-center justify-center text-white text-3xl font-medium select-none">
                  {userImage
                    ? <img src={userImage} alt="" className="h-full w-full object-cover" />
                    : (connectedEmail?.charAt(0)?.toUpperCase() || '?')}
                </div>
                <button
                  className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[#e8eaed] border-2 border-white flex items-center justify-center hover:bg-[#dadce0] transition-colors"
                  title="Change profile photo" aria-label="Change profile photo">
                  <Camera className="h-3.5 w-3.5 text-[#444746]" />
                </button>
              </div>
              <div>
                <p className="text-base font-medium text-[#202124]">
                  Hi, {connectedEmail?.split('@')[0] || 'there'}!
                </p>
                <p className="text-sm text-[#5f6368] mt-0.5">{connectedEmail}</p>
              </div>
              <button
                className="px-6 py-2 border border-[#dadce0] rounded-full text-sm text-[#0b57d0] hover:bg-[#e8f0fe] transition-colors font-medium"
                title="Manage your Google Account">
                Manage your Google Account
              </button>
            </div>

            {/* Security suggestion */}
            <div className="mx-4 mb-4 p-4 bg-[#f8f9fa] rounded-xl border border-[#e8eaed]">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-[#1a73e8] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-[10px] font-bold leading-none">i</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#202124] leading-snug">Protect your conversations with a recovery email</p>
                  <p className="text-xs text-[#5f6368] mt-1 leading-relaxed">Add a recovery email as backup in case you have trouble signing in</p>
                  <div className="flex gap-4 mt-3">
                    <button className="text-xs text-[#5f6368] hover:text-[#202124] transition-colors font-medium">Dismiss</button>
                    <button className="text-xs text-[#0b57d0] hover:text-[#0842a0] transition-colors font-medium">Add recovery email</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e0e0e0]" />

            {/* More accounts */}
            <div>
              <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#f1f3f4] transition-colors text-sm font-medium text-[#202124]">
                <span>Hide more accounts</span>
                <ChevronDown className="h-4 w-4 text-[#5f6368]" />
              </button>
              <div className="px-4 pb-2">
                <button className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#f1f3f4] transition-colors">
                  <div className="h-9 w-9 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-sm font-medium flex-shrink-0 select-none">
                    {connectedEmail?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-[#202124] truncate">{connectedEmail?.split('@')[0]}</p>
                    <p className="text-xs text-[#5f6368] truncate">{connectedEmail}</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="border-t border-[#e0e0e0]" />

            {/* Add / Sign out */}
            <div className="py-1">
              <button className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#f1f3f4] transition-colors text-sm text-[#202124]">
                <UserPlus className="h-5 w-5 text-[#444746]" />
                Add another account
              </button>
              <button className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#f1f3f4] transition-colors text-sm text-[#202124]">
                <LogOut className="h-5 w-5 text-[#444746]" />
                Sign out of all accounts
              </button>
            </div>

            <div className="border-t border-[#e0e0e0]" />

            {/* Storage bar */}
            <div className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 h-2 bg-[#e0e0e0] rounded-full overflow-hidden">
                <div className="h-full bg-[#1a73e8] rounded-full" style={{ width: '61%' }} />
              </div>
              <span className="text-xs text-[#5f6368] whitespace-nowrap flex-shrink-0">61% of 15 GB used</span>
            </div>

            <div className="border-t border-[#e0e0e0]" />

            {/* Privacy / Terms */}
            <div className="px-5 py-3 flex items-center justify-center gap-3">
              <a href="#" className="text-[11px] text-[#5f6368] hover:text-[#202124] transition-colors">Privacy Policy</a>
              <span className="text-[11px] text-[#5f6368]">·</span>
              <a href="#" className="text-[11px] text-[#5f6368] hover:text-[#202124] transition-colors">Terms of Service</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}