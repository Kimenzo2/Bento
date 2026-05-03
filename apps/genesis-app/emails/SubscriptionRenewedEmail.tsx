import { Text, Button, Section, Row, Column } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface SubscriptionRenewedEmailProps {
  userName: string;
  planName: string;
  amount: string;
  nextRenewalDate: string;
}

export default function SubscriptionRenewedEmail({
  userName,
  planName,
  amount,
  nextRenewalDate,
}: SubscriptionRenewedEmailProps) {
  return (
    <GenesisLayout preview={`Your ${planName} subscription has been renewed`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Renewal confirmed</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>Your {planName} plan renewed.</Text>

      {/* Callout with renewal details */}
      <Section style={callout}>
        <Row>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Plan</Text>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>
              {planName}
            </Text>
          </Column>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Amount</Text>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>
              {amount}
            </Text>
          </Column>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>
              Next renewal
            </Text>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>
              {nextRenewalDate}
            </Text>
          </Column>
        </Row>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href="https://iamazeyou.me" style={btnPrimary}>
          Continue Creating
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Manage plan in Settings.
      </Text>
    </GenesisLayout>
  );
}

SubscriptionRenewedEmail.PreviewProps = {
  userName: 'Alex',
  planName: 'Creator',
  amount: '$19.99',
  nextRenewalDate: 'April 11, 2026',
} satisfies SubscriptionRenewedEmailProps;
