import { Text, Button, Section, Row, Column } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, callout } from './GenesisLayout';

interface WelcomeEmailProps {
  userName: string;
}

export default function WelcomeEmail({ userName }: WelcomeEmailProps) {
  return (
    <GenesisLayout preview="Welcome to Genesis — start creating visual stories with AI">
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Welcome</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28)}>
        Welcome to Genesis, {userName}.
      </Text>

      {/* Body */}
      <Text style={body()}>
        You&rsquo;ve joined a community of creators building illustrated stories,
        visual learning content, and character worlds — all powered by AI.
      </Text>

      {/* 3-column feature cards */}
      <Section style={{ margin: '24px 0' }}>
        <Row>
          <Column style={{ ...callout, textAlign: 'center', padding: '20px 12px' }}>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>Create</Text>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '6px 0 0 0', align: 'center' })}>
              Illustrated ebooks with AI
            </Text>
          </Column>
          <Column style={{ width: '12px' }} />
          <Column style={{ ...callout, textAlign: 'center', padding: '20px 12px' }}>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>Publish</Text>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '6px 0 0 0', align: 'center' })}>
              Export to PDF or KDP
            </Text>
          </Column>
          <Column style={{ width: '12px' }} />
          <Column style={{ ...callout, textAlign: 'center', padding: '20px 12px' }}>
            <Text style={body({ size: 14, weight: 600, margin: '0', color: '#3D3D3D' })}>Share</Text>
            <Text style={body({ size: 12, color: '#8B7E74', margin: '6px 0 0 0', align: 'center' })}>
              Collaborate with others
            </Text>
          </Column>
        </Row>
      </Section>

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
        Need help getting started? Reply to this email and our team will
        guide you through your first project.
      </Text>
    </GenesisLayout>
  );
}

WelcomeEmail.PreviewProps = {
  userName: 'Alex',
} satisfies WelcomeEmailProps;
