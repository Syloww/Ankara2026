# Ankara 2026 — Galerie Erasmus

Site statique (HTML / CSS / JS) pour parcourir les albums du dossier `Photos/`.

## Lancer le site

Ouvrir `index.html` dans le navigateur, ou servir le dossier en local :

```bash
npx serve .
```

Puis ouvrir l’URL affichée (souvent `http://localhost:3000`).

## Albums & filtres

- Chaque **sous-dossier** de `Photos/` = un album / filtre (`Busra`, `divers`, `Elvan`, …).
- Par défaut : **toutes** les photos, dans un **ordre aléatoire**.
- Après ajout de fichiers, mettez à jour `js/photos-data.js`.

## Langues

Français · English · Türkçe (sélecteur FR / EN / TR en haut à droite).

## Effets

- **WOW.js** + Animate.css : animations à l’arrivée / au scroll
- **Rellax.js** : parallax sur le hero et la section projet
