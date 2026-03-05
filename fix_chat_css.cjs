const fs = require('fs');

let cssPath = './components/ChatWidget.css';
if (fs.existsSync(cssPath)) {
    let cssCnt = fs.readFileSync(cssPath, 'utf8');
    
    // Replace raw 'background: white' or '#fff' with CSS variables
    cssCnt = cssCnt.replace(/background:\s*white;?/g, 'background: var(--color-surface);');
    cssCnt = cssCnt.replace(/background-color:\s*white;?/g, 'background-color: var(--color-surface);');
    cssCnt = cssCnt.replace(/background:\s*#ffffff;?/g, 'background: var(--color-surface);');
    cssCnt = cssCnt.replace(/background:\s*#fff;?/g, 'background: var(--color-surface);');
    cssCnt = cssCnt.replace(/background-color:\s*#fff;?/g, 'background-color: var(--color-surface);');
    
    fs.writeFileSync(cssPath, cssCnt, 'utf8');
    console.log('Fixed ChatWidget.css');
}

let idxPath = './index.css';
if (fs.existsSync(idxPath)) {
    let idxCnt = fs.readFileSync(idxPath, 'utf8');
    
    idxCnt = idxCnt.replace(/background:\s*#fff;?/g, 'background: var(--color-background);');
    idxCnt = idxCnt.replace(/background-color:\s*#fff;?/g, 'background-color: var(--color-background);');
    idxCnt = idxCnt.replace(/background:\s*white;?/g, 'background: var(--color-background);');
    idxCnt = idxCnt.replace(/background-color:\s*white;?/g, 'background-color: var(--color-background);');
    
    fs.writeFileSync(idxPath, idxCnt, 'utf8');
    console.log('Fixed index.css');
}
