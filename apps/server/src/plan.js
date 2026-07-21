import { Router } from 'express';
import { requireSession } from './auth.js';

const router = Router();

const planTiers = {
  chatgpt_plus: {
    name: 'ChatGPT Plus',
    tier: 'plus',
    description: 'Access to GPT-4o, GPT-4o-mini, and more',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    maxTokens: 8192,
    rateLimit: { requestsPerMinute: 60 },
  },
  chatgpt_pro: {
    name: 'ChatGPT Pro',
    tier: 'pro',
    description: 'Unlimited access to our best models',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o3-mini', 'o4-mini'],
    maxTokens: 16384,
    rateLimit: { requestsPerMinute: 200 },
  },
};

router.get('/', requireSession, (req, res) => {
  const session = req.session;
  const planInfo = planTiers[session.plan] || planTiers.chatgpt_plus;

  res.json({
    plan: session.plan,
    ...planInfo,
    sessionExpiresAt: session.expiresAt,
    activeModel: session.model,
  });
});

export { router as planRouter };
