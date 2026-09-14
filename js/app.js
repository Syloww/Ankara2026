(function () {
  "use strict";

  const INTRO_MS = 3200;
  const STORAGE_LANG = "ankara2026-lang";

  const state = {
    lang: localStorage.getItem(STORAGE_LANG) || detectLang(),
    filter: "all",
    items: [],
    visible: [],
    lightboxIndex: 0,
    rellax: null,
  };

  const els = {
    intro: document.getElementById("intro"),
    skipIntro: document.getElementById("skip-intro"),
    header: document.querySelector(".site-header"),
    filters: document.getElementById("filters"),
    gallery: document.getElementById("gallery"),
    hint: document.getElementById("filter-hint"),
    count: document.getElementById("photo-count"),
    lightbox: document.getElementById("lightbox"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxCaption: document.getElementById("lightbox-caption"),
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
    renderGallery();
  }

  function updateHint() {
    if (!els.hint) return;
    els.hint.textContent =
      state.filter === "all" ? t("shuffleHint") : state.filter;
  }

  function updateCount() {
    if (!els.count) return;
    const n = state.visible.length;
    const key = n === 1 ? "countPhoto" : "countPhotos";
    els.count.textContent = t(key).replace("{n}", String(n));
  }

  function renderGallery() {
    let list =
      state.filter === "all"
        ? shuffle(state.items)
        : state.items.filter((p) => p.album === state.filter);

    state.visible = list;
    els.gallery.innerHTML = "";

    list.forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = "photo-card";
      card.style.animationDelay = `${(index % 12) * 0.05}s`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${photo.album}`);

      const img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.album;
      img.loading = "lazy";
      img.decoding = "async";

      const badge = document.createElement("span");
      badge.className = "photo-card__badge";
      badge.textContent = photo.album;

      card.appendChild(img);
      card.appendChild(badge);
      card.addEventListener("click", () => openLightbox(index));
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

  function openLightbox(index) {
    state.lightboxIndex = index;
    const photo = state.visible[index];
    if (!photo) return;
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.album;
    els.lightboxCaption.textContent = photo.album;
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
  }

  function stepLightbox(delta) {
    if (!state.visible.length) return;
    const len = state.visible.length;
    state.lightboxIndex = (state.lightboxIndex + delta + len) % len;
    const photo = state.visible[state.lightboxIndex];
    els.lightboxImg.src = photo.src;
    els.lightboxImg.alt = photo.album;
    els.lightboxCaption.textContent = photo.album;
  }

  function endIntro() {
    els.intro.classList.add("is-done");
    els.intro.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-intro-locked");
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
    els.skipIntro.addEventListener("click", endIntro);

    els.langBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.lang = btn.dataset.lang;
        localStorage.setItem(STORAGE_LANG, state.lang);
        applyI18n();
        refreshFilterLabels();
      });
    });

    window.addEventListener(
      "scroll",
      () => {
        els.header.classList.toggle("is-scrolled", window.scrollY > 40);
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
    renderGallery();
    bindEvents();
    window.setTimeout(endIntro, INTRO_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
