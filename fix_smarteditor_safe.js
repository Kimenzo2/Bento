const fs = require('fs');
let code = fs.readFileSync('components/SmartEditor.tsx', 'utf8');

const mobileTabRegex = /\{\/\* Mobile Tab Toggle \*\/\}.*?(?=\{\/\* Left Panel)/s;

let newMobileTab = `{/* Unified Mobile Action Bar (Bottom Sheet Trigger/Floating) */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex p-1.5 bg-surface/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-peach-soft dark:border-white/10 shadow-2xl items-center transition-all duration-300">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileView('edit')}
            className={\`flex-1 rounded-xl px-6 py-2 h-auto text-sm font-semibold transition-all \${mobileView === 'edit' ? 'bg-coral-burst text-white shadow-md transform scale-105' : 'text-cocoa-light dark:text-slate-400 hover:text-charcoal-soft'}\`}
          >
            <Edit3 className="w-4 h-4 mr-2" /> Editor
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileView('preview')}
            className={\`flex-1 rounded-xl px-6 py-2 h-auto text-sm font-semibold transition-all \${mobileView === 'preview' ? 'bg-coral-burst text-white shadow-md transform scale-105' : 'text-cocoa-light dark:text-slate-400 hover:text-charcoal-soft'}\`}
          >
            <Eye className="w-4 h-4 mr-2" /> Preview
          </Button>
      </div>

`;
code = code.replace(mobileTabRegex, newMobileTab);

const leftPanelRegex = /className={\`w-full lg:w-\[40%\] flex-col border-r border-peach-soft(?:\/50|\/10)?\s*(?:dark:border-white\/10)?\s*bg-cream-soft\s*(?:dark:bg-slate-900)?.*\${mobileView === 'preview' \? 'hidden lg:flex' : 'flex min-h-\[50vh\] lg:h-full'}\`}/s;
const newLeftPanelStr = 'className={`w-full lg:w-[40%] flex-col border-r border-peach-soft/50 dark:border-white/10 bg-cream-soft dark:bg-slate-900 z-10 ${mobileView === \'preview\' ? \'hidden lg:flex\' : \'flex h-[calc(100dvh-80px)] pb-24 lg:pb-0\'}`}';
// need to replace with more forgiving regex
code = code.replace(/className={\`w-full lg:w-\[40%\].*?\`}/s, newLeftPanelStr);

const rightPanelRegex = /className={\`w-full lg:w-\[60%\].*?Right Panel: Preview.*?\`}/s;
const newRightPanelStr = 'className={`w-full lg:w-[60%] bg-peach-soft/20 dark:bg-slate-950 items-center justify-center p-0 lg:p-8 lg:pt-16 relative overflow-hidden transition-all duration-500 z-20 ${mobileView === \'edit\' ? \'hidden lg:flex\' : \'flex h-[calc(100dvh-80px)] fixed lg:relative inset-0 lg:inset-auto flex-col\'}`}';
// wait, the regex above might match too much. Let's find "Right Panel: Preview" comment, then the following div.
code = code.replace(/\{\/\* Right Panel: Preview \*\/\}\s*<div\s*className={\`w-full lg:w-\[60%\].*?\`}/s, '{/* Right Panel: Preview */}\n      <div\n        ' + newRightPanelStr);

const bookPageContainerRegex = /className="w-full max-w-md md:max-w-2xl aspect-3\/4 bg-\[#FFFCF8\](?: dark:bg-slate-900)? border border-peach-soft(?: dark:border-white\/10)? rounded-sm relative flex flex-col overflow-hidden transform transition-transform duration-500 hover:scale-\[1\.01\]"/s;
const newBookPageContainerStr = 'className="w-full h-full lg:h-auto lg:max-w-2xl lg:aspect-3/4 bg-[#FAFAFA] dark:bg-slate-900 lg:border border-peach-soft dark:border-white/10 lg:rounded-2xl relative flex flex-col overflow-hidden shadow-none lg:shadow-2xl transform transition-transform duration-500"';
code = code.replace(bookPageContainerRegex, newBookPageContainerStr);

const textContentRegex = /className="flex-1 p-6 md:p-12 relative z-20 flex flex-col overflow-y-auto"/s;
const newTextContentStr = 'className="flex-1 p-6 sm:p-8 md:p-12 relative z-20 flex flex-col overflow-y-auto pb-32 lg:pb-12"';
code = code.replace(textContentRegex, newTextContentStr);

const textParaRegex = /className="font-heading text-xl md:text-2xl lg:text-3xl text-charcoal-soft(?: dark:text-slate-200)? leading-normal mb-auto"/s;
const newTextParaStr = 'className="font-heading text-lg sm:text-xl md:text-2xl lg:text-3xl text-charcoal-soft dark:text-slate-200 leading-relaxed sm:leading-normal mb-auto"';
code = code.replace(textParaRegex, newTextParaStr);

fs.writeFileSync('components/SmartEditor.tsx', code);
