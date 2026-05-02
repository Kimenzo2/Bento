const fs = require('fs');
let code = fs.readFileSync('components/SmartEditor.tsx', 'utf8');

const mobileTabRegex = /\{\/\* Mobile Tab Toggle \*\/\}.*?(?=\{\/\* Left Panel)/s;

let newMobileTab = \{/* Unified Mobile Action Bar (Bottom Sheet Trigger/Floating) */}
      <div className=\
lg:hidden
fixed
bottom-6
left-1/2
-translate-x-1/2
z-50
flex
p-1.5
bg-surface/90
dark:bg-slate-800/90
backdrop-blur-md
rounded-2xl
border
border-peach-soft
dark:border-white/10
shadow-2xl
items-center
transition-all
duration-300\>
          <Button
            variant=\ghost\
            size=\sm\
            onClick={() => setMobileView('edit')}
            className={\\\lex-1 rounded-xl px-6 py-2 h-auto text-sm font-semibold transition-all \\\\}
          >
            <Edit3 className=\w-4
h-4
mr-2\ /> Editor
          </Button>
          <Button
            variant=\ghost\
            size=\sm\
            onClick={() => setMobileView('preview')}
            className={\\\lex-1 rounded-xl px-6 py-2 h-auto text-sm font-semibold transition-all \\\\}
          >
            <Eye className=\w-4
h-4
mr-2\ /> Preview
          </Button>
      </div>

\;
code = code.replace(mobileTabRegex, newMobileTab);

const leftPanelRegex = /className={\w-full lg:w-\\[40%\\] flex-col border-r border-peach-soft\\/50 bg-cream-soft \\$\\{mobileView === 'preview' \\? 'hidden lg:flex' : 'flex min-h-\\[50vh\\] lg:h-full'\\}\}/s;
const newLeftPanelStr = 'className={w-full lg:w-[40%] flex-col border-r border-peach-soft/50 dark:border-white/10 bg-surface dark:bg-slate-900 z-10 }';
code = code.replace(leftPanelRegex, newLeftPanelStr);

const rightPanelRegex = /className={\w-full lg:w-\\[60%\\] bg-peach-soft\\/20 items-center justify-center p-4 lg:p-8 pt-12 lg:pt-16 relative overflow-hidden \\$\\{mobileView === 'edit' \\? 'hidden lg:flex' : 'flex min-h-\\[50vh\\] lg:h-full'\\}\}/s;
const newRightPanelStr = 'className={w-full lg:w-[60%] bg-surface dark:bg-[#1a1a2e] items-center justify-center p-0 lg:p-8 lg:pt-16 relative overflow-hidden transition-all duration-500 z-20 }';
code = code.replace(rightPanelRegex, newRightPanelStr);

const bookPageContainerRegex = /className=\w-full
max-w-md
md:max-w-2xl
aspect-3\\/4
bg-\\[#FFFCF8\\]
border
border-peach-soft
rounded-sm
relative
flex
flex-col
overflow-hidden
transform
transition-transform
duration-500
hover:scale-\\[1\\.01\\]\/s;
const newBookPageContainerStr = 'className=\w-full
h-full
lg:h-auto
lg:max-w-2xl
lg:aspect-3/4
bg-surface
dark:bg-slate-900
lg:border
lg:border-peach-soft
dark:lg:border-white/10
lg:rounded-2xl
relative
flex
flex-col
overflow-hidden
shadow-none
lg:shadow-2xl
transform
transition-transform
duration-500\';
code = code.replace(bookPageContainerRegex, newBookPageContainerStr);

const textContentRegex = /className=\flex-1
p-6
md:p-12
relative
z-20
flex
flex-col
overflow-y-auto\/s;
const newTextContentStr = 'className=\flex-1
p-6
sm:p-8
md:p-12
relative
z-20
flex
flex-col
overflow-y-auto
pb-32
lg:pb-12
bg-surface
dark:bg-slate-900\';
code = code.replace(textContentRegex, newTextContentStr);

const textParaRegex = /className=\font-heading
text-xl
md:text-2xl
lg:text-3xl
text-charcoal-soft
leading-normal
mb-auto\/s;
const newTextParaStr = 'className=\font-heading
text-lg
sm:text-xl
md:text-2xl
lg:text-3xl
text-charcoal-soft
dark:text-slate-200
leading-relaxed
sm:leading-normal
mb-auto\';
code = code.replace(textParaRegex, newTextParaStr);

fs.writeFileSync('components/SmartEditor.tsx', code);
