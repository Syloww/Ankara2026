# Ankara 2026 — Galerie Erasmus

Site HTML / CSS / JS : chaque sous-dossier de `Photos/` devient un album / filtre.

## Local

```bash
npm start
```

→ http://localhost:3456  
Le serveur scanne `Photos/` via `/api/photos`.

## GitHub Pages

Sur https://syloww.github.io/Ankara2026/ le site est **statique** :

1. Lancer `npm start` une fois (ou `npm run scan`) pour générer `photos.json`
2. Commit + push de `photos.json` et des fichiers dans `Photos/`
3. Les chemins d’images utilisent automatiquement le préfixe `/Ankara2026/`

## Albums

- `Photos/NomAlbum/*` → filtre **NomAlbum**
- Formats : jpg, png, webp, gif, avif…
