
export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  CLIENT = 'client',
}

export enum DocumentStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface Agent extends User {
  createdBy: string; // Admin ID
  active: boolean;
}

export interface DocumentData {
  id: string;
  // Core
  title: string; // Document Type/Title
  status: DocumentStatus;
  createdAt: number;
  signedAt?: number;
  signerIP?: string;
  signerGmail?: string;
  pdfUrl?: string; // Base64 Data URL
  signedPdfUrl?: string; // Base64 Data URL
  
  // Agent / Agency Info
  agentId: string;
  agentName: string;
  agencyName: string;
  agencyEmail: string;
  agencyPhone: string;

  // Client Info
  clientName: string;
  clientEmail: string; // Gmail only
  clientCompany: string;
  clientPhone: string;
  clientAddress: string;
  clientCityStateZip: string;
  clientCountry: string;

  // Project Details
  projectName: string;
  startDate: string;
  endDate: string;
  scopeOfWork: string;
  paymentTerms: string;
  specialNotes: string;
}

export interface SignatureData {
  dataUrl: string; // Base64 image
  timestamp: number;
}