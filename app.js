/* ------------------------------------------------------------------
   Galerie Urbaine — MVP WebAR
   QR code → canaux → œuvre → réalité augmentée, avec géolocalisation
   de découverte.

   Tout le contenu vient de config.json : ce fichier ne contient aucun
   texte d'œuvre, aucun nom de lieu, aucun chemin de modèle.
   ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const els = {
  splash: $("splash"),
  error: $("error"),
  errorText: $("error-text"),
  app: $("app"),
  spotName: $("spot-name"),
  proximity: $("proximity"),
  channels: $("channels"),
  stage: $("stage"),
  viewer: $("viewer"),
  arButton: $("ar-button"),
  arUnavailable: $("ar-unavailable"),
  arGate: $("ar-gate"),
  progressFill: $("progress-fill"),
  title: $("art-title"),
  artist: $("art-artist"),
  desc: $("art-desc"),
  instruction: $("art-instruction"),
  cta: $("art-cta"),
  meta: $("art-meta"),
};

const params = new URLSearchParams(location.search);

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
  // 0,179 est le point où le contraste avec le noir et avec le blanc
  // s'équilibrent. Au-dessus, le noir est plus lisible.
  return L > 0.179 ? "#101114" : "#ffffff";
}

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

/** Distance en mètres entre deux points, formule de haversine. */
function distanceMetres(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Arrondi volontairement grossier : le GPS urbain ne vaut pas mieux. */
function formatDistance(m) {
  if (m < 1000) return `${Math.max(5, Math.round(m / 5) * 5)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Des coordonnées à 0,0 signifient « emplacement pas encore choisi ». */
function hasCoordinates(spot) {
  const c = spot && spot.coordinates;
  return !!c && typeof c.lat === "number" && typeof c.lng === "number" &&
    !(c.lat === 0 && c.lng === 0);
}

/* ------------------------------------------------------------- état */

let config = null;
let currentSpot = null;
let arrivedByQr = false;
let watchId = null;

/* ------------------------------------------------------------- rendu */

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

  els.viewer.setAttribute(
    "alt",
    `${art.title || "Œuvre"}, ${art.artist || ""}`.trim()
  );

  setText(els.title, art.title);
  setText(els.artist, art.artist);
  setText(els.desc, art.description);

  const marker = currentSpot && currentSpot.marker;
  setText(
    els.instruction,
    [marker && marker.instruction, marker && marker.orientationHint]
      .filter(Boolean)
      .join(" ")
  );

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

/* --------------------------------------------- géolocalisation de découverte

   Règle du cahier des charges : le scan du QR code est une preuve de
   présence plus fiable que le GPS. Une arrivée par QR donne donc l'accès
   complet, quoi que dise — ou ne dise pas — la géolocalisation.
   L'expérience n'est jamais bloquée par une permission.
------------------------------------------------------------------------- */

function radii(spot) {
  const d = (config && config.defaults) || {};
  return {
    activation: spot.activationRadius ?? d.activationRadius ?? 25,
    discovery: spot.discoveryRadius ?? d.discoveryRadius ?? 150,
  };
}

function applyProximity(metres) {
  const { activation, discovery } = radii(currentSpot);
  const d = formatDistance(metres);

  let state, message;
  if (metres <= activation) {
    state = "sur-place";
    message = "Vous y êtes.";
  } else if (metres <= discovery) {
    state = "a-proximite";
    message = `L'œuvre est à ${d} d'ici.`;
  } else {
    state = "hors-zone";
    message = `Vous êtes à ${d} de cet emplacement.`;
  }

  els.proximity.dataset.state = state;
  setText(els.proximity, message);

  // L'AR ne se ferme que pour un visiteur hors zone qui n'est pas
  // arrivé par le QR code.
  const gated = state === "hors-zone" && !arrivedByQr;
  els.stage.dataset.gated = String(gated);
  setText(
    els.arGate,
    gated
      ? "La réalité augmentée s'ouvrira une fois sur place. L'œuvre reste " +
        "visible et manipulable ci-dessus."
      : ""
  );
}

function startGeolocation() {
  if (!hasCoordinates(currentSpot)) return;

  // Mode simulation : ?at=48.8679,2.3636 — pour tester sans se déplacer.
  const sim = params.get("at");
  if (sim) {
    const [lat, lng] = sim.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      applyProximity(distanceMetres({ lat, lng }, currentSpot.coordinates));
      return;
    }
  }

  if (!("geolocation" in navigator)) return;

  // Suivi continu : c'est le déplacement qu'on veut observer, pas un point.
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      applyProximity(
        distanceMetres(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          currentSpot.coordinates
        )
      );
    },
    () => {
      // Refus, indisponibilité, délai dépassé : on ne dit rien et on ne
      // bloque rien. Le visiteur garde l'expérience complète.
      els.proximity.hidden = true;
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

/* -------------------------------------------------- disponibilité AR */

async function checkAR() {
  await customElements.whenDefined("model-viewer");
  await new Promise((r) => setTimeout(r, 400));
  els.arUnavailable.hidden = !!els.viewer.canActivateAR;
}

/* ------------------------------------------------------------ départ */

async function start() {
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

  const asked = params.get("spot");
  if (asked && !spots[asked]) {
    fail(`L'emplacement « ${asked} » n'existe pas. Vérifiez le QR code.`);
    return;
  }

  arrivedByQr = Boolean(asked);
  const id = asked || ids[0];

  currentSpot = spots[id];
  const channels = currentSpot.channels || [];
  if (channels.length === 0) {
    fail("Cet emplacement ne propose aucune œuvre pour le moment.");
    return;
  }

  document.title =
    `${currentSpot.name} — ${config.projectMeta?.title || "Galerie Urbaine"}`;
  els.spotName.textContent = currentSpot.name || id;

  renderChannels(channels);
  renderChannel(channels[0]);

  els.splash.hidden = true;
  els.app.hidden = false;

  checkAR();

  // Après l'affichage, jamais avant : une demande de permission en page
  // d'accueil fait fuir le passant.
  startGeolocation();
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
