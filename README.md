# Galerie Urbaine — MVP WebAR

Une page web qui pose une œuvre 3D à l'échelle réelle dans la rue, depuis
le navigateur d'un téléphone, sans installer d'application.

Ce dépôt contient le **noyau** : un QR code, une œuvre, un bouton pour la
voir en réalité augmentée. Les canaux, la géolocalisation et le marquage au
sol viendront se greffer dessus sans réécriture.

Aucune compilation, aucune dépendance à installer. Les fichiers sont servis
tels quels.

---

## Ce qu'il y a dans le dossier

```
index.html      La page
style.css       Tout l'habillage : couleurs, typographie, espacements
app.js          La logique : lit config.json et remplit la page
config.json     Le contenu : lieux, œuvres, textes. Le seul fichier à éditer au quotidien
_headers        Réglage obligatoire pour Cloudflare Pages (voir plus bas)
vercel.json     Le même réglage, si vous déployez sur Vercel
assets/models/  Les fichiers 3D, par paires .glb + .usdz
assets/ui/      Les images d'interface (vide pour l'instant)
```

---

## 1. Voir la page sur votre ordinateur

Ouvrir `index.html` d'un double-clic **ne marchera pas** : le navigateur
refuse de charger `config.json` depuis un fichier local. Il faut un petit
serveur. Dans le Terminal, placez-vous dans le dossier et lancez :

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000` dans votre navigateur.

La 3D s'affichera et tournera. **Le bouton AR, lui, ne fonctionnera pas
depuis l'ordinateur** : la réalité augmentée n'existe que sur téléphone, et
elle exige une adresse en HTTPS. C'est normal, ce n'est pas un bug.

Pour arrêter le serveur : `Ctrl + C`.

---

## 2. Mettre la page en ligne (Cloudflare Pages, gratuit)

Il faut une adresse en HTTPS pour que la réalité augmentée fonctionne. Le
déploiement se fait une fois ; ensuite, chaque modification poussée sur
GitHub met le site à jour toute seule.

1. Connectez-vous sur **dash.cloudflare.com**
2. Dans le menu de gauche : **Workers & Pages** → **Create** → onglet
   **Pages** → **Connect to Git**
3. Autorisez Cloudflare à accéder à votre compte GitHub, puis choisissez ce
   dépôt
4. Dans les réglages de build, laissez **tout vide** :
   - Framework preset : `None`
   - Build command : *(vide)*
   - Build output directory : `/`
5. **Save and Deploy**

Au bout d'une minute, Cloudflare vous donne une adresse du type
`https://galerie-urbaine-webar.pages.dev`. C'est votre site.

> **Important : arrêtez le nom de domaine avant d'imprimer le moindre QR
> code.** Une fois collés dans la rue, les QR codes ne peuvent plus changer
> d'adresse. Si vous voulez un domaine à vous, achetez-le et branchez-le sur
> Cloudflare *maintenant*, pas après.

---

## 3. Fabriquer le QR code

L'adresse à encoder est celle de votre site, suivie de l'identifiant de
l'emplacement :

```
https://votre-adresse.pages.dev/?spot=spot-01
```

N'importe quel générateur de QR code fait l'affaire. Deux conseils :

- Exportez en **SVG ou PDF**, jamais en JPEG : vous allez l'agrandir.
- Testez-le à la taille réelle d'impression, à un mètre de distance, avant
  d'en faire cent exemplaires.

---

## 4. Remplacer le modèle 3D par le vôtre

Le modèle livré est un volume de test. Pour mettre votre œuvre :

1. Exportez **deux fichiers** depuis Blender : un `.glb` et un `.usdz`.
   Les règles d'export (échelle, pivot, poids, textures) sont dans le
   cahier des charges — elles ne sont pas optionnelles.
2. Déposez-les dans `assets/models/`
3. Dans `config.json`, changez les deux chemins :

```json
"modelUrl":    "./assets/models/votre_oeuvre.glb",
"iosModelUrl": "./assets/models/votre_oeuvre.usdz",
```

4. Mettez à jour `title`, `artist`, `description`, `heightMeters` et
   `animated` juste au-dessus.

Poussez sur GitHub : le site se met à jour tout seul en une minute.

### Pourquoi deux fichiers ?

Parce qu'iPhone et Android ne lisent pas le même format. Android et la page
web utilisent le `.glb`. L'iPhone passe par AR Quick Look, qui ne sait lire
que le `.usdz`.

Et surtout : si vous ne fournissez pas de `.usdz`, model-viewer en fabrique
un automatiquement — **mais cette fabrication automatique ne gère pas les
animations**. Votre sculpture cinétique apparaîtrait figée sur iPhone.

---

## 5. Ajouter un deuxième canal

Un canal = une œuvre proposée au même endroit. Dès qu'il y en a deux, le
sélecteur apparaît automatiquement en haut de la page.

Dans `config.json`, dupliquez le bloc existant à l'intérieur de `channels` :

```json
{
  "id": "canal-partenaire",
  "label": "Canal Partenaire",
  "themeColor": "#33C1FF",
  "artwork": {
    "title": "Édition limitée",
    "artist": "Collaboration",
    "description": "…",
    "modelUrl": "./assets/models/edition.glb",
    "iosModelUrl": "./assets/models/edition.usdz",
    "animated": false,
    "heightMeters": 1.8,
    "ctaLabel": "Découvrir",
    "ctaUrl": "https://…"
  }
}
```

`themeColor` colore le bouton AR et l'onglet du canal. La couleur du texte
posé dessus est calculée automatiquement pour rester lisible.

Attention à la virgule entre deux blocs : c'est l'erreur la plus fréquente.
Un `config.json` mal formé fait apparaître « La configuration n'a pas pu
être chargée ».

---

## 6. Ajouter un deuxième emplacement

Dupliquez le bloc `"spot-01"` dans `spots`, donnez-lui un autre identifiant
(`"spot-02"`), et fabriquez un QR code pointant vers `?spot=spot-02`.

---

## Quand quelque chose ne marche pas

**Le bouton AR s'affiche mais ne fait rien, sur iPhone.**
Presque toujours le type MIME du `.usdz`. Vérifiez que le fichier `_headers`
est bien à la racine du dépôt et que Cloudflare l'a pris en compte. Sans lui,
Quick Look refuse le fichier en silence.

**Le bouton AR n'apparaît pas du tout.**
Sur iPhone avec Chrome, c'est normalement réglé par l'attribut
`quick-look-browsers`. Sur Android, cela signifie que l'appareil n'a pas
ARCore : la page affiche alors un message et reste consultable en 3D.

**Le modèle tourne indéfiniment sans finir de charger.**
Le fichier est trop lourd. Visez moins de 3 Mo. C'est un problème d'export,
pas de code.

**L'œuvre est couchée sur le côté.**
L'axe haut n'a pas été corrigé à l'export : Blender travaille en Z-up, les
formats cibles attendent du Y-up.

**L'œuvre flotte ou s'enfonce dans le sol.**
Le point de pivot n'est pas au centre de la base, à Z = 0.

**« La configuration n'a pas pu être chargée ».**
`config.json` contient une erreur de syntaxe. Collez-le dans un validateur
JSON en ligne pour trouver la virgule fautive.

---

## Mettre à jour model-viewer

La version est figée dans `index.html` :

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.2.0/dist/model-viewer.min.js"></script>
```

Changez le numéro pour changer de version. Figer la version est volontaire :
une mise à jour automatique peut casser l'affichage sans prévenir, et une
œuvre dans la rue doit continuer de fonctionner.

---

## Ce qui n'est pas encore là

- La géolocalisation de découverte (rayons de 25 et 150 m)
- Le marquage au sol et son instruction dans l'interface
- Le deuxième canal

Ces trois briques sont décrites dans le cahier des charges V3 et viendront
une fois le noyau validé sur le terrain.
