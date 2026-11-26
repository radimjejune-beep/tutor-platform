// Новые вопросы для закрепления; диагностический пул q1…q6 остаётся стабильным.
const practice={};
const add=(id,lines)=>practice[id]=lines.trim().split('\n').map((line,i)=>{const [prompt,answer,wrong,explanation]=line.trim().split(' :: ');if(!prompt||!answer||!explanation)throw Error(`Invalid practice ${id}/${i}`);return {id:`p${i+1}`,topic_id:id,type:wrong?'choice':'text',prompt,options:wrong?[answer.split('|')[0],...wrong.split('|')]:[],correct:wrong?[0]:answer.split('|'),points:1,explanation};});
add('be',`
The new timetable ___ on the noticeboard. :: is :: are|am :: Timetable — один предмет, поэтому is.
My parents ___ at the concert tonight. (am/is/are) :: are ::  :: Parents — множественное число.
___ this seat free? (am/is/are) :: Is ::  :: Вопрос с единственным seat начинается с Is.
I ___ not angry, just tired. :: am :: is|are :: После I используется am.
Where ___ the spare keys? :: are :: is|am :: Keys — несколько ключей.
No, she ___ a doctor; she is an engineer. (is not, полная форма) :: is not ::  :: Отрицание строится через not после is.
Your answer ___ correct. (am/is/are) :: is ::  :: Answer — единственное число.
Yes, we ___. (краткий ответ на Are you ready?) :: are ::  :: В утвердительном кратком ответе сохраняется are.`);
add('have-got',`
My cousin ___ got a new backpack. :: has :: have|is :: Cousin обозначает одного человека: has got.
___ your neighbours got a garden? (Have/Has) :: Have ::  :: Neighbours — множественное число.
I ___ got any cash. (have not, полная форма) :: have not ::  :: Отрицание have got: have not got.
___ the hotel got a lift? :: Has :: Have|Does :: Вопрос в модели has got начинается с Has.
We have ___ two tickets. :: got :: get|getting :: После have в этой конструкции сохраняется got.
She ___ got much homework today. (has not, полная форма) :: has not ::  :: После she выбираем has not.
Yes, he ___. (ответ на Has he got a bike?) :: has ::  :: В кратком ответе повторяется has без got.
These flats ___ got large windows. (have/has) :: have ::  :: Flats — множественное число.`);
add('present-simple',`
Our art teacher ___ the classroom at eight every morning. (open) :: opens :: is opening|open :: Повторяющееся действие, teacher — he/she: opens.
___ your friends take the bus to school? :: Do :: Does|Are :: Friends — they; общий вопрос требует Do.
Lea ___ her little brother with maths on Fridays. (help) :: helps ::  :: Обычная помощь по пятницам; he/she/it требует -s.
My uncle ___ at home on Mondays. (not work; полная форма) :: does not work ::  :: Отрицание третьего лица: does not + work.
What time ___ the museum close? (do/does) :: does ::  :: Museum — единственное третье лицо.
The last train ___ at eleven. (leave, расписание) :: leaves ::  :: Расписание допускает Present Simple; train требует -s.
We ___ coffee after six. (not drink; полная форма) :: do not drink ::  :: После we используется do not и V1.
Nora ___ her email before breakfast every day. (check) :: checks ::  :: Every day задаёт привычку; Nora — третье лицо.`);
add('present-continuous',`
Please wait. I ___ my shoes. (put on, сейчас) :: am putting on :: put on|puts on :: Процесс сейчас: am + putting; согласная удваивается.
The children ___ a snowman at the moment. (make) :: are making ::  :: Children — they; make теряет немую e перед -ing.
___ your phone charging now? :: Is :: Does|Are :: Phone — единственное число, вопрос с Is.
We ___ for a taxi right now. (wait) :: are waiting ::  :: Текущий процесс требует are waiting.
She ___ this week because her office is closed. (not work; полная форма) :: is not working ::  :: Ограниченный период this week и отрицание с is not.
What ___ you looking for? (am/is/are) :: are ::  :: Вопрос с you требует are.
Look! The cat ___ onto the shelf. (climb) :: is climbing :: climbs|climb :: Look указывает на наблюдаемый процесс.
I ___ a book about plants this month. (read; временное занятие) :: am reading ::  :: Процесс может охватывать временный период, а не секунду.`);
add('simple-or-continuous',`
Nora usually ___ lunch at home. (have) :: has :: is having|have :: Usually описывает привычку; have → has.
Today Nora ___ lunch with a colleague. (have; процесс сейчас) :: is having ::  :: Have в значении действия допускает Continuous.
I ___ your name now. (remember; состояние памяти) :: remember :: am remembering|remembers :: Здесь remember описывает состояние, не длительный процесс.
We ___ with friends until our flat is ready. (stay; временно) :: are staying ::  :: Временное проживание до указанного события.
The library ___ at nine every weekday. (open) :: opens ::  :: Регулярное расписание — Simple.
Be quiet: the baby ___. (sleep, сейчас) :: is sleeping :: sleeps|sleep :: Просьба не шуметь объясняется текущим процессом.
This coat ___ to my sister. (belong) :: belongs ::  :: Belong в обычном значении — состояние принадлежности.
They ___ tennis on Sundays. (play; привычка) :: play ::  :: Обычная повторяющаяся деятельность.`);
add('past-simple',`
We ___ the wrong bus yesterday. (take) :: took :: taken|take :: Законченное прошлое требует V2: took.
___ the lesson finish on time last night? :: Did :: Does|Was :: Вопрос к действию в прошлом образуется с did.
Lea ___ a postcard from the coast last week. (send) :: sent ::  :: Send — неправильный глагол: sent.
I ___ the email yesterday. (not receive; полная форма) :: did not receive ::  :: После did not нужна начальная форма.
They ___ near the lake last summer. (stay) :: stayed ::  :: Правильный глагол получает -ed.
What did you ___ at the market? (buy) :: buy :: bought|buyed :: Прошедшее уже выражено did.
Nora ___ at the café from 2017 to 2019. (work) :: worked ::  :: Весь период завершён.
The train ___ twenty minutes late yesterday. (arrive) :: arrived ::  :: Законченное событие: V2/-ed.`);
add('was-were',`
The weather ___ sunny last weekend. :: was :: were|did :: Weather — неисчисляемое единственное, нужно was.
Where ___ your cousins yesterday? (was/were) :: were ::  :: Cousins — множественное число.
I ___ at home at six; I was at work. (was not, полная форма) :: was not ::  :: Отрицание be образуется без did.
___ the tickets expensive? :: Were :: Was|Did :: Tickets — множественное число.
The first two exercises ___ easy. (was/were) :: were ::  :: Two exercises требуют were.
___ your teacher at the meeting? (was/were) :: Was ::  :: Один teacher требует was.
We ___ ready when the taxi arrived. (were not, полная форма) :: were not ::  :: Подлежащее we и отрицательная связка.
Yes, she ___. (ответ на Was she there?) :: was ::  :: В кратком ответе повторяется was.`);
add('past-continuous',`
At half past nine yesterday we ___ breakfast. (have) :: were having :: have|had have :: Смотрим внутрь процесса в выбранный момент.
I ___ for the bus when it began to snow. (wait) :: was waiting ::  :: Ожидание — фон для начала снега.
___ she sleeping when you called? :: Was :: Did|Were :: She требует was; вопрос о процессе.
They ___ to music at ten last night. (not listen; полная форма) :: were not listening ::  :: Отрицание с were not и -ing.
While Ben was cooking, Lea ___ the table. (set, параллельный процесс) :: was setting ::  :: Два одновременных процесса; set → setting.
What ___ you doing when the lights went out? (was/were) :: were ::  :: You требует were.
I was walking home when I ___ a loud noise. (hear; событие) :: heard :: was hearing|hear :: Отдельное событие на фоне процесса — Past Simple.
At that moment the dog ___ under the chair. (sleep) :: was sleeping ::  :: Один dog и процесс в прошлом.`);
add('present-perfect',`
I ___ my glasses, so I can’t read this. (break; результат сейчас) :: have broken :: broke yesterday|has broken :: Актуальный результат: have + V3 broken.
___ your sister ever visited this museum? (Have/Has) :: Has ::  :: Sister — she; нужен has.
We have never ___ a meal like this. (eat) :: eaten :: ate|eat :: После have нужна третья форма eaten.
The children ___ their bags yet. (not pack; полная форма) :: have not packed ::  :: Ожидаемый результат ещё не достигнут.
I have ___ the message already. (read) :: read ::  :: V3 глагола read пишется так же, но произносится /red/.
Nora has ___ to the shop and hasn’t returned. (been/gone) :: gone ::  :: Gone to указывает, что человек ещё не вернулся.
We ___ here since February. (live; ситуация продолжается, Simple) :: have lived ::  :: Началось раньше и продолжается: have lived.
Has Ben ___ his keys? (find) :: found ::  :: После has нужна V3 found.`);
add('perfect-or-past',`
We ___ that café in May 2021. (visit) :: visited :: have visited|has visited :: Указан законченный месяц прошлого.
I have ___ three calls so far today. (make) :: made ::  :: Незавершённый период и результат: V3 made.
When ___ you meet your new neighbour? (did/have) :: did ::  :: When уточняет время завершённого знакомства.
She ___ here from 2015 to 2018. (live) :: lived ::  :: Ограниченный завершённый период.
Have you ever ___ a horse? (ride) :: ridden :: rode|ride :: Вопрос об опыте требует V3.
I ___ my homework last night. (finish) :: finished ::  :: Last night — законченная временная рамка.
We have already ___ the tickets. (buy) :: bought ::  :: В выбранной Perfect-модели нужна V3.
Did they ___ the parcel yesterday? (send) :: send ::  :: После did начальная форма.`);
add('perfect-continuous',`
My hands are dirty because I ___ the bicycle. (repair; процесс до сейчас) :: have been repairing :: have repairing|am repaired :: Недавний процесс объясняет видимый результат.
She has been ___ since seven. (study) :: studying ::  :: После has been нужна форма -ing.
We have been waiting ___ forty minutes. (for/since) :: for :: since|ago :: Forty minutes — длительность.
How long ___ he been learning French? (have/has) :: has ::  :: He требует has.
They have ___ practising all afternoon. :: been ::  :: Been — обязательная часть Perfect Continuous.
I have ___ her since primary school. (know; состояние) :: known ::  :: Know в этом значении требует Perfect Simple.
It ___ all morning; the ground is wet. (rain; процесс) :: has been raining ::  :: Процесс длится до настоящего или только что закончился.
She has been working ___ noon. (for/since) :: since ::  :: Noon — начальная точка.`);
add('past-perfect',`
When we reached the platform, the train ___ already left. :: had :: has|was :: Отправление раньше другого прошлого события.
I couldn’t pay because I had ___ my wallet. (forget) :: forgotten ::  :: После had нужна V3 forgotten.
They ___ before that evening. (not meet; полная форма) :: had not met ::  :: Знакомство не произошло к прошлой точке отсчёта.
___ you checked the address before you left? :: Had :: Have|Did have :: Вопрос о действии до другого прошлого действия.
By ten she had ___ all the invitations. (write) :: written ::  :: Результат к прошлому сроку: V3.
The film had ___ when we sat down. (begin) :: begun ::  :: Begin → began → begun.
We had ___ dinner before the guests arrived. (make) :: made ::  :: Готовка завершилась до прибытия.
He hadn’t ___ the room before the inspection. (clean) :: cleaned ::  :: После hadn’t используется V3.`);
add('future-will',`
The phone is ringing. I ___ answer it. (решение сейчас) :: will :: am|do :: Решение возникает в момент речи.
I promise I will ___ the book tomorrow. (return) :: return ::  :: После will — начальная форма.
___ you help me carry this chair? :: Will :: Do will|Are will :: Will сам образует вопрос.
She ___ tell anyone, I promise. (will not; полная форма) :: will not ::  :: Отрицательное обещание.
I think the new route ___ be faster. :: will :: is|does :: Прогноз-мнение о будущем.
They will ___ at the station at noon. (be) :: be ::  :: После will связка остаётся в начальной форме.
We ___ forget your kindness. (will not; полная форма) :: will not ::  :: Отрицание образуется после will.
Will the shop ___ open tomorrow? (be) :: be ::  :: Вопрос сохраняет начальную форму be.`);
add('going-to',`
We have bought paint. We ___ going to decorate the room. :: are :: is|do :: We требует are; план подготовлен.
She is going to ___ a new language. (learn) :: learn ::  :: После going to нужна V1.
___ you going to join the course? (Am/Is/Are) :: Are ::  :: Вопрос с you начинается с Are.
I ___ going to sell my bike. (am not; полная форма) :: am not ::  :: Отрицание располагается после am.
Look at that glass! It ___ going to fall. :: is :: has|does :: Прогноз по видимому признаку; it требует is.
What are they going to ___ for dinner? (cook) :: cook ::  :: После to не добавляется -ing.
Ben ___ going to travel this month. (is not; полная форма) :: is not ::  :: Отрицание плана: is not going to.
I ___ going to call her tonight. (am/is/are) :: am ::  :: После I нужна am.`);
add('future-arrangements',`
I’ve booked the appointment. I ___ seeing the dentist at two. :: am :: will|do :: Организованная договорённость выражена Continuous.
The bag is heavy. I ___ carry it for you. (решение сейчас) :: will ::  :: Помощь предлагается в момент речи.
She is ___ to apply for the job. (going/go) :: going :: go|went :: Going to описывает заранее принятое намерение.
Our train ___ at 6:40 tomorrow. (leave; расписание) :: leaves ::  :: Расписание допускает Present Simple.
We ___ meeting the guide tomorrow; everything is arranged. (am/is/are) :: are ::  :: Договорённость, подлежащее we.
I promise I will ___ on time. (arrive) :: arrive ::  :: Обещание с will + V1.
Look at the clouds! It is going to ___. (snow) :: snow ::  :: Прогноз по видимым признакам.
I am ___ to Paris tomorrow; I’ve bought the ticket. (fly) :: flying ::  :: Подготовленная поездка: Present Continuous.`);
add('future-continuous',`
This time tomorrow we will ___ crossing the border. :: be :: been|being :: Future Continuous требует will be + -ing.
At eleven I will be ___ the workshop. (lead) :: leading ::  :: Действие будет в процессе.
___ you be using the car this evening? :: Will :: Do|Are :: Общий вопрос с Will.
They ___ be staying here next month. (will not; полная форма) :: will not ::  :: Отрицание будущего процесса.
She will be ___ when you arrive at eight. (work) :: working ::  :: После be нужна -ing.
What will you ___ doing at noon? :: be ::  :: Не пропускаем be.
We will be ___ dinner at seven tomorrow. (have) :: having ::  :: Процесс в выбранный момент.
He will be ___ at that time. (sleep) :: sleeping ::  :: Будущее длительное: will be sleeping.`);
add('questions',`
___ repairs your computer? — My cousin does. :: Who :: Where|When :: Вопрос о действующем лице.
Where ___ your sister work? (do/does) :: does ::  :: Sister — третье лицо; нужен does.
___ is your lesson? — At half past six. :: When :: Who|Why :: Спрашиваем время, не место.
Who ___ this window yesterday? (open; вопрос к подлежащему) :: opened ::  :: Who заменяет подлежащее; did не добавляем.
How ___ chairs do we need? (much/many) :: many ::  :: Chairs исчисляемое множественное.
Why ___ he late yesterday? (was/were) :: was ::  :: Вопрос о состоянии с be в прошлом.
___ of these two coats is yours? (What/Which) :: Which ::  :: Выбор из названных вариантов.
What did she ___ at the café? (order) :: order ::  :: После did нужна V1.`);
add('frequency',`
Поставь usually после be: She is ___ early. :: usually ::  :: В нейтральной модели наречие следует за be.
We meet ___ a week: on Tuesday and Friday. (once/twice) :: twice ::  :: Названы два дня.
He ___ eats meat. He is vegetarian. (always/never) :: never ::  :: Never само выражает отрицание.
Put usually in the gap: They ___ walk to school. :: usually ::  :: Перед обычным смысловым глаголом.
Put often in the gap: I am ___ tired after work. :: often ::  :: После связки am.
She never ___ late. (arrive) :: arrives ::  :: Never не отменяет -s у третьего лица.
We visit the museum every ___. (месяц: month/months) :: month ::  :: После every — единственное число.
How ___ do you practise? — Every evening. (often/long) :: often ::  :: Ответ описывает частоту.`);
add('articles',`
My brother is ___ engineer. :: an :: a|the a :: Перед гласным звуком в профессии ставится an.
I saw a fox. ___ fox was near our gate. (a/the) :: The ::  :: Во втором предложении предмет уже известен.
She studies at ___ university. (a/an) :: a ::  :: University начинается со звука /j/.
Please give me ___ key on the desk. (a/the; конкретный ключ) :: the ::  :: Уточнение делает ключ опознаваемым.
We waited for ___ hour. :: an :: a|the an :: H в hour не произносится.
Choose '-' if no article is needed: I like ___ music in general. :: - ::  :: Общее неисчисляемое понятие без артикля.
Choose '-' if no article is needed: ___ dogs need exercise. (собаки вообще) :: - ::  :: Общее множественное число без артикля.
She bought ___ umbrella because it was raining. (a/an) :: an ::  :: Umbrella начинается с гласного звука.`);
add('plurals',`
There are two ___ in the yard. (child) :: children :: childs|childes :: Child имеет неправильное множественное children.
I bought three new ___. (brush) :: brushes ::  :: После sh добавляется -es.
Those ___ are very old. (city) :: cities ::  :: Согласная + y → -ies.
We saw five ___ in the field. (sheep) :: sheep :: sheeps|sheepes :: Форма sheep во множественном не меняется.
The ___ are on the shelf. (dictionary) :: dictionaries ::  :: Dictionary → dictionaries.
These ___ are comfortable. (chair) :: chairs ::  :: Обычное окончание -s.
Two ___ work in this office. (woman) :: women ::  :: Неправильная форма women.
There are some red ___ on the path. (leaf) :: leaves ::  :: В слове leaf -f меняется на -ves.`);
add('countable',`
How ___ advice do you need? :: much :: many|a few :: Advice неисчисляемо.
There are only a ___ clean plates. (few/little) :: few ::  :: Plates — исчисляемое множественное.
We need two ___ of water. (bottle) :: bottles ::  :: Считаются бутылки; water остаётся неисчисляемым.
I have ___ information about the course. (some/an) :: some ::  :: Information не употребляется с an в обычном значении.
How ___ chairs are missing? (much/many) :: many :: much|little :: Отдельные стулья считаются.
Could I have a ___ of advice? (piece/pieces) :: piece ::  :: Для одной единицы: a piece of advice.
There is a ___ milk left. (few/little) :: little ::  :: Milk — неисчисляемое.
Choose is/are: The furniture ___ new. :: is ::  :: Furniture грамматически единственное неисчисляемое.`);
add('some-any',`
Would you like ___ orange juice? :: some :: any|no :: В предложении угощения естественно some.
We haven’t got ___ clean towels. (some/any) :: any ::  :: В отрицании неопределённого наличия — any.
You can choose ___ seat; they’re all free. :: any :: no|an any :: Any означает любой из доступных.
There is ___ bread left. We need to buy some. (no/some) :: no ::  :: Контекст сообщает о полном отсутствии.
Can I have ___ water, please? (some/any; просьба) :: some ::  :: В просьбе обычно some.
I didn’t hear ___. (anything/nothing; нейтральное отрицание) :: anything ::  :: Отрицание уже выражено didn’t.
___ knows the code. (Nobody/Anybody; никто) :: Nobody ::  :: Nobody содержит отрицание.
Do you have ___ questions? (some/any; нейтральный вопрос) :: any ::  :: В нейтральном вопросе — any.`);
add('there-is',`
There ___ some fresh bread on the table. :: is :: are|have :: Bread неисчисляемо.
___ there any banks near here? (Is/Are) :: Are ::  :: Banks — множественное число.
There ___ three bedrooms in our flat. (is/are) :: are ::  :: Три отдельные комнаты требуют are.
There ___ a lift in this building. (is not; полная форма) :: is not ::  :: Отрицание единственного числа.
How many windows ___ there in the kitchen? :: are :: is|do :: Windows — множественное число.
___ there enough time for a break? (Is/Are) :: Is ::  :: Time в этом значении неисчисляемо.
There ___ any empty seats. (are not; полная форма) :: are not ::  :: Отсутствие нескольких мест выражается are not.
There is ___ apple in my bag. (a/an) :: an ::  :: Apple — один предмет с гласным начальным звуком.`);
add('pronouns',`
I called Nora, but ___ didn’t answer. :: she :: her|hers :: Местоимение выполняет действие: she.
These bags are heavy. Could you carry ___? (they/them) :: them ::  :: Сумки — объект действия carry.
My brother and ___ work together. (I/me) :: I ::  :: Группа выполняет действие; нужна форма подлежащего.
This message is for ___. (he/him) :: him ::  :: После for нужна объектная форма.
___ are waiting outside. (We/Us) :: We :: Us|Our :: Подлежащее требует We.
Please listen to ___. (I/me) :: me ::  :: После предлога to — me.
Eva is my friend. I often meet ___. (she/her) :: her ::  :: Meet направлено на другого человека.
The keys are here. ___ are on the shelf. (They/Them) :: They ::  :: Keys — множественное подлежащее.`);
add('possessives',`
This is ___ notebook, not yours. (my/mine) :: my :: mine|me :: Перед существительным нужна my.
That umbrella is ___. (her/hers) :: hers ::  :: HERS заменяет всю группу her umbrella.
The cat is washing ___ paws. (its/it’s) :: its ::  :: Притяжательная форма без апострофа.
These are the ___ coats. (children; притяжательная форма) :: children's ::  :: Неправильное множественное принимает ’s.
___ bag is this? — It’s Nora’s. (Whose/Who’s) :: Whose :: Who's|Who :: Вопрос о владельце требует whose.
Your room is larger than ___. (our/ours) :: ours ::  :: После than здесь заменяется our room.
This is ___ bicycle. (Ben; притяжательная форма) :: Ben's ::  :: Один владелец требует ’s.
These books are ___. (their/theirs) :: theirs ::  :: Самостоятельная притяжательная форма без существительного.`);
add('reflexives',`
Be careful with the knife. Don’t cut ___. :: yourself :: himself|myself :: Адресат действия и объект — один человек.
We painted the room ___. (ourselves/ourself) :: ourselves ::  :: We требует ourselves.
They often help ___. (друг другу: each other/themselves) :: each other ::  :: Взаимность, а не действие на себя.
I travelled by ___. (myself/me) :: myself ::  :: By myself = один/без помощи.
She introduced ___ to the new group. :: herself :: himself|her :: Сама представила себя.
The children made the cards ___. (themselves/theirselves) :: themselves ::  :: Стандартная форма — themselves.
You two should be proud of ___. (yourself/yourselves) :: yourselves ::  :: Обращение к нескольким людям.
He taught ___ to play chess. (himself/hisself) :: himself ::  :: Подлежащее и объект совпадают; форма himself.`);
add('comparisons',`
This route is ___ than the old one. (short) :: shorter :: shortest|more shorter :: Сравниваем два маршрута, нужен shorter.
It is the ___ building in the village. (old) :: oldest ::  :: Выделяем одно здание из группы.
Your idea is ___ than mine. (good) :: better ::  :: Good имеет неправильную сравнительную форму.
This chair is as ___ as that one. (comfortable) :: comfortable ::  :: Между as используется обычная форма.
The river is ___ here than near the bridge. (wide) :: wider :: widest|more wider :: Сравнительная степень wide → wider.
This is one of the best ___ in town. (café) :: cafés|cafes ::  :: После one of — множественное число.
The second task is ___ difficult than the first. (more/most) :: more ::  :: Сравнение двух заданий с than.
Today’s weather is ___ than yesterday’s. (bad) :: worse ::  :: Bad → worse → worst.`);
add('adverbs',`
She explained the rule ___. (clear/clearly) :: clearly :: clear|clearerly :: Описываем способ объяснения.
The soup smells ___. (good/well; вкусный запах) :: good ::  :: Smells связывает еду с её качеством.
He is a ___ driver. (careful/carefully) :: careful ::  :: Описываем существительное driver.
She speaks French very ___. (good/well) :: well ::  :: Способ говорения требует well.
We worked ___ all afternoon. (hard/hardly; усердно) :: hard :: hardly|hardlyly :: Hard = усердно; hardly = едва.
The children are ___. (quiet/quietly) :: quiet ::  :: После be описываем самих детей.
Please walk ___. (slow; образуй наречие) :: slowly ::  :: Способ действия: slowly.
I can ___ hear you. (hard/hardly; едва) :: hardly ::  :: Hardly меняет значение на «едва».`);
add('time-prepositions',`
The lesson starts ___ 7:15. :: at :: on|in :: Точное время требует at.
We are meeting ___ Thursday evening. (at/on/in) :: on ::  :: Конкретная часть конкретного дня — on.
She was born ___ October. (at/on/in) :: in ::  :: Месяц требует in.
Choose '-' if no preposition is needed: I’ll call ___ next Monday. :: - ::  :: С next предлог не нужен.
The streets are quiet ___ night. :: at :: in|on :: Устойчивое сочетание at night.
The course begins ___ 14 September. (at/on/in) :: on ::  :: Точная дата требует on.
Choose '-' if no preposition is needed: We practise ___ every morning. :: - ::  :: После every предлог не ставится.
I’ll be ready ___ ten minutes. (через: in/for) :: in ::  :: In ten minutes — через десять минут.`);
add('place-prepositions',`
The picture is ___ the wall. :: on :: in|into :: Картина находится на поверхности.
Put the keys ___ the drawer. (внутрь: into/to) :: into ::  :: Перемещение внутрь ящика.
The lamp is ___ the sofa and the chair. (between/behind) :: between ::  :: Названы два ориентира по сторонам.
We go ___ school by bus. (to/at) :: to ::  :: Движение к месту выражается to.
The dog is hiding ___ the table. (под: under/on) :: under :: on|into :: Место ниже поверхности — under.
I’m waiting ___ the entrance. (at/into) :: at ::  :: Вход как точка встречи.
She walked ___ the room. (внутрь: into/in; пересекла границу) :: into ::  :: Подчёркнуто вхождение внутрь.
The café is ___ the library: they face each other. (opposite/inside) :: opposite ::  :: Объекты расположены напротив.`);
add('can-could',`
She can ___ this problem without help. (solve) :: solve :: solves|to solve :: После can используется V1.
___ I borrow your ruler? (Can/Do) :: Can ::  :: Разрешение спрашивается через Can I…?
When he was five, he ___ read short stories. (could/can; общее умение) :: could ::  :: Общее умение в прошлом.
My brother ___ swim. (cannot; полная форма) :: cannot|can not ::  :: Обычная полная форма — cannot; раздельное can not также принимается. 
Could you ___ that again? (say) :: say :: says|to say :: Вежливая просьба не меняет форму после could.
___ she play the guitar? (Can/Does can) :: Can ::  :: Can сам образует вопрос.
Yes, I ___. (ответ на Can you drive?) :: can ::  :: В кратком ответе повторяется can.
She couldn’t ___ the instructions. (hear) :: hear ::  :: После couldn’t нужна начальная форма.`);
add('must-have-to',`
You ___ touch this cable: it is dangerous. :: mustn't :: don't have to|haven't to :: Это запрет, а не отсутствие необходимости.
You ___ bring paper; I’ve got enough for everyone. (do not have to; полная форма) :: do not have to ::  :: Бумагу приносить необязательно.
She ___ to wear a badge at work. (have/has) :: has ::  :: She требует has to.
___ he have to work on Sunday? (Do/Does) :: Does ::  :: Вопрос с have to образуется через does.
Yesterday we ___ to take a taxi. (have; прошедшее) :: had :: have|musted :: Прошедшая обязанность — had to.
You must ___ your phone off. (turn) :: turn ::  :: После must нужна V1.
She ___ have to pay today. (does not; полная форма) :: does not ::  :: Отсутствие необходимости у she: does not have to.
We must not ___ food into this room. (bring) :: bring ::  :: После must not используется V1.`);
add('should',`
You look tired. You ___ take a break. :: should :: should to|shoulds :: Совет: should + V1.
She should ___ the teacher for help. (ask) :: ask ::  :: После should начальная форма.
___ I revise this topic first? (Should/Do should) :: Should ::  :: Модальный глагол начинает вопрос.
You ___ skip breakfast. (should not; полная форма) :: should not ::  :: Отрицательный совет.
I don’t think he should ___ so late. (work) :: work :: works|to work :: После should не нужны -s и to.
What should we ___ next? (do) :: do ::  :: Вопрос о желательном действии.
She ___ practise more often. (should/shoulds) :: should ::  :: Should не изменяется по лицам.
You shouldn’t ___ your answers without checking. (submit) :: submit ::  :: Отрицательный совет сохраняет V1.`);
add('imperative',`
___ your name at the top. (write; инструкция) :: Write :: To write|Writes :: Команда начинается с V1.
Don’t ___ the window. (close) :: close ::  :: После don’t нет to и -s.
___ take a short break. (давайте: Let’s/Let) :: Let's|Let’s ::  :: Совместное предложение — let’s.
Please ___ quietly. (speak; просьба) :: speak ::  :: Please не меняет начальную форму.
___ run near the pool. (запрет: Don’t/Not) :: Don't|Don’t :: Not|Doesn't :: Отрицательная инструкция начинается с don’t.
Open ___ books, please. (your/yours) :: your ::  :: Перед существительным нужна your.
Let’s ___ the answers together. (compare) :: compare ::  :: После let’s используется V1.
Do not ___ this button. (press) :: press ::  :: Полная отрицательная команда do not + V1.`);
add('gerund-infinitive',`
I enjoy ___ in the morning. (walk) :: walking :: to walk|walk :: Enjoy требует -ing.
She decided ___ a new course. (take; с to) :: to take ::  :: Decide обычно принимает to-инфинитив.
He left without ___ goodbye. (say) :: saying ::  :: После предлога without нужна -ing.
We hope ___ you soon. (see; с to) :: to see ::  :: Hope + to-инфинитив.
She finished ___ the report. (write) :: writing :: to write|write :: Finish принимает -ing.
I stopped ___ because I wanted to listen. (talk; прекратил говорить) :: talking ::  :: Stop doing означает прекращение действия.
We stopped ___ because we wanted a conversation. (talk; с to, остановились поговорить) :: to talk ::  :: Stop to do означает остановиться ради другого действия.
He is interested in ___ languages. (learn) :: learning ::  :: После предлога in нужна -ing.`);
add('conditionals',`
If she ___ early, we’ll have time for coffee. (arrive) :: arrives :: will arrive|arrived :: В обычном будущем условии — Present Simple.
If I miss lunch, I ___ hungry. (feel; обычная закономерность) :: feel ::  :: Zero Conditional: результат тоже в Present Simple.
We ___ stay inside if it rains. (will/would; реальная возможность) :: will ::  :: First Conditional выражает открытое будущее условие.
If he ___ the bus, he’ll be late. (miss) :: misses ::  :: He требует -es в Present Simple.
If water reaches 100°C at normal atmospheric pressure, it ___. (boil) :: boils :: will boiling|boiled :: Указаны условия для общей физической закономерности.
I’ll call you when I ___. (arrive; будущее время по смыслу) :: arrive ::  :: После when о будущем обычно Present Simple.
If you don’t hurry, you ___ miss the start. (will/would) :: will ::  :: Реальное будущее последствие.
She will help if she ___ time. (have) :: has ::  :: В if-части обычная форма Present Simple.`);
add('second-conditional',`
If I ___ a bigger flat, I’d get a dog. (have) :: had :: have|would have :: Нереальная ситуация сейчас: Past Simple после if.
She would ___ the job if it were closer. (take) :: take ::  :: После would — V1.
If I ___ you, I would ask the teacher. (were/will be; совет) :: were ::  :: Устойчивая учебная модель If I were you.
What would you do if you ___ a wallet? (find) :: found ::  :: Воображаемая ситуация, не завершённое прошлое.
If he knew the answer, he ___ tell us. :: would :: will|did :: Нереальный результат — would + V1.
We would travel more if tickets ___ cheaper. (be; мн.ч.) :: were ::  :: Tickets — plural; в условии Past Simple.
If she ___ nearby, we’d meet more often. (live) :: lived ::  :: Воображаемое настоящее.
I would ___ more if I had time. (read) :: read ::  :: Would не меняет смысловой глагол.`);
add('passive',`
These notebooks ___ made from recycled paper. :: are :: is|do :: Подлежащее множественное; пассив are + V3.
The bridge was ___ last year. (repair) :: repaired ::  :: После was нужна V3.
The message will ___ sent tomorrow. :: be :: been|being :: Будущий пассив: will be + V3.
This song was written ___ my cousin. (by/with; исполнитель) :: by ::  :: By вводит исполнителя действия.
The room ___ cleaned every morning. (is/are) :: is ::  :: Единственное число и регулярное настоящее.
The tickets were ___ online. (sell) :: sold ::  :: Sell → sold → sold.
___ the windows cleaned yesterday? (Was/Were) :: Were ::  :: Вопрос с множественным подлежащим.
The parcel was ___ on Monday. (deliver) :: delivered ::  :: Правильная V3 совпадает с -ed.`);
add('reported-speech',`
Перескажи на следующий день со сдвигом: 'I am busy,' she said. She said she ___ busy. :: was :: is being|will :: Present сдвигается в Past при заданном контексте.
He ___ me that the room was ready. (said/told) :: told ::  :: Tell принимает адресата me без to.
Со сдвигом: 'I can help,' he said. He said he ___ help. :: could :: can to|did :: Can сдвигается в could.
Пересказ из более позднего дня: 'I will call tomorrow.' She said she ___ call the next day. :: would ::  :: Will → would; дата пересказа изменилась.
Nora said she ___ the answer. (know; сдвиг времени) :: knew ::  :: Present Simple сдвигается в Past Simple.
He said ___ me that he was tired. (предлог) :: to ::  :: После say адресат вводится с to.
She told ___ the story. (we/us) :: us ::  :: После told нужен объект us.
'I work here,' Ben says. Ben says he ___ here. (work; без сдвига) :: works ::  :: Настоящий says не требует прошедшего времени.`);
add('relative-clauses',`
The woman ___ lives next door is a pilot. :: who :: whose|which :: Для человека, выполняющего действие, подходит who.
This is the boy ___ bicycle is red. (who/whose) :: whose ::  :: Whose показывает владельца.
I liked the film ___ you recommended. (which/whose) :: which ::  :: Film — предмет, местоимение является объектом.
The dog ___ sleeps here belongs to Nora. (that/whose) :: that ::  :: That возможно в ограничительном определении.
My bike, ___ is new, is already dirty. :: which :: that|whose :: В дополнительной части с запятыми используется which, не that.
The student who ___ by the window is Ben. (sit) :: sits ::  :: Who выполняет действие и согласуется с student.
Is this the teacher ___ you called? (who/whose) :: who ::  :: Речь о человеке-объекте, не о владельце.
The house ___ roof is green is ours. (which/whose) :: whose ::  :: Whose связывает house и roof.`);
add('linkers',`
We stayed inside ___ the weather was terrible. :: because :: so|and so because :: После because идёт причина.
The bus was late, ___ we walked. (because/so) :: so ::  :: После so идёт результат.
She likes tea ___ coffee. (и: and/but) :: and ::  :: Добавляем похожую информацию.
He was tired ___ kept working. (но: but/because) :: but ::  :: Противопоставление ожиданию.
I brought a coat ___ it was cold. :: because :: so|or :: Холод — причина, почему взяли пальто.
It was dark, ___ I switched on the light. (so/because) :: so ::  :: Включение света — результат темноты.
The task is difficult ___ useful. (но: but/so) :: but ::  :: Контраст, не причинная связь.
We cancelled the picnic because ___ the rain. (of/for) :: of ::  :: Перед существительным требуется because of.`);
add('fr-etre',`
Ma sœur ___ médecin. :: est :: a|sont :: Une personne, описание профессии с être.
Vous ___ en avance. (être, présent) :: êtes ::  :: У vous форма êtes.
On ___ au cinéma. (être, présent) :: est :: sommes|sont :: On требует единственного est.
Nous ___ prêts pour le cours. (être, présent) :: sommes ::  :: У nous форма sommes.
Je ___ à la gare. (être, présent) :: suis ::  :: Je требует suis.
Les fenêtres ___ ouvertes. (être, présent) :: sont ::  :: Plusieurs fenêtres: множественное sont.
Tu ___ professeur ? (être, présent) :: es ::  :: Tu требует es.
Elle n’___ pas ici. (être, présent) :: est ::  :: Отрицание окружает личную форму est.`);
add('fr-avoir',`
Mon frère ___ douze ans. :: a :: est|as :: Возраст выражается avoir; mon frère — il.
Nous ___ un cours demain. (avoir, présent) :: avons ::  :: Nous требует avons.
J’___ soif. (avoir, présent) :: ai :: suis|as :: Устойчивое сочетание avoir soif.
Vous ___ une question ? (avoir, présent) :: avez ::  :: У vous форма avez.
Elles ___ deux chats. (avoir, présent) :: ont ::  :: Elles требует ont.
Tu ___ le temps ? (avoir, présent) :: as ::  :: Tu требует as.
Elle n’a pas ___ voiture. (de/une; обычное отрицание наличия) :: de ::  :: При отрицании неопределённого наличия une меняется на de.
On ___ faim. (avoir, présent) :: a ::  :: On требует единственного a.`);
add('fr-present-er',`
Vous ___ français. (parler, présent) :: parlez :: parlons|parlent :: У vous окончание -ez.
Nous ___ la musique. (aimer, présent) :: aimons ::  :: У nous окончание -ons.
Tu ___ à Bordeaux. (habiter, présent) :: habites :: habite|habitez :: У tu окончание -es.
Elle ___ une chanson. (écouter, présent) :: écoute ::  :: У elle окончание -e.
Ils ___ dans un café. (travailler, présent) :: travaillent ::  :: У ils окончание -ent на письме.
J’___ le français. (étudier, présent) :: étudie ::  :: Основа étudi- и окончание -e.
On ___ le dîner. (préparer, présent) :: prépare ::  :: On требует окончания третьего лица -e.
Les élèves ___ une carte. (regarder, présent) :: regardent ::  :: Les élèves — ils; нужна форма -ent.`);
add('fr-negation',`
Elle ___ pas français. (не говорит) :: ne parle :: parle ne|parle pas ne :: Ne перед личной формой, pas после.
Je n’ai pas ___ billet. (de/un; обычное отсутствие) :: de ::  :: При отрицании неопределённого наличия используется de.
Nous ___ pas ici. (не живём; habiter) :: n’habitons|n'habitons ::  :: Ne сокращается перед немым h.
Tu ne ___ pas le café. (aimer, présent) :: aimes ::  :: Личная форма согласуется с tu.
Ce n’est pas ___ problème. (un/de) :: un :: de|des :: После être неопределённый артикль обычно сохраняется.
Ils ne ___ pas en retard. (être, présent) :: sont ::  :: Отрицание окружает sont.
Elle n’___ pas de voiture. (avoir, présent) :: a ::  :: После n’ личная форма avoir для elle.
Je ne regarde ___ la télévision. (pas/ne) :: pas ::  :: Вторая часть отрицания следует за глаголом.`);
add('fr-articles',`
C’est ___ livre intéressant. :: un :: une|des :: Livre — мужской род, единственное число.
Voici ___ table. (un/une) :: une ::  :: Table — женский род.
___école est près du parc. (артикль перед гласной) :: L’|L'|l’|l' ::  :: Le/la сокращаются до l’ перед гласной.
J’aime ___ chiens en général. (les/des) :: les :: des|un :: Общее предпочтение использует определённый артикль.
Elle a ___ fleurs pour toi. (несколько: des/une) :: des ::  :: Неопределённое множественное число.
J’ai un stylo. ___ stylo est bleu. (Le/Un; этот известный) :: Le ::  :: Во втором упоминании предмет известен.
Je voudrais ___ eau. (неопределённая порция: de l’/du) :: de l’|de l' ::  :: Eau начинается с гласной; частичная форма de l’.
Il n’a pas ___ vélo. (de/un; обычное отрицание) :: de ::  :: Un меняется на de при отрицании наличия.`);
add('fr-questions',`
___ vous parlez français ? (нейтральная модель без инверсии) :: Est-ce que :: Est-ce qu'|Do :: Перед согласной vous используется que.
Où est-ce ___elle habite ? (que/qu’; впиши вместе с апострофом) :: qu’|qu' ::  :: Перед elle слово que сокращается.
___ coûte ce livre ? (Сколько?) :: Combien :: Comment|Pourquoi :: Цена спрашивается через combien.
___ langue apprenez-vous ? (Quel/Quelle) :: Quelle ::  :: Langue — женский род.
___ est-ce que tu pars ? — Demain. (Когда?) :: Quand ::  :: Ответ указывает время.
Pourquoi est-ce qu’il ___ ? (partir, présent: part/partez) :: part ::  :: Il требует третьего лица part.
Comment ___ appelez-vous ? (vous/tu) :: vous ::  :: В вопросе s’appeler местоимения согласуются с vous.
___ est-ce que tu habites ? — À Lille. (Где?) :: Où ::  :: Место спрашивается через où.`);
module.exports={practice};
