import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArtStyle, BookProject, VisualSettings, Character } from '../types';
import {
    Wand2,
    Users,
    Camera,
    Palette,
    Sparkles,
    Download,
    RefreshCw,
    Sliders,
    Sun,
    Move,
    Lightbulb,
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Maximize2,
    Minimize2,
    X,
    LogOut,
    Share2,
    Trophy,
    Zap,
    MessageCircle,
    Activity,
    GitFork,
    Eye,
    Radio,
    Video,
    GitBranch,
    Bell,
    BarChart2,
    History
} from 'lucide-react';
import { generateRefinedImage } from '../services/geminiService';
import MessagesWidget from './MessagesWidget';
import ChatWidget from './ChatWidget';
import ChatPanel from './ChatPanel';
import MobileBottomNav from './MobileBottomNav';
import { UserProfile } from '../services/profileService';
import {
    ReactionBar,
    PresenceIndicator,
    ActivityFeed,
    SharedVisualCard,
    ChallengeCard,
    NotificationCenter,
    BroadcastStudio,
    InsightsDashboard,
    FamilyTreeViewer
} from './collaboration';
import { collaborationService } from '../services/collaborationService';
import { chatService } from '../services/chatService';
import type {
    SharedVisual,
    PresenceUser,
    Activity as ActivityType,
    Challenge,
    Reaction,
    ReactionType
} from '../types/collaboration';
import type { VisualVersion } from '../types/advanced';

interface VisualStudioProps {
    project: BookProject | null;
    onBack?: () => void;
    userProfile: UserProfile | null;
}

interface Collaborator {
    id: string;
    name: string;
    avatar: string;
    status: 'idle' | 'typing' | 'generating' | 'done';
    image?: string;
    prompt?: string;
    likes?: number;
    likedByUser?: boolean;
}

// View tabs for collaborative mode
type CollabView = 'gallery' | 'activity' | 'challenges' | 'broadcast' | 'insights';

const VisualStudio: React.FC<VisualStudioProps> = ({ project, onBack, userProfile }) => {
    const [activeTab, setActiveTab] = useState<'character' | 'scene' | 'style'>('character');
    const [isGenerating, setIsGenerating] = useState(false);

    // Collaboration state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [collabView, setCollabView] = useState<CollabView>('gallery');
    const [sharedVisuals, setSharedVisuals] = useState<SharedVisual[]>([]);
    const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
    const [activities, setActivities] = useState<ActivityType[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [selectedVisual, setSelectedVisual] = useState<SharedVisual | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareCaption, setShareCaption] = useState('');
    const [shareVisibility, setShareVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
    const channelRef = useRef<ReturnType<typeof collaborationService.subscribeToSession> | null>(null);

    // Advanced features state
    const [showBroadcastStudio, setShowBroadcastStudio] = useState(false);
    const [showInsightsDashboard, setShowInsightsDashboard] = useState(false);
    const [showFamilyTree, setShowFamilyTree] = useState(false);
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [selectedVisualForHistory, setSelectedVisualForHistory] = useState<string | null>(null);
    const notificationBtnRef = useRef<HTMLButtonElement>(null);

    // Real-time connection status
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef<number>(0);
    const MAX_RECONNECT_ATTEMPTS = 5;
    const defaultCharacters: Character[] = [
        // === FANTASY & MYTHOLOGY ===
        {
            id: 'f1',
            name: 'Luna the Moon Fairy',
            description: 'A graceful fairy who tends to moonflowers and grants wishes to kind-hearted children.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=c0aede',
            visualTraits: 'Translucent wings, silver hair, glowing aura, wearing a dress made of flower petals',
            traits: ['magical', 'gentle', 'wise']
        },
        {
            id: 'f2',
            name: 'Blaze the Dragon',
            description: 'A friendly young dragon learning to control his fire breath while making friends.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Blaze&backgroundColor=ffdfbf',
            visualTraits: 'Red and orange scales, small wings, big curious eyes, puffs of smoke from nostrils',
            traits: ['playful', 'clumsy', 'brave']
        },
        {
            id: 'f3',
            name: 'Princess Aurora',
            description: 'A brave princess who prefers adventures over balls, skilled with a sword.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aurora&backgroundColor=ffd5dc',
            visualTraits: 'Golden crown, flowing purple gown, determined expression, carrying a small sword',
            traits: ['courageous', 'kind', 'adventurous']
        },
        {
            id: 'f4',
            name: 'Merlin the Wizard',
            description: 'An ancient wizard with knowledge of all magical arts and a fondness for riddles.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Merlin&backgroundColor=d1d4f9',
            visualTraits: 'Long white beard, pointed hat with stars, blue robes, holding a magical staff',
            traits: ['mysterious', 'wise', 'playful']
        },
        {
            id: 'f5',
            name: 'Elara the Elf',
            description: 'A woodland elf who protects the ancient forest and speaks to animals.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elara&backgroundColor=c1e1c1',
            visualTraits: 'Pointed ears, green tunic, bow and arrows, leafy crown, graceful movements',
            traits: ['nature-loving', 'agile', 'protective']
        },
        {
            id: 'f6',
            name: 'Captain Silverhook',
            description: 'A reformed pirate who now searches for treasure to give to orphanages.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Silverhook&backgroundColor=b4d7e8',
            visualTraits: 'Tricorn hat, eye patch, silver hook hand, weathered coat, friendly smile',
            traits: ['reformed', 'generous', 'adventurous']
        },
        {
            id: 'f7',
            name: 'Stella Starweaver',
            description: 'A young witch learning spells at the Academy of Magical Arts.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Stella&backgroundColor=e0b0ff',
            visualTraits: 'Purple witch hat, star-patterned robes, wand with sparkles, black cat companion',
            traits: ['studious', 'mischievous', 'talented']
        },
        {
            id: 'f8',
            name: 'Sir Gallant the Knight',
            description: 'A noble knight sworn to protect the realm and help those in need.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gallant&backgroundColor=c0c0c0',
            visualTraits: 'Shining armor, red cape, sword and shield, noble steed nearby',
            traits: ['honorable', 'brave', 'loyal']
        },
        // === ANIMALS & NATURE ===
        {
            id: 'a1',
            name: 'Oliver the Owl',
            description: 'A wise old owl who runs the forest library and loves sharing stories.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver&backgroundColor=d2b48c',
            visualTraits: 'Big round glasses, brown feathers, holding a book, perched on a branch',
            traits: ['wise', 'patient', 'scholarly']
        },
        {
            id: 'a2',
            name: 'Ruby the Fox',
            description: 'A clever and curious fox who loves solving mysteries in the meadow.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby&backgroundColor=ff8c00',
            visualTraits: 'Orange fur with white chest, bushy tail, bright curious eyes, detective hat',
            traits: ['clever', 'curious', 'quick']
        },
        {
            id: 'a3',
            name: 'Max the Bear Cub',
            description: 'A fluffy bear cub learning about the forest from his grandmother.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MaxBear&backgroundColor=8b4513',
            visualTraits: 'Brown fluffy fur, small round ears, holding honey pot, innocent expression',
            traits: ['curious', 'hungry', 'cuddly']
        },
        {
            id: 'a4',
            name: 'Coral the Mermaid',
            description: 'A young mermaid who dreams of exploring the world above the waves.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Coral&backgroundColor=40e0d0',
            visualTraits: 'Colorful fish tail, seashell accessories, flowing underwater hair, pearl necklace',
            traits: ['dreamy', 'curious', 'musical']
        },
        {
            id: 'a5',
            name: 'Tilly the Turtle',
            description: 'An ancient sea turtle who has traveled all the oceans and shares her wisdom.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tilly&backgroundColor=2e8b57',
            visualTraits: 'Old wise eyes, patterned shell, gentle smile, swimming through coral',
            traits: ['patient', 'wise', 'traveled']
        },
        {
            id: 'a6',
            name: 'Pip the Penguin',
            description: 'A young penguin who dreams of flying and tries creative ways to soar.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pip&backgroundColor=87ceeb',
            visualTraits: 'Black and white feathers, orange beak, tiny wings spread wide, hopeful eyes',
            traits: ['determined', 'creative', 'optimistic']
        },
        {
            id: 'a7',
            name: 'Honey the Bee',
            description: 'A hardworking bee who teaches others about teamwork and the importance of nature.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Honey&backgroundColor=ffd700',
            visualTraits: 'Yellow and black stripes, translucent wings, carrying pollen, buzzing happily',
            traits: ['hardworking', 'friendly', 'industrious']
        },
        {
            id: 'a8',
            name: 'Leo the Lion Cub',
            description: 'The young prince of the savanna learning to be a fair and kind leader.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LeoLion&backgroundColor=daa520',
            visualTraits: 'Golden fur, small mane beginning to grow, playful stance, crown of flowers',
            traits: ['playful', 'learning', 'noble']
        },
        // === EVERYDAY HEROES ===
        {
            id: 'h1',
            name: 'Dr. Maya Chen',
            description: 'A kind pediatrician who makes hospital visits fun for kids.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DrMaya&backgroundColor=e6f2ff',
            visualTraits: 'White coat, stethoscope, warm smile, colorful bandages, teddy bear in pocket',
            traits: ['caring', 'gentle', 'professional']
        },
        {
            id: 'h2',
            name: 'Firefighter Sam',
            description: 'A brave firefighter who rescues people and teaches fire safety.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=FireSam&backgroundColor=ff6b6b',
            visualTraits: 'Yellow helmet, fireproof jacket, holding a hose, dalmatian dog companion',
            traits: ['brave', 'strong', 'helpful']
        },
        {
            id: 'h3',
            name: 'Chef Rosa',
            description: 'A passionate chef who creates magical dishes that bring people together.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChefRosa&backgroundColor=fff0f5',
            visualTraits: 'Chef hat, apron with stains, wooden spoon, surrounded by delicious food',
            traits: ['creative', 'warm', 'talented']
        },
        {
            id: 'h4',
            name: 'Officer Jordan',
            description: 'A community police officer who helps neighbors and organizes local events.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=OfficerJ&backgroundColor=4169e1',
            visualTraits: 'Blue uniform, friendly badge, bicycle, waving to neighbors',
            traits: ['friendly', 'helpful', 'fair']
        },
        {
            id: 'h5',
            name: 'Teacher Ms. Kim',
            description: 'An inspiring teacher who makes learning an adventure for her students.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MsKim&backgroundColor=98fb98',
            visualTraits: 'Colorful cardigan, glasses, holding books, classroom behind her',
            traits: ['inspiring', 'patient', 'creative']
        },
        {
            id: 'h6',
            name: 'Astronaut Alex',
            description: 'A space explorer who discovers new planets and tells stories from the stars.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AstroAlex&backgroundColor=191970',
            visualTraits: 'White spacesuit, helmet under arm, floating in zero gravity, Earth visible behind',
            traits: ['adventurous', 'scientific', 'brave']
        },
        {
            id: 'h7',
            name: 'Vet Dr. Patel',
            description: 'A caring veterinarian who heals animals and teaches kids to care for pets.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DrPatel&backgroundColor=dda0dd',
            visualTraits: 'Green scrubs, stethoscope, holding a kitten, surrounded by animals',
            traits: ['gentle', 'caring', 'knowledgeable']
        },
        {
            id: 'h8',
            name: 'Builder Bob',
            description: 'A skilled builder who constructs homes and teaches kids about construction.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BuilderBob&backgroundColor=f4a460',
            visualTraits: 'Hard hat, tool belt, blueprints, building a treehouse',
            traits: ['skilled', 'patient', 'creative']
        },
        // === KIDS & ADVENTURES ===
        {
            id: 'k1',
            name: 'Zara the Explorer',
            description: 'A young adventurer who discovers hidden treasures in her backyard.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ZaraExp&backgroundColor=87ceeb',
            visualTraits: 'Explorer hat, backpack, magnifying glass, muddy boots, excited expression',
            traits: ['curious', 'brave', 'imaginative']
        },
        {
            id: 'k2',
            name: 'Marcus the Inventor',
            description: 'A young genius who builds gadgets from recycled materials.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=add8e6',
            visualTraits: 'Safety goggles, messy hair, holding tools, surrounded by inventions',
            traits: ['inventive', 'clever', 'resourceful']
        },
        {
            id: 'k3',
            name: 'Sophie the Artist',
            description: 'A creative girl who sees art in everything and paints the world brighter.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie&backgroundColor=ffc0cb',
            visualTraits: 'Paint-stained clothes, beret, holding paintbrush, rainbow palette',
            traits: ['creative', 'colorful', 'expressive']
        },
        {
            id: 'k4',
            name: 'Tyler the Athlete',
            description: 'A sporty kid who believes in teamwork and fair play.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tyler&backgroundColor=90ee90',
            visualTraits: 'Sports jersey, sneakers, holding a soccer ball, determined expression',
            traits: ['athletic', 'team-player', 'energetic']
        },
        {
            id: 'k5',
            name: 'Lily the Bookworm',
            description: 'A quiet girl who travels to magical worlds through the pages of books.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily&backgroundColor=dda0dd',
            visualTraits: 'Round glasses, cozy sweater, stack of books, reading in a treehouse',
            traits: ['imaginative', 'thoughtful', 'curious']
        },
        {
            id: 'k6',
            name: 'Danny the Drummer',
            description: 'A musical boy who finds rhythm in everything and starts a neighborhood band.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Danny&backgroundColor=ffa07a',
            visualTraits: 'Headphones around neck, drumsticks in hand, tapping on everything',
            traits: ['musical', 'energetic', 'rhythmic']
        },
        {
            id: 'k7',
            name: 'Emma the Gardener',
            description: 'A nature-loving girl who grows magical plants in her secret garden.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma&backgroundColor=98fb98',
            visualTraits: 'Sun hat, gardening gloves, watering can, surrounded by colorful flowers',
            traits: ['nurturing', 'patient', 'green-thumbed']
        },
        {
            id: 'k8',
            name: 'Jake the Skateboarder',
            description: 'A cool kid who does tricks at the skate park and helps beginners learn.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jake&backgroundColor=dda0dd',
            visualTraits: 'Helmet, knee pads, skateboard, mid-trick pose, confident smile',
            traits: ['cool', 'helpful', 'daring']
        },
        // === SCIENTISTS & INVENTORS (Historical) ===
        {
            id: 'c1',
            name: 'Ada Lovelace',
            description: 'The first computer programmer, known for her work on Charles Babbage\'s proposed mechanical general-purpose computer, the Analytical Engine.',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada_Lovelace_portrait.jpg/417px-Ada_Lovelace_portrait.jpg',
            visualTraits: 'Victorian era dress, dark hair in buns, poised and intellectual expression',
            traits: ['intellectual', 'visionary', 'pioneer']
        },
        {
            id: 'c2',
            name: 'Albert Einstein',
            description: 'Theoretical physicist who developed the theory of relativity, one of the two pillars of modern physics.',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Einstein_1921_by_F_Schmutzer_-_restoration.jpg/330px-Einstein_1921_by_F_Schmutzer_-_restoration.jpg',
            visualTraits: 'Wild white hair, mustache, thoughtful expression, suit and tie',
            traits: ['genius', 'eccentric', 'peaceful']
        },
        {
            id: 'c3',
            name: 'Marie Curie',
            description: 'Physicist and chemist who conducted pioneering research on radioactivity.',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Marie_Curie_c._1920s.jpg/330px-Marie_Curie_c._1920s.jpg',
            visualTraits: 'Simple black dress, messy hair from lab work, holding a test tube',
            traits: ['determined', 'brilliant', 'selfless']
        },
        {
            id: 'c4',
            name: 'Nikola Tesla',
            description: 'Inventor, electrical engineer, mechanical engineer, and futurist.',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/N.Tesla.JPG/330px-N.Tesla.JPG',
            visualTraits: 'Sharp suit, mustache, intense gaze, surrounded by electrical sparks',
            traits: ['futuristic', 'eccentric', 'inventive']
        },
        {
            id: 'c5',
            name: 'Leonardo da Vinci',
            description: 'Polymath of the High Renaissance who was active as a painter, draughtsman, engineer, scientist, theorist, sculptor, and architect.',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Leonardo_da_Vinci_-_presumed_self-portrait_-_WGA12798.jpg/330px-Leonardo_da_Vinci_-_presumed_self-portrait_-_WGA12798.jpg',
            visualTraits: 'Long beard, long hair, renaissance artist cap, holding a sketchbook',
            traits: ['creative', 'inventive', 'visionary']
        },
        // === CULTURAL HEROES ===
        {
            id: 'cu1',
            name: 'Anansi the Spider',
            description: 'The clever trickster from West African folklore who uses wit to outsmart stronger foes.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anansi&backgroundColor=8b4513',
            visualTraits: 'Spider form with human features, wearing traditional kente cloth patterns',
            traits: ['clever', 'mischievous', 'wise']
        },
        {
            id: 'cu2',
            name: 'Mulan the Warrior',
            description: 'A brave young woman who disguises herself as a soldier to protect her family.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mulan&backgroundColor=dc143c',
            visualTraits: 'Warrior armor, sword, determined expression, hair tied back',
            traits: ['brave', 'loyal', 'determined']
        },
        {
            id: 'cu3',
            name: 'Krishna the Divine Child',
            description: 'The playful divine child known for his mischief and wisdom.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Krishna&backgroundColor=4169e1',
            visualTraits: 'Blue skin, peacock feather crown, flute in hand, playful smile',
            traits: ['playful', 'wise', 'divine']
        },
        {
            id: 'cu4',
            name: 'Amaterasu the Sun Goddess',
            description: 'The radiant goddess of the sun who brings light and warmth to the world.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amaterasu&backgroundColor=ffd700',
            visualTraits: 'Flowing white robes, golden crown, radiant light surrounding her',
            traits: ['radiant', 'benevolent', 'powerful']
        },
        {
            id: 'cu5',
            name: 'Coyote the Trickster',
            description: 'The clever trickster from Native American stories who teaches through mistakes.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Coyote&backgroundColor=d2b48c',
            visualTraits: 'Coyote form, mischievous eyes, desert background, holding stolen fire',
            traits: ['tricky', 'teaching', 'clever']
        },
        // === ROBOTS & FUTURISTIC ===
        {
            id: 'r1',
            name: 'BOLT the Helper Robot',
            description: 'A friendly robot assistant who learns about human emotions and friendship.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BOLT&backgroundColor=c0c0c0',
            visualTraits: 'Shiny metal body, LED screen face with expressions, wheels, extendable arms',
            traits: ['helpful', 'learning', 'loyal']
        },
        {
            id: 'r2',
            name: 'Nova the Space Girl',
            description: 'A girl from the year 3000 who travels through time to learn about history.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nova&backgroundColor=9370db',
            visualTraits: 'Futuristic jumpsuit, holographic gadgets, hover boots, time watch',
            traits: ['curious', 'tech-savvy', 'adventurous']
        },
        {
            id: 'r3',
            name: 'Circuit the AI',
            description: 'An artificial intelligence learning what it means to be creative and kind.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Circuit&backgroundColor=00ffff',
            visualTraits: 'Holographic form, digital patterns, floating in cyberspace, friendly glow',
            traits: ['logical', 'curious', 'evolving']
        },
        {
            id: 'r4',
            name: 'Cosmo the Space Dog',
            description: 'A super-intelligent dog with a spacesuit who explores the galaxy.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cosmo&backgroundColor=191970',
            visualTraits: 'Small spacesuit, helmet with visor, floating in space, wagging tail',
            traits: ['loyal', 'brave', 'intelligent']
        },
        // === MAGICAL CREATURES ===
        {
            id: 'm1',
            name: 'Phoenix Flame',
            description: 'A majestic firebird who teaches about renewal and second chances.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Phoenix&backgroundColor=ff4500',
            visualTraits: 'Fiery feathers of red and gold, trailing flames, glowing eyes, powerful wings',
            traits: ['renewal', 'powerful', 'wise']
        },
        {
            id: 'm2',
            name: 'Frost the Ice Sprite',
            description: 'A mischievous ice sprite who paints frost patterns on windows.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Frost&backgroundColor=e0ffff',
            visualTraits: 'Crystalline body, icy blue glow, snowflake patterns, playful expression',
            traits: ['playful', 'artistic', 'cold']
        },
        {
            id: 'm3',
            name: 'Mossy the Forest Guardian',
            description: 'An ancient tree spirit who protects the oldest trees in the forest.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mossy&backgroundColor=228b22',
            visualTraits: 'Tree bark skin, moss hair, glowing green eyes, leaves growing from body',
            traits: ['ancient', 'protective', 'wise']
        },
        {
            id: 'm4',
            name: 'Shimmer the Unicorn',
            description: 'A magical unicorn whose horn grants wishes to those with pure hearts.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Shimmer&backgroundColor=fff0f5',
            visualTraits: 'White coat with rainbow mane, spiral horn, sparkling hooves, gentle eyes',
            traits: ['magical', 'pure', 'gentle']
        },
        {
            id: 'm5',
            name: 'Shadow the Night Cat',
            description: 'A mysterious cat who guides lost travelers through the darkness.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Shadow&backgroundColor=2f4f4f',
            visualTraits: 'Pure black fur, glowing yellow eyes, stars in fur, silent movement',
            traits: ['mysterious', 'helpful', 'silent']
        },
        {
            id: 'm6',
            name: 'Bubbles the Water Spirit',
            description: 'A playful water spirit who creates fountains and helps drought-stricken lands.',
            imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bubbles&backgroundColor=00bfff',
            visualTraits: 'Transparent blue form, made of flowing water, fish swimming inside, joyful',
            traits: ['playful', 'life-giving', 'fluid']
        }
    ];

    // Use project characters if available, otherwise use defaults
    const availableCharacters = (project?.characters && project.characters.length > 0)
        ? project.characters
        : defaultCharacters;

    // Mobile state
    const [mobileActiveTab, setMobileActiveTab] = useState<'character' | 'scene' | 'style' | 'chat'>('character');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // View Mode State
    const [viewMode, setViewMode] = useState<'individual' | 'collaborative'>('individual');

    // Collaborative Mode State (Synced with viewMode)
    const [isCollaborativeMode, setIsCollaborativeMode] = useState(false);
    const [isMenuExpanded, setIsMenuExpanded] = useState(false);
    const [expandedVisual, setExpandedVisual] = useState<Collaborator | 'current' | null>(null);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([
        { id: 'u1', name: 'Sarah Art', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', status: 'idle', likes: 0, likedByUser: false },
        { id: 'u2', name: 'Alex Dev', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', status: 'idle', likes: 0, likedByUser: false },
        { id: 'u3', name: 'Maya Writer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya', status: 'idle', likes: 0, likedByUser: false },
        { id: 'u4', name: 'Jordan', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan', status: 'idle', likes: 0, likedByUser: false }
    ]);

    // Sync isCollaborativeMode with viewMode
    useEffect(() => {
        setIsCollaborativeMode(viewMode === 'collaborative');
    }, [viewMode]);

    const [settings, setSettings] = useState<VisualSettings>({
        activeTab: 'character',
        selectedCharacterId: availableCharacters[0]?.id || null,
        expression: 'Neutral',
        pose: 'Standing',
        costume: 'Default Outfit',
        lighting: 'Natural Daylight',
        cameraAngle: 'Eye Level',
        styleA: project?.style || ArtStyle.PIXAR_3D,
        styleB: ArtStyle.WATERCOLOR,
        mixRatio: 50,
        prompt: 'A quiet morning in the village.',
        generatedImage: null
    });

    const styles = Object.values(ArtStyle);

    // Presets
    const lightingGroups = {
        'Natural': ['Natural Daylight', 'Golden Hour', 'Soft Candlelight', 'Ethereal Moonlight', 'Overcast Sky'],
        'Cinematic': ['Cinematic Noir', 'Teal & Orange', 'Rembrandt', 'Dramatic Shadows', 'God Rays'],
        'Artificial': ['Neon Cyberpunk', 'Studio High-Key', 'Bioluminescent', 'Hard Flash', 'Stage Lighting'],
        'Artistic': ['Volumetric Fog', 'Silhouette', 'Dreamy Haze', 'Double Exposure']
    };

    const cameraOptions = ['Eye Level', 'Bird\'s Eye View', 'Worm\'s Eye View', 'Dutch Angle', 'Macro Close-up', 'Wide Angle', 'Over-the-shoulder'];
    const expressions = ['Neutral', 'Happy', 'Sad', 'Angry', 'Surprised', 'Determined', 'Fearful', 'Mischievous'];
    const poses = ['Standing', 'Sitting', 'Running', 'Jumping', 'Thinking', 'Fighting Stance', 'Dancing', 'Floating'];

    // ─────────────────────────────────────────────────────────────────────────
    // COLLABORATION EFFECTS - Production-Ready Real-time
    // ─────────────────────────────────────────────────────────────────────────

    // Initialize collaboration session when entering collaborative mode
    useEffect(() => {
        if (isCollaborativeMode && userProfile) {
            setConnectionStatus('connecting');
            reconnectAttemptsRef.current = 0;
            initializeCollabSession();
        }

        return () => {
            // Cleanup on unmount or mode change
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (channelRef.current && sessionId) {
                collaborationService.unsubscribeFromSession(sessionId);
                channelRef.current = null;
            }
            setConnectionStatus('disconnected');
        };
    }, [isCollaborativeMode, userProfile?.id]);

    // Fetch shared visuals and challenges when session changes
    useEffect(() => {
        if (sessionId && connectionStatus === 'connected') {
            loadSharedVisuals();
            loadChallenges();
            loadActivities();
        }
    }, [sessionId, connectionStatus]);

    // Periodic refresh for live data (every 30 seconds)
    useEffect(() => {
        if (!sessionId || !isCollaborativeMode || connectionStatus !== 'connected') return;

        const interval = setInterval(() => {
            loadSharedVisuals();
            loadChallenges();
        }, 30000);

        return () => clearInterval(interval);
    }, [sessionId, isCollaborativeMode, connectionStatus]);

    // Update user presence status when generating
    useEffect(() => {
        if (sessionId && userProfile && connectionStatus === 'connected') {
            collaborationService.updateStatus(isGenerating ? 'generating' : 'idle');
        }
    }, [isGenerating, sessionId, userProfile?.id, connectionStatus]);

    const initializeCollabSession = async () => {
        if (!userProfile) return;

        try {
            setConnectionStatus('connecting');
            // Use project ID or create a default session
            const projectSessionId = project?.id || 'visual-studio-global';
            setSessionId(projectSessionId);

            // Join the session first
            await collaborationService.joinSession(projectSessionId);

            // Subscribe to real-time updates
            const channel = collaborationService.subscribeToSession(projectSessionId, {
                onVisualAdded: (visual: SharedVisual) => {
                    setSharedVisuals(prev => {
                        // Avoid duplicates
                        if (prev.some(v => v.id === visual.id)) return prev;
                        return [visual, ...prev];
                    });
                    // Show toast for new visuals from others
                    if (visual.user_id !== userProfile.id) {
                        showToast(`🎨 ${visual.user?.full_name || 'Someone'} shared a new creation!`);
                    }
                },
                onVisualUpdated: (visual) => {
                    setSharedVisuals(prev => prev.map(v => v.id === visual.id ? visual : v));
                },
                onReactionAdded: (reaction) => {
                    setSharedVisuals(prev => prev.map(v => {
                        if (v.id === reaction.visual_id) {
                            const existingReactions = v.reactions || [];
                            // Avoid duplicate reactions
                            if (existingReactions.some(r => r.id === reaction.id)) return v;
                            return { ...v, reactions: [...existingReactions, reaction] };
                        }
                        return v;
                    }));
                },
                onReactionRemoved: (reaction) => {
                    setSharedVisuals(prev => prev.map(v => {
                        if (v.id === reaction.visual_id) {
                            return {
                                ...v,
                                reactions: (v.reactions || []).filter(r => r.id !== reaction.id)
                            };
                        }
                        return v;
                    }));
                },
                onActivityAdded: (activity) => {
                    setActivities(prev => {
                        // Avoid duplicates
                        if (prev.some(a => a.id === activity.id)) return prev;
                        return [activity, ...prev].slice(0, 50);
                    });
                },
                onPresenceChange: (users) => {
                    setPresenceUsers(users);
                },
                onTyping: (userId, isTyping) => {
                    // Update presence with typing status
                    setPresenceUsers(prev => prev.map(u =>
                        u.user_id === userId
                            ? { ...u, status: isTyping ? 'typing' : 'idle' }
                            : u
                    ));
                }
            });

            channelRef.current = channel;

            // Mark as connected successfully
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
            showToast('✅ Connected to collaboration studio!');

            // Send join event to chat
            try {
                await chatService.sendVisualStudioEvent(
                    'vs-activity',
                    'user_joined',
                    { userName: userProfile?.full_name || userProfile?.email || 'Someone' }
                );
            } catch (chatError) {
                console.warn('Failed to send chat join event:', chatError);
            }
        } catch (error) {
            console.error('Failed to initialize collaboration session:', error);
            setConnectionStatus('disconnected');
            handleReconnect();
        }
    };

    const loadSharedVisuals = async () => {
        if (!sessionId) return;
        setIsLoadingData(true);
        try {
            const result = await collaborationService.getSharedVisuals({ sessionId });
            setSharedVisuals(result.data);
        } catch (error) {
            console.error('Error loading shared visuals:', error);
            showToast('⚠️ Failed to load gallery. Pull to refresh.');
        } finally {
            setIsLoadingData(false);
        }
    };

    const loadActivities = async () => {
        if (!sessionId) return;
        try {
            const result = await collaborationService.getActivities({
                scope: 'session',
                sessionId,
                limit: 50
            });
            setActivities(result);
        } catch (error) {
            console.error('Error loading activities:', error);
        }
    };

    const loadChallenges = async () => {
        try {
            const activeChallenges = await collaborationService.getActiveChallenges();
            setChallenges(activeChallenges);
        } catch (error) {
            console.error('Error loading challenges:', error);
        }
    };

    // Manual refresh function for gallery
    const handleRefreshGallery = async () => {
        if (connectionStatus === 'error') {
            // Reset reconnection attempts and try again
            reconnectAttemptsRef.current = 0;
            await initializeCollabSession();
        } else {
            showToast('🔄 Refreshing...');
            await Promise.all([
                loadSharedVisuals(),
                loadActivities(),
                loadChallenges()
            ]);
            showToast('✅ Gallery updated!');
        }
    };

    // Reconnect handler with exponential backoff
    const handleReconnect = () => {
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus('error');
            showToast('❌ Unable to reconnect. Please refresh the page.');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;

        setConnectionStatus('connecting');
        showToast(`🔄 Reconnecting... (Attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            initializeCollabSession();
        }, delay);
    };

    // Share current visual to the gallery
    const handleShareVisual = async () => {
        if (!settings.generatedImage) {
            showToast('❌ No image to share. Generate an image first!');
            return;
        }

        try {
            // Share to the gallery - session_id is optional
            const result = await collaborationService.shareVisual({
                session_id: sessionId || undefined, // Make session optional
                image_url: settings.generatedImage,
                prompt: shareCaption || settings.prompt || 'A creative visual',
                visibility: shareVisibility,
                settings: {
                    styleA: settings.styleA,
                    styleB: settings.styleB,
                    mixRatio: settings.mixRatio,
                    lighting: settings.lighting,
                    cameraAngle: settings.cameraAngle,
                    expression: settings.expression,
                    pose: settings.pose,
                    costume: settings.costume,
                    characterId: settings.selectedCharacterId || undefined,
                    characterName: availableCharacters.find(c => c.id === settings.selectedCharacterId)?.name
                }
            });

            if (result.success && result.data) {
                setSharedVisuals(prev => [result.data!, ...prev]);
                setShowShareModal(false);
                setShareCaption('');

                // Send event to global chat room
                try {
                    const globalRoom = await chatService.getGlobalRoom();
                    if (globalRoom) {
                        await chatService.shareVisualToChat(
                            globalRoom.id,
                            settings.generatedImage,
                            shareCaption || settings.prompt
                        );
                    }
                } catch (chatError) {
                    // Don't fail the share if chat notification fails
                    console.warn('Failed to send chat event:', chatError);
                }

                // Show success toast
                showToast('🎨 Visual shared with the community!');
            } else {
                showToast('❌ Failed to share: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to share visual:', error);
            showToast('❌ Failed to share visual. Please try again.');
        }
    };

    // Handle remixing a visual
    const handleRemixVisual = async (visual: SharedVisual) => {
        // Load the original settings into the editor
        if (visual.settings) {
            setSettings(prev => ({
                ...prev,
                prompt: visual.prompt || prev.prompt,
                styleA: (visual.settings?.styleA as ArtStyle) || prev.styleA,
                styleB: (visual.settings?.styleB as ArtStyle) || prev.styleB,
                mixRatio: visual.settings?.mixRatio ?? prev.mixRatio,
                lighting: visual.settings?.lighting || prev.lighting,
                cameraAngle: visual.settings?.cameraAngle || prev.cameraAngle,
                expression: visual.settings?.expression || prev.expression,
                pose: visual.settings?.pose || prev.pose,
                costume: visual.settings?.costume || prev.costume
            }));
        }

        // Switch to individual mode to edit
        setViewMode('individual');
        showToast(`🔄 Remixing ${visual.user?.display_name || visual.user?.full_name || 'Anonymous'}'s creation!`);
    };

    // Handle reactions on visuals
    const handleReaction = async (visualId: string, reactionType: ReactionType) => {
        await collaborationService.addReaction(visualId, reactionType);
    };

    const handleRemoveReaction = async (visualId: string, reactionType: ReactionType) => {
        await collaborationService.removeReaction(visualId, reactionType);
    };

    // Simple toast notification
    const showToast = (message: string) => {
        const toast = document.createElement('div');
        toast.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-full shadow-lg z-[100] animate-bounce font-heading font-bold text-lg';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 3000);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GENERATION HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    const handleGenerate = async () => {
        setIsGenerating(true);

        let promptToUse = settings.prompt;
        let charDesc = "";

        // Add character context if available
        if (activeTab === 'character' && settings.selectedCharacterId) {
            const char = availableCharacters.find(c => c.id === settings.selectedCharacterId);
            if (char) {
                const visualDescription = char.visualTraits || (char as any).visualPrompt || '';
                charDesc = `${char.name}: ${char.description}. Visual traits: ${visualDescription}. Wearing ${settings.costume}. Expression: ${settings.expression}. Pose: ${settings.pose}.`;
                promptToUse = `Full body character design sheet of ${char.name}`;
            }
        } else if (activeTab === 'scene') {
            promptToUse = settings.prompt;
        } else {
            // Style alchemy uses the prompt directly
        }

        try {
            const result = await generateRefinedImage(promptToUse, {
                styleA: activeTab === 'style' ? settings.styleA : (project?.style || settings.styleA),
                styleB: activeTab === 'style' ? settings.styleB : undefined,
                mixRatio: activeTab === 'style' ? settings.mixRatio : undefined,
                lighting: settings.lighting,
                camera: settings.cameraAngle,
                characterDescription: charDesc
            });
            setSettings({ ...settings, generatedImage: result });
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveAsset = () => {
        if (!settings.generatedImage) return;

        // Create a temporary link element to trigger download
        const link = document.createElement('a');
        link.href = settings.generatedImage;

        // Generate filename based on active tab and timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const tabName = activeTab === 'character' ? 'character' : activeTab === 'scene' ? 'scene' : 'style-mix';
        link.download = `genesis-${tabName}-${timestamp}.png`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCollaborationStart = () => {
        setViewMode('collaborative');
        setIsMenuExpanded(true);

        // Simulate other users starting to work
        setTimeout(() => {
            setCollaborators(prev => prev.map(c => ({ ...c, status: 'typing' })));
        }, 2000);

        setTimeout(() => {
            setCollaborators(prev => prev.map((c, i) => i % 2 === 0 ? { ...c, status: 'generating' } : c));
        }, 5000);

        setTimeout(() => {
            setCollaborators(prev => prev.map((c, i) => i % 2 === 0 ? {
                ...c,
                status: 'done',
                image: `https://picsum.photos/seed/${c.id}/800/800`
            } : { ...c, status: 'generating' }));
        }, 10000);

        setTimeout(() => {
            setCollaborators(prev => prev.map(c => c.status === 'generating' ? {
                ...c,
                status: 'done',
                image: `https://picsum.photos/seed/${c.id}/800/800`
            } : c));
        }, 15000);
    };

    const handleExitCollaboration = () => {
        setViewMode('individual');
        setCollaborators(prev => prev.map(c => ({ ...c, status: 'idle', image: undefined })));
        setExpandedVisual(null);
    };

    const handleCollaborativeTrigger = () => {
        // Activate collaborative mode
        handleCollaborationStart();

        // Show "Yay let's do it!" confirmation
        const toast = document.createElement('div');
        toast.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-full shadow-lg z-[100] animate-bounce font-heading font-bold text-lg';
        toast.textContent = '🎉 Yay let\'s do it!';
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 3000);
    };

    // Handle liking a collaborator's image
    const handleLike = (userId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening the expanded view
        setCollaborators(prev => prev.map(user => {
            if (user.id === userId) {
                const isLiked = user.likedByUser;
                return {
                    ...user,
                    likes: (user.likes || 0) + (isLiked ? -1 : 1),
                    likedByUser: !isLiked
                };
            }
            return user;
        }));
    };

    // Mobile tab handler
    const handleMobileTabChange = (tab: 'character' | 'scene' | 'style' | 'chat') => {
        setMobileActiveTab(tab);
        if (tab === 'chat') {
            setIsChatOpen(true);
        } else {
            setIsChatOpen(false);
            setActiveTab(tab as 'character' | 'scene' | 'style');
        }
    };

    return (
        <div className={`w-full mx-auto animate-fadeIn ${isCollaborativeMode ? 'h-screen h-[100dvh] flex flex-col overflow-hidden' : 'max-w-[1800px] p-3 md:p-6 pb-20 md:pb-24'}`}>

            {/* Header with Mode Switcher */}
            <div className={`relative text-center mb-4 md:mb-6 flex-shrink-0 ${isCollaborativeMode ? 'px-2 sm:px-4 md:px-8 pt-2 md:pt-4' : 'px-10 sm:px-12 md:px-20'}`}>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-cream-soft text-cocoa-light hover:text-coral-burst transition-colors z-10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                )}

                {/* Right Side Actions - Notifications, Go Live, Insights */}
                <div className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    {/* Notification Bell Button */}
                    <button
                        ref={notificationBtnRef}
                        onClick={() => userProfile && setShowNotificationCenter(!showNotificationCenter)}
                        className={`relative p-2 rounded-xl transition-all shadow-sm border border-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center ${userProfile ? 'bg-white/80 hover:bg-white text-gray-600 hover:text-coral-burst' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                        title={userProfile ? "Notifications" : "Login to access notifications"}
                    >
                        <Bell className="w-4 h-4 md:w-5 md:h-5" />
                    </button>

                    {/* Go Live Button - Only in collaborative mode, hide on very small screens */}
                    {viewMode === 'collaborative' && (
                        <button
                            onClick={() => userProfile && setShowBroadcastStudio(true)}
                            className={`hidden xs:flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-xl font-bold text-xs md:text-sm transition-transform shadow-lg min-h-[44px] ${userProfile ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                            disabled={!userProfile}
                        >
                            <Radio className="w-4 h-4 animate-pulse" />
                            <span className="hidden sm:inline">Live</span>
                        </button>
                    )}

                    {/* Creative Insights Button - Only in collaborative mode, hide on very small screens */}
                    {viewMode === 'collaborative' && (
                        <button
                            onClick={() => userProfile && setShowInsightsDashboard(true)}
                            className={`hidden xs:flex p-2 rounded-xl transition-transform shadow-lg min-h-[44px] min-w-[44px] items-center justify-center ${userProfile ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                            title={userProfile ? "Creative Insights" : "Login to view insights"}
                            disabled={!userProfile}
                        >
                            <BarChart2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    )}
                </div>

                {/* Mode Switcher - Mobile optimized */}
                <div className="inline-flex bg-cream-soft p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-peach-soft/50 shadow-sm">
                    <button
                        onClick={() => setViewMode('individual')}
                        className={`px-3 sm:px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center gap-1.5 md:gap-2 transition-all min-h-[40px] ${viewMode === 'individual'
                            ? 'bg-white text-coral-burst shadow-sm'
                            : 'text-cocoa-light hover:text-charcoal-soft'
                            }`}
                    >
                        <Wand2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden xs:inline">Individual</span>
                        <span className="xs:hidden">Solo</span>
                    </button>
                    <button
                        onClick={() => setViewMode('collaborative')}
                        className={`px-3 sm:px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center gap-1.5 md:gap-2 transition-all min-h-[40px] ${viewMode === 'collaborative'
                            ? 'bg-white text-purple-500 shadow-sm'
                            : 'text-cocoa-light hover:text-charcoal-soft'
                            }`}
                    >
                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden xs:inline">Collaborative</span>
                        <span className="xs:hidden">Collab</span>
                        {/* Connection Status Indicator */}
                        {viewMode === 'collaborative' && (
                            <span
                                className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                                    connectionStatus === 'connecting' ? 'bg-yellow-400 animate-ping' :
                                        connectionStatus === 'error' ? 'bg-red-500' :
                                            'bg-gray-400'
                                    }`}
                                title={connectionStatus === 'connected' ? 'Live - Real-time sync active' :
                                    connectionStatus === 'connecting' ? 'Connecting...' :
                                        connectionStatus === 'error' ? 'Connection failed - Click to retry' :
                                            'Disconnected'}
                            />
                        )}
                    </button>
                </div>

                <p className="text-cocoa-light font-body text-xs sm:text-sm mt-2 md:mt-3 px-2 line-clamp-2">
                    {viewMode === 'individual'
                        ? 'Fine-tune characters, compose scenes, and experiment with style alchemy.'
                        : (
                            <>
                                <span className="hidden sm:inline">Explore community creations, join challenges, and remix visuals.</span>
                                <span className="sm:hidden">Explore & remix community art.</span>
                                {connectionStatus === 'connected' && (
                                    <span className="ml-2 text-green-600 font-semibold">
                                        🟢 Live
                                    </span>
                                )}
                                {connectionStatus === 'connecting' && (
                                    <span className="ml-2 text-yellow-600 font-semibold animate-pulse">
                                        ⏳ Connecting...
                                    </span>
                                )}
                                {connectionStatus === 'error' && (
                                    <button
                                        onClick={initializeCollabSession}
                                        className="ml-2 text-red-600 font-semibold hover:underline"
                                    >
                                        ⚠️ Connection lost - Click to retry
                                    </button>
                                )}
                            </>
                        )}
                </p>
            </div>

            <div className={`flex flex-col-reverse lg:flex-row gap-4 md:gap-6 ${isCollaborativeMode ? 'flex-1 overflow-hidden' : 'min-h-[600px] h-[calc(100vh-140px)]'}`}>

                {/* Control Panel / Vertical Menu - Only visible in Individual Mode */}
                {viewMode === 'individual' && (
                    <div
                        className={`
                        bg-white rounded-3xl shadow-soft-lg border border-white overflow-y-auto transition-all duration-500 ease-in-out z-20
                        w-full lg:w-1/3 p-4 md:p-6 h-full
                    `}
                    >
                        {/* Selected Character Image Display */}
                        {activeTab === 'character' && settings.selectedCharacterId && (
                            <div className="flex justify-center mb-6 animate-fadeIn">
                                {(() => {
                                    const char = availableCharacters.find(c => c.id === settings.selectedCharacterId);
                                    if (char && char.imageUrl) {
                                        return (
                                            <div className="relative group">
                                                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                                                    <img
                                                        src={char.imageUrl}
                                                        alt={char.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-coral-burst text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                                                    {char.name}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex bg-cream-soft p-1.5 rounded-2xl mb-6 md:mb-8 border border-peach-soft/50">
                            {['character', 'scene', 'style'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab as any);
                                        setSettings({ ...settings, generatedImage: null });
                                    }}
                                    className={`flex-1 py-2 md:py-2.5 rounded-xl font-heading font-bold text-xs md:text-sm capitalize transition-all
                            ${activeTab === tab ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light hover:text-charcoal-soft'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content: Character */}
                        {activeTab === 'character' && (
                            <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Character
                                    </label>
                                    <select
                                        value={settings.selectedCharacterId || ''}
                                        onChange={(e) => setSettings({ ...settings, selectedCharacterId: e.target.value })}
                                        className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none"
                                        title="Select character"
                                        aria-label="Character"
                                    >
                                        {availableCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {/* Show character description */}
                                    {settings.selectedCharacterId && (
                                        <div className="p-3 bg-cream-base/50 rounded-xl text-xs text-cocoa-light">
                                            {availableCharacters.find(c => c.id === settings.selectedCharacterId)?.description || 'Select a character to see details'}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Expression</label>
                                        <select
                                            value={settings.expression}
                                            onChange={(e) => setSettings({ ...settings, expression: e.target.value })}
                                            className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm"
                                            title="Select expression"
                                            aria-label="Expression"
                                        >
                                            {expressions.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-cocoa-light uppercase">Pose</label>
                                        <select
                                            value={settings.pose}
                                            onChange={(e) => setSettings({ ...settings, pose: e.target.value })}
                                            className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm"
                                            title="Select pose"
                                            aria-label="Pose"
                                        >
                                            {poses.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase">Costume Details</label>
                                    <input
                                        type="text"
                                        value={settings.costume}
                                        onChange={(e) => setSettings({ ...settings, costume: e.target.value })}
                                        className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none"
                                        placeholder="e.g. Red superhero cape"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Scene */}
                        {activeTab === 'scene' && (
                            <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" /> Lighting Style
                                    </label>
                                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                                        <select
                                            value={settings.lighting}
                                            onChange={(e) => setSettings({ ...settings, lighting: e.target.value })}
                                            className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm font-body"
                                            title="Select lighting style"
                                            aria-label="Lighting style"
                                        >
                                            {Object.entries(lightingGroups).map(([group, options]) => (
                                                <optgroup key={group} label={group}>
                                                    {options.map(l => <option key={l} value={l}>{l}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                                <Camera className="w-4 h-4" /> Camera Angle
                                            </label>
                                            <select
                                                value={settings.cameraAngle}
                                                onChange={(e) => setSettings({ ...settings, cameraAngle: e.target.value })}
                                                className="w-full bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 text-xs md:text-sm"
                                                title="Select camera angle"
                                                aria-label="Camera angle"
                                            >
                                                {cameraOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase">Scene Description</label>
                                    <textarea
                                        value={settings.prompt}
                                        onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
                                        className="w-full h-24 md:h-32 bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none resize-none"
                                        placeholder="Describe the setting, props, and atmosphere..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Style Alchemy */}
                        {activeTab === 'style' && (
                            <div className="space-y-4 md:space-y-6 animate-fadeIn">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase flex items-center gap-2">
                                        <Palette className="w-4 h-4" /> Style Alchemy
                                    </label>
                                    <div className="bg-cream-base border border-peach-soft rounded-2xl p-3 md:p-4 space-y-3 md:space-y-4">
                                        <div>
                                            <div className="text-xs text-cocoa-light mb-1">Primary Style ({(settings.mixRatio)}%)</div>
                                            <select
                                                value={settings.styleA}
                                                onChange={(e) => setSettings({ ...settings, styleA: e.target.value as ArtStyle })}
                                                className="w-full bg-white border border-peach-soft rounded-xl p-2 text-xs md:text-sm"
                                                title="Select primary style"
                                                aria-label="Primary style"
                                            >
                                                {styles.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Sliders className="text-coral-burst w-4 h-4" />
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={settings.mixRatio}
                                                onChange={(e) => setSettings({ ...settings, mixRatio: parseInt(e.target.value) })}
                                                title={`Mix ratio: ${settings.mixRatio}%`}
                                                aria-label="Style mix ratio"
                                                className="w-full accent-coral-burst h-1.5 bg-peach-soft rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>

                                        <div>
                                            <div className="text-xs text-cocoa-light mb-1">Secondary Style ({100 - settings.mixRatio}%)</div>
                                            <select
                                                value={settings.styleB}
                                                onChange={(e) => setSettings({ ...settings, styleB: e.target.value as ArtStyle })}
                                                className="w-full bg-white border border-peach-soft rounded-xl p-2 text-xs md:text-sm"
                                                title="Select secondary style"
                                                aria-label="Secondary style"
                                            >
                                                {styles.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-cocoa-light uppercase">Test Prompt</label>
                                    <textarea
                                        value={settings.prompt}
                                        onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
                                        className="w-full h-20 md:h-24 bg-cream-base border border-peach-soft rounded-xl p-2.5 md:p-3 font-body text-sm md:text-base text-charcoal-soft focus:border-coral-burst outline-none resize-none"
                                        placeholder="A landscape with a castle..."
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full mt-4 py-3 md:py-4 rounded-xl font-heading font-bold text-sm md:text-base text-white shadow-lg transition-all flex items-center justify-center gap-2
                        ${isGenerating ? 'bg-cocoa-light cursor-not-allowed' : 'bg-gradient-to-r from-coral-burst to-gold-sunshine hover:scale-[1.02]'}`}
                        >
                            {isGenerating ? <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Wand2 className="w-4 h-4 md:w-5 md:h-5" />}
                            {activeTab === 'character' ? 'Generate' : activeTab === 'scene' ? 'Render' : 'Mix'}
                        </button>
                    </div>
                )}

                {/* Preview Area / Collaborative Grid */}
                <div className={`
                    rounded-3xl overflow-hidden relative
                    ${isCollaborativeMode
                        ? 'flex-1 bg-white border-4 border-gray-200 shadow-2xl flex flex-col'
                        : 'w-full lg:w-2/3 bg-cream-base border-2 border-dashed border-peach-soft flex items-center justify-center group h-full min-h-[400px] md:min-h-[500px]'}
                `}>
                    {isCollaborativeMode ? (
                        <div className="w-full h-full flex flex-col overflow-hidden">
                            {/* Collaborative Box Header with Presence - Mobile Optimized */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0 gap-2 sm:gap-0">
                                {/* Top Row - Title, Presence, Refresh */}
                                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
                                    <h2 className="font-heading font-bold text-sm sm:text-base md:text-xl text-charcoal-soft flex items-center gap-1.5 sm:gap-2">
                                        <Users className="w-4 h-4 md:w-5 md:h-5 text-coral-burst" />
                                        <span className="hidden sm:inline">Creative Hub</span>
                                        <span className="sm:hidden">Hub</span>
                                    </h2>

                                    {/* Presence Indicator - Compact on mobile */}
                                    <div className="hidden xs:block">
                                        <PresenceIndicator
                                            users={presenceUsers}
                                            maxVisible={3}
                                            showStatus={false}
                                        />
                                    </div>

                                    {/* Mobile-only presence count */}
                                    <div className="xs:hidden flex items-center gap-1 text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full">
                                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                        {presenceUsers.length}
                                    </div>

                                    {/* Desktop Presence */}
                                    <div className="hidden sm:block">
                                        <PresenceIndicator
                                            users={presenceUsers}
                                            maxVisible={5}
                                            showStatus={true}
                                        />
                                    </div>

                                    {/* Mobile Refresh Button */}
                                    <button
                                        onClick={handleRefreshGallery}
                                        disabled={isLoadingData}
                                        className={`sm:hidden p-2 rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${connectionStatus === 'error'
                                            ? 'bg-red-100 text-red-600'
                                            : 'bg-white/80 text-gray-500'
                                            }`}
                                        title={connectionStatus === 'error' ? 'Click to reconnect' : 'Refresh gallery'}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>

                                {/* View Tabs - Desktop (hidden on mobile, shown in floating bar) */}
                                <div className="hidden sm:flex items-center gap-1 bg-white/80 p-1 rounded-xl overflow-x-auto scrollbar-hide">
                                    <button
                                        onClick={() => setCollabView('gallery')}
                                        className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap min-h-[36px] ${collabView === 'gallery'
                                            ? 'bg-coral-burst text-white'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Gallery</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('activity')}
                                        className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap min-h-[36px] ${collabView === 'activity'
                                            ? 'bg-purple-500 text-white'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Activity className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Activity</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('challenges')}
                                        className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap min-h-[36px] ${collabView === 'challenges'
                                            ? 'bg-gold-sunshine text-white'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Trophy className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Challenges</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('broadcast')}
                                        className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap min-h-[36px] ${collabView === 'broadcast'
                                            ? 'bg-red-500 text-white'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Radio className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Live</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('insights')}
                                        className={`px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 whitespace-nowrap min-h-[36px] ${collabView === 'insights'
                                            ? 'bg-indigo-500 text-white'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        <BarChart2 className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Insights</span>
                                    </button>

                                    {/* Refresh Button - Desktop */}
                                    <button
                                        onClick={handleRefreshGallery}
                                        disabled={isLoadingData}
                                        className={`ml-1 px-2 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 md:gap-1.5 min-h-[36px] ${connectionStatus === 'error'
                                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                        title={connectionStatus === 'error' ? 'Click to reconnect' : 'Refresh gallery'}
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>

                                {/* Mobile Floating Tab Bar - Positioned above bottom nav */}
                                <div className="sm:hidden collab-mobile-tabs">
                                    <button
                                        onClick={() => setCollabView('gallery')}
                                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-h-[44px] ${collabView === 'gallery'
                                            ? 'bg-coral-burst text-white shadow-md'
                                            : 'text-gray-500 active:bg-gray-100'
                                            }`}
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span className="text-[9px] font-bold">Gallery</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('activity')}
                                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-h-[44px] ${collabView === 'activity'
                                            ? 'bg-purple-500 text-white shadow-md'
                                            : 'text-gray-500 active:bg-gray-100'
                                            }`}
                                    >
                                        <Activity className="w-4 h-4" />
                                        <span className="text-[9px] font-bold">Activity</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('challenges')}
                                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-h-[44px] ${collabView === 'challenges'
                                            ? 'bg-gold-sunshine text-white shadow-md'
                                            : 'text-gray-500 active:bg-gray-100'
                                            }`}
                                    >
                                        <Trophy className="w-4 h-4" />
                                        <span className="text-[9px] font-bold">Challenges</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('broadcast')}
                                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-h-[44px] ${collabView === 'broadcast'
                                            ? 'bg-red-500 text-white shadow-md'
                                            : 'text-gray-500 active:bg-gray-100'
                                            }`}
                                    >
                                        <Radio className="w-4 h-4" />
                                        <span className="text-[9px] font-bold">Live</span>
                                    </button>
                                    <button
                                        onClick={() => setCollabView('insights')}
                                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-lg transition-all min-h-[44px] ${collabView === 'insights'
                                            ? 'bg-indigo-500 text-white shadow-md'
                                            : 'text-gray-500 active:bg-gray-100'
                                            }`}
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        <span className="text-[9px] font-bold">Insights</span>
                                    </button>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 flex flex-col overflow-hidden relative">
                                {/* Gallery View */}
                                {collabView === 'gallery' && (
                                    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-y-auto scroll-container">
                                        {/* Content Grid */}
                                        <div className="p-2 sm:p-3 md:p-6">
                                        {/* Mobile: Extra padding for floating tabs and bottom nav */}
                                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-6 pb-4">
                                            {/* Current User Creation Card */}
                                            <div
                                                className="bg-white rounded-xl sm:rounded-2xl shadow-md p-2 md:p-3 flex flex-col h-[240px] xs:h-[260px] sm:h-[320px] md:h-[380px] lg:h-[420px] relative overflow-hidden border-2 border-coral-burst/50 hover:shadow-xl transition-all group"
                                            >
                                                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-coral-burst flex items-center justify-center text-white font-bold text-[9px] sm:text-[10px] md:text-xs">YOU</div>
                                                        <span className="font-bold text-[10px] sm:text-xs md:text-sm text-charcoal-soft">Your Canvas</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {settings.generatedImage && (
                                                            <>
                                                                {/* Version History Button */}
                                                                <button
                                                                    onClick={() => {
                                                                        // Use session ID or a placeholder for current user's visual history
                                                                        if (sessionId) {
                                                                            setSelectedVisualForHistory(sessionId);
                                                                            setShowFamilyTree(true);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 active:scale-95 transition-all min-h-[32px] min-w-[32px] flex items-center justify-center"
                                                                    title="Version History"
                                                                >
                                                                    <History className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowShareModal(true)}
                                                                    className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-[10px] sm:text-xs font-bold hover:scale-105 active:scale-95 transition-transform min-h-[28px]"
                                                                >
                                                                    <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                                    <span className="hidden xs:inline">Share</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div
                                                    className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden relative cursor-pointer"
                                                    onClick={() => settings.generatedImage && setExpandedVisual('current')}
                                                >
                                                    {settings.generatedImage ? (
                                                        <>
                                                            <img src={settings.generatedImage} alt="Your work" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-center p-4">
                                                            {isGenerating ? (
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <Loader2 className="w-6 h-6 md:w-8 md:h-8 text-coral-burst animate-spin" />
                                                                    <span className="text-xs text-coral-burst animate-pulse">Creating magic...</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <Wand2 className="w-8 h-8 text-gray-300" />
                                                                    <span className="text-gray-400 text-xs md:text-sm">Generate something amazing!</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {isGenerating && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                                                        <div className="h-full bg-gradient-to-r from-coral-burst to-gold-sunshine animate-pulse" style={{ width: '60%' }} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Shared Visuals from Community */}
                                            {isLoadingData && sharedVisuals.length === 0 && (
                                                // Loading skeleton placeholders
                                                Array.from({ length: 6 }).map((_, idx) => (
                                                    <div key={`skeleton-${idx}`} className="bg-white rounded-2xl shadow-md p-2 md:p-3 flex flex-col h-[280px] sm:h-[320px] md:h-[380px] lg:h-[420px] animate-pulse">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-200" />
                                                            <div className="h-3 w-20 bg-gray-200 rounded" />
                                                        </div>
                                                        <div className="flex-1 bg-gray-100 rounded-xl" />
                                                        <div className="flex gap-2 mt-2">
                                                            <div className="h-6 w-16 bg-gray-200 rounded-full" />
                                                            <div className="h-6 w-16 bg-gray-200 rounded-full" />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            {sharedVisuals.map(visual => (
                                                <SharedVisualCard
                                                    key={visual.id}
                                                    visual={visual}
                                                    onRemix={() => handleRemixVisual(visual)}
                                                    onExpand={() => setSelectedVisual(visual)}
                                                    onViewLineage={() => {
                                                        setSelectedVisualForHistory(visual.id);
                                                        setShowFamilyTree(true);
                                                    }}
                                                />
                                            ))}

                                            {/* Legacy Collaborator Slots (for demo/fallback) */}
                                            {sharedVisuals.length === 0 && collaborators.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="bg-white rounded-2xl shadow-md p-2 md:p-3 flex flex-col h-[280px] sm:h-[320px] md:h-[380px] lg:h-[420px] relative overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                                                    onClick={() => user.status === 'done' && user.image && setExpandedVisual(user)}
                                                >
                                                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                                                        <img src={user.avatar} alt={user.name} className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-200" />
                                                        <span className="font-bold text-xs md:text-sm text-charcoal-soft truncate">{user.name}</span>
                                                        {user.status === 'typing' && <span className="text-[10px] md:text-xs text-gray-400 animate-pulse ml-auto">Typing...</span>}
                                                        {user.status === 'generating' && <span className="text-[10px] md:text-xs text-purple-500 animate-pulse ml-auto">Gen...</span>}
                                                    </div>
                                                    <div className="flex-1 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden relative">
                                                        {user.status === 'done' && user.image ? (
                                                            <img src={user.image} alt={`${user.name}'s work`} className="w-full h-full object-cover animate-fadeIn transition-transform duration-500 group-hover:scale-105" />
                                                        ) : (
                                                            <div className="text-center p-2 md:p-4">
                                                                {user.status === 'generating' ? (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-purple-500 animate-spin" />
                                                                        <span className="text-[10px] md:text-xs text-purple-500">Creating...</span>
                                                                    </div>
                                                                ) : user.status === 'typing' ? (
                                                                    <div className="flex gap-1">
                                                                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                                                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                                                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300 text-xs md:text-sm">Waiting...</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Like Button */}
                                                    {user.status === 'done' && user.image && (
                                                        <div className="absolute bottom-2 right-2 z-10">
                                                            <button
                                                                onClick={(e) => handleLike(user.id, e)}
                                                                className={`flex items-center gap-1 px-2 py-1 rounded-full shadow-md transition-all ${user.likedByUser
                                                                    ? 'bg-red-500 text-white'
                                                                    : 'bg-white text-gray-600 hover:bg-red-50'
                                                                    }`}
                                                            >
                                                                <span className="text-sm">{user.likedByUser ? '❤️' : '🤍'}</span>
                                                                {(user.likes || 0) > 0 && (
                                                                    <span className="text-xs font-bold">{user.likes}</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        </div>
                                        
                                        {/* Collaboration Illustration - Scrolls with content, touches bottom */}
                                        <div className="w-full flex-shrink-0">
                                            <img 
                                                src="/assets/mascots/8k_3d_pixar_202512022106.jpeg"
                                                alt="Collaborate in Real-Time"
                                                className="w-full h-auto object-cover object-center"
                                                style={{
                                                    display: 'block'
                                                }}
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Activity View */}
                                {collabView === 'activity' && (
                                    <div className="flex-1 overflow-hidden">
                                        <ActivityFeed
                                            sessionId={sessionId || undefined}
                                            scope="session"
                                        />
                                    </div>
                                )}

                                {/* Challenges View */}
                                {collabView === 'challenges' && (
                                    <div className="flex-1 p-2 sm:p-4 md:p-6 bg-gradient-to-br from-amber-50 to-orange-50 overflow-y-auto scroll-container pb-36 sm:pb-24">
                                        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                                            <div className="text-center mb-4 md:mb-8">
                                                <h3 className="font-heading font-bold text-lg sm:text-xl md:text-2xl text-charcoal-soft mb-1 md:mb-2">
                                                    🏆 Daily Challenges
                                                </h3>
                                                <p className="text-cocoa-light text-xs sm:text-sm md:text-base">
                                                    Compete, create, and climb the leaderboard!
                                                </p>
                                            </div>

                                            {challenges.length > 0 ? (
                                                <div className="grid gap-3 md:gap-6">
                                                    {challenges.map(challenge => (
                                                        <ChallengeCard
                                                            key={challenge.id}
                                                            challenge={challenge}
                                                            onJoin={() => {
                                                                if (settings.generatedImage) {
                                                                    showToast('📸 Opening submission...');
                                                                } else {
                                                                    showToast('Generate an image first!');
                                                                }
                                                            }}
                                                            onViewDetails={() => {
                                                                // View challenge details
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 md:py-12">
                                                    <Trophy className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-3 md:mb-4" />
                                                    <p className="text-gray-500 font-bold text-sm md:text-base">No active challenges</p>
                                                    <p className="text-gray-400 text-sm mt-2">Check back soon for new creative challenges!</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Broadcast View */}
                                {collabView === 'broadcast' && userProfile && (
                                    <div className="flex-1 overflow-hidden">
                                        <BroadcastStudio
                                            onClose={() => setCollabView('gallery')}
                                        />
                                    </div>
                                )}

                                {/* Insights View */}
                                {collabView === 'insights' && userProfile && (
                                    <div className="flex-1 overflow-hidden">
                                        <InsightsDashboard
                                            userId={userProfile.id}
                                            isOpen={true}
                                            onClose={() => setCollabView('gallery')}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Share Modal - Mobile Optimized */}
                            {showShareModal && settings.generatedImage && (
                                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                                    <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 animate-fadeIn max-h-[90vh] overflow-y-auto" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                                            <h3 className="font-heading font-bold text-lg sm:text-xl text-charcoal-soft flex items-center gap-2">
                                                <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-coral-burst" />
                                                Share Creation
                                            </h3>
                                            <button
                                                onClick={() => setShowShareModal(false)}
                                                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                title="Close"
                                                aria-label="Close share modal"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Preview */}
                                        <div className="rounded-xl overflow-hidden mb-3 sm:mb-4 bg-gray-100">
                                            <img
                                                src={settings.generatedImage}
                                                alt="Preview"
                                                className="w-full h-36 sm:h-48 object-cover"
                                            />
                                        </div>

                                        {/* Caption */}
                                        <div className="mb-3 sm:mb-4">
                                            <label className="text-xs font-bold text-cocoa-light uppercase mb-2 block">Caption</label>
                                            <textarea
                                                value={shareCaption}
                                                onChange={(e) => setShareCaption(e.target.value)}
                                                placeholder="Add a caption to your creation..."
                                                className="w-full h-16 sm:h-20 bg-cream-base border border-peach-soft rounded-xl p-3 text-sm resize-none focus:border-coral-burst outline-none"
                                                style={{ fontSize: '16px' }} /* Prevent iOS zoom */
                                            />
                                        </div>

                                        {/* Visibility */}
                                        <div className="mb-4 sm:mb-6">
                                            <label className="text-xs font-bold text-cocoa-light uppercase mb-2 block">Visibility</label>
                                            <div className="flex gap-2">
                                                {(['public', 'unlisted', 'private'] as const).map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => setShareVisibility(v)}
                                                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all ${shareVisibility === v
                                                            ? 'bg-coral-burst text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Share Button */}
                                        <button
                                            onClick={handleShareVisual}
                                            className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 min-h-[48px]"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Share with Community
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Expanded Visual Modal - Mobile Optimized */}
                            {expandedVisual && (
                                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col animate-fadeIn p-2 sm:p-4 md:p-6 rounded-2xl sm:rounded-3xl">
                                    <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setExpandedVisual(null)}
                                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2 rounded-full bg-white shadow-md border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-all mr-1 sm:mr-2 group z-50 min-h-[40px]"
                                                title="Go Back"
                                            >
                                                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-charcoal-soft group-hover:-translate-x-1 transition-transform" />
                                                <span className="font-bold text-charcoal-soft text-xs md:text-sm hidden xs:inline">Back</span>
                                            </button>
                                            {expandedVisual === 'current' ? (
                                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-coral-burst flex items-center justify-center text-white font-bold text-[10px] sm:text-xs md:text-base">YOU</div>
                                            ) : (
                                                <img src={expandedVisual.avatar} alt="User" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full" />
                                            )}
                                            <div>
                                                <h3 className="font-heading font-bold text-sm sm:text-base md:text-xl text-charcoal-soft line-clamp-1">
                                                    {expandedVisual === 'current' ? 'Your Creation' : `${expandedVisual.name}'s Creation`}
                                                </h3>
                                                <p className="text-[10px] sm:text-xs md:text-sm text-cocoa-light">Full View</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setExpandedVisual(null)}
                                            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                                            title="Close"
                                            aria-label="Close full view"
                                        >
                                            <X className="w-5 h-5 md:w-6 md:h-6 text-charcoal-soft" />
                                        </button>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-2xl overflow-hidden shadow-inner p-2 md:p-4">
                                        <img
                                            src={expandedVisual === 'current' ? settings.generatedImage! : (expandedVisual as Collaborator).image!}
                                            alt="Full view"
                                            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                                        />
                                    </div>
                                    <div className="mt-4 flex justify-end flex-shrink-0">
                                        <button
                                            onClick={() => {
                                                const imgUrl = expandedVisual === 'current' ? settings.generatedImage! : (expandedVisual as Collaborator).image!;
                                                const link = document.createElement('a');
                                                link.href = imgUrl;
                                                link.download = `genesis-collab-${Date.now()}.png`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            }}
                                            className="bg-charcoal-soft text-white px-4 md:px-6 py-2 md:py-3 rounded-full font-bold text-sm md:text-base flex items-center gap-2 hover:bg-coral-burst transition-colors shadow-lg"
                                        >
                                            <Download className="w-4 h-4 md:w-5 md:h-5" /> Download
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Standard Single User Preview
                        settings.generatedImage ? (
                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                <img
                                    src={settings.generatedImage}
                                    alt="Generated Visual"
                                    className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
                                />
                                <button
                                    onClick={handleSaveAsset}
                                    className="absolute bottom-4 md:bottom-8 right-4 md:right-8 bg-white text-charcoal-soft px-3 md:px-4 py-2 rounded-full shadow-lg font-heading font-bold text-xs md:text-sm flex items-center gap-2 hover:text-coral-burst transition-colors"
                                >
                                    <Download className="w-3 h-3 md:w-4 md:h-4" /> Save
                                </button>
                            </div>
                        ) : (
                            <div className="text-center text-cocoa-light/50 p-4">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-peach-soft border-t-coral-burst rounded-full animate-spin"></div>
                                        <span className="font-heading font-bold text-base md:text-lg animate-pulse">Rendering...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-peach-soft/30 flex items-center justify-center mx-auto mb-4">
                                            {activeTab === 'character' && <Users className="w-8 h-8 md:w-10 md:h-10 opacity-50" />}
                                            {activeTab === 'scene' && <Camera className="w-8 h-8 md:w-10 md:h-10 opacity-50" />}
                                            {activeTab === 'style' && <Palette className="w-8 h-8 md:w-10 md:h-10 opacity-50" />}
                                        </div>
                                        <p className="font-heading font-bold text-lg md:text-xl">Ready to Create</p>
                                        <p className="text-xs md:text-sm mt-2 max-w-xs mx-auto">Adjust settings and click generate</p>
                                    </>
                                )}
                            </div>
                        )
                    )}
                </div>

            </div>

            {/* Chat Widget - Hidden on Mobile, Visible on Desktop */}
            <div className="hidden md:block fixed bottom-0 right-4 z-50">
                <ChatWidget
                    userProfile={userProfile}
                    onCollaborativeTrigger={handleCollaborativeTrigger}
                    activeCollaborators={presenceUsers.map(u => ({
                        id: u.user_id,
                        name: u.display_name || 'Anonymous',
                        avatar: u.avatar_url
                    }))}
                />
            </div>

            {/* Mobile Chat Overlay */}
            {
                isChatOpen && (
                    <div className="fixed inset-0 bg-white z-[60] md:hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b-2 border-charcoal-soft">
                            <h2 className="font-heading font-bold text-xl text-charcoal-soft">Chat</h2>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Close chat"
                                aria-label="Close chat"
                            >
                                <X size={24} className="text-charcoal-soft" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ChatPanel
                                userProfile={userProfile}
                                onClose={() => setIsChatOpen(false)}
                                onUnreadCountChange={setUnreadCount}
                                onCollaborativeTrigger={handleCollaborativeTrigger}
                                isMobile={true}
                                activeCollaborators={presenceUsers.map(u => ({
                                    id: u.user_id,
                                    name: u.display_name || 'Anonymous',
                                    avatar: u.avatar_url
                                }))}
                            />
                        </div>
                    </div>
                )
            }

            {/* Notification Center Modal */}
            {
                showNotificationCenter && userProfile && (
                    <NotificationCenter
                        isOpen={showNotificationCenter}
                        onClose={() => setShowNotificationCenter(false)}
                        anchorRef={notificationBtnRef}
                    />
                )
            }

            {/* Broadcast Studio Modal */}
            {
                showBroadcastStudio && userProfile && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-fadeIn">
                            <BroadcastStudio
                                onClose={() => setShowBroadcastStudio(false)}
                            />
                        </div>
                    </div>
                )
            }

            {/* Insights Dashboard Modal */}
            {
                showInsightsDashboard && userProfile && (
                    <InsightsDashboard
                        userId={userProfile.id}
                        isOpen={showInsightsDashboard}
                        onClose={() => setShowInsightsDashboard(false)}
                    />
                )
            }

            {/* Family Tree (Version History) Modal */}
            {
                showFamilyTree && selectedVisualForHistory && (
                    <FamilyTreeViewer
                        visualId={selectedVisualForHistory}
                        isOpen={showFamilyTree}
                        onClose={() => {
                            setShowFamilyTree(false);
                            setSelectedVisualForHistory(null);
                        }}
                        onRestoreVersion={(version: VisualVersion) => {
                            // Handle version restore - apply the visual data
                            console.log('Restoring version:', version);
                            setShowFamilyTree(false);
                            setSelectedVisualForHistory(null);
                        }}
                        onForkVersion={(version: VisualVersion) => {
                            // Handle forking - create a new branch from this version
                            console.log('Forking from version:', version);
                            setShowFamilyTree(false);
                            setSelectedVisualForHistory(null);
                        }}
                    />
                )
            }

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav
                activeTab={mobileActiveTab}
                onTabChange={handleMobileTabChange}
                unreadCount={unreadCount}
            />
        </div >
    );
};

export default VisualStudio;
