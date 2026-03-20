import { Text, Button, Section, Row, Column } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface PaymentSucceededEmailProps {
  userName: string;
  planName: string;
  amount: string;
  currency: string;
  date: string;
  receiptUrl?: string;
}

export default function PaymentSucceededEmail({
  userName,
  planName,
  amount,
  currency,
  date,
  receiptUrl,
}: PaymentSucceededEmailProps) {
  return (
    <GenesisLayout preview={`Payment confirmed — ${planName} plan`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Payment confirmed</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>
        Payment received.
      </Text>

      {/* Callout with payment details */}
      <Section style={callout}>
        <Row style={{ marginBottom: '16px' }}>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Plan</Text>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>{planName}</Text>
          </Column>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Amount</Text>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>{amount} {currency}</Text>
          </Column>
        </Row>
        <Row>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Date</Text>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>{date}</Text>
          </Column>
          <Column>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>Status</Text>
            <Text style={body({ size: 14, weight: 600, color: '#FF9B71', margin: '0' })}>Paid</Text>
          </Column>
        </Row>
      </Section>

      {/* CTA (only if receiptUrl) */}
      {receiptUrl && (
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={receiptUrl} style={btnPrimary}>
            View Receipt
          </Button>
        </Section>
      )}

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Questions about billing? Reply to this email.
      </Text>
    </GenesisLayout>
  );
}

PaymentSucceededEmail.PreviewProps = {
  userName: 'Alex',
  planName: 'Creator',
  amount: '$19.99',
  currency: 'USD',
  date: 'March 11, 2026',
  receiptUrl: 'https://iamazeyou.me/receipt/abc123',
} satisfies PaymentSucceededEmailProps;
