const API_URL = "https://script.google.com/macros/s/AKfycbxcIKJlImEKiqOi2dAaHimmYIpOBGtSBEUKh_FNwWu6bQTdeQchaJzmpIQj7n0p_vBY/exec";

const CACHE_KEY = "myPortalApps.cloudCache.v2";

// key เก่าที่เคยใช้/อาจเคยใช้
const OLD_LOCAL_KEYS = [
  "myPortalApps.v1",
  "myPortalApps",
  "portalApps",
  "apps"
];

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

    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }

    return "#";
  } catch {
    return "#";
  }
}

function displayHost(url) {
  if (!url || url === "#") {
    return "ยังไม่ได้ใส่ลิงก์";
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
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

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(apps));
  } catch {}
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);

    if (!raw) return [];

    const data = JSON.parse(raw);

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function findOldLocalApps() {
  for (const key of OLD_LOCAL_KEYS) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) continue;

      const data = JSON.parse(raw);

      if (Array.isArray(data) && data.length > 0) {
        return {
          key,
          apps: data
        };
      }
    } catch {}
  }

  return null;
}

function normalizeOldApps(oldApps) {
  if (!Array.isArray(oldApps)) return [];

  return oldApps
    .filter(item => {
      return (
        item &&
        typeof item.name === "string" &&
        item.name.trim() !== ""
      );
    })
    .map(item => ({
      name: item.name.trim(),
      url:
        typeof item.url === "string"
          ? item.url.trim()
          : "#"
    }));
}

async function apiGet() {
  const response = await fetch(
    `${API_URL}?action=list&t=${Date.now()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("โหลดข้อมูลไม่สำเร็จ");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message || "โหลดข้อมูลไม่สำเร็จ"
    );
  }

  return Array.isArray(result.apps)
    ? result.apps
    : [];
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
    throw new Error(
      result.message || "บันทึกข้อมูลไม่สำเร็จ"
    );
  }

  return result;
}

function askPin() {
  const pin = prompt("ใส่รหัส Admin");

  if (pin === null) return null;

  return pin.trim();
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
      <span class="open"></span>
    `;

    link.querySelector("h3").textContent =
      app.name;

    link.querySelector(".url").textContent =
      displayHost(app.url);

    link.querySelector(".open").textContent =
      href === "#"
        ? "รอใส่ลิงก์"
        : "เปิดระบบ ↗";

    const more =
      document.createElement("button");

    more.className = "more";
    more.type = "button";
    more.textContent = "⋯";

    more.setAttribute(
      "aria-label",
      `จัดการ ${app.name}`
    );

    more.onclick = e => {
      e.stopPropagation();

      document
        .querySelectorAll(".menu")
        .forEach(menu => menu.remove());

      const menu =
        document.createElement("div");

      menu.className = "menu";

      const edit =
        document.createElement("button");

      edit.textContent = "แก้ไข";

      edit.onclick = () => {
        openDialog(i);
      };

      const del =
        document.createElement("button");

      del.textContent = "ลบ";
      del.className = "danger";

      del.onclick = async () => {
        document
          .querySelectorAll(".menu")
          .forEach(menu => menu.remove());

        if (
          !confirm(
            `ลบ "${app.name}" ออกจาก Portal?`
          )
        ) {
          return;
        }

        if (!app.id) {
          alert(
            "รายการนี้ยังไม่ได้ Sync ขึ้นระบบกลาง"
          );
          return;
        }

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
          alert(
            `ลบไม่สำเร็จ\n${err.message}`
          );
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
  document
    .querySelectorAll(".menu")
    .forEach(menu => menu.remove());

  editingIndex = index;

  if (index === null) {
    dialogTitle.textContent = "เพิ่มปุ่ม";

    nameInput.value = "";
    urlInput.value = "";
  } else {
    dialogTitle.textContent = "แก้ไขปุ่ม";

    nameInput.value =
      apps[index].name || "";

    urlInput.value =
      apps[index].url === "#"
        ? ""
        : apps[index].url || "";
  }

  dialog.showModal();

  setTimeout(() => {
    nameInput.focus();
  }, 50);
}

function closeDialog() {
  dialog.close();
}

async function migrateOldApps(oldData) {
  const oldApps =
    normalizeOldApps(oldData.apps);

  if (oldApps.length === 0) {
    return false;
  }

  // แสดงของเดิมก่อนทันที
  apps = oldApps;
  render();

  const validApps =
    oldApps.filter(item => {
      return (
        item.url &&
        item.url !== "#" &&
        safeUrl(item.url) !== "#"
      );
    });

  if (validApps.length === 0) {
    return false;
  }

  const ok = confirm(
    `พบรายการเดิมในเครื่องนี้ ${oldApps.length} รายการ\n\n` +
    `มี ${validApps.length} รายการที่มีลิงก์พร้อมใช้งาน\n\n` +
    `ต้องการ Sync ขึ้น Google Sheet เพื่อให้ทุกเครื่องเห็นเหมือนกันไหม?`
  );

  if (!ok) {
    return false;
  }

  const pin = askPin();

  if (!pin) {
    return false;
  }

  setLoading(true);

  try {
    for (const item of validApps) {
      await apiPost({
        action: "add",
        pin,
        name: item.name,
        url: item.url
      });
    }

    apps = await apiGet();

    saveCache();

    // ลบ key เก่าเฉพาะหลัง Sync สำเร็จ
    try {
      localStorage.removeItem(oldData.key);
    } catch {}

    render();

    alert(
      `Sync ข้อมูลขึ้นระบบกลางแล้ว ${validApps.length} รายการ`
    );

    return true;
  } catch (err) {
    alert(
      `Sync ข้อมูลไม่สำเร็จ\n${err.message}`
    );

    return false;
  } finally {
    setLoading(false);
  }
}

async function init() {
  /*
    ขั้นตอนสำคัญ:
    1. หา localStorage เดิมก่อน
    2. โหลด Google Sheet
    3. ถ้า Sheet ว่าง แต่มีของเดิม -> โชว์ของเดิมและถาม Sync
    4. ถ้า Sheet มีข้อมูล -> ใช้ข้อมูลกลาง
  */

  const oldData = findOldLocalApps();

  const cachedApps = loadCache();

  if (oldData) {
    const oldApps =
      normalizeOldApps(oldData.apps);

    if (oldApps.length > 0) {
      apps = oldApps;
      render();
    }
  } else if (cachedApps.length > 0) {
    apps = cachedApps;
    render();
  }

  setLoading(true);

  try {
    const cloudApps = await apiGet();

    if (cloudApps.length > 0) {
      apps = cloudApps;

      saveCache();
      render();

      return;
    }

    // Google Sheet ว่าง
    if (oldData) {
      await migrateOldApps(oldData);
      return;
    }

    // ไม่มี local เก่า
    apps = [];
    render();

  } catch (err) {
    /*
      ถ้า API ล่ม:
      ใช้ local เดิมหรือ cache ต่อไป
      ไม่ล้างหน้าจอ
    */

    if (apps.length === 0) {
      alert(
        `เชื่อมต่อข้อมูลกลางไม่ได้\n${err.message}`
      );
    }

  } finally {
    setLoading(false);
  }
}

document.querySelector("#addBtn").onclick =
  () => openDialog();

document.querySelector("#emptyAddBtn").onclick =
  () => openDialog();

document.querySelector("#closeBtn").onclick =
  closeDialog;

document.querySelector("#cancelBtn").onclick =
  closeDialog;

form.addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    const item = {
      name: nameInput.value.trim(),
      url: urlInput.value.trim()
    };

    if (!item.name || !item.url) {
      return;
    }

    if (safeUrl(item.url) === "#") {
      alert(
        "กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://"
      );

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

        const current =
          apps[editingIndex];

        // รายการ local ที่ยังไม่มี id
        if (!current.id) {

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
            id: current.id,
            name: item.name,
            url: item.url
          });

        }
      }

      apps = Array.isArray(result.apps)
        ? result.apps
        : await apiGet();

      saveCache();

      render();
      closeDialog();

    } catch (err) {

      alert(
        `บันทึกไม่สำเร็จ\n${err.message}`
      );

    } finally {

      setLoading(false);

    }
  }
);

document.addEventListener(
  "click",
  e => {
    if (
      !e.target.closest(".more") &&
      !e.target.closest(".menu")
    ) {
      document
        .querySelectorAll(".menu")
        .forEach(menu => menu.remove());
    }
  }
);

window.addEventListener(
  "focus",
  async () => {
    if (isLoading) return;

    try {
      const cloudApps =
        await apiGet();

      if (cloudApps.length > 0) {
        apps = cloudApps;

        saveCache();
        render();
      }
    } catch {}
  }
);

init();
