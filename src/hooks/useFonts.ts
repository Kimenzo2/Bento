import { useContext } from 'react';
import { FontContext } from '../contexts/FontContext';

export const useFonts = () => {
    const context = useContext(FontContext);
    if (context === undefined) {
        throw new Error('useFonts must be used within a FontProvider');
    }
    return context;
};
