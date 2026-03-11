import { Text, Button, Section, Row, Column } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface WeeklyDigestEmailProps {
  userName: string;
  booksCreated: number;
  wordsWritten: number;
  streakDays: number;
  topBook?: string;
  weekStartDate: string;
}

export default function WeeklyDigestEmail({
  userName,
  booksCreated,
  wordsWritten,
  streakDays,
  topBook,
  weekStartDate,
}: WeeklyDigestEmailProps) {
  return (
    <GenesisLayout
      preview={`Your Genesis week — ${booksCreated} books, ${wordsWritten.toLocaleString()} words`}
      showUnsubscribe
    >
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Weekly digest</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>
        Your week in review.
      </Text>

      {/* Sub-heading */}
      <Text style={body({ size: 14, color: '#8B7E74', margin: '0 0 20px 0' })}>
        Week of {weekStartDate}
      </Text>

      {/* 3-column stats */}
      <Section style={{ margin: '24px 0' }}>
        <Row>
          <Column style={{ ...callout, textAlign: 'center', padding: '20px 12px' }}>
            <Text style={heading(28, { align: 'center', margin: '0' })}>
              {booksCreated}
            </Text>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '6px 0 0 0', align: 'center' })}>
              Books created
            </Text>
          </Column>
          <Column style={{ width: '12px' }} />
          <Column style={{ ...callout, textAlign: 'center', padding: '20px 12px' }}>
            <Text style={heading(28, { align: 'center', margin: '0' })}>
              {wordsWritten.toLocaleString()}
            </Text>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '6px 0 0 0', align: 'center' })}>
              Words written
            </Text>
          </Column>
          <Column style={{ width: '12px' }} />
          <Column style={{ ...callout, textAlign: 'center', padding: '20px 12px' }}>
            <Text style={heading(28, { align: 'center', margin: '0' })}>
              {streakDays}
            </Text>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '6px 0 0 0', align: 'center' })}>
              Day streak
            </Text>
          </Column>
        </Row>
      </Section>

      {/* Top book mention */}
      {topBook && (
        <Section style={callout}>
          <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 4px 0' })}>
            Most popular this week
          </Text>
          <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>
            &ldquo;{topBook}&rdquo;
          </Text>
        </Section>
      )}

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
        You&rsquo;re receiving this weekly summary because you opted in.
      </Text>
    </GenesisLayout>
  );
}

WeeklyDigestEmail.PreviewProps = {
  userName: 'Alex',
  booksCreated: 3,
  wordsWritten: 12450,
  streakDays: 5,
  topBook: 'The Cosmic Explorer',
  weekStartDate: 'March 3, 2026',
} satisfies WeeklyDigestEmailProps;
