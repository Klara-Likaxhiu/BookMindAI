/**
 * Shared Lexo API cache: memory dedupe + optional localStorage display cache.
 * Does not store auth tokens. Does not cache HTTP errors.
 */
(function initLexoApiCache() {
  const MEMORY_TTL_MS = 60 * 1000;
  const memory = new Map();
  const inflight = new Map();

  const LEGACY_PREFIXES = ["bookmind_", "bookmindai_"];

  function migrateLegacyKey(newKey) {
    try {
      if (localStorage.getItem(newKey) != null) return;
      for (const prefix of LEGACY_PREFIXES) {
        const oldKey = newKey.replace(/^lexo_/, prefix);
        const raw = localStorage.getItem(oldKey);
        if (raw == null) continue;
        localStorage.setItem(newKey, raw);
        localStorage.removeItem(oldKey);
        return;
      }
    } catch (_) {
      /* ignore */
    }
  }

  window.LexoApiCache = {
    memoryKey(namespace, key) {
      return `${namespace}::${key || "default"}`;
    },

    getMemory(namespace, key = "default") {
      const entry = memory.get(this.memoryKey(namespace, key));
      if (!entry) return null;
      if (Date.now() - entry.at > (entry.ttlMs || MEMORY_TTL_MS)) {
        memory.delete(this.memoryKey(namespace, key));
        return null;
      }
      return entry.data;
    },

    setMemory(namespace, key, data, ttlMs = MEMORY_TTL_MS) {
      if (data == null) return;
      memory.set(this.memoryKey(namespace, key), { data, at: Date.now(), ttlMs });
    },

    invalidate(namespace, key = null) {
      if (key != null) {
        memory.delete(this.memoryKey(namespace, key));
        return;
      }
      const prefix = `${namespace}::`;
      [...memory.keys()].forEach(k => {
        if (k.startsWith(prefix)) memory.delete(k);
      });
    },

    invalidateAll(namespaces = []) {
      namespaces.forEach(ns => this.invalidate(ns));
    },

    readDisplay(storageKey) {
      migrateLegacyKey(storageKey);
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
        return parsed;
      } catch {
        return null;
      }
    },

    writeDisplay(storageKey, value) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (_) {
        /* quota */
      }
    },

    /**
     * Deduplicate concurrent identical requests and optionally remember success.
     * fetcher must throw/reject on failure so errors are not cached.
     */
    async dedupe(namespace, key, fetcher, { ttlMs = MEMORY_TTL_MS, skipMemory = false } = {}) {
      const cacheKey = this.memoryKey(namespace, key);
      if (!skipMemory) {
        const cached = this.getMemory(namespace, key);
        if (cached != null) return cached;
      }
      if (inflight.has(cacheKey)) return inflight.get(cacheKey);

      const promise = (async () => {
        try {
          const data = await fetcher();
          if (data != null) this.setMemory(namespace, key, data, ttlMs);
          return data;
        } finally {
          inflight.delete(cacheKey);
        }
      })();

      inflight.set(cacheKey, promise);
      return promise;
    },
  };
})();
