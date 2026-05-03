import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, {
  heading,
  body,
  btnPrimary,
  badge,
  divider,
  coralSection,
} from './GenesisLayout';

interface PaymentFailedEmailProps {
  userName: string;
  planName: string;
  amount: string;
  retryDate: string;
  updatePaymentUrl: string;
}

export default function PaymentFailedEmail({
  userName,
  planName,
  amount,
  retryDate,
  updatePaymentUrl,
}: PaymentFailedEmailProps) {
  return (
    <GenesisLayout preview="Action required — your payment could not be processed">
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Action required</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>Your payment needs attention.</Text>

      {/* Body */}
      <Text style={body()}>
        Hi {userName}, we couldn&rsquo;t process your {amount} payment for the {planName} plan.
        We&rsquo;ll retry on {retryDate}.
      </Text>

      {/* Coral section */}
      <Section style={coralSection}>
        <Text style={heading(22, { color: '#FFFFFF', align: 'center', margin: '0 0 4px 0' })}>
          {amount}
        </Text>
        <Text style={body({ size: 14, color: '#FFFFFF', margin: '4px 0 0 0', align: 'center' })}>
          Next retry: {retryDate}
        </Text>
        <Text style={body({ size: 13, color: '#FFFFFF', margin: '12px 0 0 0', align: 'center' })}>
          Update your payment method to avoid interruption.
        </Text>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={updatePaymentUrl} style={btnPrimary}>
          Update Payment Method
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Need help? Reply to this email.
      </Text>
    </GenesisLayout>
  );
}

PaymentFailedEmail.PreviewProps = {
  userName: 'Alex',
  planName: 'Creator',
  amount: '$19.99',
  retryDate: 'March 14, 2026',
  updatePaymentUrl: 'https://iamazeyou.me/settings',
} satisfies PaymentFailedEmailProps;
