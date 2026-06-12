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

          {/* ===== OUTREACH : LINKEDIN ===== */}
          <Section id="linkedin" pillar="o" title="Outreach — LinkedIn"
            bench={<>Standalone LinkedIn outreach tools run <b>$59–$199/seat/mo</b> — none of them research each prospect or hand conversations off to other channels.</>}
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
          <Section id="broadcast" pillar="e" title="Engage — Broadcasting (Email & WhatsApp)"
            bench={<>Standalone broadcast platforms charge <b>$18–$60+/mo</b> and add a <b>20–60% markup</b> on every WhatsApp message you send. Mr LAD adds <b>0%</b>.</>}
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

          {/* ===== ENGAGE : AI AGENTS ===== */}
          <Section id="engage-ai" pillar="e" title="Engage — AI conversation agents"
            bench={<>AI chat agents are extra-cost add-ons (<b>~$40/mo</b>) or gated to enterprise tiers (<b>$79+/mo</b>) on most platforms. With Mr LAD they&apos;re included from Growth onward.</>}
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

          {/* ===== ENGAGE : ADS ===== */}
          <Section id="ads" pillar="e" title="Engage — Meta Ads (managed)"
            bench={<>Standalone ad-automation tools run <b>$44–$99+/mo</b> tiered by spend; agencies charge <b>10–20% of ad spend</b>. Mr LAD runs the ads <i>and</i> answers every lead they generate.</>}
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

          {/* ===== CONVERT : VOICE ===== */}
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

          {/* ===== CONVERT : SCHEDULING + CRM ===== */}
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

          {/* ===== COST COMPARISON CALCULATOR ===== */}
          <div className="calc-section">
            <h2 className="calc-h">Cost comparison calculator</h2>
            <p className="calc-sub">
              See what each pillar would cost if you built it with the leading standalone tools. Toggle the ones you&apos;d realistically use; the running total updates and you can compare it to the Mr LAD plan that includes the equivalent capability.
            </p>
            {COST_COMPARISON.map(p => <PillarCalculator key={p.id} data={p} />)}
            <p className="calc-foot">
              Ranges reflect publicly listed pricing as of 2026 and may shift; usage-based items (e.g. voice minutes) are estimated at a 500-min/month sample volume. Mr LAD plan prices shown are the smallest plan that includes the comparable Mr LAD capability — heavier usage may need the next tier.
            </p>
          </div>

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

          /* ── Cost-comparison calculator ──────────────────────────────── */
          .calc-section { margin-top: 48px; }
          .calc-h { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -.3px; }
          .calc-sub { color: var(--ink-soft); margin-top: 6px; max-width: 760px; font-size: 13px; }
          .calc-foot { color: var(--ink-soft); margin-top: 14px; font-size: 11.5px; max-width: 760px; }

          /* Each card */
          .pricing-root :global(.calc-card) { margin-top: 20px; background: var(--card); border: 1px solid var(--line); border-left: 5px solid var(--ink-soft); border-radius: 12px; padding: 18px 20px; }
          .pricing-root :global(.calc-card.calc-o) { border-left-color: var(--outreach); }
          .pricing-root :global(.calc-card.calc-e) { border-left-color: var(--engage); }
          .pricing-root :global(.calc-card.calc-a) { border-left-color: var(--analyse); }
          .pricing-root :global(.calc-card.calc-c) { border-left-color: var(--convert); }

          .pricing-root :global(.calc-card-head) { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
          .pricing-root :global(.calc-title) { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; margin: 0; }
          .pricing-root :global(.calc-blurb) { color: var(--ink-soft); font-size: 12.5px; margin-top: 4px; max-width: 600px; }
          .pricing-root :global(.calc-lad-tag) { font-size: 12px; color: var(--ink); background: var(--teal-soft); border: 1px solid #C8E8E2; padding: 6px 12px; border-radius: 999px; white-space: nowrap; }
          .pricing-root :global(.calc-lad-tag b) { font-family: 'Sora', sans-serif; color: var(--teal); }

          /* Tool list */
          .pricing-root :global(.calc-list) { list-style: none; margin: 14px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          @media (max-width: 720px) { .pricing-root :global(.calc-list) { grid-template-columns: 1fr; } }
          .pricing-root :global(.calc-row) { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: border-color .12s, background .12s; background: #FBFCFE; }
          .pricing-root :global(.calc-row:hover) { border-color: #C5D1E0; }
          .pricing-root :global(.calc-row.on) { border-color: var(--teal); background: var(--teal-soft); }
          .pricing-root :global(.calc-row input[type=checkbox]) { position: absolute; opacity: 0; pointer-events: none; }
          .pricing-root :global(.calc-check) { flex: none; width: 18px; height: 18px; border-radius: 4px; border: 1.5px solid #C5D1E0; background: #fff; display: inline-block; position: relative; }
          .pricing-root :global(.calc-row.on .calc-check) { background: var(--teal); border-color: var(--teal); }
          .pricing-root :global(.calc-row.on .calc-check::after) { content: ''; position: absolute; left: 5px; top: 1px; width: 5px; height: 10px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
          .pricing-root :global(.calc-row-text) { flex: 1; min-width: 0; }
          .pricing-root :global(.calc-row-name) { display: block; font-weight: 600; font-size: 12.5px; color: var(--ink); }
          .pricing-root :global(.calc-row-cat) { display: block; font-size: 11px; color: var(--ink-soft); margin-top: 2px; }
          .pricing-root :global(.calc-row-price) { flex: none; font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; }
          .pricing-root :global(.calc-row-price small) { font-size: 10.5px; font-weight: 500; color: var(--ink-soft); margin-left: 2px; }

          /* Totals */
          .pricing-root :global(.calc-totals) { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--line); display: grid; gap: 6px; }
          .pricing-root :global(.calc-total-line) { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--ink-soft); }
          .pricing-root :global(.calc-total-line b) { font-family: 'Sora', sans-serif; font-size: 14px; color: var(--ink); }
          .pricing-root :global(.calc-save) { padding: 8px 10px; border-radius: 6px; }
          .pricing-root :global(.calc-save.on) { background: var(--teal-soft); color: var(--ink); }
          .pricing-root :global(.calc-save.on b) { color: var(--teal); }

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

// ─── Cost-comparison calculator ──────────────────────────────────────────
// Interactive — each card lets the visitor pick the standalone tools they'd
// otherwise use; the running stack total is compared to the smallest Mr LAD
// plan that includes the equivalent capability. Pricing ranges are public
// list prices, normalised to USD/month. Voice is sampled at 500 min/mo
// since per-minute rates aren't directly comparable to flat plans.
interface Competitor {
  id: string;
  /** Product name as the visitor recognises it. */
  label: string;
  /** Short qualifier shown under the label, e.g. "LinkedIn outreach". */
  category: string;
  /** Monthly USD range — min..max. For per-seat/per-user tools this is the seat price. */
  min: number;
  max: number;
  /** Unit suffix to render after the price range. */
  unit: string;
  /** Pre-selected on first render? Lets us show a sensible non-zero default total. */
  defaultOn?: boolean;
}
interface PillarComparison {
  id: 'outreach' | 'engage' | 'analyse' | 'convert';
  pillar: 'o' | 'e' | 'a' | 'c';
  title: string;
  blurb: string;
  competitors: Competitor[];
  mrLad: { plan: string; price: number };
}

const COST_COMPARISON: PillarComparison[] = [
  {
    id: 'outreach', pillar: 'o',
    title: 'Outreach',
    blurb: 'LinkedIn + Email outbound, prospect research, and reply handling.',
    competitors: [
      { id: 'li',  label: 'LinkedIn outreach tool',     category: 'e.g. Expandi, Dripify, HeyReach', min: 59,  max: 199, unit: '/seat/mo', defaultOn: true },
      { id: 'em',  label: 'Cold-email sender',          category: 'e.g. Instantly, Smartlead, lemlist', min: 37,  max: 159, unit: '/seat/mo', defaultOn: true },
      { id: 'db',  label: 'Prospect database / enrichment', category: 'e.g. Apollo, ZoomInfo, Lusha', min: 49,  max: 149, unit: '/user/mo' },
      { id: 'res', label: 'Web research / scraping',    category: 'e.g. Clay, PhantomBuster',         min: 49,  max: 150, unit: '/mo' },
    ],
    mrLad: { plan: 'Starter', price: 99 },
  },
  {
    id: 'engage', pillar: 'e',
    title: 'Engage',
    blurb: 'WhatsApp broadcasts, AI chat agents, Instagram DM automation, and Meta Ads management.',
    competitors: [
      { id: 'wa',   label: 'WhatsApp broadcast platform',         category: 'e.g. AiSensy, Wati, MessageBird',     min: 18, max: 75,  unit: '/mo', defaultOn: true },
      { id: 'bot',  label: 'WhatsApp AI chatbot add-on',          category: 'e.g. Wati chatbot, respond.io AI',    min: 40, max: 79,  unit: '/mo', defaultOn: true },
      { id: 'ig',   label: 'Instagram DM automation',             category: 'e.g. ManyChat, Chatfuel',             min: 25, max: 79,  unit: '/mo' },
      { id: 'ads',  label: 'Meta Ads automation / management',    category: 'e.g. Madgicx, Revealbot',             min: 44, max: 99,  unit: '/mo' },
    ],
    mrLad: { plan: 'Growth', price: 199 },
  },
  {
    id: 'analyse', pillar: 'a',
    title: 'Analyse',
    blurb: 'Multi-channel attribution, conversation analysis, and executive reporting.',
    competitors: [
      { id: 'attr', label: 'Multi-channel attribution',  category: 'e.g. Triple Whale, Northbeam, Rockerbox', min: 250, max: 500, unit: '/mo', defaultOn: true },
      { id: 'ci',   label: 'Conversation intelligence',  category: 'e.g. Gong Lite, Chorus',                  min: 79,  max: 199, unit: '/user/mo' },
      { id: 'bi',   label: 'Business-intelligence dashboards', category: 'e.g. Mode, Hex, Looker Studio Pro', min: 150, max: 500, unit: '/mo' },
    ],
    mrLad: { plan: 'Growth', price: 199 },
  },
  {
    id: 'convert', pillar: 'c',
    title: 'Convert',
    blurb: 'AI voice follow-up, scheduling, CRM, and post-conversion automation.',
    competitors: [
      { id: 'voice', label: 'AI voice agent (≈500 min/mo)',  category: 'e.g. Vapi, Retell, Bland — $0.13–$0.31/min', min: 65,  max: 155, unit: '/mo', defaultOn: true },
      { id: 'crm',   label: 'CRM seat',                       category: 'e.g. HubSpot, Salesforce, Pipedrive',         min: 25,  max: 99,  unit: '/user/mo', defaultOn: true },
      { id: 'cal',   label: 'Scheduling tool',                category: 'e.g. Calendly, Chili Piper',                  min: 10,  max: 16,  unit: '/user/mo' },
      { id: 'rev',   label: 'Review / referral automation',   category: 'e.g. Birdeye, NiceJob',                       min: 30,  max: 79,  unit: '/mo' },
    ],
    mrLad: { plan: 'Scale', price: 499 },
  },
];

function formatUsd(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function PillarCalculator({ data }: { data: PillarComparison }) {
  // Each calculator owns its own selection state — no cross-pillar coupling.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(data.competitors.filter(c => c.defaultOn).map(c => c.id))
  );
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const picked = data.competitors.filter(c => selected.has(c.id));
  const stackMin = picked.reduce((a, c) => a + c.min, 0);
  const stackMax = picked.reduce((a, c) => a + c.max, 0);
  const ladPrice = data.mrLad.price;
  const saveMin = Math.max(0, stackMin - ladPrice);
  const saveMax = Math.max(0, stackMax - ladPrice);
  const ladCheaper = stackMin >= ladPrice;

  return (
    <div className={`calc-card calc-${data.pillar}`}>
      <div className="calc-card-head">
        <div>
          <h3 className="calc-title">{data.title}</h3>
          <p className="calc-blurb">{data.blurb}</p>
        </div>
        <div className="calc-lad-tag">Mr LAD <b>{data.mrLad.plan}</b> · {formatUsd(ladPrice)}/mo</div>
      </div>

      <ul className="calc-list">
        {data.competitors.map(c => {
          const on = selected.has(c.id);
          return (
            <li key={c.id}>
              <label className={`calc-row${on ? ' on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                <span className="calc-check" aria-hidden />
                <span className="calc-row-text">
                  <span className="calc-row-name">{c.label}</span>
                  <span className="calc-row-cat">{c.category}</span>
                </span>
                <span className="calc-row-price">
                  {formatUsd(c.min)}–{formatUsd(c.max)}<small>{c.unit}</small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="calc-totals">
        <div className="calc-total-line">
          <span>Your selected stack</span>
          <b>{picked.length === 0 ? '—' : `${formatUsd(stackMin)}–${formatUsd(stackMax)}/mo`}</b>
        </div>
        <div className="calc-total-line">
          <span>Mr LAD {data.mrLad.plan}</span>
          <b>{formatUsd(ladPrice)}/mo</b>
        </div>
        <div className={`calc-total-line calc-save${ladCheaper && picked.length > 0 ? ' on' : ''}`}>
          <span>{ladCheaper ? 'You save' : 'Mr LAD price'}</span>
          <b>
            {picked.length === 0
              ? 'Pick some tools to compare →'
              : ladCheaper
                ? saveMin === saveMax
                  ? `${formatUsd(saveMin)}/mo`
                  : `${formatUsd(saveMin)}–${formatUsd(saveMax)}/mo`
                : `Mr LAD is ${formatUsd(ladPrice - stackMax)}–${formatUsd(ladPrice - stackMin)} more — for the AI agents and unified data the stack can't replicate.`}
          </b>
        </div>
      </div>
    </div>
  );
}
