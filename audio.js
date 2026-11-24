"use strict";

// One playback permission covers the radio and every chapter, including later scroll entries.
const coastalAudio = (() => {
  const master = document.querySelector("[data-cinema-sound]");
  const radio = document.querySelector("#radio-button");
  const start = document.querySelector("#start-audio");
  const buffers = new Map();
  // A file:// preview cannot fetch sibling tracks for Web Audio decoding.
  const fileRadio = location.protocol === "file:" ? new Audio("assets/audio/coastal-fm.m4a") : null;
  if (fileRadio) fileRadio.loop = true;
  let context, radioGain, radioSource, sceneSource, scene;
  let advancing = false;
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
    master.setAttribute("aria-pressed", String(enabled));
    master.title = enabled ? "Mute site audio" : "Enable site audio";
    master.setAttribute("aria-label", master.title);
    master.querySelector("span").textContent = enabled ? "Sound on" : "Sound off";
    radio.setAttribute("aria-pressed", String(tuned));
    radio.setAttribute("aria-label", tuned ? "Turn Coastal FM off" : "Turn Coastal FM on");
    document.querySelector("#radio-state").textContent = tuned ? "On" : "Off";
    start.hidden = !enabled || context?.state === "running" || document.hidden;
  }
  function prepare(track) {
    if (fileRadio || !context || buffers.has(track)) return;
    buffers.set(track, null);
    fetch("assets/audio/" + track + ".m4a").then(response => {
      if (!response.ok) throw Error(response.status);
      return response.arrayBuffer();
    }).then(bytes => context.decodeAudioData(bytes)).then(buffer => {
      buffers.set(track, buffer);
      update();
    }).catch(() => buffers.delete(track));
  }
  function stop(source) {
    if (source) { source.stop(); source.disconnect(); }
    return null;
  }
  function trackName(video) {
    return video.id === "drive-film" ? "drive" : video.closest("article").querySelector("[data-mission]").dataset.mission;
  }
  function update() {
    updateControls();
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
  }
  function wake() {
    if (!enabled || document.hidden) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) { start.hidden = true; return; }
    if (!context) {
      context = new AudioEngine();
      radioGain = context.createGain();
      radioGain.connect(context.destination);
      context.addEventListener("statechange", update);
    }
    // Calling resume inside the original input event also unlocks future scenes.
    if (context.state !== "running") context.resume().then(update, updateControls);
    if (tuned) prepare("coastal-fm");
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
  master.addEventListener("click", () => {
    enabled = !enabled;
    save("coastal-cinema-sound", enabled);
    if (enabled) wake(); else update();
  });
  radio.addEventListener("click", () => {
    tuned = !tuned;
    save("coastal-fm", tuned);
    if (tuned && !enabled) { enabled = true; save("coastal-cinema-sound", true); }
    wake();
    update();
  });
  function gesture(event) {
    if (!event.isTrusted || context?.state === "running" || event.target.closest?.("[data-cinema-sound],#radio-button")) return;
    wake();
  }
  for (const event of ["pointerdown","pointerup","touchend","keydown","click"])
    document.addEventListener(event, gesture, {capture:true, passive:true});
  document.addEventListener("visibilitychange", () => { if (document.hidden) update(); else wake(); });
  window.addEventListener("pageshow", wake);
  updateControls();
  wake();
  return {select};
})();
