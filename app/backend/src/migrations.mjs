export const CURRENT_SCHEMA_VERSION = 3;

const migrations = [
  {
    id: "001-initialize-migration-ledger",
    version: 1,
    up(data) {
      data.meta ||= {};
      data.meta.migrations_applied ||= [];
      return data;
    }
  },
  {
    id: "002-add-sharing-record-fields",
    version: 2,
    up(data) {
      data.share_records ||= [];
      for (const agent of data.agents || []) {
        agent.publish_status ||= agent.agent_class === "system_public" ? "published" : "draft";
        agent.visibility_scope ||= agent.agent_class === "system_public" ? "all_users" : "owner_only";
        agent.share_state ||= agent.agent_class === "shared_public" ? "shared" : "not_shared";
      }
      return data;
    }
  },
  {
    id: "003-add-policy-audit-log",
    version: 3,
    up(data) {
      data.policy_decisions ||= [];
      return data;
    }
  }
];

export function migrateStore(data) {
  data.meta ||= {};
  data.meta.migrations_applied ||= [];

  for (const migration of migrations) {
    if (data.meta.migrations_applied.includes(migration.id)) {
      continue;
    }
    migration.up(data);
    data.meta.migrations_applied.push(migration.id);
  }

  data.meta.schema_version = CURRENT_SCHEMA_VERSION;
  data.meta.migrated_at = new Date().toISOString();
  return data;
}
