import crypto from 'node:crypto';
import { eq, desc } from 'drizzle-orm';
import db, { pool } from '#core/db/index.js';
import {
  forumNetworkSettings,
  forumNetworkChildren,
  forumNetworkTemplates,
  forumNetworkPolicyVersions,
  forumNetworkPolicyApplications,
  forumTopicReferenceSnapshots,
} from '../schema.js';
import {
  FIELD_CLASS,
  TEMPLATE_KEYS,
  MANAGED_KEYS,
  LOCAL_KEYS,
  POLICY_SCHEMA,
  TOPIC_REF_SCHEMA,
  NETWORK_ROLES,
} from '../constants.js';
import { createOpsMultiForumAdapter } from '../opsAdapter.js';
import { DEFAULT_NETWORK_TEMPLATE } from '../defaultTemplate.js';

function fail(message, statusCode = 400, code = 'forum_network_error') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function checksumOf(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function normalizeTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleHash(title) {
  return crypto.createHash('sha256').update(normalizeTitle(title)).digest('hex');
}

export function classifyKey(key) {
  if (TEMPLATE_KEYS.includes(key)) return FIELD_CLASS.TEMPLATE;
  if (MANAGED_KEYS.includes(key)) return FIELD_CLASS.MANAGED;
  if (LOCAL_KEYS.includes(key)) return FIELD_CLASS.LOCAL;
  return FIELD_CLASS.LOCAL;
}

export class ForumNetworkService {
  constructor(fastify) {
    this.fastify = fastify;
    this.opsAdapter = createOpsMultiForumAdapter();
    this.ready = false;
  }

  async tableExists(name) {
    const { rows } = await pool.query(
      `SELECT 1 AS ok
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
       LIMIT 1`,
      [name],
    );
    return rows.length > 0;
  }

  async ensureReady() {
    if (this.ready) return true;
    const ok = await this.tableExists('forum_network_settings');
    this.ready = ok;
    return ok;
  }

  async requireReady() {
    if (!(await this.ensureReady())) {
      throw fail(
        'forum-network schema missing; apply baseline/0012_forum_network.sql on this forum DB',
        503,
        'schema_missing',
      );
    }
  }

  async getSetting(key, fallback = null) {
    await this.requireReady();
    const [row] = await db.select().from(forumNetworkSettings)
      .where(eq(forumNetworkSettings.key, key)).limit(1);
    return row ? row.value : fallback;
  }

  async setSetting(key, value, actorId = null) {
    await this.requireReady();
    await db.insert(forumNetworkSettings).values({
      key,
      value,
      updatedAt: new Date(),
      updatedBy: actorId,
    }).onConflictDoUpdate({
      target: forumNetworkSettings.key,
      set: { value, updatedAt: new Date(), updatedBy: actorId },
    });
    return value;
  }

  async getRole() {
    const value = await this.getSetting('role', { role: 'none' });
    const role = value?.role || 'none';
    return NETWORK_ROLES.includes(role) ? role : 'none';
  }

  async setRole(role, actorId = null) {
    if (!NETWORK_ROLES.includes(role)) throw fail('Invalid network role', 400, 'invalid_role');
    await this.setSetting('role', { role }, actorId);
    return { role };
  }

  isProtectedForum() {
    const id = process.env.FORUM_ID || '';
    const dbName = process.env.FORUM_DATABASE_NAME || '';
    return id === 'forum_a' || dbName === 'pbn_dev';
  }

  async status() {
    const ready = await this.ensureReady();
    if (!ready) {
      return {
        ready: false,
        role: 'none',
        forumId: process.env.FORUM_ID || null,
        databaseName: process.env.FORUM_DATABASE_NAME || null,
        webOrigin: process.env.FORUM_WEB_ORIGIN || null,
        opsAdapter: this.opsAdapter.status,
        parentOfflineSafe: true,
        schemaMissing: true,
        canEnableParent: false,
        provision: this.provisionGuide(),
      };
    }
    const role = await this.getRole();
    const link = await this.getSetting('parent_link', null);
    const lastPolicy = await this.getSetting('last_managed_policy', null);
    const parentEnabledAt = await this.getSetting('parent_enabled_at', null);
    return {
      ready: true,
      role,
      forumId: process.env.FORUM_ID || null,
      databaseName: process.env.FORUM_DATABASE_NAME || null,
      webOrigin: process.env.FORUM_WEB_ORIGIN || null,
      parentLink: link,
      lastManagedPolicy: lastPolicy,
      parentEnabledAt,
      opsAdapter: {
        status: this.opsAdapter.status,
        contract: this.opsAdapter.contract,
      },
      fieldClasses: {
        template: TEMPLATE_KEYS,
        managed: MANAGED_KEYS,
        local: LOCAL_KEYS,
      },
      parentOfflineSafe: true,
      installationKeyRequired: false,
      opsRequired: false,
      schemaMissing: false,
      canEnableParent: role === 'none' && !this.isProtectedForum(),
      protectedForum: this.isProtectedForum(),
      provision: this.provisionGuide(),
    };
  }

  provisionGuide() {
    return {
      availableInRuntime: false,
      reason: 'runtime_provision_disabled',
      note: 'Creating a Child requires a separate database and operator confirmation via CLI. The Admin UI prepares a draft and shows commands; it does not create databases.',
      cli: {
        enableParent: 'node scripts/forum-network.mjs enable-parent forums/<parent>.json',
        createChild: 'node scripts/forum-network.mjs create-child --config forums/<child>.json --parent forums/<parent>.json --template default --free-months 2',
        exportPolicy: 'node scripts/forum-network.mjs export-policy forums/<parent>.json --out path.json',
        applyPolicy: 'node scripts/forum-network.mjs apply-policy forums/<child>.json --package path.json',
      },
    };
  }

  async enableParent(actorId = null) {
    if (this.isProtectedForum()) {
      throw fail('Forum A / pbn_dev cannot be enabled as Parent from Admin UI', 403, 'protected_forum');
    }
    await this.setRole('parent', actorId);
    await this.setSetting('parent_enabled_at', { at: new Date().toISOString() }, actorId);
    await this.upsertTemplate({
      id: DEFAULT_NETWORK_TEMPLATE.id,
      name: DEFAULT_NETWORK_TEMPLATE.name,
      description: DEFAULT_NETWORK_TEMPLATE.description,
      payload: DEFAULT_NETWORK_TEMPLATE,
    }, actorId);
    return this.overview();
  }

  async enableChild(parentMeta, actorId = null) {
    await this.setRole('child', actorId);
    await this.setSetting('parent_link', {
      parentForumId: parentMeta.parentForumId || null,
      parentOrigin: parentMeta.parentOrigin || null,
      linkedAt: new Date().toISOString(),
      runtimeDependency: false,
    }, actorId);
    return this.status();
  }

  async upsertChildRegistry(row) {
    await this.requireReady();
    const role = await this.getRole();
    if (role !== 'parent') throw fail('Only Parent may manage child registry', 403, 'not_parent');
    await db.insert(forumNetworkChildren).values({
      childForumId: row.childForumId,
      displayName: row.displayName,
      databaseName: row.databaseName,
      apiOrigin: row.apiOrigin || null,
      webOrigin: row.webOrigin || null,
      status: row.status || 'active',
      templateId: row.templateId || null,
      freeModeExpiresAt: row.freeModeExpiresAt ? new Date(row.freeModeExpiresAt) : null,
      meta: row.meta || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: forumNetworkChildren.childForumId,
      set: {
        displayName: row.displayName,
        databaseName: row.databaseName,
        apiOrigin: row.apiOrigin || null,
        webOrigin: row.webOrigin || null,
        status: row.status || 'active',
        templateId: row.templateId || null,
        freeModeExpiresAt: row.freeModeExpiresAt ? new Date(row.freeModeExpiresAt) : null,
        meta: row.meta || {},
        updatedAt: new Date(),
      },
    });
    return row;
  }

  async listChildren() {
    await this.requireReady();
    return db.select().from(forumNetworkChildren).orderBy(desc(forumNetworkChildren.createdAt));
  }

  async upsertTemplate(template, actorId = null) {
    await this.requireReady();
    await db.insert(forumNetworkTemplates).values({
      id: template.id,
      name: template.name,
      description: template.description || null,
      payload: template.payload,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: actorId,
    }).onConflictDoUpdate({
      target: forumNetworkTemplates.id,
      set: {
        name: template.name,
        description: template.description || null,
        payload: template.payload,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });
    return template;
  }

  async getTemplate(id) {
    await this.requireReady();
    const [row] = await db.select().from(forumNetworkTemplates)
      .where(eq(forumNetworkTemplates.id, id)).limit(1);
    return row || null;
  }

  buildPolicyPackage({ managed, notes, parentForumId, version }) {
    const payload = {
      schema: POLICY_SCHEMA,
      version: version || `${new Date().toISOString()}#1`,
      parentForumId: parentForumId || process.env.FORUM_ID || null,
      notes: notes || null,
      managed: managed || {},
      createdAt: new Date().toISOString(),
    };
    const checksum = checksumOf({
      schema: payload.schema,
      version: payload.version,
      managed: payload.managed,
    });
    return { ...payload, checksum };
  }

  async publishPolicy(managed, { notes, actorId, version } = {}) {
    await this.requireReady();
    if ((await this.getRole()) !== 'parent') throw fail('Only Parent may publish policy', 403, 'not_parent');
    const filtered = {};
    const rejected = [];
    for (const [key, value] of Object.entries(managed || {})) {
      const cls = classifyKey(key);
      if (cls === FIELD_CLASS.MANAGED) filtered[key] = value;
      else rejected.push({ key, class: cls });
    }
    if (!Object.keys(filtered).length) throw fail('No managed keys to publish', 400, 'empty_policy');
    const pkg = this.buildPolicyPackage({
      managed: filtered,
      notes,
      version,
    });
    await db.insert(forumNetworkPolicyVersions).values({
      version: pkg.version,
      checksum: pkg.checksum,
      payload: pkg,
      notes: notes || null,
      createdAt: new Date(),
      createdBy: actorId || null,
    }).onConflictDoNothing();
    return { package: pkg, rejected };
  }

  async listPolicyVersions() {
    await this.requireReady();
    return db.select({
      version: forumNetworkPolicyVersions.version,
      checksum: forumNetworkPolicyVersions.checksum,
      notes: forumNetworkPolicyVersions.notes,
      createdAt: forumNetworkPolicyVersions.createdAt,
    }).from(forumNetworkPolicyVersions)
      .orderBy(desc(forumNetworkPolicyVersions.createdAt));
  }

  /**
   * Apply managed policy on Child. Idempotent by version.
   * Never writes LOCAL or TEMPLATE keys.
   */
  async applyPolicyPackage(pkg, { source = 'cli', actorId = null, settingsWriter } = {}) {
    await this.requireReady();
    if (!pkg || pkg.schema !== POLICY_SCHEMA) throw fail('Invalid policy schema', 400, 'invalid_policy');
    if (!pkg.version || !pkg.checksum || !pkg.managed) throw fail('Malformed policy package', 400, 'invalid_policy');

    const expected = checksumOf({
      schema: pkg.schema,
      version: pkg.version,
      managed: pkg.managed,
    });
    if (expected !== pkg.checksum) throw fail('Policy checksum mismatch', 400, 'checksum_mismatch');

    const [existing] = await db.select().from(forumNetworkPolicyApplications)
      .where(eq(forumNetworkPolicyApplications.policyVersion, pkg.version)).limit(1);
    if (existing && ['applied', 'skipped_duplicate'].includes(existing.status)) {
      return {
        status: 'skipped_duplicate',
        version: pkg.version,
        previousStatus: existing.status,
        message: 'Policy version already applied',
      };
    }

    const appliedKeys = [];
    const skippedKeys = [];
    try {
      for (const [key, value] of Object.entries(pkg.managed)) {
        const cls = classifyKey(key);
        if (cls !== FIELD_CLASS.MANAGED) {
          skippedKeys.push(key);
          continue;
        }
        if (typeof settingsWriter === 'function') {
          await settingsWriter(key, value);
        } else if (this.fastify.settings?.set) {
          await this.fastify.settings.set(key, value);
        } else {
          await this.setSetting(`managed:${key}`, value, actorId);
        }
        appliedKeys.push(key);
      }

      await db.insert(forumNetworkPolicyApplications).values({
        id: crypto.randomUUID(),
        policyVersion: pkg.version,
        checksum: pkg.checksum,
        source,
        status: 'applied',
        appliedKeys,
        skippedKeys,
        appliedAt: new Date(),
        actorId,
      });

      await this.setSetting('last_managed_policy', {
        version: pkg.version,
        checksum: pkg.checksum,
        appliedAt: new Date().toISOString(),
        appliedKeys,
      }, actorId);

      return { status: 'applied', version: pkg.version, appliedKeys, skippedKeys };
    } catch (err) {
      await db.insert(forumNetworkPolicyApplications).values({
        id: crypto.randomUUID(),
        policyVersion: pkg.version,
        checksum: pkg.checksum,
        source,
        status: 'failed',
        appliedKeys,
        skippedKeys,
        errorMessage: String(err.message || err).slice(0, 1000),
        appliedAt: new Date(),
        actorId,
      });
      throw err;
    }
  }

  buildTopicRefPackage({ sourceForumId, topics, version }) {
    const items = (topics || []).map((t) => {
      const titleNormalized = normalizeTitle(t.title);
      return {
        sourceTopicKey: t.sourceTopicKey || t.id || null,
        titleNormalized,
        titleHash: titleHash(t.title),
        categoryHint: t.categoryHint || t.category || null,
        meta: { titlePreview: String(t.title || '').slice(0, 120) },
      };
    }).filter((t) => t.titleNormalized && t.titleHash);

    const payload = {
      schema: TOPIC_REF_SCHEMA,
      version: version || `${new Date().toISOString()}#refs`,
      sourceForumId: sourceForumId || process.env.FORUM_ID || 'unknown',
      items,
      createdAt: new Date().toISOString(),
    };
    return { ...payload, checksum: checksumOf(payload) };
  }

  async importTopicReferences(pkg) {
    await this.requireReady();
    if (!pkg || pkg.schema !== TOPIC_REF_SCHEMA) throw fail('Invalid topic ref schema', 400, 'invalid_topic_refs');
    let imported = 0;
    let skipped = 0;
    for (const item of pkg.items || []) {
      try {
        await db.insert(forumTopicReferenceSnapshots).values({
          id: crypto.randomUUID(),
          sourceForumId: pkg.sourceForumId,
          sourceTopicKey: item.sourceTopicKey ? String(item.sourceTopicKey) : null,
          titleNormalized: item.titleNormalized,
          titleHash: item.titleHash,
          categoryHint: item.categoryHint || null,
          packageVersion: pkg.version,
          meta: item.meta || {},
          capturedAt: new Date(),
        }).onConflictDoNothing();
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
    await this.setSetting('topic_refs_imported', {
      version: pkg.version,
      sourceForumId: pkg.sourceForumId,
      imported,
      skipped,
      at: new Date().toISOString(),
      publicExposure: false,
    });
    return { imported, skipped, version: pkg.version };
  }

  async findReferenceCollision(title) {
    await this.requireReady();
    const hash = titleHash(title);
    const rows = await db.select().from(forumTopicReferenceSnapshots)
      .where(eq(forumTopicReferenceSnapshots.titleHash, hash)).limit(5);
    return { hash, matches: rows };
  }

  async countTopicReferences() {
    await this.requireReady();
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM forum_topic_reference_snapshots');
    return Number(rows[0]?.n) || 0;
  }

  async listTemplates() {
    await this.requireReady();
    return db.select().from(forumNetworkTemplates).orderBy(desc(forumNetworkTemplates.updatedAt));
  }

  async listPolicyApplications(limit = 50) {
    await this.requireReady();
    return db.select().from(forumNetworkPolicyApplications)
      .orderBy(desc(forumNetworkPolicyApplications.appliedAt))
      .limit(Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  summarizeTemplate(row) {
    const payload = row?.payload || {};
    const templateKeys = Object.keys(payload.template || {});
    const managedKeys = Object.keys(payload.managed || {});
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      configCount: templateKeys.length + managedKeys.length,
      templateKeyCount: templateKeys.length,
      managedKeyCount: managedKeys.length,
      topicReferenceCount: Array.isArray(payload.topicReferences) ? payload.topicReferences.length : 0,
      groups: {
        template: payload.template || {},
        managed: payload.managed || {},
        local: Object.fromEntries(LOCAL_KEYS.map((k) => [k, 'child_owned'])),
      },
      editableInAdmin: false,
      editReason: 'Template files are versioned via CLI/registry; Admin UI is read-only until a validated write API exists.',
    };
  }

  async overview() {
    const base = await this.status();
    if (!base.ready) return base;

    const [children, templates, applications, policies, topicRefs] = await Promise.all([
      base.role === 'parent' ? this.listChildren() : Promise.resolve([]),
      this.listTemplates(),
      this.listPolicyApplications(20),
      this.listPolicyVersions().catch(() => []),
      this.countTopicReferences().catch(() => 0),
    ]);

    const latestTemplate = templates[0] ? this.summarizeTemplate(templates[0]) : null;
    const lastApp = applications[0] || null;
    let parentConnection = 'not_applicable';
    if (base.role === 'child') {
      parentConnection = base.parentLink?.parentForumId
        ? 'configured_offline_safe'
        : 'not_linked';
    } else if (base.role === 'parent') {
      parentConnection = 'is_parent';
    } else {
      parentConnection = 'independent';
    }

    return {
      ...base,
      childCount: children.length,
      children,
      templates: templates.map((t) => this.summarizeTemplate(t)),
      latestTemplate,
      policyVersions: policies,
      policyApplications: applications,
      lastPolicyApplication: lastApp,
      lastSyncAt: lastApp?.appliedAt || base.lastManagedPolicy?.appliedAt || null,
      managedPolicyVersion: base.lastManagedPolicy?.version || policies[0]?.version || null,
      templateVersion: latestTemplate?.id || null,
      topicReferenceCount: topicRefs,
      parentConnection,
      roleLabel: base.role === 'parent' ? 'parent' : base.role === 'child' ? 'child' : 'independent',
    };
  }

  /**
   * Draft Child registry config for operators (does not create DB).
   */
  async draftChildConfig(input = {}) {
    await this.requireReady();
    if (this.isProtectedForum()) {
      throw fail('Cannot draft Child from protected Forum A', 403, 'protected_forum');
    }
    const role = await this.getRole();
    if (role !== 'parent') throw fail('Only Parent may draft Child configs', 403, 'not_parent');

    const id = String(input.id || '').trim();
    const database = String(input.database || '').trim();
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(id)) throw fail('Invalid child forum id', 400, 'invalid_id');
    if (!/^pbn_[a-z0-9_]+$/.test(database)) throw fail('Invalid database name (pbn_*)', 400, 'invalid_database');
    if (id === 'forum_a' || database === 'pbn_dev' || id === 'forum_b' || database === 'pbn_forum_b') {
      throw fail('Refusing draft that targets Forum A/B', 400, 'protected_target');
    }

    const freeMonths = Number(input.freeMonths || 2);
    if (![1, 2, 3].includes(freeMonths)) throw fail('freeMonths must be 1, 2, or 3', 400, 'invalid_free_months');

    const draft = {
      id,
      database,
      webPort: Number(input.webPort) || null,
      apiPort: Number(input.apiPort) || null,
      hostname: input.hostname || '127.0.0.1',
      name: input.name || id,
      locale: input.locale === 'en-US' ? 'en-US' : 'vi-VN',
      primaryColor: input.primaryColor || '#0369a1',
      logo: input.logo || '/logo.svg',
      description: input.description || 'PBN child forum',
      status: 'active',
      networkRole: 'child',
      publicOrigin: input.domain || input.publicOrigin || null,
    };

    const parentId = process.env.FORUM_ID || '<parent>';
    const cmd = [
      'node scripts/forum-network.mjs create-child',
      `--config forums/${id}.json`,
      `--parent forums/${parentId}.json`,
      `--template ${input.templateId || 'default'}`,
      `--free-months ${freeMonths}`,
    ].join(' ');

    return {
      created: false,
      provisioned: false,
      availableInRuntime: false,
      draft,
      suggestedFile: `forums/${id}.json`,
      command: cmd,
      adminNote: 'Initial admin is created by CLI provision (admin.json under .local/forums/<id>/). Passwords are never returned by this API.',
      nextSteps: [
        'Save the draft JSON as the suggestedFile in the repo registry.',
        'Confirm unique ports/database with the operator.',
        'Run the create-child CLI command on the desktop host.',
        'Do not run against Forum A/B databases.',
      ],
    };
  }

  async publishFromTemplate(templateId, { notes, actorId } = {}) {
    await this.requireReady();
    const row = await this.getTemplate(templateId || 'default');
    const payload = row?.payload || DEFAULT_NETWORK_TEMPLATE;
    const managed = payload.managed || {};
    return this.publishPolicy(managed, {
      notes: notes || `Published from template ${templateId || 'default'}`,
      actorId,
    });
  }
}
