'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
// NOTE: Do NOT import Header/Footer here. PublicLayout wraps every public
// route (including /pricing) and already renders both. Importing them on
// the page would render duplicates (the prior page had this bug too).

// ─── Section ids (collapsible groups) ────────────────────────────────────
type SectionId =
  | 'key' | 'broadcast' | 'linkedin' | 'email' | 'engage-ai'
  | 'voice' | 'ads' | 'analyse' | 'crm' | 'admin' | 'support';

export default function PricingPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.push('/settings?tab=credits&action=add');
    else        router.push('/login');
  };
  const handleTalkToSales = () => router.push('/contact');

  // Only the "Key features" section is open by default — matches the original HTML.
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    key: true, broadcast: false, linkedin: false, email: false, 'engage-ai': false,
    voice: false, ads: false, analyse: false, crm: false, admin: false, support: false,
  });
  const toggle = (id: SectionId) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="pricing-root">
      <div className="wrap">

          <header className="page">
            <h1>Compare all Mr LAD plans &amp; features</h1>
            <p>
              From simple WhatsApp &amp; email broadcasting to a full agentic sales team that works your funnel across LinkedIn, WhatsApp, Instagram, email, ads and voice — every plan drives toward your Sales-Accepted Handoff.
            </p>
            <div className="pillars">
              <span className="pillar o">Outreach</span>
              <span className="pillar e">Engage</span>
              <span className="pillar a">Analyse</span>
              <span className="pillar c">Convert</span>
            </div>
          </header>

          {/* ===== Sticky plan header ===== */}
          <div className="plan-row">
            <div className="grid">
              <div className="corner">Features by plan</div>

              <div className="plan-card noai">
                <span className="badge gray">No AI</span>
                <h3>Broadcast</h3>
                <div className="price">$39<small>/mo</small></div>
                <div className="seg">Email &amp; WhatsApp campaigns only</div>
                <button type="button" className="cta" onClick={handleGetStarted}>Start free trial</button>
              </div>

              <div className="plan-card">
                <h3>Starter</h3>
                <div className="price">$99<small>/mo</small></div>
                <div className="seg">Solopreneurs · Outreach</div>
                <button type="button" className="cta" onClick={handleGetStarted}>Start free trial</button>
              </div>

              <div className="plan-card popular">
                <span className="badge">Most popular</span>
                <h3>Growth</h3>
                <div className="price">$199<small>/mo</small></div>
                <div className="seg">Small teams · Outreach + Engage</div>
                <button type="button" className="cta" onClick={handleGetStarted}>Start free trial</button>
              </div>

              <div className="plan-card">
                <h3>Scale</h3>
                <div className="price">$499<small>/mo</small></div>
                <div className="seg">Sales teams · All pillars + Voice</div>
                <button type="button" className="cta" onClick={handleGetStarted}>Start free trial</button>
              </div>

              <div className="plan-card">
                <h3>Enterprise</h3>
                <div className="price">Custom</div>
                <div className="seg">10+ channels · Omnichannel layer</div>
                <button type="button" className="cta" onClick={handleTalkToSales}>Talk to sales</button>
              </div>
            </div>
          </div>

          {/* ===== KEY FEATURES ===== */}
          <Section id="key" pillar="n" title="Key features"
            bench={<>The whole funnel in one subscription — a comparable point-solution stack runs <b>$285–$700+/mo</b> across 4–6 separate tools.</>}
            isOpen={open['key']} onToggle={() => toggle('key')}>
            <FRow name={<><b>Contacts / active prospects</b><span>Contacts you can store and message; prospects in live AI campaigns.</span></>}
              cells={[<Lim>2,000 contacts</Lim>, <Lim>500 prospects</Lim>, <Lim>2,500 prospects</Lim>, <Lim>10,000 prospects</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>AI agents</b><span>Autonomous agents that research, converse, qualify and book.</span></>}
              cells={[<No />, <Lim>Outreach</Lim>, <Lim>+ Engage</Lim>, <Lim>All + Voice</Lim>, <Lim>All + custom</Lim>]} />
            <FRow name={<><b>LinkedIn sender accounts</b><span>Connected LinkedIn profiles running outreach.</span></>}
              cells={[<No />, <Lim>1</Lim>, <Lim>2</Lim>, <Lim>5</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Users</b><span>Team members on your account.</span></>}
              cells={[<Lim>1</Lim>, <Lim>1</Lim>, <Lim>3</Lim>, <Lim>10</Lim>, <Lim>Unlimited</Lim>]} />
            <FRow name={<><b>Channels included</b><span>Where Mr LAD works for you.</span></>}
              cells={[<Lim>WhatsApp + Email broadcasts</Lim>, <Lim>LinkedIn + Email</Lim>, <Lim>+ WhatsApp, Instagram</Lim>, <Lim>+ Voice, Meta Ads</Lim>, <Lim>All + custom</Lim>]} />
            <FRow name={<><b>Sales-Accepted Handoff goal</b><span>Configure what counts as conversion: meeting booked, order placed, or quotation sent.</span></>}
              cells={[<No />, <Lim>Meeting booking</Lim>, <Lim>Meeting / quotation</Lim>, <Yes>✓ Any SAH type</Yes>, <Lim>Custom events</Lim>]} />
            <FRow name={<><b>AI usage wallet</b><span>Pre-paid wallet metering AI consumption across all agents. Top up any time.</span></>}
              cells={[<No />, <Lim>$25/mo included</Lim>, <Lim>$50/mo included</Lim>, <Lim>$125/mo included</Lim>, <Lim>Volume rates</Lim>]} />
            <FRow name={<><b>Customer support</b></>}
              cells={[<Lim>Email</Lim>, <Lim>Email + WhatsApp</Lim>, <Lim>Priority chat</Lim>, <Lim>Phone + onboarding call</Lim>, <Lim>Success manager</Lim>]} />
          </Section>

          {/* ===== BROADCASTING ===== */}
          <Section id="broadcast" pillar="e" title="Engage — Broadcasting (Email & WhatsApp)"
            bench={<>Standalone broadcast platforms: <b>AiSensy from ~AED 66/mo</b>, <b>Wati from ~$49/mo</b> — both add 20–60% markup on every message. Mr LAD adds <b>0%</b>.</>}
            isOpen={open['broadcast']} onToggle={() => toggle('broadcast')}>
            <FRow name={<><b>WhatsApp Business API (WABA)</b><span>Official Meta Cloud API connection with green-tick eligibility.</span></>}
              cells={[<Yes />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Meta message fees — 0% markup</b><span>Your card connects directly to Meta. We never touch your message billing.</span><Mkt>Other platforms mark up 20–60%</Mkt></>}
              cells={[<Lim>Direct to Meta</Lim>, <No />, <Lim>Direct to Meta</Lim>, <Lim>Direct to Meta</Lim>, <Lim>Direct to Meta</Lim>]} />
            <FRow name={<><b>WhatsApp broadcasts</b><span>Bulk template campaigns with scheduling, audience lists and delivery reports.</span></>}
              cells={[<Lim>Unlimited*</Lim>, <No />, <Lim>Unlimited*</Lim>, <Lim>Unlimited*</Lim>, <Lim>Unlimited*</Lim>]} />
            <FRow name={<><b>Email broadcasts</b><span>Bulk email campaigns with templates and scheduling.</span></>}
              cells={[<Lim>5,000/mo</Lim>, <Lim>10,000/mo</Lim>, <Lim>25,000/mo</Lim>, <Lim>100,000/mo</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Template &amp; campaign builder</b><span>Meta-approved WhatsApp templates and email designs without code.</span></>}
              cells={[<Yes />, <Lim>Email only</Lim>, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Shared inbox (manual replies)</b><span>See and answer broadcast replies yourself from one inbox.</span></>}
              cells={[<Yes />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Delivery, open &amp; click reports</b></>}
              cells={[<Yes />, <Yes />, <Yes />, <Yes />, <Yes />]} />
          </Section>

          {/* ===== OUTREACH : LINKEDIN ===== */}
          <Section id="linkedin" pillar="o" title="Outreach — LinkedIn"
            bench={<>Standalone tools: <b>Expandi $99–149/seat</b>, <b>Dripify $59–99</b>, <b>HeyReach $79–199</b> — none of them research prospects or hand conversations to other channels.</>}
            isOpen={open['linkedin']} onToggle={() => toggle('linkedin')}>
            <FRow name={<><b>ICP-based prospect discovery</b><span>Find prospects matching your Ideal Customer Profile automatically.</span></>}
              cells={[<No />, <Lim>250/mo</Lim>, <Lim>800/mo</Lim>, <Lim>2,000/mo</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Contact enrichment credits</b><span>Verified emails &amp; phone numbers for discovered prospects.</span></>}
              cells={[<No />, <Lim>250/mo</Lim>, <Lim>800/mo</Lim>, <Lim>2,000/mo</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Personalised connection requests &amp; sequences</b><span>Multi-step LinkedIn outreach with safe daily limits.</span></>}
              cells={[<No />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Per-prospect web research</b><span>Agent researches each prospect online before writing the first message.</span></>}
              cells={[<No />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>AI conversation agent on LinkedIn</b><span>Replies handled automatically and driven toward your SAH.</span></>}
              cells={[<No />, <Lim>First touch only</Lim>, <Yes>✓ Full conversation</Yes>, <Yes />, <Yes />]} />
            <FRow name={<><b>Warm Path relationship context</b><span>Surface mutual connections and CRM relationships before outreach.</span></>}
              cells={[<No />, <No />, <Road />, <Road />, <Road />]} />
          </Section>

          {/* ===== OUTREACH : EMAIL ===== */}
          <Section id="email" pillar="o" title="Outreach — Email"
            bench={<>Standalone senders: <b>Instantly $37–97</b>, <b>Smartlead $39–94</b>, <b>lemlist $59–159/seat</b>.</>}
            isOpen={open['email']} onToggle={() => toggle('email')}>
            <FRow name={<><b>Connected mailboxes</b><span>Sending mailboxes with warm-up and rotation.</span></>}
              cells={[<Lim>1</Lim>, <Lim>1</Lim>, <Lim>3</Lim>, <Lim>10</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Email sequences &amp; follow-ups</b><span>Multi-step nurture tied to the same prospect record as LinkedIn and WhatsApp.</span></>}
              cells={[<No />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Two-way email conversation agent</b><span>AI handles replies, objections and scheduling over email.</span></>}
              cells={[<No />, <No />, <Road />, <Road />, <Road />]} />
          </Section>

          {/* ===== ENGAGE : AI AGENTS ===== */}
          <Section id="engage-ai" pillar="e" title="Engage — AI conversation agents"
            bench={<>AI chat agents are extra-cost add-ons or enterprise-only on most platforms: <b>Wati bills chatbots separately from ~$40/mo</b>; respond.io AI sits on <b>$79+ plans</b>.</>}
            isOpen={open['engage-ai']} onToggle={() => toggle('engage-ai')}>
            <FRow name={<><b>AI WhatsApp conversation agent</b><span>Qualifies, nurtures and books — 24/7, in English and Arabic.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Instagram DM agent</b><span>Handles enquiries from posts, stories and ads.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Speed-to-lead first touch</b><span>New inbound leads contacted within seconds, any hour.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Database reactivation with AI follow-up</b><span>Re-engage cold lists with broadcast + agent conversations.</span></>}
              cells={[<Lim>Broadcast only</Lim>, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Unified inbox with human takeover</b><span>Watch every AI conversation; step in whenever you want.</span></>}
              cells={[<No />, <Lim>LinkedIn + email</Lim>, <Yes>✓ All channels</Yes>, <Yes />, <Yes />]} />
          </Section>

          {/* ===== VOICE ===== */}
          <Section id="voice" pillar="c" title="Convert — AI Voice agent"
            bench={<>Standalone voice AI: typical all-in cost <b>$0.13–$0.31/min</b>; bundled platforms <b>$0.11–$0.14/min</b> plus $499/mo plans at volume.</>}
            isOpen={open['voice']} onToggle={() => toggle('voice')}>
            <FRow name={<><b>Included voice minutes</b><span>Outbound follow-up and inbound answering, GCC numbers supported.</span></>}
              cells={[<No />, <No />, <Addon />, <Lim>1,500 min/mo</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Additional minutes</b><span>All-inclusive: telephony, speech and AI.</span></>}
              cells={[<No />, <No />, <Lim>$0.25/min</Lim>, <Lim>$0.12/min</Lim>, <Lim>Volume rates</Lim>]} />
            <FRow name={<><b>No-show &amp; abandoned-flow recovery calls</b><span>Automatic call-back when a lead books then disappears.</span></>}
              cells={[<No />, <No />, <No />, <Yes />, <Yes />]} />
            <FRow name={<><b>Call recordings &amp; transcripts</b><span>Every call logged on the prospect timeline.</span></>}
              cells={[<No />, <No />, <No />, <Yes />, <Yes />]} />
          </Section>

          {/* ===== ADS ===== */}
          <Section id="ads" pillar="e" title="Engage — Meta Ads (managed)"
            bench={<>Standalone ad automation: <b>Madgicx $44–99+/mo</b> tiered by spend; agencies charge <b>10–20% of ad spend</b>. Mr LAD runs ads <i>and</i> answers every lead they generate.</>}
            isOpen={open['ads']} onToggle={() => toggle('ads')}>
            <FRow name={<><b>AI ad creation &amp; publishing</b><span>Upload a photo or video — campaigns created and published across Facebook, Instagram and WhatsApp.</span></>}
              cells={[<No />, <No />, <Road />, <Road />, <Road />]} />
            <FRow name={<><b>Ad spend management fee</b><span>Charged on managed spend, billed monthly.</span></>}
              cells={[<No />, <No />, <Lim>12% of spend</Lim>, <Lim>10% of spend</Lim>, <Lim>Negotiated</Lim>]} />
            <FRow name={<><b>Click-to-WhatsApp ad handling</b><span>Every ad click lands in an AI conversation, not a dead form.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
          </Section>

          {/* ===== ANALYSE ===== */}
          <Section id="analyse" pillar="a" title="Analyse — Reporting & attribution"
            bench={<>Comparable attribution &amp; analytics tooling is gated to <b>$300+/mo enterprise tiers</b> elsewhere — or sold as a separate product entirely.</>}
            isOpen={open['analyse']} onToggle={() => toggle('analyse')}>
            <FRow name={<><b>Campaign &amp; channel reports</b><span>Sends, replies, conversations, meetings by channel.</span></>}
              cells={[<Lim>Delivery &amp; opens</Lim>, <Lim>Basic</Lim>, <Lim>Advanced</Lim>, <Lim>Full studio</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>SAH attribution dashboard</b><span>Which channel and campaign actually produced each handoff.</span></>}
              cells={[<No />, <No />, <Lim>1 conversion metric</Lim>, <Lim>Unlimited metrics</Lim>, <Lim>Unlimited</Lim>]} />
            <FRow name={<><b>360° prospect view</b><span>Every touchpoint across every channel on one timeline.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Conversation analysis</b><span>AI reads every conversation and reports where each prospect stands.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Leakage detection</b><span>Find enquiries that went unanswered across your channels.</span></>}
              cells={[<No />, <No />, <No />, <No />, <Road />]} />
          </Section>

          {/* ===== CONVERT & CRM ===== */}
          <Section id="crm" pillar="c" title="Convert — Scheduling, quotations & CRM"
            bench={<>CRM seats run <b>$15–99/user/mo</b> elsewhere; Mr LAD is the lead store for solo tenants and syncs with your CRM when you have one.</>}
            isOpen={open['crm']} onToggle={() => toggle('crm')}>
            <FRow name={<><b>Automated meeting scheduling</b><span>Agents book straight into your calendar with reminders.</span></>}
              cells={[<No />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Quotation-driven SAH flows</b><span>Agent collects all required inputs and triggers a quotation.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Post-conversion review &amp; referral capture</b><span>Automated review requests and referral asks after each win.</span></>}
              cells={[<No />, <No />, <No />, <Yes />, <Yes />]} />
            <FRow name={<><b>Built-in lead store</b><span>Full contact, conversation and activity record — your CRM if you don&apos;t have one.</span></>}
              cells={[<Lim>Contact lists</Lim>, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>CRM sync (HubSpot, Zoho, Salesforce)</b><span>Bidirectional sync of qualified leads and activity.</span></>}
              cells={[<No />, <No />, <Addon />, <Yes />, <Yes />]} />
          </Section>

          {/* ===== ADMIN ===== */}
          <Section id="admin" pillar="n" title="Admin, data & security"
            bench={<>Dedicated tenant databases on every plan — isolation most competitors reserve for enterprise contracts.</>}
            isOpen={open['admin']} onToggle={() => toggle('admin')}>
            <FRow name={<><b>Dedicated tenant database</b><span>Your conversation and contact data in its own database, never pooled.</span></>}
              cells={[<Yes />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>UAE PDPL / GDPR compliance tooling</b><span>Consent, retention and data-residency controls.</span></>}
              cells={[<Yes />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>User roles &amp; permissions</b></>}
              cells={[<No />, <No />, <Lim>Basic</Lim>, <Lim>Full</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Multi-brand sub-accounts</b><span>Run multiple brands or business units under one master account.</span></>}
              cells={[<No />, <No />, <No />, <Addon />, <Yes />]} />
            <FRow name={<><b>SSO &amp; SAML</b></>}
              cells={[<No />, <No />, <No />, <No />, <Yes />]} />
            <FRow name={<><b>Uptime SLA</b></>}
              cells={[<No />, <No />, <No />, <No />, <Lim>99.9%</Lim>]} />
          </Section>

          {/* ===== SUPPORT ===== */}
          <Section id="support" pillar="n" title="Support & onboarding"
            bench={<>Local, GCC-timezone support on every plan.</>}
            isOpen={open['support']} onToggle={() => toggle('support')}>
            <FRow name={<><b>Onboarding</b><span>Get your ICP, channels and SAH configured.</span></>}
              cells={[<Lim>Self-serve</Lim>, <Lim>Self-serve wizard</Lim>, <Lim>Guided setup call</Lim>, <Lim>Done-with-you ($299 one-time)</Lim>, <Lim>Fully managed</Lim>]} />
            <FRow name={<><b>Support channel</b></>}
              cells={[<Lim>Email</Lim>, <Lim>Email + WhatsApp</Lim>, <Lim>Priority chat</Lim>, <Lim>Phone</Lim>, <Lim>Dedicated CSM</Lim>]} />
            <FRow name={<><b>Quarterly strategy review</b><span>Sit with our team to tune campaigns and ICP.</span></>}
              cells={[<No />, <No />, <No />, <Yes />, <Yes />]} />
          </Section>

          <div className="note">
            <h4>How usage billing works</h4>
            AI plans include a monthly AI usage allowance; beyond it, usage is metered from your pre-paid wallet at transparent per-action rates, with voice minutes and enrichment credits ($0.20 each) billed the same way. WhatsApp message fees are billed directly by Meta to your own card on every plan — Mr LAD adds zero markup, ever. *Unlimited WhatsApp broadcasts means no platform cap; Meta&apos;s per-message fees still apply and are paid by you directly to Meta. No surprise invoices — your wallet is the ceiling, and you control the top-ups.
          </div>

        </div>

        {/* All styles scoped to .pricing-root via styled-jsx; no global leakage. */}
        <style jsx>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

          .pricing-root {
            --paper: #F7F9FB; --ink: #10243E; --ink-soft: #4A5B72; --line: #E2E8F0;
            --teal: #0E8A7B; --teal-soft: #E4F4F1;
            --outreach: #1F6FEB; --engage: #1E9E5A; --analyse: #D98A04; --convert: #7C4DCC;
            --card: #FFFFFF;
            font-family: 'Inter', sans-serif;
            background: var(--paper);
            color: var(--ink);
            font-size: 14px;
            line-height: 1.5;
          }
          .pricing-root :global(*) { box-sizing: border-box; }

          .wrap { max-width: 1280px; margin: 0 auto; padding: 0 20px 80px; }

          header.page { padding: 48px 0 28px; text-align: center; }
          header.page :global(h1) { font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -.5px; }
          header.page :global(p) { color: var(--ink-soft); margin-top: 8px; max-width: 640px; margin-left: auto; margin-right: auto; }
          .pillars { display: flex; gap: 10px; justify-content: center; margin-top: 18px; flex-wrap: wrap; }
          .pillar { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; padding: 5px 14px; border-radius: 999px; color: #fff; }
          .pillar.o { background: var(--outreach); }
          .pillar.e { background: var(--engage); }
          .pillar.a { background: var(--analyse); }
          .pillar.c { background: var(--convert); }

          .plan-row { position: sticky; top: 0; z-index: 50; background: var(--paper); padding: 14px 0 10px; border-bottom: 2px solid var(--ink); }
          .grid { display: grid; grid-template-columns: minmax(200px, 1.5fr) repeat(5, 1fr); gap: 0; align-items: stretch; }
          .plan-card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; margin: 0 4px; padding: 14px 10px; text-align: center; position: relative; display: flex; flex-direction: column; justify-content: flex-start; }
          .plan-card.popular { border: 2px solid var(--teal); }
          .plan-card.noai { background: #FBFCFE; border-style: dashed; }
          .badge { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: var(--teal); color: #fff; font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
          .badge.gray { background: var(--ink-soft); }
          .plan-card :global(h3) { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; }
          .plan-card .price { font-family: 'Sora', sans-serif; font-size: 21px; font-weight: 700; margin-top: 4px; }
          .plan-card .price :global(small) { font-size: 11px; font-weight: 500; color: var(--ink-soft); }
          .plan-card .seg { font-size: 10.5px; color: var(--ink-soft); margin-top: 4px; }
          .plan-card .cta { display: block; width: 100%; margin-top: 10px; background: var(--ink); color: #fff; border: none; cursor: pointer; text-decoration: none; font-size: 12px; font-weight: 600; padding: 7px 0; border-radius: 7px; font-family: inherit; }
          .plan-card.popular .cta { background: var(--teal); }
          .corner { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 13px; color: var(--ink-soft); display: flex; align-items: flex-end; padding: 0 6px 6px; }

          /* Section wrappers — styled by class on <section> rendered in <Section />.
             We use :global() because the markup is rendered by the Section/FRow
             helper components, not directly here. Class names remain scoped to
             the .pricing-root subtree via the leading descendant selector. */
          .pricing-root :global(section.fgroup) { margin-top: 26px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
          .pricing-root :global(.fgroup > .head) { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 20px; cursor: pointer; border-left: 5px solid var(--ink-soft); }
          .pricing-root :global(.fgroup.o > .head) { border-left-color: var(--outreach); }
          .pricing-root :global(.fgroup.e > .head) { border-left-color: var(--engage); }
          .pricing-root :global(.fgroup.a > .head) { border-left-color: var(--analyse); }
          .pricing-root :global(.fgroup.c > .head) { border-left-color: var(--convert); }
          .pricing-root :global(.fgroup.n > .head) { border-left-color: var(--ink-soft); }
          .pricing-root :global(.head h2) { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; margin: 0; }
          .pricing-root :global(.head .bench) { font-size: 11.5px; color: var(--ink-soft); max-width: 520px; text-align: right; }
          .pricing-root :global(.head .bench b) { color: var(--teal); }
          .pricing-root :global(.chev) { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--ink-soft); transition: transform .2s; }
          .pricing-root :global(.fgroup.open .chev) { transform: rotate(180deg); }
          .pricing-root :global(.body) { display: none; }
          .pricing-root :global(.fgroup.open .body) { display: block; }

          .pricing-root :global(.frow) { display: grid; grid-template-columns: minmax(200px, 1.5fr) repeat(5, 1fr); border-top: 1px solid var(--line); }
          .pricing-root :global(.frow:nth-child(even)) { background: #FBFCFE; }
          .pricing-root :global(.fname) { padding: 12px 16px; }
          .pricing-root :global(.fname b) { display: block; font-weight: 600; font-size: 13.5px; }
          .pricing-root :global(.fname span) { display: block; font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; }
          .pricing-root :global(.fname .mkt) { display: inline-block; margin-top: 5px; font-size: 10.5px; color: var(--teal); background: var(--teal-soft); padding: 2px 8px; border-radius: 999px; }
          .pricing-root :global(.cell) { display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px 6px; font-size: 12px; border-left: 1px dashed var(--line); }
          .pricing-root :global(.yes) { color: var(--teal); font-weight: 700; font-size: 15px; }
          .pricing-root :global(.no) { color: #C2CBD6; font-size: 14px; }
          .pricing-root :global(.lim) { color: var(--ink); font-weight: 500; }
          .pricing-root :global(.addon) { font-size: 11px; color: var(--ink-soft); background: #F0F3F7; padding: 2px 8px; border-radius: 999px; }
          .pricing-root :global(.road) { font-size: 10px; font-weight: 600; letter-spacing: .4px; color: #fff; background: var(--analyse); padding: 2px 7px; border-radius: 4px; margin-left: 6px; vertical-align: middle; }

          .note { margin-top: 26px; background: var(--teal-soft); border: 1px solid #C8E8E2; border-radius: 12px; padding: 18px 20px; font-size: 13px; color: var(--ink); }
          .note :global(h4) { font-family: 'Sora', sans-serif; font-size: 14px; margin-bottom: 6px; }

          @media (max-width: 920px) {
            .grid, .pricing-root :global(.frow) { grid-template-columns: minmax(130px, 1.3fr) repeat(5, 1fr); }
            .pricing-root :global(.head .bench) { display: none; }
            .plan-card .price { font-size: 14px; }
            .plan-card :global(h3) { font-size: 11px; }
            .plan-card .seg, .plan-card .cta { display: none; }
            .pricing-root :global(.fname span) { display: none; }
            .pricing-root :global(.cell) { font-size: 10.5px; padding: 8px 3px; }
          }
        `}</style>
    </div>
  );
}

// ─── Helpers (presentational) ─────────────────────────────────────────────
// Lightweight wrappers so each row stays one line in JSX.

function Section({ id, pillar, title, bench, isOpen, onToggle, children }: {
  id: string;
  /** Left-border accent: o/e/a/c (Outreach/Engage/Analyse/Convert) or n (neutral). */
  pillar: 'o' | 'e' | 'a' | 'c' | 'n';
  title: string;
  bench: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`fgroup ${pillar}${isOpen ? ' open' : ''}`} id={`section-${id}`}>
      <div
        className="head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        aria-expanded={isOpen}
        aria-controls={`section-${id}-body`}
      >
        <h2>{title}</h2>
        <div className="bench">{bench}</div>
        <div className="chev" aria-hidden>▼</div>
      </div>
      <div className="body" id={`section-${id}-body`}>{children}</div>
    </section>
  );
}

function FRow({ name, cells }: { name: React.ReactNode; cells: React.ReactElement[] }) {
  return (
    <div className="frow">
      <div className="fname">{name}</div>
      {cells.map((c, i) => React.cloneElement(c, { key: i }))}
    </div>
  );
}

// Cell helpers — kept tiny so each <FRow cells={[...]}/> reads like a row of values.
function Yes({ children }: { children?: React.ReactNode }) {
  return <div className="cell"><span className="yes">{children ?? '✓'}</span></div>;
}
function No() {
  return <div className="cell"><span className="no">—</span></div>;
}
function Lim({ children }: { children: React.ReactNode }) {
  return <div className="cell lim">{children}</div>;
}
function Addon() {
  return <div className="cell"><span className="addon">Add-on</span></div>;
}
function Road() {
  return <div className="cell">✓ <span className="road">ROADMAP</span></div>;
}
function Mkt({ children }: { children: React.ReactNode }) {
  return <span className="mkt">{children}</span>;
}
