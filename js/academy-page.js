(function () {
  const App = window.Allona = window.Allona || {};

	  const academyModel = {
	    table: "academy_articles",
	    lessonTable: "academy_lessons",
	    publicStatus: "published",
	    statuses: ["draft", "review", "published", "archived"],
	    fields: [
      "title",
      "slug",
      "category",
      "excerpt",
      "content",
      "keywords",
      "meta_title",
      "meta_description",
      "author",
      "status",
      "published_at",
	      "updated_at"
	    ],
	    lessonFields: [
	      "title",
	      "slug",
	      "category",
	      "summary",
	      "video_url",
	      "poster_url",
	      "duration",
	      "level",
	      "visibility",
	      "status",
	      "sort_order",
	      "published_at",
	      "updated_at"
	    ],
	    access: {
	      public: "Herkese acik ve indekslenebilir.",
	      partner: "Partner oturumu gerekir ve indekslemeye kapali tutulur.",
      internal: "Admin rolu gerekir ve public sitede gosterilmez."
    }
  };

  function hideUnpublished() {
    document.querySelectorAll("[data-academy-articles] [data-status]").forEach((card) => {
      if (card.getAttribute("data-status") !== academyModel.publicStatus) {
        card.hidden = true;
      }
    });
  }

	  function initCategoryFilter() {
	    document.querySelectorAll("[data-category]").forEach((link) => {
	      link.addEventListener("click", () => {
	        sessionStorage.setItem("allona_academy_last_category", link.getAttribute("data-category") || "");
	      });
	    });
	  }

	  function setText(selector, value) {
	    const node = document.querySelector(selector);
	    if (node) node.textContent = value || "";
	  }

	  function getYouTubeId(src) {
	    try {
	      const url = new URL(src);
	      const host = url.hostname.replace(/^www\./, "");
	      if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
	      if (host.endsWith("youtube.com")) {
	        if (url.searchParams.get("v")) return url.searchParams.get("v");
	        const parts = url.pathname.split("/").filter(Boolean);
	        if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] || "";
	      }
	    } catch (error) {
	      return "";
	    }
	    return "";
	  }

	  function getVimeoId(src) {
	    try {
	      const url = new URL(src);
	      const host = url.hostname.replace(/^www\./, "");
	      if (!host.endsWith("vimeo.com")) return "";
	      return url.pathname.split("/").filter(Boolean).pop() || "";
	    } catch (error) {
	      return "";
	    }
	  }

	  function createMediaElement(lesson) {
	    const src = lesson.videoSrc;
	    const youtubeId = getYouTubeId(src);
	    const vimeoId = getVimeoId(src);

	    if (youtubeId) {
	      const iframe = document.createElement("iframe");
	      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0`;
	      iframe.title = lesson.title;
	      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
	      iframe.allowFullscreen = true;
	      return iframe;
	    }

	    if (vimeoId) {
	      const iframe = document.createElement("iframe");
	      iframe.src = `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?autoplay=1`;
	      iframe.title = lesson.title;
	      iframe.allow = "autoplay; fullscreen; picture-in-picture";
	      iframe.allowFullscreen = true;
	      return iframe;
	    }

	    const video = document.createElement("video");
	    video.controls = true;
	    video.playsInline = true;
	    video.preload = "metadata";
	    video.autoplay = true;
	    if (lesson.poster) video.poster = lesson.poster;
	    const source = document.createElement("source");
	    source.src = src;
	    source.type = src.endsWith(".webm") ? "video/webm" : "video/mp4";
	    video.appendChild(source);
	    return video;
	  }

	  function readLesson(button) {
	    return {
	      title: button.getAttribute("data-lesson-title") || "",
	      category: button.getAttribute("data-lesson-category") || "",
	      duration: button.getAttribute("data-lesson-duration") || "",
	      level: button.getAttribute("data-lesson-level") || "",
	      summary: button.getAttribute("data-lesson-summary") || "",
	      videoSrc: button.getAttribute("data-lesson-video-src") || "",
	      poster: button.getAttribute("data-lesson-poster") || ""
	    };
	  }

	  function initAcademyTv() {
	    const root = document.querySelector("[data-academy-tv]");
	    if (!root) return;

	    const frame = root.querySelector("[data-video-frame]");
	    const cover = root.querySelector("[data-video-cover]");
	    const lessons = Array.from(root.querySelectorAll("[data-lesson-title]"));
	    if (!frame || !cover || !lessons.length) return;

	    const coverTemplate = cover.cloneNode(true);
	    let currentLesson = readLesson(lessons.find((item) => item.classList.contains("is-active")) || lessons[0]);

	    function updateText(lesson) {
	      setText("[data-video-category]", lesson.category);
	      setText("[data-video-title]", lesson.title);
	      setText("[data-video-summary]", lesson.summary);
	      setText("[data-video-meta-category]", lesson.category);
	      setText("[data-video-meta-duration]", lesson.duration);
	      setText("[data-video-meta-level]", lesson.level);
	    }

	    function attachPlayHandler() {
	      const playButton = root.querySelector("[data-video-play]");
	      if (!playButton) return;
	      playButton.addEventListener("click", () => {
	        if (!currentLesson.videoSrc) return;
	        frame.replaceChildren(createMediaElement(currentLesson));
	      });
	    }

	    function renderCover(lesson) {
	      const nextCover = coverTemplate.cloneNode(true);
	      frame.replaceChildren(nextCover);
	      updateText(lesson);
	      attachPlayHandler();
	    }

	    lessons.forEach((button) => {
	      button.addEventListener("click", () => {
	        lessons.forEach((item) => item.classList.remove("is-active"));
	        button.classList.add("is-active");
	        currentLesson = readLesson(button);
	        renderCover(currentLesson);
	      });
	    });

	    renderCover(currentLesson);
	  }

	  function initAcademySearch() {
	    const input = document.getElementById("globalSearchInput");
	    const button = document.querySelector("[data-global-search]");
	    const routes = [
	      { keys: ["akademi", "makale", "rehber", "egitim", "eğitim", "video", "ders", "webinar", "sertifika"], url: "allonahub-akademi.html" },
	      { keys: ["kupon", "hp", "kampanya", "indirim"], url: "pages/commerce/kuponlar.html" },
	      { keys: ["partner", "satici", "satıcı"], url: "pages/partner/partner.html" },
      { keys: ["kariyer", "cv", "is", "iş"], url: "pages/career/allonakariyer.html" },
      { keys: ["shop", "magaza", "mağaza", "alisveris", "alışveriş"], url: "pages/commerce/allonashop.html" }
    ];

    function search() {
      const q = String(input && input.value || "").toLocaleLowerCase("tr-TR").trim();
      if (!q) return;
      const found = routes.find((item) => item.keys.some((key) => q.includes(key)));
      window.location.href = found ? found.url : `pages/search/arama.html?q=${encodeURIComponent(q)}`;
    }

    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") search();
      });
    }
    if (button) button.addEventListener("click", search);
  }

  App.academy = {
    model: academyModel,
	    hideUnpublished,
	    initCategoryFilter,
	    initAcademyTv,
	    initAcademySearch
	  };

  document.addEventListener("DOMContentLoaded", () => {
	    hideUnpublished();
	    initCategoryFilter();
	    initAcademyTv();
	    initAcademySearch();
	  });
	})();
