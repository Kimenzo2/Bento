import { jsPDF } from "jspdf";
import { BookProject } from "../../types";

export const generatePDF = async (project: Partial<BookProject>): Promise<Blob> => {
    const doc = new jsPDF();

    // Title Page
    doc.setFontSize(24);
    doc.text(project.title || "Untitled", 105, 100, { align: "center" });
    doc.setFontSize(16);
    doc.text(project.synopsis || "", 105, 120, { align: "center", maxWidth: 150 });

    doc.addPage();

    // Chapters
    project.chapters?.forEach((chapter: any) => {
        doc.setFontSize(20);
        doc.text(chapter.title, 20, 30);

        chapter.pages.forEach((page: any, pIndex: number) => {
            doc.setFontSize(12);
            doc.text(`Page ${page.pageNumber}`, 20, 50);
            doc.text(page.text, 20, 60, { maxWidth: 170 });

            // Placeholder for image
            doc.setDrawColor(200);
            doc.rect(20, 100, 170, 100); // Placeholder box
            doc.setFontSize(10);
            doc.text(`[Image: ${page.imagePrompt.substring(0, 50)}...]`, 25, 150);

            doc.addPage();
        });
    });

    return doc.output("blob");
};
