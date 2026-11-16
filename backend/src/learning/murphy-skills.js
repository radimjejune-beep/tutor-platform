// Независимые материалы Lessonfold. Грамматические факты, собственные пояснения и примеры.
// Тексты, упражнения и ключи издателя не переносятся. Идентификаторы — внутренние темы.
const skills=[];
function add(id,title,when,form,examples,mistake,source){
 const questions=source.trim().split('\n').map((s,i)=>{const [prompt,answers]=s.trim().split(' :: ');if(!prompt||!answers)throw Error(`Murphy skill ${id}: bad question ${i+1}`);return {id:`q${i+1}`,topic_id:id,type:'text',prompt,options:[],correct:answers.split('|'),points:1,explanation:form};});
 skills.push({id,title,level:'B1–B2',aliases:[],when,form,examples:examples.split('|'),mistake,questions});
}
add('stative-verbs','Состояние и действие','Один глагол может обозначать состояние или активный процесс. От этого зависит выбор времени.',
'Know, believe, belong, want обычно описывают состояние и употребляются в Simple. Think в значении «обдумывать», have в значении действия могут стоять в Continuous.',
'I believe your explanation.|We are having a short break.|She is thinking about her next project.',
'Различай значение: I think (= считаю) и I am thinking (= обдумываю).',`
I ___ your explanation. (believe) :: believe
This blue folder ___ to Nora. (belong) :: belongs
We ___ a short break right now. (have) :: are having|'re having
I ___ the answer to this question. (know) :: know
Ben ___ about changing jobs at the moment. (think) :: is thinking
She ___ a new keyboard. (want, сейчас выражено желание) :: wants`);
add('perfect-adverbs','Just, already и yet','Эти слова уточняют, когда результат стал актуальным: совсем недавно, уже или ещё нет.',
'Just и already обычно ставятся между have / has и третьей формой. Yet чаще находится в конце вопроса или отрицания.',
'The courier has just arrived.|I have already paid.|Have they replied yet?',
'Не добавляй законченный момент прошлого к Present Perfect: с yesterday нужен Past Simple.',`
The courier has ___ arrived. (только что) :: just
I have ___ paid for the tickets. (уже) :: already
Have they replied ___? (yet / just) :: yet
She hasn't finished the report ___. (ещё) :: yet
We have just ___ the door. (open) :: opened
Has Nora ___ sent the parcel? (already / yet) :: already`);
add('perfect-result-process','Результат или длительность','Perfect Simple выделяет достигнутый результат, Perfect Continuous — затраченный процесс.',
'Have / has + V3: сколько сделано. Have / has been + -ing: как долго делали. С глаголами состояния обычно используется Simple.',
'I have answered six messages.|I have been answering messages for an hour.|We have known her for years.',
'Вопрос how many обычно ведёт к результату, how long — к длительности процесса.',`
I have ___ five pages today. (write, результат) :: written
She has been ___ since breakfast. (study) :: studying
How many emails have you ___? (send) :: sent
We have ___ Nora for years. (know) :: known
Ben has been ___ the bike for an hour. (repair) :: repairing
They have ___ the whole kitchen. (clean, завершили) :: cleaned`);
add('perfect-duration','Как давно продолжается ситуация','Говорим о ситуации, которая началась раньше и продолжается сейчас.',
'How long + have / has + подлежащее + V3 / been -ing? Для know, be и владения обычно нужен Perfect Simple. For обозначает длительность, since — начало.',
'How long have you known Leo?|She has lived here since May.|We have been waiting for ten minutes.',
'С how long не подставляй ago, если ситуация ещё продолжается.',`
How long ___ you known Leo? :: have
She has lived here ___ May. (for / since) :: since
We have been waiting ___ ten minutes. (for / since) :: for
How long has Ben ___ ill? (be) :: been
I have ___ this laptop for two years. (have) :: had
How long have they been ___ together? (work) :: working`);
add('for-since','For, since и ago','Сравни продолжительность, исходную точку и расстояние назад от настоящего.',
'For + период: for six weeks. Since + начало: since March. Ago стоит после периода и относится к завершённому прошлому: six weeks ago.',
'I have worked here for six weeks.|We have been here since Friday.|They arrived two hours ago.',
'Since не ставится перед длительностью: since 2022, но for three years.',`
I have worked here ___ six weeks. :: for
We have been here ___ Friday. :: since
They arrived two hours ___. :: ago
She has been studying ___ noon. :: since
He left five minutes ___. :: ago
We have had this car ___ a long time. :: for`);
add('perfect-time-context','Контекст времени в Perfect и Past','Важна граница периода: он ещё открыт или уже закончился.',
'Завершённый период → Past Simple. Опыт до настоящего и продолжающийся период → Present Perfect. В последовательном рассказе о прошлом выбирай Past Simple.',
'I have had two meetings so far today.|I had two meetings yesterday.|I met Nora when I worked in Perm.',
'С вопросом when о закончившемся событии обычно употребляется Past Simple.',`
I ___ two meetings yesterday. (have) :: had
I have ___ two meetings so far today. (have) :: had
When ___ you buy this camera? (do) :: did
She ___ in Perm from 2016 to 2019. (live) :: lived
We have never ___ this gallery. (visit) :: visited
He ___ me last night. (call) :: called`);
add('past-perfect-continuous','Процесс перед моментом прошлого','Эта форма показывает, как долго шёл процесс до другого прошлого события.',
'Had been + глагол с -ing. Для результата к тому моменту чаще используется had + V3.',
'We had been walking for an hour when it began to snow.|She was tired because she had been travelling.|Had he been waiting long?',
'Не пропускай been: had been working, а не had working.',`
We had been ___ for an hour when it snowed. (walk) :: walking
She ___ been travelling all night. :: had
Had he been ___ long before you arrived? (wait) :: waiting
I had been studying ___ two hours. (for / since) :: for
They had been ___ the house all morning. (paint) :: painting
Ben was tired because he had ___ working outside. :: been`);
add('have-expressions','Действия с have','Have может обозначать приём пищи, отдых, разговор или личный опыт, а не только владение.',
'Have lunch / a break / a shower / a chat. Когда речь о процессе, возможен Continuous. В вопросах об обычном действии используются do / does.',
'We have lunch at one.|She is having a shower.|Did you have a good trip?',
'Конструкция have got обычно не заменяет have в действиях: have a shower, а не have got a shower в этом значении.',`
We ___ lunch at one every day. (have) :: have
She is ___ a shower now. (have) :: having
Did you ___ a good trip? :: have
Ben usually ___ breakfast at home. (have) :: has
Let's ___ a short break. :: have
What time does Nora ___ dinner? :: have`);
add('used-to','Как было раньше','Used to подчёркивает прошлую привычку или состояние, которые больше не актуальны.',
'Used to + начальная форма. После did / didn’t обычно use to. Не путай с be used to + существительное / -ing.',
'I used to cycle to work.|She didn’t use to like olives.|Did they use to live here?',
'Форма I am used to cycling означает «я привык», а не «раньше ездил».',`
I used to ___ to work. (cycle) :: cycle
She didn't ___ to like olives. :: use
___ they use to live here? :: Did
We ___ to have a small garden. (раньше) :: used
Ben used to ___ glasses. (wear) :: wear
Nora didn't use to ___ coffee. (drink) :: drink`);
add('will-predictions','Прогнозы и обещания с will','Will помогает выразить мнение о будущем, обещание или ожидаемый факт.',
'Will + начальная форма для всех лиц. После think, probably, I’m sure часто употребляется will. Shall I / we? удобно для предложения действия.',
'I think the parcel will arrive tomorrow.|I promise I will return it.|Shall we start?',
'Не добавляй -s или to после will. В придаточном с when обычно нужен Present Simple.',`
I think the parcel ___ arrive tomorrow. :: will
I promise I will ___ it on Friday. (return) :: return
___ we start the meeting? (shall / did) :: Shall
I'm sure you will ___ the film. (enjoy) :: enjoy
The shop will ___ at nine tomorrow. (open) :: open
She probably ___ be late. (will / does) :: will`);
add('future-perfect','Результат к будущему сроку','Future Perfect выделяет действие, завершённое до указанного момента будущего.',
'Will have + третья форма. Частые ориентиры: by Friday, by then, by the time … . После by the time о будущем обычно Present Simple.',
'By Friday I will have finished the draft.|She will have left by then.|Will you have completed it by noon?',
'Will be working — процесс; will have worked — завершение к сроку.',`
By Friday I will ___ finished the draft. :: have
She will have ___ by noon. (leave) :: left
Will you have ___ it by Monday? (complete) :: completed
By then we will have ___ the tickets. (buy) :: bought
He will have arrived ___ six. (by / until, не позднее) :: by
By the time you arrive, I will have ___ dinner. (cook) :: cooked`);
add('future-time-clauses','Будущее после when и if','Время в придаточном условии или времени выбирается иначе, чем в главной части.',
'When / if / as soon as / until + Present Simple, главная часть может содержать will. Present Perfect в придаточном подчёркивает завершение до следующего действия.',
'I’ll call when I arrive.|We will wait until she returns.|I’ll leave when I have finished.',
'Обычное условие о будущем: if she comes, а не if she will come.',`
I will call when I ___. (arrive) :: arrive
We will wait until she ___. (return) :: returns
If Ben ___, I will tell him. (call) :: calls
As soon as it stops raining, we will ___. (leave) :: leave
I will leave when I have ___ the report. (finish) :: finished
If you ___ time tomorrow, come over. (have) :: have`);
add('be-able','Умение в разных временах','Be able to выражает способность и используется там, где у can нет нужной формы.',
'Am / is / are able to; was / were able to; will be able to; have / has been able to. Для отдельного успешного действия в прошлом часто подходят was able to или managed to.',
'I will be able to help on Tuesday.|She was able to open the lock.|We have been able to solve it.',
'После able нужен to: able to swim.',`
I will be able ___ help on Tuesday. :: to
She was ___ to open the lock. :: able
We have ___ able to solve it. :: been
Ben ___ able to speak three languages. (be, сейчас) :: is
Will you ___ able to join us? :: be
They were able to ___ a taxi. (find) :: find`);
add('could-have','Возможность в прошлом','Could have описывает возможное, но не состоявшееся действие или предположение о прошлом.',
'Could have + третья форма. Could + начальная форма относится к способности или возможности в другой временной рамке.',
'We could have taken a taxi, but we walked.|You could have called me.|She could swim at six.',
'Не заменяй have третьей формой be: could have done.',`
We could have ___ a taxi, but we walked. (take) :: taken
You could ___ called me. :: have
She could ___ when she was six. (swim) :: swim
Ben could have ___ the wrong train. (take) :: taken
We couldn't have ___ without your map. (manage) :: managed
I could have ___ you yesterday. (help) :: helped`);
add('modal-deduction','Логический вывод с must и can’t','Выбираем форму по силе вывода: почти уверен, что так, или почти уверен, что невозможно.',
'Must + глагол — уверенный положительный вывод. Can’t + глагол — отрицательный. Прошлое: must have / can’t have + V3.',
'The lights are off; they must be asleep.|That can’t be Leo: he is abroad.|She must have missed the bus.',
'Mustn’t выражает запрет. Для отрицательного логического вывода нужен can’t.',`
The lights are off. They ___ be asleep. (уверенный вывод: must / may) :: must
That ___ be Leo; he is abroad. (невозможно) :: can't|cannot
She must have ___ the bus. (miss) :: missed
He can't have ___ the email; it was never sent. (read) :: read
You have walked all day. You must ___ tired. (be) :: be
The door is locked. Someone must have ___ it. (lock) :: locked`);
add('may-might','Осторожное предположение','May и might показывают, что возможность есть, но говорящий не уверен.',
'May / might + начальная форма. Отрицание may not / might not. О прошлом: may / might have + V3.',
'The train might be delayed.|She may join us.|They might have forgotten.',
'После may / might не добавляй to и не меняй глагол по лицам.',`
The train might ___ delayed. (be) :: be
She may ___ us later. (join) :: join
They might have ___. (forget) :: forgotten
We may not ___ enough time. (have) :: have
He might ___ at home now. (be) :: be
The parcel may have ___ already. (arrive) :: arrived`);
add('might-forms','Возможный процесс и будущий план','Для предположений можно уточнить, идёт ли процесс сейчас или происходил раньше.',
'May / might be + -ing — возможный процесс сейчас. May / might have been + -ing — процесс в прошлом. Might + глагол — осторожная возможность на будущее.',
'He might be driving now.|They may have been waiting outside.|We might visit the coast.',
'Возможность обычно не требует do: Might he know? Вопрос в разговоре часто переформулируют через Do you think …?',`
He might be ___ now. (drive) :: driving
They may have ___ waiting outside. :: been
We might ___ the coast next week. (visit) :: visit
She may be ___ an exam now. (take) :: taking
Ben might not ___ the address. (know) :: know
It may have been ___ all night. (rain) :: raining`);
add('neednt','Необязательное и лишнее действие','Отсутствие необходимости отличается от запрета, а лишнее совершённое действие — от просто ненужного.',
'Needn’t / don’t need to — нет необходимости. Mustn’t — запрещено. Needn’t have + V3 — сделал, хотя делать не требовалось.',
'You needn’t book a seat.|You mustn’t park here.|I needn’t have brought an umbrella; it stayed dry.',
'Needn’t have done означает, что действие состоялось. Didn’t need to само по себе этого не сообщает.',`
You ___ book a seat; there is plenty of room. (needn't / mustn't) :: needn't
You ___ park here; it is forbidden. :: mustn't|must not
I needn't have ___ an umbrella; it stayed dry. (bring) :: brought
We don't need ___ hurry. :: to
She needn't have ___ so much food. (buy) :: bought
He ___ need to work on Sundays. (do, отрицание) :: doesn't|does not`);
add('should-have','Оценка прошлого действия','Should have помогает сказать, что в прошлом стоило поступить иначе.',
'Should have + V3 — стоило сделать. Shouldn’t have + V3 — не стоило делать. Для совета сейчас: should + начальная форма.',
'I should have checked the address.|You shouldn’t have shouted.|We should leave now.',
'Форма should had неверна: после should используется have.',`
I should have ___ the address. (check) :: checked
You shouldn't have ___ at her. (shout) :: shouted
We should ___ now. (leave) :: leave
She should ___ called before coming. :: have
Ben should have ___ earlier. (start) :: started
They shouldn't have ___ that road. (take) :: taken`);
add('had-better','Had better и it’s time','Одна конструкция даёт настойчивый совет, другая напоминает о своевременном действии.',
'Had better + начальная форма; отрицание had better not. It’s time + подлежащее + форма Past Simple относится к тому, что пора сделать сейчас.',
'You had better save the file.|We’d better not wait.|It’s time we left.',
'Had better не требует to. Past после it’s time не обозначает закончившееся прошлое.',`
You had better ___ the file. (save) :: save
We had better ___ wait. (отрицание) :: not
It's time we ___. (leave, пора сейчас) :: left
You'd better ___ your coat. (take) :: take
It's time Ben ___ home. (go, пора сейчас) :: went
She had better not ___ late. (be) :: be`);
add('would','Would: нереальность и привычки','Would встречается в воображаемой ситуации, вежливой речи и рассказе о повторяющихся действиях прошлого.',
'Would + начальная форма. Для прошлых повторяющихся действий нужен понятный прошлый контекст. Длительные состояния чаще описываются used to, а не would.',
'I would help if I could.|When we were children, we would build shelters.|Would you close the gate?',
'Не добавляй -s или to после would. Для одиночного завершённого события используй Past Simple.',`
I would ___ if I could. (help) :: help
When we were children, we would ___ shelters. (build) :: build
___ you close the gate, please? (would / did) :: Would
She would not ___ without a map. (travel) :: travel
Ben said he ___ call later. (will, сдвиг времени) :: would
We would ___ the coast every summer as children. (visit) :: visit`);
add('requests-offers','Просьбы, разрешение и предложения','Разные конструкции помогают вежливо обратиться к собеседнику.',
'Could / would you + глагол — просьба. May / can I + глагол — разрешение. Would you like + предмет / to + глагол — предложение.',
'Could you move this chair?|May I use your charger?|Would you like to join us?',
'Просьба Would you mind требует -ing: Would you mind closing the door?',`
Could you ___ this chair? (move) :: move
May I ___ your charger? (use) :: use
Would you like ___ join us? :: to
Would you mind ___ the door? (close) :: closing
Can I ___ you a drink? (get) :: get
Would you ___ some water? :: like`);
add('wish-present','Пожелание о настоящем','Wish + прошедшая форма выражает желание изменить нынешнюю ситуацию.',
'I wish + Past Simple. Для возможности: wish + could. Для be в нереальном условии часто используется were.',
'I wish I had a quieter room.|She wishes she could drive.|I wish it weren’t so cold.',
'Прошедшая форма после wish здесь относится к настоящему, а не к прошлому событию.',`
I wish I ___ a quieter room. (have) :: had
She wishes she ___ drive. (can) :: could
I wish it ___ so cold. (be, отрицание) :: weren't|wasn't|were not|was not
Ben wishes he ___ more time. (have) :: had
I wish I ___ the answer. (know) :: knew
They wish they ___ closer. (live) :: lived`);
add('third-conditional','Воображаемое изменение прошлого','Рассматриваем, каким мог бы быть результат при другом прошлом условии.',
'If + had + V3, would have + V3. Обе части относятся к уже завершившейся ситуации.',
'If I had left earlier, I would have caught the bus.|She would have helped if she had known.|What would you have done?',
'В обычной if-части третьего условного не нужен would have.',`
If I had left earlier, I would have ___ the bus. (catch) :: caught
She would have helped if she had ___. (know) :: known
What would you have ___? (do) :: done
If we ___ booked, we would have got seats. :: had
He would ___ passed if he had studied. :: have
If Ben had called, I would have ___ him. (meet) :: met`);
add('wish','Пожелания и сожаления','Выбирай форму после wish по времени и смыслу желаемого изменения.',
'Wish + Past Simple — настоящее. Wish + had + V3 — сожаление о прошлом. Wish + would — желаемое изменение поведения или ситуации.',
'I wish I knew the code.|I wish I had saved the file.|I wish the neighbours would lower the music.',
'Для желания о собственной возможности обычно нужен could: I wish I could swim.',`
I wish I ___ the code. (know) :: knew
I wish I had ___ the file. (save) :: saved
I wish the neighbours ___ lower the music. (would / had) :: would
She wishes she ___ speak Italian. (can) :: could
We wish we had ___ earlier. (leave) :: left
Ben wishes he ___ taller. (be, нереальное настоящее) :: were|was`);
add('passive-forms','Пассив: процесс и результат','Пассивная конструкция сохраняет время и вид действия.',
'Be + V3; процесс: am/is/are being + V3; результат к настоящему: have/has been + V3; после модального глагола: modal + be + V3.',
'The lift is being repaired.|The forms have been checked.|The room must be cleaned.',
'Не теряй been в Perfect Passive и being в Continuous Passive.',`
The lift is ___ repaired now. :: being
The forms have ___ checked. :: been
The room must ___ cleaned. :: be
The windows are being ___. (wash) :: washed
The parcel has been ___. (deliver) :: delivered
This problem can be ___. (solve) :: solved`);
add('passive-patterns','Пассив с двумя объектами','В пассив можно поставить человека, который получает предмет или сообщение.',
'Someone gave Leo a badge → Leo was given a badge. После некоторых глаголов пассив использует to-инфинитив: was asked to wait.',
'I was offered a place.|We were asked to wait.|She was sent a new password.',
'В passive после make обычно появляется to: was made to repeat.',`
I was ___ a place on the course. (offer) :: offered
We were asked ___ wait. :: to
She was ___ a new password. (send) :: sent
Ben was made ___ repeat the answer. :: to
They were ___ the instructions. (give) :: given
Nora was invited ___ speak. :: to`);
add('reporting-passive','Передача общих сообщений','Пассив помогает сослаться на распространённую информацию без указания конкретного говорящего.',
'It is said that + предложение. Подлежащее + is said / believed / expected to + глагол. Для более раннего события: to have + V3. Be supposed to может выражать ожидаемое поведение.',
'It is believed that the tunnel is safe.|The tunnel is believed to be safe.|You are supposed to register first.',
'Выбирай to have done, когда действие произошло раньше самого сообщения.',`
It is ___ that the tunnel is safe. (believe) :: believed
The tunnel is believed ___ be safe. :: to
You are supposed to ___ first. (register) :: register
He is said to have ___ abroad. (move) :: moved
The train is expected ___ arrive soon. :: to
It is ___ that the bridge is old. (say) :: said`);
add('have-something-done','Заказать выполнение услуги','Исполнитель делает работу для владельца предмета, а не обязательно сам владелец.',
'Have + объект + V3. Время выражается формой have: have, had, am having. Get something done часто используется в разговорной речи.',
'I had my laptop repaired.|She is having her portrait painted.|We need to get the lock replaced.',
'I repaired my laptop означает, что ремонтировал я сам; I had it repaired — заказал ремонт.',`
I had my laptop ___. (repair) :: repaired
She is having her portrait ___. (paint) :: painted
We need to get the lock ___. (replace) :: replaced
Ben ___ his hair cut yesterday. (have) :: had
They are having the roof ___. (check) :: checked
I will have the documents ___. (translate) :: translated`);
add('reported-questions','Передача вопросов и просьб','Косвенный вопрос становится частью повествовательной фразы, а просьба — инфинитивной конструкцией.',
'Asked + if / whether для общего вопроса; asked + question word для специального. Порядок слов прямой. Asked / told someone to + глагол — просьба или указание.',
'She asked where I lived.|He asked if I was ready.|They told us to wait.',
'В косвенном вопросе не используй вопросительную перестановку: where I lived, не where did I live.',`
She asked where I ___. (live, сдвиг времени) :: lived
He asked ___ I was ready. (ли) :: if|whether
They told us ___ wait. :: to
Nora asked what Ben ___ doing. (be, сдвиг времени) :: was
He asked me not ___ be late. :: to
She asked whether I had ___ the message. (read) :: read`);
add('subject-questions','Вопрос к подлежащему','Если who или what само обозначает исполнителя действия, дополнительный do часто не нужен.',
'Who + смысловой глагол? — вопрос к исполнителю. Who + do / did + подлежащее + глагол? — вопрос к объекту.',
'Who opened the window?|Who did you invite?|What happened outside?',
'Отличай Who called you? от Who did you call? В первом спрашивают об исполнителе.',`
Who ___ the window yesterday? (open) :: opened
Who did you ___ to the meeting? (invite) :: invite
What ___ outside last night? (happen) :: happened
Who ___ this key? (have, настоящее) :: has
Who ___ you call yesterday? (do) :: did
Who ___ in that house? (live, настоящее) :: lives`);
add('indirect-questions','Вежливый и встроенный вопрос','Вопрос можно включить в другую фразу, например просьбу подсказать дорогу.',
'Do you know / Could you tell me + вопросительное слово + прямой порядок слов. Для общего вопроса используй if / whether.',
'Could you tell me where the lift is?|Do you know when it opens?|I wonder if she is ready.',
'Внутри косвенного вопроса не нужен do: where she works, а не where does she work.',`
Could you tell me where the lift ___? :: is
Do you know when it ___? (open) :: opens
I wonder ___ she is ready. (ли) :: if|whether
Can you tell me where Ben ___? (live) :: lives
Do you know what time the shop ___? (close) :: closes
I don't know whether he has ___. (arrive) :: arrived`);
add('auxiliary-verbs','Вспомогательный глагол вместо повторения','Короткий ответ или противопоставление может заменить повторение всей глагольной группы.',
'Повторяй подходящий вспомогательный глагол: be, have, do или модальный. Для обычного Present/Past Simple используй do / does / did.',
'Leo likes cycling, but I don’t.|She has finished, and I have too.|Will it work? I hope so.',
'Выбирай помощника по времени и глаголу исходной фразы, а не по последнему слову.',`
Leo likes cycling, but I ___. (отрицание) :: don't|do not
She has finished, and I ___ too. :: have
Ben can drive, and Nora ___ too. :: can
I didn't see it, but she ___. :: did
Is the lift working? — I hope ___. :: so
They are ready, but we ___. (отрицание) :: aren't|are not`);
add('question-tags','Короткие уточнения в конце фразы','Question tag помогает проверить ожидание или пригласить собеседника согласиться.',
'После утверждения обычно отрицательный tag, после отрицания — положительный. В tag повторяются вспомогательный глагол и местоимение.',
'You know Leo, don’t you?|She hasn’t left, has she?|They were late, weren’t they?',
'Особая форма: I am late, aren’t I? Учитывай отрицательный смысл never.',`
You know Leo, ___ you? :: don't
She hasn't left, ___ she? :: has
They were late, ___ they? :: weren't
Ben can swim, ___ he? :: can't
I am next, ___ I? :: aren't
Nora never complains, ___ she? :: does`);
add('verb-infinitive','Глагол с to-инфинитивом','После ряда глаголов следующее действие выражают через to.',
'Decide, hope, promise, offer, agree, refuse + to + начальная форма. Отрицание: not to + глагол.',
'We agreed to meet outside.|She promised to call.|He decided not to wait.',
'Не ставь -ing после decide в этой конструкции: decided to leave.',`
We agreed ___ meet outside. :: to
She promised to ___. (call) :: call
He decided ___ to wait. (отрицание) :: not
They refused ___ sign the form. :: to
I hope to ___ the course. (finish) :: finish
Ben offered ___ carry the box. :: to`);
add('object-infinitive','Другой исполнитель после глагола','Некоторые глаголы связывают желание или указание с действием другого человека.',
'Want / ask / tell / expect + объект + to + глагол. Make / let в активной конструкции обычно требуют начальную форму без to.',
'I want you to check it.|She told us to wait.|They let me use the printer.',
'После tell обычно нужен объект: told me to go. В активном make: made him repeat.',`
I want you ___ check it. :: to
She told us to ___. (wait) :: wait
They let me ___ the printer. (use) :: use
The noise made him ___ up. (wake) :: wake
We expect Ben ___ arrive soon. :: to
Nora asked me not ___ interrupt. :: to`);
add('remember-stop','Remember, stop и regret: смена смысла','Форма следующего глагола может менять временную связь между действиями.',
'Remember doing — помнить сделанное; remember to do — не забыть выполнить. Stop doing — прекратить действие; stop to do — остановиться ради другого действия. Regret doing — сожалеть о сделанном.',
'I remember meeting her.|Remember to lock the gate.|We stopped to read the sign.',
'Сначала определи смысл: прекращаем действие или делаем остановку ради него.',`
I remember ___ Nora at a conference. (meet, помню событие) :: meeting
Remember ___ lock the gate. (нужно сделать) :: to
We stopped ___ read the sign. (остановились ради этого) :: to
He stopped ___ last year. (smoke, бросил привычку) :: smoking
I regret ___ that message. (send, сожалею о сделанном) :: sending
Don't forget to ___ the lights. (switch off) :: switch off`);
add('try-need-help','Try, need и help','После этих глаголов форма зависит от того, пробуем ли способ, предпринимаем усилие или описываем нужную услугу.',
'Try to do — стараться; try doing — испытать способ. Need doing может иметь пассивный смысл: нуждается в выполнении. Help somebody (to) do допускает обе формы.',
'Try restarting the router.|I tried to lift the case.|The screen needs cleaning.',
'В The bike needs repairing велосипед не выполняет действие сам.',`
Try ___ the router. (restart, испытать способ) :: restarting
I tried ___ lift the case, but it was too heavy. :: to
The screen needs ___. (clean, нуждается в чистке) :: cleaning
Could you help me ___ this box? (carry, без to) :: carry
We need to ___ the schedule. (change) :: change
The lock needs ___. (replace, нуждается в замене) :: replacing`);
add('like-would-like','Нравится и хотелось бы','Общая привычка или удовольствие отличаются от желания в конкретной ситуации.',
'Like / love + -ing или to + глагол в зависимости от смысла. Would like + to + глагол выражает конкретное желание; would like + существительное — желаемый предмет.',
'I like walking by the river.|I would like to visit that town.|Would you like some juice?',
'После would like перед действием обычно нужен to, а не -ing.',`
I would like ___ visit that town. :: to
Would you ___ some juice? :: like
She enjoys ___. (walk) :: walking
We'd like to ___ a room. (book) :: book
Would Ben like ___ join us? :: to
I like ___ by the river. (walk, впиши -ing) :: walking`);
add('prefer-rather','Предпочтение и выбор','Можно сравнить предметы, действия или выразить желаемое действие другого человека.',
'Prefer A to B; prefer doing to doing. Would rather + начальная форма. Would rather somebody + Past Simple — предпочтение о его действии сейчас.',
'I prefer tea to coffee.|I’d rather walk.|I’d rather you waited outside.',
'После would rather не ставь to. При сравнении prefer употребляется to, а не than.',`
I prefer tea ___ coffee. :: to
I'd rather ___. (walk) :: walk
She prefers cycling to ___. (drive) :: driving
I'd rather you ___ outside. (wait, пожелание сейчас) :: waited
We would rather ___ at home. (stay) :: stay
Ben prefers to walk rather ___ take a taxi. :: than`);
add('preposition-ing','Глагол после предлога','Если после предлога идёт действие, обычно нужна форма -ing.',
'After, before, without, by, about, of, in и другие предлоги + -ing. В устойчивых сочетаниях to тоже может быть предлогом: look forward to meeting.',
'Check it before leaving.|She left without saying goodbye.|We look forward to seeing you.',
'Отличай to-инфинитив от предлога to: want to go, но look forward to going.',`
Check it before ___. (leave) :: leaving
She left without ___ goodbye. (say) :: saying
We look forward to ___ you. (see) :: seeing
He learned by ___ every day. (practise) :: practising|practicing
Thank you for ___. (help) :: helping
Nora is interested in ___. (paint) :: painting`);
add('be-used-to','Привычная ситуация и привыкание','Be used to описывает то, что уже привычно; get used to — процесс привыкания.',
'Be / get used to + существительное или -ing. Used to + начальная форма относится к бывшей привычке и строится иначе.',
'I am used to early starts.|She is getting used to driving here.|We used to live nearby.',
'После am used to нужна -ing-форма: am used to working.',`
I am used to ___ early. (start) :: starting
She is getting used to ___ here. (drive) :: driving
We used to ___ nearby. (live) :: live
Ben isn't used ___ the noise. :: to
Have you got used to ___ alone? (work) :: working
It took me a week to ___ used to the new keyboard. :: get`);
add('verb-preposition-ing','Устойчивый предлог перед действием','Некоторые сочетания требуют конкретного предлога, после которого действие принимает -ing.',
'Insist on, succeed in, apologise for, think of/about + -ing. Accuse somebody of и prevent somebody from тоже требуют -ing для следующего действия.',
'We succeeded in finding it.|She insisted on paying.|He apologised for arriving late.',
'Учи сочетание целиком: succeed in doing, а не succeed to do.',`
We succeeded ___ finding it. :: in
She insisted ___ paying. :: on
He apologised for ___ late. (arrive) :: arriving
The snow prevented us ___ leaving. :: from
They accused him ___ cheating. :: of
Ben is thinking about ___ jobs. (change) :: changing`);
add('worth-point','Полезность и смысл действия','Для оценки действия используются устойчивые конструкции с -ing.',
'Be worth doing; there is no point in doing; have difficulty doing; spend time doing. В этих конструкциях to-инфинитив обычно не подходит.',
'This guide is worth reading.|There is no point in arguing.|We had difficulty finding the entrance.',
'После worth действие ставится в -ing: worth trying.',`
This guide is worth ___. (read) :: reading
There is no point in ___. (argue) :: arguing
We had difficulty ___ the entrance. (find) :: finding
She spent an hour ___ the file. (check) :: checking
It is no use ___. (complain) :: complaining
Ben had trouble ___ the key. (turn) :: turning`);
add('purpose','Цель действия','Цель отвечает на вопрос, ради чего выполняют действие.',
'To / in order to / so as to + глагол. For + существительное; for + -ing может объяснять функцию предмета. So that вводит предложение с собственным подлежащим.',
'I came to collect the parcel.|This tool is for cutting wire.|I spoke slowly so that everyone could follow.',
'В I went to buy paper не нужен for перед to.',`
I came ___ collect the parcel. :: to
This tool is for ___ wire. (cut) :: cutting
I spoke slowly so ___ everyone could follow. :: that
We stopped to ___ some water. (buy) :: buy
She opened the window ___ order to cool the room. :: in
Ben went out ___ a walk. (for / to) :: for`);
add('adjective-infinitive','Прилагательное перед to','Прилагательное может оценивать действие или чувство по поводу него.',
'Adjective + to + глагол: easy to use, glad to help. It is kind of somebody to do; it is important for somebody to do.',
'The app is easy to use.|I am glad to help.|It was kind of her to wait.',
'Не дублируй объект: This text is easy to read, без it в конце.',`
The app is easy ___ use. :: to
I am glad to ___. (help) :: help
It was kind ___ her to wait. :: of
It is important ___ us to check the date. :: for
This text is hard to ___. (read) :: read
We were surprised ___ hear the news. :: to`);
add('afraid-to-of','Опасение действия и последствий','Разные формы помогают отличить нежелание решиться на действие от страха возможного события.',
'Afraid to do — бояться решиться; afraid of doing — бояться события или последствий. Sorry to hear — реакция на новость; sorry for doing — извинение за действие.',
'He was afraid to ask.|She was afraid of falling.|I’m sorry to hear that.',
'После предлога of / for нужна форма -ing, а после инфинитивного to — начальная форма.',`
He was afraid ___ ask. (не решался) :: to
She was afraid of ___. (fall) :: falling
I'm sorry ___ hear that. :: to
He apologised for ___ the vase. (break) :: breaking
Nora is interested in ___ the course. (join) :: joining
We were surprised to ___ them. (see) :: see`);
add('perception-verbs','Увидеть целое действие или процесс','После see и hear можно подчеркнуть завершённое событие целиком либо наблюдаемый процесс.',
'See / hear somebody do — целое действие. See / hear somebody doing — процесс. В активной конструкции перед начальной формой нет to.',
'I saw Leo cross the yard.|I saw Leo crossing the yard.|We heard someone singing.',
'Не используй to после активного saw him: saw him leave.',`
I saw Leo ___ the yard from one side to the other. (cross, целиком) :: cross
We heard someone ___. (sing, процесс) :: singing
She watched the children ___ chess. (play, процесс) :: playing
I heard the door ___ shut once. (slam, целое действие) :: slam
Ben saw a bird ___ over the lake. (fly, процесс) :: flying
We saw her ___ the building and disappear inside. (enter, целиком) :: enter`);
add('participle-clauses','Краткая связь двух действий','Причастная конструкция позволяет сократить сообщение при общем исполнителе.',
'-Ing-clause часто описывает одновременное действие или причину. Having + V3 подчёркивает более раннее завершение. Исполнитель должен совпадать с подлежащим основной части.',
'Feeling tired, I took a break.|Having checked the address, she left.|He slipped while carrying a box.',
'Не допускай подмены исполнителя: причастное действие должно относиться к тому же человеку.',`
___ tired, I took a break. (feel) :: Feeling
Having ___ the address, she left. (check) :: checked
He slipped while ___ a box. (carry) :: carrying
Having ___ the key, Ben opened the gate. (find) :: found
She sat by the window, ___ a letter. (read) :: reading
___ seen the forecast, we packed coats. (having / being) :: Having`);
add('mass-context','Значение меняет исчисляемость','Некоторые существительные обозначают вещество в общем или отдельную порцию, предмет, случай.',
'Coffee — напиток; a coffee — порция. Paper — материал; a paper — документ или газета по контексту. Room — пространство; a room — помещение.',
'There is not much room here.|We booked a room.|I ordered two coffees.',
'Проверяй значение, а не только само слово. Например, experience как опыт и an experience как пережитое событие.',`
We booked ___ room for two nights. (a / some) :: a
There isn't ___ room for another chair. (much / many) :: much
I ordered two ___. (coffee, порции) :: coffees
We need some ___. (paper, материал) :: paper
She has a lot of ___. (experience, опыт) :: experience
That trip was ___ unusual experience. (a / an) :: an`);
add('indefinite-article','A, an и some','Неопределённый артикль вводит один исчисляемый предмет; some часто вводит несколько предметов или вещество.',
'A / an + единственное число. Some + множественное или неисчисляемое. A / an выбирают по первому звуку следующего слова.',
'He is an illustrator.|I bought a notebook.|There is some bread.',
'С неисчисляемыми advice и information артикль a не употребляют.',`
He is ___ illustrator. :: an
I bought ___ notebook. :: a
There is ___ bread. (some / a) :: some
She gave me ___ useful advice. (some / an) :: some
It was ___ unusual day. :: an
We need ___ chairs. (some / a) :: some`);
add('specific-the','Когда нужен the','The используется, когда собеседникам понятно, какой именно предмет имеется в виду.',
'Повторное упоминание, уточнение и общий контекст делают предмет определённым. Иногда предмет уникален в ситуации: the entrance, the floor.',
'I found a key. The key was rusty.|Please close the gate.|The answer on page two is wrong.',
'Наличие прилагательного само по себе не делает предмет определённым: a blue folder тоже возможно.',`
I found a key. ___ key was rusty. :: The
Please close ___ gate behind you. (определённые ворота) :: the
She bought ___ blue folder; I don't know which one. (a / the) :: a
___ sun was bright that morning. :: The
Look at ___ answer on page two. (конкретный ответ) :: the
We stayed at ___ hotel near the station, but I forgot its name. (a / the) :: a`);
add('institution-articles','Деятельность и здание','Слова вроде school, bed и work могут описывать обычную деятельность или конкретный объект.',
'Go to school / be at school — учиться. Go to the school — идти в конкретное здание. Go to bed, go to work, go home — устойчивые сочетания без the.',
'The children are at school.|I went to the school to meet a teacher.|She goes to work by bus.',
'В британском употреблении hospital может быть без артикля для пациента. Всегда учитывай контекст и вариант языка.',`
She goes to ___ by bus. (work / the work) :: work
The pupils are at ___. (school / the school, учатся) :: school
I went to ___ school to meet a teacher. (the / —) :: the
Ben is tired and wants to go to ___. (bed / the bed) :: bed
We went ___ after lunch. (home / to home) :: home
They are going to ___ cinema tonight. :: the`);
add('general-nouns','Общие высказывания','Для разговора о классе предметов в целом часто используют множественное число без артикля или неисчисляемое слово без артикля.',
'Cats need water; music helps me relax. The cats означает конкретных животных, понятных из контекста.',
'I enjoy music.|Books can change our minds.|The books on this shelf are mine.',
'Различай общее утверждение и конкретную группу с уточнением.',`
I enjoy ___ music. (впиши —, если артикль не нужен) :: —|-|no article
___ books on this shelf are mine. (the / —) :: The
___ water is essential for life. (впиши —, если артикль не нужен) :: —|-|no article
I like ___ dogs in general. (впиши —, если артикль не нужен) :: —|-|no article
Please feed ___ dogs in our garden. (the / —) :: the
___ information in this email is important. (the / —) :: The`);
add('generic-groups','Виды и группы людей','The может представлять вид целиком, класс изобретений или группу людей с общим признаком.',
'The + единственное число иногда обозначает вид: the tiger. The + adjective может обозначать людей: the young. Такая группа обычно согласуется во множественном числе.',
'The telescope changed astronomy.|The young need opportunities.|The elderly are welcome here.',
'The elderly — группа людей, поэтому are, а не is.',`
___ telescope changed astronomy. (об изобретении как классе) :: The
The elderly ___ welcome here. (be) :: are
We need to support ___ unemployed. :: the
The young ___ opportunities. (need) :: need
___ tiger is an endangered species. (обобщённо о виде) :: The
The rich should not forget ___ poor. :: the`);
add('geographic-articles','Артикли в географических названиях','Тип географического объекта влияет на употребление the.',
'Обычно без the: города, большинство стран, отдельные горы и Lake + название. Обычно с the: реки, моря, океаны, горные цепи, множественные названия стран.',
'We visited Warsaw.|They crossed the Pacific.|She climbed Mount Fuji.',
'Выучивай устойчивое название целиком: the Netherlands, но Poland.',`
They crossed ___ Pacific. :: the
We visited ___ Warsaw. (впиши —, если артикль не нужен) :: —|-|no article
She climbed ___ Mount Fuji. (впиши —, если артикль не нужен) :: —|-|no article
The river flows into ___ Black Sea. :: the
We travelled through ___ Netherlands. :: the
They stayed near ___ Lake Baikal. (впиши —, если артикль не нужен) :: —|-|no article`);
add('name-articles','Артикли в названиях организаций и зданий','Названия улиц, зданий и учреждений имеют устойчивое употребление, которое удобно запоминать целиком.',
'Названия с of часто требуют the. Названия станций, университетов или улиц с именем собственного типа Oxford Street часто идут без the. У гостиниц и музеев the встречается часто.',
'We walked along Oxford Street.|They visited the Museum of Modern Art.|She studies at Oxford University.',
'Не выводи артикль только из слова museum или university: структура всего названия важнее.',`
We walked along ___ Oxford Street. (впиши —, если артикль не нужен) :: —|-|no article
They visited ___ Museum of Modern Art. :: the
She studies at ___ Oxford University. (впиши —, если артикль не нужен) :: —|-|no article
___ University of York has many departments. :: The
We met at ___ Victoria Station. (впиши —, если артикль не нужен) :: —|-|no article
The exhibition is at ___ British Museum. :: the`);
add('noun-compounds','Существительное как определение','Первое существительное может уточнять тип, назначение или материал второго.',
'В обычном noun + noun первое слово часто остаётся в единственном числе: a shoe shop. Единица измерения перед существительным тоже часто единичная: a ten-minute walk.',
'We found a bike shop.|It is a five-minute walk.|She needs a new bus ticket.',
'Множественное число относится прежде всего к главному слову: two bus tickets.',`
We found a ___ shop. (bike / bikes) :: bike
It is a five-___ walk. (minute) :: minute
She bought two bus ___. (ticket) :: tickets
I need a ___ charger. (phone / phones) :: phone
We stayed for a three-___ course. (day) :: day
Ben is a ___ driver. (taxi / taxis) :: taxi`);
add('own-mine','Собственное и принадлежащее мне','Own усиливает принадлежность, а of mine обозначает одного из нескольких принадлежащих мне людей или предметов.',
'My own + существительное. A friend of mine = one of my friends. On my own / by myself может значить «один» или «самостоятельно».',
'I have my own desk.|Leo is a friend of mine.|She travelled on her own.',
'После my own обычно идёт существительное. Of mine не требует повторения my.',`
I have my ___ desk. :: own
Leo is a friend of ___. (I) :: mine
She travelled on ___ own. (she) :: her
Ben repaired it by ___. (he) :: himself
We want a room of ___ own. (we) :: our
That colleague of ___ called again. (you) :: yours`);
add('there-it','There и it выполняют разные задачи','There вводит наличие предмета, а it описывает уже понятную ситуацию, время, погоду или оценку.',
'There + be сообщает, что что-то существует. It + be описывает погоду, время, расстояние или оценку действия.',
'There is a message for you.|It is cold outside.|It is useful to keep notes.',
'There is cold не заменяет It is cold. Но There is cold water сообщает о воде.',`
___ is a message for you. (there / it) :: There
___ is cold outside. (there / it) :: It
It is useful ___ keep notes. :: to
There ___ two seats left. :: are
___ was a strange noise outside. (there / it) :: There
It ___ five kilometres to the lake. (be, сейчас) :: is`);
add('no-none','No, none и any','Форма зависит от того, идёт ли дальше существительное и где находится отрицание.',
'No + существительное: no tickets. None заменяет существительное; none of + определённая группа. Not + any — ещё один способ отрицания.',
'There are no tickets left.|None of the seats is free.|I don’t have any change.',
'В стандартной фразе не совмещай don’t и no для одного отрицания.',`
There are ___ tickets left. (no / none) :: no
___ of the seats is free. (no / none) :: None
I don't have ___ change. :: any
How many replies? — ___. (no / none) :: None
There is ___ reason to hurry. (no / none) :: no
She hasn't received ___ messages. :: any`);
add('quantity','Much, many и a lot of','Количество выражается с учётом исчисляемости существительного.',
'Many + исчисляемое множественное, much + неисчисляемое. A lot of подходит для обоих типов. Plenty of означает больше чем достаточно.',
'How many visitors came?|We don’t have much space.|There is plenty of water.',
'Не опускай of в a lot of + существительное.',`
How ___ visitors came? :: many
We don't have ___ space. (much / many) :: much
There is plenty ___ water. :: of
She has a lot ___ friends. :: of
How ___ time do we need? :: much
There aren't ___ chairs left. (much / many) :: many`);
add('quantifier-of','Часть определённой группы','Of нужен, когда слово количества относится к конкретной группе с the, my, these или местоимением.',
'Most students — большинство студентов вообще. Most of the students — большинство из данной группы. All (of) the students допускает варианты; none of us не заменяют no of us.',
'Most visitors arrived early.|Most of the visitors were local.|None of us knew the code.',
'После no перед определённой группой обычно нужна форма none of.',`
Most ___ the visitors were local. :: of
___ visitors arrived early. (most / most of, без артикля) :: Most
None ___ us knew the code. :: of
Some ___ these files are old. :: of
All the pupils ___ ready. (be) :: are
There were ___ empty seats. (no / none of) :: no`);
add('both-either','Оба, любой из двух, ни один','Эти слова относятся к выбору между двумя объектами.',
'Both + множественное. Either / neither + единственное существительное. Перед определённой группой: both of, either of, neither of.',
'Both routes are safe.|Either route is fine.|Neither of them knows the code.',
'Neither уже содержит отрицание. Сочетание neither … nor связывает два отрицательно выбранных варианта.',`
___ routes are safe. (both / either) :: Both
Either route ___ fine. (be) :: is
Neither ___ them knows the code. :: of
You can take ___ bus; both go there. (either / neither) :: either
___ answer is correct; both are wrong. (either / neither) :: Neither
Both ___ my sisters work here. :: of`);
add('all-every-whole','Всё, каждый и целиком','All охватывает группу, every рассматривает каждого её участника, whole подчёркивает целостность.',
'All + множественное / неисчисляемое. Every + единственное. The whole + единственное: the whole day. Every day — регулярно каждый день.',
'All the rooms are clean.|Every room has a window.|I spent the whole day outside.',
'После every room глагол ставится в единственном числе.',`
Every room ___ a window. (have) :: has
All the rooms ___ clean. (be) :: are
I spent the ___ day outside. :: whole
She walks to work ___ day. (all / every) :: every
___ the water was cold. (all / every) :: All
We ate the ___ cake. (whole / every) :: whole`);
add('each-every','Каждый отдельно или вся группа','Each акцентирует отдельные элементы, every — охват всех членов группы.',
'Each / every + единственное существительное. Each of + группа во множественном, но сказуемое часто в единственном. Каждый из двух — each, а не every.',
'Each page has a number.|Every visitor gets a badge.|Each of us has a task.',
'После each of не используй единственное существительное без определителя.',`
Each page ___ a number. (have) :: has
Every visitor ___ a badge. (get) :: gets
Each ___ us has a task. :: of
There are two doors. ___ door has a lock. (each / every, отдельно каждая из двух) :: Each
___ of the answers is different. (each / every) :: Each
She checked ___ single detail. (every / all) :: every`);
add('relative-omission','Когда можно убрать who / which / that','В определительном предложении местоимение иногда опускают, если оно является объектом, а не исполнителем.',
'The person (who) I met — объект, местоимение можно убрать. The person who called — подлежащее, местоимение нужно. Предлог в разговорной конструкции может остаться в конце.',
'The guide I hired was helpful.|The person who called was polite.|This is the chair I sat on.',
'Не удаляй who, когда после него сразу идёт смысловой глагол без другого подлежащего.',`
The guide ___ called was helpful. (who / —) :: who
The guide I ___ was helpful. (hire, прошлое) :: hired
This is the chair I sat ___. :: on
The person ___ I met was polite. (who / which) :: who
The book I ___ yesterday is here. (buy) :: bought
The cafe ___ opens early is nearby. (that / —) :: that`);
add('relative-prepositions','Whose, whom и where','Относительная конструкция может показывать владельца, место или связь с предлогом.',
'Whose + существительное обозначает принадлежность. Where — место. В формальном стиле после предлога для человека используется whom: with whom.',
'The woman whose bag was missing called us.|This is the town where I grew up.|The colleague with whom I worked has moved.',
'Whose и who’s не взаимозаменяемы: whose bag, но who’s ready (= who is).',`
The woman ___ bag was missing called us. :: whose
This is the town ___ I grew up. :: where
The colleague with ___ I worked has moved. :: whom
The boy ___ father is a chef is here. :: whose
The room ___ which we met was quiet. (in / at) :: in
This is the lake ___ we learned to sail. :: where`);
add('non-defining','Дополнительное сообщение','Относительное предложение с запятыми добавляет информацию об уже определённом человеке или предмете.',
'Обособляй дополнительную часть запятыми. Используй who / which / whose; that в такой конструкции не подходит, а местоимение обычно не опускают.',
'Nora, who lives nearby, lent me a map.|The cabin, which we rented in June, was tiny.|Leo, whose bike broke, took the bus.',
'В дополнительной информации не заменяй who / which на that.',`
Nora, ___ lives nearby, lent me a map. :: who
The cabin, ___ we rented in June, was tiny. :: which
Leo, ___ bike broke, took the bus. :: whose
The river, ___ flows through town, is clean. :: which
My uncle, ___ is a pilot, lives abroad. :: who
The bridge, ___ was repaired in May, is open. :: which`);
add('relative-extended','Комментарий к целой ситуации','Which может относиться к целому сообщению, а of whom / of which — выделять часть упомянутой группы.',
'После запятой which может означать «и это». Для части группы: two of whom, several of which. Структура остаётся обособленной.',
'He forgot the key, which delayed us.|We invited ten people, two of whom declined.|I found six files, one of which was damaged.',
'Не ставь what вместо which для комментария к предыдущему сообщению.',`
He forgot the key, ___ delayed us. :: which
We invited ten people, two of ___ declined. :: whom
I found six files, one of ___ was damaged. :: which
She passed the exam, ___ pleased everyone. :: which
There were four guides, all of ___ spoke English. :: whom
We saw two routes, neither of ___ looked safe. :: which`);
add('reduced-relatives','Краткое определение с -ing и -ed','Определение можно сократить до причастной группы, если связь с существительным ясна.',
'-Ing часто имеет активное значение: people waiting. V3 часто имеет пассивное: files saved yesterday. Для завершённого пассивного действия убирается who/which + be.',
'The people waiting outside are visitors.|The files saved yesterday are here.|The road leading to the lake is closed.',
'Waiting обозначает действующего участника, а damaged — предмет, подвергшийся действию.',`
The people ___ outside are visitors. (wait) :: waiting
The files ___ yesterday are here. (save) :: saved
The road ___ to the lake is closed. (lead) :: leading
The bikes ___ in the storm need repair. (damage) :: damaged
Anyone ___ a badge can enter. (wear) :: wearing
The parcel ___ this morning is yours. (deliver) :: delivered`);
add('ed-ing','Причина эмоции и переживание','Окончание помогает отличить впечатление от состояния человека.',
'-Ing описывает то, что вызывает чувство: tiring. -Ed описывает того, кто его испытывает: tired. Выбор определяется смыслом, а не тем, живой ли объект.',
'The delay was annoying.|We were annoyed by the delay.|The result was surprising.',
'Человек тоже может быть boring, если он вызывает скуку, и bored, если скучает сам.',`
The delay was ___. (annoying / annoyed) :: annoying
We were ___ by the delay. (annoying / annoyed) :: annoyed
The result was ___. (surprising / surprised) :: surprising
Ben felt ___ after the long trip. (tiring / tired) :: tired
The lesson was ___. (interesting / interested) :: interesting
Nora is ___ in astronomy. (interesting / interested) :: interested`);
add('adjective-order','Порядок описания и связочные глаголы','При нескольких прилагательных действует привычный порядок, а после look / seem / feel часто нужно прилагательное.',
'Обычно оценка → размер → возраст → цвет → происхождение → материал → предмет. После look в значении «выглядеть» — adjective: looks calm.',
'We bought a small wooden table.|She wore a lovely blue coat.|The soup smells good.',
'Описывая впечатление через look или smell, не подставляй механически наречие.',`
The soup smells ___. (good / well) :: good
She looks ___. (calm / calmly) :: calm
We bought a small ___ table. (wooden / wood) :: wooden
She wore a lovely ___ coat. (blue / bluely) :: blue
This is a ___ Italian vase. (beautiful / beautifully) :: beautiful
He feels ___. (tired / tiredly) :: tired`);
add('adverb-exceptions','Well, fast, hard и hardly','Некоторые наречия совпадают с прилагательными или имеют неожиданное значение.',
'Good → well. Fast и hard могут быть наречиями без -ly. Hardly = едва; lately = в последнее время; late = поздно.',
'He works hard.|She hardly slept.|The train arrived late.',
'Hardly не означает «усердно». Для этого нужен hard.',`
He works very ___. (hard / hardly) :: hard
She ___ slept last night. (едва: hard / hardly) :: hardly
The train arrived ___. (late / lately) :: late
Have you seen Nora ___? (в последнее время) :: lately
Ben speaks Spanish ___. (good / well) :: well
This car goes very ___. (fast / fastly) :: fast`);
add('so-such','So и such','Обе формы усиливают описание, но строятся по-разному.',
'So + прилагательное / наречие. Such + (a/an) + прилагательное + существительное. So many / much / few / little выделяют количество.',
'It was so windy.|It was such a windy day.|There were so many people.',
'Перед исчисляемым единственным после such нужен артикль: such a useful tool.',`
It was ___ windy. (so / such) :: so
It was ___ a windy day. (so / such) :: such
There were ___ many people. :: so
This is such ___ useful tool. :: a
She spoke ___ quietly that I couldn't hear. :: so
We had ___ good weather. (so / such) :: such`);
add('too-enough','Достаточно и чрезмерно','Enough сообщает о достаточности, too — о превышении подходящей степени.',
'Adjective / adverb + enough; enough + существительное. Too + прилагательное / наречие. Enough / too часто продолжаются через to + глагол.',
'The bag is light enough to carry.|We have enough chairs.|It is too dark to read.',
'Порядок слов разный: warm enough, но enough time.',`
The bag is light ___ to carry. :: enough
We have ___ chairs. (enough / too) :: enough
It is ___ dark to read. :: too
She is old enough ___ drive. :: to
We don't have enough ___. (time / times, время) :: time
He spoke too ___ for me to follow. (quickly / quick) :: quickly`);
add('degree-adverbs','Quite, rather, pretty и fairly','Эти слова уточняют степень признака и оттенок оценки.',
'Fairly часто означает умеренную степень; rather может подчёркивать неожиданность; pretty в разговорной речи часто сильнее fairly. Quite меняет силу в зависимости от прилагательного.',
'The room is fairly quiet.|The box is rather heavy.|She is quite certain.',
'Учитывай контекст: quite good и quite impossible не имеют одинаковой степени усиления.',`
The room is ___ quiet. (fairly / fair) :: fairly
She is quite ___. (certain / certainly) :: certain
This is rather ___ difficult question. :: a
The box is pretty ___. (heavy / heavily) :: heavy
The task is quite ___. (impossible / impossibly) :: impossible
Ben did fairly ___. (good / well) :: well`);
add('comparative-modifiers','Степень различия','Сравнение можно усилить или ослабить и показать постепенное изменение.',
'Much / far / a lot + comparative — большая разница. A little / a bit + comparative — небольшая. The + comparative, the + comparative — взаимосвязь.',
'This route is much shorter.|It is getting colder and colder.|The earlier we leave, the better.',
'Не усиливай comparative словом very: much better, не very better.',`
This route is much ___. (short) :: shorter
The new seat is a little more ___. (comfortable) :: comfortable
It is getting ___ and colder. (cold) :: colder
The earlier we leave, the ___. (good) :: better
This book is far ___ interesting. (more / very) :: more
Is the service any ___ now? (good) :: better`);
add('as-comparisons','Такой же и не такой','As … as сравнивает степень признака без сравнительной формы.',
'As + обычное прилагательное / наречие + as. Not as / so … as — меньшая степень. As much / many as — сравнение количества.',
'This room is as bright as ours.|Ben is not as tall as Leo.|We paid as much as they did.',
'Не ставь -er между as: as tall as, не as taller as.',`
This room is as bright ___ ours. :: as
Ben is not as ___ as Leo. (tall) :: tall
We paid as ___ as they did. (much / many) :: much
She has as ___ books as I do. (much / many) :: many
The second task isn't ___ difficult as the first. (as / than) :: as
Nora runs as ___ as Ben. (fast) :: fast`);
add('superlatives','Выделяем один объект из группы','Superlative сравнивает объект со всеми остальными в рассматриваемой группе.',
'Обычно the + -est или the most + длинное прилагательное. Good → best, bad → worst. В группе часто используется in; среди перечисленных — of.',
'This is the quietest room in the house.|It was the most useful lesson.|She is the best of the three.',
'Не заменяй superlative сравнительной формой, когда речь обо всей группе.',`
This is the ___ room in the house. (quiet) :: quietest
It was the ___ useful lesson. (most / more) :: most
She is the best ___ the three. (in / of) :: of
That was the ___ day of the trip. (bad) :: worst
This is one of the ___ buildings here. (old) :: oldest
He is the youngest ___ the team. (in / of) :: in`);
add('word-order','Объект, место и время','В обычном утвердительном предложении части располагаются в устойчивом порядке.',
'Подлежащее → глагол → объект. Не вставляй обстоятельство между тесно связанными глаголом и объектом. Место обычно ставится перед временем.',
'She reads the news every morning.|We met Nora at the station yesterday.|He speaks English fluently.',
'Не разделяй глагол и прямой объект словом very much: I like this song very much.',`
She ___ the news every morning. (read) :: reads
He speaks English ___. (fluent) :: fluently
We met Nora at the station ___. (yesterday / ago) :: yesterday
I like this song very ___. :: much
She put the folder on the ___. (desk / yesterday) :: desk
Ben bought a ticket ___. (yesterday / very) :: yesterday`);
add('still-yet','Продолжение и ожидаемый результат','Still показывает продолжение, yet — ожидаемый результат, already — более раннее достижение.',
'Still обычно перед смысловым глаголом и после be. Yet чаще в конце отрицания или вопроса. Not … any more сообщает, что действие прекратилось.',
'She is still at work.|Have you finished yet?|I don’t live there any more.',
'Not yet = пока нет, not any more = больше не. Эти смыслы различаются.',`
She is ___ at work. (всё ещё) :: still
Have you finished ___? (уже: в конце вопроса) :: yet
I don't live there any ___. :: more
They have ___ left. (уже) :: already
Ben hasn't replied ___. :: yet
We ___ need your help. (всё ещё) :: still`);
add('even','Неожиданный факт с even','Even выделяет часть сообщения, которая кажется неожиданной или особенно показательной.',
'Even обычно ставится перед выделяемым элементом. Even + comparative усиливает сравнение. Not even подчёркивает отсутствие даже минимального.',
'Even the youngest pupil understood.|This route is even shorter.|He didn’t even say hello.',
'Место even влияет на смысл: even Leo и Leo even … выделяют разные части.',`
___ the youngest pupil understood. (даже) :: Even
This route is even ___. (short) :: shorter
He didn't ___ say hello. (даже) :: even
The second day was even ___. (good) :: better
She works even ___ Sundays. (on / in) :: on
I don't even ___ his name. (know) :: know`);
add('contrast','Хотя и несмотря на','Противопоставление можно выразить через предложение или через существительное / -ing.',
'Although / though / even though + предложение. Despite / in spite of + существительное или -ing. Despite the fact that + предложение.',
'Although it was windy, we went out.|Despite the wind, we went out.|In spite of feeling tired, she continued.',
'После despite не нужен of; после in spite нужен of.',`
___ it was windy, we went out. (although / despite) :: Although
Despite the ___, we went out. (wind / windy) :: wind
In spite ___ feeling tired, she continued. :: of
Despite ___ late, he joined the meeting. (be) :: being
___ though it was expensive, we bought it. (even / despite) :: Even
We stayed, despite the fact ___ it was cold. :: that`);
add('in-case','Действие на случай риска','In case объясняет предупредительное действие, которое выполняют заранее.',
'In case + предложение = на случай, если. If задаёт условие для самого действия, поэтому значение отличается. In case of + существительное.',
'Take a map in case your phone fails.|We keep a spare key in case we need it.|In case of fire, use the stairs.',
'Take a coat in case it gets cold означает взять пальто заранее, а не ждать похолодания.',`
Take a map in ___ your phone fails. :: case
In case ___ fire, use the stairs. :: of
We keep a spare key in case we ___ it. (need) :: need
Take a coat in case it ___ cold. (get) :: gets
Save the file in case the battery ___. (die) :: dies
I'll call you if I ___ help. (need, условие звонка) :: need`);
add('unless','Исключение из условия','Unless означает «если не» и задаёт исключение, при котором результат изменится.',
'Unless + положительная форма часто заменяет if … not. As long as / provided (that) задают необходимое условие.',
'We will walk unless it rains.|You can borrow it as long as you return it.|We’ll leave provided that everyone is ready.',
'Не добавляй лишнее not после unless, если уже выражаешь «если не».',`
We will walk ___ it rains. (если не) :: unless
You can borrow it as ___ as you return it. :: long
We'll leave provided ___ everyone is ready. :: that
Unless Ben ___, we will start without him. (call) :: calls
You can enter as long as you ___ a badge. (have) :: have
I'll go unless I ___ ill. (become) :: become`);
add('as-time-cause','As: одновременно и по причине','As может связывать одновременные события или объяснять известную причину.',
'As + предложение может означать «когда / по мере того как» или «поскольку». Значение определяется контекстом.',
'As we approached the lake, the road narrowed.|As it was late, we took a taxi.|She smiled as she opened the box.',
'Не путай союз as с like, после которого часто идёт существительное.',`
___ it was late, we took a taxi. (поскольку: as / like) :: As
She smiled as she ___ the box. (open, прошлое) :: opened
As we approached the lake, the road ___. (narrow, прошлое) :: narrowed
As I was ___, the phone rang. (leave) :: leaving
We stayed inside as it ___ raining. (be, прошлое) :: was
As time ___, the room became warmer. (pass, прошлое) :: passed`);
add('like-as','Похожесть и роль','Like часто показывает сходство, а as — роль, функцию или соответствие указанию.',
'Like + существительное / местоимение: похоже на. As + роль: в качестве. As + предложение может значить «как» в соответствии с чем-либо.',
'She works as a designer.|This box looks like a suitcase.|Do it as I showed you.',
'He works as a guide означает настоящую роль, а works like a guide — сравнение.',`
She works ___ a designer. (as / like) :: as
This box looks ___ a suitcase. (as / like) :: like
Do it ___ I showed you. (as / like) :: as
He used his coat ___ a blanket. (в качестве) :: as
Nora sings ___ a professional. (похожа на профессионала) :: like
We arrived late, ___ usual. :: as`);
add('as-if','Словно и как будто','As if / as though вводят впечатление о ситуации, которое может отличаться от действительности.',
'As if / as though + предложение. Для нереального сравнения возможна прошедшая форма; для прошлого предположения — had + V3.',
'He acts as if he owned the place.|She looks as though she is tired.|It sounds as if someone has arrived.',
'Прошедшая форма после as if может выражать нереальность настоящего, а не прошлое.',`
He acts as ___ he owned the place. :: if
She looks as ___ she is tired. :: though
It sounds as if someone has ___. (arrive) :: arrived
He speaks as if he ___ everything. (know, нереальное сравнение) :: knew
Nora looked as if she had ___ a ghost. (see) :: seen
You look as though you ___ a break. (need) :: need`);
add('during-while','Период и одновременное действие','During и for сочетаются с названием периода, while вводит действие через предложение.',
'During + существительное: в течение события. For + длительность. While + подлежащее + глагол. Before / after могут вводить существительное или -ing.',
'We talked during the break.|We waited for an hour.|I called while she was cooking.',
'Не ставь предложение сразу после during: during the lesson, но while we were studying.',`
We talked ___ the break. (during / while) :: during
We waited ___ an hour. :: for
I called ___ she was cooking. (during / while) :: while
Wash your hands before ___. (eat) :: eating
She left after ___ the report. (finish) :: finishing
Ben slept ___ the whole flight. (during / while) :: during`);
add('by-until','К сроку и до момента','By обозначает крайний срок завершения, until — продолжение состояния или действия.',
'Finish by six = закончить не позднее шести. Stay until six = оставаться до шести. By the time вводит момент, к которому уже будет результат.',
'Please reply by Friday.|We will stay until noon.|By the time we arrived, it had closed.',
'Не подменяй by словом until при указании срока одноразового результата.',`
Please reply ___ Friday. (by / until) :: by
We will stay ___ noon. (by / until) :: until
By the time we arrived, it ___ closed. :: had
She worked ___ midnight. (by / until, продолжала работать) :: until
Send the form ___ five at the latest. (by / until) :: by
Wait here ___ I return. :: until`);
add('on-time-end','Точно вовремя и в результате','Похожие сочетания выражают разные отношения ко времени и итогу.',
'On time — по расписанию. In time — достаточно рано, чтобы успеть. At the end of — в конце конкретного периода; in the end — в итоге.',
'The bus left on time.|We arrived in time for lunch.|In the end, we chose the shorter route.',
'At the end требует указания того, у чего есть конец: at the end of the week.',`
The bus left ___ time. (по расписанию) :: on
We arrived ___ time for lunch. (успели) :: in
___ the end, we chose the shorter route. (в итоге) :: In
We meet at the end ___ the week. :: of
Please be ___ time for the interview. (без опоздания) :: on
She called just ___ time to catch us. (успела) :: in`);
add('at-places','Место как точка деятельности','At удобно для места встречи, деятельности, адреса или мероприятия.',
'At home / work / a meeting / the entrance. In подчёркивает нахождение внутри пространства. On часто относится к поверхности.',
'We met at the entrance.|She is at a workshop.|The folder is in the drawer.',
'Выбирай предлог по смыслу, а не только по названию здания.',`
We met ___ the entrance. :: at
She is ___ a workshop. (at / on) :: at
The folder is ___ the drawer. :: in
Ben is ___ home. :: at
They live ___ 24 Willow Road. :: at
We are waiting ___ the bus stop. :: at`);
add('location-patterns','Место, поверхность и положение','In / on / at образуют устойчивые сочетания с местоположением.',
'In a city / country / photograph. On a floor / wall / island. At a specific point. Иногда предлог зависит от принятого сочетания.',
'The office is on the third floor.|We live in a small city.|I saw her in the photograph.',
'С этажом употребляется on: on the second floor.',`
The office is ___ the third floor. :: on
We live ___ a small city. :: in
I saw her ___ the photograph. :: in
There is a clock ___ the wall. :: on
The village is ___ an island. :: on
Meet me ___ the main gate. :: at`);
add('movement-to','Направление и движение внутрь','To обозначает направление к месту, into — пересечение границы внутрь.',
'Go to a place; enter / go into a room. Arrive in — город или страна; arrive at — конкретное место. Go home — без to.',
'We travelled to Riga.|She went into the studio.|They arrived at the station.',
'Не ставь to после arrive в обычном обозначении места прибытия.',`
We travelled ___ Riga. :: to
She went ___ the studio through the door. :: into
They arrived ___ the station. :: at
Ben arrived ___ Italy yesterday. :: in
Let's go ___. (home / to home) :: home
He jumped ___ the water. (внутрь) :: into`);
add('preposition-expressions','Устойчивые сочетания с предлогами','Предлог в частом выражении удобно запоминать вместе с основным словом.',
'On holiday / on business; at risk / at the moment; by mistake; with care; about a subject. Значение определяется всем выражением.',
'She is on holiday.|I sent it by mistake.|Please handle it with care.',
'Дословный перевод русского предлога часто не работает: by mistake, а не on mistake.',`
She is ___ holiday. :: on
I sent it ___ mistake. :: by
Please handle it ___ care. :: with
He is busy ___ the moment. :: at
We talked ___ the new plan. (about / to) :: about
They are here ___ business. :: on`);
add('by-means','Способ, транспорт и исполнитель','By может обозначать способ действия, транспорт без определителя и исполнителя пассивной конструкции.',
'By train / bus / air. By + -ing — способ действия. By + исполнитель после пассива. In my car и on the bus относятся к конкретному транспорту.',
'We travelled by train.|She learned by practising.|The mural was painted by a local artist.',
'Пешком — on foot, а не by foot.',`
We travelled ___ train. :: by
She learned by ___ every day. (practise) :: practising|practicing
The mural was painted ___ a local artist. :: by
He went there ___ foot. :: on
We waited ___ the bus. (внутри конкретного автобуса) :: on
Nora arrived ___ her own car. :: in`);
add('noun-prepositions','Предлог после существительного','Связь между существительными часто задаётся устойчивым предлогом.',
'Reason for, cause of, solution to, increase in, advantage of, invitation to. Запоминай существительное вместе с его продолжением.',
'What is the reason for the delay?|We found a solution to the problem.|There was an increase in demand.',
'Похожий русский смысл не означает одинакового предлога: cause of, но reason for.',`
What is the reason ___ the delay? :: for
We found a solution ___ the problem. :: to
There was an increase ___ demand. :: in
Nobody knew the cause ___ the fault. :: of
Thank you for the invitation ___ the workshop. :: to
What is the advantage ___ this method? :: of`);
add('adjective-prepositions-1','Реакция и отношение','После прилагательного может требоваться определённый предлог для причины или адресата эмоции.',
'Angry with someone / about something; pleased with; surprised at/by; sorry about; kind of someone. Сочетание нужно выбирать по смыслу.',
'He was angry with me.|We were pleased with the result.|It was kind of you to help.',
'Предлог может меняться при смене объекта: angry with a person, angry about a problem.',`
He was angry ___ me. (адресат: with / of) :: with
We were pleased ___ the result. (with / of) :: with
It was kind ___ you to help. :: of
She was surprised ___ the news. :: at|by
I'm sorry ___ the delay. :: about|for
Ben is worried ___ the journey. :: about`);
add('adjective-prepositions-2','Способность, интерес и сходство','Предлог связывает признак с его областью, объектом или сравнением.',
'Good at, interested in, afraid of, proud of, similar to, responsible for. Если дальше действие, используй -ing.',
'She is good at drawing.|I am interested in maps.|This route is similar to ours.',
'После interested in нужен существительный оборот или -ing, а не to-инфинитив.',`
She is good ___ drawing. :: at
I am interested ___ maps. :: in
This route is similar ___ ours. :: to
Ben is afraid ___ heights. :: of
We are proud ___ our team. :: of
Who is responsible ___ these files? :: for`);
add('verb-prepositions-to-at','К кому направлено действие','Некоторые глаголы требуют to, другие — at, причём смена предлога может менять смысл.',
'Listen to, talk to, explain something to someone. Look at, laugh at. Shout to — докричаться, shout at — кричать на кого-то.',
'Please listen to the guide.|Look at this sketch.|She explained the rule to me.',
'После explain перед человеком нужен to: explain it to me.',`
Please listen ___ the guide. :: to
Look ___ this sketch. :: at
She explained the rule ___ me. :: to
Ben talked ___ the receptionist. :: to|with
Don't laugh ___ other people. :: at
He shouted ___ me angrily. (на меня) :: at`);
add('verb-prepositions-for-after','Просить, искать и заботиться','For и after образуют разные сочетания с повседневными действиями.',
'Ask for — просить предмет или помощь; wait for — ждать; look for — искать; look after — заботиться; apply for — подавать заявку.',
'I asked for a receipt.|We are looking for a quiet cafe.|She looks after her nephew.',
'Look for и look after не означают одно и то же.',`
I asked ___ a receipt. :: for
We are looking ___ a quiet cafe. (ищем) :: for
She looks ___ her nephew. (заботится) :: after
Ben is waiting ___ the bus. :: for
Nora applied ___ a new job. :: for
Who will pay ___ the tickets? :: for`);
add('verb-prepositions-about-of','Мысли, сведения и напоминания','About и of могут менять оттенок значения глагола.',
'Think about — размышлять; think of — вспомнить или предложить идею. Hear about — узнать новость, hear of — знать о существовании. Remind someone of — напоминать кого-либо.',
'I’m thinking about the route.|Have you heard of this artist?|This photo reminds me of home.',
'Различай hear about an event и hear from a person.',`
This photo reminds me ___ home. :: of
Have you heard ___ this artist? (знаешь о существовании: of / from) :: of
I am thinking ___ the route. (about / from) :: about
We heard ___ the cancellation yesterday. (новость) :: about
Ben reminded me ___ the meeting. (о событии) :: about|of
What do you think ___ this plan? (оценка: of / from) :: of`);
add('verb-prepositions-from-on','Зависимость, защита и обвинение','Предлог помогает уточнить тип связи между действием и объектом.',
'Depend on, rely on, protect from/against, accuse of, blame someone for, prevent from. Для действия после предлога нужна -ing-форма.',
'It depends on the weather.|This cover protects the screen from scratches.|They blamed him for the error.',
'После prevent перед действием ставится from + -ing.',`
It depends ___ the weather. :: on
You can rely ___ this guide. :: on
They blamed him ___ the error. :: for
The snow prevented us ___ leaving. :: from
She was accused ___ cheating. :: of
This case protects the phone ___ scratches. :: from|against`);
add('verb-prepositions-in-with','Участие, вера и сотрудничество','Глагол определяет, каким предлогом вводится следующая часть мысли.',
'Believe in, succeed in, take part in, insist on, deal with, agree with a person / agree to a proposal.',
'I believe in your idea.|We took part in the project.|She deals with customer requests.',
'Для agree учитывай продолжение: with someone, to a plan, on a date.',`
I believe ___ your idea. :: in
We took part ___ the project. :: in
She deals ___ customer requests. :: with
Ben succeeded ___ finding a seat. :: in
I agree ___ you. :: with
They agreed ___ the proposal. (приняли предложение) :: to`);
add('phrasal-intro','Глагол с частицей','Короткая частица может добавить направление или создать новое значение глагола.',
'Учи фразовый глагол вместе со значением и моделью дополнения. У отделяемых сочетаний местоимение стоит между глаголом и частицей: turn it off.',
'Please sit down.|The plane took off.|Turn it off before leaving.',
'Не у всех фразовых глаголов частицу можно отделить. Проверяй конкретное сочетание.',`
Please sit ___. (down / away) :: down
The plane took ___. (взлетел) :: off
Turn it ___. (выключи) :: off
We ran ___ of milk. (молоко закончилось) :: out
Ben gave ___ smoking. (бросил) :: up
Nora came ___ after lunch. (вернулась) :: back`);
add('phrasal-in-out','Внутрь, наружу и участие','Частицы in и out часто обозначают движение, включение в деятельность или выход из неё.',
'Come in, go out, fill in, join in, check in/out. Некоторые значения прямые, другие требуют запоминания целиком.',
'Come in and sit down.|Please fill in this form.|We checked out before noon.',
'У местоименного дополнения отделяемого сочетания обычный порядок: fill it in.',`
Come ___ and sit down. (внутрь) :: in
Please fill ___ this form. :: in|out
We checked ___ before noon. (выехали из гостиницы) :: out
Would you like to join ___? (присоединиться к занятию) :: in
She went ___ for a walk. :: out
Have you checked ___ at the hotel yet? (заселились) :: in`);
add('phrasal-out','Результат с out','Out часто указывает на выяснение, завершение, исчезновение или распространение.',
'Find out — выяснить; work out — разобраться / вычислить; run out — закончиться; put out — потушить; hand out — раздать.',
'We found out the cause.|The lights went out.|She handed out the badges.',
'Различай find и find out: найти предмет и узнать факт.',`
We found ___ the cause. :: out
The lights went ___. (погасли) :: out
She handed ___ the badges. :: out
We have run ___ of paper. :: out
Can you work ___ the answer? :: out
They put ___ the fire. :: out`);
add('phrasal-on-off','Включить, выключить и продолжить','On и off участвуют в сочетаниях о работе устройства, продолжении и отделении.',
'Turn on/off — включить/выключить; carry on — продолжить; put on/take off — надеть/снять. Местоимение в отделяемой конструкции стоит перед частицей.',
'Turn the lamp on.|Please take off your boots.|Carry on with the exercise.',
'С местоимением: turn it on, не turn on it.',`
Turn the lamp ___. (включи) :: on
Please take ___ your boots. (сними) :: off
Carry ___ with the exercise. :: on
Put ___ your coat. (надень) :: on
Switch it ___ before cleaning it. (выключи) :: off
The meeting went ___ for two hours. (продолжалось) :: on`);
add('phrasal-on-off-2','Отправиться, отложить и ладить','Частицы on и off входят в переносные значения, которые удобнее учить целыми сочетаниями.',
'Set off — отправиться; put off — отложить; get on with — ладить / продолжать; show off — хвастаться; go off — сработать о сигнале.',
'We set off before sunrise.|They put off the meeting.|Do you get on with your neighbours?',
'В get on with оба коротких слова относятся к сочетанию и сохраняются перед объектом.',`
We set ___ before sunrise. :: off|out
They put ___ the meeting. (отложили) :: off
Do you get ___ with your neighbours? :: on
The alarm went ___ at six. (сработал) :: off
He was showing ___ his new bike. :: off
Let's get ___ with the work. :: on`);
add('phrasal-up-down','Увеличить, уменьшить и записать','Up и down часто связаны со степенью, движением и фиксированием информации.',
'Turn up/down — изменить громкость; write down — записать; slow down — замедлиться; put up — установить или разместить; knock down — снести.',
'Please turn the music down.|Write the code down.|We put up a notice.',
'Местоименное дополнение: write it down.',`
Please turn the music ___. (сделай тише) :: down
Write the code ___. :: down
We put ___ a notice. :: up
The driver slowed ___. :: down
Turn the volume ___. (сделай громче) :: up
The old shed was knocked ___. :: down`);
add('phrasal-up','Организовать, закончить и вырасти','Up часто входит в сочетания о завершении, появлении или развитии.',
'Set up — организовать; grow up — вырасти; use up — израсходовать; bring up — воспитать / поднять вопрос; give up — отказаться.',
'They set up a reading club.|She grew up near the coast.|We used up all the ink.',
'Не выводи значение только из up: сочетания могут иметь переносный смысл.',`
They set ___ a reading club. :: up
She grew ___ near the coast. :: up
We used ___ all the ink. :: up
Ben gave ___ the idea. (отказался) :: up
Who brought ___ that question? (поднял) :: up
The children were brought ___ by their grandparents. :: up`);
add('phrasal-up-2','Нагнать и справиться','Некоторые сочетания с up описывают достижение уровня, подготовку или терпение.',
'Catch up with — нагнать; keep up with — не отставать; put up with — терпеть; make up — придумать / помириться по контексту; look up — найти сведения.',
'I need to catch up with the group.|She won’t put up with that noise.|Look the address up.',
'В трёхчастных сочетаниях местоимение обычно идёт после всей группы: put up with it.',`
I need to catch up ___ the group. :: with
She won't put up ___ that noise. :: with
Look the address ___. :: up
It is hard to keep up ___ the changes. :: with
He made ___ an excuse. (придумал) :: up
We need to catch ___ before the exam. :: up`);
add('phrasal-away-back','Удалиться и вернуться','Away и back часто выражают удаление и возврат, в том числе переносные значения.',
'Go away, throw away, give away; come back, give back, call back. Положение местоимения проверяется по конкретному сочетанию.',
'Don’t throw the receipt away.|Please give it back.|I’ll call you back after lunch.',
'Give it back — вернуть предмет. Give it away — отдать другому.',`
Don't throw the receipt ___. :: away
Please give it ___. (верни) :: back
I'll call you ___ after lunch. :: back
The thief ran ___. (убежал) :: away
She gave ___ the old books. (отдала) :: away
We came ___ before dark. :: back`);
add('be-questions','Вопросы с be','Для вопроса о состоянии, имени, возрасте или месте переставь be перед исполнителем.',
'Am / is / are + подлежащее? Короткий ответ: Yes, I am; No, she isn’t. В вопросах с be не нужен do.',
'Is the studio open?|Are your friends here?|Where is the charger?',
'Сохраняй согласование: Are they …? Is he …?',`
___ the studio open? :: Is
___ your friends here? :: Are
Where ___ the charger? :: is
Am I next? — Yes, you ___. :: are
Is Nora ready? — No, she ___. (краткое отрицание) :: isn't|is not
___ I too early? :: Am`);
add('continuous-questions','Вопросы о действии сейчас','Вопрос строится вокруг формы be и глагола с -ing.',
'Am / is / are + подлежащее + -ing? Для специального вопроса сначала ставится вопросительное слово.',
'Are they packing now?|What is Leo drawing?|Why are you waiting?',
'Не добавляй do к вопросу с Continuous.',`
___ they packing now? :: Are
What ___ Leo drawing? :: is
Why are you ___? (wait) :: waiting
___ Nora working today? :: Is
What are the children ___? (build) :: building
Am I ___ too fast? (speak) :: speaking`);
add('simple-negatives','Отрицание привычки','В Present Simple отрицание обычного действия строится с do.',
'I / you / we / they don’t + глагол. He / she / it doesn’t + глагол без -s.',
'I don’t eat meat.|She doesn’t drive.|We don’t work on Sundays.',
'После doesn’t глагол возвращается к начальной форме.',`
I ___ eat meat. (do, отрицание) :: don't|do not
She ___ drive. (do, отрицание) :: doesn't|does not
Ben doesn't ___ here. (work) :: work
We don't ___ on Sundays. (study) :: study
Nora ___ like loud music. (do, отрицание) :: doesn't|does not
They don't ___ a car. (have) :: have`);
add('simple-questions','Вопросы о привычках','Для вопроса о повторяющемся действии нужен do или does.',
'Do + I/you/we/they + глагол? Does + he/she/it + глагол без -s? В коротком ответе повторяется do / does.',
'Do you cycle to work?|Does Ben cook?|Where does Nora live?',
'Вопрос Does she likes …? неверен: Does she like …?',`
___ you cycle to work? :: Do
___ Ben cook? :: Does
Where does Nora ___? (live) :: live
Does she ___ tea? (like) :: like
Do they work here? — Yes, they ___. :: do
Does Leo swim? — No, he ___. (краткое отрицание) :: doesn't|does not`);
add('past-questions','Вопросы и отрицания прошлого','Did уже обозначает прошлое время, поэтому смысловой глагол остаётся в начальной форме.',
'Did + подлежащее + глагол? Подлежащее + didn’t + глагол. Для be используются was / were без did.',
'Did you call Nora?|I didn’t hear the alarm.|Was the room quiet?',
'Не ставь вторую форму после did: Did you buy?, а не Did you bought?',`
___ you call Nora yesterday? :: Did
I didn't ___ the alarm. (hear) :: hear
Did Ben ___ the tickets? (buy) :: buy
We ___ visit the museum. (do, отрицание в прошлом) :: didn't|did not
___ the room quiet yesterday? (be) :: Was
Where did she ___ last week? (stay) :: stay`);
add('perfect-experience','Опыт до настоящего','Для вопроса об опыте без точной даты подходит Present Perfect с ever.',
'Have / has + ever + V3? Never + V3 означает, что такого опыта не было. Если сообщается конкретное время, переходи к Past Simple.',
'Have you ever sailed a boat?|She has never tried mango.|I tried it last summer.',
'С never не добавляй ещё одно отрицание haven’t в обычной конструкции.',`
Have you ever ___ a boat? (sail) :: sailed
She has never ___ mango. (try) :: tried
___ Ben ever visited a castle? :: Has
We have never ___ abroad. (be) :: been
I ___ it last summer. (try) :: tried
Have they ever ___ a horse? (ride) :: ridden`);
add('auxiliary-forms','Be, have и do в конструкции','Вспомогательный глагол выбирается по грамматической форме, а не по переводу русского предложения.',
'Be + -ing — Continuous; have + V3 — Perfect; do + начальная форма — вопросы и отрицания Simple. Be + V3 может строить Passive.',
'She is reading.|They have finished.|Do you know?|The gate was locked.',
'Сначала определи форму смыслового глагола и значение, затем выбирай помощника.',`
She ___ reading now. :: is
They ___ finished already. :: have
___ you know the code? :: Do
The gate ___ locked yesterday. (be) :: was
Ben doesn't ___ here. (work) :: work
We were ___ outside at six. (wait) :: waiting`);
add('verb-forms','Регулярные и неправильные формы','Для разных времён нужны начальная, прошедшая или третья форма глагола.',
'У правильных глаголов Past и V3 обычно совпадают и заканчиваются на -ed. Неправильные формы нужно учить группами: take–took–taken.',
'We opened the box.|She took the bus.|I have written a note.',
'После have / has нужна третья форма: has taken, а не has took.',`
Yesterday we ___ the box. (open) :: opened
She ___ the bus yesterday. (take) :: took
I have ___ a note. (write) :: written
Ben has ___ his keys. (find) :: found
They ___ early last night. (leave) :: left
We have ___ the picture. (see) :: seen`);
add('have-to-basic','Обязанность с have to','Have to строится как обычный глагол по вспомогательным формам do / does / did.',
'I have to, she has to. Do you have to …? Does she have to …? Don’t have to значит «не обязательно», а не «запрещено».',
'I have to wear a badge.|Does Ben have to work?|We don’t have to pay.',
'В вопросе после does нужна have, а не has.',`
She ___ to wear a badge. (have) :: has
Does Ben ___ to work? :: have
We don't have ___ pay. :: to
___ you have to get up early? :: Do
Yesterday I ___ to stay late. (have) :: had
He doesn't ___ to drive. :: have`);
add('lets','Совместное предложение с let’s','Let’s предлагает действие, которое говорящий хочет выполнить вместе с собеседником.',
'Let’s + начальная форма. Отрицание let’s not + глагол. В обычной инструкции используется повелительная форма без let’s.',
'Let’s check the timetable.|Let’s not hurry.|Please wait here.',
'После let’s не ставь to и не меняй форму по лицам.',`
Let's ___ the timetable. (check) :: check
Let's ___ hurry. (отрицание) :: not
Let's ___ outside. (meet) :: meet
Please ___ here. (wait) :: wait
Let's not ___ about it now. (argue) :: argue
Let's ___ some water. (buy) :: buy`);
add('there-tenses','Наличие в разных временах','Оборот there + be меняется по времени и числу, сохраняя значение наличия.',
'There was/were — прошлое. There has/have been — результат до настоящего. There will be — будущее.',
'There were two entrances.|There has been a delay.|There will be a meeting tomorrow.',
'Не добавляй is после will: there will be.',`
There ___ two entrances before the repair. (be, прошлое) :: were
There has ___ a delay. :: been
There will ___ a meeting tomorrow. :: be
There ___ a shop here years ago. (be, прошлое) :: was
There have ___ several changes. :: been
Will there ___ enough seats? :: be`);
add('impersonal-it','It для времени, погоды и расстояния','В английской фразе о погоде или времени обычно требуется формальное подлежащее it.',
'It is cold / late / five o’clock. It takes + время + to + глагол. Для оценки действия: It is useful to check.',
'It is windy today.|It is three kilometres to the lake.|It takes ten minutes to walk there.',
'Не опускай it в обычном полном предложении.',`
___ is windy today. :: It
It ___ ten minutes to walk there. (take) :: takes
It is useful ___ check the date. :: to
It ___ cold yesterday. (be) :: was
___ is nearly midnight. :: It
It takes an hour ___ get there. :: to`);
add('echo-questions','Короткий вопрос-реакция','Краткий вопрос может показать интерес к услышанной информации.',
'Повторяется вспомогательный глагол исходной фразы: I have finished. — Have you? She works here. — Does she? Форма местоимения соответствует собеседнику.',
'I can sail. — Can you?|Ben moved away. — Did he?|They are waiting. — Are they?',
'Обычный Present/Past Simple требует do / does / did даже без явного помощника в первой фразе.',`
I can sail. — ___ you? :: Can
Ben moved away. — ___ he? :: Did
They are waiting. — ___ they? :: Are
Nora works here. — ___ she? :: Does
I have finished. — ___ you? :: Have
We were late. — ___ you? :: Were`);
add('so-neither','Как согласиться: я тоже','Положительное и отрицательное согласие строятся разными словами.',
'So + вспомогательный + подлежащее — тоже да. Neither + вспомогательный + подлежащее — тоже нет. Too чаще в конце положительной фразы, either — отрицательной.',
'I like maps. — So do I.|I can’t ski. — Neither can I.|I don’t drive either.',
'После so / neither нужен подходящий помощник: do, am, have, can и другие.',`
I like maps. — So ___ I. :: do
I can't ski. — Neither ___ I. :: can
I don't drive ___. (too / either) :: either
She is ready. — So ___ we. :: are
I haven't eaten. — Neither ___ I. :: have
Ben works here, and Nora does ___. :: too`);
add('negative-forms','Как выразить отрицание','Отрицание строится возле вспомогательного глагола или через do в Simple.',
'Be / have / modal + not. Обычный Present/Past Simple: don’t / doesn’t / didn’t + начальная форма. No / nobody / never могут сами передавать отрицательный смысл.',
'He isn’t ready.|We didn’t hear it.|Nobody knows the code.',
'В стандартном английском избегай двойного отрицания типа I don’t know nothing.',`
He ___ ready. (is, отрицание) :: isn't|is not
We didn't ___ it. (hear) :: hear
Nobody ___ the code. (know) :: knows
She ___ finished yet. (has, отрицание) :: hasn't|has not
Ben can't ___ today. (come) :: come
I don't know ___. (anything / nothing) :: anything`);
add('question-prepositions','О ком и с кем спрашиваем','Предлог может остаться в конце обычного разговорного вопроса.',
'Who are you talking to? What are you looking at? What is it like? Не убирай предлог, который требуется смысловому глаголу.',
'Who is she waiting for?|What are they talking about?|What is your new town like?',
'What is it like? спрашивает об описании, а не о том, нравится ли предмет.',`
Who is she waiting ___? :: for
What are they talking ___? :: about
What is your new town ___? (описание) :: like
Who are you travelling ___? (с кем) :: with
What are you looking ___? (на что) :: at
Who did Ben give the map ___? :: to`);
add('which-how','Как выбрать вопросительное слово','Смысл нужного ответа определяет вопросительное слово.',
'What — открытый выбор; which — выбор из ограниченного набора. How + признак: how old, how far, how often. Whose спрашивает о владельце.',
'Which of these routes is shorter?|How far is the station?|Whose bag is this?',
'Не путай how many с how much: количество предметов и количество вещества.',`
___ of these two routes is shorter? :: Which
How ___ is the station? — Two kilometres. :: far
___ bag is this? — Nora's. :: Whose
How ___ do you swim? — Twice a week. :: often
How ___ are you? — Thirteen. :: old
How ___ chairs do we need? :: many`);
add('take-time','Сколько времени занимает действие','Конструкция с take позволяет назвать длительность и при необходимости исполнителя.',
'It takes (somebody) + время + to + глагол. Вопрос: How long does it take …? Для прошлого — took, для будущего — will take.',
'It takes me twenty minutes to walk home.|How long does it take to get there?|It took us an hour.',
'Не меняй смысловой глагол после to: to get, а не to getting.',`
It ___ me twenty minutes to walk home. (take, настоящее) :: takes
How long does it ___ to get there? :: take
It took us an hour ___ finish. :: to
Yesterday the trip ___ two hours. (take) :: took
How ___ did it take? :: long
It will ___ ten minutes. :: take`);
add('basic-verb-forms','Выбор начальной формы и -ing','Форма действия зависит от конструкции перед ним.',
'После modal — начальная форма. После want to — начальная форма. Для Continuous — be + -ing. После enjoy — -ing.',
'I can swim.|She wants to leave.|They are packing.|We enjoy walking.',
'Один и тот же глагол может принимать разные формы в разных конструкциях.',`
I can ___. (swim) :: swim
She wants to ___. (leave) :: leave
They are ___. (pack) :: packing
We enjoy ___. (walk) :: walking
Ben must ___ now. (go) :: go
Nora is ___ a letter. (write) :: writing`);
add('go-patterns','Куда пойти и чем заняться','Go сочетается с направлениями, видами поездок и некоторыми занятиями.',
'Go to + место; go home без to. Go for a walk; go on a trip; go swimming / shopping и другие занятия с -ing.',
'We went for a walk.|She goes swimming on Fridays.|They are going on a trip.',
'После go в названии занятия обычно -ing: go cycling, не go to cycling.',`
We went ___ a walk. :: for
She goes ___ on Fridays. (swim) :: swimming
They are going ___ a trip. :: on
Let's go ___ now. (home / to home) :: home
Ben went ___ the station. :: to
Nora wants to go ___. (shop) :: shopping`);
add('get-patterns','Несколько значений get','Get может означать получить, добраться, стать или принести в зависимости от продолжения.',
'Get + предмет — получить/добыть. Get + adjective — стать. Get to + место — добраться; get home — без to.',
'I got a reply.|It is getting colder.|What time did you get home?',
'Вопрос о get home обычно не требует to перед home.',`
It is getting ___. (cold, сравнительная форма) :: colder
What time did you get ___? (home / to home) :: home
We got ___ the station at nine. :: to
I ___ a reply yesterday. (get) :: got
Please get ___ soon. (поправляйся: well / good) :: well
Ben is getting ___. (ready / readiness) :: ready`);
add('do-make','Do и make в сочетаниях','Do часто относится к работе и занятиям, make — к созданию результата, но сочетания надо запоминать.',
'Do homework / the washing-up / your best. Make a decision / a mistake / a cake / a phone call.',
'I need to do my homework.|She made a useful suggestion.|We must make a decision.',
'По-английски make a mistake, но do an exercise.',`
I need to ___ my homework. (do / make) :: do
She ___ a useful suggestion. (make, прошлое) :: made
We must ___ a decision. :: make
Ben is ___ the washing-up. (do) :: doing
Please ___ your best. :: do
I ___ a mistake yesterday. (make) :: made`);
add('possessive-adjectives','My, your, his и her','Перед существительным используется притяжательная форма, связанная с владельцем.',
'I → my; you → your; he → his; she → her; it → its; we → our; they → their. Притяжательное its пишется без апострофа.',
'This is my desk.|They brought their notebooks.|The dog hurt its paw.',
'It’s означает it is / it has. Для принадлежности нужно its.',`
I have a desk. This is ___ desk. :: my
They brought ___ notebooks. (they) :: their
The dog hurt ___ paw. :: its
Nora has a camera. ___ camera is blue. :: Her
We like ___ new classroom. (we) :: our
Ben forgot ___ passport. (he) :: his`);
add('possessive-pronouns','Mine, yours и theirs','Если название предмета уже понятно, притяжательное местоимение может его заменить.',
'My book → mine; your → yours; his → his; her → hers; our → ours; their → theirs. После mine / hers обычно не ставят существительное.',
'This seat is mine.|That bag is hers.|The red folders are theirs.',
'В hers, yours, ours и theirs нет апострофа.',`
This seat belongs to me. It is ___. :: mine
That bag belongs to Nora. It is ___. :: hers
The red folders belong to them. They are ___. :: theirs
This room belongs to us. It is ___. :: ours
That coat belongs to you. It is ___. :: yours
The blue cap belongs to Ben. It is ___. :: his`);
add('possessive-case','Принадлежность через ’s','Имя владельца можно поставить перед предметом с притяжательной формой.',
'Единственное: Nora’s bag. Регулярное множественное на -s: the pupils’ bags. Неправильное множественное: the children’s bags.',
'This is Nora’s bike.|The pupils’ room is upstairs.|The children’s coats are here.',
'Расположение апострофа зависит от числа владельцев, а не числа предметов.',`
This is ___ bike. (Nora) :: Nora's
The ___ room is upstairs. (pupils, несколько) :: pupils'
The ___ coats are here. (children) :: children's
It is my ___ camera. (brother, один) :: brother's
This is the ___ entrance. (teachers, несколько) :: teachers'
The ___ changing room is closed. (men) :: men's`);
add('demonstratives','This, that, these и those','Форма зависит от числа предметов и того, как говорящий обозначает близость.',
'This / these — ближе в пространстве или контексте. That / those — дальше. This / that + единственное, these / those + множественное.',
'This key here is mine.|Those hills over there are high.|These files are new.',
'Не ставь this перед множественным числом: these books.',`
___ key here is mine. (this / these) :: This
___ hills over there are high. (that / those) :: Those
___ files here are new. (these / this) :: These
Look at ___ bird over there. (that / those) :: that
___ shoes here are wet. (these / this) :: These
Is ___ seat here free? (this / these) :: this`);
add('one-ones','Как заменить название предмета','One и ones помогают не повторять исчисляемое существительное.',
'One заменяет единственное число, ones — множественное. Перед ними могут стоять прилагательные, this/that или the.',
'I need a larger one.|The blue ones are cheaper.|Which one do you prefer?',
'Не заменяй неисчисляемое существительное механически словом one.',`
I need a larger ___. (one / ones) :: one
The blue ___ are cheaper. (one / ones) :: ones
Which ___ do you prefer? (один предмет) :: one
These shoes are old. I need new ___. :: ones
That chair is broken. Use this ___. :: one
The small bags are light; the large ___ are heavy. :: ones`);
add('negative-pronouns','Никто, ничто и нигде','Отрицательное местоимение само выражает отрицание.',
'Nobody / no one, nothing, nowhere. С отрицательным глаголом обычно anybody / anyone, anything, anywhere. Nobody и nothing согласуются в единственном числе.',
'Nobody knew the code.|I didn’t hear anything.|There is nowhere to sit.',
'В стандартной конструкции не совмещай didn’t и nothing для одного отрицания.',`
___ knew the code. (никто) :: Nobody|No one
I didn't hear ___. :: anything
There is ___ to sit. (негде) :: nowhere
Nothing ___ changed. (have) :: has
We didn't see ___. (никого) :: anybody|anyone
___ was in the room. (никто) :: Nobody|No one`);
add('indefinite-pronouns','Кто-то, что-нибудь и где-то','Составные неопределённые местоимения заменяют название человека, вещи или места.',
'Someone/something/somewhere часто вводят неизвестный конкретный объект. Anyone/anything/anywhere часто употребляются в вопросах и отрицаниях. Прилагательное идёт после: something useful.',
'Someone left a note.|Do you need anything?|We need somewhere quiet.',
'Порядок слов: something interesting, а не interesting something.',`
___ left a note. (кто-то) :: Someone|Somebody
Do you need ___? (что-нибудь) :: anything
We need ___ quiet. (какое-то место) :: somewhere
There is something ___ in the box. (useful / usefully) :: useful
Did you meet ___ interesting? (кого-нибудь) :: anyone|anybody
Let's go ___ warm. (куда-нибудь) :: somewhere`);
add('few-little','Небольшое количество и нехватка','Наличие a может менять смысл с «немного есть» на «почти нет».',
'A few / few + исчисляемое множественное. A little / little + неисчисляемое. A few и a little чаще положительны; few и little подчёркивают нехватку.',
'We have a little time, so we can talk.|We have little time, so hurry.|A few seats are still free.',
'Слово time в значении времени требует little, а не few.',`
We have a ___ time, so we can talk. (little / few) :: little
A ___ seats are still free. (few / little) :: few
There is ___ hope; the situation is very serious. (little / a little) :: little
I have a ___ questions. (few / little) :: few
We have very ___ money left. (few / little) :: little
Very ___ visitors came today. (few / little) :: few`);
add('enough','Достаточное количество','Enough показывает, что количества или степени хватает для цели.',
'Enough + существительное; прилагательное/наречие + enough. Продолжение цели часто строится с to + глагол.',
'We have enough time.|The room is warm enough.|He spoke slowly enough to understand.',
'Перед существительным enough стоит первым, после прилагательного — вторым.',`
We have ___ time. (enough / too) :: enough
The room is warm ___. :: enough
She is old enough ___ travel alone. :: to
There aren't enough ___. (chair, множественное) :: chairs
He spoke slowly ___ for me to understand. :: enough
Is this box big ___? :: enough`);
add('too','Чрезмерная степень','Too указывает, что признак или количество превышает подходящую норму.',
'Too + прилагательное/наречие; too much + неисчисляемое; too many + исчисляемое множественное. Для невозможного результата часто to + глагол.',
'The bag is too heavy to lift.|There are too many cars.|We spent too much time.',
'Too не является простой заменой very: оно часто подразумевает проблему.',`
The bag is too heavy ___ lift. :: to
There are too ___ cars. :: many
We spent too ___ time. :: much
She spoke too ___. (quickly / quick) :: quickly
It is ___ cold to swim. (too / enough) :: too
There is too ___ noise here. (much / many) :: much`);
add('double-object','Кому передаётся предмет','После give, send и некоторых других глаголов можно по-разному расположить получателя и предмет.',
'Give someone something или give something to someone. Если предмет заменён it, обычно give it to me. Buy something for someone.',
'Give Nora the key.|Give the key to Nora.|Please send it to me.',
'С местоименным предметом используй нейтральный порядок send it to me.',`
Give the key ___ Nora. :: to
Please send it ___ me. :: to
I bought a card ___ Ben. :: for
She gave ___ the map. (I) :: me
Can you lend the charger ___ us? :: to
We made a cake ___ our aunt. :: for`);
add('time-ranges','Начало, конец и длительность','Для временного диапазона нужны разные предлоги, чем для одиночной даты.',
'From … to — от начала до конца. Until — продолжение до момента. Since — начало ситуации до настоящего. For — длительность.',
'The shop is open from nine to six.|We stayed until noon.|She has worked here since July.',
'Для действия, продолжающегося сейчас, различай since July и for two months.',`
The shop is open ___ nine to six. :: from
We stayed ___ noon. :: until|till
She has worked here ___ July. :: since
We waited ___ twenty minutes. :: for
The course runs from March ___ May. :: to
Ben has lived here ___ three years. :: for`);
add('movement-prepositions','Через, над и вдоль','Предлог движения описывает траекторию относительно объекта.',
'Across — с одной стороны на другую; through — через внутреннее пространство; along — вдоль; over — над или через верх; up/down — вверх/вниз.',
'We walked through the tunnel.|The bird flew over the roof.|She ran across the yard.',
'Выбирай through для туннеля и across для открытой поверхности или площади.',`
We walked ___ the tunnel. :: through
The bird flew ___ the roof. (над) :: over
She ran ___ the yard from one side to the other. :: across
We walked ___ the river. (вдоль) :: along
Ben climbed ___ the ladder. (вверх) :: up
The ball rolled ___ the stairs. (вниз) :: down`);
add('phrasal-object','Дополнение у фразового глагола','У отделяемого сочетания имя предмета и местоимение располагаются по-разному.',
'Turn the light off / turn off the light допустимы. С it: turn it off. У look after / look for порядок другой: look after him, а не look him after.',
'Put your gloves on.|Put them on.|I am looking for them.',
'Проверяй, отделяется ли конкретное сочетание, прежде чем менять порядок слов.',`
Put ___ on. (the gloves → they, объект) :: them
Turn it ___. (выключи) :: off
I am looking ___ them. (ищу) :: for
She looks after ___. (he) :: him
Please write it ___. (запиши) :: down
Take ___ off. (the coat → it) :: it`);
module.exports={skills};
