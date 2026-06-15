import type { Metadata } from 'next';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Account Deletion Policy | Mr LAD',
  description:
    'How Mr LAD (TechieMaya FZE) handles account deletion requests and what happens to associated data upon deletion.',
};

export default function AccountDeletionPolicyPage() {
  return (
    <LegalPageLayout
      title="Account Deletion Policy"
      lastUpdated="May 29, 2026"
      activePath="/account-deletion-policy"
      intro="At Mr LAD, we respect our clients' privacy and their right to control their data. This page explains how account deletion requests are handled and what happens to associated data."
    >
      <h2 id="requesting-deletion">Requesting Account Deletion</h2>
      <p>
        Mr LAD accounts are created by our team for authorized tenants. To delete your account and
        associated data, contact us:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{' '}
          <a href="mailto:support@techiemaya.com">support@techiemaya.com</a>
        </li>
        <li>
          <strong>Subject:</strong> Account Deletion Request
        </li>
      </ul>
      <p>Please include:</p>
      <ul>
        <li>Company Name</li>
        <li>Registered User Name</li>
        <li>Registered Email Address</li>
        <li>Registered Phone Number</li>
      </ul>
      <p>Our team may verify your identity before processing.</p>

      <h2 id="data-deleted">Data That Will Be Deleted</h2>
      <p>Upon approval, we will permanently delete or anonymize:</p>
      <ul>
        <li>User profile information</li>
        <li>Login credentials and account access</li>
        <li>Conversation history</li>
        <li>Chat messages</li>
        <li>Lead journey records</li>
        <li>Campaign-related data</li>
        <li>Contact information stored within account</li>
        <li>Account preferences and settings</li>
      </ul>

      <h2 id="data-retained">Data That May Be Retained</h2>
      <p>Certain information may be retained when required for:</p>
      <ul>
        <li>Legal obligations</li>
        <li>Regulatory compliance</li>
        <li>Fraud prevention</li>
        <li>Security investigations</li>
        <li>Internal audit requirements</li>
      </ul>
      <p>Retained information will be securely stored with restricted access.</p>

      <h2 id="timeframe">Deletion Timeframe</h2>
      <p>
        Requests processed within <strong>30 days</strong> of verification and approval.
      </p>

      <h2 id="important-notes">Important Notes</h2>
      <ul>
        <li>Deletion is permanent and cannot be reversed</li>
        <li>Account access cannot be restored after deletion</li>
        <li>Removed data cannot be recovered</li>
        <li>
          Active services or contractual obligations may need resolution before deletion proceeds
        </li>
      </ul>

      <h2 id="contact">Contact Us</h2>
      <ul>
        <li>
          <strong>Email:</strong>{' '}
          <a href="mailto:support@techiemaya.com">support@techiemaya.com</a>
        </li>
        <li>
          <strong>TechieMaya FZE</strong> — IDS Business Center, Al Karama, Dubai, United Arab
          Emirates
        </li>
      </ul>
    </LegalPageLayout>
  );
}
