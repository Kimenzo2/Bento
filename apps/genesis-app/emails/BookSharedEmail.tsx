import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface BookSharedEmailProps {
  senderName: string;
  bookTitle: string;
  shareLink: string;
}

export default function BookSharedEmail({
  senderName,
  bookTitle,
  shareLink,
}: BookSharedEmailProps) {
  return (
    <GenesisLayout preview={`${senderName} shared "${bookTitle}" with you`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Shared with you</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>{senderName} shared a story.</Text>

      {/* Body */}
      <Text style={body()}>
        They created this story using Genesis, an AI-powered visual storytelling platform. Tap below
        to read it.
      </Text>

      {/* Book title callout */}
      <Section style={{ ...callout, textAlign: 'center' }}>
        <Text style={heading(22, { align: 'center', margin: '0' })}>&ldquo;{bookTitle}&rdquo;</Text>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={shareLink} style={btnPrimary}>
          Read the Story
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        After reading, you can create your own stories on Genesis.
      </Text>
    </GenesisLayout>
  );
}

BookSharedEmail.PreviewProps = {
  senderName: 'Jordan',
  bookTitle: 'The Cosmic Explorer',
  shareLink: 'https://iamazeyou.me/share/abc123',
} satisfies BookSharedEmailProps;
