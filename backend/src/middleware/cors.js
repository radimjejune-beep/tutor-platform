// Собственные домены платформы разрешены независимо от старой настройки хостинга.
// Дополнительные адреса задаются явно; чужие *.relaxdev.ru автоматически не допускаются.
const PLATFORM_ORIGINS = ['https://lessonfold.ru', 'https://www.lessonfold.ru'];

function allowedOrigins(value = process.env.FRONTEND_ORIGINS) {
  const configured = String(value || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter((s) => /^https?:\/\//.test(s));
  return [...new Set([...PLATFORM_ORIGINS, ...configured])];
}

module.exports = { allowedOrigins };
