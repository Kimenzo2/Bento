export const faqsLeft = [
  {
    q: 'Is there a free version?',
    a: 'Bento is a paid app. The Core plan starts at $9/month and includes Tasks, Notes, Journal, Password Vault, and Budget. There is no free tier and no free trial. Every plan works offline and respects your privacy.',
  },
  {
    q: 'Do I need an account to use it?',
    a: 'Yes. You sign in with Google the first time you open the app. After that your data stays on your device.',
  },
  {
    q: 'What platforms does it run on?',
    a: 'Windows, macOS, and Linux. We build for all three with every release.',
  },
  {
    q: 'How does it work offline?',
    a: 'Everything Bento does \u2014 saving notes, tracking habits, logging sleep \u2014 happens directly on your computer. There\u2019s no server involved. Open it on a plane. It works exactly the same.',
  },
] as const;

export const faqsRight = [
  {
    q: 'What data does Bento collect?',
    a: 'None. Your data stays on your device. Bento has no telemetry, no tracking, and no access to your files.',
  },
  {
    q: 'What is the AI feature?',
    a: 'Bento has an optional AI companion. You connect it using your own account with an AI provider. Your data goes to the provider you choose, not to us.',
  },
  {
    q: 'Can I move my data if I stop using Bento?',
    a: 'Yes. Bento stores your data in open formats and provides a full export at any time. You are never locked in.',
  },
  {
    q: 'Who builds Bento?',
    a: 'Bento is built by an independent developer. No venture capital. No growth team. No dark patterns. Updates happen because the builder uses the app every day.',
  },
] as const;

export const allFaqs = [...faqsLeft, ...faqsRight];
