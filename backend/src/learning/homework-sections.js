// Для запросов с алиасами homework h и assignments a. NULL при личном переносе
// означает «Без раздела», а не возврат к общему разделу задания.
const HOMEWORK_SECTION = "(SELECT section.id FROM study_sections section WHERE section.id=(CASE WHEN h.section_overridden THEN h.section_id ELSE a.section_id END) AND section.subject=h.subject)";
module.exports={HOMEWORK_SECTION};
