const STORAGE_KEY = "myPortalApps.v1";
const starterApps = [
  { name: "ระบบเปิดบิล", url: "#" },
  { name: "Payroll", url: "#" },
  { name: "บัญชีค่าใช้จ่าย", url: "#" },
  { name: "Easy Smart User Generator", url: "https://github.com/oMrJCo/easysmart-user-generator" },
  { name: "เว็บราคา LEEPLUS", url: "https://jackleeplus.com/" },
  { name: "Easy Smart Business Manager", url: "#" }
];

let apps = loadApps();
let editingIndex = null;

const grid = document.querySelector("#grid");
const empty = document.querySelector("#empty");
const dialog = document.querySelector("#appDialog");
const form = document.querySelector("#appForm");
const nameInput = document.querySelector("#nameInput");
const urlInput = document.querySelector("#urlInput");
const dialogTitle = document.querySelector("#dialogTitle");

function loadApps() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : starterApps;
  } catch { return starterApps; }
}
function saveApps() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}
function safeUrl(url) {
  if (!url || url === "#") return "#";
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "#";
  } catch { return "#"; }
}
function displayHost(url) {
  if (url === "#") return "ยังไม่ได้ใส่ลิงก์";
  try { return new URL(url).hostname; } catch { return url; }
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
    link.innerHTML = `<h3></h3><p class="url"></p><span class="open">${href === "#" ? "รอใส่ลิงก์" : "เปิดระบบ ↗"}</span>`;
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
      del.onclick = () => {
        if (confirm(`ลบ "${app.name}" ออกจาก Portal?`)) {
          apps.splice(i, 1); saveApps(); render();
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
    nameInput.value = apps[index].name;
    urlInput.value = apps[index].url === "#" ? "" : apps[index].url;
  }
  dialog.showModal();
  setTimeout(() => nameInput.focus(), 50);
}
function closeDialog(){ dialog.close(); }

document.querySelector("#addBtn").onclick = () => openDialog();
document.querySelector("#emptyAddBtn").onclick = () => openDialog();
document.querySelector("#closeBtn").onclick = closeDialog;
document.querySelector("#cancelBtn").onclick = closeDialog;

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const item = { name: nameInput.value.trim(), url: urlInput.value.trim() };
  if (!item.name || !item.url) return;
  if (safeUrl(item.url) === "#") {
    alert("กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://");
    return;
  }
  if (editingIndex === null) apps.push(item);
  else apps[editingIndex] = item;
  saveApps(); render(); closeDialog();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".more") && !e.target.closest(".menu"))
    document.querySelectorAll(".menu").forEach(m => m.remove());
});

render();
