// services/folders.js — папки библиотеки: папка учебника и внутри папки юнитов (или любые свои папки).
// Таблица и колонка создаются при запуске сервера, отдельную миграцию запускать не нужно.
const { query } = require('../db');

async function ensure() {
  await query(`
    CREATE TABLE IF NOT EXISTS library_folders (
      id          SERIAL PRIMARY KEY,
      tutor_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id   INTEGER      REFERENCES library_folders(id) ON DELETE CASCADE,
      title       VARCHAR(120) NOT NULL,
      book        VARCHAR(40),
      unit        VARCHAR(10),
      position    INTEGER      NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_library_folders_tutor ON library_folders (tutor_id, parent_id, position);
    ALTER TABLE library_items ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES library_folders(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_library_items_folder ON library_items (folder_id);
  `);
}

// Папка принадлежит этому репетитору? null — «без папки» (можно), undefined — чужая или нет такой
async function ownFolder(folderId, tutorId) {
  if (folderId === null || folderId === undefined) return null;
  const { rows } = await query('SELECT id FROM library_folders WHERE id = $1 AND tutor_id = $2', [folderId, tutorId]);
  return rows[0] ? rows[0].id : undefined;
}

// Папка и все её подпапки (для показа содержимого папки учебника целиком)
async function folderWithChildren(folderId, tutorId) {
  const { rows } = await query(
    `WITH RECURSIVE t AS (
       SELECT id FROM library_folders WHERE id = $1 AND tutor_id = $2
       UNION ALL
       SELECT f.id FROM library_folders f JOIN t ON f.parent_id = t.id
     ) SELECT id FROM t`,
    [folderId, tutorId]
  );
  return rows.map((r) => r.id);
}

// Папка юнита для задания из банка: если у репетитора есть папка этого учебника и юнита
async function folderForUnit(tutorId, book, unit) {
  const { rows } = await query(
    `SELECT id FROM library_folders WHERE tutor_id = $1 AND book = $2 AND unit = $3 ORDER BY id LIMIT 1`,
    [tutorId, book, unit]
  );
  if (rows[0]) return rows[0].id;
  const { rows: top } = await query('SELECT id FROM library_folders WHERE tutor_id = $1 AND book = $2 AND unit IS NULL ORDER BY id LIMIT 1', [tutorId, book]);
  return top[0] ? top[0].id : null;
}

async function start() {
  try {
    await ensure();
  } catch (err) {
    console.error('📁 Папки библиотеки не запустились:', err.message);
  }
}

module.exports = { ensure, start, ownFolder, folderWithChildren, folderForUnit };
