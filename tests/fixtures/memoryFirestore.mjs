const clone = (value) => structuredClone(value);

function applyValue(previous, value) {
  if (value?.constructor?.name === "ArrayUnionTransform") return [...new Set([...(previous || []), ...value.elements])];
  if (value?.constructor?.name === "ArrayRemoveTransform") return (previous || []).filter((item) => !value.elements.includes(item));
  if (value?.constructor?.name === "ServerTimestampTransform") return { toDate: () => new Date() };
  if (Array.isArray(value)) return value.map((item) => applyValue(undefined, item));
  if (value && typeof value === "object" && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applyValue(previous?.[key], item)]));
  return value;
}

export function memoryFirestore(seed) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, new Map(Object.entries(rows).map(([id, value]) => [id, clone(value)]))]));
  const table = (name) => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
  let nextId = 1;
  const versions = new Map();
  let nextVersion = 1;
  const version = (name, id) => versions.get(`${name}/${id}`) || -1;
  const touch = (name, id) => versions.set(`${name}/${id}`, nextVersion++);
  const ref = (name, id) => ({
    id,
    path: `${name}/${id}`,
    check(kind, precondition = {}) {
      if (kind === "create" && table(name).has(id)) { const error = new Error("Already exists"); error.code = 6; throw error; }
      if (kind === "update" && !table(name).has(id) || precondition.lastUpdateTime !== undefined && version(name, id) !== precondition.lastUpdateTime) { const error = new Error("Document changed"); error.code = 9; throw error; }
    },
    async get() { return snap(name, id); },
    async set(value, options = {}) { const old = options.merge ? table(name).get(id) || {} : {}; table(name).set(id, applyValue(old, { ...old, ...value })); touch(name, id); },
    async create(value) { if (table(name).has(id)) throw new Error("Already exists"); table(name).set(id, applyValue({}, value)); touch(name, id); },
    async update(value) { if (!table(name).has(id)) throw new Error("Missing document"); table(name).set(id, applyValue(table(name).get(id), { ...table(name).get(id), ...value })); touch(name, id); },
    async delete() { table(name).delete(id); touch(name, id); },
  });
  const snap = (name, id) => ({ id, ref: ref(name, id), updateTime: version(name, id) || -1, exists: table(name).has(id), data: () => table(name).get(id) });
  return {
    collection(name) { return {
      doc(id) { return ref(name, id || `test-auto-${nextId++}`); },
      async get() { return { docs: [...table(name).keys()].map((id) => snap(name, id)) }; },
      where(field, op, value) { if (op !== "==") throw new Error("Unsupported query"); return { async get() { return { docs: [...table(name).keys()].filter((id) => table(name).get(id)?.[field] === value).map((id) => snap(name, id)) }; } }; },
    }; },
    batch() {
      const operations = [];
      return {
        create(target, value) { operations.push({ validate: () => target.check("create"), apply: () => target.create(value) }); },
        update(target, value, precondition) { operations.push({ validate: () => target.check("update", precondition), apply: () => target.update(value) }); },
        set(target, value, options) { operations.push({ validate: () => {}, apply: () => target.set(value, options) }); },
        delete(target, precondition) { operations.push({ validate: () => target.check("delete", precondition), apply: () => target.delete() }); },
        async commit() { for (const operation of operations) operation.validate(); for (const operation of operations) await operation.apply(); },
      };
    },
    async getAll(...refs) { return Promise.all(refs.map((item) => item.get())); },
    async runTransaction(work) { return work({ get: (item) => item.get(), getAll: (...items) => Promise.all(items.map((item) => item.get())), create: (item, value) => item.create(value), update: (item, value) => item.update(value) }); },
    inspect(name, id) { return table(name).get(id); },
  };
}

