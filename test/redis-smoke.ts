import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const client = createClient({ url: REDIS_URL });

client.on('error', (err) => {
  console.error('Redis client error', err);
});

await client.connect();

try {
  const pong = await client.ping();
  console.log('Redis ping:', pong);

  const testKey = `smoke-test:health:${randomUUID()}`;
  await client.set(testKey, 'ok', { EX: 10 });
  const value = await client.get(testKey);
  if (value !== 'ok') throw new Error('Redis read/write verification failed');
  console.log('Redis read/write: PASS');

  await client.del(testKey);
  console.log('Redis smoke test: PASS');
} catch (error) {
  console.error('Redis smoke test: FAIL', error);
  process.exitCode = 1;
} finally {
  if (client.isOpen) await client.quit();
}
