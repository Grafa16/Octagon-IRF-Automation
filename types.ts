export interface LineItem {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  total: number | string;
}

export interface InvoiceData {
  supplierName: string;
  supplierAddress: string;
  supplierPostcode: string;
  supplierCountry: string;
  supplierEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  poNumber: string;
  invoiceDescription: string;
  currency: string;
  taxRate: string;
  subtotal: number | string;
  vatAmount: number | string;
  grandTotal: number | string;
  lineItems: LineItem[];
}

export type ProcessingStatus = 'idle' | 'analyzing' | 'complete' | 'error';

export interface AppState {
  status: ProcessingStatus;
  invoiceFile: File | null;
  templateFile: File | null;
  extractedData: InvoiceData | null;
  errorMessage: string | null;
}