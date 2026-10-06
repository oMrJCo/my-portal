const API_URL =
  "https://script.google.com/macros/s/AKfycbxcIKJlImEKiqOi2dAaHimmYIpOBGtSBEUKh_FNwWu6bQTdeQchaJzmpIQj7n0p_vBY/exec";

const CACHE_KEY = "myPortalOnline.v1";
const SYNC_INTERVAL = 10000;

let apps = [];
let editingIndex = null;
let busy = false;
let syncing = false;
let lastSnapshot = "";

const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const dialog = document.querySelector("#appDialog");
const form = document.querySelector("#appForm");
const nameInput = document.querySelector("#nameInput");
const urlInput = document.querySelector("#urlInput");
const dialogTitle = document.querySelector("#dialogTitle");
const addBtn = document.querySelector("#addBtn");
const emptyAddBtn = document.querySelector("#emptyAddBtn");
const closeBtn = document.querySelector("#closeBtn");
const cancelBtn = document.querySelector("#cancelBtn");
const submitBtn = form.querySelector('button[type="submit"]');

function safeUrl(url) {
  if (!url) return "#";
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "#";
  } catch {
    return "#";
  }
}

function displayHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "";
  }
}

function normalizeApps(value) {
  return Array.isArray(value)
    ? value.map(app => ({
        id: String(app?.id || ""),
        name: String(app?.name || ""),
        url: String(app?.url || "")
      }))
    : [];
}

function snapshot(value) {
  return JSON.stringify(normalizeApps(value));
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(apps));
  } catch {}
}

function loadCache() {
  try {
    return normalizeApps(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function applyApps(nextApps, force = false) {
  const normalized = normalizeApps(nextApps);
  const nextSnapshot = snapshot(normalized);

  if (!force && nextSnapshot === lastSnapshot) return false;

  apps = normalized;
  lastSnapshot = nextSnapshot;
  saveCache();
  render();
  return true;
}

function setBusy(state) {
  busy = state;
  addBtn.disabled = state;
  emptyAddBtn.disabled = state;
  submitBtn.disabled = state;
  submitBtn.textContent = state ? "กำลังบันทึก..." : "บันทึก";
}

function request(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "__portal_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);

    const script = document.createElement("script");
    let finished = false;

    const query = new URLSearchParams({
      action,
      callback: callbackName,
      t: Date.now(),
      ...params
    });

    const timeout = setTimeout(() => {
      finish();
      reject(new Error("เชื่อมต่อข้อมูลกลางไม่ได้"));
    }, 12000);

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      try { delete window[callbackName]; } catch {}
      script.remove();
    }

    window[callbackName] = result => {
      finish();

      if (result && result.success) {
        resolve(result);
      } else {
        reject(new Error(result?.message || "ดำเนินการไม่สำเร็จ"));
      }
    };

    script.onerror = () => {
      finish();
      reject(new Error("เชื่อมต่อข้อมูลกลางไม่ได้"));
    };

    script.src = API_URL + "?" + query.toString();
    document.head.appendChild(script);
  });
}

async function syncApps({ silent = true } = {}) {
  if (syncing || busy) return;

  syncing = true;

  try {
    const result = await request("list");
    applyApps(result.apps);
  } catch (error) {
    console.error("Portal sync:", error);

    if (!silent && apps.length === 0) {
      alert("โหลดข้อมูลไม่สำเร็จ\n" + error.message);
    }
  } finally {
    syncing = false;
  }
}

function render() {
  grid.innerHTML = "";

  const hasApps = apps.length > 0;
  empty.hidden = hasApps;
  grid.hidden = !hasApps;

  apps.forEach((app, index) => {
    const card = document.createElement("article");
    card.className = "card";

    const link = document.createElement("a");
    link.className = "card-link";

    const href = safeUrl(app.url);
    link.href = href;

    if (href !== "#") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    const title = document.createElement("h3");
    title.textContent = app.name;

    const url = document.createElement("p");
    url.className = "url";
    url.textContent = displayHost(app.url);

    const open = document.createElement("span");
    open.className = "open";
    open.textContent = href === "#" ? "รอใส่ลิงก์" : "เปิดระบบ ↗";

    link.append(title, url, open);

    const more = document.createElement("button");
    more.className = "more";
    more.type = "button";
    more.textContent = "⋯";
    more.setAttribute("aria-label", "จัดการ " + app.name);

    more.onclick = event => {
      event.stopPropagation();
      closeMenus();

      const menu = document.createElement("div");
      menu.className = "menu";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "แก้ไข";
      edit.onclick = () => {
        closeMenus();
        openDialog(index);
      };

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "ลบ";
      del.className = "danger";
      del.onclick = () => {
        closeMenus();
        deleteApp(index);
      };

      menu.append(edit, del);
      card.appendChild(menu);
    };

    card.append(link, more);
    grid.appendChild(card);
  });
}

function closeMenus() {
  document.querySelectorAll(".menu").forEach(menu => menu.remove());
}

function openDialog(index = null) {
  closeMenus();
  editingIndex = index;

  if (index === null) {
    dialogTitle.textContent = "เพิ่มปุ่ม";
    nameInput.value = "";
    urlInput.value = "";
  } else {
    dialogTitle.textContent = "แก้ไขปุ่ม";
    nameInput.value = apps[index]?.name || "";
    urlInput.value = apps[index]?.url || "";
  }

  dialog.showModal();
  setTimeout(() => nameInput.focus(), 50);
}

function closeDialog() {
  if (dialog.open) dialog.close();
  editingIndex = null;
}

async function deleteApp(index) {
  const app = apps[index];
  if (!app || busy) return;

  if (!confirm(`ลบ "${app.name}" ออกจาก Portal?`)) return;

  setBusy(true);

  try {
    const result = await request("delete", { id: app.id });
    applyApps(result.apps, true);
  } catch (error) {
    alert("ลบไม่สำเร็จ\n" + error.message);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name) {
    alert("กรุณาใส่ชื่อปุ่ม");
    return;
  }

  if (!url || safeUrl(url) === "#") {
    alert("กรุณาใส่ Link ที่ขึ้นต้นด้วย http:// หรือ https://");
    return;
  }

  setBusy(true);

  try {
    let result;

    if (editingIndex === null) {
      result = await request("add", { name, url });
    } else {
      const app = apps[editingIndex];

      if (!app?.id) throw new Error("ไม่พบรายการที่ต้องการแก้ไข");

      result = await request("update", {
        id: app.id,
        name,
        url
      });
    }

    applyApps(result.apps, true);
    closeDialog();
  } catch (error) {
    alert("บันทึกไม่สำเร็จ\n" + error.message);
  } finally {
    setBusy(false);
  }
});

addBtn.onclick = () => openDialog();
emptyAddBtn.onclick = () => openDialog();
closeBtn.onclick = closeDialog;
cancelBtn.onclick = closeDialog;

document.addEventListener("click", event => {
  if (!event.target.closest(".more") && !event.target.closest(".menu")) {
    closeMenus();
  }
});

/*
  Cache มีไว้ให้หน้าเปิดเร็วเท่านั้น
  Google Sheet / Apps Script คือข้อมูลจริง
*/
apps = loadCache();
lastSnapshot = snapshot(apps);
render();

/* เปิดหน้าแล้ว Sync ข้อมูลจริงทันที */
syncApps({ silent: apps.length > 0 });

/*
  Sync เบา ๆ ทุก 10 วินาทีเมื่อหน้าเปิดอยู่
  ถ้าข้อมูลไม่เปลี่ยนจะไม่ render ใหม่ จึงไม่กระพริบ/รีเฟรช
*/
setInterval(() => {
  if (!document.hidden && !dialog.open) {
    syncApps();
  }
}, SYNC_INTERVAL);

/*
  กลับมาจากอีกแอป/อีกแท็บ Sync ครั้งเดียว
  ใช้ visibilitychange แทน focus เพื่อไม่ยิงซ้ำทุกครั้งที่คลิก
*/
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !dialog.open) {
    syncApps();
  }
});
