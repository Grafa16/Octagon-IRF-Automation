import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { InvoiceData } from '../types';

// Helper to ensure no null/undefined values reach the template
const sanitizeData = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (typeof data === 'object' && data !== null) {
    const cleaned: any = {};
    for (const key in data) {
      cleaned[key] = sanitizeData(data[key]);
    }
    return cleaned;
  }
  if (data === null || data === undefined) {
    return "";
  }
  return data;
};

export const generateIRF = async (templateFile: File, data: InvoiceData): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = reject;

    reader.onloadend = () => {
      try {
        const content = reader.result as ArrayBuffer;
        
        // Load the docx file as binary
        const zip = new PizZip(content);
        
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        // Format numbers for display
        const rawTemplateData = {
          ...data,
          grandTotal: typeof data.grandTotal === 'number' 
            ? data.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) 
            : data.grandTotal,
          subtotal: typeof data.subtotal === 'number'
            ? data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : data.subtotal,
          vatAmount: typeof data.vatAmount === 'number'
            ? data.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : data.vatAmount,
          generatedDate: new Date().toLocaleDateString(),
        };

        // Ensure robust data structure
        const templateData = sanitizeData(rawTemplateData);

        // Render the document
        // Docxtemplater replaces {tag} with value from templateData
        doc.render(templateData);

        const out = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        resolve(out);
      } catch (error: any) {
        console.error("Error generating document:", error);
        
        // Docxtemplater error handling
        if (error.properties && error.properties.errors) {
            const errorMessages = error.properties.errors.map((e: any) => e.message).join('\n');
            console.error('Template Errors:', errorMessages);
            reject(new Error(`Template Error: ${errorMessages}`));
        } else {
            reject(error);
        }
      }
    };

    reader.readAsArrayBuffer(templateFile);
  });
};