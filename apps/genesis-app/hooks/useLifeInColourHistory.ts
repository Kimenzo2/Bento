import { useEffect, useState } from 'react';
import type { LifeInColourGenerationRecord } from '../types';
import { mastra } from '../src/services/mastraClient';

export function useLifeInColourHistory() {
  const [generations, setGenerations] = useState<LifeInColourGenerationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await mastra.lifeInColour.listGenerations(8);

        if (!cancelled) {
          setGenerations(response.generations);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Could not load saved pages.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { generations, isLoading, error };
}

