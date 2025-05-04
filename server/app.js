require('dotenv').config();
const express = require('express');
const axios = require('axios');
const archiver = require('archiver');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const GOOGLE_FONTS_API_KEY = process.env.GOOGLE_FONTS_API_KEY;
if (!GOOGLE_FONTS_API_KEY) {
  console.error('Please set the GOOGLE_FONTS_API_KEY environment variable.');
  process.exit(1);
}

const VALID_FORMATS = new Set(['woff2', 'ttf']);
const FONTS_DIR = path.resolve('D:/fonts-cache');

// Create fonts directory if it doesn't exist
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

function validateFormat(fmt) {
  if (!VALID_FORMATS.has(fmt)) {
    const err = new Error('Invalid format. Must be woff2 or ttf.');
    err.status = 400;
    throw err;
  }
  return fmt;
}

async function fetchFontList() {
  const res = await axios.get(
    `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`
  );
  return res.data.items.map(f => f.family);
}

function pickRandomFonts(fontList, n) {
  const picked = new Set();
  while (picked.size < n) {
    const rand = fontList[Math.floor(Math.random() * fontList.length)];
    picked.add(rand);
  }
  return [...picked];
}

async function resolveWoff2Url(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;

  const { data: css } = await axios.get(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    }
  });

  const regex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/;
  const match = css.match(regex);

  if (!match) {
    throw new Error(`No WOFF2 URL found for "${family}" weight ${weight}`);
  }

  return match[1];
}

async function resolveTtfUrl(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const { data: css } = await axios.get(cssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  if (!match) throw new Error(`No TTF URL found for "${family}" weight ${weight}`);
  return match[1];
}

async function downloadAndSaveFont(family, weight, url, format) {
  const safeFamily = family.replace(/\s+/g, '-');
  const fontDir = path.join(FONTS_DIR, safeFamily);
  
  // Create font directory if it doesn't exist
  if (!fs.existsSync(fontDir)) {
    fs.mkdirSync(fontDir, { recursive: true });
  }

  const filename = `${safeFamily}-${weight}.${format}`;
  const filePath = path.join(fontDir, filename);

  // Skip if file already exists
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(filePath, response.data);
  return filePath;
}

async function streamFontsAsZip(res, selection, format, weights) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=fonts-${format}-${Date.now()}.zip`
  );

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => {
    console.error('Archive error:', err);
    res.status(500).end();
  });
  archive.pipe(res);

  for (const family of selection) {
    try {
      for (const weight of weights) {
        try {
          let url;
          if (format === 'woff2') {
            url = await resolveWoff2Url(family, weight);
          } else {
            url = await resolveTtfUrl(family, weight);
          }
          
          const filePath = await downloadAndSaveFont(family, weight, url, format);
          const safeFamily = family.replace(/\s+/g, '-');
          const filename = `${safeFamily}-${weight}.${format}`;
          archive.file(filePath, { name: `${safeFamily}/${filename}` });
        } catch (err) {
          console.warn(`Skipping ${family} weight ${weight}: ${err.message}`);
        }
      }
    } catch (err) {
      console.warn(`Skipping ${family}: ${err.message}`);
    }
  }

  await archive.finalize();
}

(async () => {
  const fontList = await fetchFontList();
  const app = express();
  app.use(cors());

  app.get('/download-random', async (req, res, next) => {
    try {
      const format = validateFormat(req.query.format);
      const count = parseInt(req.query.count, 10);
      const weights = (req.query.weights || '100,200,300,400,500,600,700,800,900')
        .split(',')
        .map(w => parseInt(w, 10));

      if (isNaN(count) || count < 10 || count > 100 || count % 10 !== 0) {
        throw Object.assign(new Error('count must be one of 10,20,…,100'), { status: 400 });
      }

      const selection = pickRandomFonts(fontList, count);
      await streamFontsAsZip(res, selection, format, weights);
    } catch (err) {
      next(err);
    }
  });

  app.get('/download-by-name', async (req, res, next) => {
    try {
      const format = validateFormat(req.query.format);
      const name = req.query.name;
      const weights = (req.query.weights || '100,200,300,400,500,600,700,800,900')
        .split(',')
        .map(w => parseInt(w, 10));

      if (!name) {
        throw Object.assign(new Error('Font name is required'), { status: 400 });
      }

      // Normalize font name
      const normalized = name
        .trim()
        .split(/\s+/)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      // Check against valid font list
      const isValidFont = fontList.includes(normalized);
      if (!isValidFont) {
        throw Object.assign(new Error(`Font "${normalized}" not found.`), { status: 404 });
      }

      // Create ZIP with all weights
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${normalized.replace(/\s+/g, '-')}-${format}-${Date.now()}.zip`
      );

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', err => {
        console.error('Archive error:', err);
        res.status(500).end();
      });
      archive.pipe(res);

      for (const weight of weights) {
        try {
          let url;
          if (format === 'woff2') {
            url = await resolveWoff2Url(normalized, weight);
          } else {
            url = await resolveTtfUrl(normalized, weight);
          }
          
          const filePath = await downloadAndSaveFont(normalized, weight, url, format);
          const safeFamily = normalized.replace(/\s+/g, '-');
          const filename = `${safeFamily}-${weight}.${format}`;
          archive.file(filePath, { name: `${safeFamily}/${filename}` });
        } catch (err) {
          console.warn(`Skipping weight ${weight}: ${err.message}`);
        }
      }

      await archive.finalize();
    } catch (err) {
      next(err);
    }
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message });
  });

  app.listen(PORT, () => {
    console.log(`Font-downloader running on port ${PORT}`);
  });
})();