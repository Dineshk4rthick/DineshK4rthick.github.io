"use strict";

// One playback permission covers the radio and every chapter, including later scroll entries.
const coastalAudio = (() => {
  const master = document.querySelector("[data-cinema-sound]");
  const radio = document.querySelector("#radio-button");
  const launch = document.querySelector("#launch-drive");
  const buffers = new Map();
  const failed = new Set();
  // A file:// preview cannot fetch sibling tracks for Web Audio decoding.
  const fileRadio = location.protocol === "file:" ? new Audio("assets/audio/coastal-fm.m4a") : null;
  if (fileRadio) fileRadio.loop = true;
  let context, radioGain, radioSource, sceneSource, scene;
  let advancing = false;
  let lastReady;
  let enabled = preference("coastal-cinema-sound");
  let tuned = preference("coastal-fm");

  function preference(key) {
    try { return (localStorage.getItem(key) ?? sessionStorage.getItem(key)) !== "off"; }
    catch { return true; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value ? "on" : "off"); } catch {}
  }
  function updateControls() {
    const running = context?.state === "running";
    const locked = enabled && !running;
    const retry = enabled && ((tuned && failed.has("coastal-fm")) || (scene && failed.has(trackName(scene))) || (document.documentElement.classList.contains("drive-waiting") && failed.has("drive")));
    const needsStart = locked || Boolean(retry);
    master.dataset.action = needsStart ? "start" : "toggle";
    radio.dataset.action = tuned && (needsStart || !enabled) ? "start" : "toggle";
    master.setAttribute("aria-pressed", String(enabled && !needsStart));
    master.title = needsStart ? "Start site audio" : enabled ? "Mute site audio" : "Enable site audio";
    master.setAttribute("aria-label", master.title);
    master.querySelector("span").textContent = needsStart ? "Start sound" : enabled ? "Sound on" : "Sound off";
    const fmPlaying = fileRadio ? !fileRadio.paused && running && enabled : Boolean(radioSource && running && enabled);
    radio.setAttribute("aria-pressed", String(fmPlaying));
    radio.setAttribute("aria-label", radio.dataset.action === "start" ? "Start Coastal FM" : tuned ? "Turn Coastal FM off" : "Turn Coastal FM on");
    document.querySelector("#radio-state").textContent = fmPlaying ? "On" : tuned && enabled ? "Ready" : "Off";
    const ready = canStartIntro();
    if (ready !== lastReady) {
      lastReady = ready;
      queueMicrotask(() => document.dispatchEvent(new Event("coastal-audio-readychange")));
    }
  }
  function canStartIntro() {
    return !enabled || (context?.state === "running" && Boolean(fileRadio || buffers.get("drive")));
  }
  function prepare(track, attempt = 0) {
    if (fileRadio || !context || buffers.has(track)) return;
    failed.delete(track);
    buffers.set(track, null);
    fetch("assets/audio/" + track + ".m4a" + (track === "metro" ? "?v=quieter" : "")).then(response => {
      if (!response.ok) throw Error(response.status);
      return response.arrayBuffer();
    }).then(bytes => context.decodeAudioData(bytes)).then(buffer => {
      buffers.set(track, buffer);
      update();
    }).catch(() => {
      buffers.delete(track);
      failed.add(track);
      updateControls();
      if (!attempt) setTimeout(() => prepare(track, 1), 700);
    });
  }
  function stop(source) {
    if (source) { source.stop(); source.disconnect(); }
    return null;
  }
  function trackName(video) {
    return video.id === "drive-film" ? "drive" : video.closest("article").querySelector("[data-mission]").dataset.mission;
  }
  function update() {
    const audible = enabled && context?.state === "running" && !document.hidden;
    const score = buffers.get("coastal-fm");
    if (audible && tuned && score && !radioSource) {
      radioSource = context.createBufferSource();
      radioSource.buffer = score;
      radioSource.loop = true;
      radioSource.loopEnd = Math.min(9.28, score.duration);
      radioSource.connect(radioGain);
      radioSource.start();
    } else if (!audible || !tuned) radioSource = stop(radioSource);

    const playing = audible && advancing && scene && !scene.paused && !scene.ended;
    if (fileRadio) {
      if (scene) scene.muted = !audible;
      fileRadio.volume = playing ? .16 : .60;
      if (audible && tuned) {
        if (fileRadio.paused) fileRadio.play().catch(() => {});
      } else fileRadio.pause();
      updateControls();
      return;
    }
    if (!playing) sceneSource = stop(sceneSource);
    if (playing && !sceneSource) {
      const score = buffers.get(trackName(scene));
      if (score && scene.currentTime < score.duration) {
        sceneSource = context.createBufferSource();
        sceneSource.buffer = score;
        sceneSource.playbackRate.value = scene.playbackRate;
        sceneSource.connect(context.destination);
        sceneSource.start(0, scene.currentTime);
      }
    }
    if (radioGain) radioGain.gain.setTargetAtTime(playing ? .16 : .60, context.currentTime, .10);
    updateControls();
  }
  function wake() {
    if (!enabled || document.hidden) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    if (!context) {
      context = new AudioEngine();
      radioGain = context.createGain();
      radioGain.connect(context.destination);
      context.addEventListener("statechange", update);
    }
    // Calling resume inside the original input event also unlocks future scenes.
    if (context.state !== "running") context.resume().then(update, updateControls);
    if (tuned) prepare("coastal-fm");
    if (document.documentElement.classList.contains("drive-waiting")) prepare("drive");
    if (scene) prepare(trackName(scene));
    update();
  }
  function select(video) {
    sceneSource = stop(sceneSource);
    if (fileRadio && scene) scene.muted = true;
    scene = video;
    advancing = false;
    if (enabled && video) prepare(trackName(video));
    update();
  }
  for (const video of document.querySelectorAll("video")) {
    video.addEventListener("playing", () => {
      if (scene === video) { advancing = true; update(); }
    });
    for (const type of ["pause","waiting","ended","seeking"]) video.addEventListener(type, () => {
      if (scene === video) { advancing = false; update(); }
    });
    for (const type of ["seeked","ratechange"]) video.addEventListener(type, () => {
      if (scene !== video) return;
      sceneSource = stop(sceneSource);
      advancing = !video.paused && video.readyState >= 3;
      update();
    });
  }
  // Preserve what the visitor pressed if the browser unlocks between down and click.
  const pressedAction = new WeakMap();
  for (const button of [master, radio]) {
    const remember = () => pressedAction.set(button, button.dataset.action);
    button.addEventListener("pointerdown", remember);
    button.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") remember(); });
    button.addEventListener("pointercancel", () => pressedAction.delete(button));
    button.addEventListener("blur", () => pressedAction.delete(button));
  }
  function requestedStart(button) {
    const action = pressedAction.get(button) ?? button.dataset.action;
    pressedAction.delete(button);
    return action === "start";
  }
  launch.addEventListener("click", wake);
  master.addEventListener("click", () => {
    if (requestedStart(master)) return wake();
    enabled = !enabled;
    save("coastal-cinema-sound", enabled);
    if (enabled) wake(); else update();
  });
  radio.addEventListener("click", () => {
    if (requestedStart(radio)) {
      if (!enabled) { enabled = true; save("coastal-cinema-sound", true); }
      return wake();
    }
    tuned = !tuned;
    save("coastal-fm", tuned);
    if (tuned && !enabled) { enabled = true; save("coastal-cinema-sound", true); }
    wake();
    update();
  });
  function gesture(event) {
    if (!event.isTrusted || (context?.state === "running" && !failed.size) ||
        event.target.closest?.("[data-cinema-sound],#radio-button,#launch-drive,#skip-drive")) return;
    wake();
  }
  for (const event of ["pointerdown","pointerup","touchend","keydown","click"])
    document.addEventListener(event, gesture, {capture:true, passive:true});
  document.addEventListener("visibilitychange", () => { if (document.hidden) update(); else wake(); });
  window.addEventListener("pageshow", wake);
  updateControls();
  wake();
  return {select, canStartIntro, needsGesture: () => enabled && context && context.state !== "running", prepareIntro: () => { if (enabled) prepare("drive"); }};
})();
