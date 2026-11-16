// Авторские материалы Lessonfold по темам Spotlight 6 (загруженное издание).
// Предложения, рассказы и вопросы созданы для платформы; страницы и упражнения PDF не включаются.
// Три блока грамматики + порядок слов + исправление ошибок + чтение + общение +
// письмо + устная речь + диктант + контроль: 11 материалов на каждый модуль.
const BOOK = 'spotlight-6';
const data = [
{
  unit: '1',
  grammar: [
    ['1a · my / your / his / her / our / their', `I have a sister. [My] sister is twelve.
Eva has curly hair. [Her] hair is brown.
Ben is my uncle. [His] wife is a doctor.
We live in a flat. [Our] flat is small.
The twins have a dog. [Their] dog is friendly.
You have a camera. Is this [your] camera?`],
    ['1a · Притяжательный падеж и as … as', `This is [Emma's] bicycle. (Emma)
These are the [boys'] bags. (boys)
The [children's] bedroom is upstairs. (children)
Mia is as tall [as] her cousin.
My hair isn't as long [as] yours.
These are my [parents'] passports. (parents)`],
    ['1b · mine / yours / his / hers / ours / theirs', `This pen belongs to me. It is [mine].
That coat belongs to Eva. It is [hers].
These tickets belong to us. They are [ours].
This umbrella belongs to you. It is [yours].
Those bags belong to the twins. They are [theirs].
That watch belongs to Ben. It is [his].`]
  ],
  order: ['My cousin has got short wavy hair.', 'Whose membership card is this?', 'Her brother is as tall as my dad.', 'These are the children’s books.', 'What is your date of birth?'],
  fix: `This is {me=my} sister.
The blue camera is {her=hers}.
These are the {childrens=children's} toys.
My cousin is as tall {than=as} me.
Their house is bigger than {our=ours}.`,
  reading: `My name is Nora and I live in Bristol with my parents and my younger brother, Dan. I am twelve and Dan is nine. We both have brown eyes, but my hair is straight and his is curly. On Fridays we visit our aunt Rosa. She is a photographer and lets us use her old camera. The new camera is hers, so we always ask before touching it. This month Dan and I want to join the library. Mum says we need our home address and date of birth for the cards.`,
  questions: [
    ['Who is younger?', ['Nora', 'Dan', 'Rosa'], 1],
    ['How is Dan’s hair different from Nora’s?', ['His hair is curly.', 'His hair is straight.', 'His hair is grey.'], 0],
    ['Whose new camera is it?', ['Dan’s', 'Nora’s', 'Rosa’s'], 2],
    ['Why do the children need their personal details?', ['To join the library.', 'To buy a camera.', 'To travel abroad.'], 0]
  ],
  functions: `A: What's your [surname]? B: Green. (фамилия)
A: How do you [spell] that? B: G-R-E-E-N. (произнести по буквам)
A: What's your [address]? B: 24 Oak Road. (адрес)
A: What's your date of [birth]? B: 6 May 2013. (рождения)
A: Nice to [meet] you. B: You too. (познакомиться)`,
  writing: ['Письмо новому другу', 'Write 60–90 words to a new friend. Introduce yourself and two family members. Describe their age and appearance. Say what you like doing together. Use invented names and details.', ['My name is', 'I live with', 'We like'], 'My name is …', 'I live with …', 'My … has got …'],
  voice: ['Describe two people in an invented family: age, hair and height. Use his, her and their.', 'Compare two relatives using as … as and not as … as.', 'Role-play joining a club. Ask for a name, its spelling and a date of birth. Use invented details.'],
  dictation: ['My cousin has got curly hair.', 'The blue camera is hers.', 'We live in the north of the country.'],
  quiz: [
    ['Which country matches “Japanese”?', ['Japan', 'Poland', 'Spain'], 0],
    ['Choose the correct sentence.', ['This bag is my.', 'This bag is mine.', 'This bag is me.'], 1],
    ['Your father’s sister is your …', ['uncle', 'cousin', 'aunt'], 2],
    ['Choose the correct comparison.', ['as tall than', 'as tall as', 'as taller as'], 1],
    ['Two boys share a room. It is the … room.', ["boys'", "boy's", 'boys'], 0],
    ['Which detail tells someone when you were born?', ['Postcode', 'Nationality', 'Date of birth'], 2]
  ]
},
{
  unit: '2',
  grammar: [
    ['2a · Предлоги времени: in / on / at', `The party is [on] Saturday.
My birthday is [in] October.
The film starts [at] half past six.
We have lunch [at] noon.
They go skiing [in] winter.
The meeting is [on] 12 March.`],
    ['2b · a / an / some / any', `There is [an] armchair by the window.
There are [some] cushions on the sofa. (утверждение)
There aren't [any] pictures on the wall.
Is there [a] cooker in the kitchen?
Are there [any] shelves in your room?
There is [some] water in the vase. (утверждение)`],
    ['2b · Неопределённые местоимения', `There is [someone|somebody] at the door. I can hear a person.
There isn't [anything] in this box. It is empty.
Did [anyone|anybody] call me while I was out?
I can see [something] shiny under the sofa, but I can't see what it is.
There isn't [anyone|anybody] in the library. It is closed.
Would you like [something] to drink?`]
  ],
  order: ['My birthday is on the third of April.', 'There is a mirror above the fireplace.', 'Are there any shops near your house?', 'The post office is opposite the library.', 'The party starts at half past five.'],
  fix: `My birthday is {in=on} Monday.
We meet {on=at} six o'clock.
There aren't {some=any} curtains in the bedroom.
There is {a=an} armchair by the door.
There isn't {something=anything} in the cupboard.`,
  reading: `Leo has moved to a new flat on Pine Street. His bedroom is small, but there is a wide window above his desk. A bookcase stands next to the desk, and his favourite poster is on the opposite wall. There isn't a garden, so Leo plays outside in the park behind the library. On Saturday he is having a birthday party at home. It starts at four o'clock. His friends can buy a card at the newsagent's next to the bus stop. Leo hopes everyone can come.`,
  questions: [
    ['Where is the bookcase?', ['Behind the library', 'Next to the desk', 'Under the bed'], 1],
    ['Why does Leo play in the park?', ['His flat has no garden.', 'His room has no window.', 'His school is closed.'], 0],
    ['When does the party start?', ['At three', 'At five', 'At four'], 2],
    ['Where can his friends buy a card?', ['At the newsagent’s', 'At the library', 'In the park'], 0]
  ],
  functions: `A: When is the party? B: [On] Sunday.
A: What [time] does it start? B: At five.
A: What's the date? B: The [first] of June. (первое)
A: Can you come [over] this afternoon? (зайти в гости)
A: The tap is leaking. B: Call a [plumber]. (водопроводчик)`,
  writing: ['Приглашение и описание дома', 'Write 60–90 words inviting an imaginary friend to a party. Give the date and time. Describe your living room and two places near your home. Explain where the friend should meet you.', ['There is', 'on', 'at'], 'Please come to …', 'There is …', 'We can meet …'],
  voice: ['Describe an imaginary room. Use next to, opposite, above and under.', 'Invite a friend to a party. Give a date and time, and answer two questions about the place.', 'Name four shops in a neighbourhood and say what you can buy or do there.'],
  dictation: ['The party is on the first of June.', 'There are some cushions on the sofa.', 'The library is opposite the toy shop.'],
  quiz: [
    ['Where can you borrow books?', ['At a chemist’s', 'At a library', 'At a baker’s'], 1],
    ['A quarter to three means …', ['2:45', '3:15', '3:45'], 0],
    ['We meet … midnight.', ['in', 'on', 'at'], 2],
    ['Which sentence is correct?', ['There are any chairs.', 'There are some chairs.', 'There is some chairs.'], 1],
    ['Which is the ordinal form of twelve?', ['Twelfth', 'Twelveth', 'Twelve'], 0],
    ['Which person repairs electrical equipment?', ['A librarian', 'A plumber', 'An electrician'], 2]
  ]
},
{
  unit: '3',
  grammar: [
    ['3a · Повелительное наклонение', `[Look] both ways before you cross. (look)
[Don't|Do not] run across the road. (отрицание)
[Wear] a helmet when you cycle. (wear)
[Don't|Do not] lean out of the window. (отрицание)
[Wait] for the green light. (wait)
[Hold] the handgrip on the bus. (hold)`],
    ["3b · can / can't / should / shouldn't", `A trained pilot [can] fly a plane. (может)
A baby [can't|cannot] drive a car. (не может)
You [should] wear a seat belt. (следует)
You [shouldn't|should not] text while crossing the road. (не следует)
[Can] you ride a bicycle? (можешь ли)
You [should] check your brakes before a long ride. (следует)`],
    ['3c · who / which / whose', `A pedestrian is a person [who|that] walks along a street.
This is the sign [which|that] warns drivers about children.
I know the boy [whose] bike is outside.
A helmet is something [which|that] protects your head.
She is the driver [who|that] helped us.
That is the girl [whose] father drives a bus.`]
  ],
  order: ['Always wear a seat belt in the car.', 'Do not play near a busy road.', 'Can you tell me the way to the station?', 'Turn left at the traffic lights.', 'This is the driver who helped us.'],
  fix: `{To look=Look} both ways before you cross.
Don't {to run=run} into the road.
You should {wearing=wear} a helmet.
Can she {drives=drive} a car?
That is the boy {who=whose} bike is blue.`,
  reading: `Every Wednesday, Elif cycles to the sports centre with her dad. Before they leave, they check their brakes and put on their helmets. The shortest route goes along Market Road, but there is no bike lane there. They choose the longer route through the park instead. At the park gate they get off their bikes and use the zebra crossing. Last week a driver stopped to let them cross. Elif thanked him. Dad says being careful matters more than arriving two minutes earlier.`,
  questions: [
    ['Where does Elif go on Wednesdays?', ['To the library', 'To the sports centre', 'To the market'], 1],
    ['Why do they avoid Market Road?', ['There is no bike lane.', 'There are no shops.', 'It is the longest route.'], 0],
    ['How do they cross at the park gate?', ['They cycle between cars.', 'They use an underground tunnel.', 'They walk across the zebra crossing.'], 2],
    ['What does Dad think is most important?', ['Arriving first', 'Being careful', 'Taking the shortest route'], 1]
  ],
  functions: `A: Excuse me, how can I [get] to the station?
B: Go straight [on].
B: Turn [left] at the bank. (налево)
A: Is it [far] from here? (далеко)
B: No, it's a five-minute [walk]. (пешая прогулка)`,
  writing: ['Памятка о безопасности', 'Write 60–90 words for a school road-safety notice. Include rules for pedestrians, cyclists and passengers. Use at least two positive commands, two negative commands and one sentence with should.', ['Don\'t', 'should', 'Wear'], 'Look …', 'Don’t …', 'You should …'],
  voice: ['Give a younger pupil five road-safety tips. Use commands and should.', 'Role-play asking for directions from the school to a sports centre.', 'Describe three people or objects using who, which and whose.'],
  dictation: ['Look both ways before you cross.', 'You should wear a bicycle helmet.', 'Turn right at the traffic lights.'],
  quiz: [
    ['What protects your head when cycling?', ['A helmet', 'A seat belt', 'A tyre'], 0],
    ['Choose the correct command.', ['Don’t to run.', 'Don’t run.', 'Not running.'], 1],
    ['A bike lane is for …', ['trains', 'planes', 'bicycles'], 2],
    ['You should … the handgrip on a moving bus.', ['holding', 'hold', 'to hold'], 1],
    ['A person … walks in the street is a pedestrian.', ['who', 'whose', 'which'], 0],
    ['“On foot” means …', ['by bus', 'by bike', 'walking'], 2]
  ]
},
{
  unit: '4',
  grammar: [
    ['4a · Present Simple: глагол в нужной форме', `Maya [gets] up at seven every day. (get)
Her brothers [walk] to school. (walk)
Dad [watches] the news after dinner. (watch)
We [don't|do not] play computer games on school nights. (отрицание)
[Does] your sister like dancing?
How often [do] you visit your grandparents?`],
    ['4a–4b · Наречия частоты и like doing', `I [always] brush my teeth before bed. (всегда)
She [never] misses breakfast. (никогда)
We [usually] eat at home. (обычно)
He likes [playing] chess. (play)
They hate [waiting] for the bus. (wait)
Do you enjoy [reading] adventure stories? (read)`],
    ['4c · Возвратные местоимения и связки', `I made this cake [myself].
She taught [herself] to play the guitar.
We enjoyed [ourselves] at the scout camp.
The boys washed the dishes [themselves].
He stays at home [because] he has a cold. (потому что)
First we eat, [then] we go for a walk. (затем)`]
  ],
  order: ['She usually gets dressed before breakfast.', 'Does your brother enjoy watching comedies?', 'We never go to bed after midnight.', 'I like listening to music in the evening.', 'They made the decorations themselves.'],
  fix: `He {go=goes} to school by bus.
Does she {likes=like} sitcoms?
We {doesn't=don't|do not} watch TV in the morning.
I enjoy {swim=swimming}.
They cooked dinner {ourselves=themselves}.`,
  reading: `Sam is a member of a nature club. On school days he gets up at seven and walks to school with his sister. He rarely watches television before dinner because he does his homework first. On Saturdays the club meets in a small park. The children learn to tie knots and put up tents. Sam likes these activities, but he doesn't enjoy cooking outdoors. His friend Ines loves it and usually makes lunch for the group. After lunch they clean the place themselves and walk home.`,
  questions: [
    ['How does Sam get to school?', ['By bus', 'By car', 'On foot'], 2],
    ['Why does he rarely watch TV before dinner?', ['He does homework first.', 'His TV is broken.', 'He has no television.'], 0],
    ['What does Sam not enjoy?', ['Tying knots', 'Cooking outdoors', 'Walking home'], 1],
    ['Who cleans the meeting place?', ['The children themselves', 'Their parents', 'A park worker'], 0]
  ],
  functions: `A: How [often] do you go camping? B: Twice a month.
A: What [about] watching a comedy? (как насчёт)
B: That sounds [great]. (здорово)
A: I'm sorry, I can't [make] it tonight. (не смогу прийти)
B: I hope you feel [better] soon. (лучше)`,
  writing: ['Мой обычный день', 'Write 60–90 words about an invented pupil’s weekday and weekend. Use Present Simple, three frequency expressions and a sentence about what the pupil likes doing.', ['usually', 'often', 'likes'], 'On weekdays …', 'At the weekend …', 'My friend likes …'],
  voice: ['Describe a typical weekday. Use always, usually, sometimes and never.', 'Ask a partner five questions about their routine and give short answers.', 'Choose a TV programme together. Make a suggestion, explain your preference and agree on a time.'],
  dictation: ['She usually has breakfast at seven.', 'Do you enjoy listening to music?', 'We put up the tent ourselves.'],
  quiz: [
    ['Choose the correct sentence.', ['She never is late.', 'She is never late.', 'She is late never.'], 1],
    ['He … his teeth twice a day.', ['brushes', 'brush', 'brushing'], 0],
    ['Does Eva like comedies? — Yes, she …', ['is', 'do', 'does'], 2],
    ['I enjoy …', ['to camp', 'camping', 'camp'], 1],
    ['“Twice a week” means …', ['two times each week', 'every two weeks', 'once every week'], 0],
    ['We did the project …', ['myself', 'themselves', 'ourselves'], 2]
  ]
},
{
  unit: '5',
  grammar: [
    ['5a · Present Continuous: утверждения', `I [am making|'m making] a cake now. (make)
Mum [is baking|'s baking] biscuits at the moment. (bake)
The children [are dancing|'re dancing] in the garden now. (dance)
We [are putting|'re putting] up decorations now. (put)
Ben [is playing|'s playing] the drums now. (play)
You [are wearing|'re wearing] a colourful costume today. (wear)`],
    ['5b · Present Continuous: вопросы и отрицания', `She [isn't|is not] sleeping; she is wrapping gifts.
[Are] they watching the parade?
What [is] your brother doing?
We [aren't|are not] cooking; we are doing the shopping.
[Is] Dad taking photos?
I [am not|'m not] wearing my coat today.`],
    ['5a · do / make в подготовке к празднику', `I am [doing] the dusting. (do / make)
She is [making] a cake. (do / make)
We are [doing] the washing-up. (do / make)
He is [making] a phone call. (do / make)
They are [doing] the shopping. (do / make)
Mum is [making] tea. (do / make)`]
  ],
  order: ['We are making decorations for the party.', 'Is your sister wearing a costume?', 'The children are not watching television.', 'What are you doing at the moment?', 'Dad is taking pictures of the parade.'],
  fix: `She {are=is} making tea.
They are {dance=dancing} in the garden.
{Do=Are} you watching the parade now?
I am {make=making} a cake.
He isn't {wear=wearing} a costume.`,
  reading: `It is the afternoon before the school spring festival. In the hall, two teachers are hanging paper flowers above the stage. Eva and Omar are practising a short song. Outside, some parents are putting tables under the trees. They aren't serving food yet because the guests arrive at five. Eva's little brother wants to help, so he is carrying paper cups to the tables. The weather is warm, but dark clouds are appearing. The organisers have another plan: if it rains, everyone can eat in the hall.`,
  questions: [
    ['What are the teachers hanging?', ['Paper flowers', 'Balloons', 'Photographs'], 0],
    ['Why are the parents not serving food yet?', ['There are no cups.', 'The guests arrive at five.', 'It is raining.'], 1],
    ['Who is carrying the cups?', ['Omar’s father', 'A teacher', 'Eva’s brother'], 2],
    ['Where can people eat if it rains?', ['In the hall', 'In a café', 'At the park gate'], 0]
  ],
  functions: `A: What are you [doing]? B: Making decorations.
A: Can I [help]? B: Yes, please. (помочь)
A: I'd like a [dozen] roses, please. (дюжина)
B: What [colour] would you like? A: Yellow. (цвет)
A: Best [wishes] for the New Year! (пожелания)`,
  writing: ['Репортаж с праздника', 'Write 60–90 words about an imaginary festival happening now. Describe what four people or groups are doing, what they are wearing and what you are doing. Use Present Continuous.', ['is', 'are', 'wearing'], 'It is …', 'People are …', 'I am …'],
  voice: ['Imagine a festival photo. Describe five actions using Present Continuous.', 'Ask a partner what three family members are doing now and answer their questions.', 'Role-play ordering flowers for a celebration: choose the type, number and colour.'],
  dictation: ['We are making a birthday cake.', 'Is your brother taking pictures?', 'The guests are watching the parade.'],
  quiz: [
    ['Choose the correct form.', ['She is dance.', 'She dancing.', 'She is dancing.'], 2],
    ['Which phrase is correct?', ['Make the washing-up', 'Do the washing-up', 'Do a cake'], 1],
    ['A dozen flowers means … flowers.', ['twelve', 'ten', 'twenty'], 0],
    ['Are they cooking? — No, they …', ['don’t', 'isn’t', 'aren’t'], 2],
    ['What … Eva doing?', ['are', 'is', 'does'], 1],
    ['Choose the correct spelling.', ['Making', 'Makeing', 'Makking'], 0]
  ]
},
{
  unit: '6',
  grammar: [
    ['6a–6b · Present Simple или Continuous', `Ben usually [plays] chess on Fridays. (play)
Look! He [is playing|'s playing] basketball today. (play)
I [don't|do not] collect stamps. (отрицание, обычно)
We [are watching|'re watching] a puppet show now. (watch)
[Does] Eva like board games?
Why [are] the children laughing now?`],
    ['6b · Past Continuous: действие в определённый момент', `At six yesterday I [was reading] a book. (read)
At that time the boys [were playing] chess. (play)
What [were] you doing at five yesterday?
She [wasn't|was not] sleeping at nine; she was painting.
[Was] Dad watching the match at eight?
We [were making] puppets at this time yesterday. (make)`],
    ['6a · Названия людей: -er / -or / -ist', `A person who paints is a [painter]. (paint)
A person who writes books is a [writer]. (write)
A person who acts in films is an [actor]. (act)
A person who studies science is a [scientist]. (science)
A person who plays a game is a [player]. (play)
A person who collects things is a [collector]. (collect)`]
  ],
  order: ['I am interested in learning new games.', 'Do you prefer chess or table tennis?', 'We were watching a puppet show at six.', 'She usually plays tennis on Sundays.', 'Roll the dice and move your counter.'],
  fix: `He usually {play=plays} chess after school.
Look! They {play=are playing} football.
At eight yesterday I {am=was} reading.
We {was=were} making puppets at five.
A person who writes books is a {write=writer}.`,
  reading: `The school games club meets every Thursday. Usually the older pupils teach a game to the younger ones. This week they are making their own board game about an island. Each player has a coloured counter and throws a dice to move. Some squares tell you to go back or miss a turn. Yesterday at four, Lila was drawing the island while Max was writing the rules. They haven't finished the cards yet, so they plan to test the game next Thursday. Everyone can suggest one new rule before then.`,
  questions: [
    ['When does the club meet?', ['Every Monday', 'Every Thursday', 'Every Saturday'], 1],
    ['What is their new game about?', ['An island', 'A city', 'A school'], 0],
    ['What was Max doing yesterday at four?', ['Testing the game', 'Drawing the island', 'Writing the rules'], 2],
    ['Why will they test it next Thursday?', ['The cards are not finished.', 'Nobody likes the game.', 'They have lost the dice.'], 0]
  ],
  functions: `A: What [about] a game of chess?
B: I'd [prefer] table tennis. (предпочёл бы)
A: Let's try something different for a [change]. (для разнообразия)
B: It's your [turn]. Roll the dice. (ход)
A: I don't [agree] with that rule. (согласен)`,
  writing: ['Клуб увлечений', 'Write 60–90 words advertising an imaginary school club. Say when it meets, what members usually do and what they are doing this week. Include one reason to join.', ['usually', 'are', 'because'], 'Our club meets …', 'We usually …', 'This week we are …'],
  voice: ['Describe your favourite hobby and say how often you do it. Explain what you need for it.', 'Explain a simple board game: counters, dice, turns and how to win.', 'Say what three people were doing at six yesterday. Use invented examples.'],
  dictation: ['We usually play chess after school.', 'She was painting at six yesterday.', 'Roll the dice and move your counter.'],
  quiz: [
    ['Which is a board game?', ['Gardening', 'Swimming', 'Chess'], 2],
    ['At five yesterday, we … a film.', ['were watching', 'are watching', 'watch'], 0],
    ['Look! The children …', ['dance', 'are dancing', 'dances'], 1],
    ['A person who collects coins is a …', ['collection', 'collect', 'collector'], 2],
    ['“Miss a turn” means …', ['not play when it is your turn', 'win the game', 'throw the dice again'], 0],
    ['Which form describes a routine?', ['He is playing now.', 'He plays every day.', 'He was playing at six.'], 1]
  ]
},
{
  unit: '7',
  grammar: [
    ['7a · Past Simple: be и правильные глаголы', `The town [was] quiet a hundred years ago.
There [were] two shops near the mine.
We [visited] the old railway station yesterday. (visit)
They [moved] to a new town in 2018. (move)
I [didn't|did not] watch the film last night.
[Did] you enjoy the trip?`],
    ['7b–7c · Past Simple: неправильные глаголы', `Mia [went] to the museum yesterday. (go)
We [saw] an old photograph. (see)
The artist [made] his first cartoon in 1935. (make)
She [bought] a book about local history. (buy)
Ben [found] a wallet near the station. (find)
They [had] lunch at noon yesterday. (have)`],
    ['7b · Past Simple / Continuous и -ed / -ing', `I [was reading] when the phone rang. (read)
While we were walking, we [heard] a strange noise. (hear)
At nine yesterday she [was sleeping]. (sleep)
The story was [frightening]; it made me feel afraid. (frightened / frightening)
I felt [bored] because nothing happened. (bored / boring)
He was [excited] about the trip. (excited / exciting)`]
  ],
  order: ['There were two shops in the old town.', 'Did you visit the museum yesterday?', 'She did not see the strange creature.', 'I was reading when the lights went out.', 'The writer was born in a small village.'],
  fix: `They {was=were} in the park yesterday.
Did you {went=go} to the museum?
She didn't {saw=see} the old house.
I {were=was} reading when he called.
The long film made me feel {boring=bored}.`,
  reading: `Last autumn, Arman visited his grandfather's old village. When his grandfather was a child, there were three small shops and a railway station. Now there is only one shop, and the station is a café. Arman took a photograph of the building. While he was looking at an old sign, a woman came outside and showed him some pictures from 1960. In one picture, a young boy was standing beside a bicycle. Arman recognised his grandfather. He bought a copy and gave it to him that evening.`,
  questions: [
    ['What is the old station now?', ['A school', 'A café', 'A library'], 1],
    ['How many shops were there when Grandfather was a child?', ['One', 'Two', 'Three'], 2],
    ['What was Arman looking at when the woman came out?', ['An old sign', 'A bicycle', 'A new phone'], 0],
    ['Why did he buy a copy of the photograph?', ['It showed his grandfather.', 'It showed his school.', 'It was a picture of himself.'], 0]
  ],
  functions: `A: I'd like to report some [lost] property. (потерянные)
B: What did you [lose]? A: A wallet. (потеряли)
B: Can you [describe] it? (описать)
A: It's brown and made of [leather]. (кожа)
B: When did you last [see] it? A: Yesterday. (видели)`,
  writing: ['История о находке', 'Write 70–100 words about finding something unusual. Say where and when it happened, what you were doing, what happened next and how you felt. Use Past Simple and at least one Past Continuous sentence.', ['was', 'when', 'found'], 'Last …', 'I was … when …', 'In the end …'],
  voice: ['Compare an imaginary town now and a hundred years ago. Use was, were and there is / are.', 'Tell a short story with a beginning, a surprising event and an ending. Say how people felt.', 'Role-play reporting a lost bag. Describe it and say when and where you last saw it.'],
  dictation: ['We visited the old town yesterday.', 'I was walking when I heard a noise.', 'She found a wallet near the station.'],
  quiz: [
    ['Choose the correct past form of “buy”.', ['Buyed', 'Bought', 'Buy'], 1],
    ['Did he … the museum?', ['visit', 'visited', 'visits'], 0],
    ['A story makes you afraid. It is …', ['frightened', 'bored', 'frightening'], 2],
    ['At eight yesterday I … dinner.', ['have', 'was having', 'am having'], 1],
    ['There … two bridges in 1900.', ['were', 'was', 'is'], 0],
    ['A ghost town is usually …', ['crowded', 'busy', 'deserted'], 2]
  ]
},
{
  unit: '8',
  grammar: [
    ["8a · must / mustn't / can", `You [must] be quiet in the library. (обязан)
You [mustn't|must not] touch the paintings. (запрещено)
You [can] take photos here; it is allowed. (можно)
Visitors [must] show their tickets. (обязаны)
You [mustn't|must not] feed the animals. (запрещено)
[Can] we use this entrance? (можно ли)`],
    ["8c · have to / don't have to / needn't", `Mia [has to] wear a uniform at her school. (обязана)
We [don't have to|do not have to|needn't|need not] bring food; lunch is included. (не обязательно)
[Does] Ben have to clean his room today?
You [needn't|need not|don't have to|do not have to] book; there are plenty of seats. (нет необходимости)
I [have to] get up early on Mondays. (вынужден)
She [doesn't have to|does not have to|needn't|need not] work on Sundays. (не обязана)`],
    ['8b · Сравнение прилагательных и наречий', `This museum is [cheaper] than the gallery. (cheap)
That is the [most interesting] exhibition in town. (interesting)
Eva runs [faster] than me. (fast)
This seat is [more comfortable] than that one. (comfortable)
Ben speaks [more slowly] than his brother. (slowly)
This is the [best] café in our street. (good)`]
  ],
  order: ['You must not make noise in the library.', 'Do we have to wear a uniform?', 'You do not have to book in advance.', 'This theatre is bigger than that cinema.', 'She speaks more quietly than her brother.'],
  fix: `She {have=has} to tidy her room.
You mustn't {to touch=touch} the paintings.
This park is {more big=bigger} than ours.
That is the {goodest=best} seat.
He runs {more fast=faster} than me.`,
  reading: `Kira and her classmates are staying at a summer school. They have to be in their rooms by nine, but they don't have to turn the lights off until ten. They mustn't cook in the bedrooms. A shared kitchen is open from seven in the morning to eight in the evening. On Saturday they can choose an activity. The swimming pool is cheaper than the cinema, but Kira prefers the museum because it has a new robot exhibition. She books a ticket online. Her teacher reminds her to take the student card for a discount.`,
  questions: [
    ['When must pupils be in their rooms?', ['At eight', 'At nine', 'At ten'], 1],
    ['Where is cooking forbidden?', ['In the shared kitchen', 'In the dining hall', 'In the bedrooms'], 2],
    ['Which is cheaper than the cinema?', ['The pool', 'The museum', 'The exhibition'], 0],
    ['Why should Kira take her student card?', ['To get a discount', 'To use the kitchen', 'To turn off the lights'], 0]
  ],
  functions: `A: I'd like to [book] two theatre tickets. (забронировать)
B: Which [performance] would you like? (спектакль)
A: Are there any seats [available]? (в наличии)
B: Yes, in the fifth [row]. (ряд)
A: How much are they? B: Twelve pounds [each]. (каждый)`,
  writing: ['Правила лагеря', 'Write 60–90 words explaining the rules of an imaginary campsite. Include two obligations, two prohibitions and one thing visitors do not have to do. Explain one reason for a rule.', ['must', 'mustn\'t', 'because'], 'Visitors must …', 'You mustn’t …', 'You don’t have to …'],
  voice: ['Explain five rules in a museum. Distinguish an obligation from a prohibition.', 'Compare three places to visit using cheaper, more interesting and the best.', 'Role-play booking theatre tickets. Ask about the performance, seats and price.'],
  dictation: ['You must keep your room tidy.', 'We do not have to bring lunch.', 'This museum is cheaper than the cinema.'],
  quiz: [
    ['“You mustn’t run” means running is …', ['optional', 'necessary', 'forbidden'], 2],
    ['“You don’t have to book” means booking is …', ['not necessary', 'forbidden', 'impossible'], 0],
    ['Choose the correct form.', ['More cheap', 'Cheaper', 'Cheapest than'], 1],
    ['Which is correct?', ['He musts go.', 'He must to go.', 'He must go.'], 2],
    ['The superlative of “good” is …', ['best', 'better', 'goodest'], 0],
    ['She … to wear a uniform.', ['have', 'has', 'must'], 1]
  ]
},
{
  unit: '9',
  grammar: [
    ['9a · much / many / some / any', `How [many] eggs do we need?
How [much] rice is in the bag?
There isn't [any] butter in the fridge.
There are [some] apples in the bowl. (утверждение)
We haven't got [many] potatoes. (much / many)
There isn't [much] milk left. (much / many)`],
    ['9a · a little / a few и упаковки', `There is [a little] cheese left. (a little / a few)
We need [a few] tomatoes. (a little / a few)
Buy a [loaf] of bread. (буханка)
I'd like a [carton] of milk. (картонный пакет)
She ate a [slice] of cake. (кусочек-ломтик)
We opened a [jar] of jam. (банка)`],
    ['9b · Present Perfect', `I [have tried|'ve tried] this soup before. (try)
She [has cooked|'s cooked] dinner already. (cook)
We [haven't|have not] ordered dessert yet.
[Have] you ever eaten sushi?
Ben [has never tasted] mango. (never / taste)
They [have bought|'ve bought] all the ingredients. (buy)`]
  ],
  order: ['How many tomatoes do we need?', 'There is a little milk in the fridge.', 'Have you ever tried this dish?', 'I would like a table for two.', 'Peel the potatoes and chop the onions.'],
  fix: `How {much=many} apples do you need?
There is {a few=a little} rice in the bowl.
We haven't got {some=any} cheese.
She {have=has} made a cake.
Have you ever {ate=eaten} sushi?`,
  reading: `Jules and his brother are cooking lunch for their aunt. They have made vegetable soup before, but today they want to try a new recipe. They need carrots, potatoes, one onion and a little cheese. There are some potatoes at home, so Jules only buys carrots and an onion. First they peel and chop the vegetables. Then they cook them in water for twenty minutes. They add cheese at the end. Their aunt doesn't eat meat, so they serve the soup with bread and a tomato salad. She asks for the recipe.`,
  questions: [
    ['What is new for the brothers?', ['Making any soup', 'Using this recipe', 'Buying bread'], 1],
    ['Why does Jules not buy potatoes?', ['There are some at home.', 'His aunt dislikes them.', 'The recipe has no potatoes.'], 0],
    ['When do they add the cheese?', ['Before peeling', 'At the beginning', 'At the end'], 2],
    ['Why do they serve a meal without meat?', ['Their aunt does not eat meat.', 'They have no bread.', 'They forgot the salad.'], 0]
  ],
  functions: `A: Can I see the [menu], please? (меню)
B: Are you ready to [order]? (заказать)
A: I'd [like] the vegetable soup, please.
B: Still or [sparkling] water? (газированная)
A: Could we have the [bill], please? (счёт)`,
  writing: ['Рецепт любимого блюда', 'Write 60–90 words describing a simple recipe. List ingredients with quantities. Give four cooking steps in order. Say how to serve the dish. Choose a recipe that does not require unsafe cooking by a child alone.', ['First', 'Then', 'Serve'], 'You need …', 'First …', 'Serve with …'],
  voice: ['Make a shopping list for a picnic. Use a little, a few, some, much and many.', 'Role-play a café order: ask about a dish, choose a drink and ask for the bill.', 'Ask a partner about three foods they have tried. Use Have you ever …? and short answers.'],
  dictation: ['How much cheese do we need?', 'I have never tried this dish.', 'First peel and chop the vegetables.'],
  quiz: [
    ['Which noun is usually uncountable?', ['Apple', 'Egg', 'Rice'], 2],
    ['Choose the correct question.', ['How many carrots?', 'How much carrots?', 'How a few carrots?'], 0],
    ['We need … milk.', ['a few', 'a little', 'many'], 1],
    ['She has … dinner.', ['cook', 'cooking', 'cooked'], 2],
    ['What does “peel” mean in a recipe?', ['Remove the skin', 'Add water', 'Cut into slices'], 0],
    ['Which sentence is correct?', ['I have ate sushi.', 'I have eaten sushi.', 'I has eaten sushi.'], 1]
  ]
},
{
  unit: '10',
  grammar: [
    ['10a · be going to: планы и прогноз по признакам', `I [am going to|'m going to] visit a museum tomorrow. (план)
She [is going to|'s going to] stay at a hotel. (план)
We [aren't going to|are not going to] travel by train. (отрицание, план)
[Are] you going to pack tonight?
Look at those dark clouds! It [is going to|'s going to] rain.
What [is] Ben going to do on holiday?`],
    ['10b · will и Present Continuous: выбор формы', `The phone is ringing. I [will answer|'ll answer] it. (answer, решение сейчас)
I think our team [will win|'ll win] tomorrow. (win, мнение)
We [are meeting|'re meeting] our guide at ten; it is arranged. (meet)
She [is flying|'s flying] to Rome tomorrow; she has her ticket. (fly)
I promise I [will help|'ll help] you pack. (help)
They [are staying|'re staying] at the Lake Hotel on Friday; it is booked. (stay)`],
    ['10b–10c · Погода, because / so', `Take an umbrella because it is [rainy]. (rain)
We are going to the beach because it is [sunny]. (sun)
It is [windy], so hold your hat. (wind)
We are staying inside [because] it is snowing. (потому что)
It is cold, [so] I am putting on a coat. (поэтому)
The sky is [cloudy] this morning. (cloud)`]
  ],
  order: ['We are going to visit the old castle.', 'Are you flying to London tomorrow?', 'I will help you carry your suitcase.', 'It is raining so we are staying indoors.', 'I would like to book a double room.'],
  fix: `She {are=is} going to visit Spain.
We are going to {travelling=travel} by train.
I will {to help=help} you pack.
It is {wind=windy} today.
We are staying home {so=because} it is raining.`,
  reading: `Talia and her family are spending a weekend by a lake. They have booked two nights at a small hotel. On Saturday morning they are meeting a guide at nine for a walk through the forest. The weather forecast says it will be cool, so Talia is packing a warm jacket. If the rain is heavy, the guide will take them to a local museum instead. Talia's brother wants to go sailing on Sunday. They haven't booked a boat yet because they want to check the wind forecast first.`,
  questions: [
    ['How long have they booked the hotel for?', ['One night', 'Two nights', 'A week'], 1],
    ['What is arranged for Saturday morning?', ['A guided forest walk', 'A sailing lesson', 'A train journey'], 0],
    ['Why is Talia packing a jacket?', ['The hotel has no heating.', 'She wants to swim.', 'The forecast says it will be cool.'], 2],
    ['Why have they not booked a boat?', ['They want to check the wind first.', 'They dislike sailing.', 'The lake is closed.'], 0]
  ],
  functions: `A: I'd like to [book] a room. (забронировать)
B: A single or a [double] room? (двухместный с одной кроватью)
A: Is breakfast [included]? (включён)
B: It's fifty pounds per [night]. (ночь)
A: Does the room have a sea [view]? (вид)`,
  writing: ['Планы на каникулы', 'Write 70–100 words to a friend about an imaginary holiday. Describe a plan with going to, one booked arrangement with Present Continuous and an offer or prediction with will. Mention weather and what you will pack.', ['going to', 'will', 'because'], 'I am going to …', 'We are meeting …', 'I think … will …'],
  voice: ['Describe your plans for an imaginary holiday: destination, travel, activities and weather.', 'Respond to three situations with an offer using will: a heavy bag, a ringing phone and a friend who needs a map.', 'Role-play booking a hotel room. Ask about room type, breakfast, dates and price.'],
  dictation: ['We are going to visit the museum.', 'I will help you pack your suitcase.', 'The room has a beautiful sea view.'],
  quiz: [
    ['Look at the clouds! It … rain.', ['is going to', 'goes to', 'going'], 0],
    ['“I’ll carry that bag” is an …', ['old habit', 'offer', 'action yesterday'], 1],
    ['Choose the weather adjective.', ['Cloud', 'Wind', 'Cloudy'], 2],
    ['We have tickets. We … tomorrow.', ['are flying', 'flew', 'flyed'], 0],
    ['It is raining, … take an umbrella.', ['because', 'so', 'but because'], 1],
    ['“Per night” means …', ['all weekend', 'each morning', 'for each night'], 2]
  ]
}
];

const constructionForms = { "Don't": "Don't|Don’t|Do not", "mustn't": "mustn't|mustn’t|must not" };
const out = [];
for (const m of data) {
  const add = (key, title, game) => out.push({ key: `spt6-${m.unit}-${key}`, book: BOOK, unit: m.unit, title, game });
  for (const [i, [title, text]] of m.grammar.entries()) {
    add(`grammar-${i + 1}`, title, { type: 'gaps', mode: 'type', distractors: [], text });
  }
  add('order', 'Собери предложения по теме модуля', { type: 'order', sentences: m.order });
  add('fix', 'Найди и исправь пять ошибок', { type: 'sheet', blocks: [
    { t: 'text', text: 'Исправь выделенные ошибки. Не меняй слова, в которых ошибки нет.' },
    { t: 'fix', text: m.fix }
  ] });
  const choices = (qs) => qs.map(([q, options, correct]) => ({ t: 'choice', q, options, correct }));
  add('reading', 'Чтение: новая история и четыре вопроса', { type: 'sheet', blocks: [
    { t: 'text', text: 'Read the story. Choose one correct answer for each question.' },
    { t: 'text', text: m.reading }, ...choices(m.questions)
  ] });
  add('functions', 'Общение: дополни реплики диалога', { type: 'gaps', mode: 'type', distractors: [], text: m.functions });
  const [title, prompt, checks, ...starters] = m.writing;
  add('writing', title, { type: 'sheet', blocks: [
    { t: 'text', text: 'Чек-лист проверит объём и отдельные условия. Содержание, грамматику и связность оценивает преподаватель.' },
    { t: 'write', q: prompt, min_words: ['7', '10'].includes(m.unit) ? 70 : 60,
      max_words: ['7', '10'].includes(m.unit) ? 100 : 90, min_sentences: 5,
      caps: true, stop: true, latin: true,
      checks: checks.map(words => ({ label: `Использована конструкция: ${words}`, words: constructionForms[words] || words, min: 1 })), starters, model: '' }
  ] });
  add('speaking', 'Говорение: три ситуации', { type: 'sheet', blocks: [
    { t: 'text', text: 'Ответь голосом или разыграй ситуации с преподавателем. Для каждой ситуации говори 30–60 секунд. Устные ответы оценивает преподаватель.' },
    ...m.voice.map(q => ({ t: 'voice', q }))
  ] });
  add('dictation', 'Диктант: послушай и запиши три фразы', { type: 'sheet', blocks: [
    { t: 'text', text: 'Послушай каждую фразу и запиши её. Озвучка использует английский голос браузера, а не аудиозапись учебника.' },
    ...m.dictation.map(text => ({ t: 'dictation', text }))
  ] });
  add('check', 'Проверка модуля: шесть вопросов', { type: 'sheet', blocks: [
    { t: 'text', text: 'Choose one correct answer for each question.' }, ...choices(m.quiz)
  ] });
}
module.exports = out;
