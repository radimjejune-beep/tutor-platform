// Для запросов с алиасами homework h и assignments a. NULL при личном переносе
// означает «Без раздела», а не возврат к общему разделу задания.
const HOMEWORK_SECTION = 'CASE WHEN h.section_overridden THEN h.section_id ELSE a.section_id END';
module.exports={HOMEWORK_SECTION};
