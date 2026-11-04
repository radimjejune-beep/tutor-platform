// bank/grammar-units.js — дополнительные авторские упражнения на грамматику юнитов Solutions Elementary и Speakout A1.
// Из учебников взяты только грамматические темы юнитов. Все предложения составлены заново.
const lines = (s) => s.trim().split('\n').map((l) => l.trim()).filter(Boolean);
const gaps = (s, mode = 'bank') => ({ type: 'gaps', text: lines(s).join('\n'), mode, distractors: [] });
const order = (s) => ({ type: 'order', sentences: lines(s) });

const S = 'solutions-elem-3';
const P = 'speakout-a1-3';
const t = (book, unit, n, title, game) => ({ key: `gr-${book}-${unit}-${n}`, book, unit, title, game });

module.exports = [
  // ---------------- Solutions Elementary ----------------
  t(S, 'I', 1, 'be и have got: напиши форму', gaps(`
    My name (be) [is] Lena.
    I (have got) [have got|'ve got] a cat and a dog.
    (be / you) [Are you] fourteen?
    My friends (not be) [aren't|are not] in my class.
    (have got / she) [Has she got] a guitar?
    We (not have got) [haven't got|have not got] a piano.`, 'type')),
  t(S, 'I', 2, 'this, that, these, those и can', gaps(`
    [These] pencils here are new.
    Is [that] your bag over there?
    [Can] I use your ruler, please?
    I [can't] ski, but I can skate.
    [Those] boys over there are my cousins.
    [This] is my desk.`)),

  t(S, '1', 1, 'Present Simple: утверждения', gaps(`
    My mum (cook) [cooks] dinner every evening.
    I (tidy) [tidy] my room on Saturdays.
    My brother (wash) [washes] the dishes after lunch.
    Our grandparents (live) [live] in a village.
    My sister (study) [studies] at university.
    Dad (do) [does] the ironing on Sundays.`, 'type')),
  t(S, '1', 2, 'Present Simple: вопросы и отрицания', order(`
    Does your brother help at home?
    I don't load the dishwasher.
    Do your parents work at the weekend?
    My cousin doesn't live near us.
    Who sets the table in your family?`)),

  t(S, '2', 1, 'have to и don\'t have to', gaps(`
    We [have to] wear a uniform at my school.
    You [don't have to] come early tomorrow. The lesson starts at ten.
    She [has to] get up at six on weekdays.
    [Do] you have to do homework every day?
    He [doesn't have to] go to school on Sunday.`)),
  t(S, '2', 2, 'Вопросительные слова', gaps(`
    [What] time do you get up?
    [When] do you have PE?
    [Where] does your best friend live?
    [Who] is your maths teacher?
    [How often] do you go to the school club?
    [Why] do you like biology?`)),

  t(S, '3', 1, 'Present Continuous: что на ком надето', gaps(`
    Today Kate (wear) [is wearing|'s wearing] a long skirt.
    I (not wear) [am not wearing|'m not wearing] my school uniform now.
    (you / try on) [Are you trying on] the jeans?
    The boys (play) [are playing|'re playing] football in their tracksuits.
    Look! It (snow) [is snowing|'s snowing].`, 'type')),
  t(S, '3', 2, 'Обычно или сейчас', gaps(`
    I usually [wear] jeans, but today I [am wearing] a dress.
    My dad [buys] clothes online.
    Shh! The baby [is sleeping].
    She [doesn't like] baggy clothes.
    What [are you doing] at the moment?`)),

  t(S, '4', 1, 'some, any, much, many', gaps(`
    Is there [any] milk in the fridge?
    There are [some] apples on the table.
    How [much] rice do we need?
    How [many] eggs are there?
    We haven't got [any] bread.
    There isn't [much] cheese left.`)),
  t(S, '4', 2, 'a few, a little, a lot of', gaps(`
    I'd like [a little] sugar in my tea.
    There are [a few] olives on the pizza.
    We eat [a lot of] vegetables in summer.
    Can I have [a little] water, please?
    Only [a few] people came to the café.`)),

  t(S, '5', 1, 'Сравнительная степень', gaps(`
    The city is (noisy) [noisier] than the village.
    A plane is (fast) [faster] than a train.
    Moscow is (big) [bigger] than Tula.
    The museum is (interesting) [more interesting] than the zoo.
    Your idea is (good) [better] than mine.`, 'type')),
  t(S, '5', 2, 'Превосходная степень', gaps(`
    This is the (tall) [tallest] building in our town.
    Sunday is the (busy) [busiest] day at the shopping centre.
    It's the (bad) [worst] café in the street.
    This is the (beautiful) [most beautiful] park in the city.
    Red Square is one of the (famous) [most famous] places in Russia.`, 'type')),

  t(S, '6', 1, 'Past Simple: правильные глаголы', gaps(`
    Last summer we (visit) [visited] a wildlife park.
    I (watch) [watched] a film about sharks.
    The monkey (jump) [jumped] onto the tree.
    We (walk) [walked] along the river.
    They (stay) [stayed] in a tent for a week.
    She (study) [studied] animals at university.`, 'type')),
  t(S, '6', 2, 'was, were, could', gaps(`
    The forest [was] very quiet.
    The bears [were] near the river.
    I [couldn't] see the eagle. It was too far.
    [Were] you scared of the snake?
    When I was five, I [could] swim.`)),

  t(S, '7', 1, 'Past Simple: неправильные глаголы', gaps(`
    I (buy) [bought] a new laptop last week.
    She (send) [sent] me a message.
    We (make) [made] a video for the school website.
    He (forget) [forgot] his password.
    They (write) [wrote] a post about the festival.`, 'type')),
  t(S, '7', 2, 'Past Simple: вопросы и отрицания', order(`
    Did you download the new app?
    I didn't delete the photos.
    What did you post yesterday?
    She didn't connect to the Wi-Fi.
    Did they print the tickets?`)),

  t(S, '8', 1, 'be going to', gaps(`
    I (play) [am going to play|'m going to play] tennis this afternoon.
    We (not watch) [aren't going to watch|are not going to watch] the match tonight.
    (you / try) [Are you going to try] yoga?
    She (run) [is going to run|'s going to run] a marathon next year.`, 'type')),
  t(S, '8', 2, 'will: прогнозы', gaps(`
    I think our team [will] win.
    It [won't] rain tomorrow. The forecast is good.
    [Will] you be at the stadium?
    Maybe she [will] become a famous skier.
    I'm sure you [will] enjoy the climbing course.`)),

  t(S, '9', 1, 'Present Perfect: форма', gaps(`
    We (paint) [have painted|'ve painted] the living room.
    She (buy) [has bought|'s bought] a new sofa.
    (you / clean) [Have you cleaned] the kitchen?
    They (not move) [haven't moved|have not moved] to the new flat.
    I (lose) [have lost|'ve lost] the key to the garage.`, 'type')),
  t(S, '9', 2, 'just, already, yet', gaps(`
    I've [just] made tea. Do you want some?
    Have you tidied your room [yet]?
    She has [already] washed the dishes.
    We haven't bought the curtains [yet].
    He's [just] come home.`)),

  // ---------------- Speakout A1 ----------------
  t(P, '1', 1, 'be: I, you, he, she, it', gaps(`
    I [am|'m] from Russia.
    [Are] you a student?
    He [is|'s] a nurse.
    She [isn't|is not] from Italy.
    It [is|'s] my passport.
    [Is] she your teacher?`)),
  t(P, '1', 2, 'a или an, единственное и множественное', gaps(`
    I'm [an] actor.
    He's [a] bus driver.
    I've got two (key) [keys].
    There are three (sandwich) [sandwiches].
    She has [an] umbrella.
    We need two (bottle) [bottles] of water.`)),

  t(P, '2', 1, 'be: we, you, they', gaps(`
    We [are|'re] in the park.
    [Are] they your friends?
    They [aren't|are not] at home.
    You [are|'re] very kind.
    Where [are] you now?`)),
  t(P, '2', 2, 'Притяжательные местоимения', gaps(`
    This is my brother. [His] name is Ivan.
    This is my sister. [Her] name is Olga.
    We love [our] grandmother.
    They live with [their] parents.
    What's [your] name?`)),

  t(P, '3', 1, "Притяжательный 's", gaps(`
    It's (Anna) [Anna's] bike.
    This is (my father) [my father's] watch.
    Is this (Tom) [Tom's] guitar?
    That's (my friend) [my friend's] car.`, 'type')),
  t(P, '3', 2, 'have: вопросы yes / no', order(`
    Do you have a camera?
    Yes, I do.
    Do they have a car?
    No, they don't.
    I have a tablet and a laptop.`)),

  t(P, '4', 1, 'Present Simple: he, she, it', gaps(`
    She (get) [gets] up at seven.
    He (start) [starts] work at nine.
    My dad (watch) [watches] TV in the evening.
    She (go) [goes] to bed at eleven.
    He (have) [has] lunch at one.`, 'type')),
  t(P, '4', 2, 'Наречия частоты', order(`
    I always have coffee for breakfast.
    She never eats meat.
    We usually have lunch at home.
    He sometimes cooks dinner.`)),

  t(P, '5', 1, 'Местоимения в объектном падеже', gaps(`
    I like Tom. I often help [him].
    Kate is nice. Call [her]!
    These are my keys. Can you take [them]?
    Can you help [me], please?
    We are here. Can you see [us]?`)),
  t(P, '5', 2, 'can и could: просьбы', order(`
    Could you help me, please?
    Can I have a glass of water?
    Can you send me the email?
    Could you say that again?`)),

  t(P, '6', 1, 'there is и there are', gaps(`
    [There's|There is] a sofa in the living room.
    [There are] two bedrooms in my flat.
    [Is there] a bank near here?
    [There aren't|There are not] any shops in my street.
    [Are there] any chairs in the kitchen?`)),
  t(P, '6', 2, 'Предлоги места', gaps(`
    The lamp is [on] the table.
    The cat is [under] the bed.
    The café is [next to] the cinema.
    The bank is [opposite] the station.
    The plant is [between] the sofa and the window.`)),

  t(P, '7', 1, 'was и were', gaps(`
    My grandfather [was] a teacher.
    We [were] at home last night.
    [Was] the film good?
    They [weren't|were not] tired.
    Where [were] you yesterday?`)),
  t(P, '7', 2, 'Повелительное наклонение', order(`
    Drink lots of water.
    Don't go to bed late.
    Go for a walk every day.
    Don't eat too much sugar.`)),

  t(P, '8', 1, 'Past Simple: правильные глаголы', gaps(`
    We (visit) [visited] a castle.
    I (stay) [stayed] in a small hotel.
    They (walk) [walked] to the lake.
    She (travel) [travelled] by train.
    He (relax) [relaxed] on the beach.`, 'type')),
  t(P, '8', 2, 'Past Simple: неправильные глаголы', gaps(`
    I (go) [went] to a party on Saturday.
    She (see) [saw] a great film.
    We (buy) [bought] some clothes.
    They (meet) [met] their friends.
    He (have) [had] a barbecue.`, 'type')),
];
