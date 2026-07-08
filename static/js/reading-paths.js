const generateBtn = document.getElementById("generateBtn");
const pathsGrid = document.getElementById("pathsGrid");
const pathsMessage = document.getElementById("pathsMessage");
const pathStatsBar = document.getElementById("pathStatsBar");
const activePathsSection = document.getElementById("activePathsSection");
const activePathsGrid = document.getElementById("activePathsGrid");
const completedPathsSection = document.getElementById("completedPathsSection");
const completedPathsGrid = document.getElementById("completedPathsGrid");
const pathsUnlockBanner = document.getElementById("pathsUnlockBanner");
const pathCompletionModal = document.getElementById("pathCompletionModal");

const STORE_KEY = "bookmind_reading_paths";
const Completion = () => window.BookMindPathCompletion;
let focusPathId = new URLSearchParams(window.location.search).get("path");
let saveTimer = null;

const ICONS = {
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  check: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
};

function svg(name, cls) {
  return `<svg class="icon ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uid() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);
}

function normalize(result) {
  const paths = (result.paths || []).map(path => ({
    ...path,
    id: path.id || uid(),
    started_at: path.started_at || null,
    path_completed: Boolean(path.path_completed),
    completed_at: path.completed_at || null,
    completion_badge_id: path.completion_badge_id || null,
    completion_badge_title: path.completion_badge_title || null,
    books: (path.books || []).map(book => ({
      ...book,
      id: book.id || uid(),
      completed: Boolean(book.completed),
    })),
  }));
  return { ...result, paths };
}

function loadLocalPaths() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return raw ? normalize(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalPaths(result) {
  localStorage.setItem(STORE_KEY, JSON.stringify(result));
}

async function loadPathsFromServer() {
  if (!window.BookMindAPI?.get) return null;

  const token = await BookMindAPI.ensureAuth({ redirect: false });
  if (!token) return loadLocalPaths();

  try {
    const data = await BookMindAPI.get("/api/reading-paths");
    if (Array.isArray(data?.paths) && data.paths.length) {
      return normalize(data);
    }

    const local = loadLocalPaths();
    if (local?.paths?.length) {
      await persistPaths(local, { immediate: true });
      localStorage.removeItem(STORE_KEY);
      return local;
    }

    return normalize(data || { message: "Your saved reading paths.", paths: [] });
  } catch {
    return loadLocalPaths();
  }
}

async function persistPaths(result, { immediate = false } = {}) {
  saveLocalPaths(result);

  if (!window.BookMindAPI?.put) return;

  const run = async () => {
    try {
      const token = await BookMindAPI.ensureAuth({ redirect: false });
      if (!token) return;
      const data = await BookMindAPI.put("/api/reading-paths", {
        message: result.message,
        paths: result.paths,
      });
      if (Array.isArray(data?.paths)) {
        const savedByKey = new Map(
          data.paths.map(path => [path.id || path.path_name, path])
        );
        const merged = result.paths.map(path => {
          const saved = savedByKey.get(path.id) || savedByKey.get(path.path_name);
          return saved ? { ...path, ...saved } : path;
        });
        data.paths.forEach(path => {
          if (!merged.some(item => item.id === path.id)) {
            merged.push(path);
          }
        });
        state = normalize({ ...result, paths: merged });
      }
    } catch {
      /* local cache remains as fallback */
    }
  };

  if (immediate) {
    await run();
  } else {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(run, 400);
  }
}

function savePaths(result) {
  state = result;
  void persistPaths(result);
}

let state = normalize({ message: "", paths: [] });

function orderPaths(paths) {
  const list = paths.slice();
  if (!focusPathId) return list;

  list.sort((a, b) => {
    if (a.id === focusPathId) return -1;
    if (b.id === focusPathId) return 1;
    return 0;
  });
  return list;
}

function showPathFlash() {
  const flash = sessionStorage.getItem("bookmind_path_flash");
  if (!flash) return;
  sessionStorage.removeItem("bookmind_path_flash");
  showPathToast(flash);
}

void (async () => {
  if (window.BookMindAPI?.ensureAuth) {
    const token = await BookMindAPI.ensureAuth({ redirect: false });
    if (token) {
      await BookMindLibrary.ensureLoaded();
    }
  }

  const loaded = await loadPathsFromServer();
  if (loaded) {
    state = loaded;
    renderPaths(state);
    if (state.paths?.length) {
      generateBtn.textContent = "Regenerate Paths";
    }
  }

  showPathFlash();
})();

generateBtn.addEventListener("click", async () => {
  generateBtn.textContent = "Generating...";
  generateBtn.disabled = true;

  pathsGrid.innerHTML = "";
  activePathsGrid.innerHTML = "";
  completedPathsGrid.innerHTML = "";
  pathsMessage.style.display = "block";
  pathsMessage.innerHTML = `
    <h2>Building your personalized reading journeys...</h2>
    <p>BookMindAI is analyzing your Reader DNA, library, mood, and goal.</p>
  `;

  const readerProfile = JSON.parse(localStorage.getItem("readerProfile"));

  try {
    await BookMindLibrary.ensureLoaded();
    const library = BookMindLibrary.getLibrary();

    const result = await BookMindAPI.post("/api/reader/paths", {
      reader_profile: readerProfile,
      library: library,
      today_mood: localStorage.getItem("bookmind_today_mood"),
      today_goal: localStorage.getItem("bookmind_today_goal"),
    });

    state = normalize(result);
    const genrePaths = (await loadPathsFromServer())?.paths?.filter(p => p.genre_slug) || [];
    if (genrePaths.length) {
      const ids = new Set(state.paths.map(p => p.id));
      genrePaths.forEach(path => {
        if (!ids.has(path.id)) state.paths.push(path);
      });
    }
    await persistPaths(state, { immediate: true });
    renderPaths(state);
  } catch {
    pathsMessage.innerHTML = `
      <h2>Couldn't generate paths right now.</h2>
      <p>Please try again in a moment.</p>
    `;
  }

  generateBtn.textContent = "Regenerate Paths";
  generateBtn.disabled = false;
});

/* ---------------------------------------------------------------- actions */

function findPath(pathId) {
  return state.paths.find(p => p.id === pathId);
}

function showPathToast(message, isError = false) {
  const toast = document.getElementById("pathsToast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
    if (!isError) toast.hidden = true;
  }, 3200);
}

function invalidatePathCompletion(path) {
  if (!path?.path_completed) return;
  path.path_completed = false;
  path.completed_at = null;
  path.completion_badge_id = null;
  path.completion_badge_title = null;
}

function ensureStartedAt(path) {
  const prog = Completion()?.pathProgress(path);
  if (prog?.completed > 0 && !path.started_at) {
    path.started_at = new Date().toISOString();
  }
}

function toggleComplete(pathId, bookId) {
  const path = findPath(pathId);
  if (!path) return;
  const book = path.books.find(b => b.id === bookId);
  if (!book) return;

  void (async () => {
    if (!window.BookMindAPI?.ensureAuth) {
      showPathToast("BookMindAPI is not loaded.", true);
      return;
    }

    const token = await BookMindAPI.ensureAuth({ redirect: true });
    if (!token) {
      showPathToast("Sign in to update your library.", true);
      return;
    }

    await BookMindLibrary.ensureLoaded();

    const nextCompleted = !book.completed;
    const payload = {
      title: book.title,
      author: book.author || "",
      genre: book.genre || path.genre || "Book",
    };

    try {
      if (nextCompleted) {
        const existing = BookMindLibrary.findBook(payload);
        if (existing?.library_id) {
          await BookMindLibrary.patchBook(existing.library_id, {
            status: "read",
            progress: 100,
          });
        } else {
          await BookMindLibrary.addBook(payload, "read", { progress: 100, silent: true });
        }
        book.completed = true;
        ensureStartedAt(path);
        showPathToast(`"${book.title}" marked as Finished in your library.`);
      } else {
        const entry = BookMindLibrary.findBook(payload);
        if (entry?.library_id) {
          await BookMindLibrary.patchBook(entry.library_id, {
            status: "reading",
            progress: entry.progress || 0,
          });
        } else {
          BookMindLibrary.clearFinish(payload);
        }
        book.completed = false;
        invalidatePathCompletion(path);
        showPathToast(`"${book.title}" moved back to Currently Reading.`);
      }

      savePaths(state);
      renderPaths(state);
      window.BookMindLibraryPage?.refresh?.();
    } catch (error) {
      showPathToast(error.message || "Could not update your library.", true);
    }
  })();
}

function completeNext(pathId) {
  const path = findPath(pathId);
  if (!path) return;
  const next = path.books.find(b => !b.completed);
  if (next) toggleComplete(pathId, next.id);
}

function completeReadingPath(pathId) {
  const path = findPath(pathId);
  const C = Completion();
  if (!path || !C) return;

  if (!C.isReadyToComplete(path)) {
    showPathToast("Complete all books to finish this Reading Path.", true);
    return;
  }

  try {
    const result = C.completePath(path);
    savePaths(state);
    renderPaths(state);
    showCompletionModal(result);
    showPathToast(`"${path.path_name}" completed! +${result.xp} XP`);
  } catch (error) {
    showPathToast(error.message || "Could not complete this path.", true);
  }
}

function restartPath(pathId) {
  const path = findPath(pathId);
  const C = Completion();
  if (!path || !C) return;

  if (!window.confirm(`Restart "${path.path_name}"? All book progress will reset.`)) return;

  C.restartPath(path);
  savePaths(state);
  renderPaths(state);
  showPathToast(`"${path.path_name}" restarted. Happy rereading!`);
}

function revisitPath(pathId) {
  const card = document.querySelector(`.path-card-completed[data-path="${pathId}"]`);
  if (card) {
    const panel = card.querySelector(".path-review-panel");
    if (panel) {
      const expanded = !card.classList.contains("path-review-expanded");
      card.classList.toggle("path-review-expanded", expanded);
      panel.hidden = !expanded;
    }
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const active = document.querySelector(`.path-card[data-path="${pathId}"]`);
  active?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function addBookToPath(pathId, title, author) {
  const path = findPath(pathId);
  if (!path || !title.trim()) return;

  invalidatePathCompletion(path);

  path.books.push({
    id: uid(),
    title: title.trim(),
    author: (author || "").trim(),
    level: "Added by you",
    difficulty: "Custom",
    reason: "You added this book to the path.",
    completed: false,
  });

  savePaths(state);
  renderPaths(state);
}

function removeBookFromPath(pathId, bookId) {
  const path = findPath(pathId);
  if (!path) return;
  path.books = path.books.filter(b => b.id !== bookId);
  invalidatePathCompletion(path);
  savePaths(state);
  renderPaths(state);
}

/* ----------------------------------------------------------- completion UI */

let lastCompletionShare = "";

function showCompletionModal({ path, badge, xp, daysTaken }) {
  if (!pathCompletionModal) return;

  const C = Completion();
  document.getElementById("pathCompletionPathName").textContent = `You completed: ${path.path_name}`;
  document.getElementById("pathCompletionRewards").innerHTML = `
    <div class="path-reward-pill">${svg("trophy", "icon-inline")} Badge: ${escapeHtml(badge.title)}</div>
    <div class="path-reward-pill">+${xp} Reading Journey XP</div>
    <div class="path-reward-pill">${path.books?.length || 0} books · ${daysTaken} day${daysTaken === 1 ? "" : "s"}</div>
  `;

  document.getElementById("pathCompletionShareTitle").textContent = path.path_name;
  document.getElementById("pathCompletionShareMeta").textContent =
    `Completed ${C.formatDate(path.completed_at)} · ${C.difficultyLabel(path)} · ${path.books?.length || 0} books`;
  document.getElementById("pathCompletionShareBadge").innerHTML =
    `${svg("trophy", "icon-inline")} ${escapeHtml(badge.title)}`;

  lastCompletionShare = C.shareText(path, badge);

  pathCompletionModal.hidden = false;
  pathCompletionModal.setAttribute("aria-hidden", "false");
  pathCompletionModal.classList.add("is-open");
}

function closeCompletionModal() {
  if (!pathCompletionModal) return;
  pathCompletionModal.classList.remove("is-open");
  pathCompletionModal.hidden = true;
  pathCompletionModal.setAttribute("aria-hidden", "true");
}

document.getElementById("pathCompletionShareBtn")?.addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: "BookMindAI Reading Path", text: lastCompletionShare });
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    await navigator.clipboard.writeText(lastCompletionShare);
    showPathToast("Achievement copied to clipboard.");
  } catch {
    showPathToast(lastCompletionShare);
  }
});

pathCompletionModal?.addEventListener("click", event => {
  if (event.target.closest("[data-action='close-modal']")) {
    closeCompletionModal();
  }
});

/* ---------------------------------------------------------------- render */

function libraryTitleOptions() {
  const library = BookMindLibrary.getLibrary();
  const titles = new Set();
  Object.values(library).forEach(shelf =>
    (shelf || []).forEach(book => book && book.title && titles.add(book.title))
  );
  return [...titles].map(t => `<option value="${escapeHtml(t)}"></option>`).join("");
}

function milestoneStrip(completed, total, pathCompleted) {
  const half = Math.ceil(total / 2);
  const milestones = [
    { label: "Started", reached: completed >= 1 },
    { label: "Halfway", reached: total > 0 && completed >= half },
    { label: "All books read", reached: total > 0 && completed >= total },
    { label: "Path finished", reached: pathCompleted },
  ];

  return `
    <div class="path-milestones">
      ${milestones
        .map(
          m => `
        <span class="milestone ${m.reached ? "reached" : ""}">
          ${m.reached ? svg("check", "icon-inline") : svg("flag", "icon-inline")}
          ${m.label}
        </span>
      `
        )
        .join("")}
    </div>
  `;
}

function renderPathStats(paths) {
  const C = Completion();
  if (!pathStatsBar || !C) return;

  const stats = C.computeAggregateStats(paths);
  if (!paths.length) {
    pathStatsBar.hidden = true;
    return;
  }

  pathStatsBar.hidden = false;
  pathStatsBar.innerHTML = `
    <div class="path-stat">
      <strong>${stats.pathsCompleted}</strong>
      <span>Paths Completed</span>
    </div>
    <div class="path-stat">
      <strong>${stats.activePaths}</strong>
      <span>Active Paths</span>
    </div>
    <div class="path-stat">
      <strong>${stats.completionRate}%</strong>
      <span>Completion Rate</span>
    </div>
    <div class="path-stat">
      <strong>${stats.avgCompletionDays || "—"}${stats.avgCompletionDays ? "d" : ""}</strong>
      <span>Avg. Completion Time</span>
    </div>
    <div class="path-stat">
      <strong>${escapeHtml(stats.favoriteCategory || "—")}</strong>
      <span>Favorite Category</span>
    </div>
  `;
}

function renderUnlockBanner(stats) {
  if (!pathsUnlockBanner) return;
  if (!stats.unlockedAdvanced) {
    pathsUnlockBanner.hidden = true;
    return;
  }

  pathsUnlockBanner.hidden = false;
  pathsUnlockBanner.innerHTML = `
    <div class="path-unlock-content">
      <strong>Unlocked:</strong> Advanced paths, AI recommendations from completed journeys, exclusive badges, and new genre suggestions.
    </div>
  `;
}

function renderCompletePathButton(path, { completed, total, allBooksDone }) {
  const C = Completion();
  const ready = C?.isReadyToComplete(path);
  const isCompleted = path.path_completed;

  if (isCompleted) return "";

  const disabled = !allBooksDone;
  const hint = disabled
    ? `<p class="path-complete-hint">Complete all books to finish this Reading Path.</p>`
    : "";

  return `
    ${hint}
    <button
      type="button"
      class="btn btn-primary path-complete-btn ${ready ? "path-complete-btn-ready" : "path-complete-btn-disabled"}"
      data-action="complete-path"
      ${disabled ? "disabled" : ""}
    >
      ${svg("trophy", "icon-inline")} Complete Reading Path
    </button>
  `;
}

function renderActivePathCard(path, pathIndex) {
  const C = Completion();
  const prog = C?.pathProgress(path) || { completed: 0, total: 0, percent: 0, allBooksDone: false };
  const { completed, total, percent, allBooksDone } = prog;
  const isFocus = focusPathId && path.id === focusPathId;

  return `
    <div class="path-card card ${isFocus ? "path-card-focus" : ""}" data-path="${path.id}">
      <div class="path-header">
        <div class="path-icon">${svg("route")}</div>
        <div>
          <p class="eyebrow">${path.genre ? escapeHtml(path.genre) : `Path ${pathIndex + 1}`}</p>
          <h2>${escapeHtml(path.path_name || "Personalized Reading Path")}</h2>
          <p>${escapeHtml(path.why_this_path || "A personalized path created from your Reader DNA.")}</p>
        </div>
      </div>

      ${milestoneStrip(completed, total, false)}

      <div class="path-progress">
        <div style="width: ${percent}%;"></div>
      </div>
      <p class="path-count">${escapeHtml(path.difficulty_progression || "Personalized progression")} · ${completed} / ${total} books completed</p>

      <div class="path-timeline">
        ${(path.books || [])
          .map(
            (book, index) => `
            <div class="path-book ${book.completed ? "done" : ""}">
              <div class="path-step">${book.completed ? svg("check", "icon-inline") : index + 1}</div>
              <div class="path-book-cover">
                ${
                  window.BookMindCoverImage
                    ? BookMindCoverImage.html(book, {
                        imgClass: "path-book-cover-img book-cover-img",
                        wrapClass: "book-cover-wrap path-cover-wrap",
                        placeholderClass: "path-book-cover-ph book-cover-placeholder",
                      })
                    : svg("book")
                }
              </div>
              <div class="path-book-info">
                <span>${escapeHtml(book.level || "Recommended")}${book.difficulty ? ` · ${escapeHtml(book.difficulty)}` : ""}</span>
                <h3>${escapeHtml(book.title || "Untitled Book")}</h3>
                <p>${escapeHtml(book.author || "Unknown Author")}</p>
                <small>${escapeHtml(book.reason || "")}</small>
              </div>
              <div class="path-book-actions">
                <button class="btn btn-secondary btn-sm" data-action="toggle" data-book="${book.id}">
                  ${book.completed ? "Completed" : "Mark complete"}
                </button>
                <button class="path-book-remove" data-action="remove" data-book="${book.id}" title="Remove from path">${svg("x", "icon-inline")}</button>
              </div>
            </div>
          `
          )
          .join("")}
      </div>

      <div class="path-add">
        <input type="text" class="path-add-title" list="libraryTitles" placeholder="Add a book by title">
        <input type="text" class="path-add-author" placeholder="Author (optional)">
        <button class="btn btn-secondary" data-action="add">${svg("plus", "icon-inline")} Add</button>
      </div>

      <button class="btn btn-secondary complete-next-btn" data-action="next" ${allBooksDone ? "disabled" : ""}>
        Mark next book complete
      </button>

      ${renderCompletePathButton(path, { completed, total, allBooksDone })}
    </div>
  `;
}

function renderCompletedPathCard(path) {
  const C = Completion();
  const total = path.books?.length || 0;
  const daysTaken = C?.daysTaken(path, path.completed_at) || 0;
  const badgeTitle = path.completion_badge_title || "Path Conqueror";

  return `
    <div class="path-card path-card-completed card" data-path="${path.id}">
      <div class="path-completed-ribbon">
        ${svg("check", "icon-inline")} Completed
      </div>

      <div class="path-header">
        <div class="path-icon path-icon-completed">${svg("trophy")}</div>
        <div>
          <p class="eyebrow">${path.genre ? escapeHtml(path.genre) : "Completed path"}</p>
          <h2>${escapeHtml(path.path_name || "Reading Path")}</h2>
          <p>${escapeHtml(path.why_this_path || "")}</p>
        </div>
      </div>

      <div class="path-completed-meta">
        <div class="path-completed-stat">
          <span>Completed</span>
          <strong>${C?.formatDate(path.completed_at) || "—"}</strong>
        </div>
        <div class="path-completed-stat">
          <span>Books</span>
          <strong>${total}</strong>
        </div>
        <div class="path-completed-stat">
          <span>Time taken</span>
          <strong>${daysTaken} day${daysTaken === 1 ? "" : "s"}</strong>
        </div>
        <div class="path-completed-stat">
          <span>Difficulty</span>
          <strong>${escapeHtml(C?.difficultyLabel(path) || "—")}</strong>
        </div>
        <div class="path-completed-stat path-completed-badge">
          <span>Badge</span>
          <strong>${svg("trophy", "icon-inline")} ${escapeHtml(badgeTitle)}</strong>
        </div>
      </div>

      <div class="path-completed-actions">
        <button type="button" class="btn btn-secondary" data-action="revisit">${svg("eye", "icon-inline")} Review path</button>
        <button type="button" class="btn btn-secondary" data-action="restart">${svg("refresh", "icon-inline")} Restart for reread</button>
      </div>

      <div class="path-review-panel" hidden>
        <h3 class="path-review-title">Books in this path</h3>
        <div class="path-timeline path-timeline-readonly">
          ${(path.books || [])
            .map(
              (book, index) => `
              <div class="path-book done">
                <div class="path-step">${svg("check", "icon-inline")}</div>
                <div class="path-book-info">
                  <span>Book ${index + 1}${book.difficulty ? ` · ${escapeHtml(book.difficulty)}` : ""}</span>
                  <h3>${escapeHtml(book.title || "Untitled Book")}</h3>
                  <p>${escapeHtml(book.author || "Unknown Author")}</p>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function hydrateCovers(container, paths) {
  if (!window.BookMindCoverImage || !container) return;
  const allBooks = paths.flatMap(path => path.books || []);
  BookMindCoverImage.seedFromBooks(allBooks);
  BookMindCoverImage.hydrateLazy(container, {
    imgClass: "path-book-cover-img book-cover-img",
  });
}

function renderPaths(result) {
  const paths = orderPaths(result.paths || []);
  const C = Completion();
  const activePaths = paths.filter(p => !p.path_completed);
  const completedPaths = paths.filter(p => p.path_completed);
  const aggregateStats = C?.computeAggregateStats(paths) || {};

  pathsMessage.style.display = "block";
  pathsMessage.innerHTML = `<h2>${escapeHtml(result.message || "Here are your personalized reading paths.")}</h2>`;

  renderPathStats(paths);
  renderUnlockBanner(aggregateStats);

  if (paths.length === 0) {
    pathsGrid.innerHTML = "";
    activePathsGrid.innerHTML = "";
    completedPathsGrid.innerHTML = "";
    activePathsSection.hidden = true;
    completedPathsSection.hidden = true;
    pathsMessage.innerHTML += `<p>No paths yet — click "Generate My Journey" or explore genres on Reader Journey.</p>`;
    return;
  }

  pathsGrid.innerHTML = "";
  pathsGrid.hidden = true;

  if (activePaths.length) {
    activePathsSection.hidden = false;
    activePathsGrid.innerHTML = activePaths
      .map((path, index) => renderActivePathCard(path, index))
      .join("");
  } else {
    activePathsSection.hidden = true;
    activePathsGrid.innerHTML = "";
  }

  if (completedPaths.length) {
    completedPathsSection.hidden = false;
    completedPathsGrid.innerHTML = completedPaths.map(renderCompletedPathCard).join("");
  } else {
    completedPathsSection.hidden = true;
    completedPathsGrid.innerHTML = "";
  }

  let datalist = document.getElementById("libraryTitles");
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = "libraryTitles";
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = libraryTitleOptions();

  hydrateCovers(activePathsGrid, activePaths);

  const focusCard =
    activePathsGrid.querySelector(".path-card-focus") ||
    completedPathsGrid.querySelector(`[data-path="${focusPathId}"]`);
  if (focusCard) {
    focusCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ------------------------------------------------------- event delegation */

function handlePathGridClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = button.closest(".path-card, .path-card-completed");
  const pathId = card?.dataset?.path;
  if (!pathId) return;

  const action = button.dataset.action;

  if (action === "toggle") {
    toggleComplete(pathId, button.dataset.book);
  } else if (action === "remove") {
    removeBookFromPath(pathId, button.dataset.book);
  } else if (action === "next") {
    completeNext(pathId);
  } else if (action === "add") {
    const titleInput = card.querySelector(".path-add-title");
    const authorInput = card.querySelector(".path-add-author");
    addBookToPath(pathId, titleInput.value, authorInput.value);
  } else if (action === "complete-path") {
    completeReadingPath(pathId);
  } else if (action === "restart") {
    restartPath(pathId);
  } else if (action === "revisit") {
    revisitPath(pathId);
  }
}

pathsGrid?.addEventListener("click", handlePathGridClick);
activePathsGrid?.addEventListener("click", handlePathGridClick);
completedPathsGrid?.addEventListener("click", handlePathGridClick);
