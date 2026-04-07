import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: Timestamp;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  body: string;
  tags: string[];
  color: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attachmentCount?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64
  createdAt: Timestamp;
}

export type View = 'login' | 'signup' | 'forgot-password' | 'dashboard' | 'editor';
