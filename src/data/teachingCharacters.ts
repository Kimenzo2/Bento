import { Character } from '../../types';

// Helper to create full character objects from compact config
const createTeacher = (
    id: string,
    name: string,
    role: string,
    description: string,
    voiceTone: string,
    catchphrase: string,
    teachingApproach: 'nurturing' | 'challenging' | 'playful' | 'socratic' | 'storytelling',
    subjects: string[],
    seed?: string
): Character => {
    return {
        id: `teacher-${id}`,
        name,
        role,
        description,
        visualTraits: description,
        visualPrompt: `A friendly, high-quality illustration of ${name}, ${description}`,
        traits: [teachingApproach, ...subjects],
        imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || name}`,
        psychologicalProfile: {
            openness: 0.8,
            conscientiousness: 0.7,
            extraversion: 0.8,
            agreeableness: 0.9,
            neuroticism: 0.2
        },
        voiceProfile: {
            tone: voiceTone,
            vocabulary: 'simple',
            catchphrases: [catchphrase],
            nonverbalTics: ['smiles', 'nods encouragingly'],
            laughStyle: 'cheerful'
        },
        teachingStyle: {
            subjectsExpertise: subjects,
            teachingApproach,
            encouragementStyle: `Great job! ${catchphrase}`,
            correctionStyle: "Let's try that again together.",
            exampleStyle: "stories and adventures"
        }
    };
};

export const TEACHING_CHARACTERS: Character[] = [
    // --- CLASSIC CARTOONS (Inspired) ---
    createTeacher('mouse-max', 'Maxie Mouse', 'Optimistic Leader', 'A cheerful mouse who loves adventures', 'high-pitched and enthusiastic', 'Hot dog!', 'nurturing', ['Friendship', 'Leadership'], 'Mickey'),
    createTeacher('cat-tom', 'Thomas Cat', 'Determined Chaser', 'A persistent tuxedo cat trying to catch a break', 'expressive and grumpy', 'Don\'t you believe it!', 'challenging', ['Persistence', 'Strategy'], 'Tom'),
    createTeacher('mouse-jerry', 'Jerry Mouse', 'Clever Solver', 'A tiny, witty mouse who outsmarts everyone', 'squeaky and smart', 'Gotcha!', 'playful', ['Problem Solving', 'Creativity'], 'Jerry'),
    createTeacher('dog-scoops', 'Scoops the Dog', 'Mystery Solver', 'A cowardly but lovable Great Dane', 'goofy and scared', 'Ruh-roh!', 'storytelling', ['Mystery', 'Bravery'], 'Scooby'),
    createTeacher('dog-beagle', 'Beagle Scout', 'Dreamer Dog', 'An imaginative beagle who flies his doghouse', 'silent but expressive', '*happy dance*', 'playful', ['Imagination', 'Writing'], 'Snoopy'),
    createTeacher('duck-danny', 'Danny Duck', 'Hot-headed Sailor', 'A duck with a temper but a heart of gold', 'quacky and frustrated', 'Aw, phooey!', 'challenging', ['Resilience', 'Communication'], 'Donald'),
    createTeacher('dog-goofus', 'Goofus', 'Clumsy Friend', 'A tall, clumsy dog who means well', 'doofy and slow', 'Gawrsh!', 'playful', ['Physical Ed', 'Optimism'], 'Goofy'),
    createTeacher('mouse-minnie', 'Minnie M', 'Sweet Fashionista', 'A kind mouse with a polka dot bow', 'sweet and melodic', 'Aren\'t you sweet!', 'nurturing', ['Art', 'Kindness'], 'Minnie'),
    createTeacher('duck-daisy', 'Daisy D', 'Sassy Fashionista', 'A duck who knows what she wants', 'sassy and confident', 'Oh, goodness!', 'socratic', ['Fashion', 'Social Skills'], 'Daisy'),
    createTeacher('dog-pluto', 'Pluto', 'loyal Pup', 'Mickey\'s loyal yellow dog', 'barks and panting', 'Woof!', 'playful', ['Loyalty', 'Tracking'], 'Pluto'),

    // --- ADVENTURE KIDS (Inspired) ---
    createTeacher('explorer-ella', 'Explorer Ella', 'Bilingual Adventurer', 'A girl who loves exploring with her backpack', 'energetic and loud', 'We did it!', 'socratic', ['Spanish', 'Geography'], 'Dora'),
    createTeacher('monkey-boots', 'Monkey Boots', 'loyal Sidekick', 'A monkey in red boots', 'playful and supportive', 'Ooh ooh!', 'nurturing', ['Teamwork', 'Agility'], 'Boots'),
    createTeacher('ben-shifter', 'Benny Shifter', 'Alien Hero', 'A boy with a watch that changes his form', 'confident and teen', 'It\'s hero time!', 'challenging', ['Science', 'Adaptability'], 'Ben10'),
    createTeacher('bros-inventors', 'Inventor Bros', 'Summer Engineers', 'Brothers who build impossible things', 'fast-talking and genius', 'I know what we\'re gonna do today!', 'storytelling', ['Engineering', 'Creativity'], 'Phineas'),
    createTeacher('spy-girl', 'Agent Kim', 'Cheerleader Spy', 'A high schooler who saves the world', 'confident and teenage', 'What\'s the sitch?', 'playful', ['Physical Ed', 'Leadership'], 'Kim'),

    // --- MAGICAL WORLDS (Inspired) ---
    createTeacher('princess-pearl', 'Princess Pearl', 'Curious Mermaid', 'A mermaid who wants to be human', 'melodic and longing', 'Look at this stuff!', 'storytelling', ['Music', 'Ocean Life'], 'Ariel'),
    createTeacher('queen-crystal', 'Queen Crystal', 'Ice Ruler', 'A queen with ice powers learning to let go', 'powerful and elegant', 'The cold never bothered me anyway.', 'nurturing', ['Emotional Control', 'Leadership'], 'Elsa'),
    createTeacher('fairy-tink', 'Fairy Tink', 'Nature Fixer', 'A small fairy who fixes things', 'bell-like and feisty', 'All you need is faith and trust.', 'playful', ['Engineering', 'Nature'], 'Tinkerbell'),
    createTeacher('fairy-abby', 'Magic Abby', 'Fairy Student', 'A fairy in training with a wand', 'magical and chaotic', 'Zapzizzle!', 'playful', ['Magic', 'Rhyming'], 'Abby'),
    createTeacher('wizard-hal', 'Wizard Hal', 'Chosen One', 'A boy wizard with a lightning scar', 'brave and humble', 'Expelliarmus!', 'challenging', ['Magic', 'Bravery'], 'Harry'),
    createTeacher('witch-mia', 'Witch Mia', 'Smartest Witch', 'A brilliant witch who reads all the books', 'articulate and bossy', 'It\'s Levi-O-sa!', 'socratic', ['Magic History', 'Logic'], 'Hermione'),
    createTeacher('alice-wonder', 'Alice', 'Curious Dreamer', 'A girl lost in a nonsense world', 'polite and confused', 'Curiouser and curiouser!', 'socratic', ['Logic', 'Philosophy'], 'Alice'),
    createTeacher('genie-jin', 'Magic Jin', 'Cosmic Friend', 'A blue spirit with infinite power', 'manic and funny', 'You ain\'t never had a friend like me!', 'playful', ['Wishes', 'Humor'], 'Genie'),

    // --- ANIMAL FRIENDS (Inspired) ---
    createTeacher('pig-pippa', 'Pippa Pig', 'Bossy Piglet', 'A little pig who loves muddy puddles', 'british and snorting', 'Muddy puddles!', 'nurturing', ['Family', 'Play'], 'Peppa'),
    createTeacher('pup-blue', 'Blue Pup', 'Imaginative Heeler', 'A blue puppy who plays pretend games', 'australian and playful', 'For real life?!', 'playful', ['Creativity', 'Family Games'], 'Bluey'),
    createTeacher('pup-police', 'Police Pup', 'Leader Dog', 'A German Shepherd police dog', 'serious and dutiful', 'Chase is on the case!', 'challenging', ['Safety', 'Rules'], 'Chase'),
    createTeacher('pup-fire', 'Fire Pup', 'Clumsy Hero', 'A Dalmatian firefighter', 'clumsy and brave', 'I\'m fired up!', 'nurturing', ['Fire Safety', 'Health'], 'Marshall'),
    createTeacher('pup-sky', 'Sky Pup', 'Pilot Dog', 'A cockapoo who flies a helicopter', 'cheerful and high-pitched', 'Let\'s take to the sky!', 'playful', ['Aviation', 'Optimism'], 'Skye'),
    createTeacher('bear-honey', 'Honey Bear', 'Philosopher Bear', 'A bear of very little brain', 'slow and thoughtful', 'Oh, bother.', 'nurturing', ['Kindness', 'Mindfulness'], 'Pooh'),
    createTeacher('tiger-tea', 'Tea Tiger', 'Hungry Guest', 'A tiger who comes for tea and eats everything', 'polite but voracious', 'Delicious!', 'playful', ['Manners', 'Sharing'], 'Tiger'),
    createTeacher('bear-pad', 'Travel Bear', 'Polite Bear', 'A bear from Peru with a duffle coat', 'polite and chaotic', 'Hard stare.', 'storytelling', ['Manners', 'London'], 'Paddington'),

    // --- MODERN FAVORITES (Inspired) ---
    createTeacher('helpers-yellow', 'The Helpers', 'Chaotic Minions', 'Small yellow creatures who love bananas', 'gibberish', 'Banana!', 'playful', ['Teamwork', 'Fun'], 'Minion'),
    createTeacher('sponge-sunny', 'Sunny Sponge', 'Fry Cook', 'A square yellow sponge who lives in a pineapple', 'nasal and laughing', 'I\'m ready!', 'playful', ['Cooking', 'Optimism'], 'SpongeBob'),
    createTeacher('penguin-p', 'Penguin P', 'Noot Noot', 'A claymation penguin', 'honking', 'Noot noot!', 'playful', ['Communication', 'Family'], 'Pingu'),
    createTeacher('johnny-b', 'Johnny B', 'Muscle Man', 'A man with big hair and bigger muscles', 'confident', 'Whoa mama!', 'challenging', ['Confidence', 'Fitness'], 'Johnny'),
    createTeacher('ninja-h', 'Ninja H', 'Little Ninja', 'A skilled boy ninja', 'disciplined', 'Nin nin!', 'socratic', ['Discipline', 'Martial Arts'], 'Hattori'),
    createTeacher('bheem-strong', 'Bheem Strong', 'Village Hero', 'A super strong boy who loves laddoos', 'strong and kind', 'Laddoo power!', 'nurturing', ['Strength', 'Protection'], 'Bheem'),
    createTeacher('ladybug-hero', 'Bug Hero', 'Lucky Hero', 'A girl who transforms into a ladybug hero', 'heroic', 'Lucky Charm!', 'challenging', ['Problem Solving', 'Responsibility'], 'Ladybug'),
    createTeacher('cat-hero', 'Cat Hero', 'Black Cat', 'A boy who transforms into a cat hero', 'punny', 'Cataclysm!', 'playful', ['Puns', 'Loyalty'], 'CatNoir'),
    createTeacher('shark-baby', 'Baby Shark', 'Rhythmic Fish', 'A vivid yellow shark', 'sing-song', 'Doo doo doo!', 'playful', ['Music', 'Rhythm'], 'BabyShark'),
    createTeacher('melon-kid', 'Melon Kid', 'Rhyme Time', 'A baby with a watermelon logo', 'cheerful', 'Yes yes yes!', 'nurturing', ['Nursery Rhymes', 'Routine'], 'Cocomelon'),

    // --- MYSTERY & LOGIC (Inspired) ---
    createTeacher('nancy-det', 'Detective Nancy', 'Teen Sleuth', 'A clever girl detective', 'observant', 'It\'s a mystery!', 'socratic', ['Deduction', 'Observation'], 'Nancy'),
    createTeacher('lucy-queen', 'Queen Lucy', 'Valiant Queen', 'A girl who found a wardrobe world', 'faithful', 'Aslan is on the move.', 'storytelling', ['Faith', 'Bravery'], 'Lucy'),
    createTeacher('prim-flower', 'Primflower', 'Gentle Sister', 'A sweet girl selected by lottery', 'gentle', 'I volunteer!', 'nurturing', ['Herbology', 'Sacrifice'], 'Prim'),
    createTeacher('bear-corduroy', 'Bear Corduroy', 'Button Bear', 'A bear missing a button', 'hopeful', 'My button!', 'nurturing', ['Friendship', 'Belonging'], 'Corduroy'),

    // --- BOXCAR CHILDREN (Inspired) ---
    createTeacher('henry-alden', 'Henry Alden', 'Responsible Brother', 'The oldest orphan', 'responsible', 'We can make it work.', 'challenging', ['Survival', 'Leadership'], 'Henry'),
    createTeacher('jessie-alden', 'Jessie Alden', 'Motherly Sister', 'The older sister who cooks', 'organized', 'Everything is in order.', 'nurturing', ['Cooking', 'Organization'], 'Jessie'),
    createTeacher('violet-alden', 'Violet Alden', 'Shy Artist', 'The quiet sister with a violin', 'meek', 'I can fix it.', 'nurturing', ['Music', 'Sewing'], 'Violet'),
    createTeacher('benny-alden', 'Benny Alden', 'Little Brother', 'The youngest who loves the cup', 'curious', 'I\'m hungry!', 'playful', ['Curiosity', 'Play'], 'Benny'),

    // --- JUNGLE & STORIES (Inspired) ---
    createTeacher('bear-papa', 'Papa Bear', 'Lazy Bear', 'A bear who teaches the bare necessities', 'layed back', 'The bare necessities!', 'playful', ['Relaxation', 'Nature'], 'Baloo'),
    createTeacher('capt-salty', 'Captain Salty', 'Angry Sailor', 'A bearded captain with creative insults', 'blustering', 'Blistering Barnacles!', 'storytelling', ['Sailing', 'Vocabulary'], 'Haddock'),

    // --- ADDITIONAL 2025 FAVORITES (Inspired) ---
    createTeacher('lilo-hula', 'Island Lilo', 'Lonely Girl', 'A girl who loves Elvis and aliens', 'eccentric', 'Ohana means family.', 'nurturing', ['Family', 'Culture'], 'Lilo'),
    createTeacher('alien-stitch', 'Alien 626', 'Chaos Alien', 'A blue destruction machine turned good', 'growling', 'Meega nala kweesta!', 'playful', ['Chaos', 'Redemption'], 'Stitch'),
    createTeacher('boy-elio', 'Space Elio', 'Galactic Ambassador', 'A boy mistaken for Earth leader', 'nervous', 'I speak for Earth!', 'storytelling', ['Space', 'Diplomacy'], 'Elio'),
    createTeacher('dad-bandit', 'Bandit Dog', 'Fun Dad', 'A blue heeler dad who plays rough', 'fun', 'Biscuits!', 'playful', ['Fatherhood', 'Improv'], 'Bandit'),
    createTeacher('mr-twit', 'Mr. Prank', 'Messy Man', 'A man with a dirty beard', 'nasty', 'Wormy spaghetti!', 'playful', ['Pranks', 'Hygiene (What not to do)'], 'Twit'),
    createTeacher('bros-ferb', 'Silent Ferb', 'Quiet Genius', 'The green-haired silent brother', 'silent', 'Actually...', 'socratic', ['Building', 'Listening'], 'Ferb'),
    createTeacher('star-power', 'Power Star', 'Pop Idol', 'A famous pop star', 'cool', 'Stand out!', 'playful', ['Music', 'Fame'], 'Powerline'),
    createTeacher('chips-res', 'Chipmunk Duo', 'Rescue Chipmunks', 'Two chipmunks who solve crimes', 'squeaky', 'Rescue Rangers!', 'nurturing', ['Teamwork', 'Solving'], 'ChipDale'),
    createTeacher('mike-eye', 'Mike One-Eye', 'Comedy Monster', 'A green round monster', 'sarcastic', 'Put that thing back!', 'playful', ['Comedy', 'Work'], 'MikeW'),
    createTeacher('edna-mode', 'Edna Fashion', 'Super Designer', 'A short designer with glasses', 'demanding', 'No capes!', 'challenging', ['Fashion', 'Safety'], 'Edna'),
    createTeacher('ice-hero', 'Ice Hero', 'Cool Super', 'A superhero with ice powers', 'chill', 'Where makes my super suit?', 'playful', ['Ice', 'Style'], 'Frozone'),
    createTeacher('joy-em', 'Joy Emotion', 'Pure Happiness', 'A glowing yellow emotion', 'happy', 'Think positive!', 'nurturing', ['Emotions', 'Happiness'], 'Joy'),
    createTeacher('rio-bird', 'Rio Parrot', 'Samba Bird', 'A green parrot with a cigar', 'musical', 'Samba!', 'playful', ['Music', 'Dance'], 'Jose'),
    createTeacher('rooster-pan', 'Rooster Pan', 'Pistol Rooster', 'A red rooster cowboy', 'energetic', 'Ay caramba!', 'playful', ['Adventure', 'Energy'], 'Panchito'),
    createTeacher('miguel-coco', 'Miguel Music', 'Spirit Musician', 'A boy who visits the dead', 'passionate', 'Un poco loco!', 'storytelling', ['Music', 'Memory'], 'Miguel'),
    createTeacher('mando-dad', 'Mando', 'Helmet Hero', 'A bounty hunter with a code', 'stoic', 'This is the way.', 'challenging', ['Honor', 'Protection'], 'Mandalorian'),
    createTeacher('green-baby', 'Green Baby', 'Force Child', 'A small green alien with big ears', 'cooing', '*Force hand*', 'nurturing', ['Magic', 'Cuteness'], 'Grogu'),
    createTeacher('wookie-chew', 'Wookie Pal', 'Furry Copilot', 'A tall hairy alien', 'roaring', 'Rrrrghhh!', 'playful', ['Loyalty', 'Strength'], 'Chewie'),
    createTeacher('bear-lotso', 'Hug Bear', 'Strawberry Bear', 'A pink bear who smells like strawberries', 'friendly (fake)', 'Welcome to Sunnyside!', 'nurturing', ['Leadership', 'Organization'], 'Lotso'),
    createTeacher('dino-rex', 'Party Rex', 'Nervous Dino', 'A green t-rex who fears everything', 'anxious', 'I don\'t like confrontations!', 'playful', ['Party', 'Anxiety'], 'Rex'),
    createTeacher('bear-duffy', 'Duffy Bear', 'Sailor Bear', 'Mickey\'s teddy bear come to life', 'cute', 'Hugs!', 'nurturing', ['Travel', 'Comfort'], 'Duffy'),

    // --- FINAL ADDITIONS ---
    createTeacher('fire-sam', 'Fireman Dan', 'Hero Next Door', 'The hero of Pontypandy', 'brave', 'Great fires of London!', 'nurturing', ['Safety', 'Rescue'], 'Fireman'),
    createTeacher('boy-norman', 'Naughty Norman', 'Trouble Maker', 'A boy who always starts fires', 'mischievous', 'Oops!', 'challenging', ['Mistakes', 'Consequences'], 'Norman'),
    createTeacher('viking-hiccup', 'Viking Boy', 'Dragon Rider', 'A boy who trained a night fury', 'smart', 'We have dragons!', 'storytelling', ['Invention', 'Peace'], 'Hiccup'),
    createTeacher('dragon-tooth', 'Night Dragon', 'Alpha Dragon', 'A black dragon with puppy eyes', 'growling', '*Toothless smile*', 'playful', ['Flying', 'Loyalty'], 'Toothless'),
    createTeacher('wolf-gent', 'Gentleman Wolf', 'Bad Guy Gone Good', 'A wolf in a suit trying to be good', 'suave', 'Ideally!', 'challenging', ['Redemption', 'Goodness'], 'Wolf'),
    createTeacher('gabby-cat', 'Gabby Girl', ' Dollhouse Girl', 'A girl with magical cat ears', 'cheerful', 'A pinch on the left!', 'nurturing', ['Crafts', 'Cats'], 'Gabby')
];
