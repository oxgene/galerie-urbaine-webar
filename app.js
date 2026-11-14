/* ------------------------------------------------------------------
   Galerie Urbaine — MVP WebAR
   Noyau : QR code → une œuvre → réalité augmentée.
   Tout le contenu vient de config.json : ce fichier ne contient
   aucun texte d'œuvre, aucun nom de lieu, aucun chemin de modèle.
   ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const els = {
  splash: $("splash"),
  error: $("error"),
  errorText: $("error-text"),
  app: $("app"),
  spotName: $("spot-name"),
  channels: $("channels"),
  viewer: $("viewer"),
  arButton: $("ar-button"),
  arUnavailable: $("ar-unavailable"),
  progressFill: $("progress-fill"),
  title: $("art-title"),
  artist: $("art-artist"),
  desc: $("art-desc"),
  instruction: $("art-instruction"),
  cta: $("art-cta"),
  meta: $("art-meta"),
};

/* ------------------------------------------------------------- outils */

/** Choisit un texte lisible (clair ou sombre) sur une couleur donnée. */
function readableInk(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#101114";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#101114" : "#ffffff";
}

/** Écrit un texte dans un élément et le masque s'il est vide. */
function setText(el, value) {
  const v = (value || "").trim();
  el.textContent = v;
  el.hidden = v === "";
}

function fail(message) {
  els.splash.hidden = true;
  els.app.hidden = true;
  els.errorText.textContent = message;
  els.error.hidden = false;
}

/* ------------------------------------------------------------- rendu */

let currentSpot = null;

function renderChannel(channel) {
  const art = channel.artwork || {};

  const accent = channel.themeColor || "#e7e3da";
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--on-accent", readableInk(accent));

  els.viewer.setAttribute("src", art.modelUrl || "");

  // Sans ios-src, model-viewer génère un USDZ à la volée — et cette
  // génération ne gère pas les animations. On fournit donc le fichier.
  if (art.iosModelUrl) {
    els.viewer.setAttribute("ios-src", art.iosModelUrl);
  } else {
    els.viewer.removeAttribute("ios-src");
  }

  els.viewer.setAttribute("alt", `${art.title || "Œuvre"}, ${art.artist || ""}`.trim());

  setText(els.title, art.title);
  setText(els.artist, art.artist);
  setText(els.desc, art.description);

  const marker = currentSpot && currentSpot.marker;
  const instruction = [marker && marker.instruction, marker && marker.orientationHint]
    .filter(Boolean)
    .join(" ");
  setText(els.instruction, instruction);

  if (art.ctaUrl && art.ctaLabel) {
    els.cta.href = art.ctaUrl;
    els.cta.textContent = art.ctaLabel;
    els.cta.rel = "noopener";
    els.cta.hidden = false;
  } else {
    els.cta.hidden = true;
  }

  const bits = [];
  if (art.heightMeters) {
    bits.push(`Hauteur réelle ${String(art.heightMeters).replace(".", ",")} m`);
  }
  bits.push("Affichée à l'échelle 1:1");
  if (art.animated) bits.push("Œuvre animée");
  els.meta.textContent = bits.join(" · ");
}

function renderChannels(channels) {
  els.channels.replaceChildren();

  // Un seul canal : pas de sélecteur à afficher.
  if (channels.length < 2) {
    els.channels.hidden = true;
    return;
  }

  channels.forEach((channel, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "channel";
    b.textContent = channel.label || channel.id;
    b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", () => {
      els.channels.querySelectorAll(".channel").forEach((other) =>
        other.setAttribute("aria-pressed", String(other === b))
      );
      renderChannel(channel);
    });
    els.channels.append(b);
  });

  els.channels.hidden = false;
}

/* -------------------------------------------------- disponibilité AR */

async function checkAR() {
  await customElements.whenDefined("model-viewer");
  // model-viewer a besoin d'un instant pour interroger la plateforme.
  await new Promise((r) => setTimeout(r, 400));
  const ok = els.viewer.canActivateAR;
  els.arUnavailable.hidden = ok;
}

/* ------------------------------------------------------------ départ */

async function start() {
  let config;
  try {
    const res = await fetch("./config.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    config = await res.json();
  } catch (e) {
    fail("La configuration n'a pas pu être chargée. Vérifiez que config.json est bien en ligne.");
    return;
  }

  const spots = config.spots || {};
  const ids = Object.keys(spots);
  if (ids.length === 0) {
    fail("Aucun emplacement n'est défini dans config.json.");
    return;
  }

  const asked = new URLSearchParams(location.search).get("spot");
  const id = asked && spots[asked] ? asked : ids[0];

  if (asked && !spots[asked]) {
    fail(`L'emplacement « ${asked} » n'existe pas. Vérifiez le QR code.`);
    return;
  }

  currentSpot = spots[id];
  const channels = currentSpot.channels || [];
  if (channels.length === 0) {
    fail("Cet emplacement ne propose aucune œuvre pour le moment.");
    return;
  }

  document.title = `${currentSpot.name} — ${config.projectMeta?.title || "Galerie Urbaine"}`;
  els.spotName.textContent = currentSpot.name || id;

  renderChannels(channels);
  renderChannel(channels[0]);

  els.splash.hidden = true;
  els.app.hidden = false;

  checkAR();
}

/* ------------------------------------------------- barre de progression */

els.viewer.addEventListener("progress", (e) => {
  const pct = Math.round((e.detail.totalProgress || 0) * 100);
  els.progressFill.style.width = pct + "%";
});

els.viewer.addEventListener("error", () => {
  fail("Le modèle 3D n'a pas pu être chargé. Vérifiez le chemin indiqué dans config.json.");
});

start();
