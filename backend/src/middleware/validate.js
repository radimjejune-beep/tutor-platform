// middleware/validate.js — проверка тела запроса по схеме zod
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => `${i.path.join('.') || 'тело'}: ${i.message}`);
      return res.status(400).json({ error: 'Проверьте заполнение полей', details });
    }
    req.body = result.data;
    next();
  };
}

// Обёртка для async-обработчиков: ошибки уходят в общий обработчик
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { validateBody, asyncHandler };
