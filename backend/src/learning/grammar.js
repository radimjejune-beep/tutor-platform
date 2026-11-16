// Справочник Lessonfold: объяснения и вопросы составлены для платформы.
// Ключи тем постоянны: на них ссылаются программа, разделы и снимки диагностик.
const topics = [];
function topic(id, title, level, aliases, when, form, examples, mistake, questions) {
  const quiz = questions.trim().split('\n').map((line, i) => {
    const [prompt, answer, wrong] = line.trim().split(' :: ');
    const correct = answer.split('|');
    return { id: `q${i+1}`, topic_id:id, type:wrong ? 'choice':'text', prompt,
      options:wrong ? [correct[0], ...wrong.split('|')]:[], correct:wrong ? [0]:correct,
      points:1, explanation:form };
  });
  topics.push({id,title,level,aliases:aliases.split('|'),when,form,examples:examples.split('|'),mistake,questions:quiz});
}
topic('be','Глагол be: am, is, are','A1','to be|am is are|глагол быть|би',
'Чтобы назвать человека, описать его или сказать, где он находится. В настоящем времени нужен am, is или are.',
'I am. He / she / it is. You / we / they are. Отрицание: not после be. Вопрос: be перед подлежащим.',
'I am twelve.|She is not at home.|Are you ready?',
'В вопросах с be не нужен do: Is she happy? Сочетание Does she is happy? неверно.',`
My sister ___ twelve. :: is :: am|are
___ you at home? :: Are :: Is|Am
I ___ a student. :: am
They ___ my friends. :: are
He ___ not tired. :: is
___ your parents at work? :: Are`);
topic('have-got','Have got: что у меня есть','A1','have got|has got|иметь|хэвгот',
'Have got сообщает о семье, внешности и том, чем человек владеет.',
'I / you / we / they have got; he / she / it has got. Вопрос: Have / Has + подлежащее + got? Отрицание: haven’t / hasn’t got.',
'I have got a bike.|Has she got a sister?|We haven’t got a car.',
'После he / she / it выбирай has got. В конструкции Have you got …? не добавляй do.',`
She ___ got a dog. :: has :: have|is
___ they got a car? :: Have :: Has|Are
I ___ got two brothers. :: have
___ Ben got blue eyes? :: Has
We ___ got a garden. (отрицание: впиши haven’t / have not) :: haven't|have not
Eva ___ got a sister. (отрицание: впиши hasn’t / has not) :: hasn't|has not`);
topic('present-simple','Present Simple: привычки и факты','A1','простое настоящее|презент симпл|present simple questions|present simple: questions|do does|презентсимпл',
'Используй для привычек, повторяющихся действий и фактов. Подсказки: every day, usually, often.',
'I / you / we / they + глагол. He / she / it + глагол с -s / -es. Вопрос: Do / Does + подлежащее + начальная форма? Отрицание: don’t / doesn’t + начальная форма.',
'She works at school.|Does she work on Fridays?|We don’t watch TV in the morning.',
'После does и doesn’t убирай -s: Does he play? He doesn’t play.',`
She ___ to school every day. (go) :: goes :: go|going
___ your brother like chess? :: Does :: Do|Is
We ___ in a small town. (live) :: live
Ben ___ not watch TV on weekdays. (do) :: does
___ you walk to school? :: Do
Mia ___ English on Mondays. (study) :: studies`);
topic('present-continuous','Present Continuous: действие сейчас','A1','настоящее длительное|презент континиус|present progressive|действие сейчас',
'Действие происходит сейчас или временно в этот период. Подсказки: now, at the moment, Look!',
'Am / is / are + глагол с -ing. Для отрицания добавь not после be; в вопросе поставь be перед подлежащим.',
'I am reading now.|They aren’t sleeping.|Is she cooking?',
'Не пропускай am / is / are. He reading недостаточно: He is reading.',`
Look! She ___ a picture. (draw) :: is drawing :: draws|draw
They ___ playing chess now. :: are :: is|do
I ___ listening to music now. :: am
___ Ben sleeping at the moment? :: Is
We ___ dinner now. (cook) :: are cooking|'re cooking
What ___ you doing now? :: are`);
topic('simple-or-continuous','Present Simple или Present Continuous','A2','present simple vs present continuous|симпл или континиус|обычно или сейчас',
'Сравни обычное действие и то, что происходит сейчас. Сначала найди смысл и слова-подсказки.',
'Usually / every day → Present Simple. Now / at the moment → Present Continuous: am / is / are + -ing. Know, want, like в обычном значении чаще используют в Simple.',
'I walk to school every day.|Today I am taking the bus.|I know the answer.',
'Look! требует внимания к действию сейчас. Every Monday указывает на повторение.',`
She usually ___ tea in the morning. (drink) :: drinks :: is drinking|drink
Look! The boys ___ football. (play) :: are playing :: play|plays
I ___ the answer. (know) :: know
We ___ a film at the moment. (watch) :: are watching|'re watching
Ben ___ on Saturdays. (work) :: works
Listen! Someone ___ at the door. (knock) :: is knocking`);
topic('past-simple','Past Simple: завершённое прошлое','A1','простое прошедшее|паст симпл|did|неправильные глаголы',
'Действие завершилось в прошлом: yesterday, last week, in 2020. Важно, когда оно произошло.',
'Правильные глаголы: -ed. Неправильные: вторая форма (go → went). Вопрос: Did + начальная форма? Отрицание: didn’t + начальная форма.',
'We visited a museum yesterday.|Did you see it?|She didn’t go out.',
'После did / didn’t нужна первая форма: Did she go? Не Did she went?',`
Yesterday we ___ to the park. (go) :: went :: go|gone
___ you see the film last night? :: Did :: Do|Were
She ___ her aunt last week. (visit) :: visited
He didn't ___ the answer. (know) :: know
I ___ a new book yesterday. (buy) :: bought
They ___ dinner at six yesterday. (have) :: had`);
topic('was-were','Was / were: be в прошлом','A1','was were|был была были|би в прошлом',
'Для состояний, описания и местонахождения в прошлом используй прошедшие формы be.',
'I / he / she / it was; you / we / they were. Wasn’t / weren’t — отрицание. В вопросе Was / Were идёт первым.',
'I was at home.|They weren’t tired.|Were you at school?',
'С be в прошлом не нужен did: Was he there? Не Did he was there?',`
I ___ at home yesterday. :: was :: were|am
___ your friends late? :: Were :: Was|Did
She ___ happy last week. :: was
We ___ in London in May. :: were
___ Ben at the library yesterday? :: Was
They ___ not ready at six. :: were`);
topic('past-continuous','Past Continuous: процесс в прошлом','A2','паст континиус|прошедшее длительное|was doing|were doing',
'Описывает действие, которое продолжалось в определённый момент прошлого, или фон для другого события.',
'Was / were + глагол с -ing. I / he / she / it was; you / we / they were.',
'I was reading at eight.|They were playing when I arrived.|Was she sleeping?',
'Когда короткое событие прерывает процесс, процесс обычно Continuous, событие — Simple.',`
At eight yesterday I ___ a book. (read) :: was reading :: am reading|readed
They ___ playing when I arrived. :: were :: was|are
She ___ sleeping at midnight. :: was
What ___ you doing at five yesterday? :: were
We ___ dinner when Ben called. (have) :: were having
While I was walking, I ___ a friend. (see) :: saw`);
topic('present-perfect','Present Perfect: опыт и результат','A2','презент перфект|настоящее совершенное|have done|has done',
'Связь прошлого с настоящим: опыт без точного времени, недавний результат, действие до настоящего момента.',
'Have / has + третья форма глагола. Вопрос: Have / Has + подлежащее + третья форма? Отрицание: haven’t / hasn’t.',
'I have lost my key.|Have you ever tried sushi?|She hasn’t finished yet.',
'С yesterday и last week обычно нужен Past Simple. У he / she / it вспомогательный глагол has.',`
She ___ finished her work. :: has :: have|is
Have you ever ___ to Spain? (be) :: been :: went|was
We have ___ lunch already. (have) :: had
I haven't ___ the film yet. (see) :: seen
___ you ever tried this dish? :: Have
Ben has ___ his keys. (lose) :: lost`);
topic('perfect-or-past','Present Perfect или Past Simple','A2','present perfect vs past simple|перфект или паст|опыт и точное время',
'Past Simple сообщает, когда закончено действие. Present Perfect связывает опыт или результат с настоящим без законченного времени.',
'Yesterday / last year / in 2020 → Past Simple. Ever / never / already / yet без законченного времени → Present Perfect.',
'I saw it yesterday.|I have already seen it.|Have you ever visited Rome?',
'В одной фразе I have visited Rome last year смешаны два способа отсчёта. С last year: I visited.',`
I ___ that film yesterday. (see) :: saw :: have seen|seen
She has already ___ dinner. (cook) :: cooked :: cook|cooking
We ___ to Spain in 2021. (go) :: went
Have you ever ___ a horse? (ride) :: ridden
He ___ his homework last night. (finish) :: finished
They have never ___ sushi. (try) :: tried`);
topic('perfect-continuous','Present Perfect Continuous','B1','презент перфект континиус|have been doing|действие до сих пор',
'Подчёркивает длительность процесса, который начался раньше и продолжается, или его видимый результат сейчас.',
'Have / has been + глагол с -ing. For — период, since — начало отсчёта.',
'I have been reading for an hour.|She has been working since nine.|Have you been waiting long?',
'Для know в значении знания используй Perfect Simple: I have known her for years.',`
She ___ been studying for two hours. :: has :: have|is
I have been ___ since nine. (work) :: working :: worked|work
We ___ been waiting for an hour. :: have
It has been ___ all day. (rain) :: raining
He has been sleeping ___ noon. (since / for) :: since
I have been reading ___ two hours. (since / for) :: for`);
topic('past-perfect','Past Perfect: раньше другого прошлого','B1','паст перфект|had done|предпрошедшее',
'Помогает показать, что одно действие произошло раньше другого момента в прошлом.',
'Had + третья форма для всех лиц. Отрицание hadn’t. Вопрос Had + подлежащее + третья форма?',
'When I arrived, the film had started.|She hadn’t eaten before the trip.|Had he left by noon?',
'Сначала установи два момента в прошлом. Past Perfect отмечает более ранний из них.',`
By the time we arrived, the film ___ started. :: had :: has|was
She had ___ before I called. (leave) :: left :: leave|leaving
I had ___ breakfast before the lesson. (have) :: had
They had ___ the tickets before Friday. (buy) :: bought
___ Ben finished before you arrived? :: Had
We hadn't ___ that place before the trip. (see) :: seen`);
topic('future-will','Future Simple: will','A1','будущее время|фьюче симпл|will|обещания',
'Для решений в момент речи, обещаний, предложений помощи и прогнозов-мнений.',
'Will + начальная форма. Одинаково для всех лиц. Отрицание won’t (will not), вопрос Will + подлежащее + глагол?',
'I’ll help you.|I think it will rain.|Will she come?',
'После will не ставь to и не меняй глагол: will go, не will to go и не will goes.',`
I promise I ___ help you. :: will :: am|do
She will ___ tomorrow. (come) :: come :: comes|to come
___ you help me with this bag? :: Will
I think they ___ win. :: will
He will not ___ late. (be) :: be
The phone is ringing. I ___ answer it. :: will|'ll`);
topic('going-to','Be going to: планы и признаки','A1','going to|собираться|гоинг ту|планы на будущее',
'Для заранее принятого намерения и прогноза, у которого есть видимые признаки сейчас.',
'Am / is / are going to + начальная форма. Вопрос начинай с am / is / are.',
'I am going to study tonight.|Look at the clouds! It is going to rain.|Are they going to travel?',
'Не пропускай be и не добавляй -ing после to: She is going to visit us.',`
She ___ going to visit her aunt. :: is :: are|does
We are going to ___ by train. (travel) :: travel :: travelling|travels
I ___ going to pack tonight. :: am
___ you going to cook dinner? :: Are
Look at those clouds! It ___ going to rain. :: is
What ___ Ben going to do? :: is`);
topic('future-arrangements','Будущее: will, going to, Present Continuous','A2','будущие формы|future forms|договорённости|present continuous future',
'Выбор зависит от смысла: решение сейчас, заранее принятое намерение или конкретная договорённость.',
'Will — решение сейчас / мнение. Going to — намерение / видимый признак. Present Continuous — организованная встреча или поездка с договорённостью.',
'I’ll carry it.|I’m going to learn Spanish.|We’re meeting at six; it’s arranged.',
'Несколько форм могут быть возможны в живой речи. В заданиях обращай внимание на явно указанную ситуацию.',`
The phone is ringing. I ___ answer it. (решение сейчас) :: will :: was|did
We ___ meeting our guide at ten; it is arranged. :: are :: do|have
Look at the clouds! It is going to ___. (rain) :: rain
I promise I will ___ on time. (be) :: be
She is ___ to start a course next month. (going / go) :: going
I am ___ to Rome tomorrow; I have my ticket. (fly) :: flying`);
topic('future-continuous','Future Continuous','B1','фьюче континиус|will be doing|процесс в будущем',
'Действие будет продолжаться в определённый момент будущего.',
'Will be + глагол с -ing. Вопрос Will + подлежащее + be + -ing?',
'This time tomorrow I will be travelling.|Will you be working at six?|She won’t be sleeping then.',
'Нужны и be, и форма -ing: will be working.',`
This time tomorrow I will ___ flying. :: be :: been|being
At six tomorrow she will be ___. (work) :: working :: worked|work
We ___ be travelling at noon tomorrow. :: will
Will you ___ waiting at the station? :: be
He will be ___ at ten tonight. (sleep) :: sleeping
They will be ___ tennis at five. (play) :: playing`);
topic('questions','Вопросы: порядок слов и question words','A1','вопросительные слова|wh questions|порядок слов в вопросе|who what where when why how',
'Выбери, какую информацию ты спрашиваешь: кто, что, где, когда, почему или как.',
'Question word + вспомогательный глагол + подлежащее + смысловой глагол. С be ставь сам be перед подлежащим. Вопрос к подлежащему who может обходиться без do.',
'Where do you live?|Why is she tired?|Who lives here?',
'Не забывай do / does / did в вопросах к обычному глаголу: Where does she work?',`
___ do you live? — In Kazan. :: Where :: When|Why
___ is your birthday? — In May. :: When :: Who|Where
___ are you sad? — Because I lost my toy. :: Why
What ___ your sister do after school? :: does
___ old are you? — Twelve. :: How
Where ___ Ben yesterday? — At home. :: was`);
topic('frequency','Наречия частоты','A1','adverbs of frequency|always usually often sometimes never|как часто',
'Показывают, как часто происходит действие: always, usually, often, sometimes, rarely, never.',
'Чаще ставь наречие перед обычным глаголом и после be. How often? спрашивает о частоте.',
'She often reads.|He is never late.|We swim twice a week.',
'Never уже содержит отрицание: I never go, без don’t.',`
Choose the correct sentence. :: She is never late. :: She never is late.|She is late never.
Twice a week means ___. :: two times each week :: every two weeks|once a week
How ___ do you swim? — Twice a week. :: often
I ___ watch horror films. (никогда) :: never
She ___ gets up early. (обычно) :: usually
We visit our aunt ___ a month. (один раз) :: once`);
topic('articles','Артикли: a, an, the и без артикля','A1','articles|артикль|a an the',
'A / an вводит один исчисляемый предмет впервые. The указывает на уже известный или определённый предмет. С общими неисчисляемыми и множественным числом артикль часто не нужен.',
'A перед согласным звуком, an перед гласным звуком. The — когда понятно, о каком предмете речь.',
'I saw a dog. The dog was black.|She is an engineer.|I like music.',
'Выбирай по звуку: an hour, но a university. Не ставь a перед неисчисляемым advice.',`
She is ___ engineer. :: an :: a|the
I bought a book. ___ book is interesting. :: The :: A|An
He has ___ umbrella. :: an
It takes ___ hour. :: an
She studies at ___ university. :: a
I like ___ music. (впиши —, если артикль не нужен) :: —|-|no article`);
topic('plurals','Множественное число существительных','A1','plural|plurals|множественное число|children mice',
'Для нескольких исчисляемых предметов нужна форма множественного числа.',
'Обычно -s; после s, sh, ch, x — -es; согласная + y → -ies. Есть неправильные формы: child → children, man → men.',
'Two books.|Three boxes.|Five children.',
'Не добавляй -s к children. У слова people в значении людей уже множественное число.',`
One child, two ___. :: children :: childs|childes
One box, three ___. :: boxes :: boxs|box
One city, two ___. :: cities
One man, two ___. :: men
One mouse, three ___. :: mice
One woman, two ___. :: women`);
topic('countable','Исчисляемые и неисчисляемые','A1','countable uncountable|исчисляемость|much many|a few a little',
'Исчисляемые предметы можно посчитать поштучно. Неисчисляемые в данном значении считают через меры и упаковки.',
'Many / a few + исчисляемое множественное. Much / a little + неисчисляемое. A bottle of water, a piece of advice.',
'How many apples?|How much rice?|There is a little milk.',
'Information, advice, furniture обычно неисчисляемые. Для одной единицы: a piece of information.',`
How ___ apples do we need? :: many :: much|little
There is ___ rice left. :: a little :: a few|many
How ___ water is there? :: much
We need a ___ of bread. (буханка) :: loaf
There are a ___ eggs in the box. (few / little) :: few
She gave me a piece of ___. (advice / advices) :: advice`);
topic('some-any','Some, any, no и составные местоимения','A1','some any|something anything|someone anyone|неопределённые местоимения',
'Some часто употребляют в утверждениях и предложениях чего-либо. Any — в вопросах и отрицаниях. No само даёт отрицательный смысл.',
'Some / any + существительное. Someone / anyone — человек, something / anything — вещь. После no не добавляй ещё одно отрицание.',
'There are some apples.|Is there any milk?|Would you like something to drink?',
'I don’t have any money и I have no money — два способа отрицания. Не I don’t have no money.',`
There aren't ___ apples. :: any :: some|a
Would you like ___ tea? :: some :: any|many
Is there ___ milk in the fridge? :: any
There is ___ at the door. I can hear a person. :: someone|somebody
There isn't ___ in the empty box. :: anything
I have ___ money at all. (никаких денег, впиши no) :: no`);
topic('there-is','There is / there are','A1','there is there are|есть находится|оборот there',
'Чтобы сообщить, что что-то существует или находится в определённом месте.',
'There is + единственное / неисчисляемое. There are + множественное. Вопрос: Is / Are there …?',
'There is a chair.|There are two windows.|Is there any water?',
'Согласуй форму с предметом после оборота: There are three books.',`
There ___ two chairs in the room. :: are :: is|am
___ there a park near your house? :: Is :: Are|Does
There ___ some milk in the fridge. :: is
___ there any shops nearby? :: Are
There ___ a book on the desk. :: is
There ___ not any windows in this room. :: are`);
topic('pronouns','Личные и объектные местоимения','A1','personal pronouns|object pronouns|i me he him she her|местоимения',
'Личное местоимение выполняет действие. Объектное стоит после глагола или предлога.',
'I → me; he → him; she → her; we → us; they → them. You и it не меняются.',
'She knows me.|I can help them.|Come with us.',
'После with, for, to используй объектную форму: with him, не with he.',`
Eva is my friend. I like ___. :: her :: she|hers
Ben is here. Talk to ___. :: him :: he|his
We are waiting. Come with ___. :: us
The twins are outside. Can you see ___? :: them
I need help. Please help ___. :: me
My sister is kind. ___ often helps me. :: She`);
topic('possessives','Притяжательные формы: my, mine, ’s','A1','possessive adjectives|possessive pronouns|my mine your yours|притяжательные местоимения|притяжательный падеж',
'Показывают принадлежность. My / your / her ставятся перед предметом; mine / yours / hers заменяют сочетание целиком.',
'My book → the book is mine. Her bag → the bag is hers. Emma’s bag; the boys’ room; the children’s toys.',
'This is my pen.|This pen is mine.|These are the children’s books.',
'Не ставь предмет после mine: mine book неверно. У hers нет апострофа.',`
This pen belongs to me. It is ___. :: mine :: my|me
Eva has a dog. ___ dog is brown. :: Her :: Hers|She
These tickets belong to us. They are ___. :: ours
This is ___ bag. (Emma) :: Emma's
These are the ___ toys. (children) :: children's
This coat belongs to you. It is ___. :: yours`);
topic('reflexives','Возвратные местоимения','A2','reflexive pronouns|myself yourself himself herself ourselves themselves|сам самостоятельно',
'Действие направлено на самого исполнителя или подчёркивается, что он сделал что-то сам.',
'I → myself; you → yourself / yourselves; he → himself; she → herself; it → itself; we → ourselves; they → themselves.',
'I made it myself.|She hurt herself.|We enjoyed ourselves.',
'Выбирай форму по исполнителю действия: They … themselves, We … ourselves.',`
I made the cake ___. :: myself :: himself|ourselves
They enjoyed ___. :: themselves :: ourselves|yourselves
She taught ___ to draw. :: herself
We cooked dinner ___. :: ourselves
Ben hurt ___ while playing. :: himself
You can do it ___. (один человек) :: yourself`);
topic('comparisons','Сравнительная и превосходная степень','A1','comparative|superlative|степени сравнения|as as|bigger biggest',
'Сравнительная степень сопоставляет два объекта. Превосходная выделяет один из группы.',
'Короткие прилагательные: -er / the -est. Длинные: more / the most. Good → better → the best. As … as — такой же.',
'This room is bigger.|It is the most interesting book.|She is as tall as me.',
'Не совмещай more и -er: bigger, не more bigger. После сравнительной формы обычно than.',`
This bag is ___ than mine. (big) :: bigger :: biggest|more bigger
This is the ___ day of the year. (hot) :: hottest :: hotter|most hot
The film is ___ interesting than the book. :: more
This is the ___ cafe in town. (good) :: best
Mia is as tall ___ Ben. :: as
This chair is ___ comfortable than that one. (more / most) :: more`);
topic('adverbs','Прилагательные и наречия','A2','adjectives adverbs|наречия|slow slowly|good well',
'Прилагательное описывает предмет или человека. Наречие часто описывает, как выполняется действие.',
'Обычно adjective + -ly: slow → slowly. Good → well. Fast и hard могут быть наречиями без -ly.',
'She is a careful driver.|She drives carefully.|He runs fast.',
'После look в значении «выглядеть» обычно прилагательное: You look happy. Hardly значит «едва», а не «усердно».',`
She drives ___. (careful) :: carefully :: careful|care
He is a ___ driver. (careful) :: careful :: carefully|care
Ben speaks English ___. (good) :: well
The train moves ___. (slow) :: slowly
She runs very ___. (fast) :: fast
You look ___. (happy / happily) :: happy`);
topic('time-prepositions','Предлоги времени: in, on, at','A1','prepositions of time|in on at|предлоги времени|даты и время',
'Предлог зависит от масштаба времени: месяц / год, конкретный день или точное время.',
'In + месяц, год, сезон. On + день недели, дата. At + часы, noon, midnight, night.',
'In July.|On Monday.|At half past six.',
'Перед last, next, every обычно нет in / on / at: next week, every Monday.',`
The party is ___ Saturday. :: on :: in|at
We meet ___ six o'clock. :: at :: in|on
My birthday is ___ May. :: in
She was born ___ 2012. :: in
The train leaves ___ midnight. :: at
We meet ___ 12 June. :: on`);
topic('place-prepositions','Предлоги места и направления','A1','prepositions of place|under above behind between opposite|предлоги места|направления',
'Показывают, где предмет находится или куда движется человек.',
'In — внутри; on — на поверхности; under — под; behind — за; between — между; opposite — напротив; to — направление к.',
'The book is on the table.|The cat is under the chair.|We go to school.',
'Различай место и движение: at school — в школе, to school — в школу.',`
The cat is ___ the chair. (под) :: under :: above|between
The bank is ___ the library. (напротив) :: opposite :: inside|above
The lamp is ___ the desk. (на поверхности) :: on
The ball is ___ the box. (внутри) :: in
The shop is ___ the bank and the cafe. (между) :: between
We go ___ school every day. (направление) :: to`);
topic('can-could','Can / could: умение и просьбы','A1','can could|мочь уметь|кэн куд|способности',
'Can выражает умение, возможность или просьбу. Could — умение в прошлом и более вежливая просьба.',
'Can / could + начальная форма без to. Вопрос начинается с can / could. Отрицание can’t / couldn’t.',
'I can swim.|Could you help me?|She couldn’t read at three.',
'Не добавляй -s к can и не ставь to после него: She can sing.',`
She can ___ very well. (swim) :: swim :: swims|to swim
___ you help me, please? (впиши Could) :: Could :: Does|Are
He ___ read when he was five. (умел) :: could
I ___ drive. (не умею, can) :: can't|cannot|can not
Can Ben ___ the guitar? (play) :: play
We couldn't ___ the door. (open) :: open`);
topic('must-have-to','Must, have to, mustn’t, don’t have to','A2','обязанности|запреты|must have to|neednt|need not|не обязательно',
'Выражают обязанность, запрет и отсутствие необходимости. Особенно важно различать запрет и необязательность.',
'Must / have to — надо. Mustn’t — запрещено. Don’t have to / needn’t — не обязательно. He / she has to.',
'You must wear a helmet.|You mustn’t touch it.|You don’t have to book.',
'Mustn’t не значит «не обязан». После must нужен глагол без to.',`
She ___ to wear a uniform. :: has :: have|must
You ___ touch the paintings. (запрещено) :: mustn't :: don't have to|needn't
We ___ bring food; lunch is included. (не обязательно) :: don't have to|do not have to|needn't|need not
You must ___ quiet. (be) :: be
___ he have to work today? :: Does
You ___ not run here. (must / have) :: must`);
topic('should','Should: советы','A1','should shouldnt|следует|советы|шуд',
'Should помогает дать совет или сказать, что полезно сделать в ситуации.',
'Should / shouldn’t + начальная форма без to. Вопрос Should + подлежащее + глагол?',
'You should rest.|He shouldn’t stay up late.|Should I call her?',
'Не меняй should по лицам и не ставь to: She should sleep.',`
You should ___ a doctor. (see) :: see :: sees|to see
He ___ stay up late. (не следует) :: shouldn't :: doesn't should|shoulds not
___ I call her? :: Should
You should ___ a helmet. (wear) :: wear
We should not ___ here. (wait) :: wait
She ___ drink more water. (следует) :: should`);
topic('imperative','Повелительное наклонение','A1','imperative|приказы|инструкции|dont|команды|повелительное',
'Для коротких указаний, просьб и инструкций.',
'Утверждение начинается с начальной формы: Look! Отрицание: Don’t + глагол. Please делает просьбу вежливее.',
'Open the window, please.|Don’t run.|Look both ways.',
'Не добавляй to в начале: Open the book. После don’t тоже нужен глагол без to.',`
___ both ways before crossing. (look) :: Look :: To look|Looks
___ run across the road. :: Don't :: Not|No
___ your books, please. (open) :: Open
Don't ___ the animals. (feed) :: feed
___ quiet, please. (be) :: Be
Don't ___ out of the window. (lean) :: lean`);
topic('gerund-infinitive','Герундий и инфинитив','A2','gerund infinitive|ing или to|like doing|want to|enjoy doing',
'После разных глаголов нужны разные формы: -ing или to + начальная форма. Их удобно учить сочетаниями.',
'Enjoy / avoid / finish + -ing. Want / decide / hope + to + глагол. После like часто возможны обе формы с разными оттенками.',
'I enjoy reading.|She wants to travel.|We decided to stay.',
'После enjoy не ставь to: enjoy swimming. После want не оставляй голый глагол: want to go.',`
I enjoy ___ books. (read) :: reading :: to read|read
She wants ___ travel. :: to :: for|at
We decided ___ stay home. :: to
He finished ___ the letter. (write) :: writing
They hope ___ win. :: to
Please avoid ___ noise. (make) :: making`);
topic('conditionals','Условные предложения: zero и first','A2','zero conditional|first conditional|if|условные предложения|первое условное',
'Zero Conditional описывает закономерность. First Conditional — реальную возможность в будущем.',
'Zero: if + Present Simple, Present Simple. First: if + Present Simple, will + глагол.',
'If you heat ice, it melts.|If it rains, we will stay home.|I’ll call if I have time.',
'В обычном условии о будущем после if не нужен will: If she comes, I will tell her.',`
If it rains, we ___ stay home. :: will :: would|did
If you heat ice, it ___. (melt) :: melts :: melted|will melting
If she ___, I will tell her. (come) :: comes
I will help if I ___ time. (have) :: have
If you don't hurry, you ___ miss the bus. :: will
If water gets very cold, it ___. (freeze) :: freezes`);
topic('second-conditional','Second Conditional: воображаемые ситуации','B1','second conditional|второе условное|if i were|would',
'Для воображаемой или маловероятной ситуации в настоящем или будущем.',
'If + Past Simple, would + начальная форма. Для совета: If I were you, I would …',
'If I had more time, I would travel.|If I were you, I would rest.|What would you do?',
'В основной части используется would, а не will. Форма прошлого здесь выражает нереальность.',`
If I had more time, I ___ travel. :: would :: will|did
If I ___ you, I would rest. :: were :: am|will be
She would buy it if she ___ enough money. (have) :: had
What would you ___ in this situation? (do) :: do
If he knew the answer, he ___ tell us. :: would
We would go out if it ___ raining. (stop) :: stopped`);
topic('passive','Passive Voice: страдательный залог','A2','passive voice|пассивный залог|страдательный залог|is made was built',
'В центре внимания действие и предмет, над которым оно совершается, а исполнитель может быть неизвестен.',
'Be в нужном времени + третья форма. Present: is / are made. Past: was / were made. Исполнитель: by.',
'English is spoken here.|The bridge was built in 1990.|The cake was made by Dad.',
'Согласуй be с подлежащим и временем. После be нужна третья форма, не инфинитив.',`
English ___ spoken here. :: is :: are|does
The bridge was ___ in 1990. (build) :: built :: build|building
These cars ___ made in Germany. :: are
The window ___ broken yesterday. (be) :: was
The cake was made ___ my dad. :: by
The letters were ___ yesterday. (send) :: sent`);
topic('reported-speech','Reported Speech: косвенная речь','B1','reported speech|косвенная речь|said told',
'Передаёт слова другого человека. При прошедшем глаголе сообщения время часто сдвигается назад; местоимения и время подстраиваются под ситуацию.',
'She said, “I am tired.” → She said she was tired. При передаче из прошлого в отдельной поздней ситуации: will → would, tomorrow → the next day.',
'Ben said he liked music.|She told me she was busy.|He said he would call.',
'Tell требует адресата: told me. После said адресат вводится через to, а не просто me.',`
Передай позже: Ben said, "I am tired." → Ben said he ___ tired. :: was :: is being|will
She ___ me she was busy. :: told :: said|spoke
Передай позже: "I like chess," he said. → He said he ___ chess. :: liked
Передай из прошлой недели: "I will call," she said. → She said she ___ call. :: would
He said, "I can swim." → He said he ___ swim. (сдвиг времени) :: could
She told ___ the news. (I) :: me`);
topic('relative-clauses','Относительные предложения: who, which, whose','A2','relative clauses|who which that whose|относительные местоимения|который',
'Помогают уточнить, о каком человеке или предмете идёт речь, или связать описание с существительным.',
'Who — человек; which — вещь; whose — принадлежность. That часто заменяет who / which в определительных предложениях.',
'The girl who lives here is my friend.|This is the book which I bought.|The boy whose bike is blue is Ben.',
'Whose показывает владельца: the girl whose bag … Не путай с who’s (= who is).',`
The woman ___ teaches us is kind. :: who :: whose|which
This is the boy ___ bike is blue. :: whose :: who|which
This is the book ___ I bought. :: which|that
A helmet is something ___ protects your head. :: which|that
The man ___ lives next door is a doctor. :: who|that
I know a girl ___ father is a pilot. :: whose`);
topic('linkers','Связки: and, but, because, so','A1','linking words|союзы|because so|and but|потому что поэтому',
'Связки показывают отношения между частями мысли: добавление, противопоставление, причину и результат.',
'And — и; but — но; because — причина; so — следствие. Причина: We stayed home because it rained. Следствие: It rained, so we stayed home.',
'I like tea and coffee.|She is tired but happy.|It is cold, so wear a coat.',
'Не ставь because и so для одной и той же связи одновременно: Because it rained, we stayed home.',`
We stayed home ___ it was raining. :: because :: so|and
It was cold, ___ I put on a coat. :: so :: because|or
I like tea ___ coffee. (и) :: and
She is tired ___ happy. (но) :: but
He is hungry ___ he missed lunch. (потому что) :: because
I missed the bus, ___ I walked. (поэтому) :: so`);

// Самостоятельные пояснения Lessonfold с библиографической привязкой к юнитам.
// Общие грамматические навыки повторно используются в двух учебных маршрутах.
const { MURPHY_BOOKS } = require('../bank/murphy-books');
const { skills } = require('./murphy-skills');
const profiles = new Map([...topics,...skills].map(t=>[t.id,t]));
for (const book of MURPHY_BOOKS) for (const unit of book.units) {
  const parts=unit.skill_ids.map(id=>{const t=profiles.get(id);if(!t)throw new Error(`Unknown grammar skill: ${id}`);return t;});
  const selected=parts.length===1?parts[0].questions:parts.flatMap(t=>t.questions.slice(0,3));
  if(selected.length!==6||new Set(selected.map(q=>q.prompt)).size!==6)throw new Error(`Invalid unit: ${book.id}/${unit.code}`);
  topics.push({id:unit.grammar_key,title:unit.title,label:`${book.short} · Unit ${unit.code}: ${unit.title}`,level:book.level,book_id:book.id,book_title:book.title,book_short:book.short,unit:unit.code,
    notice:book.notice,aliases:[`${book.title} unit ${unit.code}`,`${book.short} юнит ${unit.code}`,`Murphy ${book.id.includes('essential')?'Essential':'English'} ${unit.code}`,`Мёрфи ${book.id.includes('essential')?'Essential':'English'} юнит ${unit.code}`,...parts.flatMap(t=>[t.title,t.id,...t.aliases])],
    when:parts.map(t=>t.when).join(' '),form:parts.map(t=>t.form).join('\n'),examples:parts.flatMap(t=>t.examples),mistake:parts.map(t=>t.mistake).join(' '),
    sections:parts.map(({title,when,form,examples,mistake})=>({title,when,form,examples,mistake})),
    questions:selected.map((q,i)=>({...q,id:`q${i+1}`,topic_id:unit.grammar_key}))});
}

const byId = new Map(topics.map(t=>[t.id,t]));
const norm = s => String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();
function matchTopic(title) {
  const n = norm(title);
  const exact=t=>[t.id,t.title,...t.aliases].some(a=>norm(a)===n);
  const core=topics.filter(t=>!t.book_id&&exact(t));
  if(core.length===1)return core[0].id;
  const found = topics.filter(exact);
  return found.length===1 ? found[0].id:null;
}
function search(q='') {
  const words=norm(q).split(' ').filter(w=>w&&!['объясни','объясните','объяснение','правило','правила','грамматика','тема','по','мне','как','использовать','что','такое','я','забыл','забыла','напомни','пожалуйста','расскажи','о','про','нужно','нужен','разобраться','в','с','и','не','понимаю'].includes(w));
  return topics.filter(t=>words.every(w=>/^\d+$/.test(w)&&t.unit?t.unit===w:norm([t.title,...t.aliases,t.when].join(' ')).includes(w)))
    .map(({questions,...t})=>({...t,question_count:questions.length}));
}
module.exports={topics,byId,matchTopic,search};
