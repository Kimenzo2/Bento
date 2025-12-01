import React from 'react';
import { InfographicData, InfographicType } from '../../../types/infographic';
import ProcessRenderer from './ProcessRenderer';
import ComparisonRenderer from './ComparisonRenderer';
import TimelineRenderer from './TimelineRenderer';
import StatisticalRenderer from './StatisticalRenderer';

interface InfographicRendererProps {
    data: InfographicData;
    scale?: number;
}

const InfographicRenderer: React.FC<InfographicRendererProps> = ({ data, scale = 1 }) => {
    const renderContent = () => {
        switch (data.type) {
            case InfographicType.PROCESS:
                return <ProcessRenderer data={data} />;
            case InfographicType.COMPARISON:
                return <ComparisonRenderer data={data} />;
            case InfographicType.TIMELINE:
                return <TimelineRenderer data={data} />;
            case InfographicType.STATISTICAL:
                return <StatisticalRenderer data={data} />;
            default:
                // Default fallback (Process)
                return <ProcessRenderer data={data} />;
        }
    };

    return (
        <div
            id="infographic-canvas"
            className="bg-white shadow-xl transition-transform duration-200 origin-center w-full max-w-[800px] mx-auto overflow-hidden relative"
            style={{
                height: 'auto',
                minHeight: '800px',
                aspectRatio: '3/4',
                transform: `scale(${scale})`,
                backgroundImage: 'linear-gradient(to bottom right, #ffffff, #f8f9fa)'
            }}
        >
            {/* Header */}
            <div className="p-8 text-center bg-gradient-to-b from-cream-soft to-transparent">
                <h1 className="font-heading font-bold text-3xl sm:text-4xl text-charcoal-soft mb-2" style={{ color: data.colors[0] }}>
                    {data.title}
                </h1>
                <div className="w-24 h-1 mx-auto rounded-full mb-4" style={{ backgroundColor: data.colors[1] }}></div>
                <p className="text-cocoa-light max-w-lg mx-auto text-sm">{data.content.intro}</p>
            </div>

            {/* Generated Visual */}
            {data.imageUrl && (
                <div className="w-full px-8 mb-8 flex justify-center">
                    <div className="relative rounded-2xl overflow-hidden shadow-lg border-4 border-white transform hover:scale-[1.02] transition-transform duration-500">
                        <img
                            src={data.imageUrl}
                            alt={data.title}
                            className="w-full max-w-md h-auto object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 relative">
                {renderContent()}
            </div>

            {/* Footer */}
            <div className="p-6 bg-cream-base/30 mt-auto border-t border-peach-soft/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                        <h4 className="font-bold text-yellow-800 text-sm mb-1">Did you know?</h4>
                        <p className="text-xs text-yellow-700">{data.content.funFact}</p>
                    </div>
                    {data.content.keyTerm && (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="font-bold text-blue-800 text-sm mb-1">Key Term: {data.content.keyTerm.term}</h4>
                            <p className="text-xs text-blue-700">{data.content.keyTerm.definition}</p>
                        </div>
                    )}
                </div>
                <div className="text-center mt-6 text-[10px] text-gray-400 uppercase tracking-widest">
                    Created with Genesis AI
                </div>
            </div>

            {/* Guide Character Overlay */}
            {data.guideCharacter !== 'NONE' && (
                <div className="absolute bottom-4 right-4 w-24 h-24 bg-white rounded-full shadow-lg border-4 border-white flex items-center justify-center text-4xl transform rotate-12 z-20">
                    {data.guideCharacter === 'OWL' && '🦉'}
                    {data.guideCharacter === 'MOUSE' && '🐭'}
                    {data.guideCharacter === 'FOX' && '🦊'}
                    {data.guideCharacter === 'ROBOT' && '🤖'}
                    {data.guideCharacter === 'DRAGON' && '🐉'}
                    {data.guideCharacter === 'ASTRONAUT' && '🐶'}
                </div>
            )}
        </div>
    );
};

export default InfographicRenderer;
