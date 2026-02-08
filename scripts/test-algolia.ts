import { algoliasearch } from 'algoliasearch';

const APP_ID = '91BBZL0U5U';
const WRITE_KEY = '4a875943762a26a027dab06317cfc8dd';
const SEARCH_KEY = 'c9f07e51b0f1fe8af26dceb55e34f065';

const INDEXES = {
  BOOKS: 'genesis_books',
  USERS: 'genesis_users',
  TEMPLATES: 'genesis_templates',
  PUBLIC_LIBRARY: 'genesis_public_library',
};

async function initializeAlgoliaIndexes() {
  console.log('🚀 Initializing Algolia Indexes...\n');

  const writeClient = algoliasearch(APP_ID, WRITE_KEY);

  try {
    // Configure books index
    console.log('1. Configuring genesis_books index...');
    await writeClient.setSettings({
      indexName: INDEXES.BOOKS,
      indexSettings: {
        searchableAttributes: ['title', 'synopsis', 'genre', 'author', 'tags'],
        attributesForFaceting: [
          'filterOnly(isPublic)',
          'filterOnly(authorId)',
          'searchable(genre)',
          'searchable(tags)',
          'language',
        ],
        customRanking: ['desc(updatedAt)', 'desc(wordCount)'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      },
    });
    console.log('   ✅ genesis_books configured');

    // Configure users index
    console.log('2. Configuring genesis_users index...');
    await writeClient.setSettings({
      indexName: INDEXES.USERS,
      indexSettings: {
        searchableAttributes: ['displayName', 'bio'],
        attributesForFaceting: ['filterOnly(isVerified)'],
        customRanking: ['desc(bookCount)'],
      },
    });
    console.log('   ✅ genesis_users configured');

    // Configure templates index
    console.log('3. Configuring genesis_templates index...');
    await writeClient.setSettings({
      indexName: INDEXES.TEMPLATES,
      indexSettings: {
        searchableAttributes: ['name', 'description', 'genre', 'category'],
        attributesForFaceting: [
          'searchable(genre)',
          'searchable(category)',
          'filterOnly(isPremium)',
        ],
        customRanking: ['desc(usageCount)'],
      },
    });
    console.log('   ✅ genesis_templates configured');

    // Configure public library index
    console.log('4. Configuring genesis_public_library index...');
    await writeClient.setSettings({
      indexName: INDEXES.PUBLIC_LIBRARY,
      indexSettings: {
        searchableAttributes: ['title', 'synopsis', 'author', 'genre'],
        attributesForFaceting: ['searchable(genre)', 'searchable(tags)'],
        customRanking: ['desc(viewCount)', 'desc(createdAt)'],
      },
    });
    console.log('   ✅ genesis_public_library configured');

    // Verify indexes were created
    console.log('\n📋 Verifying indexes...');
    const indexes = await writeClient.listIndices();
    console.log('Created indexes:');
    indexes.items?.forEach((idx) => {
      console.log(`   - ${idx.name}`);
    });

    console.log('\n-----------------------------------');
    console.log('✅ All Algolia indexes initialized successfully!\n');
  } catch (error: any) {
    console.log('❌ Failed to initialize indexes:', error.message);
  }
}

initializeAlgoliaIndexes();
