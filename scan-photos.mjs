import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

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

function readDimensions(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const size = imageSize(buf);
    if (size?.width && size?.height) {
      return { width: size.width, height: size.height };
    }
  } catch {
    /* ignore */
  }
  return { width: 4, height: 3 };
}

/**
 * Scanne Photos/ : chaque sous-dossier = album.
 * Chaque photo inclut width/height pour réserver l'espace au lazy-load.
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
      photos: files.map((file) => {
        const rel = `Photos/${dirName}/${file}`.replace(/\\/g, "/");
        const dims = readDimensions(path.join(dirPath, file));
        return {
          src: rel,
          width: dims.width,
          height: dims.height,
        };
      }),
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
