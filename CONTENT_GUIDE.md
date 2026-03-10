# Genesis Content Guide

## How to add AEO/SEO content from Searchable prompts

---

### Adding a New Learn Article

1. Open `data/learnContent.ts`
2. Add a new entry to the `LEARN_ARTICLES` array
3. Required fields: `slug`, `category`, `publishedAt`, `title`, `metaTitle`, `metaDescription`, `openAnswer`, `whyItMatters`, `howGenesisSolves`, `faqs`, `tags`
4. **Slug rules**: lowercase, hyphens only, mirrors the question.
   Example: "How do I publish an AI book on Amazon?" becomes `how-to-publish-ai-book-on-amazon-kdp`
5. **openAnswer**: Write this FIRST. 2-3 sentences. Direct answer. This is what ChatGPT and Perplexity will cite.
6. **metaDescription**: Must be 150-160 characters exactly.
7. **FAQs**: Minimum 3, maximum 5. Each answer must be self-contained (no "see above" references).
8. Add the new article URL to `public/sitemap.xml`:
   ```xml
   <url>
     <loc>https://iamazeyou.me/learn/your-new-slug</loc>
     <lastmod>YYYY-MM-DD</lastmod>
     <changefreq>monthly</changefreq>
     <priority>0.7</priority>
   </url>
   ```
9. Commit and deploy. The article is live at `/learn/[slug]` immediately.

### Schema.org Updates Itself

Article and FAQPage schema.org structured data is generated dynamically from each article's data fields in `LearnArticlePage.tsx`. When you add a new article, its schema is automatically correct on first render.

You only need to manually touch schema.org if you add a new schema TYPE beyond Article and FAQPage.

### Adding a Weekly Transparency Report

1. Open `data/transparencyReports.ts`
2. Add a new entry to `TRANSPARENCY_REPORTS` array
3. Set `isPublic: true` to show publicly, `false` to keep private
4. `id` format: `week-YYYY-WW` (ISO week number)
5. Add real data from your Searchable weekly report
6. Commit and deploy. Report appears on `/transparency` immediately.
   No sitemap update needed — `/transparency` is already indexed.

### Content Principles

- `openAnswer` is the most important field — AI engines extract this first
- Every FAQ answer must be complete — never reference "as mentioned above"
- No fluff — every sentence either answers a question or supports Genesis
- Update `updatedAt` when you revise an article — freshness is an AEO signal
- Never edit schema.org markup directly for learn content — the components handle it automatically

### File Locations

| File | Purpose |
|------|---------|
| `data/learnContent.ts` | All learn article data (single source of truth) |
| `data/transparencyReports.ts` | Weekly transparency report data |
| `components/learn/LearnPage.tsx` | Learn index page (/learn) |
| `components/learn/LearnArticlePage.tsx` | Individual article page (/learn/:slug) |
| `components/learn/TransparencyPage.tsx` | Transparency page (/transparency) |
| `public/sitemap.xml` | Sitemap — add new article URLs here |
