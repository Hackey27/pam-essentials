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
  const ref = (name, id) => ({
    id,
    async get() { return snap(name, id); },
    async set(value, options = {}) { const old = options.merge ? table(name).get(id) || {} : {}; table(name).set(id, applyValue(old, { ...old, ...value })); },
    async create(value) { if (table(name).has(id)) throw new Error("Already exists"); table(name).set(id, applyValue({}, value)); },
    async update(value) { if (!table(name).has(id)) throw new Error("Missing document"); table(name).set(id, applyValue(table(name).get(id), { ...table(name).get(id), ...value })); },
  });
  const snap = (name, id) => ({ id, exists: table(name).has(id), data: () => table(name).get(id) });
  return {
    collection(name) { return {
      doc(id) { return ref(name, id); },
      async get() { return { docs: [...table(name).keys()].map((id) => snap(name, id)) }; },
      where(field, op, value) { if (op !== "==") throw new Error("Unsupported query"); return { async get() { return { docs: [...table(name).keys()].filter((id) => table(name).get(id)?.[field] === value).map((id) => snap(name, id)) }; } }; },
    }; },
    async getAll(...refs) { return Promise.all(refs.map((item) => item.get())); },
    async runTransaction(work) { return work({ get: (item) => item.get(), update: (item, value) => item.update(value) }); },
    inspect(name, id) { return table(name).get(id); },
  };
}

