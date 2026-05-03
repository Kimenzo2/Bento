import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface CollaborationInviteEmailProps {
  inviterName: string;
  bookTitle: string;
  role: string;
  inviteUrl: string;
  expiryDays?: number;
}

export default function CollaborationInviteEmail({
  inviterName,
  bookTitle,
  role,
  inviteUrl,
  expiryDays = 7,
}: CollaborationInviteEmailProps) {
  return (
    <GenesisLayout preview={`${inviterName} invited you to collaborate on "${bookTitle}"`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Collaboration</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>You&rsquo;re invited to collaborate.</Text>

      {/* Body */}
      <Text style={body()}>{inviterName} invited you to collaborate on their book.</Text>

      {/* Book title callout */}
      <Section style={{ ...callout, textAlign: 'center' }}>
        <Text style={heading(22, { align: 'center', margin: '0' })}>&ldquo;{bookTitle}&rdquo;</Text>
      </Section>

      {/* Role callout */}
      <Section style={callout}>
        <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Your role</Text>
        <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>{role}</Text>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={inviteUrl} style={btnPrimary}>
          Accept Invitation
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        This invitation expires in {expiryDays} day{expiryDays > 1 ? 's' : ''}.
      </Text>
    </GenesisLayout>
  );
}

CollaborationInviteEmail.PreviewProps = {
  inviterName: 'Jordan',
  bookTitle: 'The Cosmic Explorer',
  role: 'Editor',
  inviteUrl: 'https://iamazeyou.me/invite/abc123',
  expiryDays: 7,
} satisfies CollaborationInviteEmailProps;
