export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorRole: string;
  excerpt: string;
  tags: string[];
  readingTime: number;
  /** CSS gradient for the cover hero (uses theme-neutral values) */
  coverGradient: string;
  content: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'we-built-genesis-ai-visual-storytelling-platform',
    title: 'We Built Genesis: An AI Visual Storytelling Platform for a Market That\'s Moving Fast',
    date: '2026-03-07',
    author: 'The Genesis Team',
    authorRole: 'Founders',
    excerpt:
      'The AI visual storytelling market hit $2.5 billion in 2025. Here\'s what Genesis actually is, how it works, who the real market leaders are, and why we built it this way — no hype.',
    tags: ['AI', 'Visual Storytelling', 'Product', 'Market Analysis'],
    readingTime: 8,
    coverGradient: 'linear-gradient(135deg, var(--color-primary-start, #FF9B71) 0%, var(--color-primary-end, #FFD93D) 100%)',
    content: `
## What Genesis Actually Is (And What It Isn't)

Most AI image tools give you a text box and wish you luck. You type a prompt, get an image, type another prompt, get a different image that looks nothing like the first one, and repeat until you've burned two hours and produced a folder of inconsistent assets that don't tell a coherent story.

Genesis is built around a different philosophy. **Context first, creation second.**

### The Three Realms

When you open Genesis, you don't start with a prompt. You start by choosing a realm:

- **The Cosmos** — galaxies, supernovas, celestial wonders, and the scale of deep space
- **The Kingdom** — knights, dragons, enchanted landscapes, and classic high fantasy
- **The Cell** — the microscopic universe of biological life, perfect for science education and visual explainers

Each realm pre-loads the AI with rich thematic context. That means your first output isn't a generic image that requires 15 iterations to feel right. It's already coherent, already on-brand for your project, and already easier to refine.

### What You Can Build

Genesis isn't a single-use tool. Here's the range of what creators are shipping:

| Output Type | Who It's For | What You Get |
| --- | --- | --- |
| Illustrated Storybooks | Indie authors, children's book writers | Scenes, text, consistent characters, export-ready PDF |
| Character Design | Game teams, concept artists | Heroes, villains, mascots with visual consistency across sheets |
| Lesson & Curriculum Visuals | Teachers, tutors, science communicators | Classroom-ready diagrams, biology explainers, astronomy handouts |
| Export-Ready Publishing | Anyone shipping a finished product | Polished PDFs, ebooks, and commercial assets |

### Gen: Your AI Creative Guide

Every Genesis session is guided by Gen, an AI companion that asks questions and suggests narrative directions instead of passively waiting for prompts. This is the part that separates Genesis from every generic image generator on the market. Gen doesn't just execute instructions. It collaborates.

One of our users, a secondary science teacher, put it well: *"The Cell realm made our biology diagrams clearer and much faster to produce than our old slide workflow."*

That's the product in one sentence. Guided context. Consistent output. Finished work, not raw materials.

## The Visual Storytelling Market in 2026: What's Actually Happening

Let me give you an honest picture of the landscape we're operating in, because it matters for understanding where Genesis fits.

**The numbers are real and they're large.** The AI storytelling software market hit $2.5 billion in 2025, with projections reaching $4.8 billion by 2027. Adoption among indie creators surged 45% year-over-year. Today, 83% of creative professionals use generative AI tools in some part of their workflow. This isn't a niche anymore.

A few forces are driving the acceleration:

- **The creator economy's scale.** Creators need more content, faster, with less production budget. AI tools compress what used to take weeks into hours.
- **Short-form visual demand.** 70% of top Instagram creators now use AI narrative builders. The demand for visual stories on social platforms isn't slowing.
- **Multimodal AI maturity.** Tools now handle text, image, voiceover, and animation in a single workflow. The barrier to producing professional-quality visual content has dropped dramatically.
- **Global democratization.** AI video creation platforms now serve users across 220+ countries. This isn't a US-only phenomenon.

### The Shift That Matters Most

Here's what I think is the most underreported trend in this space: **creators are moving from single-output tools to workflow platforms.**

The era of "generate one image, use it somewhere" is ending. Creators want consistent characters across scenes. They want export-ready files, not raw assets. They want a workflow that takes them from concept to finished product without jumping between five different tools.

That shift is exactly what Genesis was designed for. And it's why we built realms instead of just a prompt box.

## Who the Market Leaders Are (An Honest Look)

I want to be straight here. There are genuinely strong tools in this space. Understanding what they do well is the only honest way to explain where Genesis fits differently.

The market broadly breaks into three categories: **AI video generation**, **AI image generation**, and **AI narrative/worldbuilding platforms**. Genesis lives in that third category, but it's worth mapping all three because most creators use tools across all of them.

### AI Video Generation Leaders

These platforms dominate the text-to-video and cinematic content space:

**Runway ML** is the creative industry's benchmark for AI video. It's used by marketing agencies and film teams who need cinematic-quality motion graphics. Adidas reportedly used it to compress a campaign that previously took 3 weeks down to 55 minutes. The tradeoff: it's built for polished video output, not for narrative worldbuilding or illustrated story creation.

**Google's Veo 3.1** has achieved near-total dominance in AI video model share, commanding 96.4% of orders on major generation platforms as of early 2026. It's the infrastructure layer that many tools are building on top of, not a consumer product in itself.

**Synthesia** leads the enterprise avatar and corporate training video space. It's documented Fortune 500 adoption, with one customer reporting $100,000 in first-year savings. But it's built for standardized corporate communications, not creative storytelling.

### AI Image Generation Leaders

**Midjourney** remains the gold standard for artistic, stylized visuals. It's the tool most creative professionals reach for when they need a distinctive aesthetic. The limitation that matters for storytelling: it produces individual images, not coherent narratives. Character consistency across scenes is a known weakness.

**Adobe Firefly** integrates directly into the Creative Cloud ecosystem, with users reporting 50–70% editing time reduction. It's the safe choice for teams already in the Adobe workflow. It's not built for narrative creation or educational publishing.

### AI Narrative and Worldbuilding Platforms

This is the category Genesis competes in most directly. A few notable players:

**NovelAI** is popular with visual novel creators and fanfiction writers. It offers custom anime-style image diffusion with memory retention across scenes. Strong for that specific niche, less suited for educational content or professional publishing workflows.

**Sudowrite** focuses on long-form prose: plot expansion, style mimicry, novel drafting. It's a writer's tool, not a visual one.

**ElevenLabs** leads in AI voice synthesis and narration, with hyper-realistic voice cloning used for audiobooks and animated shorts. It's a strong companion tool but not a visual creation platform.

### Where the Gap Is

Here's what I notice across all of these tools: **they're all good at one thing.** Video generation. Image generation. Voice. Prose. None of them are built to take a creator from the idea stage through to a finished, export-ready illustrated narrative with consistent characters and structured educational outputs.

That's the gap Genesis fills. Not by being the best image generator or the best video tool, but by being the most complete workflow for creators who need a finished story, not a pile of disconnected assets.

## Why We Built It This Way

The honest answer is that we kept running into the same frustration. We'd pick up a powerful AI image tool, spend 20 minutes prompting, and end up with a set of images that were individually impressive but collectively useless. The characters looked different in every frame. The visual style drifted. There was no way to export anything that felt like a finished product without significant additional work in other tools.

The problem wasn't the AI. The AI was capable. The problem was the interface. Blank prompt boxes optimize for the demo, not the workflow.

**Realms solve the context problem.** When you choose The Cosmos, you're not just picking a theme. You're giving the AI a coherent visual and narrative vocabulary to work from. Every output that follows shares that vocabulary. Characters stay consistent. Scenes feel like they belong together.

**Gen solves the direction problem.** Most creators aren't prompt engineers. They shouldn't have to be. Gen asks questions, makes suggestions, and guides the narrative so that the creative energy goes into the story, not into debugging prompts.

**Export solves the finishing problem.** A visual story that lives in an AI tool's interface is not a finished product. Genesis outputs polished PDFs, ebooks, and commercial-ready assets. The work you do in Genesis ships as something real.

### Who Genesis Is Built For

We're not trying to serve everyone. Here's who Genesis is genuinely the right tool for:

- **Indie authors** drafting illustrated children's books or fantasy shorts who need consistent scenes and direct-to-publish export
- **Teachers and tutors** building biology explainers, astronomy handouts, and visual classroom materials without a design background
- **Game teams** prototyping characters, factions, and narrative assets before committing to full production
- **Science communicators** translating dense research into visual explainers that non-expert audiences can understand and share

If you're a marketing agency producing 50 product videos a month, Genesis isn't your tool. Runway or Synthesia will serve you better. But if you're creating illustrated narratives, educational visuals, or character-driven stories and you want a finished product at the end, Genesis was built for you.

## How to Get Started

Genesis has a free tier called Spark. It lets you explore the full workflow, including realm selection, Gen's creative guidance, and the creation interface, before you decide whether to upgrade.

Paid tiers (Creator, Studio, and Empire) unlock higher output limits and commercial rights. If you're publishing or selling what you create, you'll need a paid plan. If you're exploring or building for personal use, Spark is a complete experience.

### The Plans at a Glance

| Plan | Best For | Commercial Rights |
| --- | --- | --- |
| Spark (Free) | Exploring the workflow, personal projects | No |
| Creator | Indie authors, individual educators | Yes |
| Studio | Game teams, professional creators | Yes |
| Empire | High-volume publishing, enterprise teams | Yes |

Getting started takes about two minutes. Choose your realm, meet Gen, and see what the platform produces before you've written a single prompt. That's the experience we designed for.

## What Comes Next

This is our first blog post, which means this is also the first time we've publicly laid out what Genesis is, why we built it, and how we see the market.

There's a lot more to share. We're going to write about how creators are using the three realms in ways we didn't fully anticipate. We're going to dig into the educational use case, because what teachers are building with The Cell realm is genuinely impressive and underreported. We'll cover the technical side of how realm-guided context improves output consistency, and we'll be honest about the limitations we're still working through.

The visual storytelling space is moving fast. Monthly AI video generation orders grew 5x in a single month in early 2026. The market is not waiting for anyone to catch up.

We built Genesis to be the platform for creators who want to tell stories, not just generate images. If that's you, we'd love to have you try it.
`.trim(),
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getAllPosts(): BlogPost[] {
  return [...blogPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Extract H2 and H3 headings from markdown for table of contents */
export function extractHeadings(markdown: string): { id: string; text: string; level: 2 | 3 }[] {
  const lines = markdown.split('\n');
  const headings: { id: string; text: string; level: 2 | 3 }[] = [];
  for (const line of lines) {
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h2) {
      const text = h2[1].trim();
      headings.push({ id: slugifyHeading(text), text, level: 2 });
    } else if (h3) {
      const text = h3[1].trim();
      headings.push({ id: slugifyHeading(text), text, level: 3 });
    }
  }
  return headings;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
