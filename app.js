const SUPABASE_URL = "https://dxlngxkuggbgdzmithzx.supabase.co";
const SUPABASE_KEY = "sb_publishable_sqAwuko-g-Kgzp51YyMT3g_gIAwtEan";
const TABLE = "portal_apps";
const CACHE_KEY = "myPortalSupabase.v1";

let apps = [];
let editingId = null;
let busy = false;
let syncTimer = null;

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
  try { return new URL(url).hostname; }
  catch { return url || ""; }
}

function normalize(value) {
  return Array.isArray(value) ? value.map(x => ({
    id: String(x.id || ""),
    name: String(x.name || ""),
    url: String(x.url || ""),
    sort_order: Number(x.sort_order || 0)
  })) : [];
}

function saveCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(apps)); } catch {}
}

function loadCache() {
  try { return normalize(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")); }
  catch { return []; }
}

function sameApps(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function applyApps(next, force = false) {
  const normalized = normalize(next);
  if (!force && sameApps(apps, normalized)) return;
  apps = normalized;
  saveCache();
  render();
}

function setBusy(state) {
  busy = state;
  addBtn.disabled = state;
  emptyAddBtn.disabled = state;
  submitBtn.disabled = state;
  submitBtn.textContent = state ? "กำลังบันทึก..." : "บันทึก";
}

async function api(path = "", options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}${path}`,
    {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        ...options.headers
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    let message = "เชื่อมต่อข้อมูลกลางไม่ได้";
    try {
      const body = await response.json();
      message = body.message || body.details || message;
    } catch {}
    throw new Error(message);
  }

  if (response.status === 204) return [];
  return response.json();
}

async function loadApps({ quiet = true } = {}) {
  try {
    const rows = await api("?select=id,name,url,sort_order&order=sort_order.asc,created_at.asc");
    applyApps(rows);
  } catch (error) {
    console.error("Portal sync:", error);
    if (!quiet && apps.length === 0) {
      alert("โหลดข้อมูลไม่สำเร็จ\n" + error.message);
    }
  }
}

async function createApp(name, url) {
  return api("", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name,
      url,
      sort_order: apps.length
    })
  });
}

async function updateApp(id, name, url) {
  return api("?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name, url })
  });
}

async function removeApp(id) {
  return api("?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
}

function render() {
  grid.innerHTML = "";

  const hasApps = apps.length > 0;
  empty.hidden = hasApps;
  grid.hidden = !hasApps;

  apps.forEach(app => {
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
        openDialog(app.id);
      };

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "ลบ";
      del.className = "danger";
      del.onclick = () => {
        closeMenus();
        deleteApp(app.id);
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

function openDialog(id = null) {
  closeMenus();
  editingId = id;

  if (!id) {
    dialogTitle.textContent = "เพิ่มปุ่ม";
    nameInput.value = "";
    urlInput.value = "";
  } else {
    const app = apps.find(x => x.id === id);
    dialogTitle.textContent = "แก้ไขปุ่ม";
    nameInput.value = app?.name || "";
    urlInput.value = app?.url || "";
  }

  dialog.showModal();
  setTimeout(() => nameInput.focus(), 50);
}

function closeDialog() {
  if (dialog.open) dialog.close();
  editingId = null;
}

async function deleteApp(id) {
  const app = apps.find(x => x.id === id);
  if (!app || busy) return;

  if (!confirm(`ลบ "${app.name}" ออกจาก Portal?`)) return;

  setBusy(true);
  try {
    await removeApp(id);
    applyApps(apps.filter(x => x.id !== id), true);
    await loadApps();
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
    if (!editingId) {
      const rows = await createApp(name, url);
      if (rows[0]) applyApps([...apps, rows[0]], true);
    } else {
      const rows = await updateApp(editingId, name, url);
      if (rows[0]) {
        applyApps(apps.map(x => x.id === editingId ? rows[0] : x), true);
      }
    }

    closeDialog();
    await loadApps();
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
  เปิดเร็วด้วย cache แต่ Supabase คือข้อมูลจริง
*/
apps = loadCache();
render();
loadApps({ quiet: apps.length > 0 });

/*
  Supabase Realtime ผ่าน WebSocket โดยไม่ใช้ Apps Script/JSONP
  เมื่อเครื่องไหนแก้ข้อมูล เครื่องอื่นจะ reload เฉพาะข้อมูล ไม่ reload หน้า
*/
function startRealtime() {
  const wsUrl =
    SUPABASE_URL.replace("https://", "wss://") +
    "/realtime/v1/websocket?apikey=" +
    encodeURIComponent(SUPABASE_KEY) +
    "&vsn=1.0.0";

  let socket;
  let heartbeat;
  let reconnect;

  const connect = () => {
    clearTimeout(reconnect);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        topic: "realtime:public:portal_apps",
        event: "phx_join",
        payload: {
          config: {
            broadcast: { self: false },
            presence: { key: "" },
            postgres_changes: [{
              event: "*",
              schema: "public",
              table: "portal_apps"
            }]
          },
          access_token: SUPABASE_KEY
        },
        ref: "1"
      }));

      clearInterval(heartbeat);
      heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            topic: "phoenix",
            event: "heartbeat",
            payload: {},
            ref: String(Date.now())
          }));
        }
      }, 25000);
    };

    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.event === "postgres_changes") {
          clearTimeout(syncTimer);
          syncTimer = setTimeout(() => loadApps(), 120);
        }
      } catch {}
    };

    socket.onclose = () => {
      clearInterval(heartbeat);
      reconnect = setTimeout(connect, 3000);
    };

    socket.onerror = () => socket.close();
  };

  connect();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadApps();
  });
}

startRealtime();
