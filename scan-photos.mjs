import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".tif",
  ".tiff",
]);

/**
 * Scanne Photos/ : chaque sous-dossier = album, fichiers image = photos.
 * @param {string} rootDir racine du projet
 * @returns {{ albums: Array<{ id: string, photos: string[] }>, generatedAt: string }}
 */
export function scanPhotos(rootDir) {
  const photosRoot = path.join(rootDir, "Photos");
  const albums = [];

  if (!fs.existsSync(photosRoot)) {
    return { albums, generatedAt: new Date().toISOString() };
  }

  const entries = fs.readdirSync(photosRoot, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

  for (const dirName of dirs) {
    const dirPath = path.join(photosRoot, dirName);
    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    if (!files.length) continue;

    albums.push({
      id: dirName,
      photos: files.map((file) => `Photos/${dirName}/${file}`.replace(/\\/g, "/")),
    });
  }

  return {
    albums,
    generatedAt: new Date().toISOString(),
  };
}

export function writePhotosJson(rootDir, data) {
  const out = path.join(rootDir, "photos.json");
  fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
  return out;
}
