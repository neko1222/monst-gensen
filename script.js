const firebaseConfig = {
  apiKey: "AIzaSyBjIdLEBrOIk6JxvYlGiohIJSbMERJWFcY",
  authDomain: "monst-gensen.firebaseapp.com",
  projectId: "monst-gensen",
  storageBucket: "monst-gensen.firebasestorage.app",
  messagingSenderId: "481795048836",
  appId: "1:481795048836:web:e0c450223183688cb009d1",
};

const FRUIT_GROUPS = [
  {
    label: "基本",
    items: [
      "熱き友撃の力",
      "将命削りの力",
      "兵命削りの力",
      "一撃失心の力",
      "ケガ減りの力",
      "速必殺の力",
      "ちび癒しの力",
      "学びの力",
      "荒稼ぎの力",
      "毒がまんの力",
      "スピクリの力",
      "Sランクの力",
      "スコア稼ぎの力",
      "ハート強化の力",
    ],
  },
  {
    label: "同族の絆",
    items: ["同族の絆・加撃", "同族の絆・加命", "同族の絆・加速", "同族の絆・加命撃", "同族の絆・加撃速", "同族の絆・加速命"],
  },
  {
    label: "撃種の絆",
    items: ["撃種の絆・加撃", "撃種の絆・加命", "撃種の絆・加速", "撃種の絆・加命撃", "撃種の絆・加撃速", "撃種の絆・加速命"],
  },
  {
    label: "戦型の絆",
    items: ["戦型の絆・加撃", "戦型の絆・加命", "戦型の絆・加速", "戦型の絆・加命撃", "戦型の絆・加撃速", "戦型の絆・加速命"],
  },
];

const ALL_FRUITS = FRUIT_GROUPS.flatMap((group) => group.items);
const DEFAULT_ACCOUNTS = ["メイン", "サブ"];
const DEFAULT_BULK = ["熱き友撃の力", "ケガ減りの力", "将命削りの力", "同族の絆・加撃", "撃種の絆・加撃", "戦型の絆・加撃"];

let collection;
let doc;
let addDoc;
let updateDoc;
let deleteDoc;
let onSnapshot;
let query;
let orderBy;
let serverTimestamp;
let writeBatch;
let setDoc;
let db = null;

let characters = [];
let appConfig = {
  accounts: [...DEFAULT_ACCOUNTS],
  bulkFruits: [...DEFAULT_BULK],
};
let settingsDirty = false;

const els = {
  banner: document.getElementById("banner"),
  tabs: document.querySelectorAll("[data-tab]"),
  panels: document.querySelectorAll("[data-panel]"),
  searchInput: document.getElementById("search-input"),
  accountFilter: document.getElementById("account-filter"),
  moveDoneBtn: document.getElementById("move-done-btn"),
  listCount: document.getElementById("list-count"),
  cardGrid: document.getElementById("card-grid"),
  doneSearchInput: document.getElementById("done-search-input"),
  doneAccountFilter: document.getElementById("done-account-filter"),
  doneCount: document.getElementById("done-count"),
  doneGrid: document.getElementById("done-grid"),
  addForm: document.getElementById("add-form"),
  charName: document.getElementById("char-name"),
  accountSelect: document.getElementById("account-select"),
  bulkFruit: document.getElementById("bulk-fruit"),
  bulkApplyBtn: document.getElementById("bulk-apply-btn"),
  fruitSelects: [0, 1, 2, 3].map((index) => document.getElementById(`fruit-${index}`)),
  addMessage: document.getElementById("add-message"),
  accountInput: document.getElementById("account-input"),
  accountAddBtn: document.getElementById("account-add-btn"),
  accountList: document.getElementById("account-list"),
  bulkOptions: document.getElementById("bulk-options"),
  bulkDefaultBtn: document.getElementById("bulk-default-btn"),
  bulkClearBtn: document.getElementById("bulk-clear-btn"),
  saveSettingsBtn: document.getElementById("save-settings-btn"),
  settingsMessage: document.getElementById("settings-message"),
};

function isFirebaseConfigured(config) {
  return Boolean(
    config?.apiKey &&
      config?.projectId &&
      !String(config.apiKey).includes("YOUR_") &&
      !String(config.projectId).includes("YOUR_")
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setMessage(el, text, type) {
  el.textContent = text;
  el.classList.toggle("is-ok", type === "ok");
  el.classList.toggle("is-error", type === "error");
}

function showBanner(text) {
  if (!text) {
    els.banner.hidden = true;
    els.banner.textContent = "";
    return;
  }
  els.banner.hidden = false;
  els.banner.textContent = text;
}

function normalizeAccounts(value) {
  const list = Array.isArray(value) ? value : DEFAULT_ACCOUNTS;
  const unique = [];
  list.forEach((item) => {
    const name = String(item || "").trim();
    if (name && !unique.includes(name)) unique.push(name);
  });
  return unique.length ? unique : [...DEFAULT_ACCOUNTS];
}

function normalizeBulk(value) {
  const list = Array.isArray(value) ? value : DEFAULT_BULK;
  return list.filter((item) => ALL_FRUITS.includes(item));
}

function normalizeFruits(value) {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => (typeof source[index] === "string" ? source[index] : ""));
}

function normalizeChecks(value) {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => Boolean(source[index]));
}

function isComplete(character) {
  return Boolean(character.manualComplete) || normalizeChecks(character.checked).every(Boolean);
}

function fruitLabel(value) {
  return value || "未設定";
}

function showTab(name) {
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  els.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

function fillFruitSelect(select, includeEmpty) {
  const current = select.value;
  const options = includeEmpty ? [["", "未設定"], ...ALL_FRUITS.map((name) => [name, name])] : appConfig.bulkFruits.map((name) => [name, name]);
  select.innerHTML = "";
  if (!includeEmpty && !options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "設定画面で候補を選択";
    select.appendChild(option);
    els.bulkApplyBtn.disabled = true;
    return;
  }
  if (!includeEmpty) els.bulkApplyBtn.disabled = false;
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function syncAccountSelect(select, accounts, keepAllOption) {
  const current = select.value;
  select.innerHTML = "";
  if (keepAllOption) {
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "すべてのアカウント";
    select.appendChild(all);
  }
  accounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account;
    option.textContent = account;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function syncFormOptions() {
  syncAccountSelect(els.accountSelect, appConfig.accounts, false);
  syncAccountSelect(els.accountFilter, appConfig.accounts, true);
  syncAccountSelect(els.doneAccountFilter, appConfig.accounts, true);
  fillFruitSelect(els.bulkFruit, false);
  els.fruitSelects.forEach((select) => fillFruitSelect(select, true));
}

function renderAccountChips() {
  els.accountList.innerHTML = appConfig.accounts
    .map(
      (account) => `
      <li class="chip">
        <span>${escapeHtml(account)}</span>
        <button type="button" data-remove-account="${escapeHtml(account)}" aria-label="${escapeHtml(account)}を削除">×</button>
      </li>`
    )
    .join("");
}

function renderBulkOptions() {
  const selected = new Set(appConfig.bulkFruits);
  els.bulkOptions.innerHTML = FRUIT_GROUPS.map(
    (group) => `
      <div class="check-group">
        <h3>${escapeHtml(group.label)}</h3>
        ${group.items
          .map(
            (item) => `
            <label class="check-item">
              <input type="checkbox" value="${escapeHtml(item)}" ${selected.has(item) ? "checked" : ""} />
              <span>${escapeHtml(item)}</span>
            </label>`
          )
          .join("")}
      </div>`
  ).join("");
}

function renderSettingsForm() {
  renderAccountChips();
  renderBulkOptions();
}

function selectedBulkFromForm() {
  return [...els.bulkOptions.querySelectorAll("input:checked")].map((input) => input.value);
}

function applyBulkSelection(names, checked) {
  els.bulkOptions.querySelectorAll("input").forEach((input) => {
    if (!names || names.includes(input.value)) input.checked = checked;
  });
  settingsDirty = true;
}

function matchesFilter(character, keyword, account) {
  const name = String(character.name || "").toLowerCase();
  const accountOk = !account || character.account === account;
  return name.includes(keyword) && accountOk;
}

function cardHtml(character, archivedView) {
  const fruits = normalizeFruits(character.fruits);
  const checks = normalizeChecks(character.checked);
  const complete = isComplete(character);
  const rows = fruits
    .map((fruit, index) => {
      const checked = checks[index];
      return `
        <label class="fruit-row${checked ? " is-checked" : ""}">
          <input type="checkbox" data-action="check" data-id="${escapeHtml(character.id)}" data-index="${index}" ${checked ? "checked" : ""} />
          <span class="fruit-index">${index + 1}</span>
          <span>${escapeHtml(fruitLabel(fruit))}</span>
        </label>`;
    })
    .join("");

  const primaryLabel = archivedView ? "一覧に戻す" : complete ? "完了を解除" : "厳選完了！";
  const primaryAction = archivedView ? "restore" : "toggle-complete";

  return `
    <article class="card${complete ? " is-complete" : ""}">
      <div class="card-head">
        <div>
          <h3 class="card-name">${escapeHtml(character.name || "名称未設定")}</h3>
          <span class="account-tag">${escapeHtml(character.account || "未設定")}</span>
          <span class="status-tag${complete ? " is-on" : ""}">${complete ? "厳選完了" : "厳選中"}</span>
        </div>
      </div>
      <div class="fruit-list">${rows}</div>
      <div class="card-actions">
        <button type="button" class="btn ${complete && !archivedView ? "btn-ghost" : "btn-primary"}" data-action="${primaryAction}" data-id="${escapeHtml(character.id)}">${primaryLabel}</button>
        <button type="button" class="btn btn-danger" data-action="delete" data-id="${escapeHtml(character.id)}">削除</button>
      </div>
    </article>`;
}

function renderList(charactersSource, grid, countEl, keyword, account, archivedView) {
  const visible = charactersSource.filter((character) => matchesFilter(character, keyword, account));
  countEl.textContent = `${visible.length} 件`;
  if (!visible.length) {
    grid.innerHTML = `<div class="empty">${charactersSource.length ? "条件に一致するキャラはいません。" : archivedView ? "厳選済のキャラはまだいません。" : "まだキャラがありません。追加画面から登録してください。"}</div>`;
    return;
  }
  grid.innerHTML = visible.map((character) => cardHtml(character, archivedView)).join("");
}

function render() {
  const active = characters.filter((character) => !character.archived);
  const archived = characters.filter((character) => character.archived);
  const readyCount = active.filter((character) => isComplete(character)).length;
  els.moveDoneBtn.textContent = `厳選済を移動（${readyCount}）`;
  renderList(
    active,
    els.cardGrid,
    els.listCount,
    els.searchInput.value.trim().toLowerCase(),
    els.accountFilter.value,
    false
  );
  renderList(
    archived,
    els.doneGrid,
    els.doneCount,
    els.doneSearchInput.value.trim().toLowerCase(),
    els.doneAccountFilter.value,
    true
  );
}

function requireDb() {
  if (db) return true;
  showBanner("Firebase が未設定です。script.js 先頭の firebaseConfig を入力してください。");
  return false;
}

async function saveConfig() {
  appConfig = {
    accounts: normalizeAccounts(appConfig.accounts),
    bulkFruits: normalizeBulk(selectedBulkFromForm()),
  };
  syncFormOptions();
  renderSettingsForm();
  settingsDirty = false;
  if (!db) {
    setMessage(els.settingsMessage, "画面には反映しました。Firestore へ保存するには firebaseConfig を設定してください。", "error");
    return;
  }
  await setDoc(doc(db, "appConfig", "main"), appConfig, { merge: true });
  setMessage(els.settingsMessage, "設定を保存しました。", "ok");
}

function applyRemoteConfig(data) {
  appConfig = {
    accounts: normalizeAccounts(data?.accounts),
    bulkFruits: normalizeBulk(data?.bulkFruits?.length ? data.bulkFruits : DEFAULT_BULK),
  };
  syncFormOptions();
  if (!settingsDirty) renderSettingsForm();
  render();
}

async function addCharacter(event) {
  event.preventDefault();
  if (!requireDb()) {
    setMessage(els.addMessage, "Firebase 未設定のため保存できません。", "error");
    return;
  }
  const name = els.charName.value.trim();
  const account = els.accountSelect.value;
  if (!name || !account) {
    setMessage(els.addMessage, "キャラ名とアカウントを入力してください。", "error");
    return;
  }
  const submitBtn = els.addForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setMessage(els.addMessage, "保存中…");
  try {
    await addDoc(collection(db, "characters"), {
      name,
      account,
      fruits: els.fruitSelects.map((select) => select.value),
      checked: [false, false, false, false],
      manualComplete: false,
      archived: false,
      createdAt: serverTimestamp(),
    });
    els.addForm.reset();
    syncFormOptions();
    setMessage(els.addMessage, "追加しました。一覧を更新しました。", "ok");
    showTab("list");
  } catch (error) {
    setMessage(els.addMessage, `追加に失敗しました: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function updateCharacter(id, patch) {
  const current = characters.find((character) => character.id === id);
  if (!current || !requireDb()) return;
  const previous = { ...current, fruits: [...normalizeFruits(current.fruits)], checked: [...normalizeChecks(current.checked)] };
  Object.assign(current, patch);
  render();
  try {
    await updateDoc(doc(db, "characters", id), patch);
  } catch (error) {
    Object.assign(current, previous);
    render();
    window.alert(`更新に失敗しました: ${error.message}`);
  }
}

async function toggleCheck(id, index, checked) {
  const character = characters.find((item) => item.id === id);
  if (!character) return;
  const checks = normalizeChecks(character.checked);
  checks[index] = checked;
  await updateCharacter(id, { checked: checks });
}

async function toggleComplete(id) {
  const character = characters.find((item) => item.id === id);
  if (!character) return;
  if (isComplete(character)) {
    await updateCharacter(id, {
      manualComplete: false,
      checked: [false, false, false, false],
    });
    return;
  }
  await updateCharacter(id, { manualComplete: true });
}

async function moveCompleted() {
  if (!requireDb()) return;
  const targets = characters.filter((character) => !character.archived && isComplete(character));
  if (!targets.length) {
    window.alert("移動できる厳選完了キャラはいません。");
    return;
  }
  if (!window.confirm(`厳選完了の${targets.length}件を厳選済一覧へ移動します。`)) return;
  const batch = writeBatch(db);
  targets.forEach((character) => {
    batch.update(doc(db, "characters", character.id), { archived: true });
  });
  try {
    await batch.commit();
    showTab("done");
  } catch (error) {
    window.alert(`移動に失敗しました: ${error.message}`);
  }
}

async function deleteCharacter(id) {
  const character = characters.find((item) => item.id === id);
  if (!character || !requireDb()) return;
  if (!window.confirm(`「${character.name || "このキャラ"}」を削除しますか？`)) return;
  try {
    await deleteDoc(doc(db, "characters", id));
  } catch (error) {
    window.alert(`削除に失敗しました: ${error.message}`);
  }
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => showTab(tab.dataset.tab));
  });

  els.searchInput.addEventListener("input", render);
  els.doneSearchInput.addEventListener("input", render);
  els.accountFilter.addEventListener("change", render);
  els.doneAccountFilter.addEventListener("change", render);
  els.moveDoneBtn.addEventListener("click", moveCompleted);
  els.addForm.addEventListener("submit", addCharacter);

  els.bulkApplyBtn.addEventListener("click", () => {
    const value = els.bulkFruit.value;
    if (!value) return;
    els.fruitSelects.forEach((select) => {
      select.value = value;
    });
  });

  els.accountAddBtn.addEventListener("click", () => {
    const name = els.accountInput.value.trim();
    if (!name) return;
    if (!appConfig.accounts.includes(name)) {
      appConfig.accounts.push(name);
      settingsDirty = true;
      syncFormOptions();
      renderAccountChips();
    }
    els.accountInput.value = "";
  });

  els.accountList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-account]");
    if (!button) return;
    const name = button.dataset.removeAccount;
    appConfig.accounts = appConfig.accounts.filter((account) => account !== name);
    if (!appConfig.accounts.length) appConfig.accounts = [...DEFAULT_ACCOUNTS];
    settingsDirty = true;
    syncFormOptions();
    renderAccountChips();
  });

  els.bulkOptions.addEventListener("change", () => {
    settingsDirty = true;
  });
  els.bulkDefaultBtn.addEventListener("click", () => {
    els.bulkOptions.querySelectorAll("input").forEach((input) => {
      input.checked = DEFAULT_BULK.includes(input.value);
    });
    settingsDirty = true;
  });
  els.bulkClearBtn.addEventListener("click", () => applyBulkSelection(null, false));
  els.saveSettingsBtn.addEventListener("click", () => {
    saveConfig().catch((error) => {
      setMessage(els.settingsMessage, `保存に失敗しました: ${error.message}`, "error");
    });
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.dataset.action === "check") return;
    const id = button.dataset.id;
    if (!id) return;
    if (button.dataset.action === "toggle-complete") toggleComplete(id);
    if (button.dataset.action === "restore") updateCharacter(id, { archived: false });
    if (button.dataset.action === "delete") deleteCharacter(id);
  });

  document.body.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.action !== "check") return;
    toggleCheck(input.dataset.id, Number(input.dataset.index), input.checked);
  });
}

function subscribe() {
  onSnapshot(
    doc(db, "appConfig", "main"),
    (snapshot) => {
      applyRemoteConfig(snapshot.exists() ? snapshot.data() : null);
    },
    (error) => {
      showBanner(`設定の読み込みに失敗しました: ${error.message}`);
    }
  );

  onSnapshot(
    query(collection(db, "characters"), orderBy("createdAt", "desc")),
    (snapshot) => {
      characters = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      showBanner("");
      render();
    },
    (error) => {
      showBanner(`一覧の読み込みに失敗しました: ${error.message}`);
    }
  );
}

async function initFirebase() {
  if (!isFirebaseConfigured(firebaseConfig)) {
    showBanner("script.js 先頭の firebaseConfig を、Firebase プロジェクトの値に差し替えてください。");
    return;
  }
  const appModule = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
  ({ collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, setDoc } =
    firestoreModule);
  const app = appModule.initializeApp(firebaseConfig);
  db = firestoreModule.getFirestore(app);
  subscribe();
}

function init() {
  syncFormOptions();
  renderSettingsForm();
  render();
  bindEvents();
  initFirebase().catch((error) => {
    showBanner(`Firebase の初期化に失敗しました: ${error.message}`);
  });
}

init();
