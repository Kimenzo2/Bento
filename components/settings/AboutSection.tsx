import React, { useState } from 'react';
import { 
  Info, 
  GitBranch, 
  Shield, 
  FileText, 
  ExternalLink, 
  Mail,
  Calendar,
  Zap,
  Heart
} from 'lucide-react';

const AboutSection: React.FC = () => {
  const appVersion = '2.0.0';
  const buildDate = new Date().toLocaleDateString();

  return (
    <div className="animate-fadeIn space-y-6">
      {/* App Info */}
      <div className="bg-gradient-to-br from-coral-burst to-gold-sunshine rounded-xl md:rounded-2xl p-4 md:p-6 text-white">
        <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl md:text-3xl">📚</span>
          </div>
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-xl md:text-2xl">Genesis</h2>
            <p className="text-white/90 text-sm">AI-Powered eBook Creator</p>
          </div>
        </div>
        <p className="text-white/90 text-xs md:text-sm">
          Transform ideas into beautiful children's books with AI. Create, customize, and publish stunning stories.
        </p>
      </div>

      {/* Version Info */}
      <div>
        <h3 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-3 md:mb-4">
          Version Information
        </h3>
        
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-peach-soft/30">
            <div className="flex items-center gap-2 md:gap-3">
              <GitBranch className="w-4 h-4 md:w-5 md:h-5 text-coral-burst" />
              <span className="text-sm text-charcoal-soft font-medium">Version</span>
            </div>
            <span className="text-sm font-bold text-coral-burst">{appVersion}</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-peach-soft/30">
            <div className="flex items-center gap-2 md:gap-3">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 text-coral-burst" />
              <span className="text-sm text-charcoal-soft font-medium">Build</span>
            </div>
            <span className="text-sm text-cocoa-light">{buildDate}</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-peach-soft/30">
            <div className="flex items-center gap-2 md:gap-3">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-coral-burst" />
              <span className="text-sm text-charcoal-soft font-medium">Platform</span>
            </div>
            <span className="text-sm text-cocoa-light">Web • PWA</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Features */}
      <div>
        <h3 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-3 md:mb-4">
          What's New in v2.0
        </h3>
        
        <div className="bg-cream-base rounded-xl p-3 md:p-4 space-y-1.5 md:space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-xs md:text-sm text-charcoal-soft">React 19 with improved performance</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-xs md:text-sm text-charcoal-soft">Enhanced accessibility features</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-xs md:text-sm text-charcoal-soft">Advanced data management</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-xs md:text-sm text-charcoal-soft">Professional monitoring</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-xs md:text-sm text-charcoal-soft">Session management</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Legal & Support */}
      <div>
        <h3 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-3 md:mb-4">
          Legal & Support
        </h3>
        
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <a
            href="/legal/privacy"
            className="flex items-center gap-2 p-3 md:p-3 bg-white border border-peach-soft rounded-xl hover:border-coral-burst active:bg-cream-base hover:shadow-soft-sm transition-all group touch-manipulation"
          >
            <Shield className="w-4 h-4 md:w-5 md:h-5 text-coral-burst flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium text-charcoal-soft group-hover:text-coral-burst truncate">Privacy</span>
          </a>

          <a
            href="/legal/terms"
            className="flex items-center gap-2 p-3 md:p-3 bg-white border border-peach-soft rounded-xl hover:border-coral-burst active:bg-cream-base hover:shadow-soft-sm transition-all group touch-manipulation"
          >
            <FileText className="w-4 h-4 md:w-5 md:h-5 text-coral-burst flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium text-charcoal-soft group-hover:text-coral-burst truncate">Terms</span>
          </a>

          <a
            href="/legal/acceptable-use"
            className="flex items-center gap-2 p-3 md:p-3 bg-white border border-peach-soft rounded-xl hover:border-coral-burst active:bg-cream-base hover:shadow-soft-sm transition-all group touch-manipulation"
          >
            <Info className="w-4 h-4 md:w-5 md:h-5 text-coral-burst flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium text-charcoal-soft group-hover:text-coral-burst truncate">Usage</span>
          </a>

          <a
            href="https://genesis-1765265007.documentationai.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 md:p-3 bg-white border border-peach-soft rounded-xl hover:border-coral-burst active:bg-cream-base hover:shadow-soft-sm transition-all group touch-manipulation"
          >
            <FileText className="w-4 h-4 md:w-5 md:h-5 text-coral-burst flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium text-charcoal-soft group-hover:text-coral-burst truncate">Docs</span>
          </a>
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Contact */}
      <div>
        <h3 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-3 md:mb-4">
          Get Help
        </h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4 space-y-2 md:space-y-3">
          <p className="text-xs md:text-sm text-blue-900">
            Need assistance? We're here to help!
          </p>
          <a
            href="mailto:support@genesis.app"
            className="flex items-center gap-2 text-xs md:text-sm font-bold text-blue-600 hover:text-blue-700 touch-manipulation"
          >
            <Mail className="w-4 h-4" />
            support@genesis.app
          </a>
        </div>
      </div>

      {/* Credits */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-xl p-3 md:p-4">
        <div className="flex items-center gap-2 mb-1 md:mb-2">
          <Heart className="w-4 h-4 md:w-5 md:h-5 text-pink-500" />
          <h4 className="font-bold text-pink-900 text-sm md:text-base">Made with Love</h4>
        </div>
        <p className="text-xs md:text-sm text-pink-800">
          Crafted to make storytelling accessible to everyone. Thank you for being part of our journey! 🎨📖
        </p>
      </div>

      {/* Copyright */}
      <div className="text-center pt-4 border-t border-peach-soft/50">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} Genesis. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AboutSection;
