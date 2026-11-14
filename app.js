/* ------------------------------------------------------------------
   Neo-Space — MVP WebAR

   Un parcours contient des balises ; une balise porte une œuvre.
   Le QR code posé sur site désigne une balise précise : c'est la
   balise « scannée ». On peut en consulter d'autres, mais la réalité
   augmentée ne se lance que là où l'on se trouve — ailleurs, le
   bouton principal devient un itinéraire.

   Tout le contenu vient de config.json.
   ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const els = {
  splash: $("splash"),
  error: $("error"),
  errorText: $("error-text"),
  app: $("app"),
  appTitle: $("app-title"),
  introSub: $("intro-sub"),
  cta: $("cta"),
  ctaLabel: $("cta-label"),
  cardMeta: $("card-meta"),
  tabs: $("tabs-balises"),
  options: $("options"),
  panel: $("panel"),
  artTitle: $("art-title"),
  artDesc: $("art-desc"),
  artMeta: $("art-meta"),
  navDistance: $("nav-distance"),
  navHint: $("nav-hint"),
  navGo: $("nav-go"),
  viewer: $("viewer"),
  previewPhoto: $("preview-photo"),
  previewImg: $("preview-img"),
  artistName: $("artist-name"),
  artistBio: $("artist-bio"),
  artistLink: $("artist-link"),
  linkMore: $("link-more"),
  linkContact: $("link-contact"),
  launch: $("launch"),
  launchScrim: $("launch-scrim"),
  launchClose: $("launch-close"),
  launchFigure: $("launch-figure"),
  launchImg: $("launch-img"),
  launchGo: $("launch-go"),
  lightbox: $("lightbox"),
  lightboxImg: $("lightbox-img"),
  lightboxClose: $("lightbox-close"),
};

const params = new URLSearchParams(location.search);

let config = null;
let parcours = null;
let scannedIndex = 0;   // la balise du QR code
let selectedIndex = 0;  // la balise consultée
let activeOption = "infos";
// On garde la position du visiteur, pas la distance : la distance dépend
// de la balise consultée et doit être recalculée à chaque changement.
let lastPosition = null;

/* ------------------------------------------------------------- outils */

const setText = (el, v) => { el.textContent = (v || "").trim(); };

function fail(message) {
  els.splash.hidden = true;
  els.app.hidden = true;
  els.errorText.textContent = message;
  els.error.hidden = false;
}

function distanceMetres(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Arrondi volontairement grossier : le GPS urbain ne vaut pas mieux. */
function formatDistance(m) {
  if (m < 1000) return `${Math.max(5, Math.round(m / 5) * 5)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

function hasCoordinates(b) {
  const c = b && b.coordinates;
  return !!c && typeof c.lat === "number" && typeof c.lng === "number" &&
    !(c.lat === 0 && c.lng === 0);
}

/** Itinéraire piéton, dans l'application de cartes du téléphone. */
function itineraryUrl(c) {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  return isApple
    ? `maps://?daddr=${c.lat},${c.lng}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=walking`;
}

const balise = (i) => parcours.balises[i];
const selected = () => balise(selectedIndex);
const isOnScannedBalise = () => selectedIndex === scannedIndex;

/* ------------------------------------------------------------- rendu */

function renderTabs() {
  els.tabs.replaceChildren();
  parcours.balises.forEach((b, i) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "tab";
    t.textContent = b.label || `Balise ${b.numero}`;
    t.setAttribute("aria-pressed", String(i === selectedIndex));
    t.addEventListener("click", () => selectBalise(i));
    els.tabs.append(t);
  });
}

function syncTabs() {
  [...els.tabs.children].forEach((t, i) =>
    t.setAttribute("aria-pressed", String(i === selectedIndex))
  );
}

function renderStates() {
  const b = selected();
  const art = b.artwork || {};
  const artist = b.artist || {};

  // 1. fiche technique
  setText(els.artTitle, art.title);
  setText(els.artDesc, art.description);
  const bits = [];
  if (art.heightMeters) {
    bits.push(`Hauteur réelle ${String(art.heightMeters).replace(".", ",")} m`);
  }
  if (art.animated) bits.push("Œuvre animée");
  setText(els.artMeta, bits.join(" · "));

  // 3. aperçu : la photo prime, le modèle 3D sinon
  els.viewer.setAttribute("src", art.modelUrl || "");
  if (art.iosModelUrl) els.viewer.setAttribute("ios-src", art.iosModelUrl);
  else els.viewer.removeAttribute("ios-src");
  els.viewer.setAttribute("alt", art.title || "Œuvre");

  if (art.previewImage) {
    els.previewImg.src = art.previewImage;
    els.previewImg.alt = `${art.title || "L'œuvre"} vue sur le site`;
    els.previewPhoto.hidden = false;
  } else {
    els.previewPhoto.hidden = true;
  }

  // 4. artiste
  setText(els.artistName, artist.name);
  setText(els.artistBio, artist.bio);
  if (artist.linkUrl) {
    els.artistLink.href = artist.linkUrl;
    els.artistLink.textContent = artist.linkLabel || "Voir son travail";
    els.artistLink.hidden = false;
  } else {
    els.artistLink.hidden = true;
  }

  renderNavState();
  renderCta();
}

/** 2. navigation — dépend de la balise consultée et de la position. */
function renderNavState() {
  const b = selected();
  const radius = config.defaults?.activationRadius ?? 25;

  if (!hasCoordinates(b)) {
    setText(els.navDistance, "Position non renseignée");
    setText(els.navHint, "Les coordonnées de cette balise n'ont pas encore été définies dans la configuration.");
    els.navGo.hidden = true;
    return;
  }

  els.navGo.href = itineraryUrl(b.coordinates);
  els.navGo.textContent = "Lancer l'itinéraire";

  const distance = lastPosition
    ? distanceMetres(lastPosition, b.coordinates)
    : null;

  if (distance === null) {
    setText(els.navDistance, "Localisation en cours…");
    setText(els.navHint, "Autorisez la géolocalisation pour connaître votre distance à cette balise. Vous pouvez aussi lancer l'itinéraire directement.");
    els.navGo.hidden = false;
    return;
  }

  if (distance <= radius) {
    setText(els.navDistance, "Vous êtes sur site");
    setText(els.navHint, "L'œuvre peut être observée d'ici. Cherchez un point de vue dégagé avant de lancer l'expérience.");
    els.navGo.hidden = true;
  } else {
    setText(els.navDistance, `À ${formatDistance(distance)}`);
    setText(els.navHint, "Rapprochez-vous pour observer l'œuvre à son emplacement prévu.");
    els.navGo.hidden = false;
  }
}

/** Le bouton principal : lancer ici, ou s'y rendre. */
function renderCta() {
  const b = selected();
  if (isOnScannedBalise()) {
    els.ctaLabel.textContent = "Lancer l'expérience AR";
    els.cta.disabled = false;
    els.cta.dataset.action = "launch";
  } else {
    els.ctaLabel.textContent = `S'y rendre · ${b.label || "Balise " + b.numero}`;
    els.cta.dataset.action = "route";
    els.cta.disabled = !hasCoordinates(b);
  }
}

/* La zone contextuelle garde une hauteur constante, quel que soit son
   contenu : c'est ce qui immobilise la barre d'options en bas de l'écran.
   Un contenu trop long défile à l'intérieur, jamais la page. */
function showOption(name) {
  activeOption = name;
  els.panel.querySelectorAll(".state").forEach((s) => {
    s.hidden = s.dataset.state !== name;
  });
  els.options.querySelectorAll(".option").forEach((o) => {
    o.setAttribute("aria-pressed", String(o.dataset.option === name));
  });
}

function selectBalise(i) {
  selectedIndex = i;
  syncTabs();
  renderStates();
  showOption(activeOption);
}

/* ----------------------------------------------------- géolocalisation */

function startGeolocation() {
  const sim = params.get("at");
  if (sim) {
    const [lat, lng] = sim.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      applyPosition({ lat, lng });
      return;
    }
  }
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.watchPosition(
    (pos) => applyPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => { lastPosition = null; renderNavState(); },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function applyPosition(here) {
  lastPosition = here;
  renderNavState();
}

/* ------------------------------------------------- fenêtre de lancement */

function openLaunch() {
  const b = selected();
  if (b.referenceImage) {
    els.launchImg.src = b.referenceImage;
    els.launchFigure.hidden = false;
  } else {
    els.launchFigure.hidden = true;
  }
  els.launch.hidden = false;
}

const closeLaunch = () => { els.launch.hidden = true; };

async function launchAR() {
  closeLaunch();
  try {
    if (els.viewer.canActivateAR) await els.viewer.activateAR();
    else alert("La réalité augmentée n'est pas disponible sur cet appareil. L'œuvre reste consultable dans l'onglet Aperçu.");
  } catch (e) {
    alert("La réalité augmentée n'a pas pu démarrer. Réessayez depuis l'onglet Aperçu.");
  }
}

/* ------------------------------------------------------ agrandissement */

function openLightbox(src, alt) {
  els.lightboxImg.src = src;
  els.lightboxImg.alt = alt || "";
  els.lightbox.hidden = false;
}

const closeLightbox = () => { els.lightbox.hidden = true; };

/* ------------------------------------------------------------- départ */

async function start() {
  try {
    const res = await fetch("./config.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    config = await res.json();
  } catch {
    fail("La configuration n'a pas pu être chargée. Vérifiez que config.json est bien en ligne.");
    return;
  }

  const all = config.parcours || {};
  const codes = Object.keys(all);
  if (!codes.length) { fail("Aucun parcours n'est défini dans config.json."); return; }

  const askedP = params.get("parcours");
  if (askedP && !all[askedP]) {
    fail(`Le parcours « ${askedP} » n'existe pas. Vérifiez le QR code.`);
    return;
  }
  const code = askedP || codes[0];
  parcours = all[code];

  if (!parcours.balises || !parcours.balises.length) {
    fail("Ce parcours ne contient aucune balise pour le moment.");
    return;
  }

  const askedB = params.get("balise");
  if (askedB) {
    const i = parcours.balises.findIndex((b) => String(b.numero) === String(askedB));
    if (i < 0) { fail(`La balise « ${askedB} » n'existe pas sur ce parcours.`); return; }
    scannedIndex = i;
  }
  selectedIndex = scannedIndex;

  const b = selected();
  const title = config.app?.title || "Neo-Space";
  document.title = `${title} — ${parcours.name || code}`;
  // data-text alimente la couche de reflet du titre en verre (::after).
  els.appTitle.textContent = `« ${title} »`;
  els.appTitle.dataset.text = `« ${title} »`;
  els.introSub.textContent =
    `Vous avez activé la ${(b.label || "balise " + b.numero).toLowerCase()} du ${(parcours.name || "parcours " + code).toLowerCase()}`;
  els.cardMeta.textContent =
    `${parcours.name || "Parcours " + code} : réalisé par « ${parcours.creator || "—"} »`;

  const links = { ...(config.defaults?.links || {}), ...(parcours.links || {}) };
  for (const [key, el] of [["moreParcours", els.linkMore], ["contact", els.linkContact]]) {
    const l = links[key] || {};
    el.textContent = l.label || "";
    if (l.url) { el.href = l.url; el.rel = "noopener"; el.removeAttribute("aria-disabled"); }
    else el.setAttribute("aria-disabled", "true");
  }

  renderTabs();
  renderStates();
  showOption("infos");

  els.splash.hidden = true;
  els.app.hidden = false;

  startGeolocation();
}

/* ------------------------------------------------------------ écoutes */

els.options.addEventListener("click", (e) => {
  const o = e.target.closest(".option");
  if (o) showOption(o.dataset.option);
});

els.cta.addEventListener("click", () => {
  if (els.cta.dataset.action === "route") {
    const b = selected();
    if (hasCoordinates(b)) location.href = itineraryUrl(b.coordinates);
  } else {
    openLaunch();
  }
});

els.launchGo.addEventListener("click", launchAR);
els.launchClose.addEventListener("click", closeLaunch);
els.launchScrim.addEventListener("click", closeLaunch);

els.launchFigure.addEventListener("click", () =>
  openLightbox(els.launchImg.src, els.launchImg.alt));
els.previewPhoto.addEventListener("click", () =>
  openLightbox(els.previewImg.src, els.previewImg.alt));

els.lightboxClose.addEventListener("click", closeLightbox);
els.lightbox.addEventListener("click", (e) => {
  if (e.target === els.lightbox) closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!els.lightbox.hidden) closeLightbox();
  else if (!els.launch.hidden) closeLaunch();
});

els.viewer.addEventListener("error", () => {
  setText(els.artMeta, "Le modèle 3D n'a pas pu être chargé.");
});

start();
