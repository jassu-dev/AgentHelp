import React, { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import authService from './services/auth';
import type { UserProfile } from './types';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await authService.initClient(
          (profile) => setUser(profile), // on login
          () => setUser(null) // on logout
        );
      } catch (error: any) {
        setInitError(error.message || "An unknown error occurred during initialization.");
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  const handleLogin = useCallback(async () => {
    await authService.signIn();
  }, []);
  
  const handleLogout = useCallback(async () => {
    await authService.signOut();
  }, []);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-800 p-4">
        <div className="max-w-2xl text-center">
          <h1 className="text-2xl font-bold mb-4">Application Initialization Failed</h1>
          <p className="mb-2">There was a problem starting the application. This is often due to a configuration issue.</p>
          <div className="bg-red-100 border border-red-300 p-3 rounded-md font-mono text-sm text-left">
            <strong>Error:</strong> {initError}
          </div>
          <p className="mt-4 text-left">
            <strong>How to fix:</strong>
            <ul className="list-disc list-inside mt-2">
                <li>Ensure you have replaced the placeholder values for `CLIENT_ID` and `API_KEY` in the `services/auth.ts` file.</li>
                <li>Go to your Google Cloud Console and make sure you have <strong>enabled</strong> both the <strong>Google Classroom API</strong> and the <strong>Google Drive API</strong> for your project.</li>
            </ul>
          </p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <LandingPage onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;