const fs = require('fs');
const path = require('path');

/**
 * Delete files in a directory older than ttlDays.
 * @param {string} uploadsDir
 * @param {number} ttlDays
 * @returns {Promise<number>} number of files deleted
 */
async function cleanupUploadsOnce(uploadsDir, ttlDays = 7) {
  if (!fs.existsSync(uploadsDir)) return 0;
  const files = await fs.promises.readdir(uploadsDir);
  const now = Date.now();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  await Promise.all(files.map(async (f) => {
    try {
      const filePath = path.join(uploadsDir, f);
      const stat = await fs.promises.stat(filePath);
      // Only delete files (not directories)
      if (!stat.isFile()) return;
      const age = now - stat.mtimeMs;
      if (age > ttlMs) {
        await fs.promises.unlink(filePath);
        deleted++;
        console.log(`[cleanupUploads] removed ${f} (age ${Math.round(age/1000/60/60)} hrs)`);
      }
    } catch (err) {
      // ignore individual file errors but log
      console.warn('[cleanupUploads] failed to process', f, err.message || err);
    }
  }));

  return deleted;
}

function startPeriodicCleanup(opts = {}) {
  const uploadsDir = opts.uploadsDir || path.join(__dirname, '..', 'uploads');
  const ttlDays = Number.isFinite(opts.ttlDays) ? opts.ttlDays : (process.env.UPLOAD_TTL_DAYS ? parseInt(process.env.UPLOAD_TTL_DAYS, 10) : 7);
  const intervalHours = Number.isFinite(opts.intervalHours) ? opts.intervalHours : (process.env.UPLOAD_CLEAN_INTERVAL_HOURS ? parseInt(process.env.UPLOAD_CLEAN_INTERVAL_HOURS, 10) : 24);

  // Run once immediately
  cleanupUploadsOnce(uploadsDir, ttlDays).then(n => {
    if (n > 0) console.log(`[cleanupUploads] initial cleanup removed ${n} files`);
    else console.log('[cleanupUploads] initial cleanup found no files to remove');
  }).catch(err => console.error('[cleanupUploads] initial cleanup error', err));

  // Schedule periodic cleanup
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
  const timer = setInterval(() => {
    cleanupUploadsOnce(uploadsDir, ttlDays).then(n => {
      if (n > 0) console.log(`[cleanupUploads] periodic cleanup removed ${n} files`);
    }).catch(err => console.error('[cleanupUploads] periodic cleanup error', err));
  }, intervalMs);

  return {
    stop: () => clearInterval(timer),
    runNow: () => cleanupUploadsOnce(uploadsDir, ttlDays)
  };
}

module.exports = { cleanupUploadsOnce, startPeriodicCleanup };
