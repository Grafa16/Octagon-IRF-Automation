import React, { useState, useEffect, useRef } from 'react';
import { InvoiceData, AppState } from './types';
import { extractInvoiceData } from './services/geminiService';
import { generateIRF } from './services/docService';
import { UploadIcon, FileIcon, CheckIcon, RefreshIcon, DownloadIcon, ChevronRightIcon, InfoIcon, XMarkIcon } from './components/Icon';

const INITIAL_DATA: InvoiceData = {
  supplierName: '',
  supplierAddress: '',
  supplierPostcode: '',
  supplierCountry: '',
  supplierEmail: '',
  invoiceNumber: '',
  invoiceDate: '',
  poNumber: '',
  invoiceDescription: '',
  currency: 'USD',
  taxRate: '',
  subtotal: 0,
  vatAmount: 0,
  grandTotal: 0,
  lineItems: []
};

function App() {
  const [state, setState] = useState<AppState>({
    status: 'idle',
    invoiceFile: null,
    templateFile: null,
    extractedData: null,
    errorMessage: null
  });

  const [activeTab, setActiveTab] = useState<'details' | 'items'>('details');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleFileUpload = (type: 'invoice' | 'template', file: File) => {
    setState(prev => ({
      ...prev,
      [type === 'invoice' ? 'invoiceFile' : 'templateFile']: file,
      errorMessage: null // Clear errors on new upload
    }));
  };

  const startExtraction = async () => {
    if (!state.invoiceFile) return;

    setState(prev => ({ ...prev, status: 'analyzing', errorMessage: null }));

    try {
      const data = await extractInvoiceData(state.invoiceFile);
      setState(prev => ({
        ...prev,
        status: 'complete',
        extractedData: data
      }));
    } catch (error: any) {
      console.error(error);
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message || "Failed to extract data."
      }));
    }
  };

  const handleDataChange = (field: keyof InvoiceData, value: any) => {
    if (!state.extractedData) return;
    setState(prev => ({
      ...prev,
      extractedData: {
        ...prev.extractedData!,
        [field]: value
      }
    }));
  };

  const handleLineItemChange = (index: number, field: keyof InvoiceData['lineItems'][0], value: any) => {
    if (!state.extractedData) return;
    const newItems = [...state.extractedData.lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setState(prev => ({
      ...prev,
      extractedData: {
        ...prev.extractedData!,
        lineItems: newItems
      }
    }));
  };

  const handleDownload = async () => {
    if (!state.templateFile || !state.extractedData) {
      alert("Please ensure both a template is uploaded and data is extracted.");
      return;
    }
    try {
      const blob = await generateIRF(state.templateFile, state.extractedData);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IRF-${state.extractedData.invoiceNumber || 'Draft'}.docx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      // Reset to home page after short delay, preserving the template
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          status: 'idle',
          invoiceFile: null,
          extractedData: null,
          errorMessage: null
        }));
      }, 1500);

    } catch (e: any) {
      alert(`Error generating document: ${e.message}`);
    }
  };

  const reset = () => {
    setState({
      status: 'idle',
      invoiceFile: null,
      templateFile: null,
      extractedData: null,
      errorMessage: null
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-md">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Octagon IRF <span className="text-slate-400 font-normal">| Motorsport Automation</span></h1>
          </div>
          <div className="flex items-center space-x-4">
             {state.status === 'complete' && (
              <button onClick={reset} className="text-sm text-slate-500 hover:text-indigo-600 flex items-center transition-colors">
                <RefreshIcon /> New Invoice
              </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* Template Guide Modal */}
        {isGuideOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-slate-900">Template Tag Guide</h3>
                <button onClick={() => setIsGuideOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XMarkIcon />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <p className="text-indigo-800 text-sm">
                    <strong>How it works:</strong> Add these tags (variables) to your Word document. The app will replace them with the extracted data.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Basic Fields</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <TagRow tag="{supplierName}" desc="Supplier Name" />
                    <TagRow tag="{supplierEmail}" desc="Supplier Email" />
                    <TagRow tag="{invoiceNumber}" desc="Invoice #" />
                    <TagRow tag="{invoiceDate}" desc="Date (YYYY-MM-DD)" />
                    <TagRow tag="{poNumber}" desc="Purchase Order #" />
                    <TagRow tag="{invoiceDescription}" desc="Description of Services" />
                    <TagRow tag="{currency}" desc="Currency Code (e.g., USD)" />
                    <TagRow tag="{taxRate}" desc="Tax Rate / %" />
                    <TagRow tag="{subtotal}" desc="Subtotal Amount" />
                    <TagRow tag="{vatAmount}" desc="VAT/Tax Amount" />
                    <TagRow tag="{grandTotal}" desc="Total Amount Due" />
                    <TagRow tag="{generatedDate}" desc="Today's Date" />
                  </div>
                </div>

                <div>
                   <h4 className="font-semibold text-slate-900 mb-2">Address Fields</h4>
                   <div className="grid grid-cols-2 gap-2 text-sm">
                    <TagRow tag="{supplierAddress}" desc="Full Address Block" />
                    <TagRow tag="{supplierPostcode}" desc="Postal/Zip Code" />
                    <TagRow tag="{supplierCountry}" desc="Country" />
                   </div>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Line Items Table</h4>
                  <p className="text-sm text-slate-500 mb-3">To list items, create a table row in Word and wrap the fields with the loop tags:</p>
                  <div className="bg-slate-100 p-4 rounded-lg font-mono text-xs border border-slate-200">
                     <span className="text-blue-600">{`{#lineItems}`}</span><br/>
                     <span className="ml-4">Description: {`{description}`}</span><br/>
                     <span className="ml-4">Qty: {`{quantity}`}</span><br/>
                     <span className="ml-4">Price: {`{unitPrice}`}</span><br/>
                     <span className="ml-4">Total: {`{total}`}</span><br/>
                     <span className="text-blue-600">{`{/lineItems}`}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">Note: Place the opening and closing tags inside the table row to repeat that row for each item.</p>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
                <button 
                  onClick={() => setIsGuideOpen(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {state.status === 'idle' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-slate-900">Upload Documents</h2>
              <p className="text-slate-500">Upload the supplier invoice (PDF/Image) and the IRF Template (.docx).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Upload */}
              <UploadCard 
                title="Supplier Invoice"
                accept=".pdf,.jpg,.png,.jpeg"
                file={state.invoiceFile}
                onUpload={(f) => handleFileUpload('invoice', f)}
              />
              {/* Template Upload */}
              <div className="relative">
                <UploadCard 
                  title="IRF Template (.docx)"
                  accept=".docx"
                  file={state.templateFile}
                  onUpload={(f) => handleFileUpload('template', f)}
                />
                <button 
                  onClick={() => setIsGuideOpen(true)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition-colors p-1"
                  title="View Template Instructions"
                >
                  <InfoIcon />
                </button>
                 <div className="mt-2 text-center">
                  <button onClick={() => setIsGuideOpen(true)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline decoration-indigo-200 hover:decoration-indigo-800 underline-offset-2">
                    How should I format my template?
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <button
                disabled={!state.invoiceFile || !state.templateFile}
                onClick={startExtraction}
                className="group relative inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Process Invoice
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {state.status === 'analyzing' && (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-slate-800">Analyzing Invoice...</h3>
              <p className="text-slate-500">Extracting vendor details, line items, and financial data.</p>
            </div>
          </div>
        )}

        {/* Step 3: Error */}
        {state.status === 'error' && (
           <div className="max-w-2xl mx-auto text-center mt-20 p-8 bg-white rounded-2xl shadow-sm border border-red-100">
             <div className="h-12 w-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
               <span className="text-xl font-bold">!</span>
             </div>
             <h3 className="text-lg font-bold text-slate-900 mb-2">Processing Failed</h3>
             <p className="text-slate-600 mb-6">{state.errorMessage}</p>
             <button onClick={reset} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
               Try Again
             </button>
           </div>
        )}

        {/* Step 4: Review & Export */}
        {state.status === 'complete' && state.extractedData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-8rem)]">
            
            {/* Left: PDF Preview */}
            <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col">
              <div className="bg-slate-900 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                <span className="text-slate-300 font-medium text-sm">Original Document</span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">Read Only</span>
              </div>
              <div className="flex-1 bg-slate-200 relative">
                 {state.invoiceFile && (
                   <iframe 
                     src={URL.createObjectURL(state.invoiceFile)} 
                     className="w-full h-full"
                     title="Invoice Preview"
                   />
                 )}
              </div>
            </div>

            {/* Right: Data Form */}
            <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              
              {/* Form Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                   <h3 className="text-lg font-bold text-slate-800">Review Data</h3>
                   <p className="text-xs text-slate-500">Verify extracted fields before generating IRF.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setIsGuideOpen(true)}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                    title="View Template Instructions"
                  >
                    <InfoIcon />
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-all text-sm font-medium"
                  >
                    <DownloadIcon />
                    Generate IRF
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 px-6">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Invoice Details
                </button>
                <button 
                  onClick={() => setActiveTab('items')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'items' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Line Items ({state.extractedData.lineItems.length})
                </button>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                
                {activeTab === 'details' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Supplier Name" value={state.extractedData.supplierName} onChange={(v) => handleDataChange('supplierName', v)} />
                      <Input label="Supplier Email" value={state.extractedData.supplierEmail} onChange={(v) => handleDataChange('supplierEmail', v)} />
                      <Input label="Invoice Number" value={state.extractedData.invoiceNumber} onChange={(v) => handleDataChange('invoiceNumber', v)} />
                      <Input label="Invoice Date" type="date" value={state.extractedData.invoiceDate} onChange={(v) => handleDataChange('invoiceDate', v)} />
                      <Input label="PO Number" value={state.extractedData.poNumber} onChange={(v) => handleDataChange('poNumber', v)} />
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Currency" value={state.extractedData.currency} onChange={(v) => handleDataChange('currency', v)} />
                        <Input label="Tax Rate" value={state.extractedData.taxRate} onChange={(v) => handleDataChange('taxRate', v)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Invoice Description / Text</label>
                       <textarea 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow resize-none h-16"
                        value={state.extractedData.invoiceDescription}
                        onChange={(e) => handleDataChange('invoiceDescription', e.target.value)}
                        placeholder="Brief summary of what this invoice is for..."
                      />
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                       <h4 className="text-sm font-semibold text-slate-900 mb-4">Totals</h4>
                       <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg">
                          <Input label="Subtotal" type="number" value={state.extractedData.subtotal} onChange={(v) => handleDataChange('subtotal', Number(v))} />
                          <Input label="VAT / Tax" type="number" value={state.extractedData.vatAmount} onChange={(v) => handleDataChange('vatAmount', Number(v))} />
                          <Input label="Grand Total" type="number" value={state.extractedData.grandTotal} onChange={(v) => handleDataChange('grandTotal', Number(v))} highlight />
                       </div>
                    </div>

                    <div className="pt-4">
                      <h4 className="text-sm font-semibold text-slate-900 mb-2">Address Details</h4>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <Input label="Postcode" value={state.extractedData.supplierPostcode} onChange={(v) => handleDataChange('supplierPostcode', v)} />
                        <Input label="Country" value={state.extractedData.supplierCountry} onChange={(v) => handleDataChange('supplierCountry', v)} />
                      </div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Street Address</label>
                      <textarea 
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow resize-none h-20"
                        value={state.extractedData.supplierAddress}
                        onChange={(e) => handleDataChange('supplierAddress', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {state.extractedData.lineItems.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                         <div className="flex justify-between items-start">
                           <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                           <button 
                            className="text-xs text-red-500 hover:text-red-700"
                            onClick={() => {
                               if(!state.extractedData) return;
                               const newItems = state.extractedData.lineItems.filter((_, i) => i !== idx);
                               handleDataChange('lineItems', newItems);
                            }}
                           >
                             Remove
                           </button>
                         </div>
                         <div className="grid grid-cols-12 gap-3">
                           <div className="col-span-6">
                              <Input label="Description" value={item.description} onChange={(v) => handleLineItemChange(idx, 'description', v)} />
                           </div>
                           <div className="col-span-2">
                              <Input label="Qty" type="number" value={item.quantity} onChange={(v) => handleLineItemChange(idx, 'quantity', Number(v))} />
                           </div>
                           <div className="col-span-2">
                              <Input label="Unit Price" type="number" value={item.unitPrice} onChange={(v) => handleLineItemChange(idx, 'unitPrice', Number(v))} />
                           </div>
                           <div className="col-span-2">
                              <Input label="Total" type="number" value={item.total} onChange={(v) => handleLineItemChange(idx, 'total', Number(v))} />
                           </div>
                         </div>
                      </div>
                    ))}
                    <button 
                      className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-500 hover:text-indigo-600 font-medium text-sm transition-all"
                      onClick={() => {
                        if(!state.extractedData) return;
                        handleDataChange('lineItems', [...state.extractedData.lineItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
                      }}
                    >
                      + Add Item
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Sub-components

const UploadCard = ({ title, accept, file, onUpload }: { title: string, accept: string, file: File | null, onUpload: (f: File) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 ease-in-out p-8 flex flex-col items-center justify-center h-64 bg-white hover:bg-slate-50
        ${file ? 'border-green-500 ring-2 ring-green-500/10' : 'border-slate-300 hover:border-indigo-400'}`}
    >
      <input 
        type="file" 
        accept={accept} 
        className="hidden" 
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
      />
      
      {file ? (
        <div className="text-center animate-fade-in">
          <div className="mx-auto bg-green-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-3">
            <CheckIcon />
          </div>
          <p className="font-medium text-slate-900 truncate max-w-[200px]">{file.name}</p>
          <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          <p className="text-xs text-green-600 font-medium mt-2">Ready to process</p>
        </div>
      ) : (
        <div className="text-center group-hover:-translate-y-1 transition-transform">
          <div className="mx-auto bg-slate-50 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-3 group-hover:bg-indigo-50">
            {accept.includes('docx') ? <FileIcon /> : <UploadIcon />}
          </div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">Drag & drop or click to browse</p>
          <p className="text-xs text-slate-400 mt-2 uppercase tracking-wide">{accept.replace(/,/g, ' ')}</p>
        </div>
      )}
    </div>
  );
};

const TagRow = ({ tag, desc }: { tag: string, desc: string }) => (
  <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded border-b border-slate-100 last:border-0">
    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono select-all cursor-pointer" title="Click to copy" onClick={() => navigator.clipboard.writeText(tag)}>{tag}</code>
    <span className="text-slate-500 text-xs text-right">{desc}</span>
  </div>
);

const Input = ({ label, value, onChange, type = "text", highlight = false, className = "" }: { label: string, value: any, onChange: (v: any) => void, type?: string, highlight?: boolean, className?: string }) => (
  <div className={className}>
    <label className={`block text-xs font-semibold uppercase tracking-wide mb-1 ${highlight ? 'text-indigo-600' : 'text-slate-500'}`}>{label}</label>
    <input 
      type={type} 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 outline-none transition-shadow ${highlight ? 'bg-indigo-50 border-indigo-200 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-900' : 'bg-white border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900'}`} 
    />
  </div>
);

export default App;