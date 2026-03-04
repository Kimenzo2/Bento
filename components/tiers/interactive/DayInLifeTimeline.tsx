import { motion } from 'framer-motion';
import { AlertCircle, Check, Clock, Coffee, Zap } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { TierConfig } from '../TierDetailShared';
import { Button } from '@components/ui/button';

interface DayInLifeTimelineProps {
  tier: TierConfig;
}

const timelineEvents = [
  {
    time: '9:00 AM',
    withoutGenesis: {
      activity: 'Search for available illustrators on freelance sites',
      mood: 'stress',
      icon: AlertCircle,
    },
    withGenesis: {
      activity: 'Open Genesis and select "Water color" style',
      mood: 'joy',
      icon: Zap,
    },
  },
  {
    time: '11:00 AM',
    withoutGenesis: {
      activity: 'Review 3 expensive portfolios, send inquiry emails',
      mood: 'waiting',
      icon: Coffee,
    },
    withGenesis: {
      activity: 'Generate complete 12-page storyboard',
      mood: 'productive',
      icon: Check,
    },
  },
  {
    time: '2:00 PM',
    withoutGenesis: {
      activity: 'Wait for replies (usually takes 24-48 hours)',
      mood: 'bored',
      icon: Clock,
    },
    withGenesis: {
      activity: 'Refine text and illustrations in Smart Editor',
      mood: 'creative',
      icon: Zap,
    },
  },
  {
    time: '4:00 PM',
    withoutGenesis: {
      activity: 'Realize budget will be $2,000+ for one book',
      mood: 'panic',
      icon: AlertCircle,
    },
    withGenesis: {
      activity: 'Export print-ready PDF and upload to KDP',
      mood: 'success',
      icon: Check,
    },
  },
];

export const DayInLifeTimeline: React.FC<DayInLifeTimelineProps> = ({ tier }) => {
  const [activeTab, setActiveTab] = useState<'with' | 'without'>('with');

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <h3 className="font-heading font-bold text-2xl text-charcoal-soft mb-4">
          A Day in the Life
        </h3>

        <div className="inline-flex bg-gray-100 p-1 rounded-full relative">
          <div
            className={`absolute top-1 bottom-1 w-1/2 rounded-full bg-white border-2 border-peach-soft transition-all duration-300 ${activeTab === 'with' ? 'left-1' : 'left-[49%]'}`}
          />
          <Button
            variant="ghost"
            onClick={() => setActiveTab('without')}
            className={`relative z-10 px-6 py-2 rounded-full ${activeTab === 'without' ? 'text-charcoal-soft' : 'text-charcoal-soft/50'}`}
          >
            Typically
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('with')}
            className={`relative z-10 px-6 py-2 rounded-full ${activeTab === 'with' ? `text-${tier.accentColor}-600 bg-linear-to-r ${tier.gradient} bg-clip-text text-transparent` : 'text-charcoal-soft/50'}`}
          >
            With Genesis
          </Button>
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Central Line */}
        <div className="absolute left-1/2 -translate-x-px w-0.5 h-full bg-gray-100 hidden md:block" />

        <div className="space-y-12">
          {timelineEvents.map((event, index) => {
            const isWith = activeTab === 'with';
            const data = isWith ? event.withGenesis : event.withoutGenesis;

            return (
              <motion.div
                key={event.time}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative flex flex-col md:flex-row items-center gap-8 group"
              >
                {/* Time Badge */}
                <div className="md:absolute left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full border border-peach-soft/50 text-xs font-mono font-bold text-charcoal-soft z-10">
                  {event.time}
                </div>

                {/* Card */}
                <div
                  className={`w-full md:w-1/2 p-6 rounded-2xl border transition-all duration-500 ${
                    isWith
                      ? `bg-white border-2 border-${tier.accentColor}-200 md:${index % 2 === 0 ? 'ml-auto' : 'mr-auto'}`
                      : `bg-gray-50 border-gray-200 grayscale opacity-80 md:${index % 2 === 0 ? 'ml-auto' : 'mr-auto'}`
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isWith ? `bg-${tier.accentColor}-100 text-${tier.accentColor}-600` : 'bg-gray-200 text-gray-500'}`}
                    >
                      <data.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4
                        className={`font-bold text-lg mb-1 ${isWith ? 'text-charcoal-soft' : 'text-gray-500'}`}
                      >
                        {isWith ? 'Productive & Creative' : 'Frustrating & Slow'}
                      </h4>
                      <p className="text-sm text-charcoal-soft/70">{data.activity}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
