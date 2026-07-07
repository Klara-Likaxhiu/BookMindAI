/* Reader Journey — interactive genre chips that create reading paths. */

function genreSlug(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildGrowthSuggestions(profile) {
  const favoriteGenres = profile?.favorite_genres || [];
  const suggestions = [];

  if (favoriteGenres.includes("Mystery") || favoriteGenres.includes("Thriller")) {
    suggestions.push("Dark Academia", "Crime Fiction", "Psychological Horror");
  }
  if (favoriteGenres.includes("Romance")) {
    suggestions.push("Literary Romance", "Historical Romance", "Romantic Comedy");
  }
  if (favoriteGenres.includes("Fantasy")) {
    suggestions.push("Urban Fantasy", "Magical Realism", "Mythological Fiction");
  }
  if (!suggestions.length) {
    suggestions.push("Literary Fiction", "Contemporary Fiction", "Historical Mystery");
  }
  return suggestions;
}

function renderGrowthChips(suggestions) {
  const container = document.getElementById("growthList");
  if (!container) return;

  container.innerHTML = suggestions
    .map(
      genre => `
      <button type="button" class="growth-tag-btn" data-genre="${escapeHtml(genre)}">
        ${escapeHtml(genre)}
      </button>
    `
    )
    .join("");

  container.querySelectorAll(".growth-tag-btn").forEach(btn => {
    btn.addEventListener("click", () => void onGenreChipClick(btn));
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function onGenreChipClick(button) {
  const genre = button.dataset.genre;
  if (!genre || button.classList.contains("is-loading")) return;

  if (!window.BookMindAPI?.ensureAuth) {
    window.location.href = "/login.html?next=" + encodeURIComponent("/reader-journey.html");
    return;
  }

  button.classList.add("is-loading");
  button.disabled = true;

  try {
    if (window.BookMindAuth?.whenReady) {
      await BookMindAuth.whenReady();
    }

    const token = await BookMindAPI.ensureAuth({ redirect: true });
    if (!token) return;

    await BookMindLibrary.ensureLoaded();

    const profile = JSON.parse(localStorage.getItem("readerProfile") || "null");
    const result = await BookMindAPI.post("/api/reader/genre-path", {
      genre,
      reader_profile: profile,
      library: BookMindLibrary.getLibrary(),
      today_mood: localStorage.getItem("bookmind_today_mood"),
      today_goal: localStorage.getItem("bookmind_today_goal"),
    });

    const pathId = result?.path_id || result?.path?.id;
    if (!pathId) {
      throw new Error("Could not create reading path.");
    }

    sessionStorage.setItem(
      "bookmind_path_flash",
      result.message ||
        (result.created
          ? `Created your "${genre} Starter Path".`
          : `Opened your existing "${genre}" path.`)
    );

    window.location.href = `/reading-paths.html?path=${encodeURIComponent(pathId)}`;
  } catch (error) {
    button.classList.remove("is-loading");
    button.disabled = false;
    const note = document.getElementById("growthNote");
    if (note) {
      note.textContent = error.message || "Could not create reading path. Try again.";
      note.hidden = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.BookMindUserData) {
    await BookMindUserData.loadReaderProfile();
  }

  const profile = JSON.parse(localStorage.getItem("readerProfile") || "null");
  const mood = localStorage.getItem("bookmind_today_mood");
  const goal = localStorage.getItem("bookmind_today_goal");

  if (profile) {
    document.getElementById("journeyType").textContent = profile.reader_type || "Unknown Reader";
    document.getElementById("journeyLevel").textContent =
      `Reading level: ${profile.confirmed_reading_level || profile.reading_level || "Not available"}`;
  }

  document.getElementById("todayMode").textContent =
    mood || goal ? `${mood || "any mood"} + ${goal || "any goal"}` : "No mode selected";

  let allBooks = [];
  try {
    await BookMindLibrary.ensureLoaded();
    const library = BookMindLibrary.getLibrary();
    allBooks = [
      ...(library.read || []),
      ...(library.reading || []),
      ...(library.want || []),
    ];
  } catch {
    allBooks = [];
  }

  function findTopGenre(books) {
    const counts = {};
    books.forEach(book => {
      const genre = book.genre || "Unknown";
      counts[genre] = (counts[genre] || 0) + 1;
    });
    let top = null;
    let max = 0;
    Object.keys(counts).forEach(genre => {
      if (counts[genre] > max) {
        top = genre;
        max = counts[genre];
      }
    });
    return top;
  }

  const topGenre = findTopGenre(allBooks);
  document.getElementById("topGenre").textContent = topGenre || "Not enough data";

  const insightList = document.getElementById("insightList");
  const favoriteGenres = profile?.favorite_genres || [];
  const insights = [
    profile?.reader_type ? `You are currently classified as a ${profile.reader_type}.` : null,
    favoriteGenres.length ? `Your strongest genres are ${favoriteGenres.join(", ")}.` : null,
    topGenre ? `Your library shows a strong interest in ${topGenre}.` : null,
    mood ? `Today you are leaning toward a ${mood} reading mood.` : null,
    goal ? `Your current reading goal is to ${goal}.` : null,
  ].filter(Boolean);

  insightList.innerHTML = insights.length
    ? insights
        .map(
          item =>
            `<p><svg class="icon icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> ${item}</p>`
        )
        .join("")
    : `<p>Start saving books to build your Reader Journey.</p>`;

  renderGrowthChips(buildGrowthSuggestions(profile));
});
