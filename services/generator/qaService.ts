// QA Service - simplified for build compatibility
export const performQualityCheck = (project: any, characterSheets: any[]): string[] => {
    const issues: string[] = [];

    // Check for missing fields
    if (!project.title) issues.push("Missing Title");
    if (!project.chapters || project.chapters.length === 0) issues.push("No chapters generated");

    // Check character consistency in prompts
    project.chapters?.forEach((chapter: any, cIndex: number) => {
        chapter.pages.forEach((page: any, pIndex: number) => {
            // Check if character names appear in image prompts
            characterSheets.forEach((sheet: any) => {
                if (page.text.includes(sheet.baseProfile.name)) {
                    // If character is in text, they should likely be in the image prompt
                    // This is a heuristic, not a hard rule, but good for QA
                    if (!page.imagePrompt.includes(sheet.baseProfile.name)) {
                        issues.push(`Page ${page.pageNumber}: Character '${sheet.baseProfile.name}' mentioned in text but missing from image prompt.`);
                    }
                }
            });
        });
    });

    return issues;
};
