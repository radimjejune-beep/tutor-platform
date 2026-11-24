// Original Lessonfold French A1 explanations and practice. No textbook excerpts.
module.exports=topic=>{
 const make=(id,title,aliases,when,form,examples,mistake,questions)=>topic('fr-'+id,title,'A1',aliases,when,form,examples,mistake,questions);
 make('etre','Être: настоящее время','etre|être|французский быть','Чтобы назвать человека, описать состояние или сказать, где он находится.','Je suis, tu es, il / elle / on est, nous sommes, vous êtes, ils / elles sont.','Je suis au café.|Nous sommes prêts.|Vous êtes à Paris.','Форма зависит от подлежащего. После nous — sommes, после ils — sont.',`
Je ___ au bureau. :: suis :: es|est
Tu ___ à la maison. :: es :: suis|est
Elle ___ contente. :: est :: es|sont
Nous ___ en classe. :: sommes :: êtes|sont
Vous ___ à Lyon. :: êtes :: sommes|est
Ils ___ prêts. :: sont :: sommes|êtes
On ___ ici. :: est :: sommes|sont
Mes voisins ___ français. :: sont :: est|êtes`);
 make('avoir','Avoir: настоящее время','avoir|авуар|французский иметь','Чтобы сказать о наличии, возрасте и состояниях faim или soif.','J’ai, tu as, il / elle / on a, nous avons, vous avez, ils / elles ont.','J’ai un vélo.|Elle a seize ans.|Nous avons faim.','Возраст выражают с avoir: Elle a seize ans. Перед ai пишется j’, а не je.',`
J’___ un petit chat. :: ai :: as|a
Tu ___ un livre. :: as :: ai|ont
Elle ___ faim. :: a :: est|as
Nous ___ des amis ici. :: avons :: avez|ont
Vous ___ le temps. :: avez :: avons|a
Ils ___ une voiture. :: ont :: sont|avons
Ma sœur ___ quinze ans. :: a :: est|ont
On ___ un plan. :: a :: as|avez`);
 make('present-er','Présent: правильные глаголы на -er','present er|présent|parler|глаголы er|французское настоящее','Чтобы говорить о привычках и действиях в настоящем. Здесь только обычные модели на -er, без aller.','Убери -er и добавь -e, -es, -e, -ons, -ez, -ent. Parler → je parle, nous parlons.','Tu regardes un film.|Nous parlons français.|Elles travaillent ici.','Окончание зависит от подлежащего. Не переносите окончания английского Present Simple во французский.',`
J’___ une chanson. (écouter) :: écoute :: écoutes|écoutent
Tu ___ un film. (regarder) :: regardes :: regarde|regardez
Elle ___ ici. (travailler) :: travaille :: travaillent|travailles
Nous ___ français. (parler) :: parlons :: parlent|parlez
Vous ___ ce livre. (aimer) :: aimez :: aimons|aiment
Ils ___ à Nantes. (habiter) :: habitent :: habitez|habite
Paul ___ le français. (étudier) :: étudie :: étudies|étudions
On ___ un jardin. (dessiner) :: dessine :: dessinent|dessines`);
 make('negation','Отрицание: ne … pas','ne pas|отрицание по французски|négation','Чтобы отрицать действие или состояние в простом настоящем времени.','Ne ставится перед личной формой глагола, pas — после. Перед гласной или немым h: n’.','Je ne parle pas italien.|Elle n’aime pas le café.|Nous ne sommes pas en retard.','В учебном письменном тексте сохраняйте обе части отрицания. Перед aime и ai используйте n’, а не ne.',`
Je ___ pas italien. :: ne parle :: parle ne|parle
Elle ___ pas le café. :: n’aime :: ne aime|aime
Nous ___ pas ici. :: n’habitons :: ne habitons|habitons
Tu ___ pas la télévision. :: ne regardes :: regardes ne|regardes
Ils ___ pas en retard. :: ne sont :: sont ne|sont
Vous ___ pas de voiture. :: n’avez :: ne avez|avez
On ___ pas de bruit. :: ne fait :: fait ne|fait
Je ___ pas faim. :: n’ai :: ne ai|ai`);
 make('articles','Артикли: un, une, des и le, la, les','articles français|артикли французский|un une des|le la les','Неопределённый артикль знакомит с предметом. Определённый помогает указать на известный или конкретный предмет.','Un — мужской род, une — женский, des — множественное число. Le / la / les — определённые формы; перед гласной или немым h — l’.','C’est une table.|Il a un stylo.|Le chat de Julie dort.','Род нужно учить вместе с существительным. Перед école используется l’, а не la без сокращения.',`
C’est ___ table. :: une :: un|des
Il a ___ stylo. :: un :: une|des
Voici ___ livres. :: des :: un|une
La sœur de Léa s’appelle Zoé. ___ sœur de Léa est à Paris. :: La :: Le|Les
___école de ce village est petite. :: L’ :: La|Le
Je cherche ___ appartement. :: un :: une|des
Voici ___ fleurs pour toi. :: des :: une|un
___ chat de Julie dort. :: Le :: La|Les`);
 make('questions','Вопросы: est-ce que и вопросительные слова','est ce que|questions français|où|combien|comment|французские вопросы','Чтобы уточнить место, время, цену, причину или задать общий вопрос.','Est-ce que + подлежащее + глагол. Où — где, quand — когда, combien — сколько, pourquoi — почему.','Est-ce que tu parles français ?|Où habites-tu ?|Combien coûte ce billet ?','Не добавляйте английское do. Перед гласной que сокращается: Est-ce qu’elle travaille ici ?',`
___ tu parles français ? :: Est-ce que :: Est-ce qu’|Est que
Comment ___ appelez-vous ? :: vous :: tu|ils
___ habites-tu ? (место) :: Où :: Quand|Pourquoi
___ coûte ce billet ? (цена) :: Combien :: Comment|Où
___ arrive le train ? (время) :: Quand :: Où|Pourquoi
___ est ton prénom ? :: Quel :: Quelle|Quels
___ vas-tu au marché ? — Parce que j’ai besoin de fruits. :: Pourquoi :: Combien|Quand
Tu travailles ici ? — Oui, ___. :: je travaille ici :: tu travailles ici|ils travaillent ici`);
};
