import React from 'react';
import { InfographicData } from '../../../types/infographic';

interface TimelineRendererProps {
    data: InfographicData;
}

const TimelineRenderer: React.FC<TimelineRendererProps> = ({ data }) => {
    const events = data.content.timelineEvents || [];

    return (
        <div className="w-full h-full p-4 sm:p-8 flex flex-col items-center">
            <div className="relative w-full max-w-3xl">
                {/* Central Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-coral-burst via-gold-sunshine to-mint-breeze transform -translate-x-1/2 rounded-full"></div>

                {/* Events */}
                <div className="space-y-12 py-8">
                    {events.map((event, index) => (
                        <div key={index} className={`flex items-center gap-8 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                            {/* Content Side */}
                            <div className={`flex-1 ${index % 2 === 0 ? 'text-right' : 'text-left'}`}>
                                <div className="bg-white p-5 rounded-2xl shadow-soft-md border border-peach-soft/30 hover:scale-105 transition-transform duration-300">
                                    <span className="inline-block px-3 py-1 bg-gold-sunshine/20 text-gold-sunshine font-bold rounded-full text-xs mb-2">
                                        {event.date}
                                    </span>
                                    <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-1">{event.title}</h3>
                                    <p className="text-cocoa-light text-sm">{event.description}</p>
                                </div>
                            </div>

                            {/* Center Dot */}
                            <div className="relative z-10 w-4 h-4 rounded-full bg-white border-4 border-coral-burst shadow-md flex-shrink-0">
                                <div className="absolute inset-0 bg-coral-burst rounded-full animate-ping opacity-20"></div>
                            </div>

                            {/* Empty Side for Balance */}
                            <div className="flex-1"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TimelineRenderer;
