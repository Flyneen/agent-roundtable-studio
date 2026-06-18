import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createAgentVersion, seedAgents } from "./seedAgents.mjs";

function emptyStore() {
  return {
    meta: {
      schema_version: 1,
      created_at: new Date().toISOString()
    },
    agents: [],
    agent_versions: [],
    task_profiles: [],
    sessions: [],
    trace_events: [],
    evidence_items: [],
    artifacts: [],
    share_records: []
  };
}

export class JsonStore {
  constructor(config) {
    this.config = config;
    this.file = config.storeFile;
    this.data = null;
  }

  init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });

    if (!fs.existsSync(this.file)) {
      this.data = emptyStore();
      this.seed();
      this.save();
      return;
    }

    this.data = JSON.parse(fs.readFileSync(this.file, "utf8"));
    this.ensureShape();
    if (this.data.agents.length === 0) {
      this.seed();
      this.save();
    }
  }

  ensureShape() {
    const blank = emptyStore();
    for (const key of Object.keys(blank)) {
      if (!(key in this.data)) {
        this.data[key] = blank[key];
      }
    }
  }

  seed() {
    this.data.agents = seedAgents.map((agent) => ({
      ...agent,
      created_at: new Date().toISOString(),
      created_by: "system"
    }));
    this.data.agent_versions = this.data.agents.map(createAgentVersion);
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf8");
  }

  list(collection) {
    return this.data[collection] || [];
  }

  get(collection, idField, id) {
    return this.list(collection).find((item) => item[idField] === id) || null;
  }

  insert(collection, item) {
    const next = {
      ...item,
      created_at: item.created_at || new Date().toISOString()
    };
    this.data[collection].push(next);
    this.save();
    return next;
  }

  update(collection, idField, id, patch) {
    const items = this.list(collection);
    const index = items.findIndex((item) => item[idField] === id);
    if (index === -1) {
      return null;
    }
    items[index] = {
      ...items[index],
      ...patch,
      updated_at: new Date().toISOString()
    };
    this.save();
    return items[index];
  }

  newId(prefix) {
    return `${prefix}_${randomUUID()}`;
  }
}
