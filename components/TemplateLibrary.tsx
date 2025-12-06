import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Sparkles, BookOpen, Heart, Star, Rocket, Crown,
    Moon, Sun, Palette, Music, Compass, Zap, Gift,
    ArrowRight, Check, Clock, Users, Wand2
} from 'lucide-react';

export interface BookTemplate {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    category: 'adventure' | 'educational' | 'bedtime' | 'fairy-tale' | 'custom';
    pageCount: number;
    ageRange: string;
    structure: TemplateStructure[];
    samplePrompt: string;
    popular?: boolean;
    new?: boolean;
}

interface TemplateStructure {
    pageNumber: number;
    type: 'cover' | 'intro' | 'chapter' | 'climax' | 'resolution' | 'end';
    suggestedContent: string;
    illustrationHint: string;
}

// Pre-built templates
export const bookTemplates: BookTemplate[] = [
    {
        id: 'classic-adventure',
        name: 'Classic Adventure',
        description: 'A hero\'s journey with challenges, friends, and triumph',
        icon: <Compass className="w-6 h-6" />,
        category: 'adventure',
        pageCount: 10,
        ageRange: '5-8 years',
        popular: true,
        samplePrompt: 'Create a "Classic Adventure" story about a brave young explorer who discovers a magical map. The tone should be exciting and courageous. The story must follow the Hero\'s Journey archetype: starting in a normal world, receiving a call to adventure, meeting a mentor, facing challenges, and returning home transformed. Focus on themes of bravery, friendship, and discovery.',
        structure: [
            { pageNumber: 1, type: 'cover', suggestedContent: 'Title and hero introduction', illustrationHint: 'Hero standing ready for adventure' },
            { pageNumber: 2, type: 'intro', suggestedContent: 'Meet the hero and their world', illustrationHint: 'Home environment with hints of adventure' },
            { pageNumber: 3, type: 'chapter', suggestedContent: 'The call to adventure', illustrationHint: 'Discovery moment' },
            { pageNumber: 4, type: 'chapter', suggestedContent: 'Meeting a friend or guide', illustrationHint: 'Two characters meeting' },
            { pageNumber: 5, type: 'chapter', suggestedContent: 'First challenge', illustrationHint: 'Action scene' },
            { pageNumber: 6, type: 'chapter', suggestedContent: 'Learning and growing', illustrationHint: 'Character development moment' },
            { pageNumber: 7, type: 'climax', suggestedContent: 'The big challenge', illustrationHint: 'Dramatic confrontation' },
            { pageNumber: 8, type: 'resolution', suggestedContent: 'Victory and celebration', illustrationHint: 'Triumph scene' },
            { pageNumber: 9, type: 'end', suggestedContent: 'Return home changed', illustrationHint: 'Hero back home, wiser' },
            { pageNumber: 10, type: 'end', suggestedContent: 'The end / moral', illustrationHint: 'Happy ending scene' },
        ],
    },
    {
        id: 'bedtime-story',
        name: 'Bedtime Story',
        description: 'A calming journey perfect for winding down',
        icon: <Moon className="w-6 h-6" />,
        category: 'bedtime',
        pageCount: 8,
        ageRange: '3-6 years',
        popular: true,
        samplePrompt: 'Write a soothing "Bedtime Story" about a little bunny who couldn\'t fall asleep. The tone must be calm, gentle, and rhythmic, perfect for reading aloud at night. Use soft, sensory details (fluffy clouds, whispering wind, warm blanket). The pacing should slow down gradually page by page to help the child relax.',
        structure: [
            { pageNumber: 1, type: 'cover', suggestedContent: 'Nighttime title scene', illustrationHint: 'Cozy nighttime setting' },
            { pageNumber: 2, type: 'intro', suggestedContent: 'Evening time, getting ready for bed', illustrationHint: 'Twilight, warm colors' },
            { pageNumber: 3, type: 'chapter', suggestedContent: 'A small problem or adventure', illustrationHint: 'Gentle activity' },
            { pageNumber: 4, type: 'chapter', suggestedContent: 'Exploring the night', illustrationHint: 'Stars and moonlight' },
            { pageNumber: 5, type: 'chapter', suggestedContent: 'Finding comfort', illustrationHint: 'Warm, safe feeling' },
            { pageNumber: 6, type: 'resolution', suggestedContent: 'Settling down', illustrationHint: 'Calming scene' },
            { pageNumber: 7, type: 'end', suggestedContent: 'Drifting to sleep', illustrationHint: 'Eyes closing, peaceful' },
            { pageNumber: 8, type: 'end', suggestedContent: 'Sweet dreams', illustrationHint: 'Sleeping peacefully' },
        ],
    },
    {
        id: 'learning-abc',
        name: 'ABC Learning',
        description: 'Educational alphabet adventure',
        icon: <BookOpen className="w-6 h-6" />,
        category: 'educational',
        pageCount: 12,
        ageRange: '3-5 years',
        new: true,
        samplePrompt: 'Create an "ABC Learning" book where animals teach the alphabet. The tone should be cheerful, bright, and educational. Each page must focus on specific letters with clear examples (e.g., "A is for Apple"). Use alliteration and simple sentences. The goal is to help children recognize letters and associate them with familiar objects.',
        structure: [
            { pageNumber: 1, type: 'cover', suggestedContent: 'ABC Adventure title', illustrationHint: 'Colorful letters with characters' },
            { pageNumber: 2, type: 'intro', suggestedContent: 'Welcome to alphabet land', illustrationHint: 'Magical learning environment' },
            { pageNumber: 3, type: 'chapter', suggestedContent: 'Letters A-C with examples', illustrationHint: 'Apple, Bear, Cat' },
            { pageNumber: 4, type: 'chapter', suggestedContent: 'Letters D-F with examples', illustrationHint: 'Dog, Elephant, Fish' },
            { pageNumber: 5, type: 'chapter', suggestedContent: 'Letters G-I with examples', illustrationHint: 'Giraffe, Horse, Igloo' },
            { pageNumber: 6, type: 'chapter', suggestedContent: 'Letters J-L with examples', illustrationHint: 'Jellyfish, Koala, Lion' },
            { pageNumber: 7, type: 'chapter', suggestedContent: 'Letters M-O with examples', illustrationHint: 'Monkey, Nest, Owl' },
            { pageNumber: 8, type: 'chapter', suggestedContent: 'Letters P-R with examples', illustrationHint: 'Penguin, Queen, Rabbit' },
            { pageNumber: 9, type: 'chapter', suggestedContent: 'Letters S-U with examples', illustrationHint: 'Sun, Tiger, Umbrella' },
            { pageNumber: 10, type: 'chapter', suggestedContent: 'Letters V-X with examples', illustrationHint: 'Violin, Whale, Xylophone' },
            { pageNumber: 11, type: 'chapter', suggestedContent: 'Letters Y-Z with examples', illustrationHint: 'Yak, Zebra' },
            { pageNumber: 12, type: 'end', suggestedContent: 'Now you know your ABCs!', illustrationHint: 'All letters together celebration' },
        ],
    },
    {
        id: 'fairy-tale',
        name: 'Fairy Tale',
        description: 'Once upon a time... classic storytelling',
        icon: <Crown className="w-6 h-6" />,
        category: 'fairy-tale',
        pageCount: 12,
        ageRange: '4-8 years',
        samplePrompt: 'Write a classic "Fairy Tale" about a princess who loved dragons. Start with "Once upon a time...". The tone should be magical, whimsical, and timeless. Include classic fairy tale elements like a castle, a quest, and a moral lesson about kindness or understanding. The story should show that things aren\'t always what they seem.',
        structure: [
            { pageNumber: 1, type: 'cover', suggestedContent: 'Magical title with castle', illustrationHint: 'Fairytale castle scene' },
            { pageNumber: 2, type: 'intro', suggestedContent: 'Once upon a time...', illustrationHint: 'Kingdom overview' },
            { pageNumber: 3, type: 'chapter', suggestedContent: 'Meet the main character', illustrationHint: 'Royal or magical character' },
            { pageNumber: 4, type: 'chapter', suggestedContent: 'Their special trait or wish', illustrationHint: 'Character\'s dream' },
            { pageNumber: 5, type: 'chapter', suggestedContent: 'The problem or villain', illustrationHint: 'Challenge appears' },
            { pageNumber: 6, type: 'chapter', suggestedContent: 'Finding help or magic', illustrationHint: 'Magical discovery' },
            { pageNumber: 7, type: 'chapter', suggestedContent: 'The quest begins', illustrationHint: 'Journey scene' },
            { pageNumber: 8, type: 'chapter', suggestedContent: 'Trials and tribulations', illustrationHint: 'Overcoming obstacles' },
            { pageNumber: 9, type: 'climax', suggestedContent: 'The final confrontation', illustrationHint: 'Climactic moment' },
            { pageNumber: 10, type: 'resolution', suggestedContent: 'Good triumphs!', illustrationHint: 'Victory celebration' },
            { pageNumber: 11, type: 'end', suggestedContent: 'Happily ever after', illustrationHint: 'Happy kingdom' },
            { pageNumber: 12, type: 'end', suggestedContent: 'The End', illustrationHint: 'Closing book scene' },
        ],
    },
    {
        id: 'counting-fun',
        name: 'Counting Fun',
        description: '1, 2, 3... Learn to count with friends!',
        icon: <Star className="w-6 h-6" />,
        category: 'educational',
        pageCount: 10,
        ageRange: '2-5 years',
        samplePrompt: 'Create a "Counting Fun" book about counting colorful balloons at a party. The tone should be energetic and celebratory. Each page must focus on a specific number (1 to 10) with clear, countable objects. Use simple, repetitive text structure (e.g., "One big balloon," "Two red balloons") to help toddlers learn numbers.',
        structure: [
            { pageNumber: 1, type: 'cover', suggestedContent: '123 Counting Adventure', illustrationHint: 'Numbers with characters' },
            { pageNumber: 2, type: 'intro', suggestedContent: 'Let\'s learn to count!', illustrationHint: 'Excited character ready to count' },
            { pageNumber: 3, type: 'chapter', suggestedContent: 'Number 1 - One special thing', illustrationHint: 'One prominent object' },
            { pageNumber: 4, type: 'chapter', suggestedContent: 'Number 2 - A pair', illustrationHint: 'Two matching items' },
            { pageNumber: 5, type: 'chapter', suggestedContent: 'Number 3 - Three friends', illustrationHint: 'Three characters together' },
            { pageNumber: 6, type: 'chapter', suggestedContent: 'Numbers 4-5', illustrationHint: 'Groups of four and five' },
            { pageNumber: 7, type: 'chapter', suggestedContent: 'Numbers 6-7', illustrationHint: 'Groups of six and seven' },
            { pageNumber: 8, type: 'chapter', suggestedContent: 'Numbers 8-9', illustrationHint: 'Groups of eight and nine' },
            { pageNumber: 9, type: 'chapter', suggestedContent: 'Number 10 - All together!', illustrationHint: 'Ten items arranged nicely' },
            { pageNumber: 10, type: 'end', suggestedContent: 'You can count to 10!', illustrationHint: 'Celebration with numbers' },
        ],
    },
    {
        id: 'space-adventure',
        name: 'Space Adventure',
        description: 'Blast off to the stars and beyond!',
        icon: <Rocket className="w-6 h-6" />,
        category: 'adventure',
        pageCount: 10,
        ageRange: '5-9 years',
        new: true,
        samplePrompt: 'Write a "Space Adventure" about an astronaut cat exploring the solar system. The tone should be full of wonder and curiosity. Include real space facts (like gravity, stars, planets) woven into the story. The visual style should be vibrant and cosmic. The story should encourage a love for science and exploration.',
        structure: [
            { pageNumber: 1, type: 'cover', suggestedContent: 'Space Adventure title', illustrationHint: 'Rocket ship in space' },
            { pageNumber: 2, type: 'intro', suggestedContent: 'Meet our space explorer', illustrationHint: 'Character with space suit' },
            { pageNumber: 3, type: 'chapter', suggestedContent: 'Countdown and liftoff!', illustrationHint: 'Rocket launching' },
            { pageNumber: 4, type: 'chapter', suggestedContent: 'Flying through space', illustrationHint: 'Stars and galaxies' },
            { pageNumber: 5, type: 'chapter', suggestedContent: 'Visiting a planet', illustrationHint: 'Colorful alien planet' },
            { pageNumber: 6, type: 'chapter', suggestedContent: 'Meeting space friends', illustrationHint: 'Friendly aliens' },
            { pageNumber: 7, type: 'chapter', suggestedContent: 'A space challenge', illustrationHint: 'Asteroid field or problem' },
            { pageNumber: 8, type: 'resolution', suggestedContent: 'Saving the day', illustrationHint: 'Heroic moment' },
            { pageNumber: 9, type: 'end', suggestedContent: 'Heading home', illustrationHint: 'Earth in view' },
            { pageNumber: 10, type: 'end', suggestedContent: 'A hero returns', illustrationHint: 'Landing and celebration' },
        ],
    },
];

const categoryColors = {
    'adventure': 'from-orange-500 to-red-500',
    'educational': 'from-blue-500 to-cyan-500',
    'bedtime': 'from-indigo-500 to-purple-500',
    'fairy-tale': 'from-pink-500 to-rose-500',
    'custom': 'from-gray-500 to-gray-600',
};

const categoryLabels = {
    'adventure': 'Adventure',
    'educational': 'Educational',
    'bedtime': 'Bedtime',
    'fairy-tale': 'Fairy Tale',
    'custom': 'Custom',
};

interface TemplateLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: BookTemplate) => void;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
    isOpen,
    onClose,
    onSelectTemplate,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedTemplate, setSelectedTemplate] = useState<BookTemplate | null>(null);

    const categories = ['all', 'adventure', 'educational', 'bedtime', 'fairy-tale'];

    const filteredTemplates = selectedCategory === 'all'
        ? bookTemplates
        : bookTemplates.filter(t => t.category === selectedCategory);

    const handleUseTemplate = () => {
        if (selectedTemplate) {
            onSelectTemplate(selectedTemplate);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                >
                    {/* Header */}
                    <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-coral-burst to-sunset-coral rounded-xl">
                                    <Wand2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                                        Template Library
                                    </h2>
                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                        Start with a proven story structure
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                title="Close"
                                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Category filters */}
                        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`
                                        px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                                        ${selectedCategory === cat
                                            ? 'bg-coral-burst text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }
                                    `}
                                >
                                    {cat === 'all' ? 'All Templates' : categoryLabels[cat as keyof typeof categoryLabels]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTemplates.map((template) => (
                                <motion.div
                                    key={template.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedTemplate(template)}
                                    className={`
                                        relative p-4 rounded-2xl border-2 cursor-pointer transition-all
                                        ${selectedTemplate?.id === template.id
                                            ? 'border-coral-burst bg-coral-burst/5'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-coral-burst/50'
                                        }
                                    `}
                                >
                                    {/* Badges */}
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        {template.popular && (
                                            <span className="px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full flex items-center gap-1">
                                                <Star className="w-3 h-3" /> Popular
                                            </span>
                                        )}
                                        {template.new && (
                                            <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> New
                                            </span>
                                        )}
                                    </div>

                                    {/* Icon */}
                                    <div className={`
                                        w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[template.category]}
                                        flex items-center justify-center text-white mb-3
                                    `}>
                                        {template.icon}
                                    </div>

                                    {/* Info */}
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                                        {template.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                        {template.description}
                                    </p>

                                    {/* Meta */}
                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <BookOpen className="w-3 h-3" />
                                            {template.pageCount} pages
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {template.ageRange}
                                        </span>
                                    </div>

                                    {/* Selection indicator */}
                                    {selectedTemplate?.id === template.id && (
                                        <div className="absolute top-4 left-4">
                                            <div className="w-6 h-6 bg-coral-burst rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Preview panel when template selected */}
                    <AnimatePresence>
                        {selectedTemplate && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0"
                            >
                                <div className="p-4 md:p-6">
                                    <div className="flex flex-col md:flex-row items-start justify-between gap-4 md:gap-6">
                                        <div className="flex-1 w-full">
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
                                                {selectedTemplate.name} Structure
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                                Example prompt: "{selectedTemplate.samplePrompt}"
                                            </p>
                                            
                                            {/* Structure preview */}
                                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                {selectedTemplate.structure.slice(0, 6).map((page, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex-shrink-0 w-24 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                                    >
                                                        <div className="text-xs font-bold text-coral-burst mb-1">
                                                            Page {page.pageNumber}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                                            {page.suggestedContent}
                                                        </div>
                                                    </div>
                                                ))}
                                                {selectedTemplate.structure.length > 6 && (
                                                    <div className="flex-shrink-0 w-24 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            +{selectedTemplate.structure.length - 6} more
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleUseTemplate}
                                            className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-coral-burst to-sunset-coral text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-shadow"
                                        >
                                            Use Template
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TemplateLibrary;
