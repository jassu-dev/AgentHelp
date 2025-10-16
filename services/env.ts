// services/env.ts

// This file centralizes access to your Google and Gemini API credentials.
// In a real-world scenario, these would be set through a .env file and a build process.
// For this project, you MUST replace the placeholder values below.

// --- ACTION REQUIRED ---
// 1. Go to https://console.cloud.google.com/ to get your credentials.
// 2. You will need to create a project, enable the "Google Classroom API" and "Google Drive API".
// 3. Under "Credentials", create an "OAuth 2.0 Client ID" for a Web Application.
// 4. Also under "Credentials", create an "API key".
// 5. Paste the respective values here.
// -----------------------

export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // 👈 Paste your OAuth 2.0 Client ID here
export const API_KEY = 'YOUR_API_KEY';                   // 👈 Paste your API Key here (used for both Google Cloud and Gemini)
