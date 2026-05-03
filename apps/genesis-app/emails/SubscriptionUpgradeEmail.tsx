import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, {
  heading,
  body,
  btnPrimary,
  badge,
  divider,
  darkSection,
} from './GenesisLayout';

interface SubscriptionUpgradeEmailProps {
  userName: string;
  planName: string;
  price: string;
  features: string[];
}

export default function SubscriptionUpgradeEmail({
  userName,
  planName,
  price,
  features,
}: SubscriptionUpgradeEmailProps) {
  return (
    <GenesisLayout preview={`Your ${planName} plan is now active`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Plan upgraded</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>Welcome to {planName}.</Text>

      {/* Dark section — plan + price */}
      <Section style={darkSection}>
        <Text
          style={body({
            size: 12,
            color: '#EAE0D5',
            margin: '0 0 4px 0',
            weight: 600,
            align: 'center',
          })}
        >
          ACTIVE PLAN
        </Text>
        <Text style={heading(24, { color: '#FFFFFF', align: 'center', margin: '0' })}>
          {planName}
        </Text>
        <Text style={body({ size: 14, color: '#EAE0D5', margin: '6px 0 0 0', align: 'center' })}>
          {price}
        </Text>
      </Section>

      {/* Feature list */}
      {features.map((feature, i) => (
        <Text key={i} style={body({ size: 14, margin: '0 0 8px 0' })}>
          <span style={{ color: '#FF9B71' }}>&rarr;</span> {feature}
        </Text>
      ))}

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href="https://iamazeyou.me" style={btnPrimary}>
          Start Creating
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Manage subscription in Settings.
      </Text>
    </GenesisLayout>
  );
}

SubscriptionUpgradeEmail.PreviewProps = {
  userName: 'Alex',
  planName: 'Creator',
  price: '$19.99/mo',
  features: [
    'Unlimited ebooks',
    '20+ illustration styles',
    'Commercial license',
    'Priority support',
  ],
} satisfies SubscriptionUpgradeEmailProps;
