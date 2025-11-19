/* ==========================================================
   ProdDash - script.js
   Full UI interactions, persistence, and Pomodoro engine
   Author: Raien
   ========================================================== */

/* ---------------------------
   Utilities & Safe selectors
   --------------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const safeGet = (sel) => document.querySelector(sel) || null;

function qs(id) { return safeGet(id); }

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

/* ---------------------------
   Application State
   --------------------------- */
const STATE_KEYS = {
  THEME: "proddash_theme",
  TASKS: "proddash_tasks_v1",
  NOTES: "proddash_notes_v1",
  POMO: "proddash_pomo_v1",
  SETTINGS: "proddash_settings_v1",
  POMO_HISTORY: "proddash_pomo_history_v1"
};

let state = {
  tasks: load(STATE_KEYS.TASKS, []),
  notes: load(STATE_KEYS.NOTES, ""),
  pomo: load(STATE_KEYS.POMO, { mode: "work", minutes: 25, seconds: 0, running: false }),
  settings: load(STATE_KEYS.SETTINGS, { defaultPom: 25, autoStart: false }),
  pomoHistory: load(STATE_KEYS.POMO_HISTORY, []),
  theme: load(STATE_KEYS.THEME, "theme-neon")
};

/* ---------------------------
   DOM ELEMENTS (cached)
   --------------------------- */
const body = qs("#body");
const themeSelect = qs("#theme-select");
const sidebarToggle = qs("#sidebar-toggle");
const navItems = $$("[data-target]");
const taskInput = qs("#taskText") || qs("#task-input");
const taskProject = qs("#task-project");
const addTaskBtn = qs("#addTask") || qs("#add-task");
const taskListEl = qs("#taskList") || qs("#task-list");
const taskCountEl = qs("#task-count");
const filters = $$("[data-filter]");
const newTaskBtn = qs("#new-task-btn");
const noteText = qs("#noteText") || qs("#noteText") || qs("#noteText"); // defensive
const saveNoteBtn = qs("#saveNote");
const yearEl = qs("#year");
const searchInput = qs("#search");

const startPomBtn = qs("#startPom");
const pausePomBtn = qs("#pausePom");
const resetPomBtn = qs("#resetPom");
const shortBreakBtn = qs("#shortBreak");
const longBreakBtn = qs("#longBreak");
const pomTimeEl = qs("#pomodoro-time") || qs("#pomodoro-time");
const circleProgress = document.querySelector(".circle-progress");
const pomHistoryEl = qs("#pomHistory");

const settingsModal = qs("#settingsModal");
const modalCloseBtns = $$(".modal-close");
const settingsSaveBtn = qs("#saveSettings");
const defaultPomInput = qs("#defaultPom");
const autoStartInput = qs("#autoStart");

const quickButtons = $$(".quick-btn");

/* ---------------------------
   Helpers: DOM creation
   --------------------------- */
function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item " + (task.done ? "done" : "todo");
  li.dataset.id = task.id;

  const left = document.createElement("div");
  left.className = "title";
  left.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = task.project || "Inbox";

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";
  right.style.alignItems = "center";

  const doneBtn = document.createElement("button");
  doneBtn.className = "tiny";
  doneBtn.title = "Toggle done";
  doneBtn.textContent = task.done ? "Undo" : "Done";
  doneBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTaskDone(task.id);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "tiny";
  deleteBtn.title = "Delete";
  deleteBtn.textContent = "Del";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeTask(task.id);
  });

  right.appendChild(doneBtn);
  right.appendChild(deleteBtn);

  li.appendChild(left);
  li.appendChild(meta);
  li.appendChild(right);

  li.addEventListener("click", () => {
    // click toggles done for quick UX
    toggleTaskDone(task.id);
  });

  return li;
}

/* ---------------------------
   TASKS: CRUD + rendering
   --------------------------- */
function generateId(prefix = "t") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function addTaskFromInput() {
  const inputEl = taskInput;
  if (!inputEl) return;
  const title = inputEl.value.trim();
  if (!title) return;
  const project = taskProject ? taskProject.value : "inbox";
  const task = {
    id: generateId(),
    title,
    project,
    done: false,
    createdAt: Date.now()
  };
  state.tasks.unshift(task);
  save(STATE_KEYS.TASKS, state.tasks);
  inputEl.value = "";
  renderTasks();
  updateStats();
}

function toggleTaskDone(id) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  state.tasks[idx].done = !state.tasks[idx].done;
  save(STATE_KEYS.TASKS, state.tasks);
  renderTasks();
  updateStats();
}

function removeTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  save(STATE_KEYS.TASKS, state.tasks);
  renderTasks();
  updateStats();
}

function renderTasks(filter = "all") {
  if (!taskListEl) return;
  taskListEl.innerHTML = "";
  let tasksToShow = [...state.tasks];

  if (filter === "active") tasksToShow = tasksToShow.filter(t => !t.done);
  if (filter === "done") tasksToShow = tasksToShow.filter(t => t.done);

  tasksToShow.forEach(t => {
    const el = createTaskElement(t);
    taskListEl.appendChild(el);
  });

  const total = state.tasks.length;
  const open = state.tasks.filter(t => !t.done).length;
  if (taskCountEl) taskCountEl.textContent = `${open} / ${total} tasks`;
}

/* ---------------------------
   NOTES
   --------------------------- */
function saveNotes() {
  const text = noteText ? noteText.value : "";
  state.notes = text;
  save(STATE_KEYS.NOTES, state.notes);
  toast("Notes saved");
  updateStats();
}
function loadNotesToUI() {
  if (!noteText) return;
  noteText.value = state.notes || "";
}

/* ---------------------------
   STATS
   --------------------------- */
function updateStats() {
  // tasks
  const total = state.tasks.length;
  const open = state.tasks.filter(t => !t.done).length;
  const done = total - open;
  const statTasks = qs("#stat-tasks");
  if (statTasks) statTasks.textContent = `${open} / ${total}`;

  // pomodoro focus time today - compute sum of today history
  const today = new Date().toISOString().slice(0,10);
  const todayMinutes = state.pomoHistory
    .filter(h => h.date === today && h.type === "work")
    .reduce((s,v) => s + (v.minutes || 0), 0);
  const statFocus = qs("#stat-focus");
  if (statFocus) statFocus.textContent = `${todayMinutes}m`;

  const statPomos = qs("#stat-pomos");
  if (statPomos) statPomos.textContent = String(state.pomoHistory.filter(h => h.type === "work").length);

  const statNotes = qs("#stat-notes");
  if (statNotes) statNotes.textContent = String(state.notes ? 1 : 0);
}

/* ---------------------------
   THEME & UI
   --------------------------- */
function applyTheme(themeClass) {
  // remove any theme- classes first
  const classes = Array.from(document.body.classList).filter(c => c.startsWith("theme-"));
  classes.forEach(c => document.body.classList.remove(c));
  document.body.classList.add(themeClass);
  save(STATE_KEYS.THEME, themeClass);
  state.theme = themeClass;
  if (themeSelect) {
    // map themeClass to select value
    const mapping = {
      "theme-neon": "neon",
      "theme-purple": "purple",
      "theme-red": "red",
      "theme-blue": "blue",
      "theme-green": "green",
      "theme-light": "light"
    };
    const val = mapping[themeClass] || "neon";
    themeSelect.value = val;
  }
}

/* map select option -> theme class */
function selectToThemeClass(val) {
  switch (val) {
    case "purple": return "theme-purple";
    case "red": return "theme-red";
    case "blue": return "theme-blue";
    case "green": return "theme-green";
    case "light": return "theme-light";
    default: return "theme-neon";
  }
}

/* ---------------------------
   NAV + SIDEBAR
   --------------------------- */
function initNav() {
  navItems.forEach(item => {
    const btn = item;
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      if (!target) return;
      // update active class
      navItems.forEach(n => n.classList.remove("active"));
      btn.classList.add("active");
      // show/hide sections
      // simple approach: scroll to section (or show/hide)
      const section = document.getElementById(target);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
  // sidebar toggle for small screens
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar");
      if (!sidebar) return;
      sidebar.classList.toggle("open");
    });
  }
}

/* ---------------------------
   POMODORO ENGINE
   --------------------------- */
let pomoInterval = null;
let pomoRemaining = 0; // seconds
let pomoMode = "work"; // work, short, long
let pomoDefault = state.settings.defaultPom || 25;

function initPomodoro() {
  // Use saved settings
  pomoDefault = state.settings.defaultPom || 25;
  // set UI
  setPomTime(pomoDefault * 60);
  renderPomHistory();
  updateStats();

  // attach button listeners safely
  if (startPomBtn) startPomBtn.addEventListener("click", startPom);
  if (pausePomBtn) pausePomBtn.addEventListener("click", pausePom);
  if (resetPomBtn) resetPomBtn.addEventListener("click", resetPom);
  if (shortBreakBtn) shortBreakBtn.addEventListener("click", () => startBreak("short"));
  if (longBreakBtn) longBreakBtn.addEventListener("click", () => startBreak("long"));

  // prepare SVG circle
  prepareCircle();
}

function prepareCircle() {
  if (!circleProgress) return;
  const r = circleProgress.r.baseVal.value;
  const circumference = 2 * Math.PI * r;
  circleProgress.style.strokeDasharray = `${circumference} ${circumference}`;
  circleProgress.style.strokeDashoffset = `${circumference}`;
  // set a gradient stroke (fallback uses CSS var)
  // If we want, JS can set stroke color here based on CSS vars
}

function setPomTime(totalSeconds) {
  pomoRemaining = totalSeconds;
  updatePomDisplay();
  updateCircleProgress();
}

function updatePomDisplay() {
  if (!pomTimeEl) return;
  const mm = Math.floor(pomoRemaining / 60);
  const ss = Math.floor(pomoRemaining % 60);
  pomTimeEl.textContent = `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

function updateCircleProgress() {
  if (!circleProgress) return;
  const r = circleProgress.r.baseVal.value;
  const circumference = 2 * Math.PI * r;
  let totalForMode = getSecondsForMode(pomoMode);
  if (totalForMode === 0) totalForMode = 1; // avoid division by zero
  const progress = pomoRemaining / totalForMode;
  const offset = circumference * (1 - progress);
  circleProgress.style.strokeDashoffset = offset;
}

function getSecondsForMode(mode) {
  switch (mode) {
    case "short": return 5 * 60;
    case "long": return 15 * 60;
    case "work": default: return (state.settings.defaultPom || 25) * 60;
  }
}

function tickPom() {
  if (pomoRemaining > 0) {
    pomoRemaining--;
    updatePomDisplay();
    updateCircleProgress();
  } else {
    // finished
    clearInterval(pomoInterval);
    pomoInterval = null;
    onPomComplete();
  }
}

function startPom() {
  if (pomoInterval) return; // already running
  if (pomoRemaining <= 0) {
    // start fresh
    pomoMode = "work";
    setPomTime(getSecondsForMode("work"));
  }
  pomoInterval = setInterval(tickPom, 1000);
  state.pomo.running = true;
  save(STATE_KEYS.POMO, state.pomo);
}

function pausePom() {
  if (pomoInterval) {
    clearInterval(pomoInterval);
    pomoInterval = null;
    state.pomo.running = false;
    save(STATE_KEYS.POMO, state.pomo);
  }
}

function resetPom() {
  pausePom();
  pomoMode = "work";
  setPomTime(getSecondsForMode("work"));
  state.pomo.running = false;
  save(STATE_KEYS.POMO, state.pomo);
}

function startBreak(type) {
  pausePom();
  pomoMode = type === "long" ? "long" : "short";
  setPomTime(getSecondsForMode(pomoMode));
  // auto start if enabled
  if (state.settings.autoStart) startPom();
}

/* on complete behavior */
function onPomComplete() {
  // record history entry
  const minutes = Math.round(getSecondsForMode(pomoMode) / 60);
  const entry = {
    id: generateId("ph"),
    date: new Date().toISOString().slice(0,10),
    time: new Date().toLocaleTimeString(),
    type: pomoMode === "work" ? "work" : "break",
    minutes: pomoMode === "work" ? (getSecondsForMode(pomoMode) / 60) : 0
  };
  // push only if it's a work session
  if (pomoMode === "work") {
    state.pomoHistory.unshift(entry);
    // keep history to last 200
    if (state.pomoHistory.length > 200) state.pomoHistory.pop();
    save(STATE_KEYS.POMO_HISTORY, state.pomoHistory);
    renderPomHistory();
  }

  // notification & audio (simplified)
  try {
    if (Notification && Notification.permission === "granted") {
      new Notification("Pomodoro", { body: "Session ended — good job!" });
    }
  } catch (e) { /* ignore */ }

  // small alert fallback
  alert("Pomodoro complete!");

  // auto-start next depending on settings
  if (state.settings.autoStart) {
    // if finished work -> start short break automatically
    if (pomoMode === "work") {
      pomoMode = "short";
      setPomTime(getSecondsForMode("short"));
      startPom();
    } else {
      // if finished break -> start work
      pomoMode = "work";
      setPomTime(getSecondsForMode("work"));
      startPom();
    }
  } else {
    // stop; set to default work time
    pomoMode = "work";
    setPomTime(getSecondsForMode("work"));
  }

  updateStats();
}

/* render history UI */
function renderPomHistory() {
  if (!pomHistoryEl) return;
  pomHistoryEl.innerHTML = "";
  state.pomoHistory.slice(0, 12).forEach(h => {
    const li = document.createElement("li");
    li.textContent = `${h.date} • ${h.time} • ${h.type} • ${h.minutes || 0}m`;
    pomHistoryEl.appendChild(li);
  });
}

/* ---------------------------
   SETTINGS MODAL
   --------------------------- */
function openSettings() {
  if (!settingsModal) return;
  settingsModal.setAttribute("aria-hidden", "false");
}
function closeSettings() {
  if (!settingsModal) return;
  settingsModal.setAttribute("aria-hidden", "true");
}
function initSettings() {
  // fill settings inputs
  if (defaultPomInput) defaultPomInput.value = state.settings.defaultPom || 25;
  if (autoStartInput) autoStartInput.checked = !!state.settings.autoStart;

  // open modal with new-task button
  if (newTaskBtn) {
    newTaskBtn.addEventListener("click", () => {
      // focus task input
      if (taskInput) taskInput.focus();
    });
  }

  // modal close buttons
  modalCloseBtns.forEach(b => b.addEventListener("click", closeSettings));

  // save settings
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener("click", () => {
      const d = parseInt(defaultPomInput.value, 10) || 25;
      const a = !!autoStartInput.checked;
      state.settings.defaultPom = Math.max(5, Math.min(60, d));
      state.settings.autoStart = a;
      save(STATE_KEYS.SETTINGS, state.settings);
      // apply immediately to pomo
      setPomTime(state.settings.defaultPom * 60);
      toast("Settings saved");
      closeSettings();
    });
  }
}

/* ---------------------------
   SEARCH
   --------------------------- */
function initSearch() {
  if (!searchInput) return;
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    // naive search over tasks & notes
    if (!q) {
      renderTasks();
      return;
    }
    const results = state.tasks.filter(t => t.title.toLowerCase().includes(q) || (t.project || "").toLowerCase().includes(q));
    // render results
    if (!taskListEl) return;
    taskListEl.innerHTML = "";
    results.forEach(r => taskListEl.appendChild(createTaskElement(r)));
  });
}

/* ---------------------------
   QUICK ACTIONS
   --------------------------- */
function initQuickButtons() {
  quickButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes("new task")) {
        if (taskInput) { taskInput.focus(); }
      } else if (txt.includes("start focus")) {
        startPom();
      } else if (txt.includes("save note")) {
        saveNotes();
      } else if (txt.includes("export")) {
        exportData();
      }
    });
  });
}

function exportData() {
  const payload = {
    tasks: state.tasks,
    notes: state.notes,
    pomoHistory: state.pomoHistory,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proddash_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------------------
   TOAST (tiny UX)
   --------------------------- */
let toastTimeout = null;
function toast(msg) {
  let t = qs("#pd-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "pd-toast";
    t.style.position = "fixed";
    t.style.right = "18px";
    t.style.bottom = "18px";
    t.style.padding = "10px 14px";
    t.style.borderRadius = "8px";
    t.style.background = "linear-gradient(90deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4))";
    t.style.color = "white";
    t.style.boxShadow = "0 8px 24px rgba(0,0,0,0.6)";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    t.style.opacity = "0";
  }, 1800);
}

/* ---------------------------
   BOOT & INIT
   --------------------------- */
function initApp() {
  // set footer year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // apply saved theme
  const savedTheme = load(STATE_KEYS.THEME, state.theme);
  applyTheme(savedTheme || state.theme);

  // theme select change
  if (themeSelect) {
    themeSelect.value = (savedTheme && savedTheme.replace("theme-","")) || "neon";
    themeSelect.addEventListener("change", (e) => {
      applyTheme(selectToThemeClass(e.target.value));
    });
  }

  // tasks UI
  renderTasks();
  updateStats();

  // hook add task
  if (addTaskBtn) addTaskBtn.addEventListener("click", addTaskFromInput);
  if (taskInput) taskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addTaskFromInput();
  });

  // filter buttons
  filters.forEach(f => f.addEventListener("click", () => {
    const filter = f.dataset.filter;
    renderTasks(filter || "all");
  }));

  // save notes
  if (saveNoteBtn) saveNoteBtn.addEventListener("click", saveNotes);
  loadNotesToUI();

  // settings
  initSettings();

  // nav
  initNav();

  // search
  initSearch();

  // quick actions
  initQuickButtons();

  // pomodoro
  initPomodoro();

  // task count update initially
  renderTasks();

  // attach export via GitHub button (if present)
  const gh = qs("#github-btn");
  if (gh) {
    gh.addEventListener("click", () => {
      window.open("https://github.com/yourusername/productivity-dashboard", "_blank");
    });
  }

  // signout placeholder
  const signout = qs("#signout");
  if (signout) signout.addEventListener("click", () => toast("Signed out (placeholder)"));

  // profile btn
  const profileBtn = qs("#profile-btn");
  if (profileBtn) profileBtn.addEventListener("click", () => toast("Profile menu (placeholder)"));

  // allow modal open via keyboard 's' for settings (convenience)
  document.addEventListener("keydown", (e) => {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openSettings();
    }
  });

  // persist tasks on unload (redundant but safe)
  window.addEventListener("beforeunload", () => {
    save(STATE_KEYS.TASKS, state.tasks);
    save(STATE_KEYS.NOTES, state.notes);
    save(STATE_KEYS.POMO_HISTORY, state.pomoHistory);
    save(STATE_KEYS.SETTINGS, state.settings);
    save(STATE_KEYS.THEME, state.theme);
  });
}

/* ---------------------------
   Initialize on DOM ready
   --------------------------- */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
