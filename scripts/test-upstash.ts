/**
 * Upstash Redis Test
 * Tests connection to Upstash Redis
 */

import 'dotenv/config';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

console.log('🔍 Testing Upstash Redis Connection...\n');

console.log('📋 Configuration:');
console.log(`   URL: ${process.env.UPSTASH_REDIS_REST_URL}`);
console.log(`   Token: ${process.env.UPSTASH_REDIS_REST_TOKEN?.slice(0, 10)}...`);
console.log('');

async function testRedis() {
  try {
    // Test SET
    console.log('📝 Testing SET operation...');
    await redis.set('genesis:test:foo', 'bar');
    console.log('   ✅ SET genesis:test:foo = "bar"');

    // Test GET
    console.log('📖 Testing GET operation...');
    const value = await redis.get('genesis:test:foo');
    console.log(`   ✅ GET genesis:test:foo = "${value}"`);

    // Test INCR
    console.log('🔢 Testing INCR operation...');
    await redis.set('genesis:test:counter', 0);
    const count1 = await redis.incr('genesis:test:counter');
    const count2 = await redis.incr('genesis:test:counter');
    const count3 = await redis.incr('genesis:test:counter');
    console.log(`   ✅ Counter incremented: 0 → ${count1} → ${count2} → ${count3}`);

    // Test EXPIRE / TTL
    console.log('⏰ Testing EXPIRE operation...');
    await redis.set('genesis:test:expiring', 'temporary', { ex: 60 });
    const ttl = await redis.ttl('genesis:test:expiring');
    console.log(`   ✅ Key set with TTL: ${ttl} seconds`);

    // Test HSET / HGET (Hash)
    console.log('📦 Testing HASH operations...');
    await redis.hset('genesis:test:user', {
      name: 'Genesis User',
      email: 'user@iamazeyou.me',
      plan: 'creator',
    });
    const user = await redis.hgetall('genesis:test:user');
    console.log(`   ✅ HGETALL: ${JSON.stringify(user)}`);

    // Test LPUSH / LRANGE (List)
    console.log('📋 Testing LIST operations...');
    await redis.del('genesis:test:queue');
    await redis.lpush('genesis:test:queue', 'job1', 'job2', 'job3');
    const queue = await redis.lrange('genesis:test:queue', 0, -1);
    console.log(`   ✅ LRANGE: ${JSON.stringify(queue)}`);

    // Test SADD / SMEMBERS (Set)
    console.log('🎯 Testing SET operations...');
    await redis.del('genesis:test:tags');
    await redis.sadd('genesis:test:tags', 'fantasy', 'adventure', 'epic');
    const tags = await redis.smembers('genesis:test:tags');
    console.log(`   ✅ SMEMBERS: ${JSON.stringify(tags)}`);

    // Test ZADD / ZRANGE (Sorted Set)
    console.log('🏆 Testing SORTED SET operations...');
    await redis.del('genesis:test:leaderboard');
    await redis.zadd(
      'genesis:test:leaderboard',
      { score: 100, member: 'user1' },
      { score: 250, member: 'user2' },
      { score: 175, member: 'user3' }
    );
    const leaderboard = await redis.zrange('genesis:test:leaderboard', 0, -1, {
      rev: true,
      withScores: true,
    });
    console.log(`   ✅ ZRANGE: ${JSON.stringify(leaderboard)}`);

    // Cleanup test keys
    console.log('\n🧹 Cleaning up test keys...');
    await redis.del(
      'genesis:test:foo',
      'genesis:test:counter',
      'genesis:test:expiring',
      'genesis:test:user',
      'genesis:test:queue',
      'genesis:test:tags',
      'genesis:test:leaderboard'
    );
    console.log('   ✅ Test keys deleted');

    console.log('\n🎉 All Redis tests passed!');
    console.log('\n📝 Upstash Redis is ready for:');
    console.log('   • Rate limiting');
    console.log('   • Session storage');
    console.log('   • Caching');
    console.log('   • Job queues');
    console.log('   • Leaderboards');
    console.log('   • Real-time counters');
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    process.exit(1);
  }
}

testRedis();
