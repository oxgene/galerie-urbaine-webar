# Galerie Urbaine — MVP WebAR

Une page web qui pose une œuvre 3D à l'échelle réelle dans la rue, depuis
le navigateur d'un téléphone, sans installer d'application.

Le périmètre complet du MVP est en place : scan d'un QR code, bascule entre
canaux thématiques, géolocalisation de découverte, consigne de pose et
lancement de la réalité augmentée.

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
assets/ui/      Les gabarits imprimables du marquage physique
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

## 5. Les canaux

Un canal = une œuvre proposée au même endroit. Il y en a deux par défaut, et
le sélecteur apparaît automatiquement dès qu'il y en a plus d'un. Avec un
seul canal, il disparaît sans rien casser.

Pour en ajouter un, dupliquez un bloc à l'intérieur de `channels` :

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

## 7. La géolocalisation de découverte

Elle sert à situer le visiteur, pas à ancrer l'œuvre. Le GPS urbain est
précis à 5–10 mètres : assez pour une logique de proximité, pas pour poser
une sculpture.

### Les trois états

| Distance | Ce que voit le visiteur |
| --- | --- |
| Moins de 25 m | « Vous y êtes. » Accès complet |
| 25 à 150 m | « L'œuvre est à 80 m d'ici. » Accès complet |
| Plus de 150 m | « Vous êtes à 2,4 km de cet emplacement. » |

Les deux rayons se règlent par emplacement dans `config.json`
(`activationRadius`, `discoveryRadius`), ou globalement dans `defaults`.

### Deux règles qui comptent

**Le QR code prime sur le GPS.** Scanner un code collé dans la rue prouve
mieux la présence que la géolocalisation. Une arrivée par QR donne donc
l'accès complet, même hors zone, même si le GPS est refusé. La réalité
augmentée n'est fermée que pour un visiteur arrivé par un lien partagé *et*
géolocalisé loin.

**La permission n'est jamais demandée à l'ouverture.** Elle l'est une fois
le contenu affiché. Un refus n'affiche rien et ne bloque rien.

### Renseigner les coordonnées

```json
"coordinates": { "lat": 48.8679, "lng": 2.3636 }
```

Tant que les coordonnées valent `0, 0`, la géolocalisation ne se déclenche
pas du tout : c'est le réglage de départ, pour pouvoir déployer avant
d'avoir choisi le site.

Relevez la latitude et la longitude sur n'importe quelle carte en ligne, en
faisant un clic droit sur le point exact.

### Tester sans se déplacer

Ajoutez `&at=latitude,longitude` à l'URL pour simuler une position :

```
https://votre-adresse.pages.dev/?spot=spot-01&at=48.8679,2.3636
```

Pratique pour vérifier les trois états depuis chez vous. Ce paramètre ne
sert qu'aux essais, il n'a aucun effet sur les QR codes imprimés.

---

## 8. Le marquage physique

Deux gabarits dans `assets/ui/`, en SVG, conçus comme des bases neutres à
habiller selon votre direction artistique.

**`marquage-sol.svg`** — le cercle au sol, à l'échelle réelle
(800 × 800 mm). Il marque l'emplacement de l'**œuvre**, pas celui du
visiteur : le triangle indique le sens, la croix le centre. À imprimer en
grand format, ou à reporter au pochoir et à la craie.

**`plaque-qr.svg`** — la plaque A5 à poser verticalement, avec un
emplacement réservé de 90 × 90 mm pour votre QR code. Le code ne va jamais
au sol, où il serait piétiné et illisible.

**Réversibilité.** Craie, pochoir à la craie ou sticker amovible. Un
marquage durable du sol public relève d'une autorisation municipale ; un
marquage éphémère évite la question pendant la phase de test et se refait
en deux minutes.

Le texte affiché dans l'application vient de `config.json` et doit répéter
mot pour mot ce qui est écrit au sol :

```json
"marker": {
  "instruction": "Posez l'œuvre sur le repère au sol.",
  "orientationHint": "Reculez de quelques pas pour la voir en entier."
}
```

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

## Ce qui reste à faire

Le code couvre tout le périmètre du MVP. Ce qui manque ne relève plus du
développement :

- Vos œuvres, à la place des deux volumes de test
- Les coordonnées du site retenu, à la place de `0, 0`
- Le marquage imprimé et posé sur place
- Les trois passages de test terrain : ciel couvert, plein soleil, nuit

Au-delà — base de données spatiale, ancrage géoréférencé, calibrage par
primitives, application native — c'est le manifeste de projet qui prend le
relais, une fois les critères de réussite du cahier des charges mesurés.
