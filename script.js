(function () {
  const STORAGE_KEY = "bd_puzzle_passed";
  const dialog = document.getElementById("puzzleGate");
  if (!dialog) return;

  const forceShow = new URLSearchParams(location.search).get("puzzle") === "1";
  if (!forceShow && localStorage.getItem(STORAGE_KEY) === "1") return;

  const rows = [
    [1, 2, 3],
    [4, 5, 6, 7, 8, 9],
    [10, 11, 12, 13],
  ];
  const SCALE = 0.6;

  const scramble = dialog.querySelector("#puzzleScramble");
  const feedback = dialog.querySelector("#puzzleFeedback");
  const checkBtn = dialog.querySelector("#puzzleCheck");
  const skipBtn = dialog.querySelector("#puzzleSkip");

  const placedRects = [];

  function overlapArea(a, b) {
    const x = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
    return x * y;
  }

  function positionTileRandomly(tile) {
    const zoneRect = scramble.getBoundingClientRect();
    const w = tile.offsetWidth;
    const h = tile.offsetHeight;
    const maxLeft = Math.max(zoneRect.width - w, 0);
    const maxTop = Math.max(zoneRect.height - h, 0);

    let best = null;
    let bestOverlap = Infinity;
    for (let attempt = 0; attempt < 40; attempt++) {
      const left = Math.random() * maxLeft;
      const top = Math.random() * maxTop;
      const rect = { left, top, width: w, height: h };
      let totalOverlap = 0;
      for (const r of placedRects) totalOverlap += overlapArea(rect, r);
      if (totalOverlap < bestOverlap) {
        bestOverlap = totalOverlap;
        best = rect;
        if (totalOverlap === 0) break;
      }
    }
    if (!best) best = { left: 0, top: 0, width: w, height: h };
    tile.style.left = best.left + "px";
    tile.style.top = best.top + "px";
    placedRects.push(best);
  }

  function clampWithinZone(tile, left, top) {
    const zoneRect = scramble.getBoundingClientRect();
    const maxLeft = Math.max(zoneRect.width - tile.offsetWidth, 0);
    const maxTop = Math.max(zoneRect.height - tile.offsetHeight, 0);
    return {
      left: Math.min(Math.max(left, 0), maxLeft),
      top: Math.min(Math.max(top, 0), maxTop),
    };
  }

  function attachTileEvents(tile) {
    let isDragging = false;
    let pointerId = null;
    let grabOffsetX = 0;
    let grabOffsetY = 0;

    function finishDrag() {
      tile.classList.remove("puzzle-tile-dragging");
      isDragging = false;
      pointerId = null;
    }

    tile.addEventListener("pointerdown", (e) => {
      isDragging = true;
      pointerId = e.pointerId;
      const rect = tile.getBoundingClientRect();
      grabOffsetX = e.clientX - rect.left;
      grabOffsetY = e.clientY - rect.top;
      tile.classList.add("puzzle-tile-dragging");
      try {
        tile.setPointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
    });

    tile.addEventListener("pointermove", (e) => {
      if (!isDragging || e.pointerId !== pointerId) return;
      const zoneRect = scramble.getBoundingClientRect();
      const pos = clampWithinZone(
        tile,
        e.clientX - zoneRect.left - grabOffsetX,
        e.clientY - zoneRect.top - grabOffsetY
      );
      tile.style.left = pos.left + "px";
      tile.style.top = pos.top + "px";
    });

    tile.addEventListener("pointerup", (e) => {
      if (!isDragging || e.pointerId !== pointerId) return;
      try {
        tile.releasePointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
      finishDrag();
    });

    tile.addEventListener("pointercancel", () => {
      if (isDragging) finishDrag();
    });

    tile.addEventListener("lostpointercapture", (e) => {
      if (!isDragging || pointerId === null) return;
      try {
        tile.setPointerCapture(pointerId);
        return;
      } catch (err) {
        /* capture really is gone; finish the drop below */
      }
      const zoneRect = scramble.getBoundingClientRect();
      const pos = clampWithinZone(
        tile,
        e.clientX - zoneRect.left - grabOffsetX,
        e.clientY - zoneRect.top - grabOffsetY
      );
      tile.style.left = pos.left + "px";
      tile.style.top = pos.top + "px";
      finishDrag();
    });
  }

  function createTiles() {
    placedRects.length = 0;
    scramble.querySelectorAll(".puzzle-tile").forEach((t) => t.remove());

    rows.forEach((row, rowIndex) => {
      row.forEach((id) => {
        const tile = document.createElement("img");
        tile.className = "puzzle-tile";
        tile.src = "img/ornaments/puzzle" + id + ".svg";
        tile.alt = "";
        tile.draggable = false;
        tile.dataset.puzzle = String(id);
        tile.dataset.row = String(rowIndex + 1);
        scramble.appendChild(tile);

        const place = () => {
          tile.style.width = Math.round(tile.naturalWidth * SCALE) + "px";
          tile.style.height = Math.round(tile.naturalHeight * SCALE) + "px";
          positionTileRandomly(tile);
        };
        if (tile.complete && tile.naturalWidth) {
          place();
        } else {
          tile.addEventListener("load", place, { once: true });
        }
        attachTileEvents(tile);
      });
    });
  }

  function checkOrder() {
    const zoneRect = scramble.getBoundingClientRect();
    const bandHeight = zoneRect.height / 3;
    const bands = [[], [], []];

    scramble.querySelectorAll(".puzzle-tile").forEach((tile) => {
      const r = tile.getBoundingClientRect();
      const centerX = r.left - zoneRect.left + r.width / 2;
      const centerY = r.top - zoneRect.top + r.height / 2;
      let band = Math.floor(centerY / bandHeight);
      band = Math.min(Math.max(band, 0), 2);
      bands[band].push({ id: Number(tile.dataset.puzzle), x: centerX });
    });

    const currentRows = bands.map((band) =>
      band
        .sort((a, b) => a.x - b.x)
        .map((t) => t.id)
    );

    console.log("current order:", currentRows.map((row) => row.join(",")).join(" / "));

    return rows.every((expected, i) => {
      const got = currentRows[i];
      return got.length === expected.length && expected.every((id, idx) => got[idx] === id);
    });
  }

  checkBtn.addEventListener("click", () => {
    if (checkOrder()) {
      feedback.classList.add("puzzle-feedback-success");
      feedback.textContent = "¡Correcto! Bienvenidos a nuestra boda.";
      setTimeout(() => dialog.close(), 900);
    } else {
      feedback.classList.remove("puzzle-feedback-success");
      feedback.textContent = "Todavía no... inténtalo de nuevo.";
      dialog.classList.add("puzzle-shake");
      setTimeout(() => dialog.classList.remove("puzzle-shake"), 400);
    }
  });

  skipBtn.addEventListener("click", () => dialog.close());

  dialog.addEventListener(
    "close",
    () => {
      document.body.classList.remove("modal-open");
      localStorage.setItem(STORAGE_KEY, "1");
    },
    { once: true }
  );

  createTiles();
  document.body.classList.add("modal-open");
  dialog.showModal();
})();

const siteHeader = document.querySelector(".site-header");
const setHeaderHeightVar = () => {
  if (siteHeader) {
    document.documentElement.style.setProperty("--header-h", siteHeader.offsetHeight + "px");
  }
};
setHeaderHeightVar();
window.addEventListener("resize", setHeaderHeightVar);
window.addEventListener("load", setHeaderHeightVar);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(setHeaderHeightVar);
}

const toggle = document.querySelector(".menu-toggle");
const menu = document.getElementById("menu");

toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});

menu.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

const lightbox = document.querySelector(".lightbox");
const lightboxImg = lightbox.querySelector("img");

document.querySelectorAll(".gallery img").forEach((img) => {
  img.closest("button").addEventListener("click", () => {
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.showModal();
  });
});

lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.close();
});

const countdown = document.querySelector("[data-countdown]");
const weddingDate = countdown.dataset.date ? new Date(countdown.dataset.date) : null;

if (weddingDate && !Number.isNaN(weddingDate.getTime())) {
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const diff = weddingDate - new Date();
    if (diff <= 0) {
      countdown.hidden = true;
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    countdown.querySelector("[data-days]").textContent = days;
    countdown.querySelector("[data-hours]").textContent = pad(hours);
    countdown.querySelector("[data-minutes]").textContent = pad(minutes);
    countdown.hidden = false;
  };
  tick();
  setInterval(tick, 30000);
}

// RSVP form -> Google Sheet via Apps Script web app.
// Replace this with your own deployed Apps Script /exec URL (see rsvp-apps-script.gs).
const RSVP_ENDPOINT = "REPLACE_WITH_YOUR_APPS_SCRIPT_URL";

const rsvpForm = document.getElementById("rsvpForm");
if (rsvpForm) {
  const rsvpFeedback = document.getElementById("rsvpFeedback");
  const rsvpSubmit = rsvpForm.querySelector(".rsvp-submit");

  rsvpForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (RSVP_ENDPOINT.indexOf("REPLACE_WITH") === 0) {
      rsvpFeedback.classList.remove("rsvp-feedback-success");
      rsvpFeedback.textContent =
        "El formulario todavía no está conectado. Sigue las instrucciones de rsvp-apps-script.gs.";
      return;
    }

    rsvpSubmit.disabled = true;
    rsvpFeedback.classList.remove("rsvp-feedback-success");
    rsvpFeedback.textContent = "Enviando...";

    const formData = new FormData(rsvpForm);

    fetch(RSVP_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      body: formData,
    })
      .then(() => {
        rsvpFeedback.classList.add("rsvp-feedback-success");
        rsvpFeedback.textContent = "¡Gracias! Hemos recibido tu confirmación.";
        rsvpForm.reset();
      })
      .catch(() => {
        rsvpFeedback.classList.remove("rsvp-feedback-success");
        rsvpFeedback.textContent = "Hubo un problema al enviar. Inténtalo de nuevo.";
      })
      .finally(() => {
        rsvpSubmit.disabled = false;
      });
  });
}
