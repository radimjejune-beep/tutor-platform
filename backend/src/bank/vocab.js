// bank/vocab.js — слова по темам юнитов. Подборки составлены Lessonfold по теме юнита и уровню:
// это не словарь учебника и не его копия. Репетитор может сделать из подборки набор карточек.
// Формат строки: слово - перевод
const S = 'solutions-elem-3';
const P = 'speakout-a1-3';

const VOCAB = {
  [`${S}/I`]: `
    first name - имя
    surname - фамилия
    age - возраст
    date of birth - дата рождения
    address - адрес
    phone number - номер телефона
    email address - адрес электронной почты
    nationality - гражданство, национальность
    hobby - хобби
    guitar - гитара
    piano - фортепиано
    drums - барабаны
    violin - скрипка
    keyboard - синтезатор
    trumpet - труба
    saxophone - саксофон
    flute - флейта
    band - группа (музыкальная)
    singer - певец, певица
    play an instrument - играть на инструменте`,
  [`${S}/1`]: `
    mother - мать
    father - отец
    parents - родители
    brother - брат
    sister - сестра
    grandmother - бабушка
    grandfather - дедушка
    aunt - тётя
    uncle - дядя
    cousin - двоюродный брат, двоюродная сестра
    nephew - племянник
    niece - племянница
    husband - муж
    wife - жена
    twins - близнецы
    only child - единственный ребёнок
    stepfather - отчим
    relatives - родственники
    get on well with - ладить с
    look like - быть похожим на
    curly hair - кудрявые волосы
    friendly - дружелюбный`,
  [`${S}/2`]: `
    wake up - просыпаться
    get up - вставать
    have a shower - принимать душ
    get dressed - одеваться
    have breakfast - завтракать
    brush your teeth - чистить зубы
    leave home - выходить из дома
    catch the bus - успеть на автобус
    start school - начинать занятия
    have lunch - обедать
    finish school - заканчивать занятия
    do homework - делать домашнее задание
    have dinner - ужинать
    go to bed - ложиться спать
    timetable - расписание
    subject - школьный предмет
    break - перемена
    uniform - школьная форма
    always - всегда
    usually - обычно
    sometimes - иногда
    never - никогда`,
  [`${S}/3`]: `
    T-shirt - футболка
    shirt - рубашка
    jumper - джемпер, свитер
    hoodie - толстовка
    jacket - куртка, пиджак
    coat - пальто
    jeans - джинсы
    trousers - брюки
    shorts - шорты
    skirt - юбка
    dress - платье
    trainers - кроссовки
    boots - ботинки, сапоги
    shoes - туфли, обувь
    socks - носки
    cap - кепка
    scarf - шарф
    tracksuit - спортивный костюм
    fashionable - модный
    comfortable - удобный
    try on - примерять
    wear - носить (одежду)`,
  [`${S}/4`]: `
    bread - хлеб
    butter - сливочное масло
    cheese - сыр
    eggs - яйца
    milk - молоко
    yoghurt - йогурт
    rice - рис
    pasta - макароны
    meat - мясо
    chicken - курица
    fish - рыба
    beans - фасоль
    mushrooms - грибы
    onion - лук
    potatoes - картофель
    tomatoes - помидоры
    apple - яблоко
    biscuits - печенье
    juice - сок
    a bottle of - бутылка (чего-то)
    a slice of - ломтик (чего-то)
    menu - меню`,
  [`${S}/5`]: `
    bank - банк
    bus station - автовокзал
    café - кафе
    cinema - кинотеатр
    hospital - больница
    library - библиотека
    museum - музей
    park - парк
    post office - почта
    restaurant - ресторан
    shopping centre - торговый центр
    sports centre - спортивный центр
    square - площадь
    theatre - театр
    bridge - мост
    traffic lights - светофор
    crossroads - перекрёсток
    turn left - повернуть налево
    turn right - повернуть направо
    go straight on - идти прямо
    opposite - напротив
    next to - рядом с`,
  [`${S}/6`]: `
    bear - медведь
    wolf - волк
    fox - лиса
    deer - олень
    eagle - орёл
    snake - змея
    shark - акула
    whale - кит
    dolphin - дельфин
    elephant - слон
    lion - лев
    monkey - обезьяна
    insect - насекомое
    forest - лес
    river - река
    lake - озеро
    mountain - гора
    desert - пустыня
    island - остров
    dangerous - опасный
    wild - дикий
    protect - защищать`,
  [`${S}/7`]: `
    laptop - ноутбук
    tablet - планшет
    smartphone - смартфон
    screen - экран
    keyboard - клавиатура
    charger - зарядное устройство
    headphones - наушники
    password - пароль
    username - имя пользователя
    app - приложение
    website - сайт
    search engine - поисковик
    download - скачивать
    upload - загружать
    post - публиковать
    share - делиться
    send a message - отправить сообщение
    log in - войти (в аккаунт)
    log out - выйти (из аккаунта)
    online - в интернете, онлайн
    battery - аккумулятор
    update - обновлять`,
  [`${S}/8`]: `
    football - футбол
    basketball - баскетбол
    volleyball - волейбол
    tennis - теннис
    swimming - плавание
    cycling - езда на велосипеде
    running - бег
    skiing - катание на лыжах
    skateboarding - катание на скейтборде
    climbing - скалолазание
    gymnastics - гимнастика
    karate - карате
    yoga - йога
    team - команда
    match - матч
    win - выигрывать
    lose - проигрывать
    score a goal - забить гол
    coach - тренер
    fit - в хорошей форме
    healthy - здоровый
    train - тренироваться`,
  [`${S}/9`]: `
    house - дом
    flat - квартира
    bedroom - спальня
    living room - гостиная
    kitchen - кухня
    bathroom - ванная
    hall - прихожая
    garden - сад
    garage - гараж
    stairs - лестница
    bed - кровать
    sofa - диван
    armchair - кресло
    wardrobe - шкаф для одежды
    desk - письменный стол
    shelf - полка
    lamp - лампа
    carpet - ковёр
    curtains - шторы
    fridge - холодильник
    cooker - плита
    cosy - уютный`,

  [`${P}/1`]: `
    hello - привет, здравствуйте
    goodbye - до свидания
    see you later - увидимся
    nice to meet you - приятно познакомиться
    Russia - Россия
    Russian - русский, россиянин
    England - Англия
    English - английский
    France - Франция
    French - французский
    Italy - Италия
    Italian - итальянский
    Spain - Испания
    Spanish - испанский
    China - Китай
    Chinese - китайский
    teacher - учитель
    doctor - врач
    student - студент
    engineer - инженер
    waiter - официант
    taxi driver - таксист`,
  [`${P}/2`]: `
    man - мужчина
    woman - женщина
    child - ребёнок
    children - дети
    boy - мальчик
    girl - девочка
    friend - друг, подруга
    husband - муж
    wife - жена
    son - сын
    daughter - дочь
    brother - брат
    sister - сестра
    parents - родители
    neighbour - сосед
    boss - начальник
    colleague - коллега
    old - старый, пожилой
    young - молодой
    tall - высокий
    happy - счастливый
    married - женат, замужем`,
  [`${P}/3`]: `
    bag - сумка
    wallet - кошелёк
    keys - ключи
    phone - телефон
    umbrella - зонт
    glasses - очки
    watch - наручные часы
    passport - паспорт
    ticket - билет
    book - книга
    pen - ручка
    notebook - блокнот, тетрадь
    camera - фотоаппарат
    headphones - наушники
    laptop - ноутбук
    bottle - бутылка
    cheap - дешёвый
    expensive - дорогой
    new - новый
    old - старый
    price - цена
    How much is it? - Сколько это стоит?`,
  [`${P}/4`]: `
    breakfast - завтрак
    lunch - обед
    dinner - ужин
    coffee - кофе
    tea - чай
    water - вода
    juice - сок
    sandwich - бутерброд
    salad - салат
    soup - суп
    cake - торт, пирожное
    eggs - яйца
    fruit - фрукты
    vegetables - овощи
    get up - вставать
    go to work - идти на работу
    start work - начинать работу
    finish work - заканчивать работу
    go home - идти домой
    watch TV - смотреть телевизор
    half past seven - половина восьмого
    quarter to nine - без четверти девять`,
  [`${P}/5`]: `
    swim - плавать
    run - бегать
    drive - водить машину
    cook - готовить
    dance - танцевать
    sing - петь
    draw - рисовать
    play - играть
    ride a bike - кататься на велосипеде
    speak - говорить
    help - помогать
    open - открывать
    close - закрывать
    January - январь
    February - февраль
    March - март
    April - апрель
    May - май
    June - июнь
    first - первый
    second - второй
    third - третий`,
  [`${P}/6`]: `
    living room - гостиная
    bedroom - спальня
    kitchen - кухня
    bathroom - ванная
    bed - кровать
    table - стол
    chair - стул
    sofa - диван
    cupboard - шкаф (для посуды)
    window - окно
    door - дверь
    bank - банк
    pharmacy - аптека
    supermarket - супермаркет
    station - вокзал, станция
    hotel - гостиница
    car park - парковка
    in - в
    on - на
    under - под
    next to - рядом с
    between - между`,

  [`${P}/7`]: `
    head - голова
    eye - глаз
    ear - ухо
    nose - нос
    mouth - рот
    tooth - зуб
    throat - горло
    neck - шея
    back - спина
    stomach - живот
    arm - рука
    hand - кисть руки
    leg - нога
    foot - ступня
    headache - головная боль
    a cold - простуда
    I feel ill - мне плохо
    rest - отдыхать
    healthy - здоровый
    exercise - заниматься спортом, упражнение
    go to the gym - ходить в спортзал
    strong - сильный`,
  [`${P}/8`]: `
    weekend - выходные
    visit - посещать, навещать
    relax - отдыхать
    go out - выходить, гулять
    stay in - остаться дома
    go to a concert - сходить на концерт
    see a film - посмотреть фильм
    meet friends - встречаться с друзьями
    last night - вчера вечером
    yesterday - вчера
    ago - назад
    train - поезд
    plane - самолёт
    bus - автобус
    underground - метро
    ticket - билет
    single ticket - билет в одну сторону
    return ticket - билет туда и обратно
    platform - платформа
    timetable - расписание
    leave - отправляться, уезжать
    arrive - прибывать`,
};

const parse = (s) => s.trim().split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(' - '); return { term: l.slice(0, i).trim(), translation: l.slice(i + 3).trim() }; });
const vocabOf = (book, unit) => (VOCAB[`${book}/${unit}`] ? parse(VOCAB[`${book}/${unit}`]) : []);

module.exports = { vocabOf };
