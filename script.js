(function () {
  const STORAGE_KEY = "bd_puzzle_passed";
  const dialog = document.getElementById("puzzleGate");
  const forceShow = new URLSearchParams(location.search).has("puzzle");
  if (!dialog || (localStorage.getItem(STORAGE_KEY) === "1" && !forceShow)) return;

  const rows = [
    ["Boda", "de", "una", "noche", "de", "verano"],
    ["de"],
    ["Barbara", "y", "Dante"],
  ];
  const words = rows.flat();
  const scramble = document.getElementById("puzzleScramble");
  const feedback = document.getElementById("puzzleFeedback");
  const checkBtn = document.getElementById("puzzleCheck");
  const skipBtn = document.getElementById("puzzleSkip");

  let grabOffsetX = 0;
  let grabOffsetY = 0;

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function overlapArea(ax, ay, aw, ah, bx, by, bw, bh) {
    const x = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
    const y = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
    return x * y;
  }

  function positionTileRandomly(tile) {
    const zoneRect = scramble.getBoundingClientRect();
    const w = tile.offsetWidth;
    const h = tile.offsetHeight;
    const maxLeft = Math.max(4, zoneRect.width - w - 4);
    const maxTop = Math.max(4, zoneRect.height - h - 4);

    const others = Array.from(scramble.children)
      .filter((el) => el !== tile)
      .map((el) => ({
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
        w: el.offsetWidth,
        h: el.offsetHeight,
      }));

    let bestLeft = 4;
    let bestTop = 4;
    let bestOverlap = Infinity;
    for (let i = 0; i < 20; i++) {
      const left = 4 + Math.random() * maxLeft;
      const top = 4 + Math.random() * maxTop;
      const overlap = others.reduce((sum, o) => sum + overlapArea(left, top, w, h, o.x, o.y, o.w, o.h), 0);
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestLeft = left;
        bestTop = top;
        if (overlap === 0) break;
      }
    }
    tile.style.left = bestLeft + "px";
    tile.style.top = bestTop + "px";
  }

  function clampWithinZone(tile, left, top) {
    const zoneRect = scramble.getBoundingClientRect();
    const w = tile.offsetWidth;
    const h = tile.offsetHeight;
    return {
      left: Math.max(4, Math.min(left, zoneRect.width - w - 4)),
      top: Math.max(4, Math.min(top, zoneRect.height - h - 4)),
    };
  }

  function checkOrder() {
    const zoneHeight = scramble.getBoundingClientRect().height;
    const bandHeight = zoneHeight / rows.length;

    const tiles = Array.from(scramble.children);
    const byRow = rows.map(() => []);
    tiles.forEach((tile) => {
      const centerY = (parseFloat(tile.style.top) || 0) + tile.offsetHeight / 2;
      const rowIndex = Math.min(rows.length - 1, Math.max(0, Math.floor(centerY / bandHeight)));
      byRow[rowIndex].push(tile);
    });

    const currentRows = byRow.map((rowTiles) =>
      rowTiles
        .sort((a, b) => (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0))
        .map((el) => el.dataset.word)
    );

    console.log("current order:", currentRows.map((row) => row.join(" ")).join(" / "));

    const correct = rows.every(
      (row, i) => currentRows[i].length === row.length && currentRows[i].every((w, j) => w === row[j])
    );
    if (correct) {
      feedback.textContent = "¡Lo habéis conseguido! Bienvenidos.";
      feedback.classList.add("puzzle-feedback-success");
      localStorage.setItem(STORAGE_KEY, "1");
      setTimeout(() => dialog.close(), 900);
    } else {
      feedback.textContent = "Ese orden no es correcto, inténtalo de nuevo.";
      dialog.classList.add("puzzle-shake");
      setTimeout(() => dialog.classList.remove("puzzle-shake"), 400);
    }
  }

  function attachTileEvents(tile) {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let pointerId = null;

    tile.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
      pointerId = e.pointerId;
      try {
        tile.setPointerCapture(pointerId);
      } catch (err) {
        /* capture may be unavailable for this pointer; dragging still works without it */
      }
    });

    tile.addEventListener("pointermove", (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isDragging && Math.hypot(dx, dy) > 6) {
        isDragging = true;
        const rect = tile.getBoundingClientRect();
        grabOffsetX = e.clientX - rect.left;
        grabOffsetY = e.clientY - rect.top;
        tile.style.width = rect.width + "px";
        dialog.appendChild(tile);
        tile.classList.add("puzzle-tile-dragging");
        tile.style.left = rect.left + "px";
        tile.style.top = rect.top + "px";
      }

      if (isDragging) {
        tile.style.left = (e.clientX - grabOffsetX) + "px";
        tile.style.top = (e.clientY - grabOffsetY) + "px";
      }
    });

    tile.addEventListener("pointerup", (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      try {
        tile.releasePointerCapture(pointerId);
      } catch (err) {
        /* capture may already be gone; cleanup below must still run */
      }
      pointerId = null;

      if (isDragging) {
        tile.classList.remove("puzzle-tile-dragging");
        tile.style.width = "";
        const zoneRect = scramble.getBoundingClientRect();
        const pos = clampWithinZone(
          tile,
          e.clientX - zoneRect.left - grabOffsetX,
          e.clientY - zoneRect.top - grabOffsetY
        );
        scramble.appendChild(tile);
        tile.style.left = pos.left + "px";
        tile.style.top = pos.top + "px";
      }
      isDragging = false;
    });

    tile.addEventListener("pointercancel", () => {
      if (isDragging) {
        tile.classList.remove("puzzle-tile-dragging");
        tile.style.width = "";
        scramble.appendChild(tile);
        positionTileRandomly(tile);
      }
      isDragging = false;
      pointerId = null;
    });

    // Fast movement can make the browser drop pointer capture without ever firing
    // pointerup/pointercancel, which would strand the tile mid-drag. This always
    // fires when capture ends, so it's the safety net that finishes the drop.
    // Reparenting the tile into the dialog (above) can itself trigger this event
    // even though the user is still dragging, so try to silently regain capture
    // first and only finalize the drop if the pointer is genuinely gone.
    tile.addEventListener("lostpointercapture", (e) => {
      if (!isDragging || pointerId === null) return;
      try {
        tile.setPointerCapture(pointerId);
        return;
      } catch (err) {
        /* capture really is gone; finish the drop below */
      }
      tile.classList.remove("puzzle-tile-dragging");
      tile.style.width = "";
      const zoneRect = scramble.getBoundingClientRect();
      const pos = clampWithinZone(
        tile,
        e.clientX - zoneRect.left - grabOffsetX,
        e.clientY - zoneRect.top - grabOffsetY
      );
      scramble.appendChild(tile);
      tile.style.left = pos.left + "px";
      tile.style.top = pos.top + "px";
      isDragging = false;
      pointerId = null;
    });
  }

  function createTiles() {
    scramble.innerHTML = "";
    shuffle(words).forEach((word) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "puzzle-tile";
      tile.textContent = word;
      tile.dataset.word = word;
      attachTileEvents(tile);
      scramble.appendChild(tile);
      positionTileRandomly(tile);
    });
  }

  checkBtn.addEventListener("click", checkOrder);
  skipBtn.addEventListener("click", () => dialog.close());

  dialog.addEventListener("close", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    document.body.classList.remove("modal-open");
  });

  document.body.classList.add("modal-open");
  dialog.showModal();
  createTiles();
})();

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
