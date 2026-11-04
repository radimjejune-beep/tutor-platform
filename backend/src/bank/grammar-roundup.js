// bank/grammar-roundup.js — авторские упражнения Lessonfold на грамматику по темам юнитов New Round-Up 3 и 4.
// Из учебников взяты только названия тем. Все предложения составлены заново.
// gaps: [ответ|допустимый вариант]; bank — ответы даются на выбор, type — ученик пишет сам.
const lines = (s) => s.trim().split('\n').map((l) => l.trim()).filter(Boolean);
const gaps = (s, mode = 'bank') => ({ type: 'gaps', text: lines(s).join('\n'), mode, distractors: [] });
const order = (s) => ({ type: 'order', sentences: lines(s) });
const groups = (obj) => ({ type: 'groups', groups: Object.entries(obj).map(([name, items]) => ({ name, items: items.split(',').map((x) => x.trim()) })) });
const match = (s) => ({ type: 'match', pairs: lines(s).map((l) => { const [a, b] = l.split(' - '); return { a: a.trim(), b: b.trim() }; }) });

const R3 = 'round-up-3';
const R4 = 'round-up-4';
const t = (book, unit, n, title, game) => ({ key: `gr-${book}-${unit}-${n}`, book, unit, title, game });

module.exports = [
  // ---------------- New Round-Up 3 ----------------
  t(R3, '1', 1, 'Множественное число: напиши форму', gaps(`
    one box, two [boxes]
    one baby, three [babies]
    one leaf, many [leaves]
    one child, four [children]
    one tooth, all my [teeth]
    one tomato, five [tomatoes]
    one toy, lots of [toys]
    one mouse, two [mice]
    one woman, three [women]
    one photo, ten [photos]`, 'type')),
  t(R3, '1', 2, 'Исчисляемые и неисчисляемые', groups({ 'Можно посчитать': 'apple, chair, egg, pencil, friend, bottle', 'Нельзя посчитать': 'milk, bread, water, money, rice, information' })),
  t(R3, '1', 3, 'a / an / some', gaps(`
    I'd like [an] orange, please.
    There is [some] milk in the fridge.
    She has got [a] new bike.
    Can I have [some] water?
    He eats [an] egg every morning.
    We need [some] bread for the sandwiches.`)),

  t(R3, '2', 1, 'be: am, is, are', gaps(`
    I [am|'m] eleven years old.
    My sister [is|'s] at school now.
    We [are|'re] from Kazan.
    [Is] your dog friendly?
    They [aren't|are not] at home today.
    You [are|'re] my best friend.
    It [isn't|is not] cold today.`)),
  t(R3, '2', 2, 'have got / has got', gaps(`
    I [have got|'ve got] two brothers.
    My cat [has got|'s got] green eyes.
    [Have] you got a pet?
    She [hasn't got|has not got] a phone.
    They [have got|'ve got] a big garden.
    [Has] your father got a car?`)),
  t(R3, '2', 3, 'can: собери предложение', order(`
    I can swim very well.
    Can you ride a horse?
    My brother can't play the piano.
    Birds can fly but fish can't.
    Can I open the window, please?`)),

  t(R3, '3', 1, 'Притяжательные: my, his, her, their', gaps(`
    I've got a sister. [Her] name is Anna.
    Tom loves [his] new bike.
    We like [our] teacher very much.
    The children are with [their] grandparents.
    Is this [your] bag, Max?
    The dog is playing with [its] ball.`)),
  t(R3, '3', 2, "Притяжательный 's", gaps(`
    This is (Kate) [Kate's] room.
    These are (my parents) [my parents'] keys.
    That is (the children) [the children's] playground.
    Where is (Mark) [Mark's] jacket?
    (My brother) [My brother's] car is red.`, 'type')),
  t(R3, '3', 3, 'this, that, these, those', gaps(`
    [This] book here is mine.
    Look at [those] birds in the sky!
    [These] shoes are too small for me.
    Who is [that] man over there?
    Are [these] your glasses on my desk?
    [That] house on the hill is very old.`)),

  t(R3, '4', 1, 'a, an, the или ничего', gaps(`
    I saw [a] cat in the garden. [The] cat was black.
    She is [an] engineer.
    [The] sun is very hot today.
    We play [-] football after school.
    He lives in [the] UK.
    Can you close [the] door, please?
    I have [-] breakfast at seven.`)),
  t(R3, '4', 2, 'Артикль: с ним или без', groups({ 'С the': 'the sun, the Thames, the Alps, the cinema, the guitar', 'Без артикля': 'Moscow, breakfast, Russia, tennis, Mount Elbrus' })),

  t(R3, '5', 1, 'much, many, a lot of', gaps(`
    How [much] sugar do you want?
    There aren't [many] people in the park.
    She has got [a lot of] friends.
    How [many] apples are there?
    I haven't got [much] time today.
    We drink [a lot of] water in summer.`)),
  t(R3, '5', 2, 'a few, a little', gaps(`
    Add [a little] salt to the soup.
    I've got [a few] stickers for you.
    There is [a little] juice in the bottle.
    [A few] students are late today.
    Can I have [a little] milk in my tea?
    We stayed there for [a few] days.`)),
  t(R3, '5', 3, 'some и any', gaps(`
    Are there [any] eggs in the fridge?
    I want to buy [some] bananas.
    There isn't [any] cheese left.
    Would you like [some] cake?
    We haven't got [any] homework today.
    Have you got [any] brothers or sisters?`)),

  t(R3, '6', 1, 'somebody, anything, nowhere...', gaps(`
    There is [somebody|someone] at the door.
    I can't find my keys [anywhere].
    Is there [anything] in the box?
    [Nobody|No one] knows the answer.
    Let's go [somewhere] warm this summer.
    I'm hungry. I want [something] to eat.
    [Everybody|Everyone] in my class likes music.`)),
  t(R3, '6', 2, 'Неопределённые местоимения: собери фразу', order(`
    Is there anybody at home?
    I have got nothing to wear.
    Everyone is waiting for you.
    Did you go anywhere last weekend?
    Somebody took my pen.`)),

  t(R3, '7', 1, 'Present Simple: форма глагола', gaps(`
    My dad (work) [works] in a bank.
    I (not like) [don't like|do not like] fish.
    She (go) [goes] to school by bus.
    (you / play) [Do you play] tennis?
    The shop (open) [opens] at nine.
    He (not watch) [doesn't watch|does not watch] TV in the morning.
    My cat (sleep) [sleeps] all day.`, 'type')),
  t(R3, '7', 2, 'Present Simple: вопросы', order(`
    Where do you live?
    What time does the lesson start?
    Does your brother like pizza?
    How often do you go swimming?
    Do they speak English at home?`)),
  t(R3, '7', 3, 'Наречия частоты: место в предложении', order(`
    I always get up at seven.
    She is never late for school.
    We usually have lunch at home.
    He sometimes plays computer games.
    They often visit their grandparents.`)),

  t(R3, '8', 1, 'Present Continuous: форма', gaps(`
    Look! It (rain) [is raining|'s raining].
    I (read) [am reading|'m reading] a great book now.
    They (not play) [aren't playing|are not playing] football at the moment.
    (she / sleep) [Is she sleeping]?
    We (have) [are having|'re having] dinner right now.
    He (swim) [is swimming|'s swimming] in the pool.`, 'type')),
  t(R3, '8', 2, 'Present Simple или Present Continuous', gaps(`
    I usually [walk] to school, but today I [am taking] the bus.
    Listen! The baby [is crying].
    She [plays] the piano every day.
    Water [boils] at 100 degrees.
    What [are you doing] now?
    We [don't go] to school on Sundays.`)),

  t(R3, '9', 1, 'Предлоги места: in, on, under, next to', gaps(`
    The cat is [under] the table.
    The picture is [on] the wall.
    My pen is [in] my pencil case.
    The bank is [next to] the café.
    The lamp is [between] the bed and the desk.
    There is a tree [in front of] our house.`)),
  t(R3, '9', 2, 'Предлоги времени: at, on, in', groups({ at: 'seven o\'clock, night, the weekend, noon', on: 'Monday, my birthday, 5 May, Friday morning', in: 'June, 2015, the morning, winter' })),
  t(R3, '9', 3, 'Предлоги движения', gaps(`
    The dog jumped [over] the fence.
    We walked [through] the forest.
    The boy ran [into] the room.
    The cat climbed [up] the tree.
    The car went [across] the bridge.
    She got [out of] the taxi.`)),

  t(R3, '10', 1, 'Past Simple: правильные и неправильные глаголы', gaps(`
    Yesterday I (play) [played] football with my friends.
    We (go) [went] to the zoo last Sunday.
    She (buy) [bought] a new dress.
    They (watch) [watched] a film in the evening.
    I (see) [saw] a big dog in the park.
    He (write) [wrote] a letter to his granny.
    We (have) [had] pizza for dinner.`, 'type')),
  t(R3, '10', 2, 'Неправильные глаголы: найди пару', match(`
    go - went
    eat - ate
    take - took
    make - made
    come - came
    swim - swam
    give - gave
    find - found`)),
  t(R3, '10', 3, 'Past Simple: отрицание и вопрос', order(`
    Did you enjoy the party?
    I didn't go to school yesterday.
    Where did you spend your holidays?
    She didn't like the film.
    What did they buy at the market?`)),

  t(R3, '11', 1, 'Present Perfect: форма', gaps(`
    I (finish) [have finished|'ve finished] my homework.
    She (lose) [has lost|'s lost] her keys.
    (you / ever / be) [Have you ever been] to London?
    We (not see) [haven't seen|have not seen] this film.
    He (break) [has broken|'s broken] his arm.
    They (just / arrive) [have just arrived|'ve just arrived].`, 'type')),
  t(R3, '11', 2, 'ever, never, just, already, yet', gaps(`
    Have you [ever] eaten sushi?
    I have [never] been to China.
    She has [just] left. You can still see her car.
    We have [already] done the shopping.
    Has the film started [yet]?
    I haven't read this book [yet].`)),

  t(R3, '12', 1, 'Past Continuous: форма', gaps(`
    At eight o'clock I (have) [was having] breakfast.
    They (play) [were playing] chess all evening.
    What (you / do) [were you doing] at 5 p.m. yesterday?
    It (not rain) [wasn't raining|was not raining] in the morning.
    We (walk) [were walking] home when we met Tom.`, 'type')),
  t(R3, '12', 2, 'Past Simple или Past Continuous', gaps(`
    I [was reading] a book when the phone [rang].
    While we [were walking] in the park, it started to rain.
    She [fell] while she [was skiing].
    When I [arrived], they [were having] dinner.`)),

  t(R3, '13', 1, 'will или be going to', gaps(`
    Look at those clouds! It [is going to] rain.
    I'm tired. I think I [will] go to bed.
    We [are going to] visit Kazan next month. We have the tickets.
    Maybe she [will] call you tomorrow.
    The phone is ringing. I [will] answer it.
    He [is going to] be a doctor. He studies a lot.`)),
  t(R3, '13', 2, 'Будущее время: собери фразу', order(`
    Shall I help you with your bag?
    I'm going to learn to swim this summer.
    Will you come to my party?
    I think it will be sunny tomorrow.
    Shall we go to the cinema tonight?`)),

  t(R3, '14', 1, 'can, must, mustn\'t, have to', gaps(`
    You [mustn't] use your phone in the test.
    I [can] speak three languages.
    We [have to] wear a uniform at school.
    You [must] be quiet in the library.
    [Can] I borrow your pen, please?
    You [don't have to] come if you are busy.`)),
  t(R3, '14', 2, 'should и shouldn\'t: советы', gaps(`
    You've got a cold. You [should] stay in bed.
    You [shouldn't] eat so many sweets.
    It's late. We [should] go home.
    He [shouldn't] play computer games all night.
    You [should] take an umbrella. It's cloudy.`)),

  t(R3, '15', 1, 'Условные предложения 0 и 1', gaps(`
    If you heat ice, it [melts].
    If it [rains] tomorrow, we will stay at home.
    If you study hard, you [will pass] the test.
    If I [see] Tom, I will tell him.
    Plants die if they [don't get] water.
    We [will go] to the beach if it is sunny.`)),
  t(R3, '15', 2, 'Если..., то...: собери предложение', order(`
    If you are hungry, have a sandwich.
    If I have time, I will help you.
    If you mix red and white, you get pink.
    We will be late if we don't hurry.`)),

  t(R3, '16', 1, 'Вопросительные слова', gaps(`
    [Where] do you live? In Moscow.
    [When] is your birthday? In May.
    [Who] is your best friend? Kate.
    [How old] are you? I'm twelve.
    [What] is your favourite colour? Blue.
    [Why] are you sad? Because I lost my cat.
    [How many] brothers have you got? Two.`)),
  t(R3, '16', 2, 'Общие вопросы: собери', order(`
    Are you ready for the test?
    Can your sister speak French?
    Do you like ice cream?
    Has he got a dog?
    Did they go to the party?`)),

  t(R3, '17', 1, 'Страдательный залог: настоящее время', gaps(`
    English (speak) [is spoken] in many countries.
    Cars (make) [are made] in this factory.
    The room (clean) [is cleaned] every day.
    Tea (grow) [is grown] in India.
    These toys (sell) [are sold] all over the world.`, 'type')),
  t(R3, '17', 2, 'Страдательный залог: прошедшее время', gaps(`
    The window (break) [was broken] yesterday.
    This book (write) [was written] in 1990.
    The cakes (eat) [were eaten] at the party.
    The letters (send) [were sent] last week.
    The bridge (build) [was built] 100 years ago.`, 'type')),

  t(R3, '18', 1, 'to + глагол или -ing', gaps(`
    I want [to go] to the park.
    She enjoys [reading] books.
    We decided [to stay] at home.
    He likes [playing] the guitar.
    They hope [to win] the match.
    Stop [talking], please!`)),
  t(R3, '18', 2, 'too и enough', gaps(`
    This coffee is [too] hot to drink.
    He isn't old [enough] to drive.
    The bag is [too] heavy for me.
    We haven't got [enough] chairs for everyone.
    It's [too] cold to swim today.`)),

  t(R3, '19', 1, 'who, which, where', gaps(`
    This is the boy [who] lives next door.
    I like films [which] make me laugh.
    That's the café [where] we met.
    The woman [who] works here is very kind.
    Here is the book [which] I told you about.
    This is the town [where] I was born.`)),
  t(R3, '19', 2, 'Придаточные: собери предложение', order(`
    A doctor is a person who helps sick people.
    A fridge is a machine which keeps food cold.
    A library is a place where you can read books.
    This is the dog which bit me.`)),

  t(R3, '20', 1, 'Сравнительная и превосходная степень', gaps(`
    An elephant is (big) [bigger] than a horse.
    This is the (good) [best] day of my life!
    My bag is (heavy) [heavier] than yours.
    Russia is the (large) [largest] country in the world.
    Maths is (difficult) [more difficult] than English for me.
    Today is (bad) [worse] than yesterday.`, 'type')),
  t(R3, '20', 2, 'Прилагательное или наречие', gaps(`
    She sings [beautifully].
    He is a [careful] driver.
    Please speak [slowly].
    The test was [easy].
    They played [badly] yesterday.
    He runs very [fast].`)),
  t(R3, '20', 3, 'Степени сравнения: найди пару', match(`
    good - better - the best
    bad - worse - the worst
    big - bigger - the biggest
    happy - happier - the happiest
    far - further - the furthest
    interesting - more interesting - the most interesting`)),

  // ---------------- New Round-Up 4 ----------------
  t(R4, '1', 1, 'Present Simple или Present Continuous', gaps(`
    I [am writing] an email at the moment.
    She usually [goes] to bed at ten.
    Look! The children [are dancing].
    Water [freezes] at 0 degrees.
    We [are visiting] our grandparents this weekend.
    He [doesn't eat] meat.
    What [are you laughing] at?`)),
  t(R4, '1', 2, 'Глаголы состояния', gaps(`
    I (know) [know] the answer.
    This cake (taste) [tastes] delicious.
    She (want) [wants] a new phone.
    (you / understand) [Do you understand] me?
    He (not believe) [doesn't believe|does not believe] in ghosts.
    The box (belong) [belongs] to my brother.`, 'type')),
  t(R4, '1', 3, 'Настоящие времена: собери', order(`
    What are you doing this evening?
    She works as a nurse in a big hospital.
    I'm staying with my aunt this week.
    How often does the bus come?`)),

  t(R4, '2', 1, 'Past Simple или Present Perfect', gaps(`
    I [have lived] here since 2018.
    We [went] to Spain last summer.
    She [has never seen] snow.
    When [did you arrive]?
    He [has just finished] his project.
    They [met] two years ago.`)),
  t(R4, '2', 2, 'for или since', groups({ for: 'two hours, ten years, a long time, three days, ages', since: '2010, Monday, last week, I was five, yesterday' })),
  t(R4, '2', 3, 'Present Perfect: форма', gaps(`
    How long (you / know) [have you known] Ann?
    I (not finish) [haven't finished|have not finished] my essay yet.
    She (already / see) [has already seen] this film.
    We (be) [have been] friends for years.`, 'type')),

  t(R4, '3', 1, 'Степени сравнения: форма', gaps(`
    This is the (exciting) [most exciting] film I've ever seen.
    My room is (tidy) [tidier] than my brother's.
    It's (hot) [hotter] today than yesterday.
    He is the (funny) [funniest] boy in our class.
    This task is (easy) [easier] than the last one.`, 'type')),
  t(R4, '3', 2, 'as ... as, the ... the', gaps(`
    Tom is [as] tall as his father.
    This phone isn't [as] expensive as that one.
    The [more] you read, the more you learn.
    The sooner we start, the [sooner] we finish.
    She is not [so|as] clever as she thinks.`)),
  t(R4, '3', 3, 'Наречия: форма', gaps(`
    He drives (careful) [carefully].
    She works (hard) [hard].
    They arrived (late) [late].
    He speaks English (good) [well].
    The baby is sleeping (quiet) [quietly].`, 'type')),

  t(R4, '4', 1, 'will, be going to, Present Continuous', gaps(`
    I [am meeting] Kate at six. We arranged it yesterday.
    I think robots [will] do all the housework one day.
    Watch out! You [are going to] fall!
    We [are going to] paint the kitchen next week. We bought the paint.
    I [will] help you with that box.`)),
  t(R4, '4', 2, 'Future Continuous', gaps(`
    This time tomorrow I (fly) [will be flying] to Sochi.
    At 10 a.m. we (write) [will be writing] a test.
    Don't call at seven. I (have) [will be having] dinner.
    (you / use) [Will you be using] the computer tonight?`, 'type')),

  t(R4, '5', 1, 'Present Perfect Continuous: форма', gaps(`
    I (wait) [have been waiting|'ve been waiting] for an hour.
    She (learn) [has been learning|'s been learning] English since she was six.
    How long (you / play) [have you been playing] the guitar?
    It (rain) [has been raining|'s been raining] all morning.
    They (work) [have been working|'ve been working] here for years.`, 'type')),
  t(R4, '5', 2, 'Perfect или Perfect Continuous', gaps(`
    I [have read] three books this month.
    Your eyes are red. [Have you been crying]?
    She [has been cleaning] the house all day. She is tired.
    We [have visited] Moscow twice.
    He [has been running]. He is out of breath.`)),

  t(R4, '6', 1, 'used to', gaps(`
    I [used to] have long hair when I was a child.
    She [didn't use to] like vegetables, but now she loves them.
    [Did] you use to play with dolls?
    We [used to] live in a small village.
    My grandfather [used to] work on a farm.`)),
  t(R4, '6', 2, 'be used to и get used to', gaps(`
    I [am used to] getting up early. I do it every day.
    She can't [get used to] the cold weather here.
    He [isn't used to] driving on the left.
    You will soon [get used to] your new school.`)),
  t(R4, '6', 3, 'Past Continuous и was going to', gaps(`
    I [was going to] call you, but I forgot.
    While I [was cooking], the lights went out.
    We [were going to] go out, but it started to rain.
    What [were you doing] at midnight?`)),

  t(R4, '7', 1, 'Возвратные местоимения', gaps(`
    I hurt [myself] when I fell.
    She made the cake [herself].
    Help [yourself] to some tea!
    The children enjoyed [themselves] at the party.
    He looked at [himself] in the mirror.
    We painted the room [ourselves].`)),
  t(R4, '7', 2, 'both, either, neither', gaps(`
    [Both] my parents are teachers.
    [Neither] of us likes coffee.
    You can take [either] bus. They both go to the centre.
    I like [both] cats and dogs.
    [Neither] answer is correct.`)),
  t(R4, '7', 3, 'mine, yours, theirs', gaps(`
    This pen is (I) [mine].
    Is this bag (you) [yours]?
    The red car is (they) [theirs].
    That book is (she) [hers].
    Our house is bigger than (he) [his].`, 'type')),

  t(R4, '8', 1, 'Past Perfect: форма', gaps(`
    When we arrived, the film (already / start) [had already started].
    She was sad because she (lose) [had lost] her ring.
    I (never / see) [had never seen] the sea before that trip.
    They (leave) [had left] before I called.`, 'type')),
  t(R4, '8', 2, 'Past Simple или Past Perfect', gaps(`
    After he [had finished] his homework, he [went] out.
    When I got to the station, the train [had left].
    She [didn't recognise] me because I [had changed] a lot.
    We were hungry because we [hadn't eaten] all day.`)),

  t(R4, '9', 1, 'Модальные глаголы: значение', match(`
    You must stop. - обязанность, правило
    You mustn't smoke here. - запрет
    You don't have to come. - нет необходимости
    You should rest. - совет
    It might rain. - возможность
    She can't be at home. - уверенность, что нет
    He must be tired. - уверенность, что да
    Could you help me? - вежливая просьба`)),
  t(R4, '9', 2, 'Модальные глаголы в предложении', gaps(`
    You [mustn't] touch that. It's dangerous.
    She [can't] be ill. I saw her at the gym an hour ago.
    We [don't have to] wear a uniform on Fridays.
    He's been working all day. He [must] be tired.
    Take an umbrella. It [might] rain.
    You [should] see a doctor about your cough.`)),

  t(R4, '10', 1, 'Разделительные вопросы', gaps(`
    You like pizza, [don't you]?
    She isn't at home, [is she]?
    They went to the party, [didn't they]?
    He can swim, [can't he]?
    We have met before, [haven't we]?
    Let's go, [shall we]?`)),
  t(R4, '10', 2, 'Вопросы к подлежащему и к дополнению', order(`
    Who broke the window?
    What did you see in the forest?
    Who told you the news?
    Which bus goes to the centre?
    What happened at the party?`)),

  t(R4, '11', 1, 'Инфинитив или герундий', gaps(`
    I'm looking forward to [seeing] you.
    She agreed [to help] us.
    He avoids [eating] junk food.
    We can't afford [to buy] a new car.
    Do you mind [opening] the window?
    I'd like [to visit] Japan one day.`)),
  t(R4, '11', 2, 'Глаголы и формы после них', groups({ '+ to + глагол': 'want, decide, hope, promise, plan', '+ -ing': 'enjoy, finish, avoid, mind, suggest' })),

  t(R4, '12', 1, 'Страдательный залог в разных временах', gaps(`
    The museum (visit) [is visited] by thousands of people every year.
    The cake (bake) [was baked] by my mum.
    The new school (build) [will be built] next year.
    The road (repair) [is being repaired] now.
    The tickets (already / sell) [have already been sold].`, 'type')),
  t(R4, '12', 2, 'Страдательный залог: собери', order(`
    The letter was written by my grandfather.
    English is spoken all over the world.
    The windows are cleaned every month.
    The match will be shown on TV.`)),

  t(R4, '13', 1, 'Условные предложения 1, 2, 3', gaps(`
    If it rains, we [will stay] at home.
    If I [had] a million roubles, I would travel the world.
    If you had studied, you [would have passed] the exam.
    If I [were] you, I would apologise.
    She [would have come] if you had invited her.`)),
  t(R4, '13', 2, 'Тип условного предложения', match(`
    If you heat water, it boils. - нулевой: всегда так
    If you call me, I'll come. - первый: реальное будущее
    If I were taller, I'd play basketball. - второй: нереальное сейчас
    If I had known, I would have helped. - третий: нереальное прошлое`)),

  t(R4, '14', 1, 'I wish и if only', gaps(`
    I wish I [had] more free time.
    I wish I [could] fly.
    She wishes she [hadn't said] that.
    If only it [were|was] summer now!
    I wish you [would stop] making that noise.`)),
  t(R4, '14', 2, 'Желания: собери', order(`
    I wish I knew the answer.
    If only I had listened to you.
    She wishes she lived by the sea.
    I wish it would stop raining.`)),

  t(R4, '15', 1, 'Относительные местоимения', gaps(`
    The girl [who] sits next to me is from Minsk.
    The house [which] we bought is very old.
    That's the man [whose] car was stolen.
    I remember the day [when] we met.
    This is the street [where] I grew up.`)),
  t(R4, '15', 2, 'Объедини: относительные придаточные', order(`
    The book that you gave me is great.
    The boy whose bike I borrowed is my cousin.
    This is the place where the accident happened.
    My aunt, who lives in Omsk, is a doctor.`)),

  t(R4, '16', 1, 'Косвенная речь: утверждения', gaps(`
    "I am tired." She said that she [was] tired.
    "We live in Perm." They said that they [lived] in Perm.
    "I will call you." He said that he [would] call me.
    "I have finished." She said that she [had finished].
    "I can swim." He said that he [could] swim.`)),
  t(R4, '16', 2, 'Косвенная речь: вопросы и просьбы', gaps(`
    "Where do you live?" She asked me where I [lived].
    "Are you hungry?" He asked if I [was] hungry.
    "Close the door." Mum told me [to close] the door.
    "Don't be late." The teacher told us [not to be] late.`)),
  t(R4, '16', 3, 'Слова-указатели в косвенной речи', match(`
    now - then
    today - that day
    tomorrow - the next day
    yesterday - the day before
    here - there
    this - that`)),

  t(R4, '17', 1, 'Союзы и связки', gaps(`
    I was tired, [but] I finished my work.
    We stayed at home [because] it was raining.
    [Although] it was cold, we went swimming.
    She studied hard, [so] she passed the exam.
    Take a coat [in case] it gets cold.
    [In spite of] the rain, they played football.`)),
  t(R4, '17', 2, 'Предлоги после прилагательных', gaps(`
    She is good [at] maths.
    I'm afraid [of] spiders.
    He is interested [in] history.
    We are proud [of] our team.
    Are you angry [with] me?
    This town is famous [for] its cheese.`)),

  t(R4, '18', 1, 'Артикли: a, an, the, ничего', gaps(`
    I'd like [an] apple and [a] banana.
    [The] Volga is the longest river in Europe.
    She plays [the] piano beautifully.
    We go to [-] school by bus.
    [The] rich should help [the] poor.
    He is [the] best student in our group.`)),
  t(R4, '18', 2, 'Артикль с названиями', groups({ 'С the': 'the Pacific Ocean, the USA, the Urals, the Hermitage, the Netherlands', 'Без артикля': 'Lake Baikal, Europe, Red Square, Mars, Oxford Street' })),
];
