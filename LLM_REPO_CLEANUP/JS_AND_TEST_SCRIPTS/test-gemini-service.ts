import dotenv from 'dotenv';
import { generateBookStructure, generateIllustration } from './services/geminiService';
import { ArtStyle, BookTone, UserTier } from './types';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

async function testBookGeneration() {
  console.log('🚀 Starting Book Generation Test...');

  const settings = {
    prompt: 'A brave little toaster who wants to explore the world',
    audience: 'Children 4-6',
    pageCount: 5,
    style: ArtStyle.WATERCOLOR,
    tone: BookTone.ADVENTUROUS,
    isBranching: false,
    educational: true,
    learningConfig: {
      subject: 'Geography',
      objectives: 'Learn about different places',
      integrationMode: 'integrated' as const,
      difficulty: 'beginner' as const,
    },
  };

  try {
    console.log('📚 Generating book structure...');
    const book = await generateBookStructure(settings);
    console.log('✅ Book generated successfully!');
    console.log('Title:', book.title);
    console.log('Pages:', book.chapters?.[0]?.pages?.length);
    console.log(
      'First Page Text:',
      book.chapters?.[0]?.pages?.[0]?.text?.substring(0, 100) + '...'
    );

    if (book.chapters?.[0]?.pages?.[0]?.imagePrompt) {
      console.log('🎨 Testing Image Generation for first page...');
      const imagePrompt = book.chapters[0].pages[0].imagePrompt;
      const imageUrl = await generateIllustration(imagePrompt, ArtStyle.WATERCOLOR, UserTier.SPARK);
      console.log('✅ Image generated:', imageUrl ? 'Success' : 'Failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBookGeneration();
