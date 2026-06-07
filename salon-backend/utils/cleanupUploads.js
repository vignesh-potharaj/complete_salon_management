const fs = require('fs');
const path = require('path');
let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  } else {
    cloudinary = null;
  }
} catch (err) {
  cloudinary = null;
}

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

/**
 * Delete Cloudinary resources in a folder older than ttlDays.
 * Supports resourceType 'raw' or 'image'.
 * Returns number of deleted resources.
 */
async function cleanupCloudinaryOnce(folder = 'salonpro_receipts', ttlDays = 90, resourceType = 'raw') {
  if (!cloudinary) return 0;
  const now = Date.now();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let nextCursor = null;

  try {
    do {
      const opts = {
        resource_type: resourceType,
        type: 'upload',
        prefix: folder,
        max_results: 500
      };
      if (nextCursor) opts.next_cursor = nextCursor;
      const res = await cloudinary.api.resources(opts);
      const resources = res.resources || [];
      await Promise.all(resources.map(async (r) => {
        try {
          const created = new Date(r.created_at).getTime();
          if (now - created > ttlMs) {
            await cloudinary.uploader.destroy(r.public_id, { resource_type: resourceType, invalidate: false });
            deleted++;
            console.log(`[cleanupUploads][cloudinary] removed ${r.public_id} (${resourceType}, created ${r.created_at})`);
          }
        } catch (err) {
          console.warn('[cleanupUploads][cloudinary] failed to delete', r.public_id, err.message || err);
        }
      }));

      nextCursor = res.next_cursor;
    } while (nextCursor);
  } catch (err) {
    console.error(`[cleanupUploads][cloudinary] error listing ${resourceType} resources`, err.message || err);
  }

  return deleted;
}

function startPeriodicCleanup(opts = {}) {
  const uploadsDir = opts.uploadsDir || path.join(__dirname, '..', 'uploads');
  // If Cloudinary is configured and UPLOAD_TTL_DAYS isn't provided, default to 90 days
  const defaultTtl = cloudinary ? 90 : 7;
  const ttlDays = Number.isFinite(opts.ttlDays) ? opts.ttlDays : (process.env.UPLOAD_TTL_DAYS ? parseInt(process.env.UPLOAD_TTL_DAYS, 10) : defaultTtl);
  const intervalHours = Number.isFinite(opts.intervalHours) ? opts.intervalHours : (process.env.UPLOAD_CLEAN_INTERVAL_HOURS ? parseInt(process.env.UPLOAD_CLEAN_INTERVAL_HOURS, 10) : 24);

  // Run once immediately
  (async () => {
    try {
      const localDeleted = await cleanupUploadsOnce(uploadsDir, ttlDays);
      if (localDeleted > 0) console.log(`[cleanupUploads] initial local cleanup removed ${localDeleted} files`);
      else console.log('[cleanupUploads] initial local cleanup found no files to remove');

      // If Cloudinary is configured, run cloud cleanup as well
      if (cloudinary) {
        const rawDeleted = await cleanupCloudinaryOnce('salonpro_receipts', ttlDays, 'raw');
        const imageDeleted = await cleanupCloudinaryOnce('salonpro_receipts', ttlDays, 'image');
        const totalCloudDeleted = rawDeleted + imageDeleted;
        if (totalCloudDeleted > 0) {
          console.log(`[cleanupUploads] initial cloud cleanup removed ${totalCloudDeleted} items (raw: ${rawDeleted}, image: ${imageDeleted})`);
        } else {
          console.log('[cleanupUploads] initial cloud cleanup found no items to remove');
        }
      }
    } catch (err) {
      console.error('[cleanupUploads] initial cleanup error', err);
    }
  })();

  // Schedule periodic cleanup
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
  const timer = setInterval(() => {
    (async () => {
      try {
        const localDeleted = await cleanupUploadsOnce(uploadsDir, ttlDays);
        if (localDeleted > 0) console.log(`[cleanupUploads] periodic local cleanup removed ${localDeleted} files`);

        if (cloudinary) {
          const rawDeleted = await cleanupCloudinaryOnce('salonpro_receipts', ttlDays, 'raw');
          const imageDeleted = await cleanupCloudinaryOnce('salonpro_receipts', ttlDays, 'image');
          const totalCloudDeleted = rawDeleted + imageDeleted;
          if (totalCloudDeleted > 0) {
            console.log(`[cleanupUploads] periodic cloud cleanup removed ${totalCloudDeleted} items (raw: ${rawDeleted}, image: ${imageDeleted})`);
          }
        }
      } catch (err) {
        console.error('[cleanupUploads] periodic cleanup error', err);
      }
    })();
  }, intervalMs);

  return {
    stop: () => clearInterval(timer),
    runNow: () => cleanupUploadsOnce(uploadsDir, ttlDays)
  };
}

module.exports = { cleanupUploadsOnce, startPeriodicCleanup };
