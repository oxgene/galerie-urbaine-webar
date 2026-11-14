# Neo-Space — MVP WebAR

Une page web qui pose une œuvre 3D à l'échelle réelle dans la rue, depuis le
navigateur d'un téléphone, sans installer d'application.

Un **parcours** contient des **balises**. Une balise est un lieu marqué par un
QR code, et elle porte une œuvre. Le visiteur scanne, consulte, puis lance la
réalité augmentée sur place.

Aucune compilation, aucune dépendance à installer. Les fichiers sont servis
tels quels.

---

## Ce qu'il y a dans le dossier

```
index.html      La page
style.css       Tout l'habillage : couleurs, typographie, espacements
app.js          La logique : lit config.json et remplit la page
config.json     Le contenu : parcours, balises, œuvres, artistes
_headers        Réglage obligatoire pour Cloudflare Pages
vercel.json     Le même réglage, si vous déployez sur Vercel
assets/models/  Les fichiers 3D, par paires .glb + .usdz
assets/ui/      Les gabarits imprimables du marquage physique
```

---

## L'interface en un coup d'œil

La page tient sur un écran, sans défilement vertical. Si un texte dépasse,
c'est la zone centrale qui défile, jamais la page.

- un titre d'accueil et la balise activée
- le bouton principal
- un encart à deux menus, avec une zone contextuelle entre les deux
- deux liens en pied de page

**Le menu du haut** liste les balises du parcours. Il s'ouvre sur celle que le
QR code a désignée.

**Le menu du bas** choisit ce qu'affiche la zone centrale, parmi quatre états :

| État | Contenu |
| --- | --- |
| Infos | La fiche technique de l'œuvre |
| Trajet | Votre distance à la balise, et un itinéraire au-delà de 25 m |
| Aperçu | La photo de l'œuvre sur site si elle existe, sinon le modèle 3D |
| Artiste | La présentation de l'auteur et son lien externe |

**Le bouton principal change de rôle.** Sur la balise que vous avez scannée,
il lance l'expérience. Si vous consultez une autre balise du parcours, il
devient un bouton d'itinéraire : l'œuvre ne se lance pas hors de son lieu.

**Avant l'AR**, une fenêtre rappelle comment se placer, affiche une image de
référence si elle a été fournie, et avertit de rester attentif à son
environnement.

---

## 1. Voir la page sur votre ordinateur

Ouvrir `index.html` d'un double-clic ne marchera pas : le navigateur refuse de
charger `config.json` depuis un fichier local. Il faut un petit serveur. Dans
le Terminal, placez-vous dans le dossier et lancez :

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000` dans votre navigateur.

La 3D s'affichera dans l'onglet Aperçu. **Le bouton AR, lui, ne fonctionnera
pas depuis l'ordinateur** : la réalité augmentée n'existe que sur téléphone, et
elle exige une adresse en HTTPS. C'est normal.

Pour arrêter le serveur : `Ctrl + C`.

---

## 2. Mettre la page en ligne (Cloudflare Pages, gratuit)

1. Connectez-vous sur **dash.cloudflare.com**
2. **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git**
3. Choisissez ce dépôt
4. Dans les réglages de build, laissez **tout vide** :
   - Framework preset : `None`
   - Build command : *(vide)*
   - Build output directory : `/`
5. **Save and Deploy**

Chaque modification poussée sur GitHub met le site à jour en une minute.

> **Arrêtez le nom de domaine avant d'imprimer le moindre QR code.** Une fois
> collés dans la rue, ils ne peuvent plus changer d'adresse.

---

## 3. Fabriquer les QR codes

Un QR code par balise. L'adresse à encoder :

```
https://votre-adresse.pages.dev/?parcours=001&balise=1
```

`parcours` est la clé du parcours dans `config.json`, `balise` est le numéro de
la balise.

Exportez en **SVG ou PDF**, jamais en JPEG, et testez à la taille réelle
d'impression à un mètre de distance avant d'en faire cent exemplaires.

---

## 4. Remplir une balise

Tout se passe dans `config.json`. Voici une balise complète :

```json
{
  "numero": 1,
  "label": "Balise 1",
  "lieu": "Place de la République",
  "coordinates": { "lat": 48.8679, "lng": 2.3636 },
  "referenceImage": "./assets/ui/pointdevue-01.jpg",
  "artwork": {
    "title": "Monolith #01",
    "description": "Le texte de la fiche technique.",
    "modelUrl": "./assets/models/monolith_art.glb",
    "iosModelUrl": "./assets/models/monolith_art.usdz",
    "animated": true,
    "heightMeters": 2.4,
    "previewImage": "./assets/ui/apercu-01.jpg"
  },
  "artist": {
    "name": "Nom de l'artiste",
    "bio": "Sa démarche, son parcours.",
    "linkLabel": "Tous ses liens",
    "linkUrl": "https://linktr.ee/…"
  }
}
```

Les trois champs d'images sont facultatifs et se comportent ainsi :

- `referenceImage` — la photo du point de vue conseillé, affichée dans la
  fenêtre de lancement. Sans elle, la fenêtre s'affiche sans illustration.
- `previewImage` — la photo de l'œuvre vue sur le lieu. Sans elle, l'onglet
  Aperçu montre le modèle 3D.
- `linkUrl` — sans lui, aucun bouton n'apparaît sur la fiche artiste.

Les images sont agrandissables d'une pression.

---

## 5. Remplacer le modèle 3D par le vôtre

1. Exportez **deux fichiers** depuis Blender : un `.glb` et un `.usdz`. Les
   règles d'export — échelle, pivot, poids, textures — sont dans le cahier des
   charges, et elles ne sont pas optionnelles.
2. Déposez-les dans `assets/models/`
3. Changez `modelUrl` et `iosModelUrl` dans la balise concernée
4. Mettez à jour `title`, `description`, `heightMeters` et `animated`

### Pourquoi deux fichiers ?

Parce qu'iPhone et Android ne lisent pas le même format. Android et la page web
utilisent le `.glb`. L'iPhone passe par AR Quick Look, qui ne lit que le
`.usdz`.

Surtout : si vous ne fournissez pas de `.usdz`, model-viewer en fabrique un
automatiquement — **mais cette fabrication ne gère pas les animations**. Votre
sculpture cinétique apparaîtrait figée sur iPhone.

---

## 6. Ajouter une balise ou un parcours

Pour une **balise**, dupliquez un bloc dans `balises`, donnez-lui le numéro
suivant, et fabriquez le QR code correspondant. Les onglets apparaissent tout
seuls et défilent horizontalement au-delà de trois ou quatre.

Pour un **parcours**, dupliquez le bloc `"001"` dans `parcours` sous une
nouvelle clé. Chaque parcours a son créateur et ses propres liens de pied de
page ; sans eux, ceux de `defaults` s'appliquent.

Attention à la virgule entre deux blocs : c'est l'erreur la plus fréquente. Un
`config.json` mal formé affiche « La configuration n'a pas pu être chargée ».

---

## 7. La géolocalisation

Elle situe le visiteur, elle n'ancre pas l'œuvre. Le GPS urbain est précis à
5–10 mètres : assez pour une distance, pas pour poser une sculpture.

En deçà de 25 mètres, l'onglet Trajet affiche « Vous êtes sur site ». Au-delà,
il affiche la distance et propose un itinéraire piéton dans l'application de
cartes du téléphone. Le rayon se règle avec `activationRadius` dans `defaults`.

Deux règles de conception :

- **La permission n'est jamais demandée à l'ouverture**, mais après affichage
  du contenu. Un refus n'affiche rien et ne bloque rien.
- **Rien ne dépend du GPS pour fonctionner.** Scanner un QR code posé dans la
  rue prouve mieux la présence que la géolocalisation.

Tant que les coordonnées valent `0, 0`, la géolocalisation reste en sommeil et
l'onglet Trajet le signale.

**Tester sans se déplacer** : ajoutez `&at=latitude,longitude` à l'URL pour
simuler une position.

```
https://votre-adresse.pages.dev/?parcours=001&balise=1&at=48.8679,2.3636
```

---

## 8. Le marquage physique

Deux gabarits dans `assets/ui/`, en SVG, conçus comme des bases neutres à
habiller selon votre direction artistique.

**`marquage-sol.svg`** — le cercle au sol à l'échelle réelle (800 × 800 mm). Il
marque l'emplacement de l'**œuvre**, pas celui du visiteur : le triangle indique
le sens, la croix le centre.

**`plaque-qr.svg`** — la plaque A5 à poser verticalement, avec un emplacement
réservé de 90 × 90 mm pour votre QR code. Le code ne va jamais au sol, où il
serait piétiné.

**Réversibilité.** Craie, pochoir ou sticker amovible. Un marquage durable du
sol public relève d'une autorisation municipale ; un marquage éphémère évite la
question pendant la phase de test.

---

## Quand quelque chose ne marche pas

**Le bouton AR s'affiche mais ne fait rien, sur iPhone.**
Presque toujours le type MIME du `.usdz`. Vérifiez que `_headers` est bien à la
racine du dépôt. Sans lui, Quick Look refuse le fichier en silence.

**Le bouton AR n'apparaît pas du tout.**
Sur Android, l'appareil n'a probablement pas ARCore. La page reste consultable
et l'onglet Aperçu continue d'afficher l'œuvre en 3D.

**Le modèle tourne indéfiniment sans finir de charger.**
Le fichier est trop lourd. Visez moins de 3 Mo. C'est un problème d'export.

**L'œuvre est couchée sur le côté.**
L'axe haut n'a pas été corrigé à l'export : Blender travaille en Z-up, les
formats cibles attendent du Y-up.

**L'œuvre flotte ou s'enfonce dans le sol.**
Le point de pivot n'est pas au centre de la base, à Z = 0.

**« La configuration n'a pas pu être chargée ».**
`config.json` contient une erreur de syntaxe. Collez-le dans un validateur JSON
en ligne pour trouver la virgule fautive.

---

## Mettre à jour model-viewer

La version est figée dans `index.html` :

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.2.0/dist/model-viewer.min.js"></script>
```

Figer la version est volontaire : une mise à jour automatique peut casser
l'affichage sans prévenir, et une œuvre dans la rue doit continuer de
fonctionner.

---

## Ce qui reste à faire

Le code couvre le périmètre du MVP. Ce qui manque ne relève plus du
développement :

- Vos œuvres, à la place des volumes de test
- Les coordonnées des sites retenus, à la place de `0, 0`
- Les photos de point de vue et d'aperçu
- Le marquage imprimé et posé
- Les trois passages de test terrain : ciel couvert, plein soleil, nuit
