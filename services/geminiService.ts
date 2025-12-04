import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert data extraction assistant for a motorsport events procurement team.
Your task is to extract structured data from supplier invoice images/PDFs.
The data will be used to populate an Invoice Request Form (IRF).

Key requirements:
1. Extract the supplier name, email address, full address, specific postcode, country, invoice number, date, and PO number (if available).
2. Extract the table of line items (description, quantity, unit price, line total).
3. Extract financial totals (subtotal, VAT/Tax amount, and Grand Total).
4. Identify the currency code (e.g., USD, EUR, GBP).
5. Extract a brief description/summary of what the invoice is for (e.g. "Hospitality Services", "Track Rental").
6. If a field is not found, return an empty string or 0.
7. Be highly accurate with numbers.
`;

export const extractInvoiceData = async (file: File): Promise<InvoiceData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert File to Base64
  const base64Data = await fileToGenerativePart(file);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        },
        {
          text: "Extract data from this invoice.",
        },
      ],
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          supplierName: { type: Type.STRING },
          supplierEmail: { type: Type.STRING },
          supplierAddress: { type: Type.STRING },
          supplierPostcode: { type: Type.STRING },
          supplierCountry: { type: Type.STRING },
          invoiceNumber: { type: Type.STRING },
          invoiceDate: { type: Type.STRING },
          poNumber: { type: Type.STRING },
          invoiceDescription: { type: Type.STRING, description: "A brief summary of the services or goods provided" },
          currency: { type: Type.STRING },
          taxRate: { type: Type.STRING, description: "The tax percentage or rate if found" },
          subtotal: { type: Type.NUMBER },
          vatAmount: { type: Type.NUMBER },
          grandTotal: { type: Type.NUMBER },
          lineItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                total: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("No data returned from Gemini.");
  }

  try {
    const data = JSON.parse(response.text);
    return data as InvoiceData;
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    throw new Error("Failed to parse invoice data.");
  }
};

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Content = base64String.split(",")[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};