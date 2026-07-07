/** Centralized book cover rendering, lookup, and caching for BookMindAI. */
const BookMindCoverImage = {
  _memoryCache: new Map(),
  _pending: new Map(),

  bookRef(book) {
    const ai = book?.ai_recommendation || {};
    return {
      title: book?.title || ai.title || "Untitled Book",
      author: book?.author || ai.author || "Unknown Author",
      genre: book?.genre || ai.genre || (book?.categories && book.categories[0]) || "Book",
      isbn: book?.isbn || book?.metadata?.isbn || null,
      cover_url: book?.cover_url || book?.book_data?.cover_url || null,
      google_id: book?.google_id || book?.id || book?.book_id || null,
      open_library_key: book?.open_library_key || null,
    };
  },

  refFromWrap(wrap) {
    if (wrap.__bookRef) return { ...wrap.__bookRef };
    return {
      title: wrap.dataset.title || "Untitled Book",
      author: wrap.dataset.author || "Unknown Author",
      genre: wrap.dataset.genre || "Book",
      isbn: wrap.dataset.isbn || null,
      cover_url: wrap.querySelector("img")?.src || null,
      google_id: wrap.dataset.googleId || null,
      open_library_key: wrap.dataset.openLibraryKey || null,
    };
  },

  attachRefToWrap(wrap, ref, options = {}) {
    if (!wrap || !ref) return;
    wrap.__bookRef = ref;
    wrap.dataset.title = ref.title || "";
    wrap.dataset.author = ref.author || "";
    wrap.dataset.genre = ref.genre || "Book";
    wrap.dataset.isbn = ref.isbn || "";
    if (options.imgClass) wrap.dataset.imgClass = options.imgClass;
  },

  cacheKey(ref) {
    const isbn = String(ref.isbn || "").replace(/[^0-9Xx]/g, "");
    if (isbn) return `isbn:${isbn.toLowerCase()}`;
    return `${(ref.title || "").toLowerCase()}|${(ref.author || "unknown").toLowerCase()}`;
  },

  normalizeUrl(url) {
    if (!url) return null;
    return String(url).replace(/^http:\/\//i, "https://");
  },

  escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  logLookup(ref, data, url) {
    console.log("[BookMindCover]", ref.title, "by", ref.author, "->", {
      cover_url: url,
      source: data?.source || data?.cover_source || null,
      cached: data?.cached ?? false,
      book_id: data?.book_id || data?.cache_key || null,
    });
  },

  placeholderHtml(ref, options = {}) {
    const phClass = options.placeholderClass || "book-cover-placeholder";
    const genre = ref.genre || "Book";
    const coverClass =
      typeof BookMindUI !== "undefined" ? BookMindUI.getCoverClass(genre) : "mystery-cover";

    return `
      <div class="${phClass} premium-book-placeholder ${coverClass}" role="img" aria-label="${this.escape(ref.title)} cover">
        <div class="premium-book-spine" aria-hidden="true"></div>
        <div class="premium-book-face">
          <span class="premium-book-title">${this.escape(ref.title)}</span>
          <span class="premium-book-author">${this.escape(ref.author)}</span>
        </div>
      </div>`;
  },

  wrapHtml(inner, ref, options = {}) {
    const wrapClass = options.wrapClass || "book-cover-wrap";
    const imgClass = options.imgClass || "book-cover-img";
    return `<div class="${wrapClass} book-cover-wrap"
      data-cover-key="${this.escape(this.cacheKey(ref))}"
      data-title="${this.escape(ref.title)}"
      data-author="${this.escape(ref.author)}"
      data-genre="${this.escape(ref.genre || "Book")}"
      data-isbn="${this.escape(ref.isbn || "")}"
      data-img-class="${this.escape(imgClass)}">${inner}</div>`;
  },

  html(book, options = {}) {
    const ref = this.bookRef(book);
    const imgClass = options.imgClass || "book-cover-img";
    const lazy = options.lazy !== false;
    const initialUrl = this.normalizeUrl(ref.cover_url);

    if (initialUrl) {
      return this.wrapHtml(
        `<img class="${imgClass}" src="${this.escape(initialUrl)}" alt="${this.escape(ref.title)} cover" loading="${lazy ? "lazy" : "eager"}" decoding="async" onerror="BookMindCoverImage.onError(this)">`,
        ref,
        options
      );
    }

    return this.wrapHtml(this.placeholderHtml(ref, options), ref, options);
  },

  onError(img) {
    const wrap = img.closest("[data-cover-key]");
    if (!wrap) {
      img.remove();
      return;
    }

    const book = this.refFromWrap(wrap);
    book.cover_url = null;
    wrap.dataset.coverResolved = "false";

    if (wrap.dataset.coverRetry === "true") {
      img.remove();
      if (!wrap.querySelector(".premium-book-placeholder")) {
        wrap.insertAdjacentHTML("beforeend", this.placeholderHtml(book));
      }
      return;
    }

    wrap.dataset.coverRetry = "true";
    img.remove();
    this._memoryCache.delete(this.cacheKey(book));

    this.resolve(book, { skipCache: true }).then(url => {
      if (url && wrap.isConnected) {
        const imgClass = img.className || wrap.dataset.imgClass || "book-cover-img";
        this.applyUrlToWrap(wrap, book, url, imgClass);
        wrap.dataset.coverRetry = "false";
        return;
      }
      if (!wrap.querySelector(".premium-book-placeholder")) {
        wrap.insertAdjacentHTML("beforeend", this.placeholderHtml(book));
      }
    });
  },

  async resolve(ref, options = {}) {
    const key = this.cacheKey(ref);
    if (!options.skipCache && this._memoryCache.has(key)) {
      const cached = this._memoryCache.get(key);
      if (cached) return cached;
    }

    const existing = this.normalizeUrl(ref.cover_url);
    if (existing && !options.skipCache) {
      this._memoryCache.set(key, existing);
      return existing;
    }

    if (this._pending.has(key)) return this._pending.get(key);

    const promise = fetch("/api/books/resolve-cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ref.title,
        author: ref.author,
        isbn: ref.isbn,
        cover_url: ref.cover_url,
        google_id: ref.google_id,
        open_library_key: ref.open_library_key,
      }),
    })
      .then(response => (response.ok ? response.json() : {}))
      .then(data => {
        const url = this.normalizeUrl(data.cover_url) || null;
        this.logLookup(ref, data, url);
        if (url) this._memoryCache.set(key, url);
        this._pending.delete(key);
        return url;
      })
      .catch(err => {
        console.warn("[BookMindCover] lookup failed", ref.title, err);
        this._pending.delete(key);
        return null;
      });

    this._pending.set(key, promise);
    return promise;
  },

  applyUrlToWrap(wrap, ref, url, imgClass = "book-cover-img") {
    if (!wrap || !url) return;
    wrap.innerHTML = "";
    const img = document.createElement("img");
    img.className = imgClass;
    img.src = url;
    img.alt = `${ref.title} cover`;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => BookMindCoverImage.onError(img);
    wrap.appendChild(img);
    this.attachRefToWrap(wrap, { ...ref, cover_url: url }, { imgClass });
    wrap.dataset.coverResolved = "true";
    wrap.classList.add("cover-loaded");
  },

  needsLookup(wrap) {
    if (!wrap) return false;
    const placeholder = wrap.querySelector(".premium-book-placeholder");
    const img = wrap.querySelector("img");
    if (placeholder) return true;
    if (!img) return true;
    if (wrap.dataset.coverResolved !== "true") return true;
    return false;
  },

  async hydrateWrap(wrap, book, options = {}) {
    if (!wrap) return null;

    const ref = book ? this.bookRef(book) : this.refFromWrap(wrap);
    this.attachRefToWrap(wrap, ref, options);

    if (!this.needsLookup(wrap) && wrap.querySelector("img")) {
      return this.normalizeUrl(wrap.querySelector("img").src);
    }

    if (wrap.dataset.coverLoading === "true") return null;
    wrap.dataset.coverLoading = "true";

    try {
      const url = await this.resolve(ref, { skipCache: false });
      if (url && wrap.isConnected) {
        const imgClass = options.imgClass || wrap.dataset.imgClass || "book-cover-img";
        this.applyUrlToWrap(wrap, ref, url, imgClass);
        return url;
      }
    } finally {
      wrap.dataset.coverLoading = "false";
    }

    return null;
  },

  hydrate(root = document, options = {}) {
    const wraps = root.querySelectorAll("[data-cover-key]");
    wraps.forEach(wrap => {
      if (this.needsLookup(wrap)) {
        this.hydrateWrap(wrap, null, options);
      }
    });
  },

  async hydrateMany(books, root = document, options = {}) {
    const refs = books.map(book => this.bookRef(book));
    const missing = refs.filter(ref => !this.normalizeUrl(ref.cover_url));

    if (missing.length) {
      try {
        const response = await fetch("/api/books/resolve-covers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            books: missing.map(ref => ({
              title: ref.title,
              author: ref.author,
              isbn: ref.isbn,
              cover_url: ref.cover_url,
              google_id: ref.google_id,
              open_library_key: ref.open_library_key,
            })),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          (data.results || []).forEach((result, index) => {
            const url = this.normalizeUrl(result.cover_url);
            this.logLookup(missing[index], result, url);
            if (url) {
              this._memoryCache.set(this.cacheKey(missing[index]), url);
              missing[index].cover_url = url;
            }
          });
        }
      } catch (err) {
        console.warn("[BookMindCover] batch lookup failed", err);
      }
    }

    refs.forEach((ref, index) => {
      const book = books[index];
      if (ref.cover_url) book.cover_url = ref.cover_url;
      if (book.book_data && ref.cover_url) book.book_data.cover_url = ref.cover_url;
    });

    const wraps = root.querySelectorAll("[data-cover-key]");
    wraps.forEach(wrap => {
      if (this.needsLookup(wrap)) {
        this.hydrateWrap(wrap, null, options);
      }
    });

    return books;
  },
};

window.BookMindCoverImage = BookMindCoverImage;
