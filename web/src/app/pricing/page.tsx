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

  // Only the "Key features" section is open by default,matches the original HTML.
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
              From simple WhatsApp &amp; email broadcasting to a full agentic sales team that works your funnel across LinkedIn, WhatsApp, Instagram, email, ads and voice. Every plan drives toward your Sales-Accepted Handoff.
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

          {/* ============================================================
              Sections are grouped by pillar in this order:
              Key features → Outreach → Engage → Analyse → Convert → Admin
              → Support. Bench text deliberately omits competitor product
              names; price ranges below are category benchmarks. The
              standalone-tool calculators that sit below the comparison
              tables (further down the page) name competitors explicitly.
              ============================================================ */}

          {/* ===== KEY FEATURES ===== */}
          <Section id="key" pillar="n" title="Key features"
            bench={<>The whole funnel in one subscription. A comparable point-solution stack runs <b>$285–$700+/mo</b> across 4–6 separate tools.</>}
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

          {/* ===== OUTREACH : LINKEDIN ===== */}
          <Section id="linkedin" pillar="o" title="Outreach: LinkedIn"
            bench={<>Standalone LinkedIn outreach tools run <b>$59–$199/seat/mo</b>. None of them research each prospect or hand conversations off to other channels.</>}
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
          <Section id="email" pillar="o" title="Outreach: Email"
            bench={<>Standalone cold-email senders run <b>$37–$159/seat/mo</b>, billed per mailbox before warm-up and rotation add-ons.</>}
            isOpen={open['email']} onToggle={() => toggle('email')}>
            <FRow name={<><b>Connected mailboxes</b><span>Sending mailboxes with warm-up and rotation.</span></>}
              cells={[<Lim>1</Lim>, <Lim>1</Lim>, <Lim>3</Lim>, <Lim>10</Lim>, <Lim>Custom</Lim>]} />
            <FRow name={<><b>Email sequences &amp; follow-ups</b><span>Multi-step nurture tied to the same prospect record as LinkedIn and WhatsApp.</span></>}
              cells={[<No />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Two-way email conversation agent</b><span>AI handles replies, objections and scheduling over email.</span></>}
              cells={[<No />, <No />, <Road />, <Road />, <Road />]} />
          </Section>

          {/* ===== ENGAGE : BROADCASTING ===== */}
          <Section id="broadcast" pillar="e" title="Engage: Broadcasting (Email & WhatsApp)"
            bench={<>Standalone broadcast platforms charge <b>$18–$60+/mo</b> and add a <b>20–60% markup</b> on every WhatsApp message you send. Mr LAD adds <b>0%</b>.</>}
            isOpen={open['broadcast']} onToggle={() => toggle('broadcast')}>
            <FRow name={<><b>WhatsApp Business API (WABA)</b><span>Official Meta Cloud API connection with green-tick eligibility.</span></>}
              cells={[<Yes />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Meta message fees,0% markup</b><span>Your card connects directly to Meta. We never touch your message billing.</span><Mkt>Other platforms mark up 20–60%</Mkt></>}
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

          {/* ===== ENGAGE : AI AGENTS ===== */}
          <Section id="engage-ai" pillar="e" title="Engage: AI conversation agents"
            bench={<>AI chat agents are extra-cost add-ons (<b>~$40/mo</b>) or gated to enterprise tiers (<b>$79+/mo</b>) on most platforms. With Mr LAD they&apos;re included from Growth onward.</>}
            isOpen={open['engage-ai']} onToggle={() => toggle('engage-ai')}>
            <FRow name={<><b>AI WhatsApp conversation agent</b><span>Qualifies, nurtures and books,24/7, in English and Arabic.</span></>}
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

          {/* ===== ENGAGE : ADS ===== */}
          <Section id="ads" pillar="e" title="Engage: Meta Ads (managed)"
            bench={<>Standalone ad-automation tools run <b>$44–$99+/mo</b> tiered by spend; agencies charge <b>10–20% of ad spend</b>. Mr LAD runs the ads <i>and</i> answers every lead they generate.</>}
            isOpen={open['ads']} onToggle={() => toggle('ads')}>
            <FRow name={<><b>AI ad creation &amp; publishing</b><span>Upload a photo or video. Campaigns are created and published across Facebook, Instagram and WhatsApp.</span></>}
              cells={[<No />, <No />, <Road />, <Road />, <Road />]} />
            <FRow name={<><b>Ad spend management fee</b><span>Charged on managed spend, billed monthly.</span></>}
              cells={[<No />, <No />, <Lim>12% of spend</Lim>, <Lim>10% of spend</Lim>, <Lim>Negotiated</Lim>]} />
            <FRow name={<><b>Click-to-WhatsApp ad handling</b><span>Every ad click lands in an AI conversation, not a dead form.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
          </Section>

          {/* ===== ANALYSE ===== */}
          <Section id="analyse" pillar="a" title="Analyse: Reporting & attribution"
            bench={<>Comparable attribution &amp; analytics tooling is gated to <b>$300+/mo enterprise tiers</b> elsewhere, or sold as a separate product entirely.</>}
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

          {/* ===== CONVERT : VOICE ===== */}
          <Section id="voice" pillar="c" title="Convert: AI Voice agent"
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

          {/* ===== CONVERT : SCHEDULING + CRM ===== */}
          <Section id="crm" pillar="c" title="Convert: Scheduling, quotations & CRM"
            bench={<>CRM seats run <b>$15–99/user/mo</b> elsewhere; Mr LAD is the lead store for solo tenants and syncs with your CRM when you have one.</>}
            isOpen={open['crm']} onToggle={() => toggle('crm')}>
            <FRow name={<><b>Automated meeting scheduling</b><span>Agents book straight into your calendar with reminders.</span></>}
              cells={[<No />, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Quotation-driven SAH flows</b><span>Agent collects all required inputs and triggers a quotation.</span></>}
              cells={[<No />, <No />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>Post-conversion review &amp; referral capture</b><span>Automated review requests and referral asks after each win.</span></>}
              cells={[<No />, <No />, <No />, <Yes />, <Yes />]} />
            <FRow name={<><b>Built-in lead store</b><span>Full contact, conversation and activity record. Your CRM if you don&apos;t have one.</span></>}
              cells={[<Lim>Contact lists</Lim>, <Yes />, <Yes />, <Yes />, <Yes />]} />
            <FRow name={<><b>CRM sync (HubSpot, Zoho, Salesforce)</b><span>Bidirectional sync of qualified leads and activity.</span></>}
              cells={[<No />, <No />, <Addon />, <Yes />, <Yes />]} />
          </Section>

          {/* ===== ADMIN ===== */}
          <Section id="admin" pillar="n" title="Admin, data & security"
            bench={<>Dedicated tenant databases on every plan. Isolation most competitors reserve for enterprise contracts.</>}
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

          {/* ===== STACK COST CALCULATOR,Mr LAD vs standalone tools ===== */}
          <div className="ucalc-section">
            <div className="ucalc-eyebrow"><span>🧮 COST CALCULATOR</span></div>
            <h2 className="ucalc-h">What would this cost without Mr LAD?</h2>
            <p className="ucalc-sub">Set your monthly volume across the funnel. We&apos;ll add up what each capability would cost on the leading standalone tools, then compare it to the Mr LAD plan that covers the same scope.</p>
            <StackCostCalculator onCta={handleGetStarted} />
            <p className="ucalc-foot">
              Standalone-tool prices are publicly listed mid-range values as of 2026 (single seat where applicable). Flat-fee tools engage the moment that capability is active (slider &gt; 0). Voice is metered at <b>$0.20/min</b>. WhatsApp message fees are billed directly by Meta on every plan. Mr LAD adds zero markup, ever.
            </p>
          </div>

          <div className="note">
            <h4>How usage billing works</h4>
            AI plans include a monthly AI usage allowance; beyond it, usage is metered from your pre-paid wallet at transparent per-action rates, with voice minutes and enrichment credits ($0.20 each) billed the same way. WhatsApp message fees are billed directly by Meta to your own card on every plan. Mr LAD adds zero markup, ever. *Unlimited WhatsApp broadcasts means no platform cap; Meta&apos;s per-message fees still apply and are paid by you directly to Meta. No surprise invoices. Your wallet is the ceiling, and you control the top-ups.
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
          /* margin-top:auto pushes the CTA to the bottom of the flex card,
             so all CTAs sit on the same baseline regardless of how many
             lines the description occupies above. */
          .plan-card .cta { display: block; width: 100%; margin-top: auto; background: var(--ink); color: #fff; border: none; cursor: pointer; text-decoration: none; font-size: 12px; font-weight: 600; padding: 7px 0; border-radius: 7px; font-family: inherit; }
          .plan-card.popular .cta { background: var(--teal); }
          .corner { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 13px; color: var(--ink-soft); display: flex; align-items: flex-end; padding: 0 6px 6px; }

          /* Section wrappers,styled by class on <section> rendered in <Section />.
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

          /* ── Usage / credit calculator ───────────────────────────────── */
          .ucalc-section { margin-top: 56px; text-align: center; }
          .ucalc-eyebrow { display: flex; justify-content: center; margin-bottom: 14px; }
          .ucalc-eyebrow :global(span) { background: #E8EEFD; color: #2E50CC; font-family: 'Sora', sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 1.2px; padding: 7px 18px; border-radius: 999px; }
          .ucalc-h { font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -.4px; color: var(--ink); }
          .ucalc-sub { color: var(--ink-soft); margin-top: 8px; font-size: 14px; }
          .ucalc-foot { color: var(--ink-soft); margin: 24px auto 0; font-size: 11.5px; max-width: 820px; text-align: center; }

          /* Two-column grid */
          .pricing-root :global(.ucalc-grid) { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 28px; text-align: left; }
          @media (max-width: 900px) { .pricing-root :global(.ucalc-grid) { grid-template-columns: 1fr; } }

          /* Input groups,pastel tinted boxes */
          .pricing-root :global(.ucalc-inputs) { display: flex; flex-direction: column; gap: 18px; }
          .pricing-root :global(.ucalc-group) { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 22px 24px; }
          /* Pillar tints,match the page's pillar colors:
             Outreach=blue, Engage=green, Analyse=amber, Convert=purple. */
          .pricing-root :global(.ucalc-group.ucalc-blue)   { background: #EEF3FE; border-color: #DCE6FD; }
          .pricing-root :global(.ucalc-group.ucalc-green)  { background: #E8F6EC; border-color: #CFE9D6; }
          .pricing-root :global(.ucalc-group.ucalc-amber)  { background: #FDF4E3; border-color: #F6E6C6; }
          .pricing-root :global(.ucalc-group.ucalc-purple) { background: #F1EBFA; border-color: #DCD0F0; }
          .pricing-root :global(.ucalc-group h4) { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 700; color: var(--ink); margin: 0 0 18px; }

          /* Sliders */
          .pricing-root :global(.ucalc-slider) { margin-bottom: 16px; }
          .pricing-root :global(.ucalc-slider:last-child) { margin-bottom: 0; }
          .pricing-root :global(.ucalc-slider-head) { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--ink-soft); margin-bottom: 6px; }
          .pricing-root :global(.ucalc-slider-head b) { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 700; color: var(--ink); }
          .pricing-root :global(.ucalc-slider input[type=range]) { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; background: #D8DDE6; border-radius: 999px; outline: none; cursor: pointer; }
          .pricing-root :global(.ucalc-slider input[type=range]::-webkit-slider-thumb) { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background: #2E62F0; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 3px rgba(46,98,240,.35); cursor: pointer; }
          .pricing-root :global(.ucalc-slider input[type=range]::-moz-range-thumb) { width: 20px; height: 20px; background: #2E62F0; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 3px rgba(46,98,240,.35); cursor: pointer; }
          .pricing-root :global(.ucalc-slider-hint) { display: block; font-size: 11.5px; color: var(--ink-soft); margin-top: 4px; }

          /* Premium-voice checkbox row */
          .pricing-root :global(.ucalc-check) { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--ink); position: relative; }
          .pricing-root :global(.ucalc-check input) { position: absolute; opacity: 0; pointer-events: none; }
          .pricing-root :global(.ucalc-check-box) { width: 16px; height: 16px; border-radius: 3px; border: 1.5px solid #B7C2D4; background: #fff; position: relative; flex: none; }
          .pricing-root :global(.ucalc-check.on .ucalc-check-box) { background: #2E62F0; border-color: #2E62F0; }
          .pricing-root :global(.ucalc-check.on .ucalc-check-box::after) { content: ''; position: absolute; left: 4px; top: 0; width: 5px; height: 10px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }

          /* Breakdown panel,soft blue */
          .pricing-root :global(.ucalc-breakdown) { background: linear-gradient(180deg, #E9EEFB 0%, #DCE3F7 100%); border: 1px solid #C9D4F0; border-radius: 12px; padding: 24px 26px; align-self: start; }
          .pricing-root :global(.ucalc-bd-head) { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .pricing-root :global(.ucalc-bd-head h4) { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; color: var(--ink); margin: 0; }
          .pricing-root :global(.ucalc-bd-ico) { font-size: 18px; color: #2E62F0; }
          .pricing-root :global(.ucalc-bd-row) { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px 0; }
          .pricing-root :global(.ucalc-bd-label) { font-size: 14px; font-weight: 600; color: var(--ink); }
          .pricing-root :global(.ucalc-bd-row small) { display: block; font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; }
          .pricing-root :global(.ucalc-bd-row b) { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 700; color: var(--ink); white-space: nowrap; }
          .pricing-root :global(.ucalc-bd-rule) { border: none; border-top: 1px solid #C2CFEC; margin: 10px 0 14px; }
          /* Standalone total — muted, smaller. Provides context for the
             saving, but visually defers to the Mr LAD card below. */
          .pricing-root :global(.ucalc-total) { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
          .pricing-root :global(.ucalc-total-label) { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 600; color: var(--ink-soft); }
          .pricing-root :global(.ucalc-total small) { display: block; font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; font-weight: 400; }
          .pricing-root :global(.ucalc-total-val) { font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 700; color: var(--ink-soft); line-height: 1; }

          /* Mr LAD card — solid brand-blue, centred, BIG white price. This is
             the visual focal point of the whole calculator panel. */
          .pricing-root :global(.ucalc-rec) { margin-top: 16px; background: #2E62F0; border: 1px solid #2E62F0; border-radius: 12px; padding: 22px 24px 18px; text-align: center; color: #fff; box-shadow: 0 6px 20px rgba(46, 98, 240, 0.25); }
          .pricing-root :global(.ucalc-rec-head) { font-size: 13px; color: rgba(255, 255, 255, 0.85); margin-bottom: 2px; }
          .pricing-root :global(.ucalc-rec-head strong) { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: #fff; margin-left: 2px; }
          .pricing-root :global(.ucalc-rec-price) { font-family: 'Sora', sans-serif; font-size: 56px; font-weight: 700; color: #fff; line-height: 1; margin: 8px 0 10px; letter-spacing: -1px; }
          .pricing-root :global(.ucalc-rec-price small) { font-size: 18px; font-weight: 500; opacity: 0.85; margin-left: 4px; letter-spacing: 0; }
          .pricing-root :global(.ucalc-rec-sub) { font-size: 12.5px; color: rgba(255, 255, 255, 0.88); margin-bottom: 14px; }
          .pricing-root :global(.ucalc-rec-empty) { font-size: 14px; color: rgba(255, 255, 255, 0.95); padding: 22px 0; margin-bottom: 0; }

          /* "You save" pill — white background reads cleanly on the blue card. */
          .pricing-root :global(.ucalc-save) { display: inline-block; font-size: 13px; color: var(--ink); background: #fff; padding: 6px 14px; border-radius: 999px; }
          .pricing-root :global(.ucalc-save b) { font-family: 'Sora', sans-serif; color: var(--teal); }
          .pricing-root :global(.ucalc-bd-empty) { padding: 14px 0; font-size: 13px; color: var(--ink-soft); font-style: italic; text-align: center; }
          .pricing-root :global(.ucalc-cta) { margin-top: 14px; width: 100%; background: #2E62F0; color: #fff; font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; border: none; border-radius: 10px; padding: 13px 0; cursor: pointer; transition: background .15s; }
          .pricing-root :global(.ucalc-cta:hover) { background: #244FCC; }

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

// Cell helpers,kept tiny so each <FRow cells={[...]}/> reads like a row of values.
function Yes({ children }: { children?: React.ReactNode }) {
  return <div className="cell"><span className="yes">{children ?? '✓'}</span></div>;
}
function No() {
  return <div className="cell"><span className="no">–</span></div>;
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

// ─── Stack-cost calculator (Mr LAD vs standalone tools) ──────────────────
// Same visual model as the screenshot,slider inputs on the left grouped
// by capability, live cost breakdown + recommended plan on the right,but
// the breakdown shows what each capability would cost on the leading
// STANDALONE tools at the visitor's chosen volume. Mr LAD is anchored to
// the smallest plan tier that natively covers all active capabilities.

/** Mid-range standalone-tool prices (single seat where applicable), USD/mo. */
const TOOL_COSTS = {
  // ── Outreach ────────────────────────────────────────────────────────
  prospectDb:        99,   // Sales database,flat per seat (Apollo Pro tier)
  phoneRevealEach:   0.50, // Phone-number reveal credit
  linkedinTool:      129,  // LinkedIn outreach tool (Expandi / Dripify, mid of $59–$199)
  emailSender:       79,   // Cold-email sender (Instantly / Smartlead, mid of $37–$159)
  // ── Engage ──────────────────────────────────────────────────────────
  waPlatform:        49,   // WhatsApp broadcast (Wati / AiSensy, mid of $18–$75)
  aiChatbot:         79,   // AI chatbot add-on (respond.io / Wati chatbot)
  igAutomation:      35,   // Instagram DM automation (ManyChat / Chatfuel)
  // ── Analyse ─────────────────────────────────────────────────────────
  attribution:       300,  // Multi-channel attribution (Triple Whale / Northbeam, mid of $250–$500)
  convIntelPerSeat:  99,   // Conversation intelligence (Gong Lite, mid of $79–$199)
  // ── Convert ─────────────────────────────────────────────────────────
  voicePerMin: 0.20,         // AI voice (Vapi / Retell / Bland, mid of $0.13–$0.31)
  crmPerSeat:  49,           // CRM seat (HubSpot / Salesforce, mid of $25–$99)
} as const;

/** Mr LAD plan tiers, ordered cheapest → most capable. Mirrors the comparison sections above. */
type PlanKey = 'broadcast' | 'starter' | 'growth' | 'scale';
const PLAN_ORDER: PlanKey[] = ['broadcast', 'starter', 'growth', 'scale'];
const PLAN_INFO: Record<PlanKey, { name: string; price: number }> = {
  broadcast: { name: 'Broadcast', price: 39 },
  starter:   { name: 'Starter',   price: 99 },
  growth:    { name: 'Growth',    price: 199 },
  scale:     { name: 'Scale',     price: 499 },
};

function formatNum(n: number) { return Math.round(n).toLocaleString('en-US'); }
function formatUsd(n: number) { return `$${formatNum(n)}`; }
/** Returns the highest-required plan from a list of plan requirements. */
function highestPlan(required: PlanKey[]): PlanKey | null {
  if (required.length === 0) return null;
  return PLAN_ORDER[Math.max(...required.map(p => PLAN_ORDER.indexOf(p)))];
}

function StackCostCalculator({ onCta }: { onCta: () => void }) {
  // Sliders are now grouped by the four product pillars,Outreach,
  // Engage, Analyse, Convert,matching the comparison sections above.
  // Defaults land in a "Scale" recommendation so the saving is visible on
  // first paint; visitors can dial individual pillars down or up.

  // ── Outreach ─────────────────────────────────────────────────────────
  const [prospects,    setProspects]    = useState(200);
  const [phoneReveals, setPhoneReveals] = useState(50);
  const [linkedinActs, setLinkedinActs] = useState(50);
  const [emails,       setEmails]       = useState(1000);
  // ── Engage ───────────────────────────────────────────────────────────
  const [waMessages,    setWaMessages]    = useState(500);
  const [conversations, setConversations] = useState(100);
  const [igAutomations, setIgAutomations] = useState(50);
  // ── Analyse ──────────────────────────────────────────────────────────
  const [attrChannels,  setAttrChannels]  = useState(4);
  const [convIntelSeats,setConvIntelSeats]= useState(2);
  // ── Convert ──────────────────────────────────────────────────────────
  const [calls,    setCalls]    = useState(200);
  const [callLen,  setCallLen]  = useState(8);
  const [crmSeats, setCrmSeats] = useState(3);

  // ── Per-line standalone costs ────────────────────────────────────────
  // Outreach
  const dbCost     = prospects > 0    ? TOOL_COSTS.prospectDb     : 0;
  const revealCost = phoneReveals * TOOL_COSTS.phoneRevealEach;
  const liCost     = linkedinActs > 0 ? TOOL_COSTS.linkedinTool   : 0;
  const emailCost  = emails > 0       ? TOOL_COSTS.emailSender    : 0;
  // Engage
  const waCost  = waMessages > 0    ? TOOL_COSTS.waPlatform    : 0;
  const botCost = conversations > 0 ? TOOL_COSTS.aiChatbot     : 0;
  const igCost  = igAutomations > 0 ? TOOL_COSTS.igAutomation  : 0;
  // Analyse
  const attrCost     = attrChannels > 0 ? TOOL_COSTS.attribution : 0;
  const convIntelCost = convIntelSeats * TOOL_COSTS.convIntelPerSeat;
  // Convert
  const voiceMins = calls * callLen;
  const voiceCost = voiceMins * TOOL_COSTS.voicePerMin;
  const crmCost   = crmSeats * TOOL_COSTS.crmPerSeat;

  const total =
    dbCost + revealCost + liCost + emailCost +
    waCost + botCost + igCost +
    attrCost + convIntelCost +
    voiceCost + crmCost;

  // ── Required Mr LAD plan per pillar/capability ───────────────────────
  // Voice is Scale-only. Engage AI agents + Instagram + multi-channel
  // analytics need Growth. Outreach + CRM seats need Starter. WhatsApp
  // broadcasts alone fit Broadcast.
  const required: PlanKey[] = [];
  if (voiceMins > 0)                                            required.push('scale');
  if (conversations > 0 || igAutomations > 0 ||
      attrChannels > 0 || convIntelSeats > 0)                   required.push('growth');
  if (linkedinActs > 0 || emails > 0 ||
      prospects > 0 || crmSeats > 0)                            required.push('starter');
  if (waMessages > 0)                                           required.push('broadcast');
  const planKey = highestPlan(required);
  const plan    = planKey ? PLAN_INFO[planKey] : null;
  const ladPrice  = plan ? plan.price : 0;
  const savings   = Math.max(0, total - ladPrice);
  const ladCheaper = plan != null && total >= ladPrice;

  return (
    <div className="ucalc-grid">

      {/* ── Inputs (left column),grouped by product pillar ─────────── */}
      <div className="ucalc-inputs">

        <div className="ucalc-group ucalc-blue">
          <h4>Outreach</h4>
          <Slider label="Prospects discovered per month" min={0} max={500} step={10} value={prospects} onChange={setProspects}
            hint={`Sales database (Apollo / ZoomInfo), $${TOOL_COSTS.prospectDb} flat once active`} />
          <Slider label="Phone number reveals" min={0} max={200} step={5} value={phoneReveals} onChange={setPhoneReveals}
            hint={`$${TOOL_COSTS.phoneRevealEach.toFixed(2)} per reveal`} />
          <Slider label="LinkedIn connection actions" min={0} max={300} step={10} value={linkedinActs} onChange={setLinkedinActs}
            hint={`LinkedIn tool (Expandi / Dripify), $${TOOL_COSTS.linkedinTool} flat once active`} />
          <Slider label="Cold emails sent" min={0} max={10000} step={100} value={emails} onChange={setEmails}
            hint={`Email sender (Instantly / Smartlead), $${TOOL_COSTS.emailSender} flat once active`} />
        </div>

        <div className="ucalc-group ucalc-green">
          <h4>Engage</h4>
          <Slider label="WhatsApp template messages sent" min={0} max={5000} step={50} value={waMessages} onChange={setWaMessages}
            hint={`Broadcast platform (Wati / AiSensy), $${TOOL_COSTS.waPlatform} flat once active`} />
          <Slider label="AI conversations handled (WhatsApp / IG)" min={0} max={1000} step={10} value={conversations} onChange={setConversations}
            hint={`AI chatbot add-on (respond.io / Wati chatbot), $${TOOL_COSTS.aiChatbot} flat once active`} />
          <Slider label="Instagram DM automations" min={0} max={500} step={10} value={igAutomations} onChange={setIgAutomations}
            hint={`IG automation (ManyChat / Chatfuel), $${TOOL_COSTS.igAutomation} flat once active`} />
        </div>

        <div className="ucalc-group ucalc-amber">
          <h4>Analyse</h4>
          <Slider label="Marketing channels to attribute" min={0} max={10} step={1} value={attrChannels} onChange={setAttrChannels}
            hint={`Attribution platform (Triple Whale / Northbeam), $${TOOL_COSTS.attribution} flat once active`} />
          <Slider label="Conversation-intelligence seats" min={0} max={20} step={1} value={convIntelSeats} onChange={setConvIntelSeats}
            hint={`Gong Lite / Chorus, $${TOOL_COSTS.convIntelPerSeat} per seat / mo`} />
        </div>

        <div className="ucalc-group ucalc-purple">
          <h4>Convert</h4>
          <Slider label="Number of voice calls per month" min={0} max={500} step={10} value={calls} onChange={setCalls} />
          <Slider label="Average call length (minutes)" min={1} max={30} step={1} value={callLen} onChange={setCallLen} />
          <Slider label="Sales team CRM seats" min={0} max={20} step={1} value={crmSeats} onChange={setCrmSeats}
            hint={`CRM (HubSpot / Salesforce / Pipedrive), $${TOOL_COSTS.crmPerSeat} per seat / mo`} />
        </div>

      </div>

      {/* ── Live cost breakdown (right column) ───────────────────────── */}
      <aside className="ucalc-breakdown">
        <div className="ucalc-bd-head">
          <h4>Standalone-tool stack</h4>
          <span className="ucalc-bd-ico" aria-hidden>🧮</span>
        </div>

        {/* Outreach */}
        {dbCost > 0 && (
          <BLine label="Sales database" sub={`Flat seat fee, ${formatNum(prospects)} prospects / mo`} value={formatUsd(dbCost)} />
        )}
        {revealCost > 0 && (
          <BLine label="Phone-reveal credits" sub={`${formatNum(phoneReveals)} reveals × $${TOOL_COSTS.phoneRevealEach.toFixed(2)}`} value={formatUsd(revealCost)} />
        )}
        {liCost > 0 && (
          <BLine label="LinkedIn outreach tool" sub={`Flat seat fee, ${formatNum(linkedinActs)} actions / mo`} value={formatUsd(liCost)} />
        )}
        {emailCost > 0 && (
          <BLine label="Cold-email sender" sub={`Flat fee, ${formatNum(emails)} emails / mo`} value={formatUsd(emailCost)} />
        )}
        {/* Engage */}
        {waCost > 0 && (
          <BLine label="WhatsApp broadcast platform" sub={`Flat fee, ${formatNum(waMessages)} templates / mo`} value={formatUsd(waCost)} />
        )}
        {botCost > 0 && (
          <BLine label="AI chatbot add-on" sub={`Flat fee, ${formatNum(conversations)} conversations / mo`} value={formatUsd(botCost)} />
        )}
        {igCost > 0 && (
          <BLine label="Instagram DM automation" sub={`Flat fee, ${formatNum(igAutomations)} automations / mo`} value={formatUsd(igCost)} />
        )}
        {/* Analyse */}
        {attrCost > 0 && (
          <BLine label="Multi-channel attribution" sub={`Flat fee, ${formatNum(attrChannels)} channels tracked`} value={formatUsd(attrCost)} />
        )}
        {convIntelCost > 0 && (
          <BLine label="Conversation intelligence" sub={`${formatNum(convIntelSeats)} seats × $${TOOL_COSTS.convIntelPerSeat}`} value={formatUsd(convIntelCost)} />
        )}
        {/* Convert */}
        {voiceCost > 0 && (
          <BLine label="AI voice agent" sub={`${formatNum(voiceMins)} mins × $${TOOL_COSTS.voicePerMin.toFixed(2)}/min`} value={formatUsd(voiceCost)} />
        )}
        {crmCost > 0 && (
          <BLine label="CRM seats" sub={`${formatNum(crmSeats)} seats × $${TOOL_COSTS.crmPerSeat}`} value={formatUsd(crmCost)} />
        )}
        {total === 0 && (
          <div className="ucalc-bd-empty">Adjust a slider to see the standalone-tool cost build up here.</div>
        )}

        <hr className="ucalc-bd-rule" />

        {/* Standalone total — kept above the Mr LAD card so the saving has
            context, but visually muted; the Mr LAD price below is the focus. */}
        <div className="ucalc-total">
          <div>
            <div className="ucalc-total-label">If you bought these separately</div>
            <small>Monthly cost across the standalone tools above</small>
          </div>
          <b className="ucalc-total-val">{total === 0 ? '$0' : formatUsd(total)}</b>
        </div>

        {/* Mr LAD card — solid blue, big white price (visual focus). */}
        {plan ? (
          <div className="ucalc-rec">
            <div className="ucalc-rec-head">
              With Mr LAD <strong>{plan.name}</strong>
            </div>
            <div className="ucalc-rec-price">
              ${plan.price}<small>/mo</small>
            </div>
            <div className="ucalc-rec-sub">Everything above, billed as one subscription</div>
            {ladCheaper && savings > 0 && (
              <span className="ucalc-save">You save <b>{formatUsd(savings)}/mo</b></span>
            )}
          </div>
        ) : (
          <div className="ucalc-rec ucalc-rec-empty">
            <span>Pick activity to compare →</span>
          </div>
        )}

        <button type="button" className="ucalc-cta" onClick={onCta}>Get Started</button>
      </aside>

    </div>
  );
}

/** Range-slider row used inside the input groups. */
function Slider({ label, min, max, step = 1, value, onChange, hint }: {
  label: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="ucalc-slider">
      <div className="ucalc-slider-head">
        <span>{label}</span>
        <b>{formatNum(value)}</b>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} aria-label={label} />
      {hint && <small className="ucalc-slider-hint">{hint}</small>}
    </div>
  );
}

/** Native checkbox styled as a pill toggle. */
function CheckRow({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className={`ucalc-check${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="ucalc-check-box" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

/** One line of the standalone-tool cost panel. `value` is pre-formatted ($X). */
function BLine({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="ucalc-bd-row">
      <div>
        <div className="ucalc-bd-label">{label}</div>
        <small>{sub}</small>
      </div>
      <b>{value}</b>
    </div>
  );
}
