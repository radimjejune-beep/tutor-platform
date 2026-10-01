// scripts/create-tutor.js — создать учётку репетитора (один раз, из терминала)
// Запуск: npm run create-tutor -- radim "Радим Кочка"
// Пароль будет выведен один раз — после первого входа система попросит его сменить.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { generateTempPassword, normalizeLogin } = require('../src/utils');

(async () => {
  const [rawLogin, fullName] = process.argv.slice(2);
  const login = normalizeLogin(rawLogin);
  if (!/^[a-z0-9._-]{3,64}$/.test(login) || !fullName) {
    console.error('❌ Использование: npm run create-tutor -- логин "Имя Фамилия"  (логин латиницей, от 3 символов)');
    process.exit(1);
  }
  try {
    const password = generateTempPassword(12);
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (role, login, password_hash, full_name, must_change_password)
       VALUES ('tutor', $1, $2, $3, TRUE)`,
      [login, hash, fullName]
    );
    console.log(`✅ Репетитор создан, логин: ${login}`);
    console.log(`🔑 Временный пароль: ${password}`);
  } catch (err) {
    console.error('❌ Не удалось создать:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
