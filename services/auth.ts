// services/auth.ts
import type { UserProfile } from '../types';
import { GOOGLE_CLIENT_ID, API_KEY } from './env';

declare var google: any;
declare var gapi: any;

// FIX: Add gapi to the window object type definition to resolve TypeScript error.
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

// --- CONFIGURATION NOTE ---
// Credentials are now managed in `services/env.ts`.
// You must also configure your OAuth consent screen in the Google Cloud Console.
// 1. Go to "APIs & Services" -> "OAuth consent screen".
// 2. Set the Publishing status to "Testing".
// 3. Add your Google account email address under "Test users".
// 4. Failure to do so will result in Google blocking login and submission features.
// --------------------------

// Scopes define the permissions the app requests from the user.
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/drive.file', // Required to upload files for submission
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

class AuthService {
  private tokenClient: any = null;
  private onLogin: (profile: UserProfile) => void = () => {};
  private onLogout: () => void = () => {};

  /**
   * Initializes the Google API client and token client.
   * This should be called once when the application loads.
   */
  async initClient(
    onLoginCallback: (profile: UserProfile) => void,
    onLogoutCallback: () => void
  ): Promise<void> {
    this.onLogin = onLoginCallback;
    this.onLogout = onLogoutCallback;
    
    if (GOOGLE_CLIENT_ID.startsWith('YOUR_') || API_KEY.startsWith('YOUR_')) {
        throw new Error("API keys are not configured. Please add your credentials in services/env.ts.");
    }
    
    // Wait for both the gapi and gsi scripts to load to prevent race conditions.
    await new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const checkGapiAndGsi = () => {
            if (Date.now() - startTime > 10000) {
                reject(new Error("Google API scripts failed to load in time."));
                return;
            }
            if (window.gapi && window.google) {
                gapi.load('client', {
                    callback: resolve,
                    onerror: () => reject(new Error("GAPI client script failed to load.")),
                });
            } else {
                setTimeout(checkGapiAndGsi, 100);
            }
        };
        checkGapiAndGsi();
    });

    try {
        // Initialize the gapi client
        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [
            'https://www.googleapis.com/discovery/v1/apis/classroom/v1/rest',
            'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
          ],
        });

        // Initialize the Google Identity Services token client
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              this.fetchUserProfile();
            }
          },
        });
    } catch (err) {
        console.error("Error initializing Google API Client:", err);
        throw new Error(
            "Could not initialize Google APIs. Please ensure you have enabled 'Google Classroom API' and 'Google Drive API' in your Google Cloud Console and that your API Key is correct."
        );
    }
  }

  /**
   * Triggers the Google Sign-In flow.
   */
  signIn(): void {
    if (this.tokenClient) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      this.tokenClient.requestAccessToken();
    } else {
      console.error("Auth client not initialized. Make sure you have added your credentials in services/env.ts");
      alert("Authentication service is not ready. This might be due to a configuration issue. Please check the console.");
    }
  }

  /**
   * Signs the user out.
   */
  signOut(): void {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        this.onLogout();
      });
    }
  }
  
  /**
   * Fetches the user's profile information after a successful login.
   */
  private async fetchUserProfile(): Promise<void> {
    try {
        const response = await gapi.client.request({
            path: 'https://www.googleapis.com/oauth2/v2/userinfo'
        });
        
        const profile = response.result;
        const userProfile: UserProfile = {
            name: profile.name,
            email: profile.email,
            picture: profile.picture
        };
        this.onLogin(userProfile);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        this.signOut(); // Log out on error
    }
  }

  /**
   * Utility to get the current access token.
   */
  getAccessToken(): string | null {
      const token = gapi.client.getToken();
      return token ? token.access_token : null;
  }
}

const authService = new AuthService();
export default authService;