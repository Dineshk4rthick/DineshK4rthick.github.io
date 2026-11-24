"use strict";

const missions = {
  zoo: {
    title: "Zootopia Zoo Management",
    label: "Mission 04 / Full-stack",
    sections: [
      ["The brief", "I built a zoo management web application with dedicated pages for animals, staff and visitors."],
      ["The implementation", "Node.js handles the application logic, PostgreSQL stores the records, and HTML, CSS and JavaScript provide the browser interface."]
    ],
    repo: "https://github.com/Dineshk4rthick/zootopia_zoo-management"
  },
  showroom: {
    title: "Car Showroom Management",
    label: "Mission 05 / Desktop",
    sections: [
      ["The brief", "I built a desktop tool for creating, finding, editing and deleting dealership records through a Tkinter interface."],
      ["The database", "SQLite foreign keys connect related records. Joins and aggregates produce reports, while commit and rollback control when an edit becomes permanent."]
    ],
    repo: "https://github.com/Dineshk4rthick/car_dealership_python"
  },
  policy: {
    title: "Contoso PolicyAssistant",
    label: "Mission 01 / Azure",
    sections: [
      ["The brief", "During my cloud internship at Coromandel, I built a prototype for looking up fictional HR, IT and travel policies. An Android client sends a question to a FastAPI service, which returns an answer with its source file."],
      ["The engineering decision", "A sick-leave question kept retrieving remote-work passages. I inspected the retrieved chunks, combined keyword and vector search, and reduced the result set from five passages to three. That removed the unrelated citations in this case."],
      ["Deployment", "GitHub Actions ran 26 unit tests and built a Docker image. Separate workflows shipped SHA-tagged images to Azure Container Apps and App Service. Managed identities gave the running service access to Foundry and Azure AI Search."],
      ["What the evaluation showed", "I evaluated the assistant with 40 golden cases and 18 adversarial cases. Median response time was 4.91 seconds. The assistant declined only 40% of unanswerable questions, which made refusal quality a priority for further work."]
    ]
  },
  memory: {
    title: "Bedrock Memory Assistant",
    label: "Mission 02 / AWS",
    sections: [
      ["The brief", "I wanted an assistant to remember a useful fact from yesterday without sending the entire conversation with every new message."],
      ["How memory works", "Recent turns stay in the active conversation. Longer exchanges become summaries, while extracted facts live in DynamoDB across sessions. Users can trigger a summary themselves."],
      ["Model routing", "The FastAPI service uses Claude Sonnet 4 on Amazon Bedrock for conversation and routes internal operations to Haiku. Prompt caching and adjustable output limits help control inference costs."],
      ["Delivery", "AWS Lambda runs the serverless backend for web and mobile clients. IAM roles control access to Bedrock and DynamoDB."]
    ]
  },
  metro: {
    title: "Chennai Metro Voice Tickets",
    label: "Mission 03 / AWS",
    sections: [
      ["The brief", "I built a WhatsApp booking prototype for 24 Chennai Metro stations. Riders can send a voice note or text in Tamil, Telugu, Hindi or English."],
      ["From voice note to ticket", "Twilio receives the message. Whisper transcribes voice input, then the workflow identifies the origin and destination, calculates a fare and generates a QR ticket."],
      ["Cloud components", "The backend runs on EC2, stores QR images in S3 and writes booking records to DynamoDB. The public repository includes the n8n workflow and Python transcription service."]
    ],
    repo: "https://github.com/Dineshk4rthick/ai-prowered-whatsapp-metro-ticket-booking"
  }
};

const menu = document.querySelector("#nav");
const menuButton = document.querySelector("#menu-button");
function setMenu(open) {
  menu.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
}
menuButton.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
document.querySelector("header").addEventListener("click", event => {
  if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && menu.classList.contains("open")) {
    setMenu(false);
    menuButton.focus();
  }
});

const navLinks = [...menu.querySelectorAll("a")];
const sections = [...document.querySelectorAll("main section[id]")];
function markSection() {
  const current = sections.filter(section => section.getBoundingClientRect().top <= 125).at(-1) || sections[0];
  for (const link of navLinks) {
    if (link.hash === "#" + current.id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("scroll", markSection, {passive: true});
markSection();

const clock = new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false});
function updateClock() {
  document.querySelector("#local-time").textContent = clock.format(new Date()) + " IST";
}
updateClock();
setInterval(updateClock, 15000);

const filterButtons = document.querySelectorAll("[data-filter]");
const cards = document.querySelectorAll("[data-platform]");
for (const button of filterButtons) button.addEventListener("click", () => {
  for (const option of filterButtons) option.setAttribute("aria-pressed", String(option === button));
  let visible = 0;
  for (const card of cards) {
    card.hidden = button.dataset.filter !== "all" && card.dataset.platform !== button.dataset.filter;
    if (!card.hidden) visible++;
  }
  document.querySelector("#filter-status").textContent = visible + (visible === 1 ? " mission shown" : " missions shown");
});

const brief = document.querySelector("#brief");
for (const button of document.querySelectorAll("[data-mission]")) button.addEventListener("click", () => {
  const key = button.dataset.mission;
  const mission = missions[key];
  document.querySelector("#brief-title").textContent = mission.title;
  document.querySelector("#brief-label").textContent = mission.label;
  document.querySelector("#brief-image").src = "assets/" + key + ".webp";
  const content = document.querySelector("#brief-content");
  content.replaceChildren();
  for (const [heading, copy] of mission.sections) {
    const title = document.createElement("h3");
    title.textContent = heading;
    const body = document.createElement("p");
    body.textContent = copy;
    content.append(title, body);
  }
  if (mission.repo) {
    const link = document.createElement("a");
    link.href = mission.repo;
    link.textContent = "View source on GitHub";
    content.append(link);
  }
  if (key === "zoo") {
    const credit = document.createElement("a");
    credit.href = "https://www.lairweb.org.nz/tiger/communication2.html";
    credit.textContent = "Tiger roar courtesy of Tiger Territory";
    credit.className = "sound-credit";
    content.append(credit);
  }
  brief.showModal();
  brief.scrollTop = 0;
});
document.querySelector("#close-brief").addEventListener("click", () => brief.close());
brief.addEventListener("click", event => {
  if (event.target !== brief) return;
  const rect = brief.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) brief.close();
});

// An original four-bar synth loop. Audio is created only on the visitor’s request.
const radio = document.querySelector("#radio-button");
let audio;
let timer;
let step = 0;
let nextNote;
const chords = [[50,57,60,65],[46,53,57,62],[53,60,64,69],[48,55,58,64]];
function tone(pitch, time, length, level, shape) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = shape;
  oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(level, time + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(time);
  oscillator.stop(time + length);
}
function scheduleMusic() {
  while (nextNote < audio.currentTime + 0.25) {
    const chord = chords[Math.floor(step / 8) % chords.length];
    if (step % 8 === 0) for (const pitch of chord) tone(pitch, nextNote, 2.1, 0.018, "sine");
    if (step % 2 === 0) tone(chord[0] - 12, nextNote, 0.4, 0.055, "triangle");
    tone(chord[[0,2,1,3,2,1,3,2][step % 8]] + 12, nextNote, 0.39, 0.022, "sine");
    nextNote += 0.29;
    step++;
  }
}
function radioState(playing) {
  radio.setAttribute("aria-pressed", String(playing));
  radio.setAttribute("aria-label", (playing ? "Stop" : "Play") + " Coastal FM instrumental");
  document.querySelector("#radio-state").textContent = playing ? "On" : "Off";
}
function stopRadio() {
  clearInterval(timer);
  if (audio) audio.close().catch(() => {});
  audio = undefined;
  radioState(false);
}
radio.addEventListener("click", async () => {
  if (audio) return stopRadio();
  try {
    const context = new AudioContext();
    audio = context;
    await context.resume();
    if (audio !== context) return;
    nextNote = audio.currentTime + 0.05;
    step = 0;
    scheduleMusic();
    timer = setInterval(scheduleMusic, 100);
    radioState(true);
  } catch {
    stopRadio();
    document.querySelector("#radio-state").textContent = "Unavailable";
  }
});
document.addEventListener("visibilitychange", () => { if (document.hidden && audio) stopRadio(); });
window.addEventListener("pagehide", stopRadio);
document.addEventListener("coastal-drive-start", () => { if (audio) stopRadio(); });
