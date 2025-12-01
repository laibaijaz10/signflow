
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { User, DocumentData, DocumentStatus } from '../types';
import { createDocument, getDocuments } from '../services/storage';
import { generateBasePdf } from '../services/pdfService';
import { Plus, Send, Copy, FileCheck, User as UserIcon, Briefcase, FileText, Trash } from 'lucide-react';
import { DocumentsAPI } from '../services/api';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AgentDashboard({ user, onLogout }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [activeTab, setActiveTab] = useState<'client' | 'project' | 'agency'>('client');
  
  // Form State
  const [formData, setFormData] = useState({
    // Document Meta
    title: '',
    
    // Client Info
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientCityStateZip: '',
    clientCountry: '',

    // Project Info
    projectName: '',
    startDate: '',
    endDate: '',
    scopeOfWork: '',
    paymentTerms: '',
    specialNotes: '',

    // Agency Info
    agencyName: 'SignFlow Agency',
    agencyEmail: user.email,
    agencyPhone: '',
  });

  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const resp = await DocumentsAPI.list();
      setDocs(resp.documents || []);
    } catch (e) {
      const allDocs = getDocuments();
      setDocs(allDocs.filter(d => d.agentId === user.id));
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(load, 10000); // poll every 10s
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [user.id, view]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
     if (!formData.clientEmail.endsWith('@gmail.com')) {
         alert('Client email must be a valid @gmail.com address for secure signing.');
         return false;
     }
     if (!formData.title || !formData.clientName || !formData.projectName) {
         alert('Please fill in required fields (Title, Client Name, Project Name)');
         return false;
     }
     return true;
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setCreating(true);

    try {
        // 1. Generate PDF Base64
        const pdfBase64 = await generateBasePdf({
            ...formData,
            agentId: user.id,
            agentName: user.name,
        });

        // 2. Create on backend
        const payload: any = {
          title: formData.title,
          description: formData.scopeOfWork || undefined,
          fileUrl: pdfBase64,
          // clientId omitted -> backend will find/create by email
          metadata: {
            clientName: formData.clientName,
            clientEmail: formData.clientEmail,
            clientCompany: formData.clientCompany,
            clientPhone: formData.clientPhone,
            clientAddress: formData.clientAddress,
            projectName: formData.projectName,
            startDate: formData.startDate || undefined,
            endDate: formData.endDate || undefined,
            scopeOfWork: formData.scopeOfWork || undefined,
            paymentTerms: formData.paymentTerms || undefined,
            specialNotes: formData.specialNotes || undefined,
            agencyName: formData.agencyName,
            agencyEmail: formData.agencyEmail,
            agencyPhone: formData.agencyPhone || undefined,
          }
        };

        const resp = await DocumentsAPI.create(payload);
        const created = resp.document;

        // 3. Update state from backend
        setDocs([...docs, created]);
        setView('list');
        
        // Reset form to defaults
        setFormData({
            title: '',
            clientName: '',
            clientCompany: '',
            clientEmail: '',
            clientPhone: '',
            clientAddress: '',
            clientCityStateZip: '',
            clientCountry: '',
            projectName: '',
            startDate: '',
            endDate: '',
            scopeOfWork: '',
            paymentTerms: '',
            specialNotes: '',
            agencyName: 'SignFlow Agency',
            agencyEmail: user.email,
            agencyPhone: '',
        });
        setActiveTab('client');
    } catch (err) {
        console.error(err);
        alert("Error creating document. Please try again.");
    } finally {
        setCreating(false);
    }
  };

  const copyLink = async (docOrId: any) => {
    const backendId = String(typeof docOrId === 'string' ? docOrId : (docOrId._id || docOrId.id));
    let token = typeof docOrId === 'string' ? undefined : docOrId.signToken;
    // If token missing, try to refetch document; if still missing, trigger resend to generate a new token
    if (!token && backendId) {
      try {
        const resp = await DocumentsAPI.get(backendId);
        token = resp?.document?.signToken;
        if (!token) {
          await DocumentsAPI.resend(backendId);
          const after = await DocumentsAPI.get(backendId);
          token = after?.document?.signToken;
        }
      } catch {}
    }
    const base = `${window.location.origin}${window.location.pathname}#/sign/${backendId}`;
    const url = token ? `${base}?token=${token}` : base;
    navigator.clipboard.writeText(url);
    alert(`Signing link copied!\n${url}`);
  };

  const resendLink = async (doc: DocumentData) => {
    try {
      const backendId = String((doc as any)._id || (doc as any).id);
      await DocumentsAPI.resend(backendId);
      alert('Signing link has been resent to the client (if SMTP is configured).');
    } catch (e: any) {
      alert(`Failed to resend link: ${e?.message || 'Unknown error'}`);
    }
  };

  const deleteDoc = async (doc: any) => {
    const backendId = String(doc._id || doc.id);
    if (!backendId) return;
    const ok = window.confirm(`Delete document "${doc.title}"? This action cannot be undone.`);
    if (!ok) return;
    try {
      await DocumentsAPI.delete(backendId);
      setDocs(prev => prev.filter(d => (d._id || d.id) !== backendId));
    } catch (e: any) {
      alert(`Failed to delete: ${e?.message || 'Unknown error'}`);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} title="Agent Workspace">
      
      {view === 'list' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Your Documents</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={load}
                className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
              >
                Refresh
              </button>
              <button 
                onClick={() => setView('create')}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-brand-700 flex items-center gap-2"
              >
                <Plus size={18} /> Create New Document
              </button>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {docs.map((doc: any) => (
                  <tr key={doc._id || doc.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                      <div className="text-xs text-gray-500">{doc.projectName || doc?.metadata?.projectName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{doc.clientName || doc?.metadata?.clientName}</div>
                      <div className="text-xs text-gray-500">{doc.clientEmail || doc?.metadata?.clientEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${String(doc.status).toLowerCase() === 'signed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-4">
                      <>
                        <button onClick={() => copyLink(doc)} className="text-brand-600 hover:text-brand-900 flex items-center gap-1">
                          <Copy size={16} /> Copy Link
                        </button>
                        {String(doc.status).toLowerCase() !== 'signed' && (
                          <button onClick={() => resendLink(doc)} className="text-blue-600 hover:text-blue-900 flex items-center gap-1">
                            <Send size={16} /> Resend Link
                          </button>
                        )}
                        {String(doc.status).toLowerCase() === 'signed' ? (
                          <a 
                            href={doc.signedPdfUrl ? `data:application/pdf;base64,${doc.signedPdfUrl}` : undefined}
                            download={`${doc.title}-signed.pdf`}
                            className="text-green-600 hover:text-green-900 flex items-center gap-1"
                          >
                            <FileCheck size={16} /> Download
                          </a>
                        ) : null}
                        <button onClick={() => deleteDoc(doc)} className="text-red-600 hover:text-red-900 flex items-center gap-1">
                          <Trash size={16} /> Delete
                        </button>
                      </>
                    </td>
                  </tr>
                ))}
                {docs.length === 0 && (
                   <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No documents created yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'create' && (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Create Agreement</h3>
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-700">Cancel</button>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col md:flex-row">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2">
                <button 
                  onClick={() => setActiveTab('client')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-colors ${activeTab === 'client' ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <UserIcon size={18} /> Client Information
                </button>
                <button 
                  onClick={() => setActiveTab('project')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-colors ${activeTab === 'project' ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <FileText size={18} /> Project Details
                </button>
                <button 
                  onClick={() => setActiveTab('agency')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-colors ${activeTab === 'agency' ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                    <Briefcase size={18} /> Agency Info
                </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 p-6">
              <form onSubmit={handleCreateDocument} className="space-y-6">
                
                {activeTab === 'client' && (
                    <div className="space-y-4 animate-fadeIn">
                        <h4 className="text-lg font-medium border-b pb-2 mb-4">Client Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                                <input name="clientName" required value={formData.clientName} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Company Name</label>
                                <input name="clientCompany" value={formData.clientCompany} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Gmail Address (Required) *</label>
                                <input name="clientEmail" type="email" required value={formData.clientEmail} onChange={handleInputChange} placeholder="example@gmail.com" className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                                <input name="clientPhone" value={formData.clientPhone} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Address</label>
                                <input name="clientAddress" value={formData.clientAddress} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">City / State / Zip</label>
                                <input name="clientCityStateZip" value={formData.clientCityStateZip} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Country</label>
                                <input name="clientCountry" value={formData.clientCountry} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="button" onClick={() => setActiveTab('project')} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">Next: Project Details</button>
                        </div>
                    </div>
                )}

                {activeTab === 'project' && (
                    <div className="space-y-4 animate-fadeIn">
                        <h4 className="text-lg font-medium border-b pb-2 mb-4">Project & Terms</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Document Title / Type *</label>
                                <input name="title" required value={formData.title} onChange={handleInputChange} placeholder="e.g. Service Agreement, NDA" className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Project Name *</label>
                                <input name="projectName" required value={formData.projectName} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                <input name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">End / Delivery Date</label>
                                <input name="endDate" type="date" value={formData.endDate} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Scope of Work / Description
                                </label>
                                <textarea name="scopeOfWork" rows={5} value={formData.scopeOfWork} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Payment Terms</label>
                                <textarea name="paymentTerms" rows={3} value={formData.paymentTerms} onChange={handleInputChange} placeholder="e.g. 50% upfront, 50% on completion" className="block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Special Notes / Clauses</label>
                                <textarea name="specialNotes" rows={3} value={formData.specialNotes} onChange={handleInputChange} className="block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 gap-2">
                            <button type="button" onClick={() => setActiveTab('client')} className="px-4 py-2 text-gray-600 hover:text-gray-900">Back</button>
                            <button type="button" onClick={() => setActiveTab('agency')} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">Next: Agency Info</button>
                        </div>
                    </div>
                )}

                {activeTab === 'agency' && (
                    <div className="space-y-4 animate-fadeIn">
                        <h4 className="text-lg font-medium border-b pb-2 mb-4">Agency Information</h4>
                         <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Agency / Company Name</label>
                                <input name="agencyName" value={formData.agencyName} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Agent Name</label>
                                <input disabled value={user.name} className="mt-1 block w-full border border-gray-200 bg-gray-50 rounded p-2 text-sm text-gray-500" />
                                <span className="text-xs text-gray-400">Auto-filled from login</span>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Agency Email</label>
                                <input name="agencyEmail" value={formData.agencyEmail} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Agency Phone</label>
                                <input name="agencyPhone" value={formData.agencyPhone} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded p-2 text-sm" />
                            </div>
                        </div>

                         <div className="flex justify-end pt-6 gap-2 border-t mt-6">
                            <button type="button" onClick={() => setActiveTab('project')} className="px-4 py-2 text-gray-600 hover:text-gray-900">Back</button>
                             <button
                                type="submit"
                                disabled={creating}
                                className="bg-brand-600 text-white px-6 py-2 rounded shadow-sm hover:bg-brand-700 flex items-center gap-2 font-medium disabled:opacity-50"
                                >
                                <Send size={18} /> {creating ? 'Generating PDF...' : 'Create & Send Agreement'}
                            </button>
                        </div>
                    </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
