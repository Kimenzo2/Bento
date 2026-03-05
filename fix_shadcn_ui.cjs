const fs = require('fs');

function fixFile(path, replacer) {
    if (!fs.existsSync(path)) return;
    let cnt = fs.readFileSync(path, 'utf8');
    let orig = cnt;
    cnt = replacer(cnt);
    if (cnt !== orig) {
        fs.writeFileSync(path, cnt, 'utf8');
        console.log('Fixed ' + path);
    }
}

fixFile('./components/ui/button.tsx', (cnt) => {
    return cnt.replace(
        /default: "bg-surface hover:bg-surface-hover text-charcoal-soft"/,
        'default: "bg-surface hover:bg-surface-hover text-charcoal-soft dark:bg-white dark:text-black dark:hover:bg-white/90"'
    ).replace(
        /destructive: "bg-red-500 text-white hover:bg-red-600"/,
        'destructive: "bg-red-500 text-white hover:bg-red-600 dark:bg-red-900 dark:text-red-100"'
    ).replace(
        /outline: "border border-peach-soft bg-transparent hover:bg-peach-soft\/30 text-charcoal-soft"/,
        'outline: "border border-peach-soft bg-transparent hover:bg-peach-soft\/30 text-charcoal-soft dark:border-white/20 dark:text-white dark:hover:bg-white/10"'
    ).replace(
        /secondary: "bg-peach-soft\/20 text-charcoal-soft hover:bg-peach-soft\/40"/,
        'secondary: "bg-peach-soft\/20 text-charcoal-soft hover:bg-peach-soft\/40 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"'
    )
    .replace(
        /ghost: "hover:bg-peach-soft\/30 hover:text-charcoal-soft text-cocoa-light"/,
        'ghost: "hover:bg-peach-soft\/30 hover:text-charcoal-soft text-cocoa-light dark:hover:bg-white/10 dark:text-white"'
    );
});

fixFile('./components/ui/badge.tsx', (cnt) => {
    return cnt.replace(
        /default:\n * "border-transparent bg-charcoal-soft text-white shadow hover:bg-charcoal-soft\/90",/,
        'default:\n          "border-transparent bg-charcoal-soft text-white shadow hover:bg-charcoal-soft/90 dark:bg-white dark:text-black dark:hover:bg-white/90",'
    ).replace(
        /secondary:\n * "border-transparent bg-peach-soft\/30 text-charcoal-soft hover:bg-peach-soft\/50",/,
        'secondary:\n          "border-transparent bg-peach-soft/30 text-charcoal-soft hover:bg-peach-soft/50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",'
    );
});
