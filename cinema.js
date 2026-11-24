"use strict";

(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const drive = document.querySelector("#drive");
  const intro = document.querySelector("#drive-film");
  const brief = document.querySelector("#brief");
  const panels = [...document.querySelectorAll(".mission-panel")];
  const soundButtons = [...document.querySelectorAll("[data-cinema-sound]")];
  const cueTimes = {policy: 0.89, memory: 1.42, metro: 1.24, zoo: 1.12, showroom: 0.77};
  let active = null;
  let playbackId = 0;
  let startupTimeout;
  let explicitReplay = false;
  let scrollFrame;
  let sound = true;
  let waitingForGesture = false;
  try {
    const stored = localStorage.getItem("coastal-cinema-sound") ?? sessionStorage.getItem("coastal-cinema-sound");
    sound = stored !== "off";
  } catch { /* Browsing without storage still supports sound for this visit. */ }

  function setSound(enabled, save) {
    sound = enabled;
    if (save) {
      try { localStorage.setItem("coastal-cinema-sound", enabled ? "on" : "off"); } catch {}
    }
    if (active) active.muted = !enabled;
    for (const button of soundButtons) {
      button.setAttribute("aria-pressed", String(enabled));
      const label = enabled ? "Mute cinematic sound" : "Enable cinematic sound";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.querySelector("span").textContent = enabled ? "Sound on" : "Sound off";
    }
  }
  setSound(sound, false);

  function releaseActive() {
    playbackId++;
    if (!active) return;
    active.pause();
    active.muted = true;
    active = null;
  }

  function finishIntro() {
    clearTimeout(startupTimeout);
    if (active === intro) releaseActive();
    drive.hidden = true;
    root.classList.remove("intro-pending", "drive-active");
    root.classList.add("hero-reveal");
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
    video.muted = !sound || waitingForGesture;
    video.volume = 0.77;
    if (!video.hasAttribute("src")) video.src = video.dataset.film;
    if (video.readyState) video.currentTime = 0;
    startupTimeout = setTimeout(() => {
      if (active === video && id === playbackId && video.readyState < 3) showStill(video);
    }, 4200);
    try {
      await video.play();
    } catch (error) {
      if (id !== playbackId || active !== video) return;
      if (error.name !== "NotAllowedError" || video.muted) return showStill(video);
      waitingForGesture = true;
      video.muted = true;
      try { await video.play(); } catch { if (id === playbackId) showStill(video); }
    }
    if (id !== playbackId || active !== video) return;
    clearTimeout(startupTimeout);
  }

  function unlockSound(event) {
    if (!event.isTrusted || !sound || !waitingForGesture || event.target.closest?.("[data-cinema-sound]")) return;
    waitingForGesture = false;
    resumeAudibly();
  }

  function resumeAudibly() {
    const video = active;
    if (!video || video.ended || brief.open || document.hidden) return;
    video.muted = !sound;
    video.play().catch(error => {
      if (video !== active || !sound || error.name !== "NotAllowedError") return;
      waitingForGesture = true;
      video.muted = true;
      video.play().catch(() => {});
    });
  }
  document.addEventListener("click", unlockSound, true);
  document.addEventListener("keydown", unlockSound, true);
  for (const button of soundButtons) button.addEventListener("click", () => {
    waitingForGesture = false;
    setSound(!sound, true);
    resumeAudibly();
  });

  function startIntro() {
    if (!drive.hidden) return;
    root.classList.remove("hero-reveal");
    drive.hidden = false;
    root.classList.add("drive-active");
    root.classList.remove("intro-pending");
    document.dispatchEvent(new Event("coastal-drive-start"));
    play(intro);
  }

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
