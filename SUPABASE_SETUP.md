# Supabase Database Setup Guide

This guide will help you set up the Supabase database for the Genesis Storybook Generator application.

## Prerequisites

- A Supabase account (https://supabase.com)
- A Supabase project created
- Your Supabase project URL and anon key (already in your `.env` files)

## Setup Steps

### 1. Access Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run the Schema SQL

1. Open the `supabase_schema.sql` file in this directory
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)

The script will create:
- ✅ All necessary tables (profiles, projects, chapters, pages, characters, etc.)
- ✅ Enums for art styles, tones, user tiers, and layout types
- ✅ Indexes for optimized queries
- ✅ Row Level Security (RLS) policies
- ✅ Triggers for automatic timestamp updates
- ✅ Function to auto-create user profiles on signup

### 3. Verify the Setup

After running the SQL, verify the tables were created:

1. Go to **Table Editor** in the left sidebar
2. You should see the following tables:
   - `profiles`
   - `projects`
   - `characters`
   - `chapters`
   - `pages`
   - `user_gamification`
   - `payment_history`

### 4. Test Authentication

The schema includes a trigger that automatically creates a profile when a user signs up via Supabase Auth. To test:

1. Go to **Authentication** → **Users**
2. Click **Add User** (or use your app's signup flow)
3. After creating a user, check the `profiles` and `user_gamification` tables
4. You should see automatic entries for the new user

## Database Schema Overview

### Core Tables

#### `profiles`
- Extends Supabase auth.users
- Stores user tier, subscription status, and profile data
- Auto-created on user signup

#### `projects`
- Main table for book projects
- Contains title, synopsis, style, tone, and metadata
- Uses JSONB for complex nested data (metadata, decision trees, etc.)

#### `chapters`
- Organizes pages into chapters
- Linked to projects
- Ordered by `order_index`

#### `pages`
- Individual book pages
- Contains text, image prompts, and generated images
- Supports interactive elements, learning moments, and vocabulary
- Uses JSONB for complex nested data

#### `characters`
- Character definitions for projects
- Stores visual descriptions and traits

#### `user_gamification`
- Tracks user XP, level, badges, and challenges
- Auto-created on user signup

#### `payment_history`
- Records subscription payments
- Linked to Paystack transactions

## Row Level Security (RLS)

All tables have RLS enabled to ensure users can only access their own data:

- ✅ Users can only view/edit their own profiles
- ✅ Users can only view/edit their own projects
- ✅ Users can only view/edit characters/chapters/pages from their own projects
- ✅ Users can only view/edit their own gamification data
- ✅ Users can only view their own payment history

## JSONB Fields

The schema uses JSONB for complex nested data to maintain flexibility:

### `projects.metadata`
```json
{
  "title": "string",
  "subtitle": "string",
  "synopsis": "string",
  "ageRange": "string",
  "genre": "string",
  "pageCount": 0,
  "readingTimeMinutes": 0,
  "artStyle": "string",
  "features": ["string"],
  "language": "string",
  "contentWarnings": ["string"]
}
```

### `projects.decision_tree`
```json
{
  "paths": [
    {
      "pathId": "string",
      "decisions": [{ "page": 0, "choice": "string" }],
      "outcome": "string"
    }
  ]
}
```

### `pages.interactive_element`
```json
{
  "type": "decision",
  "question": "string",
  "options": [
    {
      "text": "string",
      "leadsToPage": 0
    }
  ]
}
```

## Enums

The schema defines the following enums:

- `art_style`: Watercolor, 3D Render (Pixar Style), Japanese Manga, Corporate Minimalist, Cyberpunk Neon, Vintage Illustration, Paper Cutout Art
- `book_tone`: Playful, Serious, Inspirational, Educational, Dramatic
- `user_tier`: Spark (Free), Creator ($19.99), Studio ($59.99), Empire ($199.99)
- `layout_type`: full-bleed, split-horizontal, split-vertical, text-only, image-only

## Next Steps

### Integrate with Your Application

1. **Install Supabase Client** (already done):
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create Supabase Service** (example):
   ```typescript
   // services/supabaseService.ts
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = process.env.VITE_SUPABASE_URL!;
   const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

   export const supabase = createClient(supabaseUrl, supabaseKey);
   ```

3. **Example: Save a Project**:
   ```typescript
   import { supabase } from './services/supabaseService';
   import { BookProject } from './types';

   async function saveProject(project: BookProject, userId: string) {
     // Insert project
     const { data: projectData, error: projectError } = await supabase
       .from('projects')
       .insert({
         user_id: userId,
         title: project.title,
         synopsis: project.synopsis,
         style: project.style,
         tone: project.tone,
         target_audience: project.targetAudience,
         is_branching: project.isBranching,
         cover_image: project.coverImage,
         metadata: project.metadata,
         decision_tree: project.decisionTree,
         back_matter: project.backMatter,
         series_info: project.seriesInfo,
         brand_profile: project.brandProfile
       })
       .select()
       .single();

     if (projectError) throw projectError;

     // Insert chapters
     for (const chapter of project.chapters) {
       const { data: chapterData, error: chapterError } = await supabase
         .from('chapters')
         .insert({
           project_id: projectData.id,
           title: chapter.title,
           order_index: project.chapters.indexOf(chapter)
         })
         .select()
         .single();

       if (chapterError) throw chapterError;

       // Insert pages
       for (const page of chapter.pages) {
         await supabase.from('pages').insert({
           chapter_id: chapterData.id,
           page_number: page.pageNumber,
           text: page.text,
           image_prompt: page.imagePrompt,
           image_url: page.imageUrl,
           layout_type: page.layoutType,
           narration_notes: page.narrationNotes,
           interactive_element: page.interactiveElement,
           learning_moment: page.learningMoment,
           vocabulary_words: page.vocabularyWords,
           choices: page.choices
         });
       }
     }

     // Insert characters
     for (const character of project.characters) {
       await supabase.from('characters').insert({
         project_id: projectData.id,
         name: character.name,
         role: character.role,
         description: character.description,
         visual_traits: character.visualTraits,
         visual_prompt: character.visualPrompt,
         traits: character.traits,
         image_url: character.imageUrl
       });
     }

     return projectData;
   }
   ```

4. **Example: Load User Projects**:
   ```typescript
   async function loadUserProjects(userId: string) {
     const { data, error } = await supabase
       .from('projects')
       .select(`
         *,
         chapters (
           *,
           pages (*)
         ),
         characters (*)
       `)
       .eq('user_id', userId)
       .order('created_at', { ascending: false });

     if (error) throw error;
     return data;
   }
   ```

## Troubleshooting

### Issue: Tables not created
- **Solution**: Check the SQL Editor for error messages. Run the schema in sections if needed.

### Issue: RLS blocking queries
- **Solution**: Ensure you're authenticated and using `auth.uid()` in your queries. Check RLS policies in **Authentication** → **Policies**.

### Issue: JSONB validation errors
- **Solution**: Ensure your JSONB data matches the expected structure. Use TypeScript types to validate before inserting.

### Issue: Enum value errors
- **Solution**: Ensure you're using exact enum values as defined in the schema (case-sensitive).

## Support

For more information:
- Supabase Documentation: https://supabase.com/docs
- Supabase SQL Reference: https://supabase.com/docs/guides/database
- PostgreSQL JSONB: https://www.postgresql.org/docs/current/datatype-json.html

---

**Your database is now ready for production!** 🎉
