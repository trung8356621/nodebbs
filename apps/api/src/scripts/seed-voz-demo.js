// Development-only synthetic fixtures. Never invoke from production startup.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { users } from '../db/schema.js';
import { categories, topics, posts } from '../modules/forum/db/schema.js';
import { roles, userRoles } from '../db/rbac-schema.js';

const prefix = 'pbn-voz-ui-';
const bio = 'PBN VOZ-inspired synthetic UI fixtures; development only.';
const source = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../pbn_voz_ui_seed.json', import.meta.url)), 'utf8'));
const children = source.groups.flatMap(g => g.categories);
assert.equal(source.metadata.site_scope, 'pbn_dev');
assert.equal(source.groups.length, 7);
assert.equal(children.length, 49);
assert.equal(source.demo_topics.length, 112);
assert.equal(new Set([...source.groups, ...children].map(c => c.key)).size, 56);
assert.equal(new Set(source.demo_topics.map(t => t.seed_key)).size, 112);
for (const t of source.demo_topics) {
  assert.equal(t.synthetic, true);
  assert(children.some(c => c.key === t.category_key));
  assert(t.title.length <= 255 && typeof t.content === 'string');
}
const connection = new URL(process.env.DATABASE_URL);
assert.equal(process.env.NODE_ENV, 'development', 'NODE_ENV must be development');
assert.equal(connection.hostname, '127.0.0.1');
assert.equal(connection.port || '5432', '5432');
assert.equal(connection.pathname, '/pbn_dev');
const pool = new pg.Pool({ connectionString: connection.toString(), max: 1 });
const db = drizzle(pool);
const dryRun = process.argv.includes('--dry-run');
const result = { dryRun, created: { users: 0, groups: 0, categories: 0, topics: 0, posts: 0 }, matched: {} };
try {
  await db.transaction(async tx => {
    const check = await tx.execute(sql`select current_database() as db, current_setting('server_version') as version`);
    assert.equal(check.rows[0].db, 'pbn_dev');
    assert.match(check.rows[0].version, /^17\.2(?:\D|$)/);
    // Serialize this importer: topic slugs are indexed, but not unique upstream.
    await tx.execute(sql`select pg_advisory_xact_lock(173205, 11249)`);
    const original = {};
    for (const [name, table] of Object.entries({ users, categories, topics, posts })) {
      original[name] = await tx.select().from(table);
    }
    let author = original.users.find(u => u.username === 'pbn_voz_ui_demo');
    if (author) assert(author.bio === bio && author.role === 'user' && !author.isDeleted, 'Demo author collision');
    else if (!dryRun) {
      [author] = await tx.insert(users).values({ username: 'pbn_voz_ui_demo', name: 'PBN Demo', bio, role: 'user', messagePermission: 'disabled' }).returning();
      const [role] = await tx.select().from(roles).where(eq(roles.slug, 'user'));
      assert(role, 'Default user role missing');
      await tx.insert(userRoles).values({ userId: author.id, roleId: role.id });
      result.created.users++;
    }
    const ids = new Map();
    for (const group of source.groups) {
      for (const item of [group, ...group.categories]) {
        const isGroup = item === group;
        const values = { name: item.name, slug: prefix + item.key + '-' + item.slug, description: bio, parentId: isGroup ? null : ids.get(group.key), position: item.order, isFeatured: isGroup };
        const existing = original.categories.find(c => c.slug === values.slug);
        if (existing) {
          for (const k of ['name', 'description', 'parentId', 'position', 'isFeatured']) assert.deepEqual(existing[k], values[k], `Category collision/drift: ${item.key}/${k}`);
          ids.set(item.key, existing.id);
        } else if (!dryRun) {
          const [row] = await tx.insert(categories).values(values).returning();
          ids.set(item.key, row.id);
          result.created[isGroup ? 'groups' : 'categories']++;
        } else ids.set(item.key, -1);
      }
    }
    for (const [index, item] of source.demo_topics.entries()) {
      const slug = prefix + item.seed_key;
      const matches = original.topics.filter(t => t.slug === slug);
      assert(matches.length <= 1, `Duplicate topic: ${slug}`);
      if (matches.length) {
        const t = matches[0];
        assert(t.userId === author?.id && t.categoryId === ids.get(item.category_key) && t.title === item.title && !t.isDeleted, `Topic collision/drift: ${slug}`);
        const first = original.posts.filter(p => p.topicId === t.id && p.postNumber === 1);
        assert(first.length === 1 && first[0].userId === author.id && first[0].content === item.content && first[0].rawContent === item.content, `First post mismatch: ${slug}`);
      } else if (!dryRun) {
        const createdAt = new Date(Date.now() - (source.demo_topics.length - index) * 60000);
        const [topic] = await tx.insert(topics).values({ title: item.title, slug, categoryId: ids.get(item.category_key), userId: author.id, postCount: 1, createdAt, lastPostAt: createdAt, lastPostUserId: author.id }).returning();
        await tx.insert(posts).values({ topicId: topic.id, userId: author.id, content: item.content, rawContent: item.content, postNumber: 1, createdAt });
        result.created.topics++;
        result.created.posts++;
      }
    }
    // Prove pre-existing records were not changed by the transaction.
    for (const [name, table] of Object.entries({ users, categories, topics, posts })) {
      const after = await tx.select().from(table);
      const map = new Map(after.map(row => [row.id, row]));
      for (const row of original[name]) assert.deepEqual(map.get(row.id), row, `Existing ${name}/${row.id} modified`);
      result.matched[name] = after.length;
    }
    result.database = check.rows[0];
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
