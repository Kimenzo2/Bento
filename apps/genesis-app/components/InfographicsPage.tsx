import type React from 'react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import InfographicWizard from './infographic/InfographicWizard';
import { usePageSEO } from '../hooks/usePageSEO';

const InfographicsPage: React.FC = () => {
  const navigate = useNavigate();

  usePageSEO({
    title: 'Infographics — Genesis AI Visual Storytelling',
    description: 'Create stunning educational infographics with AI. Choose a topic, customize the style, and generate beautiful visual lessons in seconds.',
    canonical: '/infographics',
  });

  const handleClose = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <section aria-label="Infographics" className="w-full animate-fadeIn">
      <InfographicWizard onClose={handleClose} />
    </section>
  );
};

export default InfographicsPage;
