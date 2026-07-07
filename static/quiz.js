const TOTAL_STEPS = 12;
const allGenres = window.BookMindGenres?.ALL || [
  "Fantasy", "Romance", "Mystery", "Thriller", "Horror", "Sci-Fi",
  "Historical Fiction", "Literary Fiction", "Contemporary Fiction", "Classics",
  "Non-fiction", "Memoir", "Biography", "Self-help", "Poetry", "Young Adult",
  "Graphic Novels", "Magical Realism", "Dystopian", "Adventure", "Crime", "Humor"
];

const quizQuestions = [
  {
    key: "readingExperience",
    title: "How would you describe yourself as a reader?",
    hint: "This helps BookMindAI understand your starting point.",
    type: "single",
    options: [
      "Just getting into reading",
      "I read occasionally",
      "I read regularly",
      "Reading is part of my daily life"
    ]
  },
  {
    key: "favoriteGenres",
    title: "Which genres do you enjoy most?",
    hint: "Choose up to 4, or add your own below.",
    type: "multi",
    max: 4,
    allowCustom: true,
    options: allGenres
  },
  {
    key: "dislikedGenres",
    title: "Which genres rarely interest you?",
    hint: "Your favorites and custom genres won't appear here.",
    type: "multi",
    max: 3,
    dynamicOptions: true
  },
  {
    key: "preferredMood",
    title: "What mood do you want from a book?",
    hint: "Think about the atmosphere you crave most often.",
    type: "single",
    options: [
      "Cozy and comforting",
      "Dark and atmospheric",
      "Hopeful and uplifting",
      "Playful and witty",
      "Thoughtful and reflective",
      "Depends on the day"
    ]
  },
  {
    key: "pacing",
    title: "How do you like your stories paced?",
    hint: "Match the rhythm that keeps you turning pages.",
    type: "single",
    options: [
      "Fast and propulsive",
      "Steady and balanced",
      "Slow and immersive",
      "Varies by genre"
    ]
  },
  {
    key: "favoriteThemes",
    title: "Which themes draw you in?",
    hint: "Choose up to 3.",
    type: "multi",
    max: 3,
    options: [
      "Love and connection",
      "Identity and self-discovery",
      "Justice and moral choices",
      "Adventure and survival",
      "Family and belonging",
      "Power, politics, and society",
      "Science, ideas, and discovery",
      "Grief, healing, and transformation"
    ]
  },
  {
    key: "characterTypes",
    title: "What kinds of characters do you connect with?",
    hint: "Choose up to 2.",
    type: "multi",
    max: 2,
    options: [
      "Complex antiheroes",
      "Quiet, observant narrators",
      "Bold leaders and changemakers",
      "Found-family ensembles",
      "Outsiders finding their place",
      "Unreliable or secretive voices"
    ]
  },
  {
    key: "writingStyle",
    title: "Which writing style feels most satisfying?",
    hint: "There is no wrong answer.",
    type: "single",
    options: [
      "Lyrical and descriptive",
      "Crisp and direct",
      "Witty and conversational",
      "Rich and layered",
      "Minimal and spare"
    ]
  },
  {
    key: "emotionalPreference",
    title: "How should a book make you feel by the end?",
    hint: "Choose the emotional payoff you enjoy most.",
    type: "single",
    options: [
      "Moved and fulfilled",
      "Energized and inspired",
      "Calm and satisfied",
      "Surprised and unsettled",
      "Comforted like a warm blanket"
    ]
  },
  {
    key: "bookLength",
    title: "What book length feels best for you?",
    hint: "This helps avoid books that feel too long or too short.",
    type: "single",
    options: [
      "Short — under 250 pages",
      "Medium — 250 to 450 pages",
      "Long — 450+ pages",
      "Length doesn't matter"
    ]
  },
  {
    key: "endingPreference",
    title: "What kind of endings do you enjoy?",
    hint: "Pick the finish that leaves you happiest.",
    type: "single",
    options: [
      "Satisfying and resolved",
      "Bittersweet but meaningful",
      "Open to interpretation",
      "Shocking twists welcome",
      "Happy and hopeful"
    ]
  },
  {
    key: "readingGoals",
    title: "What are you looking for in books right now?",
    hint: "Choose up to 2.",
    type: "multi",
    max: 2,
    options: [
      "Escape into another world",
      "Learn something new",
      "Relax and unwind",
      "Feel deeply",
      "Challenge my thinking",
      "Get inspired to act",
      "Discover literary classics",
      "Laugh out loud"
    ]
  }
];

const LEGACY_KEY_MAP = {
  readingExperience: "readingExperience",
  favoriteGenres: "favoriteGenres",
  dislikedGenres: "dislikedGenres",
  readingGoals: "readingGoals",
  unexpectedEndings: "endingPreference",
  characterStyle: "characterTypes",
  bookLength: "bookLength",
  pacePreference: "pacing",
  emotionalTone: "preferredMood",
  themeInterest: "favoriteThemes"
};

let currentStep = 0;
let answers = createEmptyAnswers();

function createEmptyAnswers() {
  return {
    readingExperience: "",
    favoriteGenres: [],
    customGenres: [],
    dislikedGenres: [],
    preferredMood: "",
    pacing: "",
    favoriteThemes: [],
    characterTypes: [],
    writingStyle: "",
    emotionalPreference: "",
    bookLength: "",
    endingPreference: "",
    readingGoals: []
  };
}

function getAllFavoriteGenres() {
  return [...(answers.favoriteGenres || []), ...(answers.customGenres || [])];
}

function isQuestionAnswered(question) {
  if (question.key === "favoriteGenres") {
    const merged = [...(answers.favoriteGenres || []), ...(answers.customGenres || [])];
    return merged.length > 0;
  }

  const value = answers[question.key];
  if (question.type === "multi") {
    return Array.isArray(value) && value.length > 0;
  }
  return Boolean(value);
}

function countAnsweredSteps() {
  return quizQuestions.filter(isQuestionAnswered).length;
}

function computeCompletion() {
  const answered = countAnsweredSteps();
  if (answered >= TOTAL_STEPS) return 100;
  return Math.round((answered / TOTAL_STEPS) * 100);
}

function isQuizComplete() {
  const completion = Number(localStorage.getItem("reader_profile_completion")) || 0;
  if (completion >= 100) return true;
  return quizQuestions.every(isQuestionAnswered);
}

function loadLocalAnswers() {
  try {
    const raw = localStorage.getItem("reader_quiz_answers");
    if (raw) {
      return { ...createEmptyAnswers(), ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  return createEmptyAnswers();
}

function migrateLegacyAnswers() {
  if (localStorage.getItem("reader_quiz_answers")) return;

  const first = safeParse(localStorage.getItem("reader_discovery_answers"));
  const extra = safeParse(localStorage.getItem("reader_extra_discovery_answers"));
  if (!first && !extra) return;

  const merged = createEmptyAnswers();

  [first, extra].filter(Boolean).forEach(source => {
    Object.entries(source).forEach(([legacyKey, value]) => {
      const newKey = LEGACY_KEY_MAP[legacyKey];
      if (!newKey || value === "" || (Array.isArray(value) && !value.length)) return;
      merged[newKey] = value;
    });
  });

  localStorage.setItem("reader_quiz_answers", JSON.stringify(merged));

  const oldCompletion = Number(localStorage.getItem("reader_profile_completion")) || 0;
  const migratedCompletion = oldCompletion >= 100
    ? 100
    : Math.max(computeCompletionFromAnswers(merged), oldCompletion > 0 ? oldCompletion : 0);

  localStorage.setItem("reader_profile_completion", String(migratedCompletion));
  syncLegacyStorageKeys(merged, migratedCompletion);
}

function computeCompletionFromAnswers(answerObj) {
  const prev = answers;
  answers = answerObj;
  const value = computeCompletion();
  answers = prev;
  return value;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function syncLegacyStorageKeys(answerObj, completion) {
  const firstPhaseKeys = ["readingExperience", "favoriteGenres", "dislikedGenres", "readingGoals"];
  const firstPhase = {};
  const extraPhase = {};

  Object.entries(answerObj).forEach(([key, value]) => {
    if (key === "customGenres") return;
    if (firstPhaseKeys.includes(key)) {
      firstPhase[key] = value;
    } else if (value !== "" && !(Array.isArray(value) && !value.length)) {
      extraPhase[key] = value;
    }
  });

  if (Object.keys(firstPhase).length) {
    localStorage.setItem("reader_discovery_answers", JSON.stringify(firstPhase));
  }
  if (Object.keys(extraPhase).length) {
    localStorage.setItem("reader_extra_discovery_answers", JSON.stringify(extraPhase));
  }
  localStorage.setItem("reader_profile_completion", String(completion));
}

function formatQuizAnswersForAI(answerObj) {
  const genres = [...(answerObj.favoriteGenres || []), ...(answerObj.customGenres || [])];
  return [
    `Reading experience: ${answerObj.readingExperience || "Unknown"}`,
    `Favorite genres: ${genres.join(", ") || "Unknown"}`,
    `Custom genres: ${(answerObj.customGenres || []).join(", ") || "None"}`,
    `Less interesting genres: ${(answerObj.dislikedGenres || []).join(", ") || "None"}`,
    `Preferred mood: ${answerObj.preferredMood || "Unknown"}`,
    `Pacing preference: ${answerObj.pacing || "Unknown"}`,
    `Favorite themes: ${(answerObj.favoriteThemes || []).join(", ") || "Unknown"}`,
    `Character types: ${(answerObj.characterTypes || []).join(", ") || "Unknown"}`,
    `Writing style: ${answerObj.writingStyle || "Unknown"}`,
    `Emotional preference: ${answerObj.emotionalPreference || "Unknown"}`,
    `Book length: ${answerObj.bookLength || "Unknown"}`,
    `Ending preference: ${answerObj.endingPreference || "Unknown"}`,
    `Reading goals: ${(answerObj.readingGoals || []).join(", ") || "Unknown"}`
  ];
}

async function saveProgress(stepIndex) {
  const completion = computeCompletion();
  localStorage.setItem("reader_quiz_answers", JSON.stringify(answers));
  localStorage.setItem("reader_quiz_step", String(stepIndex));
  localStorage.setItem("reader_profile_completion", String(completion));
  syncLegacyStorageKeys(answers, completion);

  if (window.BookMindUserData?.saveQuizProgress) {
    try {
      await BookMindUserData.saveQuizProgress({
        answers,
        currentStep: stepIndex,
        completion
      });
    } catch (error) {
      console.error("Quiz progress sync failed:", error);
    }
  }
}

function getResumeStep() {
  const savedStep = Number(localStorage.getItem("reader_quiz_step"));
  if (!Number.isNaN(savedStep) && savedStep >= 0 && savedStep < TOTAL_STEPS) {
    if (!isQuestionAnswered(quizQuestions[savedStep])) {
      return savedStep;
    }
  }

  for (let i = 0; i < quizQuestions.length; i += 1) {
    if (!isQuestionAnswered(quizQuestions[i])) return i;
  }

  return TOTAL_STEPS - 1;
}

function resolveQuestionOptions(question) {
  if (question.dynamicOptions) {
    const excluded = new Set(getAllFavoriteGenres());
    return allGenres.filter(genre => !excluded.has(genre));
  }
  return question.options;
}

function renderQuestion() {
  const question = quizQuestions[currentStep];
  const stepNumber = currentStep + 1;

  document.getElementById("progressText").textContent =
    `Step ${stepNumber} of ${TOTAL_STEPS}`;

  document.getElementById("progressFill").style.width =
    `${(stepNumber / TOTAL_STEPS) * 100}%`;

  document.getElementById("questionTitle").textContent = question.title;
  document.getElementById("questionHint").textContent = question.hint;

  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";

  const options = resolveQuestionOptions(question);

  options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.textContent = option;

    const savedAnswer = answers[question.key];
    if (
      (question.type === "single" && savedAnswer === option) ||
      (question.type === "multi" && Array.isArray(savedAnswer) && savedAnswer.includes(option))
    ) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      if (question.type === "single") {
        answers[question.key] = option;
      } else if (!Array.isArray(answers[question.key])) {
        answers[question.key] = [];
      }

      if (question.type === "multi") {
        const list = answers[question.key];
        if (list.includes(option)) {
          answers[question.key] = list.filter(item => item !== option);
        } else if (list.length < question.max) {
          answers[question.key].push(option);
        } else {
          showQuizToast(`You can choose up to ${question.max}.`);
          return;
        }
      }

      renderQuestion();
      saveProgress(currentStep);
    });

    container.appendChild(button);
  });

  if (question.allowCustom) {
    renderCustomGenreInput(container);
  }

  document.getElementById("backBtn").style.visibility =
    currentStep === 0 ? "hidden" : "visible";

  document.getElementById("nextBtn").textContent =
    currentStep === TOTAL_STEPS - 1 ? "Finish" : "Next";
}

function renderCustomGenreInput(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "quiz-custom-genre";

  wrapper.innerHTML = `
    <label class="quiz-custom-label" for="customGenreInput">Add your own genre (optional)</label>
    <div class="quiz-custom-row">
      <input type="text" id="customGenreInput" class="quiz-custom-input" placeholder="e.g. Nordic noir, cozy mystery…" maxlength="40" autocomplete="off">
      <button type="button" class="btn btn-secondary quiz-custom-add" id="addCustomGenreBtn">Add</button>
    </div>
    <div class="quiz-custom-tags" id="customGenreTags"></div>
  `;

  container.appendChild(wrapper);

  const tagsEl = wrapper.querySelector("#customGenreTags");
  (answers.customGenres || []).forEach(genre => {
    tagsEl.appendChild(createCustomGenreTag(genre));
  });

  const input = wrapper.querySelector("#customGenreInput");
  const addBtn = wrapper.querySelector("#addCustomGenreBtn");

  const addGenre = () => {
    const value = input.value.trim();
    if (!value) return;

    if (!Array.isArray(answers.customGenres)) {
      answers.customGenres = [];
    }

    const exists = answers.customGenres.some(
      genre => genre.toLowerCase() === value.toLowerCase()
    ) || answers.favoriteGenres.some(
      genre => genre.toLowerCase() === value.toLowerCase()
    ) || allGenres.some(
      genre => genre.toLowerCase() === value.toLowerCase()
    );

    if (exists) {
      showQuizToast("That genre is already selected.");
      return;
    }

    if (getAllFavoriteGenres().length >= 4) {
      showQuizToast("You can choose up to 4 genres total.");
      return;
    }

    answers.customGenres.push(value);
    input.value = "";
    renderQuestion();
    saveProgress(currentStep);
  };

  addBtn.addEventListener("click", addGenre);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      addGenre();
    }
  });
}

function createCustomGenreTag(genre) {
  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "quiz-custom-tag";
  tag.innerHTML = `${escapeHtml(genre)} <span aria-hidden="true">&times;</span>`;
  tag.setAttribute("aria-label", `Remove ${genre}`);
  tag.addEventListener("click", () => {
    answers.customGenres = (answers.customGenres || []).filter(item => item !== genre);
    renderQuestion();
    saveProgress(currentStep);
  });
  return tag;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showQuizToast(message) {
  let toast = document.getElementById("quizToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "quizToast";
    toast.className = "quiz-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showQuizToast._timer);
  showQuizToast._timer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

document.getElementById("backBtn").addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep -= 1;
    renderQuestion();
  }
});

document.getElementById("nextBtn").addEventListener("click", async () => {
  const question = quizQuestions[currentStep];
  const answer = answers[question.key];

  if (question.key === "favoriteGenres") {
    if (getAllFavoriteGenres().length === 0) {
      showQuizToast("Choose at least one genre or add your own.");
      return;
    }
  } else if (!answer || (Array.isArray(answer) && answer.length === 0)) {
    showQuizToast("Please answer this question first.");
    return;
  }

  if (currentStep < TOTAL_STEPS - 1) {
    currentStep += 1;
    await saveProgress(currentStep);
    renderQuestion();
    return;
  }

  await finishQuiz();
});

async function finishQuiz() {
  showLoadingScreen();

  localStorage.setItem("reader_profile_completion", "100");
  localStorage.setItem("reader_quiz_step", String(TOTAL_STEPS));
  await saveProgress(TOTAL_STEPS);

  let profile = safeParse(localStorage.getItem("readerProfile")) || {};

  try {
    const response = await fetch("/api/reader/recommend-with-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quiz_answers: formatQuizAnswersForAI(answers),
        books_read: [],
        reading_level: answers.readingExperience
      })
    });

    if (response.ok) {
      profile = await response.json();
      profile.quiz_answers = formatQuizAnswersForAI(answers);
      profile.quiz_state = {
        answers,
        current_step: TOTAL_STEPS,
        completion: 100,
        completed_at: new Date().toISOString()
      };
      localStorage.setItem("readerProfile", JSON.stringify(profile));

      if (window.BookMindUserData?.saveReaderProfile) {
        await BookMindUserData.saveReaderProfile({
          quiz_answers: formatQuizAnswersForAI(answers).join("\n"),
          books_read: profile.books_read || "",
          reading_level: answers.readingExperience,
          profile_data: profile
        });
      }
    }
  } catch (error) {
    console.error(error);
  }

  showCompletionScreen(profile);
}

function showLoadingScreen() {
  document.querySelector(".quiz-card").innerHTML = `
    <div class="dna-summary dna-summary-loading">
      <div class="dna-summary-badge">Reader DNA</div>
      <div class="dna-summary-spinner" aria-hidden="true"></div>
      <h1>Building your profile…</h1>
      <p>BookMindAI is analyzing your reading taste.</p>
    </div>
  `;
}

function deriveReadingStyle() {
  const parts = [answers.pacing, answers.writingStyle].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Personalized mix";
}

function deriveRecommendationPersonality(profile) {
  return profile?.reader_type
    || profile?.book_preferences?.[0]
    || "Thoughtful explorer";
}

function renderSuggestedBooks(recommendations) {
  if (!Array.isArray(recommendations) || !recommendations.length) {
    return `<p class="dna-summary-empty">Your personalized picks will appear on Discovery.</p>`;
  }

  return recommendations.slice(0, 3).map((item, index) => {
    const rec = item.ai_recommendation || item;
    const book = item.book_data || {};
    const title = rec.title || book.title || "Recommended read";
    const author = rec.author || book.author_name?.[0] || "Unknown author";
    const reason = rec.reason || rec.description || "Matched to your Reader DNA.";

    return `
      <article class="dna-book-card" style="animation-delay:${index * 0.12}s">
        <div class="dna-book-meta">
          <h4>${escapeHtml(title)}</h4>
          <p class="dna-book-author">${escapeHtml(author)}</p>
          <p class="dna-book-reason">${escapeHtml(reason)}</p>
        </div>
      </article>
    `;
  }).join("");
}

function showCompletionScreen(profile) {
  const favoriteGenres = [
    ...(answers.favoriteGenres || []),
    ...(answers.customGenres || []),
    ...(profile?.favorite_genres || [])
  ].filter((genre, index, list) => list.indexOf(genre) === index);

  const readerType = profile?.reader_type || "Curious Reader";
  const mood = answers.preferredMood || "Varied";
  const readingStyle = deriveReadingStyle();
  const personality = deriveRecommendationPersonality(profile);
  const recommendations = profile?.recommendations || [];

  document.querySelector(".quiz-card").innerHTML = `
    <div class="dna-summary">
      <div class="dna-summary-hero">
        <div class="dna-summary-badge dna-summary-badge-complete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6 7 18.2l1.9-5.8L4 8.8h6.1z"/></svg>
          100% Complete
        </div>
        <h1>Your Reader DNA</h1>
        <p class="dna-summary-lead">A personalized snapshot of how you read, feel, and discover stories.</p>
      </div>

      <div class="dna-summary-grid">
        <article class="dna-summary-card dna-summary-card-featured">
          <p class="dna-summary-label">Reader type</p>
          <h3>${escapeHtml(readerType)}</h3>
        </article>
        <article class="dna-summary-card">
          <p class="dna-summary-label">Preferred mood</p>
          <h3>${escapeHtml(mood)}</h3>
        </article>
        <article class="dna-summary-card">
          <p class="dna-summary-label">Reading style</p>
          <h3>${escapeHtml(readingStyle)}</h3>
        </article>
        <article class="dna-summary-card">
          <p class="dna-summary-label">Recommendation personality</p>
          <h3>${escapeHtml(personality)}</h3>
        </article>
      </div>

      <section class="dna-summary-section">
        <p class="dna-summary-label">Favorite genres</p>
        <div class="dna-summary-tags">
          ${favoriteGenres.length
            ? favoriteGenres.map(genre => `<span class="dna-summary-tag">${escapeHtml(genre)}</span>`).join("")
            : `<span class="dna-summary-tag">Open to anything</span>`}
        </div>
      </section>

      <section class="dna-summary-section">
        <div class="dna-summary-section-head">
          <p class="dna-summary-label">Suggested next books</p>
        </div>
        <div class="dna-book-grid">
          ${renderSuggestedBooks(recommendations)}
        </div>
      </section>

      <div class="dna-summary-actions">
        <a href="home.html" class="btn btn-primary">Go to Home</a>
        <a href="discovery.html" class="btn btn-secondary">View Recommendations</a>
        <button type="button" class="btn btn-ghost" id="retakeQuizBtn">Retake Quiz</button>
      </div>
    </div>
  `;

  document.getElementById("retakeQuizBtn").addEventListener("click", retakeQuiz);
}

async function retakeQuiz() {
  [
    "reader_quiz_answers",
    "reader_quiz_step",
    "reader_profile_completion",
    "reader_discovery_answers",
    "reader_extra_discovery_answers",
    "reader_used_discovery_questions",
    "readerProfile"
  ].forEach(key => localStorage.removeItem(key));

  answers = createEmptyAnswers();
  currentStep = 0;

  if (window.BookMindUserData?.saveQuizProgress) {
    try {
      await BookMindUserData.saveQuizProgress({
        answers,
        currentStep: 0,
        completion: 0
      });
    } catch {
      /* ignore */
    }
  }

  window.location.reload();
}

async function initQuiz() {
  if (window.BookMindAuth?.whenReady) {
    await BookMindAuth.whenReady();
  }

  if (window.BookMindUserData?.loadQuizProgress) {
    try {
      await BookMindUserData.loadQuizProgress();
    } catch {
      /* offline */
    }
  }

  migrateLegacyAnswers();
  answers = loadLocalAnswers();

  if (isQuizComplete()) {
    const profile = safeParse(localStorage.getItem("readerProfile")) || {};
    showCompletionScreen(profile);
    return;
  }

  currentStep = getResumeStep();
  renderQuestion();
}

initQuiz();
