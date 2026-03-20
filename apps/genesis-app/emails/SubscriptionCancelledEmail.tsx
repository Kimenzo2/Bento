import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, badge, divider, callout, btnSecondary } from './GenesisLayout';

interface SubscriptionCancelledEmailProps {
  userName: string;
  planName: string;
  endDate: string;
}

export default function SubscriptionCancelledEmail({
  userName,
  planName,
  endDate,
}: SubscriptionCancelledEmailProps) {
  return (
    <GenesisLayout preview={`Your ${planName} subscription has been cancelled`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Subscription update</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>
        Your {planName} plan is cancelled.
      </Text>

      {/* Body */}
      <Text style={body()}>
        Hi {userName}, your subscription has been cancelled. You&rsquo;ll keep
        access to all {planName} features until{' '}
        <span style={body({ weight: 600, margin: '0' })}>{endDate}</span>.
      </Text>

      {/* Callout — what happens */}
      <Section style={callout}>
        <Text style={body({ size: 14, margin: '0 0 8px 0' })}>
          <span style={body({ size: 14, weight: 600, margin: '0' })}>Access until:</span> {endDate}
        </Text>
        <Text style={body({ size: 14, margin: '0' })}>
          After this date, your account reverts to the free{' '}
          <span style={body({ size: 14, weight: 600, margin: '0' })}>Spark</span> tier.
          Your existing books and content will be preserved.
        </Text>
      </Section>

      {/* CTA (secondary) */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href="https://iamazeyou.me/settings" style={btnSecondary}>
          Resubscribe
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Your content is safe.
      </Text>
    </GenesisLayout>
  );
}

SubscriptionCancelledEmail.PreviewProps = {
  userName: 'Alex',
  planName: 'Creator',
  endDate: 'April 11, 2026',
} satisfies SubscriptionCancelledEmailProps;
