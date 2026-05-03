import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface ExportReadyEmailProps {
  userName: string;
  bookTitle: string;
  format: string;
  downloadUrl: string;
}

export default function ExportReadyEmail({
  userName,
  bookTitle,
  format,
  downloadUrl,
}: ExportReadyEmailProps) {
  return (
    <GenesisLayout preview={`Your ${format} export of "${bookTitle}" is ready`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Export ready</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>Your {format} is ready.</Text>

      {/* Body */}
      <Text style={body()}>
        {userName}, your export of &ldquo;{bookTitle}&rdquo; is complete and ready to download.
      </Text>

      {/* Callout — format + title */}
      <Section style={{ ...callout, textAlign: 'center' }}>
        <Text style={body({ size: 12, color: '#8B7E74', margin: '0 0 6px 0', align: 'center' })}>
          {format} format
        </Text>
        <Text
          style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D', align: 'center' })}
        >
          {bookTitle}
        </Text>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href={downloadUrl} style={btnPrimary}>
          Download Now
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0' })}>
        Download links expire in 7 days.
      </Text>
    </GenesisLayout>
  );
}

ExportReadyEmail.PreviewProps = {
  userName: 'Alex',
  bookTitle: 'The Cosmic Explorer',
  format: 'PDF',
  downloadUrl: 'https://iamazeyou.me/download/abc123',
} satisfies ExportReadyEmailProps;
