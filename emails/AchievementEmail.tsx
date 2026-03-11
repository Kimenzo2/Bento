import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import GenesisLayout, { heading, body, btnPrimary, badge, divider, coralSection } from './GenesisLayout';

interface AchievementEmailProps {
  userName: string;
  achievementName: string;
  description: string;
  xpEarned?: number;
}

export default function AchievementEmail({
  userName,
  achievementName,
  description,
  xpEarned,
}: AchievementEmailProps) {
  return (
    <GenesisLayout preview={`Achievement unlocked: ${achievementName}`}>
      {/* Badge */}
      <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{ ...badge, margin: 0 }}>Achievement</Text>
      </Section>

      {/* Heading */}
      <Text style={heading(28, { align: 'center' })}>
        Achievement unlocked.
      </Text>

      {/* Coral section — achievement name + XP */}
      <Section style={coralSection}>
        <Text style={heading(22, { color: '#FFFFFF', align: 'center', margin: '0' })}>
          {achievementName}
        </Text>
        {xpEarned && (
          <Text style={body({ size: 14, color: '#FFFFFF', margin: '8px 0 0 0', align: 'center', weight: 600 })}>
            +{xpEarned} XP
          </Text>
        )}
      </Section>

      {/* Body */}
      <Text style={body({ align: 'center' })}>
        {userName}, {description}
      </Text>

      {/* CTA */}
      <Section style={{ textAlign: 'center', margin: '28px 0' }}>
        <Button href="https://iamazeyou.me" style={btnPrimary}>
          View Achievements
        </Button>
      </Section>

      {/* Divider */}
      <Section>
        <hr style={divider} />
      </Section>

      {/* Footer text */}
      <Text style={body({ size: 13, color: '#8B7E74', margin: '0', align: 'center' })}>
        Keep creating to unlock more achievements.
      </Text>
    </GenesisLayout>
  );
}

AchievementEmail.PreviewProps = {
  userName: 'Alex',
  achievementName: 'Prolific Author',
  description: 'you created 10 books on Genesis. That puts you in the top 5% of creators.',
  xpEarned: 500,
} satisfies AchievementEmailProps;
