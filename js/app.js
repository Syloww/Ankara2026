(function () {
  "use strict";

  const INTRO_MS = 3200;
  const STORAGE_LANG = "ankara2026-lang";
  const PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect width='4' height='3' fill='%230a1520'/%3E%3C/svg%3E";

  /** Préfixe du site (/ sur localhost, /Ankara2026/ sur GitHub Pages) */
  const BASE_PATH = detectBasePath();

  const state = {
    lang: readStoredLang() || detectLang(),
    filter: "all",
    albums: [],
    items: [],
    visible: [],
    lightboxIndex: 0,
    rellax: null,
    lazyObserver: null,
    galleryReady: false,
    heroPhoto: null,
    aboutPhoto: null,
    heroTimer: null,
    heroIndex: 0,
    heroActiveSlide: 0,
  };

  /** @type {Record<string, any>} */
  let els = {};

  function detectBasePath() {
    const baseTag = document.querySelector("base[href]");
    if (baseTag) {
      try {
        const u = new URL(baseTag.getAttribute("href"), window.location.href);
        let p = u.pathname;
        if (!p.endsWith("/")) p += "/";
        return p;
      } catch {
        /* ignore */
      }
    }
    let path = window.location.pathname || "/";
    if (/\.html?$/i.test(path)) {
      path = path.replace(/[^/]+$/, "");
    } else if (!path.endsWith("/")) {
      path += "/";
    }
    return path || "/";
  }

  function withBase(relativePath) {
    const cleaned = String(relativePath).replace(/^\/+/, "");
    return BASE_PATH + cleaned;
  }

  function readStoredLang() {
    try {
      return localStorage.getItem(STORAGE_LANG);
    } catch {
      return null;
    }
  }

  function writeStoredLang(lang) {
    try {
      localStorage.setItem(STORAGE_LANG, lang);
    } catch {
      /* ignore */
    }
  }

  function detectLang() {
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    if (nav === "tr" || nav === "en" || nav === "fr") return nav;
    return "fr";
  }

  function cacheElements() {
    els = {
      intro: document.getElementById("intro"),
      header: document.querySelector(".site-header"),
      heroBg: document.querySelector(".hero__bg"),
      heroSlides: document.querySelectorAll("[data-hero-slide]"),
      aboutBg: document.querySelector(".about__parallax"),
      filters: document.getElementById("filters"),
      gallery: document.getElementById("gallery"),
      hint: document.getElementById("filter-hint"),
      count: document.getElementById("photo-count"),
      lightbox: document.getElementById("lightbox"),
      lightboxImg: document.getElementById("lightbox-img"),
      lightboxClose: document.getElementById("lightbox-close"),
      lightboxPrev: document.getElementById("lightbox-prev"),
      lightboxNext: document.getElementById("lightbox-next"),
      langBtns: document.querySelectorAll(".lang-btn"),
    };
  }

  function on(el, event, handler, options) {
    if (!el || typeof el.addEventListener !== "function") return;
    el.addEventListener(event, handler, options);
  }

  function t(key) {
    const dict = (window.I18N && window.I18N[state.lang]) || (window.I18N && window.I18N.fr) || {};
    return dict[key] || (window.I18N && window.I18N.fr && window.I18N.fr[key]) || key;
  }

  function fileNameFromSrc(src) {
    try {
      return decodeURIComponent(src.split("/").pop() || "photo.jpg");
    } catch {
      return src.split("/").pop() || "photo.jpg";
    }
  }

  /** Chemin public compatible GitHub Pages (/Ankara2026/Photos/...) */
  function toPublicUrl(src) {
    const cleaned = String(src).replace(/^\/+/, "");
    const encoded = cleaned
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return withBase(encoded);
  }

  /** URL absolue pour background-image CSS */
  function toCssImage(src) {
    try {
      const absolute = /^https?:\/\//i.test(src)
        ? src
        : new URL(src.startsWith("/") ? src : toPublicUrl(src), window.location.origin).href;
      return `url("${absolute}")`;
    } catch {
      return `url("${src}")`;
    }
  }

  function downloadIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function applyI18n() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      node.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      const key = node.getAttribute("data-i18n-aria");
      node.setAttribute("aria-label", t(key));
    });
    els.langBtns.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lang === state.lang);
    });
    if (els.gallery) {
      els.gallery.querySelectorAll(".photo-card__download").forEach((btn) => {
        btn.setAttribute("aria-label", t("download"));
        const label = btn.querySelector(".photo-card__download-label");
        if (label) label.textContent = t("download");
      });
    }
    updateHint();
    updateCount();
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function fetchPhotosCatalog() {
    // photos.json d'abord (GitHub Pages), puis API locale
    const endpoints = [withBase("photos.json"), withBase("api/photos"), "/api/photos"];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Array.isArray(data.albums)) return data;
      } catch {
        /* essaie la source suivante */
      }
    }
    return { albums: [] };
  }

  function applyCatalog(data) {
    state.albums = (data && data.albums) || [];
    const items = [];
    state.albums.forEach((album) => {
      (album.photos || []).forEach((entry) => {
        const rawPath =
          typeof entry === "string" ? entry : entry && entry.src ? entry.src : "";
        if (!rawPath) return;
        const raw = String(rawPath).replace(/^\/+/, "");
        const width =
          typeof entry === "object" && entry.width ? Number(entry.width) : 4;
        const height =
          typeof entry === "object" && entry.height ? Number(entry.height) : 3;
        items.push({
          src: toPublicUrl(raw),
          album: album.id,
          width,
          height,
        });
      });
    });
    state.items = items;

    const allSrc = items.map((p) => p.src);
    state.heroPhoto = allSrc[0] || null;
    state.aboutPhoto = allSrc[Math.min(1, allSrc.length - 1)] || state.heroPhoto;
  }

  function buildFilters() {
    if (!els.filters) return;
    els.filters.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-btn is-active";
    allBtn.dataset.filter = "all";
    allBtn.textContent = t("filterAll");
    on(allBtn, "click", () => setFilter("all"));
    els.filters.appendChild(allBtn);

    state.albums.forEach((album) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.dataset.filter = album.id;
      btn.textContent = album.id;
      on(btn, "click", () => setFilter(album.id));
      els.filters.appendChild(btn);
    });
  }

  function refreshFilterLabels() {
    if (!els.filters) return;
    const allBtn = els.filters.querySelector('[data-filter="all"]');
    if (allBtn) allBtn.textContent = t("filterAll");
  }

  function setFilter(id) {
    state.filter = id;
    if (els.filters) {
      els.filters.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.filter === id);
      });
    }
    updateHint();
    if (state.galleryReady) renderGallery();
  }

  function updateHint() {
    if (!els.hint) return;
    els.hint.textContent =
      state.filter === "all" ? t("shuffleHint") : state.filter;
  }

  function updateCount() {
    if (!els.count || !state.galleryReady) return;
    const n = state.visible.length;
    const key = n === 1 ? "countPhoto" : "countPhotos";
    els.count.textContent = t(key).replace("{n}", String(n));
  }

  function destroyLazyObserver() {
    if (state.lazyObserver) {
      state.lazyObserver.disconnect();
      state.lazyObserver = null;
    }
  }

  function markCardReady(img) {
    const card = img.closest(".photo-card");
    if (!card) return;
    card.classList.add("is-ready");
    card.classList.remove("is-loading");
  }

  function createLazyObserver() {
    destroyLazyObserver();
    if (!("IntersectionObserver" in window)) return null;

    state.lazyObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          const src = img.dataset.src;
          if (!src) {
            observer.unobserve(img);
            return;
          }
          on(img, "load", () => markCardReady(img), { once: true });
          on(img, "error", () => markCardReady(img), { once: true });
          img.src = src;
          img.removeAttribute("data-src");
          observer.unobserve(img);
        });
      },
      { rootMargin: "240px 0px", threshold: 0.01 }
    );

    return state.lazyObserver;
  }

  function loadImageEager(img, src) {
    on(img, "load", () => markCardReady(img), { once: true });
    on(img, "error", () => markCardReady(img), { once: true });
    img.src = src;
    img.loading = "eager";
    img.fetchPriority = "high";
  }

  async function downloadPhoto(src, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const name = fileNameFromSrc(src);
    try {
      const res = await fetch(src, { cache: "force-cache" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement("a");
      a.href = src;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function createDownloadButton(src) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "photo-card__download";
    btn.setAttribute("aria-label", t("download"));
    btn.innerHTML = `${downloadIcon()}<span class="photo-card__download-label">${t("download")}</span>`;
    on(btn, "click", (e) => downloadPhoto(src, e));
    return btn;
  }

  function renderGallery() {
    if (!els.gallery) return;

    const list =
      state.filter === "all"
        ? shuffle(state.items)
        : state.items.filter((p) => p.album === state.filter);

    state.visible = list;
    destroyLazyObserver();
    els.gallery.innerHTML = "";

    const observer = createLazyObserver();

    list.forEach((photo, index) => {
      const w = photo.width || 4;
      const h = photo.height || 3;

      const card = document.createElement("article");
      card.className = "photo-card is-loading";
      card.style.animationDelay = `${(index % 12) * 0.04}s`;
      card.style.setProperty("--photo-ratio", `${w} / ${h}`);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", photo.album);

      const frame = document.createElement("div");
      frame.className = "photo-card__frame";

      const skeleton = document.createElement("div");
      skeleton.className = "photo-card__skeleton";
      skeleton.setAttribute("aria-hidden", "true");

      const spinner = document.createElement("div");
      spinner.className = "photo-card__spinner";
      spinner.setAttribute("aria-hidden", "true");

      const img = document.createElement("img");
      img.alt = photo.album;
      img.decoding = "async";
      img.width = w;
      img.height = h;
      img.sizes = "(min-width: 1200px) 25vw, (min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw";

      const eagerCount = window.matchMedia("(min-width: 900px)").matches ? 4 : 2;
      if (index < eagerCount) {
        loadImageEager(img, photo.src);
      } else if (observer) {
        img.src = PLACEHOLDER;
        img.dataset.src = photo.src;
        img.loading = "lazy";
        observer.observe(img);
      } else {
        img.loading = "lazy";
        loadImageEager(img, photo.src);
      }

      frame.appendChild(skeleton);
      frame.appendChild(spinner);
      frame.appendChild(img);
      card.appendChild(frame);
      card.appendChild(createDownloadButton(photo.src));

      const badge = document.createElement("span");
      badge.className = "photo-card__badge";
      badge.textContent = photo.album;
      card.appendChild(badge);

      on(card, "click", (e) => {
        if (e.target.closest(".photo-card__download")) return;
        openLightbox(index);
      });
      on(card, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(index);
        }
      });

      els.gallery.appendChild(card);
    });

    updateCount();
  }

  function openLightbox(index) {
    if (!els.lightbox || !els.lightboxImg) return;
    state.lightboxIndex = index;
    const photo = state.visible[index];
    if (!photo) return;
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.album || "";
    document.body.classList.add("is-lightbox-open");
    if (typeof els.lightbox.showModal === "function") {
      els.lightbox.showModal();
    } else {
      els.lightbox.setAttribute("open", "");
    }
  }

  function closeLightbox() {
    if (!els.lightbox) return;
    if (typeof els.lightbox.close === "function") {
      els.lightbox.close();
    } else {
      els.lightbox.removeAttribute("open");
    }
    document.body.classList.remove("is-lightbox-open");
    if (els.lightboxImg) els.lightboxImg.removeAttribute("src");
  }

  function stepLightbox(delta) {
    if (!state.visible.length || !els.lightboxImg) return;
    const len = state.visible.length;
    state.lightboxIndex = (state.lightboxIndex + delta + len) % len;
    const photo = state.visible[state.lightboxIndex];
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.album || "";
  }

  function preloadBackground(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(url);
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }

  function setHeroSlideImage(slideEl, src) {
    if (!slideEl || !src) return;
    const absolute = /^https?:\/\//i.test(src)
      ? src
      : new URL(src.startsWith("/") ? src : toPublicUrl(src), window.location.origin).href;
    slideEl.style.backgroundImage = `url("${absolute}")`;
  }

  async function showHeroSlide(src, slideIndex) {
    const slides = els.heroSlides;
    if (!slides || !slides.length) return;
    const target = slides[slideIndex];
    await preloadBackground(src);
    setHeroSlideImage(target, src);
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === slideIndex);
    });
    state.heroActiveSlide = slideIndex;
  }

  function stopHeroSlideshow() {
    if (state.heroTimer) {
      window.clearInterval(state.heroTimer);
      state.heroTimer = null;
    }
  }

  async function startHeroSlideshow() {
    stopHeroSlideshow();
    const pool = shuffle(state.items.map((item) => item.src));
    if (!pool.length || !els.heroSlides || !els.heroSlides.length) return;

    state.heroIndex = 0;
    await showHeroSlide(pool[0], 0);
    if (els.heroBg) els.heroBg.classList.add("is-loaded");

    if (
      pool.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Précharge la suivante
    preloadBackground(pool[1 % pool.length]);

    state.heroTimer = window.setInterval(() => {
      state.heroIndex = (state.heroIndex + 1) % pool.length;
      const nextSlide = state.heroActiveSlide === 0 ? 1 : 0;
      const src = pool[state.heroIndex];
      showHeroSlide(src, nextSlide);
      preloadBackground(pool[(state.heroIndex + 1) % pool.length]);
    }, 2000);
  }

  async function loadDeferredMedia() {
    const about = state.aboutPhoto;
    const aboutGradient =
      "linear-gradient(to right, rgba(7, 16, 24, 0.92) 0%, rgba(7, 16, 24, 0.55) 100%)";

    await startHeroSlideshow();

    const aboutTarget = els.aboutBg;
    if (!aboutTarget || !about) return;

    const applyAbout = async () => {
      await preloadBackground(about);
      aboutTarget.style.backgroundImage = `${aboutGradient}, ${toCssImage(about)}`;
      aboutTarget.classList.add("is-loaded");
    };

    if (!("IntersectionObserver" in window)) {
      await applyAbout();
      return;
    }

    const aboutObserver = new IntersectionObserver(
      async (entries, obs) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        await applyAbout();
      },
      { rootMargin: "300px 0px" }
    );
    aboutObserver.observe(aboutTarget);
  }

  function endIntro() {
    if (!els.intro || els.intro.classList.contains("is-done")) return;
    els.intro.classList.add("is-done");
    els.intro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-intro-locked");

    state.galleryReady = true;
    renderGallery();
    loadDeferredMedia();
    initMotion();
  }

  function initMotion() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    if (typeof WOW !== "undefined") {
      new WOW({
        boxClass: "wow",
        animateClass: "animate__animated",
        offset: 80,
        mobile: true,
        live: true,
      }).init();
    }
    if (typeof Rellax !== "undefined") {
      state.rellax = new Rellax(".rellax", {
        center: false,
        round: true,
        vertical: true,
        horizontal: false,
      });
    }
  }

  function bindEvents() {
    els.langBtns.forEach((btn) => {
      on(btn, "click", () => {
        state.lang = btn.dataset.lang;
        writeStoredLang(state.lang);
        applyI18n();
        refreshFilterLabels();
      });
    });

    let ticking = false;
    on(
      window,
      "scroll",
      () => {
        if (ticking || !els.header) return;
        ticking = true;
        requestAnimationFrame(() => {
          els.header.classList.toggle("is-scrolled", window.scrollY > 40);
          ticking = false;
        });
      },
      { passive: true }
    );

    on(els.lightboxClose, "click", closeLightbox);
    on(els.lightboxPrev, "click", () => stepLightbox(-1));
    on(els.lightboxNext, "click", () => stepLightbox(1));
    on(els.lightbox, "click", (e) => {
      if (e.target === els.lightbox) closeLightbox();
    });

    on(els.lightbox, "close", () => {
      document.body.classList.remove("is-lightbox-open");
    });

    on(document, "keydown", (e) => {
      if (!els.lightbox || !els.lightbox.open) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  async function init() {
    cacheElements();
    document.body.classList.add("is-intro-locked");
    bindEvents();

    const data = await fetchPhotosCatalog();
    applyCatalog(data);
    buildFilters();
    applyI18n();
    if (els.count) els.count.textContent = "";

    window.setTimeout(endIntro, INTRO_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
