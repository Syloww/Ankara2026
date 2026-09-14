(function () {
  "use strict";

  const INTRO_MS = 3200;
  const STORAGE_LANG = "ankara2026-lang";
  const HERO_PHOTO = "Photos/Elvan/P1031897.jpg";
  const ABOUT_PHOTO = "Photos/Elvan/P1032011.jpg";
  const PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect width='4' height='3' fill='%230a1520'/%3E%3C/svg%3E";

  const state = {
    lang: localStorage.getItem(STORAGE_LANG) || detectLang(),
    filter: "all",
    items: [],
    visible: [],
    lightboxIndex: 0,
    rellax: null,
    lazyObserver: null,
    galleryReady: false,
  };

  const els = {
    intro: document.getElementById("intro"),
    header: document.querySelector(".site-header"),
    heroBg: document.querySelector(".hero__bg"),
    aboutBg: document.querySelector(".about__parallax"),
    filters: document.getElementById("filters"),
    gallery: document.getElementById("gallery"),
    hint: document.getElementById("filter-hint"),
    count: document.getElementById("photo-count"),
    lightbox: document.getElementById("lightbox"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxCaption: document.getElementById("lightbox-caption"),
    lightboxDownload: document.getElementById("lightbox-download"),
    lightboxClose: document.getElementById("lightbox-close"),
    lightboxPrev: document.getElementById("lightbox-prev"),
    lightboxNext: document.getElementById("lightbox-next"),
    langBtns: document.querySelectorAll(".lang-btn"),
  };

  function detectLang() {
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    if (nav === "tr" || nav === "en" || nav === "fr") return nav;
    return "fr";
  }

  function t(key) {
    const dict = window.I18N[state.lang] || window.I18N.fr;
    return dict[key] || window.I18N.fr[key] || key;
  }

  function fileNameFromSrc(src) {
    return src.split("/").pop() || "photo.jpg";
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
    els.gallery.querySelectorAll(".photo-card__download").forEach((btn) => {
      btn.setAttribute("aria-label", t("download"));
      const label = btn.querySelector(".photo-card__download-label");
      if (label) label.textContent = t("download");
    });
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

  function buildCatalog() {
    const albums = window.PHOTOS_DATA?.albums || [];
    const items = [];
    albums.forEach((album) => {
      (album.photos || []).forEach((src) => {
        items.push({ src, album: album.id });
      });
    });
    state.items = items;
  }

  function buildFilters() {
    const albums = window.PHOTOS_DATA?.albums || [];
    els.filters.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-btn is-active";
    allBtn.dataset.filter = "all";
    allBtn.textContent = t("filterAll");
    allBtn.addEventListener("click", () => setFilter("all"));
    els.filters.appendChild(allBtn);

    albums.forEach((album) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.dataset.filter = album.id;
      btn.textContent = album.id;
      btn.addEventListener("click", () => setFilter(album.id));
      els.filters.appendChild(btn);
    });
  }

  function refreshFilterLabels() {
    const allBtn = els.filters.querySelector('[data-filter="all"]');
    if (allBtn) allBtn.textContent = t("filterAll");
  }

  function setFilter(id) {
    state.filter = id;
    els.filters.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.filter === id);
    });
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
          const reveal = () => {
            img.classList.add("is-decoded");
            img.closest(".photo-card")?.classList.add("is-ready");
          };
          img.addEventListener("load", reveal, { once: true });
          img.src = src;
          img.removeAttribute("data-src");
          observer.unobserve(img);
        });
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );

    return state.lazyObserver;
  }

  function loadImageEager(img, src) {
    const reveal = () => {
      img.closest(".photo-card")?.classList.add("is-ready");
    };
    img.addEventListener("load", reveal, { once: true });
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
    btn.addEventListener("click", (e) => downloadPhoto(src, e));
    return btn;
  }

  function renderGallery() {
    const list =
      state.filter === "all"
        ? shuffle(state.items)
        : state.items.filter((p) => p.album === state.filter);

    state.visible = list;
    destroyLazyObserver();
    els.gallery.innerHTML = "";

    const observer = createLazyObserver();

    list.forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = "photo-card";
      card.style.animationDelay = `${(index % 12) * 0.04}s`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", photo.album);

      const img = document.createElement("img");
      img.alt = photo.album;
      img.decoding = "async";
      img.src = PLACEHOLDER;

      const eagerCount = window.matchMedia("(min-width: 900px)").matches ? 4 : 2;
      if (index < eagerCount) {
        loadImageEager(img, photo.src);
      } else if (observer) {
        img.dataset.src = photo.src;
        img.loading = "lazy";
        observer.observe(img);
      } else {
        img.loading = "lazy";
        loadImageEager(img, photo.src);
      }

      card.appendChild(img);
      card.appendChild(createDownloadButton(photo.src));

      const badge = document.createElement("span");
      badge.className = "photo-card__badge";
      badge.textContent = photo.album;
      card.appendChild(badge);

      card.addEventListener("click", (e) => {
        if (e.target.closest(".photo-card__download")) return;
        openLightbox(index);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(index);
        }
      });

      els.gallery.appendChild(card);
    });

    updateCount();
  }

  function syncLightboxDownload(photo) {
    if (!els.lightboxDownload || !photo) return;
    els.lightboxDownload.href = photo.src;
    els.lightboxDownload.download = fileNameFromSrc(photo.src);
    els.lightboxDownload.onclick = (e) => downloadPhoto(photo.src, e);
  }

  function openLightbox(index) {
    state.lightboxIndex = index;
    const photo = state.visible[index];
    if (!photo) return;
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.album;
    els.lightboxCaption.textContent = photo.album;
    syncLightboxDownload(photo);
    if (typeof els.lightbox.showModal === "function") {
      els.lightbox.showModal();
    } else {
      els.lightbox.setAttribute("open", "");
    }
  }

  function closeLightbox() {
    if (typeof els.lightbox.close === "function") {
      els.lightbox.close();
    } else {
      els.lightbox.removeAttribute("open");
    }
    els.lightboxImg.removeAttribute("src");
  }

  function stepLightbox(delta) {
    if (!state.visible.length) return;
    const len = state.visible.length;
    state.lightboxIndex = (state.lightboxIndex + delta + len) % len;
    const photo = state.visible[state.lightboxIndex];
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.album;
    els.lightboxCaption.textContent = photo.album;
    syncLightboxDownload(photo);
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

  async function loadDeferredMedia() {
    const heroUrl = HERO_PHOTO;
    await preloadBackground(heroUrl);
    if (els.heroBg) {
      els.heroBg.style.setProperty("--hero-photo", `url("${heroUrl}")`);
      els.heroBg.classList.add("is-loaded");
    }

    const aboutTarget = els.aboutBg;
    if (!aboutTarget) return;

    const aboutObserver = new IntersectionObserver(
      async (entries, obs) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        await preloadBackground(ABOUT_PHOTO);
        aboutTarget.style.setProperty("--about-photo", `url("${ABOUT_PHOTO}")`);
        aboutTarget.classList.add("is-loaded");
      },
      { rootMargin: "300px 0px" }
    );
    aboutObserver.observe(aboutTarget);
  }

  function endIntro() {
    if (els.intro.classList.contains("is-done")) return;
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
      btn.addEventListener("click", () => {
        state.lang = btn.dataset.lang;
        localStorage.setItem(STORAGE_LANG, state.lang);
        applyI18n();
        refreshFilterLabels();
      });
    });

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          els.header.classList.toggle("is-scrolled", window.scrollY > 40);
          ticking = false;
        });
      },
      { passive: true }
    );

    els.lightboxClose.addEventListener("click", closeLightbox);
    els.lightboxPrev.addEventListener("click", () => stepLightbox(-1));
    els.lightboxNext.addEventListener("click", () => stepLightbox(1));

    els.lightbox.addEventListener("click", (e) => {
      if (e.target === els.lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (!els.lightbox.open) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  function init() {
    document.body.classList.add("is-intro-locked");
    buildCatalog();
    buildFilters();
    applyI18n();
    if (els.count) els.count.textContent = "";
    bindEvents();
    window.setTimeout(endIntro, INTRO_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
