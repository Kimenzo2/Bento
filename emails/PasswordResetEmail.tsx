import { Text, Button, Section, Link } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface PasswordResetEmailProps {
  resetLink: string;
  expiryHours?: number;
}

export default function PasswordResetEmail({
  resetLink,
  expiryHours = 1,
}: PasswordResetEmailProps) {
  return (
    <GenesisLayout preview="Reset your Genesis password">
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Security</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>
        Reset your password.
      </Text>

      {/* Body */}
      <Text style={body()}>
        We received a request to reset your Genesis account password. Click
        the button below to choose a new one.
      </Text>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={resetLink} style={btnPrimary}>
          Reset Password
        </Button>
      </Section>

      {/* Expiry note */}
      <Text style={body({ size: 14, margin: '0 0 20px 0' })}>
        This link expires in {expiryHours} hour{expiryHours > 1 ? 's' : ''} and can
        only be used once.
      </Text>

      {/* Callout */}
      <Section style={callout}>
        <Text style={body({ size: 14, margin: '0' })}>
          <span style={body({ size: 14, weight: 600, margin: '0' })}>Didn&rsquo;t request this?</span>{' '}
          You can safely ignore this email. Your password will remain unchanged.
          If you&rsquo;re concerned, please{' '}
          <Link href="mailto:hello@iamazeyou.me" style={{ color: '#FF9B71', textDecoration: 'underline' }}>
            contact support
          </Link>.
        </Text>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Automated security email from Genesis.
      </Text>
    </GenesisLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  resetLink: 'https://iamazeyou.me/reset?token=abc123def',
  expiryHours: 1,
} satisfies PasswordResetEmailProps;
