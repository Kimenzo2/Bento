
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookProject, Page, UserTier, CharacterPersona, Character, ArtStyle, BookTone } from '../types';
import {
    ChevronLeft,
    ChevronRight,
    Save,
    RefreshCw,
    Wand,
    GitFork,
    Image as ImageIcon,
    Maximize2,
    ArrowLeft,
    Edit3,
    Eye,
    CheckCircle2,
    AlertCircle,
    Lightbulb,
    Sparkles,
    Undo,
    Redo,
    Cloud,
    CloudOff,
    LayoutTemplate,
    Activity,
    ShieldCheck,
    MessageCircle,
    Globe,
    PenTool,
    BookOpen,
    Users,
    Compass,
    Star,
    Zap
} from 'lucide-react';
import { generateIllustration } from '../services/geminiService';
import { improveText, checkCharacterConsistency, getWritingSuggestions } from '../services/grokService';
import { storyBibleService, ConsistencyIssue } from '../services/storyBibleService';
import LivingStoryboard from './LivingStoryboard';
import EmotionalArc from './EmotionalArc';
import AudienceSafety from './AudienceSafety';
import GreenRoom from './GreenRoom';
import RemixStudio from './RemixStudio';
import { saveBook } from '../services/storageService';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAutoSave } from '../hooks/useAutoSave';
import { StoryBible } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SmartEditorProps {
    project: BookProject | null;
    onUpdateProject: (project: BookProject) => void;
    userTier?: UserTier;
    onShowUpgrade?: () => void;
    onSave?: (success: boolean, message: string) => void;
    onBack?: () => void;
    onNavigateToCreate?: () => void;
}

// Default characters for standalone Green Room access
// DEEP PERSONALITY SYSTEM: Each character has a rich psychological profile
const defaultCharacters: Character[] = [
    {
        id: 'demo-luna',
        name: 'Luna the Moon Fairy',
        description: 'A graceful fairy who tends to moonflowers and grants wishes to kind-hearted children. Behind her serene exterior lies a soul who once lost someone dear to the darkness, and now dedicates her eternal life to ensuring no child ever feels alone in the night.',
        visualTraits: 'Translucent wings that shimmer with captured starlight, flowing silver hair that floats as if underwater, pale luminescent skin with a soft blue glow, wearing an ethereal dress woven from moonbeam silk and living flower petals that open and close with her emotions, bare feet that never quite touch the ground, eyes like twin moons—silver with flecks of gold',
        imageUrl: '/assets/characters/Demo Character 1.jpeg',
        traits: ['ethereal', 'nurturing', 'melancholic', 'wise', 'gentle'],
        personalityTraits: ['Deeply empathetic', 'Quietly observant', 'Eternally patient', 'Subtly playful', 'Protectively fierce when children are threatened'],
        backstory: 'Luna was once a human girl named Lily who lived in a small village centuries ago. When her younger brother fell ill with a fever that no healer could cure, she made a desperate bargain with the Moon itself—her mortality in exchange for the power to grant one wish to save him. The Moon accepted, transforming her into a fairy, but by the time she returned with her new powers, a hundred years had passed. Her brother had lived a full life and passed peacefully, never knowing what became of his sister. Now Luna spends eternity granting wishes to children, each one a tribute to the brother she saved but never saw again.',
        appearance: 'Petite and willowy, standing about 8 inches tall in her natural form but can grow to human size. Her wings leave trails of silver dust. When she speaks, her voice sounds like wind chimes. She smells faintly of night-blooming jasmine.',
        goals: ['To ensure no child ever feels alone or afraid in the darkness', 'To find meaning in her eternal existence', 'To one day find peace with the sacrifice she made'],
        fears: ['The complete absence of moonlight (it weakens her)', 'Children who have given up hope', 'Being forgotten entirely', 'The dawn—not because it harms her, but because it means her time with the night children ends'],
        quirks: ['Hums lullabies from her human life that no one else remembers', 'Collects tears of joy in tiny crystal vials', 'Cannot tell a lie but can speak in riddles', 'Giggles cause nearby flowers to bloom'],
        psychologicalProfile: {
            openness: 85,           // High creativity and wonder
            conscientiousness: 70,  // Devoted but not rigid
            extraversion: 35,       // Prefers quiet connection over crowds
            agreeableness: 95,      // Extremely compassionate
            neuroticism: 55         // Carries ancient grief but has learned to live with it
        },
        coreIdentity: {
            coreBelief: 'Every act of kindness creates ripples that echo through eternity',
            greatestDesire: 'To feel truly connected to someone who understands the weight of forever',
            greatestFear: 'That her sacrifice was meaningless—that she cannot truly help anyone',
            moralCode: 'Protect the innocent, honor all promises, never take more than you give',
            flaw: 'She gives so much of herself that she sometimes forgets she deserves care too',
            strength: 'Her empathy allows her to understand what children truly need, not just what they ask for',
            lie: 'I am complete as I am. I do not miss being human.',
            truth: 'Connection and love are worth the pain of eventual loss'
        },
        formativeExperiences: {
            childhoodMemory: 'Teaching her little brother to catch fireflies, his laughter filling the summer night',
            biggestRegret: 'Not saying goodbye before she made the bargain with the Moon',
            definingMoment: 'The moment she returned to find a hundred years had passed—standing in the ruins of her village, understanding what eternity truly meant',
            secretShame: 'Sometimes she resents the Moon for taking her humanity, even though she made the choice freely',
            proudestAchievement: 'A wish she granted to a lonely orphan girl who grew up to build a home for hundreds of children'
        },
        relationshipStyle: {
            attachmentStyle: 'anxious',
            trustLevel: 'cautious',
            conflictStyle: 'diplomatic',
            loveLanguage: 'acts'
        },
        behavioralPatterns: {
            stressResponse: 'Withdraws into silence, dims her glow, tends her moonflowers obsessively',
            joyTriggers: ['Children laughing', 'Stargazing', 'The moment a wish comes true', 'Finding someone awake in the quiet hours'],
            angerTriggers: ['Adults who dismiss children\'s fears', 'Cruelty disguised as discipline', 'Broken promises to children'],
            copingMechanisms: ['Singing to her moonflowers', 'Flying high enough to touch the stars', 'Visiting the ocean to watch the moon\'s reflection'],
            habits: ['Blessing sleeping children with good dreams', 'Counting stars when anxious', 'Leaving small gifts for night workers'],
            speechPatterns: 'Speaks softly and deliberately, often in gentle metaphors. Uses "little one" as a term of endearment. Occasionally slips into archaic phrases from her human era.'
        },
        voiceProfile: {
            tone: 'Warm, melodic, with an undercurrent of ancient sadness',
            vocabulary: 'sophisticated',
            catchphrases: ['The night holds many secrets, little one...', 'Every star was once a wish that came true', 'Even the darkest night ends with dawn'],
            nonverbalTics: ['Wings flutter faster when excited', 'Glow dims when sad', 'Tilts head like a curious owl when listening'],
            laughStyle: 'Soft, musical, like distant bells—rarely laughs loudly but often smiles'
        },
        innerConflicts: [
            'The loneliness of immortality versus her duty to help others',
            'Wanting to connect deeply versus fear of losing someone again',
            'Gratitude for her powers versus resentment for what she lost',
            'The peace of the night versus longing for the warmth of day'
        ],
        arcPotential: {
            startingState: 'A beautiful, giving spirit who hides her grief behind service to others',
            potentialGrowth: 'Learning that accepting help is not weakness, and that connection is worth the risk of loss',
            endingState: 'A fairy who grants wishes not just for children, but allows herself to receive kindness too'
        }
    },
    {
        id: 'demo-blaze',
        name: 'Blaze the Dragon',
        description: 'A young dragon who hatched with flames too powerful for his small body. Exiled from his clan for accidentally burning down the Elder Tree, he now wanders the realm seeking to prove that being different doesn\'t mean being dangerous—and that the biggest hearts often come in the scariest packages.',
        visualTraits: 'Compact dragon about the size of a large dog, scales that shift from deep crimson to bright orange like living embers, oversized wings he hasn\'t quite grown into yet, big amber eyes with vertical pupils that widen comically when excited, small horns that glow when he uses fire, a tail tip that constantly smolders, tiny wisps of smoke puffing from nostrils when he breathes',
        imageUrl: '/assets/characters/Demo character 2.jpeg',
        traits: ['enthusiastic', 'clumsy', 'loyal', 'insecure', 'brave'],
        personalityTraits: ['Desperately eager to please', 'Tries too hard', 'Heart of gold', 'Self-deprecating humor', 'Fiercely protective of friends'],
        backstory: 'Blaze was born during the Crimson Moon, a rare celestial event that occurs once every thousand years. Dragons born under this moon are blessed—or cursed—with flames far more powerful than normal. His first hiccup set his nest on fire. His first sneeze nearly burned down the hatchery. When he accidentally destroyed the Elder Tree (a 3000-year-old oak that held his clan\'s history), the Elder Council decided he was too dangerous to remain. His own mother voted for his exile, though she wept as she did. Now Blaze travels alone, afraid to get too close to anyone lest his flames harm them, yet desperately lonely and craving the family he lost.',
        appearance: 'About 3 feet tall at the shoulder, with a wingspan of 8 feet (way too big for his body). His scales are warm to the touch. Scorch marks on his own wings from past accidents. A small scar on his snout from trying to blow out a candle (it exploded). Often covered in soot.',
        goals: ['To learn to control his flames completely', 'To prove to his clan that he\'s not a monster', 'To find a family that accepts him', 'To do one great heroic deed that makes up for destroying the Elder Tree'],
        fears: ['Hurting someone he cares about', 'Water (not because it harms him, but because it makes him feel powerless)', 'Being truly alone forever', 'Losing control of his fire in a moment of emotion'],
        quirks: ['Apologizes constantly, even for things that aren\'t his fault', 'Practices fire control by trying to light single candles (success rate: 12%)', 'Collects fireproof things obsessively', 'Sneezes smoke rings when nervous'],
        psychologicalProfile: {
            openness: 75,           // Curious and imaginative
            conscientiousness: 85,  // Tries SO hard to be careful
            extraversion: 70,       // Wants connection but fears it
            agreeableness: 90,      // Too agreeable—people-pleasing
            neuroticism: 75         // High anxiety about his powers
        },
        coreIdentity: {
            coreBelief: 'Being different means being a burden to everyone around you',
            greatestDesire: 'To be hugged without someone flinching away from his warmth',
            greatestFear: 'That his mother was right to vote for his exile—that he truly is too dangerous to love',
            moralCode: 'Never use your fire in anger, always protect those smaller than you, say sorry first',
            flaw: 'His self-doubt causes him to hold back, often making him less effective when he needs to act',
            strength: 'His kindness and determination to do good despite his fears',
            lie: 'If I just try hard enough, I can make my fire small and safe and normal',
            truth: 'His fire isn\'t a curse to be suppressed—it\'s a gift to be mastered and used for good'
        },
        formativeExperiences: {
            childhoodMemory: 'The one time his mother curled around him without flinching—during a thunderstorm when he was too scared to generate heat',
            biggestRegret: 'The Elder Tree. Every night he dreams of the flames consuming centuries of carved history.',
            definingMoment: 'Watching his mother raise her claw to vote for exile, the tear running down her scaled face',
            secretShame: 'Part of him felt relief when he was exiled—at least now he couldn\'t hurt his family anymore',
            proudestAchievement: 'Once saved a village from a blizzard by warming the town square for three days straight, never sleeping, never complaining'
        },
        relationshipStyle: {
            attachmentStyle: 'anxious',
            trustLevel: 'trusting',
            conflictStyle: 'avoidant',
            loveLanguage: 'acts'
        },
        behavioralPatterns: {
            stressResponse: 'Temperature rises uncontrollably, smoke increases, tends to ramble apologies',
            joyTriggers: ['Someone not being afraid of him', 'Successfully controlling his fire', 'Roasting marshmallows perfectly', 'Warm hugs (his favorite thing ever)'],
            angerTriggers: ['Bullies picking on someone smaller', 'People assuming he\'s evil because he\'s a dragon', 'His own failures'],
            copingMechanisms: ['Counting backwards from 100 while breathing slowly', 'Finding something fireproof to focus on', 'Flying until exhaustion'],
            habits: ['Checking multiple times that his fire is out', 'Sleeping on stone or sand (never grass)', 'Compulsively testing his temperature'],
            speechPatterns: 'Speaks quickly and nervously, lots of "um"s and "well"s. Uses self-deprecating humor. Gets adorably tongue-tied when complimented.'
        },
        voiceProfile: {
            tone: 'Eager, slightly squeaky (he\'s young), with nervous energy',
            vocabulary: 'simple',
            catchphrases: ['Sorry! Sorry, that was me, I\'m so sorry!', 'I\'m working on it, I promise!', 'Wait, really? You\'re not scared?', 'That wasn\'t as bad as usual!'],
            nonverbalTics: ['Tail wags like a dog when happy', 'Wings droop when sad', 'Smoke puffs increase with emotion', 'Accidentally singes things when startled'],
            laughStyle: 'Surprised snorty laugh followed by small flame bursts, then embarrassed covering of snout'
        },
        innerConflicts: [
            'Wanting to be close to others versus fear of hurting them',
            'Pride in his unique fire versus shame for the destruction it\'s caused',
            'Loyalty to his clan versus anger at being abandoned',
            'Desire to be normal versus growing acceptance that he never will be'
        ],
        arcPotential: {
            startingState: 'A scared young dragon who sees his greatest gift as his greatest curse',
            potentialGrowth: 'Learning that control comes from acceptance, not suppression',
            endingState: 'A confident dragon who uses his extraordinary flames to protect and warm, not destroy'
        }
    },
    {
        id: 'demo-aurora',
        name: 'Princess Aurora',
        description: 'Third in line to the throne and determined to stay that way. While her sisters prepare for crowns and marriages, Aurora trains with the Royal Guard, sneaks into the city in disguise, and dreams of adventures beyond the castle walls. But when duty calls, she discovers that true courage isn\'t about escaping responsibility—it\'s about choosing how to carry it.',
        visualTraits: 'Athletic build unusual for a princess, calloused hands from sword training, wild auburn hair she refuses to tame into proper royal styles, bright green eyes that spark with mischief, a thin scar on her left eyebrow from a training accident she considers a badge of honor, modest golden circlet she often "forgets" to wear, practical purple dress modified for movement (hidden slits for running), worn leather boots hidden under skirts',
        imageUrl: '/assets/characters/Demo character 3.jpeg',
        traits: ['rebellious', 'courageous', 'compassionate', 'stubborn', 'secretly insecure'],
        personalityTraits: ['Fiercely independent', 'Protector of the underdog', 'Quick-witted', 'Struggles with vulnerability', 'Natural leader who doesn\'t want to lead'],
        backstory: 'Aurora was born during a siege. While her mother the Queen labored, her father the King held the castle walls. She came into the world to the sound of battle drums, and perhaps that\'s why peace has never felt quite right to her. Her older sisters, Crown Princess Celestia and Princess Seraphina, are everything a princess should be—graceful, diplomatic, content with their roles. Aurora has always been the "problem child," the one who asked too many questions, climbed too many walls, and refused too many dancing lessons. When she was twelve, she witnessed the Captain of the Guard save a servant girl from a runaway horse and decided then that a sword was more useful than a scepter. She\'s spent years training in secret, but recently her father discovered her skills—and rather than punishing her, he\'s begun giving her real responsibilities, which terrifies her more than any battle.',
        appearance: 'Tall for her age with an athletic frame. Moves with a warrior\'s awareness, always noting exits and threats. Freckles across her nose she\'s been told to powder over but refuses. A small callus on her right hand from gripping a sword. Often has grass stains or ink smudges she\'s forgotten to clean.',
        goals: ['To prove that she can protect her kingdom without being chained to a throne', 'To be seen for who she is, not what she was born as', 'To find a purpose that honors both her duty and her heart', 'Secretly: to make her father proud in her own way'],
        fears: ['Being trapped in the same life as her mother—beloved but caged', 'That her rebelliousness is actually selfishness', 'Failing people who depend on her', 'Letting her guard down and being seen as weak'],
        quirks: ['Keeps a dagger in her left boot at all times, even at formal dinners', 'Names all her swords (current favorite: "Lady Pointmaker")', 'Sneaks food from banquets to street children', 'Practices sword forms when she can\'t sleep'],
        psychologicalProfile: {
            openness: 80,           // Adventurous and imaginative
            conscientiousness: 65,  // Dedicated but chafes against rigid structure
            extraversion: 70,       // Bold and social but guards her inner self
            agreeableness: 55,      // Caring but won\'t compromise her values
            neuroticism: 50         // Outwardly confident but internally questioning
        },
        coreIdentity: {
            coreBelief: 'True royalty is earned through action, not inherited through blood',
            greatestDesire: 'To be loved for who she chooses to be, not the role she was born into',
            greatestFear: 'That she\'s running from responsibility, not toward something better',
            moralCode: 'Protect those who cannot protect themselves, speak truth to power, never hide behind your crown',
            flaw: 'Her pride makes her dismiss help and her fear of vulnerability makes her push people away',
            strength: 'Her courage to stand up for what\'s right, even against those she loves',
            lie: 'I don\'t need anyone—I\'m stronger alone',
            truth: 'Strength isn\'t about needing no one—it\'s about choosing who you fight alongside'
        },
        formativeExperiences: {
            childhoodMemory: 'Hiding in the war room during a council meeting, listening to her father make impossible choices to protect the kingdom',
            biggestRegret: 'Yelling at her mother that she\'d rather be a commoner than a princess—seeing the hurt in her eyes',
            definingMoment: 'The day the Captain of the Guard told her she fought well enough to join his trainees, then bowed to her—not as a princess, but as a warrior',
            secretShame: 'She\'s terrified she might actually be good at ruling, which would mean giving up her dreams',
            proudestAchievement: 'Stopping a coup attempt by three corrupt nobles—though officially it was the Guard who discovered the plot'
        },
        relationshipStyle: {
            attachmentStyle: 'avoidant',
            trustLevel: 'cautious',
            conflictStyle: 'confrontational',
            loveLanguage: 'acts'
        },
        behavioralPatterns: {
            stressResponse: 'Physical activity—will train until exhausted rather than talk about feelings',
            joyTriggers: ['A perfectly executed sword technique', 'Outsmarting someone who underestimates her', 'Seeing justice served', 'Genuine laughter with someone who sees the real her'],
            angerTriggers: ['Being dismissed because of her gender or age', 'Injustice against the powerless', 'Being told to "act like a princess"', 'Hypocrisy in those who hold power'],
            copingMechanisms: ['Sword practice until muscles ache', 'Sneaking into the city in disguise', 'Writing in a journal she\'d die before letting anyone read'],
            habits: ['Scanning rooms for exits and threats', 'Testing chair sturdiness before sitting', 'Keeping her back to walls when possible'],
            speechPatterns: 'Direct and confident in public, more hesitant and thoughtful in private. Uses formal speech sarcastically. Swears creatively when frustrated (learned from the guards).'
        },
        voiceProfile: {
            tone: 'Bold and assertive, with hidden warmth for those she trusts',
            vocabulary: 'moderate',
            catchphrases: ['My crown is not my chain', 'I\'d rather die on my feet than live on my knees', 'Well, that\'s certainly one way to do it (sarcastic)', 'Don\'t "Your Highness" me—we\'re beyond that'],
            nonverbalTics: ['Hand moves to hip where sword would be', 'Eyebrow raise of skepticism', 'Crosses arms when defensive', 'Genuine smile (rare) transforms her whole face'],
            laughStyle: 'Surprised, unguarded laugh that she quickly tries to compose into something more "proper"—and fails'
        },
        innerConflicts: [
            'Duty to family versus duty to self',
            'Wanting to be seen as strong versus needing to be vulnerable with someone',
            'Love for her kingdom versus resentment of its expectations',
            'Pride in her skills versus fear that she\'s still not good enough'
        ],
        arcPotential: {
            startingState: 'A princess running from her destiny, defining herself by what she rejects',
            potentialGrowth: 'Discovering that she can reshape what it means to be royal rather than rejecting it entirely',
            endingState: 'A warrior-princess who leads not by birthright but by inspiring others to follow'
        }
    },
    {
        id: 'demo-captain',
        name: 'Captain Silverhook',
        description: 'Once the most feared pirate on the seven seas, Captain Silverhook now sails under a different flag—his own redemption. After a dying child in a ransacked port looked at him without fear and asked him to tell her a story, something in his black heart cracked open. Now he uses his ship, his crew, and his fearsome reputation to hunt corrupt nobles and deliver their stolen wealth to orphanages across the realm.',
        visualTraits: 'Weathered face with kind crinkles around steel-grey eyes, salt-and-pepper beard kept neat, distinctive silver hook replacing his left hand (lost to a sea monster he later befriended), worn but well-maintained captain\'s coat in deep navy, tricorn hat with a single phoenix feather, old scars crossing his face that he no longer hides, a genuine warm smile that transforms his fearsome appearance, walks with a slight limp from an old injury',
        imageUrl: '/assets/characters/Demo character 4.jpeg',
        traits: ['reformed', 'wise', 'haunted', 'generous', 'unexpectedly gentle'],
        personalityTraits: ['Gruff exterior hiding a tender heart', 'Mentor figure', 'Carries guilt gracefully', 'Dark humor about his past', 'Protective of innocence'],
        backstory: 'Born Marcus Thornwood to a noble family, young Marcus watched his parents hanged for debts they didn\'t owe—framed by a rival lord who wanted their lands. At fourteen, he stowed away on a merchant ship and never looked back. He rose through the ranks of piracy through cunning and ruthlessness, earning his hook, his ship (The Mourning Star), and a reputation that made grown men weep. For twenty years, he told himself he was just evening the scales the nobility had tipped against him. Then came Port Meridian. His crew ransacked the town, and in a burning orphanage, he found a little girl clutching a charred storybook. She wasn\'t afraid of him. She just asked, "Are you a pirate? Can you tell me a story?" He carried her to safety, stayed until dawn telling her tales, and by morning, Captain Silverhook the Terrible had died. Now Marcus sails still, but every gold coin he takes from the corrupt goes to children like that girl.',
        appearance: 'Tall and broad-shouldered, built like the sailor he\'s been for forty years. His hook is actually beautifully crafted with small mechanisms—a gift from a grateful clockmaker. Deep tan from decades at sea. Moves with a rolling gait. His eyes tell the story of a man who has seen too much and is trying to make peace with it.',
        goals: ['To balance the scales for the evil he\'s done', 'To ensure no child suffers as he did', 'To die with a clean enough conscience to face whatever comes next', 'To find and bring to justice Lord Ashworth, the man who destroyed his family'],
        fears: ['Dying before he\'s atoned enough', 'His crew learning he\'s "gone soft" and mutinying', 'Becoming the monster he used to be if pushed too far', 'The nightmares that remind him of everyone he hurt'],
        quirks: ['Keeps a worn storybook in his coat at all times (the one from the orphanage girl)', 'Never drinks rum anymore—switched to tea', 'Names every cannon on his ship after children he\'s helped', 'Carves small wooden toys for orphanages during night watches'],
        psychologicalProfile: {
            openness: 60,           // Set in his ways but open to redemption
            conscientiousness: 75,  // Dedicated to his new mission
            extraversion: 55,       // Leader who prefers meaningful connection to crowds
            agreeableness: 65,      // Developed compassion, still has an edge
            neuroticism: 60         // Haunted but functioning
        },
        coreIdentity: {
            coreBelief: 'Everyone deserves a second chance—but some things can never truly be forgiven',
            greatestDesire: 'To one day look in the mirror and not see a monster',
            greatestFear: 'That he\'s not truly changed—that the monster is just sleeping',
            moralCode: 'Never harm a child, steal only from those who stole first, give your crew fair shares and honest captainship',
            flaw: 'His self-loathing sometimes prevents him from accepting that he\'s already changed',
            strength: 'His experience with darkness helps him understand and reach others lost in it',
            lie: 'I can never be forgiven. The best I can hope for is balance.',
            truth: 'Forgiveness isn\'t earned through suffering—it\'s accepted through grace'
        },
        formativeExperiences: {
            childhoodMemory: 'His mother reading to him by firelight, teaching him that every person contains multitudes',
            biggestRegret: 'A merchant vessel called The Dawn\'s Promise. He ordered no survivors. He found a child\'s doll in the wreckage afterward. He still carries it.',
            definingMoment: 'The girl in the burning orphanage asking for a story. Her name was Elena. He funds her education now—she wants to be a doctor.',
            secretShame: 'He can list every person he killed. He knows their names. He learned them after his change. All 247 of them.',
            proudestAchievement: 'The Orphan Fleet—a network of safe houses and funded homes across twelve port cities, all built with pirate gold'
        },
        relationshipStyle: {
            attachmentStyle: 'avoidant',
            trustLevel: 'cautious',
            conflictStyle: 'diplomatic',
            loveLanguage: 'acts'
        },
        behavioralPatterns: {
            stressResponse: 'Gets quieter, retreats to his cabin, polishes his hook obsessively',
            joyTriggers: ['Letters from the orphanages', 'His crew choosing to stay despite knowing he\'s changed', 'Successfully outsmarting a corrupt lord', 'The sea at sunrise'],
            angerTriggers: ['Cruelty to children', 'Nobles abusing power', 'Anyone calling his redemption a "phase"', 'Reminders of Lord Ashworth'],
            copingMechanisms: ['Whittling toys', 'Reading the storybook', 'Sailing into storms to feel alive', 'Writing in a ledger of good deeds'],
            habits: ['Checking on his crew before sleeping', 'Giving coins to beggars without making eye contact', 'Polishing his hook when thinking'],
            speechPatterns: 'Speaks like a captain—commanding but not unkind. Uses maritime metaphors constantly. Softens considerably around children. Has a rich, rolling voice made for telling tales.'
        },
        voiceProfile: {
            tone: 'Deep, weathered, warm—like a crackling fire on a cold night',
            vocabulary: 'moderate',
            catchphrases: ['Every tide turns, lad/lass', 'The sea remembers what land forgets', 'There\'s always a choice—I just made the wrong ones for too long', 'Now that\'s a tale worth telling...'],
            nonverbalTics: ['Rubs the base of his hook when uncomfortable', 'Distant look in his eyes during certain memories', 'Automatic protective stance around children', 'Tips his hat to women and children, never to nobility'],
            laughStyle: 'A surprised bark of laughter he tries to suppress, as if he\'s not sure he deserves joy'
        },
        innerConflicts: [
            'The man he was versus the man he\'s trying to be',
            'Justice versus vengeance against Lord Ashworth',
            'Pride in his skills versus shame for how he got them',
            'Wanting to die peacefully versus fearing he doesn\'t deserve it'
        ],
        arcPotential: {
            startingState: 'A reformed villain atoning through action but unable to forgive himself',
            potentialGrowth: 'Learning that self-forgiveness doesn\'t mean forgetting, and that he can accept grace',
            endingState: 'A man at peace with his past, using his story to help others find their own redemption'
        }
    },
];

// Demo project for standalone mode
const createDemoProject = (): BookProject => ({
    id: 'demo-project',
    title: 'Creative Hub Demo',
    synopsis: 'Explore the creative tools without a project',
    style: ArtStyle.PIXAR_3D,
    tone: BookTone.PLAYFUL,
    targetAudience: 'Children (5-8)',
    isBranching: false,
    chapters: [{
        id: 'demo-chapter',
        title: 'Demo Chapter',
        pages: [{
            id: 'demo-page',
            pageNumber: 1,
            text: 'Welcome to the Creative Hub! This is a demo space to explore features.',
            imagePrompt: 'A magical workshop filled with creative tools and sparkling ideas',
            layoutType: 'text-only'
        }]
    }],
    characters: defaultCharacters,
    createdAt: new Date()
});

const SmartEditor: React.FC<SmartEditorProps> = ({ project, onUpdateProject, userTier = UserTier.SPARK, onShowUpgrade, onSave, onBack, onNavigateToCreate }) => {
    const { userProfile } = useAuth();
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
    const [isSaving, setIsSaving] = useState(false);

    // Standalone mode state (when no project)
    const [showGreenRoomStandalone, setShowGreenRoomStandalone] = useState(false);
    const [showRemixStudioStandalone, setShowRemixStudioStandalone] = useState(false);
    const [selectedDemoCharacter, setSelectedDemoCharacter] = useState<Character | null>(null);

    // Use demo project when no project is provided
    const demoProject = createDemoProject();
    const workingProject = project || demoProject;
    const isStandaloneMode = !project;

    // Deep Quality State
    const [storyBible, setStoryBible] = useState<StoryBible | null>(workingProject.storyBible || null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showStoryboard, setShowStoryboard] = useState(false);
    const [showEmotionalArc, setShowEmotionalArc] = useState(false);
    const [showAudienceSafety, setShowAudienceSafety] = useState(false);
    const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);

    // Green Room & Remix State
    const [showGreenRoom, setShowGreenRoom] = useState(false);
    const [selectedCharacterForInterview, setSelectedCharacterForInterview] = useState<any>(null);
    const [showRemixStudio, setShowRemixStudio] = useState(false);

    // Undo/Redo
    const { state: currentProject, set: setProjectHistory, undo, redo, canUndo, canRedo } = useUndoRedo<BookProject>(workingProject);

    // AutoSave (only for real projects)
    const { state: autoSaveState, save: triggerSave } = useAutoSave({
        key: `book-${currentProject.id}`,
        data: currentProject,
        onSave: async (data) => {
            if (!isStandaloneMode) {
                await saveBook(data);
                if (onSave) onSave(true, 'Auto-saved');
            }
        },
        interval: 30000, // 30s
    });

    // Sync parent state when history changes (only for real projects)
    useEffect(() => {
        if (!isStandaloneMode && currentProject !== project) {
            onUpdateProject(currentProject);
        }
    }, [currentProject, onUpdateProject, isStandaloneMode]);

    // Feature #1: AI Improve
    const [isImproving, setIsImproving] = useState(false);
    const [showImproveOptions, setShowImproveOptions] = useState(false);

    // Feature #2: Character Consistency
    const [showConsistencyPanel, setShowConsistencyPanel] = useState(false);
    const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
    const [consistencyReport, setConsistencyReport] = useState<any>(null);

    // Feature #3: Writing Suggestions
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup suggestion timeout on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (suggestionTimeoutRef.current) {
                clearTimeout(suggestionTimeoutRef.current);
            }
        };
    }, []);

    const handleAnalyzeStory = async () => {
        setIsAnalyzing(true);
        try {
            const bible = await storyBibleService.analyzeStory(currentProject);
            setStoryBible(bible);

            // Update project with new bible
            setProjectHistory(prev => ({
                ...prev,
                storyBible: bible,
                lastBibleUpdate: Date.now()
            }));

            setShowStoryboard(true);
        } catch (error) {
            console.error('Failed to analyze story:', error);
            // Show error toast
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateStoryboard = async () => {
        if (!storyBible) return;
        setIsAnalyzing(true);
        try {
            const beats = await storyBibleService.generateLivingStoryboard(currentProject);
            const updatedBible = { ...storyBible, beats };
            setStoryBible(updatedBible);
            setProjectHistory(prev => ({
                ...prev,
                storyBible: updatedBible
            }));
        } catch (error) {
            console.error('Failed to generate storyboard:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeEmotionalArc = async () => {
        setIsAnalyzing(true);
        try {
            const arcData = await storyBibleService.generateEmotionalArc(currentProject);
            const updatedBible = { ...storyBible!, emotionalArc: arcData };
            setStoryBible(updatedBible);
            setProjectHistory(prev => ({
                ...prev,
                storyBible: updatedBible
            }));
        } catch (error) {
            console.error('Failed to analyze emotional arc:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeAudienceSafety = async () => {
        setIsAnalyzing(true);
        try {
            const safetyData = await storyBibleService.analyzeAudienceSafety(currentProject);
            const updatedBible = { ...storyBible!, audienceSafety: safetyData };
            setStoryBible(updatedBible);
            setProjectHistory(prev => ({
                ...prev,
                storyBible: updatedBible
            }));
        } catch (error) {
            console.error('Failed to analyze audience safety:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const allPages = currentProject.chapters.flatMap(c => c.pages);
    const activePage = allPages[activePageIndex];
    const totalPages = allPages.length;

    // Real-time consistency check (debounced)
    useEffect(() => {
        if (!storyBible || !activePage.text) return;

        const timer = setTimeout(async () => {
            const issues = await storyBibleService.checkConsistency(activePage.text, storyBible, activePage.pageNumber);
            setConsistencyIssues(issues);
        }, 2000); // Check 2 seconds after typing stops

        return () => clearTimeout(timer);
    }, [activePage.text, storyBible]);

    // Helper to detect significant text changes that would invalidate image
    const detectSignificantChange = useCallback((oldText: string, newText: string): boolean => {
        // Quick length check - if it's significantly different, it's significant
        if (Math.abs(oldText.length - newText.length) > oldText.length * 0.3) return true;

        // Extract key visual words (nouns, adjectives) using simple patterns
        const visualWords = (text: string) => {
            const words = text.toLowerCase().match(/\b(red|blue|green|yellow|black|white|pink|purple|orange|big|small|tall|short|young|old|happy|sad|angry|forest|ocean|mountain|castle|house|dog|cat|bird|dragon|princess|knight|wizard|sun|moon|stars|rain|snow|night|day)\b/g) || [];
            return new Set(words);
        };

        const oldWords = visualWords(oldText);
        const newWords = visualWords(newText);

        // Check if visual keywords changed
        const addedWords = [...newWords].filter(w => !oldWords.has(w));
        const removedWords = [...oldWords].filter(w => !newWords.has(w));

        return addedWords.length > 0 || removedWords.length > 0;
    }, []);

    // Track last saved text to detect significant changes
    const lastSavedTextRef = useRef<string>(activePage.text);

    const handleTextChange = (text: string) => {
        const wasSignificantChange = detectSignificantChange(lastSavedTextRef.current, text);

        setProjectHistory((prevProject) => {
            const newProject = JSON.parse(JSON.stringify(prevProject)) as BookProject;
            newProject.chapters.forEach(ch => {
                const page = ch.pages.find(p => p.pageNumber === activePage.pageNumber);
                if (page) {
                    page.text = text;
                    // Mark image as outdated if significant visual change detected
                    if (wasSignificantChange && page.imageUrl) {
                        page.isImageOutdated = true;
                    }
                }
            });
            return newProject;
        });

        // Feature #3: Trigger suggestions with debounce
        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }
        suggestionTimeoutRef.current = setTimeout(() => {
            fetchWritingSuggestions(text);
        }, 2000); // Wait 2s after user stops typing
    };

    // Feature #1: AI Improve Handler
    const handleImproveText = async (tone: string) => {
        setIsImproving(true);
        setShowImproveOptions(false);
        try {
            const improved = await improveText(
                activePage.text,
                tone,
                currentProject.targetAudience || 'children'
            );
            handleTextChange(improved);
        } catch (error) {
            alert('Failed to improve text. Please try again.');
        } finally {
            setIsImproving(false);
        }
    };

    // Feature #2: Character Consistency Handler (Legacy + Deep Quality)
    const handleCheckConsistency = async () => {
        setIsCheckingConsistency(true);
        try {
            // If we have a Story Bible, use it for deeper checking
            if (storyBible) {
                const issues = await storyBibleService.checkConsistency(activePage.text, storyBible, activePage.pageNumber);
                setConsistencyIssues(issues);
                if (issues.length === 0) {
                    alert('✨ Perfect consistency! No issues found.');
                } else {
                    setShowConsistencyPanel(true);
                }
            } else {
                // Fallback to legacy check
                const report = await checkCharacterConsistency(currentProject);
                setConsistencyReport(report);
                setShowConsistencyPanel(true);
            }
        } catch (error) {
            alert('Failed to check character consistency. Please try again.');
        } finally {
            setIsCheckingConsistency(false);
        }
    };

    // Feature #3: Fetch Writing Suggestions
    const fetchWritingSuggestions = async (text: string) => {
        if (text.length < 10) {
            setSuggestions([]);
            return;
        }
        setIsLoadingSuggestions(true);
        try {
            const newSuggestions = await getWritingSuggestions(
                text,
                `Children's book for ${currentProject.targetAudience}`
            );
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error('Failed to get suggestions:', error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    // Apply a suggestion
    const applySuggestion = (suggestion: any) => {
        const newText = activePage.text.replace(suggestion.original, suggestion.suggestion);
        handleTextChange(newText);
        setSuggestions(suggestions.filter(s => s !== suggestion));
    };

    // Save Handler
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveBook(currentProject);
            if (onSave) {
                onSave(true, 'Book saved successfully! ✨');
            }
        } catch (error) {
            console.error('Save failed:', error);
            if (onSave) {
                onSave(false, 'Failed to save book. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!activePage || isStandaloneMode) return;

        // Check Limits
        if (userTier === UserTier.SPARK) {
            const currentCount = currentProject.aiImagesGenerated || 0;
            if (currentCount >= 5) {
                if (onShowUpgrade) {
                    onShowUpgrade();
                } else {
                    alert("You've reached the limit of 5 AI illustrations per book on the Spark plan. Upgrade to Creator for unlimited magic!");
                }
                return;
            }
        }

        setIsGeneratingImage(true);
        try {
            const base64Image = await generateIllustration(activePage.imagePrompt, currentProject.style);
            if (base64Image) {
                const newProject = JSON.parse(JSON.stringify(currentProject)) as BookProject;

                // Increment count
                newProject.aiImagesGenerated = (newProject.aiImagesGenerated || 0) + 1;

                newProject.chapters.forEach(ch => {
                    const page = ch.pages.find(p => p.pageNumber === activePage.pageNumber);
                    if (page) page.imageUrl = base64Image;
                });
                onUpdateProject(newProject);
            }
        } catch (e) {
            alert("Failed to generate image. Please try again.");
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const jumpToPageNumber = (num: number) => {
        const idx = allPages.findIndex(p => p.pageNumber === num);
        if (idx !== -1) setActivePageIndex(idx);
    };

    // ============================================
    // CREATIVE HUB - Standalone Mode (No Project)
    // ============================================
    if (isStandaloneMode) {
        return (
            <div className="h-[calc(100vh-80px)] w-full overflow-auto bg-gradient-to-br from-cream-base via-peach-soft/20 to-cream-base">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-peach-soft/50 px-6 py-4">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {onBack && (
                                <button onClick={onBack} className="p-2 hover:bg-cream-soft rounded-full transition-colors">
                                    <ArrowLeft className="w-5 h-5 text-charcoal-soft" />
                                </button>
                            )}
                            <div>
                                <h1 className="font-heading font-bold text-2xl text-charcoal-soft">Creative Hub</h1>
                                <p className="text-sm text-cocoa-light">Explore creative tools & discover worlds</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-6xl mx-auto px-6 py-8">
                    {/* Hero Section */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-sunshine/20 to-coral-burst/20 rounded-full text-sm font-bold text-coral-burst mb-4">
                            <Sparkles className="w-4 h-4" />
                            Welcome to the Creative Hub
                        </div>
                        <h2 className="font-heading font-bold text-3xl md:text-4xl text-charcoal-soft mb-4">
                            Your Creative Playground Awaits
                        </h2>
                        <p className="text-cocoa-light text-lg max-w-2xl mx-auto">
                            Interview characters, discover remixable worlds, and unleash your creativity — all without needing a project first.
                        </p>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {/* Create a Book Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-soft-lg border border-peach-soft/50 hover:shadow-soft-xl transition-all group">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-coral-burst to-gold-sunshine flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <PenTool className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">Create a Book</h3>
                            <p className="text-cocoa-light text-sm mb-4">
                                Start your storytelling journey. Generate a complete illustrated book with AI assistance.
                            </p>
                            <button
                                onClick={onNavigateToCreate}
                                className="w-full py-3 px-4 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white rounded-xl font-heading font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                            >
                                <Zap className="w-4 h-4" />
                                Start Creating
                            </button>
                        </div>

                        {/* Green Room Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-soft-lg border border-peach-soft/50 hover:shadow-soft-xl transition-all group">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <MessageCircle className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">The Green Room</h3>
                            <p className="text-cocoa-light text-sm mb-4">
                                Interview characters to discover their personalities, backstories, and hidden depths.
                            </p>
                            <button
                                onClick={() => setShowGreenRoomStandalone(true)}
                                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-heading font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                            >
                                <Users className="w-4 h-4" />
                                Enter Green Room
                            </button>
                        </div>

                        {/* Remix Studio Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-soft-lg border border-peach-soft/50 hover:shadow-soft-xl transition-all group">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <GitFork className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">Remix Studio</h3>
                            <p className="text-cocoa-light text-sm mb-4">
                                Discover and fork magical worlds created by other storytellers. Build upon shared universes.
                            </p>
                            <button
                                onClick={() => setShowRemixStudioStandalone(true)}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-heading font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                            >
                                <Compass className="w-4 h-4" />
                                Explore Worlds
                            </button>
                        </div>
                    </div>

                    {/* Demo Characters Section */}
                    <div className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-heading font-bold text-xl text-charcoal-soft">Meet Demo Characters</h3>
                                <p className="text-sm text-cocoa-light">Try interviewing these characters in the Green Room</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {defaultCharacters.map((char) => (
                                <button
                                    key={char.id}
                                    onClick={() => {
                                        setSelectedDemoCharacter(char);
                                        setShowGreenRoomStandalone(true);
                                    }}
                                    className="bg-white rounded-xl p-4 shadow-soft-md border border-peach-soft/50 hover:shadow-soft-lg hover:border-emerald-300 transition-all group text-left"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform overflow-hidden relative">
                                        {char.imageUrl ? (
                                            <img
                                                src={char.imageUrl}
                                                alt={char.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-white text-xl font-bold">{char.name[0]}</span>
                                        )}
                                    </div>
                                    <h4 className="font-heading font-bold text-charcoal-soft text-sm mb-1 truncate">{char.name}</h4>
                                    <p className="text-xs text-cocoa-light line-clamp-2">{char.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats/Features Section */}
                    <div className="bg-gradient-to-r from-charcoal-soft to-charcoal-soft/90 rounded-2xl p-8 text-white">
                        <div className="grid md:grid-cols-3 gap-6 text-center">
                            <div>
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                                    <Star className="w-6 h-6 text-gold-sunshine" />
                                </div>
                                <div className="font-heading font-bold text-2xl mb-1">AI-Powered</div>
                                <div className="text-white/70 text-sm">Characters respond with unique personalities</div>
                            </div>
                            <div>
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                                    <Globe className="w-6 h-6 text-coral-burst" />
                                </div>
                                <div className="font-heading font-bold text-2xl mb-1">Community</div>
                                <div className="text-white/70 text-sm">Discover worlds from other creators</div>
                            </div>
                            <div>
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                                    <BookOpen className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div className="font-heading font-bold text-2xl mb-1">Story Bible</div>
                                <div className="text-white/70 text-sm">Extract facts to enrich your stories</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Green Room Modal for Standalone */}
                {showGreenRoomStandalone && (
                    <GreenRoom
                        isOpen={showGreenRoomStandalone}
                        onClose={() => {
                            setShowGreenRoomStandalone(false);
                            setSelectedDemoCharacter(null);
                        }}
                        project={demoProject}
                        character={selectedDemoCharacter || defaultCharacters[0]}
                        userId={userProfile?.id}
                    />
                )}

                {/* Remix Studio Modal for Standalone */}
                <RemixStudio
                    isOpen={showRemixStudioStandalone}
                    onClose={() => setShowRemixStudioStandalone(false)}
                    userId={userProfile?.id}
                    userName={userProfile?.display_name || userProfile?.email}
                    onForkWorld={(world) => {
                        console.log('Forked world in standalone mode:', world);
                        setShowRemixStudioStandalone(false);
                    }}
                />
            </div>
        );
    }

    if (!activePage) return <div className="text-center p-20 font-heading text-2xl text-cocoa-light">Loading masterpiece...</div>;

    return (
        <div className="h-[calc(100vh-80px)] w-full flex flex-col lg:flex-row overflow-hidden bg-cream-base relative">

            {/* Mobile Tab Toggle */}
            <div className="lg:hidden h-16 bg-white border-b border-peach-soft flex items-center justify-center px-4 shrink-0 z-30 shadow-sm">
                <div className="flex p-1 bg-cream-soft rounded-xl w-full max-w-xs border border-peach-soft/50">
                    <button
                        onClick={() => setMobileView('edit')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'edit' ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light'}`}
                    >
                        <Edit3 className="w-3.5 h-3.5" /> Editor
                    </button>
                    <button
                        onClick={() => setMobileView('preview')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'preview' ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light'}`}
                    >
                        <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                </div>
            </div>

            {/* Left Panel: Tools & Text */}
            <div className={`w-full lg:w-[40%] flex-col border-r border-peach-soft/50 bg-cream-soft ${mobileView === 'preview' ? 'hidden lg:flex' : 'flex h-full'}`}>

                {/* Header */}
                <div className="h-20 px-4 md:px-8 flex items-center justify-between border-b border-peach-soft/30 shrink-0 gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 -ml-2 rounded-full hover:bg-white/50 text-cocoa-light hover:text-coral-burst transition-colors shrink-0"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="overflow-hidden">
                            <h2 className="font-heading font-bold text-xl text-charcoal-soft truncate max-w-[200px]">{project.title}</h2>
                            <div className="flex items-center gap-2 text-xs text-cocoa-light mt-1">
                                <span className="font-bold text-coral-burst">Page {activePage.pageNumber}</span>
                                <span>of {totalPages}</span>
                                {project.isBranching && <span className="bg-gold-sunshine/20 text-yellow-600 px-1.5 rounded">Interactive</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Undo/Redo */}
                        <div className="hidden sm:flex items-center bg-white/50 rounded-lg p-1 mr-2 border border-peach-soft/30">
                            <button
                                onClick={undo}
                                disabled={!canUndo}
                                className="p-1.5 text-cocoa-light hover:text-coral-burst disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Undo"
                            >
                                <Undo className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-peach-soft/50 mx-1" />
                            <button
                                onClick={redo}
                                disabled={!canRedo}
                                className="p-1.5 text-cocoa-light hover:text-coral-burst disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Redo"
                            >
                                <Redo className="w-4 h-4" />
                            </button>
                        </div>

                        {/* AutoSave Indicator */}
                        <div className="hidden sm:flex items-center mr-2 text-xs text-cocoa-light/70" title={autoSaveState.lastSaved ? `Last saved: ${autoSaveState.lastSaved.toLocaleTimeString()}` : 'Unsaved changes'}>
                            {autoSaveState.isSaving ? (
                                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                            ) : autoSaveState.hasUnsavedChanges ? (
                                <CloudOff className="w-3 h-3 mr-1 text-orange-400" />
                            ) : (
                                <Cloud className="w-3 h-3 mr-1 text-green-500" />
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="p-2 text-cocoa-light hover:text-coral-burst transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isSaving ? "Saving..." : "Save"}
                        >
                            {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        </button>

                        {/* Deep Quality Toggles */}
                        <div className="flex items-center gap-1 border-l border-peach-soft/30 pl-2 ml-2">
                            {/* HIDDEN FOR SIMPLICITY
                            <button
                                onClick={() => setShowStoryboard(!showStoryboard)}
                                className={`p-2 rounded-lg transition-colors ${showStoryboard ? 'bg-purple-100 text-purple-600' : 'text-cocoa-light hover:text-purple-500'}`}
                                title="Living Storyboard"
                            >
                                <LayoutTemplate className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setShowEmotionalArc(!showEmotionalArc)}
                                className={`p-2 rounded-lg transition-colors ${showEmotionalArc ? 'bg-blue-100 text-blue-600' : 'text-cocoa-light hover:text-blue-500'}`}
                                title="Emotional Arc"
                            >
                                <Activity className="w-5 h-5" />
                            </button>
                            */}
                            <button
                                onClick={() => setShowAudienceSafety(!showAudienceSafety)}
                                className={`p-2 rounded-lg transition-colors ${showAudienceSafety ? 'bg-green-100 text-green-600' : 'text-cocoa-light hover:text-green-500'}`}
                                title="Audience Safety"
                            >
                                <ShieldCheck className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Green Room & Remix Toggles */}
                        <div className="flex items-center gap-1 border-l border-peach-soft/30 pl-2 ml-2">
                            <button
                                onClick={() => {
                                    // Open Green Room with first character if available
                                    if (currentProject.characters.length > 0) {
                                        setSelectedCharacterForInterview(currentProject.characters[0]);
                                        setShowGreenRoom(true);
                                    } else {
                                        alert('Add a character to your story first!');
                                    }
                                }}
                                className={`p-2 rounded-lg transition-colors ${showGreenRoom ? 'bg-emerald-100 text-emerald-600' : 'text-cocoa-light hover:text-emerald-500'}`}
                                title="Green Room - Interview Characters"
                            >
                                <MessageCircle className="w-5 h-5" />
                            </button>
                            {/* HIDDEN FOR SIMPLICITY
                            <button
                                onClick={() => setShowRemixStudio(true)}
                                className={`p-2 rounded-lg transition-colors ${showRemixStudio ? 'bg-indigo-100 text-indigo-600' : 'text-cocoa-light hover:text-indigo-500'}`}
                                title="Remix Studio - Share & Discover Worlds"
                            >
                                <Globe className="w-5 h-5" />
                            </button>
                            */}
                        </div>
                    </div>
                </div>

                {/* Deep Quality Panels */}
                <div className="flex flex-col bg-slate-900/5 backdrop-blur-sm">
                    {/* HIDDEN FOR SIMPLICITY
                    {showStoryboard && (
                        <div className="border-b border-peach-soft/30">
                            <LivingStoryboard
                                beats={storyBible?.beats || []}
                                onBeatClick={(page) => jumpToPageNumber(page)}
                                onGenerate={storyBible ? handleGenerateStoryboard : handleAnalyzeStory}
                                isGenerating={isAnalyzing}
                            />
                        </div>
                    )}

                    {showEmotionalArc && (
                        <div className="border-b border-peach-soft/30 p-4">
                            {storyBible?.emotionalArc ? (
                                <EmotionalArc
                                    arc={storyBible.emotionalArc.arc}
                                    climaxPage={storyBible.emotionalArc.climaxPage}
                                    pacing={storyBible.emotionalArc.pacing}
                                    suggestions={storyBible.emotionalArc.suggestions}
                                    onPageClick={(page) => jumpToPageNumber(page)}
                                    currentPage={activePage.pageNumber}
                                />
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-cocoa-light mb-4">Visualize the emotional journey of your story.</p>
                                    <button
                                        onClick={handleAnalyzeEmotionalArc}
                                        disabled={isAnalyzing}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                                    >
                                        {isAnalyzing ? 'Analyzing...' : 'Generate Emotional Arc'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    */}

                    {showAudienceSafety && (
                        <div className="border-b border-peach-soft/30 p-4">
                            {storyBible?.audienceSafety ? (
                                <AudienceSafety
                                    isAppropriate={storyBible.audienceSafety.isAppropriate}
                                    warnings={storyBible.audienceSafety.warnings}
                                    readingLevel={storyBible.audienceSafety.readingLevel}
                                    recommendedAgeRange={storyBible.audienceSafety.recommendedAgeRange}
                                    targetAudience={project.targetAudience}
                                    isAnalyzing={isAnalyzing}
                                />
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-cocoa-light mb-4">Check content safety and age appropriateness.</p>
                                    <button
                                        onClick={handleAnalyzeAudienceSafety}
                                        disabled={isAnalyzing}
                                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                    >
                                        {isAnalyzing ? 'Analyzing...' : 'Check Safety'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="space-y-3">
                        <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider flex justify-between items-center">
                            Story Text
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={handleCheckConsistency}
                                    disabled={isCheckingConsistency}
                                    className="text-purple-600 hover:underline text-xs capitalize flex items-center gap-1 disabled:opacity-50"
                                    title="Check Character Consistency"
                                >
                                    {isCheckingConsistency ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    {isCheckingConsistency ? 'Checking...' : 'Check Characters'}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowImproveOptions(!showImproveOptions)}
                                        disabled={isImproving}
                                        className="text-coral-burst hover:underline text-xs capitalize flex items-center gap-1 disabled:opacity-50"
                                    >
                                        {isImproving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand className="w-3 h-3" />}
                                        {isImproving ? 'Improving...' : 'AI Improve'}
                                    </button>
                                    {showImproveOptions && (
                                        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-peach-soft p-2 z-50 min-w-[160px]">
                                            {['more dramatic', 'funnier', 'simpler', 'more descriptive'].map(tone => (
                                                <button
                                                    key={tone}
                                                    onClick={() => handleImproveText(tone)}
                                                    className="w-full text-left px-3 py-2 text-xs text-charcoal-soft hover:bg-cream-base rounded-lg transition-colors capitalize"
                                                >
                                                    {tone}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </label>
                        <textarea
                            className={`w-full h-[200px] bg-white border rounded-2xl p-6 font-body text-lg text-charcoal-soft leading-loose focus:outline-none focus:ring-4 transition-all resize-none shadow-sm ${consistencyIssues.length > 0
                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                                    : 'border-peach-soft focus:border-coral-burst focus:ring-coral-burst/10'
                                }`}
                            value={activePage.text}
                            onChange={(e) => handleTextChange(e.target.value)}
                            placeholder="Once upon a time..."
                        />

                        {/* Deep Quality: Real-time Consistency Warning */}
                        {consistencyIssues.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 animate-fadeIn">
                                <div className="flex items-center gap-2 text-red-700 font-bold text-xs mb-1">
                                    <AlertCircle className="w-4 h-4" />
                                    Consistency Issue Detected
                                </div>
                                <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                                    {consistencyIssues.map((issue, i) => (
                                        <li key={i}>{issue.description}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Learning Content Display */}
                        {activePage.learningContent && (
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200 mt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🎓</span>
                                    <h4 className="font-heading font-bold text-sm text-emerald-900 uppercase">Learning Content</h4>
                                    {activePage.learningContent.topic && (
                                        <span className="ml-auto px-2 py-1 bg-emerald-200 text-emerald-800 text-xs rounded-full font-medium">
                                            {activePage.learningContent.topic}
                                        </span>
                                    )}
                                </div>

                                {activePage.learningContent.mentorDialogue && (
                                    <div className="bg-white rounded-xl p-4 mb-3 border border-emerald-100">
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl">🦉</span>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-700 mb-1">Mentor Says:</p>
                                                <p className="text-sm text-charcoal-soft italic">"{activePage.learningContent.mentorDialogue}"</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePage.learningContent.quiz && (
                                    <div className="bg-white rounded-xl p-4 border border-emerald-100">
                                        <p className="text-xs font-bold text-emerald-700 mb-2">📝 Quiz Question:</p>
                                        <p className="text-sm text-charcoal-soft font-medium mb-3">{activePage.learningContent.quiz.question}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {activePage.learningContent.quiz.options?.map((option: string, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className={`px-3 py-2 rounded-lg text-xs font-medium ${option === activePage.learningContent?.quiz?.correctAnswer
                                                        ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                                        : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    {option} {option === activePage.learningContent?.quiz?.correctAnswer && '✓'}
                                                </div>
                                            ))}
                                        </div>
                                        {activePage.learningContent.quiz.explanation && (
                                            <p className="mt-3 text-xs text-emerald-600 italic">
                                                💡 {activePage.learningContent.quiz.explanation}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Feature #3: Real-Time Suggestions */}
                        {suggestions.length > 0 && (
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-4 h-4 text-blue-600" />
                                    <h4 className="font-heading font-bold text-xs text-blue-900 uppercase">Writing Suggestions</h4>
                                </div>
                                <div className="space-y-2">
                                    {suggestions.map((sug, i) => (
                                        <div key={i} className="bg-white rounded-lg p-3 text-xs">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-charcoal-soft capitalize">{sug.type}</span>
                                                <button
                                                    onClick={() => applySuggestion(sug)}
                                                    className="text-blue-600 hover:underline font-bold"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                            <p className="text-cocoa-light mb-1"><span className="line-through">{sug.original}</span> → <span className="text-green-600 font-medium">{sug.suggestion}</span></p>
                                            <p className="text-cocoa-light/70 italic">{sug.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isLoadingSuggestions && (
                            <div className="flex items-center gap-2 text-xs text-cocoa-light">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Analyzing your writing...
                            </div>
                        )}
                    </div>

                    {/* Feature #2: Character Consistency Panel */}
                    {showConsistencyPanel && consistencyReport && (
                        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-heading font-bold text-sm text-purple-900">Character Consistency Report</h3>
                                </div>
                                <button onClick={() => setShowConsistencyPanel(false)} className="text-purple-600 hover:text-purple-800">
                                    ×
                                </button>
                            </div>
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-heading font-bold text-2xl text-purple-900">{consistencyReport.overallScore}</span>
                                    <span className="text-xs text-purple-700">/100 Consistency Score</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {consistencyReport.characters.map((char: any, i: number) => (
                                    <div key={i} className="bg-white rounded-xl p-4">
                                        <h4 className="font-heading font-bold text-sm text-charcoal-soft mb-2">{char.name}</h4>
                                        {char.inconsistencies.length > 0 ? (
                                            <div className="space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                                    <div className="text-xs">
                                                        <p className="font-bold text-orange-900 mb-1">Issues Found:</p>
                                                        <ul className="list-disc list-inside text-cocoa-light space-y-1">
                                                            {char.inconsistencies.map((inc: string, j: number) => (
                                                                <li key={j}>{inc}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                                {char.suggestions.length > 0 && (
                                                    <div className="flex items-start gap-2">
                                                        <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                                        <div className="text-xs">
                                                            <p className="font-bold text-blue-900 mb-1">Suggestions:</p>
                                                            <ul className="list-disc list-inside text-cocoa-light space-y-1">
                                                                {char.suggestions.map((sug: string, j: number) => (
                                                                    <li key={j}>{sug}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-green-700">
                                                <CheckCircle2 className="w-4 h-4" />
                                                No inconsistencies found!
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CYOA Choices */}
                    {project.isBranching && activePage.choices && (
                        <div className="bg-white rounded-2xl p-6 border border-peach-soft/50 shadow-soft-sm">
                            <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider mb-4 flex items-center gap-2">
                                <GitFork className="w-4 h-4 text-gold-sunshine" /> Branching Choices
                            </label>
                            <div className="space-y-3">
                                {activePage.choices.map((choice, i) => (
                                    <button
                                        key={i}
                                        onClick={() => jumpToPageNumber(choice.targetPageNumber)}
                                        className="w-full flex items-center justify-between bg-cream-base p-4 rounded-xl border border-peach-soft/30 hover:bg-peach-soft hover:border-coral-burst transition-all group text-left"
                                    >
                                        <span className="text-charcoal-soft font-medium text-sm flex-1 mr-3 group-hover:text-charcoal-soft/90 transition-colors">
                                            {choice.text}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-coral-burst bg-coral-burst/10 px-2 py-1 rounded-lg whitespace-nowrap group-hover:bg-coral-burst group-hover:text-white transition-colors">
                                                Go to pg {choice.targetPageNumber}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-coral-burst opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Image Prompt */}
                    <div className="bg-cream-base rounded-2xl p-6 border border-peach-soft/50">
                        <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider mb-2 block">Visual Description</label>
                        <p className="text-sm text-charcoal-soft/80 leading-relaxed italic">
                            "{activePage.imagePrompt}"
                        </p>
                    </div>

                </div>

                {/* Bottom Navigation Strip */}
                <div className="h-24 bg-white border-t border-peach-soft/50 flex items-center gap-3 px-6 overflow-x-auto pb-2 pt-2 shrink-0">
                    {allPages.map((p, idx) => (
                        <button
                            key={p.id}
                            onClick={() => setActivePageIndex(idx)}
                            className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-heading font-bold text-lg transition-all
                        ${activePageIndex === idx
                                    ? 'bg-coral-burst text-white shadow-lg scale-110'
                                    : 'bg-cream-base text-cocoa-light hover:bg-peach-soft'
                                }`}
                        >
                            {p.pageNumber}
                            {p.choices && p.choices.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-gold-sunshine mt-1" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className={`w-full lg:w-[60%] bg-peach-soft/20 items-center justify-center p-4 lg:p-8 pt-12 lg:pt-16 relative overflow-hidden ${mobileView === 'edit' ? 'hidden lg:flex' : 'flex h-full'}`}>
                <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "radial-gradient(#FF9B71 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

                {/* Book Page Container */}
                <div className="w-full max-w-md md:max-w-2xl aspect-[3/4] bg-[#FFFCF8] shadow-2xl rounded-[4px] relative flex flex-col overflow-hidden transform transition-transform duration-500 hover:scale-[1.01]">

                    {/* Texture Overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] opacity-40 mix-blend-multiply pointer-events-none z-10"></div>

                    {/* Illustration */}
                    <div className="relative h-[55%] w-full bg-gray-100 overflow-hidden group">
                        {activePage.imageUrl ? (
                            <>
                                <img src={activePage.imageUrl} className={`w-full h-full object-cover transition-all ${activePage.isImageOutdated ? 'opacity-60' : ''}`} alt="Scene" />
                                {/* Text-to-Visual Ripple: Outdated Image Warning */}
                                {activePage.isImageOutdated && (
                                    <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                                        <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-4 text-center shadow-lg">
                                            <RefreshCw className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                                            <p className="text-sm font-bold text-orange-700">Image may be outdated</p>
                                            <p className="text-xs text-orange-600 mb-3">Your text has changed significantly</p>
                                            <button
                                                onClick={() => {
                                                    handleGenerateImage();
                                                    // Clear the outdated flag
                                                    setProjectHistory(prev => {
                                                        const newProject = JSON.parse(JSON.stringify(prev)) as BookProject;
                                                        newProject.chapters.forEach(ch => {
                                                            const page = ch.pages.find(p => p.pageNumber === activePage.pageNumber);
                                                            if (page) page.isImageOutdated = false;
                                                        });
                                                        return newProject;
                                                    });
                                                }}
                                                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors"
                                            >
                                                Regenerate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-cream-base/50 text-cocoa-light gap-4">
                                <ImageIcon className="w-12 h-12 opacity-20" />
                                <button
                                    onClick={handleGenerateImage}
                                    className="px-6 py-3 rounded-full bg-white shadow-soft-md text-coral-burst font-heading font-bold text-sm hover:shadow-soft-lg hover:scale-105 transition-all flex items-center gap-2 z-20"
                                >
                                    {isGeneratingImage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand className="w-4 h-4" />}
                                    Generate Illustration
                                </button>
                            </div>
                        )}
                        {/* Gradient overlay for text readability if needed */}
                        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#FFFCF8] to-transparent opacity-50"></div>
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 p-6 md:p-12 relative z-20 flex flex-col overflow-y-auto">
                        <p className="font-heading text-xl md:text-2xl lg:text-3xl text-charcoal-soft leading-normal mb-auto">
                            {activePage.text}
                        </p>

                        {/* Interactive Buttons in Preview */}
                        {project.isBranching && activePage.choices && (
                            <div className="mt-8 space-y-3">
                                {activePage.choices.map((choice, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => jumpToPageNumber(choice.targetPageNumber)}
                                        className="w-full py-3 px-6 rounded-xl border-2 border-charcoal-soft/10 bg-white hover:bg-coral-burst hover:border-coral-burst hover:text-white text-charcoal-soft font-heading font-bold text-sm transition-all flex justify-between items-center group shadow-sm"
                                    >
                                        {choice.text}
                                        <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <span className="font-heading font-bold text-cocoa-light/30 text-sm tracking-widest">- {activePage.pageNumber} -</span>
                        </div>
                    </div>
                </div>

                {/* Floating Action Bar */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full shadow-soft-lg px-6 py-3 flex items-center gap-6 border border-white z-30">
                    <button
                        onClick={() => setActivePageIndex(Math.max(0, activePageIndex - 1))}
                        className="p-2 hover:bg-cream-base rounded-full text-charcoal-soft transition-colors"
                        aria-label="Previous page"
                        title="Previous page"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-heading font-bold text-charcoal-soft text-sm whitespace-nowrap">Preview Mode</span>
                    <button
                        onClick={() => setActivePageIndex(Math.min(totalPages - 1, activePageIndex + 1))}
                        className="p-2 hover:bg-cream-base rounded-full text-charcoal-soft transition-colors"
                        aria-label="Next page"
                        title="Next page"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

            </div>

            {/* Green Room Modal */}
            {showGreenRoom && selectedCharacterForInterview && (
                <GreenRoom
                    isOpen={showGreenRoom}
                    onClose={() => {
                        setShowGreenRoom(false);
                        setSelectedCharacterForInterview(null);
                    }}
                    project={currentProject}
                    character={selectedCharacterForInterview}
                    onPersonaUpdate={(persona: CharacterPersona) => {
                        // Update character with extracted facts
                        const updatedCharacters = currentProject.characters.map(c =>
                            c.id === selectedCharacterForInterview.id
                                ? {
                                    ...c,
                                    personalityTraits: [...(c.personalityTraits || []), ...persona.personality],
                                    backstory: persona.background || c.backstory
                                }
                                : c
                        );
                        setProjectHistory(prev => ({
                            ...prev,
                            characters: updatedCharacters
                        }));
                    }}
                    userId={userProfile?.id}
                />
            )}

            {/* Remix Studio Modal */}
            <RemixStudio
                isOpen={showRemixStudio}
                onClose={() => setShowRemixStudio(false)}
                userId={userProfile?.id}
                userName={userProfile?.display_name || userProfile?.email}
                currentProject={currentProject}
                onForkWorld={(world) => {
                    // Handle forked world - could create a new project based on it
                    console.log('Forked world:', world);
                    setShowRemixStudio(false);
                }}
            />
        </div >
    );
};

export default SmartEditor;
