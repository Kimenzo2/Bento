import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports a DOM element as a high-quality PNG image
 * @param elementId The ID of the DOM element to export
 * @param fileName The name of the file to save
 */
export const exportToPNG = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID ${elementId} not found`);
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            scale: 3, // High resolution
            useCORS: true, // Allow cross-origin images
            backgroundColor: '#ffffff', // Ensure white background
            logging: false
        });

        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Error exporting to PNG:', error);
    }
};

/**
 * Exports a DOM element as a PDF document
 * @param elementId The ID of the DOM element to export
 * @param fileName The name of the file to save
 */
export const exportToPDF = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID ${elementId} not found`);
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            scale: 2, // Good balance for PDF
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height] // Match canvas dimensions
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileName}.pdf`);
    } catch (error) {
        console.error('Error exporting to PDF:', error);
    }
};

/**
 * Triggers the browser print dialog for a specific element
 * @param elementId The ID of the DOM element to print
 */
export const printElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID ${elementId} not found`);
        return;
    }

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>Print Infographic</title>
                    <style>
                        body { margin: 0; display: flex; justify-content: center; }
                        img { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    ${element.outerHTML}
                </body>
            </html>
        `);
        doc.close();

        // Wait for content to load then print
        iframe.contentWindow?.focus();
        setTimeout(() => {
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    }
};
