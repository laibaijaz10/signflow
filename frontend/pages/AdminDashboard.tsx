
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { User, Agent, DocumentData, DocumentStatus } from '../types';
import { getAgents, createAgent, toggleAgentStatus } from '../services/storage';
import { DocumentsAPI } from '../services/api';
import { Plus, CheckCircle, XCircle, FileText, User as UserIcon } from 'lucide-react';
import { AuthAPI } from '../services/api';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');

  const refreshData = () => {
    setAgents(getAgents());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Load documents from backend and poll
  const loadDocs = async () => {
    try {
      const resp = await DocumentsAPI.list();
      setDocs(resp.documents || []);
    } catch (_) {
      // leave docs as-is if backend unreachable
    }
  };

  useEffect(() => {
    loadDocs();
    const onFocus = () => loadDocs();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(loadDocs, 10000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    // Try backend first to persist a real agent account with password
    try {
      if (!newAgentPassword) throw new Error('Password is required');
      const resp = await AuthAPI.register({
        name: newAgentName,
        email: newAgentEmail,
        password: newAgentPassword,
        role: 'agent',
      } as any);
      // Optimistically add to UI list
      setAgents(prev => ([
        ...prev,
        {
          id: String(resp?.user?.id || resp?.user?._id || Date.now()),
          email: resp?.user?.email || newAgentEmail,
          name: resp?.user?.name || newAgentName,
          createdBy: user.id,
          active: true,
          role: 'agent',
        } as Agent,
      ]));
    } catch (_) {
      // Fallback to local mock if backend unavailable
      createAgent({
        email: newAgentEmail,
        name: newAgentName,
        createdBy: user.id,
        active: true,
      });
    } finally {
      setShowAddAgent(false);
      setNewAgentEmail('');
      setNewAgentName('');
      setNewAgentPassword('');
      refreshData();
    }
  };

  const handleToggleAgent = (id: string) => {
    toggleAgentStatus(id);
    refreshData();
  };

  return (
    <Layout user={user} onLogout={onLogout} title="System Overview">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Agents</p>
              <p className="text-3xl font-bold text-gray-900">{agents.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
              <UserIcon size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Documents Signed</p>
              <p className="text-3xl font-bold text-green-600">
                {docs.filter(d => String(d.status).toLowerCase() === 'signed').length}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-full text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Docs</p>
              <p className="text-3xl font-bold text-orange-600">
                 {docs.filter(d => String(d.status).toLowerCase() !== 'signed').length}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-full text-orange-600">
              <FileText size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agents List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-800">Agent Management</h3>
            <button 
              onClick={() => setShowAddAgent(!showAddAgent)}
              className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded hover:bg-brand-700 flex items-center gap-1"
            >
              <Plus size={16} /> New Agent
            </button>
          </div>

          {showAddAgent && (
            <div className="p-4 bg-brand-50 border-b border-brand-100">
              <form onSubmit={handleCreateAgent} className="flex flex-col gap-3">
                <input 
                  type="text" placeholder="Full Name" required 
                  className="px-3 py-2 border rounded"
                  value={newAgentName} onChange={e => setNewAgentName(e.target.value)}
                />
                <input 
                  type="email" placeholder="Email Address" required 
                  className="px-3 py-2 border rounded"
                  value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)}
                />
                <input 
                  type="password" placeholder="Password" required 
                  className="px-3 py-2 border rounded"
                  value={newAgentPassword} onChange={e => setNewAgentPassword(e.target.value)}
                />
                <button type="submit" className="bg-brand-600 text-white py-2 rounded font-medium">Create Agent</button>
              </form>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {agents.map(agent => (
              <div key={agent.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{agent.name}</p>
                  <p className="text-sm text-gray-500">{agent.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${agent.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {agent.active ? 'Active' : 'Disabled'}
                  </span>
                  <button 
                    onClick={() => handleToggleAgent(agent.id)}
                    className="text-gray-400 hover:text-gray-600"
                    title={agent.active ? "Disable Account" : "Activate Account"}
                  >
                    {agent.active ? <XCircle size={20} /> : <CheckCircle size={20} />}
                  </button>
                </div>
              </div>
            ))}
            {agents.length === 0 && <p className="p-4 text-gray-500 text-center">No agents found.</p>}
          </div>
        </div>

        {/* Global Documents List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-800">All Documents</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {docs.map((doc: any) => (
              <div key={doc._id || doc.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-medium text-brand-700">{doc.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded ${String(doc.status).toLowerCase() === 'signed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {String(doc.status).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                   <p>Client: {doc.clientName || doc?.metadata?.clientName} ({doc.clientEmail || doc?.metadata?.clientEmail})</p>
                   <p>Agent: {doc.agentName || doc?.metadata?.agencyName}</p>
                </div>
                {String(doc.status).toLowerCase() === 'signed' && (doc.signedPdfUrl || doc.fileUrl) && (
                  <div className="mt-2">
                    <a 
                      href={(doc.signedPdfUrl ? `data:application/pdf;base64,${doc.signedPdfUrl}` : (doc.fileUrl?.startsWith('data:application/pdf') ? doc.fileUrl : `data:application/pdf;base64,${doc.fileUrl}`))}
                      download={`${doc.title}_signed.pdf`} 
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Download Signed PDF
                    </a>
                  </div>
                )}
              </div>
            ))}
            {docs.length === 0 && <p className="p-4 text-gray-500 text-center">No documents in system.</p>}
          </div>
        </div>
      </div>

    </Layout>
  );
}
