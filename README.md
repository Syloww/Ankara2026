# Ankara 2026 — Galerie Erasmus

Site HTML / CSS / JS : chaque sous-dossier de `Photos/` devient un album / filtre, détecté automatiquement.

## Lancer le site

```bash
npm start
```

Puis ouvrir **http://localhost:3456**

Le serveur scanne `Photos/` à chaque appel de `/api/photos` : déposez des images dans un dossier, rechargez la page.

## Albums & filtres

- `Photos/NomAlbum/*.jpg|png|webp…` → album **NomAlbum**
- Par défaut : toutes les photos, ordre aléatoire
- Plus besoin d’éditer un fichier catalogue à la main

## Langues

Français · English · Türkçe

## Effets

- **WOW.js** + Animate.css
- **Rellax.js** (parallax)
