import React from 'react';
import { GoogleClassroomIcon, AiIcon, PdfIcon, ZipIcon, GoogleIcon } from './icons';

interface LandingPageProps {
  onLogin: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string; delay: string }> = ({ icon, title, description, delay }) => (
    <div className="bg-primary p-6 rounded-lg border border-border-color transform transition-transform hover:-translate-y-2 animate-slide-in-up shadow-sm hover:shadow-md" style={{ animationDelay: delay }}>
        <div className="mb-4 text-accent">{icon}</div>
        <h3 className="text-xl font-bold mb-2 text-text-primary">{title}</h3>
        <p className="text-text-secondary">{description}</p>
    </div>
);


const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="bg-secondary min-h-screen text-text-primary overflow-x-hidden">
      <header className="bg-primary border-b border-border-color">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center animate-fade-in">
          <h1 className="text-2xl font-bold">AI Classroom Assistant</h1>
          <button
            onClick={onLogin}
            className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <GoogleIcon className="w-5 h-5" />
            Connect with Google
          </button>
        </div>
      </header>
      
      <main className="container mx-auto px-6">
        {/* Hero Section */}
        <section className="text-center py-20 md:py-32">
          <div className="animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-4">
              Your Personal AI <span className="text-accent">Assignment Solver</span>
            </h2>
          </div>
          <div className="animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto mb-8">
              Connect your Google Classroom, and let our state-of-the-art AI handle your assignments. From essays to code, we generate ready-to-submit files, including handwritten PDFs.
            </p>
          </div>
          <div className="animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
            <button
              onClick={onLogin}
              className="bg-highlight text-white font-bold py-3 px-8 rounded-lg text-lg transform transition-transform hover:scale-105 flex items-center gap-3 mx-auto"
            >
               <GoogleIcon className="w-6 h-6" />
              Get Started for Free
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <h3 className="text-3xl font-bold text-center mb-12 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>How It Works</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<GoogleClassroomIcon className="w-10 h-10" />}
              title="Connect Classroom"
              description="Securely link your Google Classroom account in seconds to view your courses and assignments."
              delay="0.5s"
            />
            <FeatureCard 
              icon={<AiIcon className="w-10 h-10" />}
              title="AI-Powered Solutions"
              description="Our advanced AI analyzes your assignment requirements and generates a comprehensive solution."
              delay="0.6s"
            />
            <FeatureCard 
              icon={<PdfIcon className="w-10 h-10" />}
              title="Handwritten PDFs"
              description="Need a personal touch? The AI can generate solutions as PDFs in a natural, handwritten font."
              delay="0.7s"
            />
            <FeatureCard 
              icon={<ZipIcon className="w-10 h-10" />}
              title="Submit or Download"
              description="We automatically zip multiple files for you. Download your work or (soon) submit it directly."
              delay="0.8s"
            />
          </div>
        </section>
      </main>

      <footer className="text-center py-8 text-text-secondary border-t border-border-color mt-12 bg-primary">
        <p>&copy; 2024 AI Classroom Assistant. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;