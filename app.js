const API_URL = "https://script.google.com/macros/s/AKfycbxcIKJlImEKiqOi2dAaHimmYIpOBGtSBEUKh_FNwWu6bQTdeQchaJzmpIQj7n0p_vBY/exec";

const STORAGE_KEY = "myPortalApps.v1";
const CACHE_KEY = "myPortalApps.cloudCache.v1";

let apps = [];
let editingIndex = null;
let isLoading = false;

const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const dialog = document.querySelector("#appDialog");
const form = document.querySelector("#appForm");
const nameInput = document.querySelector("#nameInput");
const urlInput = document.querySelector("#urlInput");
const dialogTitle = document.querySelector("#dialogTitle");

function safeUrl(url) {
  if (!url || url === "#") return "#";

  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
}

function displayHost(url) {
  if (!url || url === "#") return "ยังไม่ได้ใส่ลิงก์";

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(apps));
}

function loadCache() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadOldLocalApps() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function setLoading(value) {
  isLoading = value;

  const addBtn = document.querySelector("#addBtn");

  if (addBtn) {
    addBtn.disabled = value;
    addBtn.textContent = value ? "กำลังโหลด..." : "＋ เพิ่มปุ่ม";
  }
}

async function apiGet() {
  const response = await fetch(`${API_URL}?action=list&t=${Date.now()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("โหลดข้อมูลไม่สำเร็จ");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "โหลดข้อมูลไม่สำเร็จ");
  }

  return Array.isArray(result.apps) ? result.apps : [];
}

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("บันทึกข้อมูลไม่สำเร็จ");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");
  }

  return result;
}

function askPin() {
  const pin = prompt("ใส่รหัส Admin");

  if (pin === null) return null;

  return pin.trim();
}

async function refreshApps(showError = true) {
  setLoading(true);

  try {
    apps = await apiGet();
    saveCache();
    render();
    return true;
  } catch (err) {
    apps = loadCache();
    render();

    if (showError) {
      alert(
        apps.length
          ? "เชื่อมต่อข้อมูลกลางไม่ได้ กำลังแสดงข้อมูลล่าสุดที่เคยโหลดไว้"
          : `โหลดข้อมูลไม่สำเร็จ\n${err.message}`
      );
    }

    return false;
  } finally {
    setLoading(false);
  }
}

async function migrateOldLocalDataIfNeeded() {
  const oldApps = loadOldLocalApps();

  if (apps.length !== 0 || oldApps.length === 0) return;

  const realApps = oldApps.filter(
    item =>
      item &&
      item.name &&
      item.url &&
      item.url !== "#" &&
      safeUrl(item.url) !== "#"
  );

  if (realApps.length === 0) return;

  const ok = confirm(
    `พบรายการเดิมในเครื่องนี้ ${realApps.length} รายการ\n\nต้องการย้ายขึ้น Portal กลางเพื่อให้ทุกเครื่องเห็นเหมือนกันไหม?`
  );

  if (!ok) return;

  const pin = askPin();

  if (!pin) return;

  setLoading(true);

  try {
    for (const item of realApps) {
      await apiPost({
        action: "add",
        pin,
        name: item.name.trim(),
        url: item.url.trim()
      });
    }

    apps = await apiGet();
    saveCache();
    localStorage.removeItem(STORAGE_KEY);
    render();

    alert(`ย้ายข้อมูลขึ้นระบบกลางแล้ว ${realApps.length} รายการ`);
  } catch (err) {
    alert(`ย้ายข้อมูลไม่สำเร็จ\n${err.message}`);
  } finally {
    setLoading(false);
  }
}

function render() {
  grid.innerHTML = "";

  empty.hidden = apps.length !== 0;
  grid.hidden = apps.length === 0;

  apps.forEach((app, i) => {
    const card = document.createElement("article");
    card.className = "card";

    const href = safeUrl(app.url);

    const link = document.createElement("a");
    link.className = "card-link";
    link.href = href;

    if (href !== "#") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    link.innerHTML = `
      <h3></h3>
      <p class="url"></p>
      <span class="open">
        ${href === "#" ? "รอใส่ลิงก์" : "เปิดระบบ ↗"}
      </span>
    `;

    link.querySelector("h3").textContent = app.name;
    link.querySelector(".url").textContent = displayHost(app.url);

    const more = document.createElement("button");
    more.className = "more";
    more.type = "button";
    more.textContent = "⋯";
    more.setAttribute("aria-label", `จัดการ ${app.name}`);

    more.onclick = (e) => {
      e.stopPropagation();

      document.querySelectorAll(".menu").forEach(m => m.remove());

      const menu = document.createElement("div");
      menu.className = "menu";

      const edit = document.createElement("button");
      edit.textContent = "แก้ไข";
      edit.onclick = () => openDialog(i);

      const del = document.createElement("button");
      del.textContent = "ลบ";
      del.className = "danger";

      del.onclick = async () => {
        document.querySelectorAll(".menu").forEach(m => m.remove());

        if (!confirm(`ลบ "${app.name}" ออกจาก Portal?`)) return;

        const pin = askPin();

        if (!pin) return;

        setLoading(true);

        try {
          const result = await apiPost({
            action: "delete",
            pin,
            id: app.id
          });

          apps = Array.isArray(result.apps)
            ? result.apps
            : await apiGet();

          saveCache();
          render();
        } catch (err) {
          alert(`ลบไม่สำเร็จ\n${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      menu.append(edit, del);
      card.appendChild(menu);
    };

    card.append(link, more);
    grid.appendChild(card);
  });
}

function openDialog(index = null) {
  document.querySelectorAll(".menu").forEach(m => m.remove());

  editingIndex = index;

  if (index === null) {
    dialogTitle.textContent = "เพิ่มปุ่ม";
    nameInput.value = "";
    urlInput.value = "";
  } else {
    dialogTitle.textContent = "แก้ไขปุ่ม";
    nameInput.value = apps[index].name || "";
    urlInput.value =
      apps[index].url === "#"
        ? ""
        : (apps[index].url || "");
  }

  dialog.showModal();

  setTimeout(() => nameInput.focus(), 50);
}

function closeDialog() {
  dialog.close();
}

document.querySelector("#addBtn").onclick = () => openDialog();
document.querySelector("#emptyAddBtn").onclick = () => openDialog();
document.querySelector("#closeBtn").onclick = closeDialog;
document.querySelector("#cancelBtn").onclick = closeDialog;

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const item = {
    name: nameInput.value.trim(),
    url: urlInput.value.trim()
  };

  if (!item.name || !item.url) return;

  if (safeUrl(item.url) === "#") {
    alert("กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://");
    return;
  }

  const pin = askPin();

  if (!pin) return;

  setLoading(true);

  try {
    let result;

    if (editingIndex === null) {
      result = await apiPost({
        action: "add",
        pin,
        name: item.name,
        url: item.url
      });
    } else {
      result = await apiPost({
        action: "update",
        pin,
        id: apps[editingIndex].id,
        name: item.name,
        url: item.url
      });
    }

    apps = Array.isArray(result.apps)
      ? result.apps
      : await apiGet();

    saveCache();
    render();
    closeDialog();
  } catch (err) {
    alert(`บันทึกไม่สำเร็จ\n${err.message}`);
  } finally {
    setLoading(false);
  }
});

document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".more") &&
    !e.target.closest(".menu")
  ) {
    document.querySelectorAll(".menu").forEach(m => m.remove());
  }
});

window.addEventListener("focus", () => {
  if (!isLoading) {
    refreshApps(false);
  }
});

async function init() {
  apps = loadCache();
  render();

  const connected = await refreshApps(false);

  if (connected) {
    await migrateOldLocalDataIfNeeded();
  }
}

init();
