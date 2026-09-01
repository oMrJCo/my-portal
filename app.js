const API_URL =
  "https://script.google.com/macros/s/AKfycbxcIKJlImEKiqOi2dAaHimmYIpOBGtSBEUKh_FNwWu6bQTdeQchaJzmpIQj7n0p_vBY/exec";

const CACHE_KEY =
  "myPortalCloudCache.v1";

let apps = [];
let editingIndex = null;
let loading = false;

const grid =
  document.querySelector("#grid");

const empty =
  document.querySelector("#empty");

const dialog =
  document.querySelector("#appDialog");

const form =
  document.querySelector("#appForm");

const nameInput =
  document.querySelector("#nameInput");

const urlInput =
  document.querySelector("#urlInput");

const dialogTitle =
  document.querySelector("#dialogTitle");

const addBtn =
  document.querySelector("#addBtn");

const emptyAddBtn =
  document.querySelector("#emptyAddBtn");

const closeBtn =
  document.querySelector("#closeBtn");

const cancelBtn =
  document.querySelector("#cancelBtn");


function setLoading(state) {
  loading = state;

  if (addBtn) {
    addBtn.disabled = state;

    addBtn.textContent =
      state
        ? "กำลังโหลด..."
        : "＋ เพิ่มปุ่ม";
  }
}


function safeUrl(url) {
  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    ) {
      return parsed.href;
    }

    return "#";

  } catch {
    return "#";
  }
}


function getHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "";
  }
}


function saveCache() {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(apps)
    );
  } catch {}
}


function loadCache() {
  try {
    const raw =
      localStorage.getItem(
        CACHE_KEY
      );

    if (!raw) {
      return [];
    }

    const data =
      JSON.parse(raw);

    return Array.isArray(data)
      ? data
      : [];

  } catch {
    return [];
  }
}


async function loadApps() {
  const response =
    await fetch(
      `${API_URL}?action=list&t=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      "โหลดข้อมูลไม่สำเร็จ"
    );
  }

  const data =
    await response.json();

  if (!data.success) {
    throw new Error(
      data.message ||
      "โหลดข้อมูลไม่สำเร็จ"
    );
  }

  return Array.isArray(data.apps)
    ? data.apps
    : [];
}


async function sendAction(data) {
  const body =
    new URLSearchParams();

  Object.entries(data)
    .forEach(([key, value]) => {
      body.append(
        key,
        value ?? ""
      );
    });

  const response =
    await fetch(
      API_URL,
      {
        method: "POST",
        body: body
      }
    );

  if (!response.ok) {
    throw new Error(
      "เชื่อมต่อระบบไม่ได้"
    );
  }

  const result =
    await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
      "ดำเนินการไม่สำเร็จ"
    );
  }

  return result;
}


function askPin() {
  const pin =
    prompt("ใส่รหัส Admin");

  if (pin === null) {
    return null;
  }

  return pin.trim();
}


function render() {
  grid.innerHTML = "";

  const hasApps =
    apps.length > 0;

  empty.hidden = hasApps;
  grid.hidden = !hasApps;

  apps.forEach(
    (app, index) => {

      const card =
        document.createElement(
          "article"
        );

      card.className = "card";


      const link =
        document.createElement(
          "a"
        );

      link.className =
        "card-link";

      const href =
        safeUrl(app.url);

      link.href = href;

      if (href !== "#") {
        link.target = "_blank";

        link.rel =
          "noopener noreferrer";
      }

      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        app.name;


      const url =
        document.createElement(
          "p"
        );

      url.className = "url";

      url.textContent =
        getHost(app.url);


      const open =
        document.createElement(
          "span"
        );

      open.className = "open";

      open.textContent =
        "เปิดระบบ ↗";


      link.append(
        title,
        url,
        open
      );


      const more =
        document.createElement(
          "button"
        );

      more.className = "more";
      more.type = "button";
      more.textContent = "⋯";


      more.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          closeMenus();

          const menu =
            document.createElement(
              "div"
            );

          menu.className =
            "menu";


          const edit =
            document.createElement(
              "button"
            );

          edit.type = "button";

          edit.textContent =
            "แก้ไข";

          edit.onclick = () => {
            closeMenus();

            openDialog(index);
          };


          const remove =
            document.createElement(
              "button"
            );

          remove.type =
            "button";

          remove.textContent =
            "ลบ";

          remove.className =
            "danger";

          remove.onclick =
            () => {
              closeMenus();

              deleteApp(index);
            };


          menu.append(
            edit,
            remove
          );

          card.appendChild(
            menu
          );
        }
      );


      card.append(
        link,
        more
      );

      grid.appendChild(
        card
      );
    }
  );
}


function closeMenus() {
  document
    .querySelectorAll(".menu")
    .forEach(
      menu => menu.remove()
    );
}


function openDialog(index = null) {
  closeMenus();

  editingIndex = index;

  if (index === null) {

    dialogTitle.textContent =
      "เพิ่มปุ่ม";

    nameInput.value = "";
    urlInput.value = "";

  } else {

    dialogTitle.textContent =
      "แก้ไขปุ่ม";

    nameInput.value =
      apps[index].name || "";

    urlInput.value =
      apps[index].url || "";
  }

  dialog.showModal();

  setTimeout(
    () => nameInput.focus(),
    50
  );
}


function closeDialog() {
  dialog.close();

  editingIndex = null;
}


async function refresh() {
  if (loading) {
    return;
  }

  setLoading(true);

  try {

    apps =
      await loadApps();

    saveCache();

    render();

  } catch (error) {

    const cache =
      loadCache();

    if (cache.length > 0) {

      apps = cache;

      render();

    } else {

      apps = [];

      render();
    }

    console.error(error);

  } finally {

    setLoading(false);
  }
}


async function deleteApp(index) {
  const app =
    apps[index];

  if (!app) {
    return;
  }

  const confirmDelete =
    confirm(
      `ลบ "${app.name}" ออกจาก Portal?`
    );

  if (!confirmDelete) {
    return;
  }

  const pin =
    askPin();

  if (!pin) {
    return;
  }

  setLoading(true);

  try {

    const result =
      await sendAction({
        action: "delete",
        pin: pin,
        id: app.id
      });

    apps =
      Array.isArray(
        result.apps
      )
        ? result.apps
        : await loadApps();

    saveCache();

    render();

  } catch (error) {

    alert(
      "ลบไม่สำเร็จ\n" +
      error.message
    );

  } finally {

    setLoading(false);
  }
}


form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const name =
      nameInput.value.trim();

    const url =
      urlInput.value.trim();

    if (!name) {
      alert(
        "กรุณาใส่ชื่อปุ่ม"
      );

      return;
    }

    if (
      !url ||
      safeUrl(url) === "#"
    ) {

      alert(
        "กรุณาใส่ Link ที่ขึ้นต้นด้วย https://"
      );

      return;
    }


    const pin =
      askPin();

    if (!pin) {
      return;
    }


    setLoading(true);

    try {

      let payload;

      if (
        editingIndex === null
      ) {

        payload = {
          action: "add",
          pin: pin,
          name: name,
          url: url
        };

      } else {

        payload = {
          action: "update",
          pin: pin,
          id:
            apps[
              editingIndex
            ].id,
          name: name,
          url: url
        };
      }


      const result =
        await sendAction(
          payload
        );


      apps =
        Array.isArray(
          result.apps
        )
          ? result.apps
          : await loadApps();


      saveCache();

      render();

      closeDialog();

    } catch (error) {

      alert(
        "บันทึกไม่สำเร็จ\n" +
        error.message
      );

    } finally {

      setLoading(false);
    }
  }
);


addBtn.addEventListener(
  "click",
  () => openDialog()
);


emptyAddBtn.addEventListener(
  "click",
  () => openDialog()
);


closeBtn.addEventListener(
  "click",
  closeDialog
);


cancelBtn.addEventListener(
  "click",
  closeDialog
);


document.addEventListener(
  "click",
  event => {

    if (
      !event.target.closest(
        ".more"
      ) &&
      !event.target.closest(
        ".menu"
      )
    ) {
      closeMenus();
    }
  }
);


window.addEventListener(
  "focus",
  () => {

    if (!loading) {
      refresh();
    }
  }
);


apps = loadCache();

render();

refresh();
