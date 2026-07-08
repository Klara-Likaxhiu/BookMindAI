/** Reading Path completion — stats, XP, badges, Reader DNA updates. */
window.BookMindPathCompletion = {
  STATS_KEY: "bookmind_path_stats",
  XP_KEY: "bookmind_path_xp",
  BASE_XP: 50,
  XP_PER_BOOK: 15,

  readStats() {
    try {
      return JSON.parse(localStorage.getItem(this.STATS_KEY) || "null") || this.emptyStats();
    } catch {
      return this.emptyStats();
    }
  },

  emptyStats() {
    return {
      pathsCompleted: 0,
      totalXp: 0,
      completions: [],
      unlockedAdvanced: false,
      unlockedCategories: [],
      favoriteCategory: null,
    };
  },

  saveStats(stats) {
    localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
  },

  readXpBonus() {
    return Number(localStorage.getItem(this.XP_KEY) || 0) || 0;
  },

  addXp(amount) {
    const next = this.readXpBonus() + Math.max(0, amount);
    localStorage.setItem(this.XP_KEY, String(next));
    return next;
  },

  pathProgress(path) {
    const books = path?.books || [];
    const total = books.length;
    const completed = books.filter(b => b.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const allBooksDone = total > 0 && completed === total;
    return { books, total, completed, percent, allBooksDone };
  },

  isReadyToComplete(path) {
    if (!path || path.path_completed) return false;
    const { allBooksDone, total } = this.pathProgress(path);
    return allBooksDone && total > 0;
  },

  difficultyLabel(path) {
    return path.difficulty_progression || path.difficulty || "Personalized";
  },

  categoryFor(path) {
    return path.genre || path.genre_label || path.path_name?.split(" ")[0] || "General";
  },

  daysTaken(path, completedAt) {
    const start = path.started_at ? new Date(path.started_at) : null;
    const end = completedAt ? new Date(completedAt) : new Date();
    if (!start || Number.isNaN(start.getTime())) return 0;
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  },

  badgeForPath(path) {
    const slug = (path.genre_slug || path.path_name || "path")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return {
      id: `path-complete-${slug}-${path.id?.slice(0, 8) || "local"}`,
      title: `${path.path_name || "Reading Path"} Conqueror`,
      description: `Completed the ${path.path_name || "reading path"}.`,
      rarity: path.genre_slug ? "rare" : "epic",
    };
  },

  awardBadge(badge) {
    if (!window.BookMindBadgeEngine) return false;
    const earned = BookMindBadgeEngine.loadEarned();
    if (earned[badge.id]) return false;
    const now = new Date().toISOString();
    earned[badge.id] = now;
    BookMindBadgeEngine.saveEarned(earned);
    const seen = BookMindBadgeEngine.loadSeen();
    delete seen[badge.id];
    BookMindBadgeEngine.saveSeen(seen);
    return true;
  },

  updateReaderDna(path, stats) {
    try {
      const profile = JSON.parse(localStorage.getItem("readerProfile") || "null") || {};
      profile.paths_completed = stats.pathsCompleted;
      profile.last_path_completed = path.path_name;
      profile.last_path_completed_at = path.completed_at;
      profile.path_mastery_level = stats.pathsCompleted >= 5 ? "Advanced" : stats.pathsCompleted >= 2 ? "Intermediate" : "Explorer";
      const genres = new Set(profile.favorite_genres || []);
      if (path.genre) genres.add(path.genre);
      profile.favorite_genres = [...genres];
      profile.unlocked_path_categories = stats.unlockedCategories;
      localStorage.setItem("readerProfile", JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  },

  recomputeFavoriteCategory(completions) {
    const counts = {};
    completions.forEach(entry => {
      const cat = entry.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  },

  computeAggregateStats(paths) {
    const all = paths || [];
    const active = all.filter(p => !p.path_completed);
    const completed = all.filter(p => p.path_completed);
    const stats = this.readStats();

    let startedCount = 0;
    let finishedBooksOnActive = 0;
    let totalBooksOnActive = 0;

    active.forEach(path => {
      const prog = this.pathProgress(path);
      if (prog.completed > 0 || path.started_at) startedCount += 1;
      finishedBooksOnActive += prog.completed;
      totalBooksOnActive += prog.total;
    });

    const completionRate =
      totalBooksOnActive > 0
        ? Math.round((finishedBooksOnActive / totalBooksOnActive) * 100)
        : completed.length
          ? 100
          : 0;

    const durations = stats.completions.map(c => c.daysTaken).filter(Boolean);
    const avgDays = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return {
      pathsCompleted: stats.pathsCompleted,
      activePaths: active.length,
      completionRate,
      avgCompletionDays: avgDays,
      favoriteCategory: stats.favoriteCategory || this.recomputeFavoriteCategory(stats.completions),
      totalXp: stats.totalXp + this.readXpBonus(),
      unlockedAdvanced: stats.unlockedAdvanced,
    };
  },

  completePath(path) {
    if (!this.isReadyToComplete(path)) {
      throw new Error("Complete every book in this path before finishing it.");
    }

    const completedAt = new Date().toISOString();
    if (!path.started_at) path.started_at = completedAt;

    const badge = this.badgeForPath(path);
    const daysTaken = this.daysTaken(path, completedAt);
    const xp = this.BASE_XP + (path.books?.length || 0) * this.XP_PER_BOOK;
    const category = this.categoryFor(path);

    path.path_completed = true;
    path.completed_at = completedAt;
    path.completion_badge_id = badge.id;
    path.completion_badge_title = badge.title;

    const stats = this.readStats();
    stats.pathsCompleted += 1;
    stats.totalXp += xp;
    stats.unlockedAdvanced = stats.pathsCompleted >= 1;
    if (category && !stats.unlockedCategories.includes(category)) {
      stats.unlockedCategories.push(category);
    }
    stats.completions.unshift({
      pathId: path.id,
      pathName: path.path_name,
      completedAt,
      booksCount: path.books?.length || 0,
      daysTaken,
      difficulty: this.difficultyLabel(path),
      badgeId: badge.id,
      badgeTitle: badge.title,
      category,
      genre: path.genre || null,
    });
    stats.favoriteCategory = this.recomputeFavoriteCategory(stats.completions);
    this.saveStats(stats);
    this.addXp(xp);
    this.awardBadge(badge);
    this.updateReaderDna(path, stats);

    if (window.BookMindBadgeEngine && window.BookMindBadgeCatalog) {
      const ctx = BookMindBadgeEngine.buildContext();
      BookMindBadgeEngine.evaluateAll(ctx);
    }

    return { path, badge, xp, daysTaken, stats };
  },

  restartPath(path) {
    path.path_completed = false;
    path.completed_at = null;
    path.completion_badge_id = null;
    path.completion_badge_title = null;
    path.started_at = null;
    (path.books || []).forEach(book => {
      book.completed = false;
    });
  },

  formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  },

  shareText(path, badge) {
    return `I completed the "${path.path_name}" Reading Path on BookMindAI! 🎉 Badge: ${badge.title}`;
  },
};
