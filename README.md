# 📓 Glick X Notes

[![Live Demo](https://img.shields.io/badge/Demo-glick--x--notes.pages.dev-6366f1.svg?style=flat&logo=cloudflare)](https://glick-x-notes.pages.dev/)
[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12-orange.svg?logo=firebase)](https://firebase.google.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Glick X Notes** is an ultra-fast, feature-packed modern personal workspace and intelligent note-taking application. Built with React 19, TypeScript, Tailwind CSS v4, and Cloud Firestore v12, Glick X Notes combines effortless real-time synchronization, multi-provider AI assistance (Google Gemini, Groq, Hugging Face), interactive Mermaid diagrams, KaTeX mathematical formulas, freehand canvas drawing, and multi-format export capabilities with enterprise-grade data isolation.

🌐 **Live Production App:** [https://glick-x-notes.pages.dev/](https://glick-x-notes.pages.dev/)

---

## ✨ Core Features

### 🤖 Multi-Provider AI Intelligence
* **Bring Your Own Key (BYOK):** Seamlessly configure and test your own API keys for **Google Gemini**, **Groq (Llama 3)**, and **Hugging Face**.
* **AI Writing Assistant:** One-click summarization, smart action item extraction, tone adjustment (Professional, Casual, Academic), translation, and grammar enhancement.
* **Auto-Tagging & Title Generation:** Let AI analyze your notes and suggest relevant categorized tags and catchy titles automatically.

### 🖋️ Next-Gen Rich Text & Visual Editor
* **Typography & Headings:** Full support for H1, H2, H3, blockquotes, code blocks with syntax highlighting, custom highlight colors, and text formatting.
* **Interactive Mermaid.js Diagrams:** Live visual modal for rendering Flowcharts, Sequence diagrams, Mindmaps, Git graphs, Architecture diagrams, Class diagrams, and ER models directly inside your notes.
* **KaTeX LaTeX Formulas:** Full math typesetting support for inline expressions `\( ... \)` and multi-term LaTeX equations `$$ ... $$` with a live formula builder modal.
* **Freehand Canvas Drawing:** Embedded sketch board for handwriting, quick doodles, wireframes, and annotations.
* **Dynamic Tables:** Insert and edit responsive data tables with intuitive row and column controls.

### 📁 Advanced Organization & Workspace Management
* **Folders & Hierarchy:** Organize thoughts into dedicated workspace folders with custom icons and colors.
* **Tagging & Color Palettes:** Categorize notes with vibrant color tokens (Indigo, Rose, Amber, Emerald, Violet) and searchable multi-tag filters.
* **Quick Access & Lifecycle:** Pin critical notes, mark favorites, archive completed work, or restore deleted files via the Trash bin with soft-delete recovery.

### 📤 Multi-Format Export & Backups
* **Export Anywhere:** Download your notes instantly in **PDF**, **Markdown (.md)**, **HTML**, **Plain Text (.txt)**, or **JSON backup** formats with preserved formatting and attachments.

### 🔒 Privacy, Security & Isolation
* **Zero-Knowledge Architecture:** Granular Firestore Security Rules ensure that your collections and documents are accessible strictly by your verified authenticated UID.
* **Firebase Authentication:** Multi-provider authentication supporting Google OAuth and Email/Password with real-time email verification workflows and secure password recovery.
* **Offline Sync Support:** Read, write, and create notes offline. Firestore local cache keeps changes safe and syncs instantly upon reconnection.

### 🎨 Clean Brand Aesthetics & Theming
* **Origami 3D Monogram:** Clean, floating Origami "G" brand asset with zero background boxes, razor-sharp anti-aliased transparency, and retina resolution.
* **Dark & Light Mode:** System-aware theme toggle with smooth color transitions across all views, landing pages, and modals.

---

## 🛠️ Technology Stack

| Layer | Technologies | Purpose / Advantage |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | High performance, strict type safety, modern concurrent features |
| **Styling & Design** | Tailwind CSS v4, Lucide Icons | Utility-first responsive design with dark mode styling |
| **Build Tool** | Vite 6 | Sub-second HMR and optimized production code splitting |
| **Database & Auth** | Cloud Firestore v12, Firebase Auth | Real-time reactive data streaming, offline cache, and OAuth |
| **AI Engine** | Google Gemini API, Groq SDK, Hugging Face API | Context-aware writing, summaries, and text generation |
| **Visualization** | Mermaid.js, KaTeX, Cytoscape, Canvas API | Live diagrams, mathematical typesetting, and freehand drawing |
| **Deployment** | Cloudflare Pages | Global edge CDN, ultra-low latency, and instant continuous deployment |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (v9.0.0 or higher)

### 1. Clone the Repository
```bash
git clone https://github.com/Rupam852/Glick-X-Notes.git
cd Glick-X-Notes
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Firebase Environment
Create a `.env` file in the root directory (or use `firebase-applet-config.json`):
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Firestore Security Rules

To enforce strict user data isolation, deploy the following Firestore security rules in your Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profile isolation
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Notes isolation
    match /notes/{noteId} {
      allow read, update, delete: if request.auth != null 
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.userId;
      
      // Nested attachments isolation
      match /attachments/{attachmentId} {
        allow read, write: if request.auth != null 
          && get(/databases/$(database)/documents/notes/$(noteId)).data.userId == request.auth.uid;
      }
    }
    
    // Folders isolation
    match /folders/{folderId} {
      allow read, update, delete: if request.auth != null 
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

---

## 📦 Production Deployment

### Building for Production
```bash
npm run build
```

### Cloudflare Pages Deployment
This repository is configured for Single Page Application (SPA) routing with a `public/_redirects` rule:
```text
/*    /index.html   200
```
- **Framework preset:** `Vite`
- **Build command:** `npm run build`
- **Build output directory:** `dist`

Changes pushed to the `main` branch automatically deploy globally via Cloudflare Pages edge network.

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).

---
*Developed with craftsmanship by [Rupam Bairagya](https://github.com/Rupam852).*
