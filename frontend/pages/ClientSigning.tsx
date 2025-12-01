
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { DocumentData, DocumentStatus } from '../types';
import { DocumentsAPI } from '../services/api';
import { embedSignature } from '../services/pdfService';
import { PenTool, Upload, RefreshCw, CheckCircle, Lock } from 'lucide-react';

export default function ClientSigning() {
  const { token: pathToken } = useParams<{ token: string }>();
  const location = useLocation();
  const [doc, setDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Auth State
  const [email, setEmail] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  // Signing State
  const [signingMethod, setSigningMethod] = useState<'draw' | 'upload'>('draw');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Parse docId and token from hash: #/sign/:id?token=...
  const parseIds = () => {
    const rawHash = location.hash || window.location.hash || '';
    const withoutHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash; // '/sign/:id?token=...'
    const [pathPart, queryPart] = withoutHash.split('?');
    const pathSegments = (pathPart || '').split('/'); // ['', 'sign', ':id']
    const docId = pathSegments[2] || '';
    const params = new URLSearchParams(queryPart || '');
    const t = params.get('token') || '';
    return { docId, token: t };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { docId, token } = parseIds();
        if (!docId || !token) {
          setError('Invalid Document Link');
          setLoading(false);
          return;
        }
        const resp = await DocumentsAPI.getPublic(docId, token);
        setDoc({ ...resp.document, _id: docId, signToken: token });
      } catch (e: any) {
        setError('Invalid Document Link');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [location.key]);

  // Auth Handler (Mock Google Login)
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc) return;
    
    // Simulate Google OAuth check
    const expected = (doc.metadata?.clientEmail || '').toLowerCase().trim();
    if (expected && email.toLowerCase().trim() === expected) {
      setAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError(`Access Denied. This document is exclusively assigned to ${expected || 'the invited email'}.`);
    }
  };

  // Canvas Logic
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Normalize to PNG on a white background to ensure visibility and pdf-lib compatibility
        const MAX_W = 600;
        const MAX_H = 200;
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
        const c = document.createElement('canvas');
        c.width = MAX_W;
        c.height = MAX_H;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        // white background then center the signature image
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        const x = Math.round((MAX_W - w) / 2);
        const y = Math.round((MAX_H - h) / 2);
        ctx.drawImage(img, x, y, w, h);
        const data = c.toDataURL('image/png');
        setSignatureData(data);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const submitSignature = async () => {
    if (!doc || !signatureData) return;
    setSubmitting(true);
    
    try {
      // 1. For now, send signature image; backend stores it and marks signed
      await DocumentsAPI.sign(doc._id || doc.id, { dataUrl: signatureData, token: doc.signToken });
      
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Failed to sign document');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Secure Document...</div>;
  if (error || !doc) return <div className="p-10 text-center text-red-600 font-bold">{error || 'Document not found'}</div>;
  if (doc.status === DocumentStatus.SIGNED && !success) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg shadow text-center max-w-md">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Already Signed</h2>
                <p className="text-gray-600 mb-6">This document was signed on {new Date(doc.signedAt!).toLocaleString()}.</p>
                {doc.signedPdfUrl && (
                  <a 
                    href={`data:application/pdf;base64,${doc.signedPdfUrl}`} 
                    download="signed_document.pdf"
                    className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700"
                  >
                    Download Copy
                  </a>
                )}
            </div>
        </div>
    );
  }

  // --- Step 1: Authentication ---
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center mb-6">
            <Lock size={40} className="mx-auto text-brand-600 mb-2" />
            <h2 className="text-xl font-bold">Secure Document Access</h2>
            <p className="text-sm text-gray-500 mt-2">You have been invited to sign <b>{doc.title}</b>.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Verify Identity with Gmail</label>
               <input 
                 type="email" 
                 required 
                 value={email}
                 onChange={e => setEmail(e.target.value)}
                 className="w-full px-4 py-2 border rounded-md focus:ring-brand-500 focus:border-brand-500"
                 placeholder="Enter your google email"
               />
               <p className="text-xs text-gray-400 mt-1">Simulating "Sign in with Google"</p>
            </div>
            
            {authError && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{authError}</div>}
            
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition">
              Verify & View Document
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Step 3: Success View ---
  if (success) {
    return (
        <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                    <CheckCircle size={40} className="text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Document Signed Successfully!</h1>
                <p className="text-gray-600 mb-8">Thank you, {email}. A copy has been saved.</p>
            </div>
        </div>
    );
  }

  // --- Step 2: Signing Interface ---
  const pdfSrc = doc.fileUrl?.startsWith('data:application/pdf') ? doc.fileUrl : `data:application/pdf;base64,${doc.fileUrl || ''}`;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
        <h1 className="text-lg font-bold truncate">{doc.title}</h1>
        <div className="text-sm text-gray-500">Signing as: <span className="font-medium text-gray-900">{email}</span></div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* PDF Preview */}
        <div className="flex-1 bg-gray-500 p-4 overflow-auto flex justify-center">
            {/* Using iframe for simplicity in this demo environment. Ideally use react-pdf */}
            <iframe 
                src={`${pdfSrc}#toolbar=0&navpanes=0`} 
                className="w-full max-w-2xl h-full shadow-lg bg-white" 
                title="Document PDF"
            />
        </div>

        {/* Signing Controls */}
        <div className="w-full lg:w-96 bg-white border-l border-gray-200 p-6 flex flex-col shadow-xl z-20">
          <h3 className="text-lg font-semibold mb-6">Sign Document</h3>

          <div className="flex gap-2 mb-4">
            <button 
              onClick={() => setSigningMethod('draw')}
              className={`flex-1 py-2 text-sm font-medium rounded border ${signingMethod === 'draw' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-gray-300 text-gray-600'}`}
            >
              Draw
            </button>
            <button 
               onClick={() => setSigningMethod('upload')}
               className={`flex-1 py-2 text-sm font-medium rounded border ${signingMethod === 'upload' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-gray-300 text-gray-600'}`}
            >
              Upload
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center">
             {signingMethod === 'draw' ? (
               <div className="mb-4">
                 <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 relative touch-none">
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={150}
                      className="w-full h-[150px] cursor-crosshair rounded-lg"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <button onClick={clearCanvas} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100" title="Clear">
                       <RefreshCw size={14} />
                    </button>
                 </div>
                 <p className="text-xs text-center mt-2 text-gray-500">Draw your signature above</p>
               </div>
             ) : (
                <div className="mb-4 border-2 border-dashed border-gray-300 rounded-lg h-[150px] flex flex-col items-center justify-center bg-gray-50">
                   <Upload className="text-gray-400 mb-2" />
                   <input type="file" accept="image/*" onChange={handleFileUpload} className="text-sm text-gray-500 ml-8" />
                </div>
             )}

             {signatureData && (
                <div className="bg-green-50 p-2 rounded border border-green-200 text-green-800 text-sm text-center mb-4">
                   Signature captured successfully
                </div>
             )}
          </div>

          <div className="mt-auto pt-6 border-t border-gray-100">
             <div className="flex items-center mb-4">
                <input type="checkbox" id="consent" className="h-4 w-4 text-brand-600 rounded" defaultChecked />
                <label htmlFor="consent" className="ml-2 block text-xs text-gray-600">
                  I agree to be legally bound by this document and signature.
                </label>
             </div>
             <button
               onClick={submitSignature}
               disabled={!signatureData || submitting}
               className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
             >
                {submitting ? 'Signing...' : <><PenTool size={18} /> Sign Document</>}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
