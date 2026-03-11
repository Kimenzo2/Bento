import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider } from './GenesisLayout';

interface BookCompletionEmailProps {
  userName: string;
  bookTitle: string;
  bookUrl: string;
}

export default function BookCompletionEmail({
  userName,
  bookTitle,
  bookUrl,
}: BookCompletionEmailProps) {
  return (
    <GenesisLayout preview={`Your book "${bookTitle}" is complete`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Book complete</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28, { align: 'center' })}>
        Your book is finished.
      </Text>

      {/* Body */}
      <Text style={body()}>
        {userName}, your book &ldquo;{bookTitle}&rdquo; is complete and ready for the world.
      </Text>

      {/* Feature list */}
      <Text style={body({ size: 14, margin: '0 0 10px 0' })}>
        <span style={{ color: '#FF9B71' }}>&rarr;</span> Download &mdash; Save as PDF
      </Text>
      <Text style={body({ size: 14, margin: '0 0 10px 0' })}>
        <span style={{ color: '#FF9B71' }}>&rarr;</span> Publish &mdash; Export for Amazon KDP
      </Text>
      <Text style={body({ size: 14, margin: '0 0 10px 0' })}>
        <span style={{ color: '#FF9B71' }}>&rarr;</span> Share &mdash; Send to the Genesis community
      </Text>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={bookUrl} style={btnPrimary}>
          View Your Book
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Keep creating — your next story is waiting.
      </Text>
    </GenesisLayout>
  );
}

BookCompletionEmail.PreviewProps = {
  userName: 'Alex',
  bookTitle: 'The Cosmic Explorer',
  bookUrl: 'https://iamazeyou.me/library',
} satisfies BookCompletionEmailProps;
