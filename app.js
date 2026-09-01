const API_URL =
  "https://script.google.com/macros/s/AKfycbxcIKJlImEKiqOi2dAaHimmYIpOBGtSBEUKh_FNwWu6bQTdeQchaJzmpIQj7n0p_vBY/exec";

const CACHE_KEY = "myPortalOnline.v1";

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


function safeUrl(url) {
  if (!url) return "#";

  try {
    const u = new URL(url);

    if (
      u.protocol === "http:" ||
      u.protocol === "https:"
    ) {
      return u.href;
    }

    return "#";

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
      localStorage.getItem(CACHE_KEY);

    if (!raw) return [];

    const data =
      JSON.parse(raw);

    return Array.isArray(data)
      ? data
      : [];

  } catch {
    return [];
  }
}


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


/*
  ใช้ JSONP แทน fetch
  เพื่อไม่ติด CORS ระหว่าง
  GitHub Pages กับ Google Apps Script
*/
function request(action, params = {}) {
  return new Promise(
    (resolve, reject) => {

      const callbackName =
        "__portal_cb_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() * 100000
        );

      const script =
        document.createElement(
          "script"
        );

      const query =
        new URLSearchParams({
          action: action,
          callback: callbackName,
          t: Date.now(),
          ...params
        });

      const timeout =
        setTimeout(() => {
          cleanup();

          reject(
            new Error(
              "เชื่อมต่อข้อมูลกลางไม่ได้"
            )
          );
        }, 15000);


      function cleanup() {
        clearTimeout(timeout);

        try {
          delete window[
            callbackName
          ];
        } catch {}

        if (script.parentNode) {
          script.parentNode
            .removeChild(script);
        }
      }


      window[callbackName] =
        function(result) {

          cleanup();

          if (
            result &&
            result.success
          ) {
            resolve(result);
          } else {
            reject(
              new Error(
                result?.message ||
                "ดำเนินการไม่สำเร็จ"
              )
            );
          }
        };


      script.onerror =
        function() {

          cleanup();

          reject(
            new Error(
              "เชื่อมต่อข้อมูลกลางไม่ได้"
            )
          );
        };


      script.src =
        API_URL +
        "?" +
        query.toString();

      document.body.appendChild(
        script
      );
    }
  );
}


async function loadApps() {
  const result =
    await request("list");

  apps =
    Array.isArray(result.apps)
      ? result.apps
      : [];

  saveCache();
  render();
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
        displayHost(app.url);


      const open =
        document.createElement(
          "span"
        );

      open.className = "open";

      open.textContent =
        href === "#"
          ? "รอใส่ลิงก์"
          : "เปิดระบบ ↗";


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


      more.onclick =
        function(event) {

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

          edit.onclick =
            function() {

              closeMenus();

              openDialog(
                index
              );
            };


          const del =
            document.createElement(
              "button"
            );

          del.type = "button";
          del.textContent =
            "ลบ";

          del.className =
            "danger";

          del.onclick =
            function() {

              closeMenus();

              deleteApp(
                index
              );
            };


          menu.append(
            edit,
            del
          );

          card.appendChild(
            menu
          );
        };


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
    .querySelectorAll(
      ".menu"
    )
    .forEach(
      menu => menu.remove()
    );
}


function openDialog(
  index = null
) {
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


async function deleteApp(
  index
) {
  const app =
    apps[index];

  if (!app) return;

  const ok =
    confirm(
      `ลบ "${app.name}" ออกจาก Portal?`
    );

  if (!ok) return;

  setLoading(true);

  try {

    const result =
      await request(
        "delete",
        {
          id: app.id
        }
      );

    apps =
      Array.isArray(result.apps)
        ? result.apps
        : [];

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
  async function(event) {

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
        "กรุณาใส่ Link ที่ขึ้นต้นด้วย http:// หรือ https://"
      );

      return;
    }


    setLoading(true);

    try {

      let result;


      if (
        editingIndex === null
      ) {

        result =
          await request(
            "add",
            {
              name: name,
              url: url
            }
          );

      } else {

        result =
          await request(
            "update",
            {
              id:
                apps[
                  editingIndex
                ].id,
              name: name,
              url: url
            }
          );
      }


      apps =
        Array.isArray(result.apps)
          ? result.apps
          : [];


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


addBtn.onclick =
  function() {
    openDialog();
  };


emptyAddBtn.onclick =
  function() {
    openDialog();
  };


closeBtn.onclick =
  closeDialog;


cancelBtn.onclick =
  closeDialog;


document.addEventListener(
  "click",
  function(event) {

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


async function refresh() {
  if (loading) return;

  setLoading(true);

  try {

    await loadApps();

  } catch (error) {

    const cached =
      loadCache();

    if (cached.length) {
      apps = cached;
      render();
    }

    console.error(
      error
    );

  } finally {

    setLoading(false);
  }
}


/*
  เปิดเว็บ:
  แสดง cache ก่อนเพื่อให้เร็ว
  แล้ว Sync Google Sheet ทันที
*/
apps = loadCache();

render();

refresh();


/*
  กลับมาที่หน้า Portal
  โหลดข้อมูลล่าสุดอีกครั้ง
*/
window.addEventListener(
  "focus",
  function() {

    if (!loading) {
      refresh();
    }
  }
);
