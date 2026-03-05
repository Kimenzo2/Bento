const fs = require('fs');
const path = require('path');

function replaceFile(p, fromRegex, toStr) {
    let cnt = fs.readFileSync(p, 'utf8');
    if (cnt.match(fromRegex)) {
        cnt = cnt.replace(fromRegex, toStr);
        fs.writeFileSync(p, cnt, 'utf8');
        console.log('Fixed ' + p);
    }
}

replaceFile('components/CurriculumAssessment.tsx', /className="text-surface"/g, 'className="text-charcoal-soft"');
replaceFile('components/SharedBookViewer.tsx', /text-charcoal-soft dark:text-surface/g, 'text-charcoal-soft');
replaceFile('components/StorybookViewer.tsx', /text-surface text-base/g, 'text-charcoal-soft text-base');

// Also handle any stray text-white that might be directly inside standard structural div text
