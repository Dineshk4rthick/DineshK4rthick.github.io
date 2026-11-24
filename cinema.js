"use strict";

(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const drive = document.querySelector("#drive");
  const intro = document.querySelector("#drive-film");
  const brief = document.querySelector("#brief");
  const panels = [...document.querySelectorAll(".mission-panel")];
  const cueTimes = {policy: 0.89, memory: 1.42, metro: 1.24, zoo: 1.12, showroom: 0.77};
  let active = null;
  let playbackId = 0;
  let startupTimeout;
  let explicitReplay = false;
  let scrollFrame;
  let titleFrame;
  let titleAnimations = [];

  function stopTitles() {
    cancelAnimationFrame(titleFrame);
    for (const animation of titleAnimations) animation.cancel();
    titleAnimations = [];
  }

  function startTitles() {
    stopTitles();
    if (reduced.matches) return;
    const title = document.querySelector(".hero-copy");
    // The slugs enter from the left as the car enters from the right.
    const cues = [
      [".hero-kicker", 70, 680, 28],
      ["h1 span:first-child", 460, 1430, 110],
      ["h1 span:last-child", 990, 1610, 145],
      [".hero-role", 1960, 820, 42],
      [".intro", 2510, 830, 26],
      [".hero-actions", 3070, 750, 16],
    ];
    for (const [selector, delay, duration, distance] of cues) {
      const el = title.querySelector(selector);
      const headline = el.parentElement.tagName === "H1";
      const frames = [
        {opacity:0, transform:`translateX(-${distance}px) skewX(-8deg)`, clipPath:"inset(-35% 100% -35% -15%)", filter:headline ? "blur(3px)" : "none"},
        {opacity:1, transform:"translateX(0) skewX(0deg)", clipPath:"inset(-35% -15% -35% -15%)", filter:headline ? "blur(0px)" : "none"}
      ];
      const animation = el.animate(frames, {delay, duration, fill:"both", easing:"cubic-bezier(.18,.76,.22,1)"});
      animation.pause();
      animation.currentTime = 0;
      titleAnimations.push(animation);
    }
    function trackCar() {
      for (const animation of titleAnimations) animation.currentTime = intro.currentTime * 1000;
      titleFrame = requestAnimationFrame(trackCar);
    }
    titleFrame = requestAnimationFrame(trackCar);
  }
  function releaseActive() {
    playbackId++;
    coastalAudio.select(null);
    if (!active) return;
    active.pause();
    active.muted = true;
    active = null;
  }

  function finishIntro() {
    clearTimeout(startupTimeout);
    if (active === intro) releaseActive();
    drive.hidden = true;
    root.classList.remove("intro-pending", "drive-active", "drive-waiting");
    stopTitles();
    queueViewport();
  }

  function showStill(video) {
    if (video === intro) return finishIntro();
    const panel = video.closest(".mission-panel");
    panel.querySelector(".scene-image").src = "assets/" + panel.querySelector("[data-mission]").dataset.mission + ".webp";
    panel.dataset.playback = "still";
    panel.classList.add("copy-visible");
    if (video === active) releaseActive();
  }

  async function play(video) {
    clearTimeout(startupTimeout);
    releaseActive();
    active = video;
    const id = playbackId;
    video.muted = true;
    coastalAudio.select(video);
    if (!video.hasAttribute("src")) video.src = video.dataset.film;
    if (video.readyState) video.currentTime = 0;
    startupTimeout = setTimeout(() => {
      if (active === video && id === playbackId && video.readyState < 3) showStill(video);
    }, 4200);
    try {
      await video.play();
    } catch {
      if (id === playbackId) showStill(video);
      return;
    }
    if (id !== playbackId || active !== video) return;
    clearTimeout(startupTimeout);
  }

  function startIntro() {
    if (!drive.hidden) return;
    drive.hidden = false;
    root.classList.remove("intro-pending");
    root.classList.add("drive-waiting");
    coastalAudio.prepareIntro();
    runReadyIntro();
  }
  function runReadyIntro() {
    if (!root.classList.contains("drive-waiting") || !coastalAudio.canStartIntro() || document.hidden) return;
    root.classList.remove("drive-waiting");
    root.classList.add("drive-active");
    startTitles();
    play(intro);
  }
  document.addEventListener("coastal-audio-readychange", runReadyIntro);

  intro.addEventListener("ended", finishIntro);
  intro.addEventListener("error", () => { if (!drive.hidden) finishIntro(); });
  document.addEventListener("keydown", event => { if (!drive.hidden && event.key === "Escape") finishIntro(); });
  document.querySelector("#skip-drive").addEventListener("click", finishIntro);
  document.querySelector("#replay-drive").addEventListener("click", () => {
    document.querySelector("#overview").scrollIntoView({behavior: "instant"});
    startIntro();
  });

  function startPanel(panel, manual = false) {
    explicitReplay = manual;
    const video = panel.querySelector("video");
    panel.dataset.playback = "starting";
    panel.classList.remove("copy-visible");
    play(video);
  }

  for (const panel of panels) {
    const video = panel.querySelector("video");
    const cue = cueTimes[panel.querySelector("[data-mission]").dataset.mission];
    const replay = panel.querySelector(".scene-replay");
    replay.setAttribute("aria-label", "Replay " + panel.querySelector("h3").innerText.replace(/\s+/g, " ").trim() + " scene");
    replay.addEventListener("click", () => {
      panel.scrollIntoView({block: "start", behavior: "instant"});
      startPanel(panel, true);
    });
    video.addEventListener("playing", () => {
      if (video === active) panel.dataset.playback = "playing";
    });
    video.addEventListener("timeupdate", () => {
      if (video.currentTime >= cue) panel.classList.add("copy-visible");
    });
    video.addEventListener("ended", () => {
      panel.dataset.playback = "complete";
      panel.classList.add("copy-visible");
    });
    video.addEventListener("error", () => showStill(video));
  }

  function updateViewport() {
    scrollFrame = 0;
    if (document.hidden || brief.open) return;
    if (!drive.hidden) {
      if (document.querySelector("#overview").getBoundingClientRect().bottom < innerHeight * .25) finishIntro();
      return;
    }
    let best = null;
    let bestRatio = 0;
    const top = document.querySelector("header").offsetHeight;
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect();
      const visible = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(top, rect.top));
      if (!visible) {
        if (panel.dataset.playback && panel.dataset.playback !== "still") {
          panel.removeAttribute("data-playback");
          panel.classList.remove("copy-visible");
        }
        continue;
      }
      const ratio = visible / Math.min(rect.height, innerHeight - top);
      if (ratio > bestRatio) { best = panel; bestRatio = ratio; }
    }
    const previous = active?.closest(".mission-panel");
    if (previous && (!best || bestRatio < .08 || (previous !== best && bestRatio >= .56))) {
      // Keep the last readable frame while two chapters share the viewport.
      if (previous.hasAttribute("data-playback")) {
        previous.dataset.playback = "complete";
        previous.classList.add("copy-visible");
      }
      releaseActive();
      explicitReplay = false;
    }
    if (!best || bestRatio < .56 || (reduced.matches && !explicitReplay)) return;
    if (!best.hasAttribute("data-playback")) startPanel(best);
  }

  function queueViewport() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateViewport);
  }

  if ("IntersectionObserver" in window) {
    const preload = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || reduced.matches) continue;
        const video = entry.target.querySelector("video");
        entry.target.querySelector(".scene-image").src = video.dataset.film.replace(".mp4", "-opening.webp");
        if (!video.hasAttribute("src")) {
          video.preload = "metadata";
          video.src = video.dataset.film;
        }
        preload.unobserve(entry.target);
      }
    }, {rootMargin: "35% 0px"});
    panels.forEach(panel => preload.observe(panel));
    const reveals = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        reveals.unobserve(entry.target);
      }
    }, {threshold: .10});
    document.querySelectorAll("#loadout .split > div,#profile .split > div,.contact-inner > div").forEach(el => {
      el.classList.add("rise-in");
      reveals.observe(el);
    });
  }
  function suspend() {
    if (!drive.hidden) finishIntro();
    else if (active && !active.ended) active.pause();
  }
  function resume() {
    if (active && !active.ended && !brief.open && !document.hidden) {
      active.play().catch(() => { if (active) showStill(active); });
    }
    queueViewport();
  }
  new MutationObserver(() => { if (brief.open) suspend(); else resume(); }).observe(brief,{attributes:true,attributeFilter:["open"]});
  document.addEventListener("visibilitychange", () => { if (document.hidden) suspend(); else resume(); });
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  window.addEventListener("scroll", queueViewport, {passive:true});
  window.addEventListener("resize", queueViewport);
  document.querySelector(".filters").addEventListener("click", queueViewport);
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      if (!drive.hidden) finishIntro();
      if (active) showStill(active);
    }
    queueViewport();
  });
  root.classList.add("cinema-ready");
  if (root.classList.contains("intro-pending")) startIntro();
  else queueViewport();
})();
