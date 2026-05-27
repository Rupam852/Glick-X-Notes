# 📓 Glick X Notes

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12-orange.svg?logo=firebase)](https://firebase.google.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Glick X Notes** is a premium, open-source, highly responsive personal workspace app. Engineered with React 19, TypeScript, and a fully reactive Firebase Client v12 database, Glick X Notes delivers fluid real-time synchronization, advanced rich-text editing, base64 multi-media attachment sandboxing, and strict zero-knowledge data isolation.

---

## ✨ Outstanding Features

### 🖋️ Next-Generation Rich Text Editor
* **Vibrant Typography & Headings:** Seamless support for font family selection, headings (H1, H2), bold, italic, custom highlights, and text alignment.
* **Premium Custom Tables:** Insert dynamic professional tables with advanced column and row controls (add row/column, delete row/column, and custom drag/sizing).
* **Auto-Save Status Bubbles:** Smooth, animated status indicators displaying saving or synchronized status instantly as you type.

### 📱 Tailored Mobile Responsiveness
* **Two-Tier Adaptive Toolbar:** A sleek, horizontal scrolling touch toolbar designed for mobile viewports, ensuring all rich formatting actions are reachable with a single swipe.
* **Elevated Floating Bottom Navigation:** Centered absolute-positioned mobile floating `+ New Note` button with bottom safe area support (`env(safe-area-inset-bottom)`) for borderless screen optimization.
* **Responsive Inline Title Input:** Sleek inline titles that transition beautifully based on focus mode or viewport width using purely reactive CSS.

### 🔒 Enterprise-Grade Security & Isolation
* **Zero-Knowledge Architecture:** Strict, user-bound indexing rules physically prevent database overrides. Your collections are isolated to your unique cryptographic authenticated account.
* **Firestore Rules Sandboxing:** Secure child collections for base64 multi-media attachments preventing public storage bucket leaks.
* **Firebase Auth Integration:** Fluid Google OAuth and custom Email/Password authentication with verified registration protocols.

### ⚡ Performance & Offline Synchronization
* **Offline Sync Cache:** Read, write, and delete notes offline. Firestore local cache sync keeps your records safe and propagates changes as soon as your connection returns.
* **Base64 Attachment Sandboxing:** Upload images, files, or documents directly into notes, encoded in optimized base64 data strings for ultra-safe, high-speed database reads.
* **Interactive Control Panel:** Filter notes dynamically by custom tags, visual colors (Indigo, Pink, Rose, Emerald, Gold), or perform real-time character-matching search highlighting.

---

## 🛠️ Technology Stack

| Architecture Layer | Technology | Key Advantage |
| :--- | :--- | :--- |
| **UI Framework** | React 19 & TypeScript | Dynamic state rendering and compile-time type safety. |
| **Build Tooling** | Vite | Ultra-fast Hot Module Replacement (HMR) and bundle speeds. |
| **Styling Engine** | Tailwind CSS v4 Engine | Custom premium theme tokens with modern fluid layout design. |
| **Animations** | Framer Motion / Motion | Hardware-accelerated dynamic transitions and layout shifts. |
| **Backend Database** | Cloud Firestore Client v12 | Reactive listener channels with automatic offline synchronization. |
| **Authentication** | Firebase Authentication | Secure, multi-factor ready user identity management. |

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

### 3. Setup Firebase Configuration
Create a `firebase-applet-config.json` in your root directory and place your Firebase credentials inside:
```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_STORAGE_BUCKET",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
  "appId": "YOUR_APP_ID"
}
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view your brand new notes app!

---

## 🔒 Firestore Security Rules Configuration

To enforce robust zero-trust security matching the landing page description, deploy the following Firestore security rule set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Note isolation rules
    match /notes/{noteId} {
      allow read, update, delete: if request.auth != null 
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.userId;
      
      // Child Base64 Attachments isolation
      match /attachments/{attachmentId} {
        allow read, write: if request.auth != null 
          && get(/databases/$(database)/documents/notes/$(noteId)).data.userId == request.auth.uid;
      }
    }
  }
}
```

---

## 📦 Production Deployment

### Building the Bundle
Generate an optimized production build:
```bash
npm run build
```

### Deploying to Vercel / Netlify
This repository is configured for Single Page Application (SPA) routing. The `vercel.json` rewrite configuration is pre-configured:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
Simply connect your GitHub repository to Vercel or Netlify, select **Vite** as your framework preset, and trigger the deployment!

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*Created with premium craftsmanship by [Rupam Bairagya](https://github.com/Rupam852).*
