import React, { useState, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { Assignment, Course, GeneratedFile, FileBlob } from '../types';
import { DownloadIcon, CheckCircleIcon } from './icons';
import classroomApi from '../services/classroomApi';
import FontSelector from './FontSelector';

declare var jspdf: any;
declare var JSZip: any;

interface AssignmentViewProps {
  assignment: Assignment;
  course: Course;
  onBack: () => void;
}

enum Status {
  IDLE,
  SOLVING,
  GENERATING_FILES,
  ZIPPING,
  UPLOADING,
  SUBMITTING,
  DONE,
  ERROR
}

type SubmissionStatus = 'IDLE' | 'SUCCESS';

const statusMessages = {
    [Status.IDLE]: 'Ready to start',
    [Status.SOLVING]: 'AI is analyzing and solving the assignment...',
    [Status.GENERATING_FILES]: 'Generating required files...',
    [Status.ZIPPING]: 'Packaging files into a zip archive...',
    [Status.UPLOADING]: 'Uploading files to Google Drive...',
    [Status.SUBMITTING]: 'Submitting to Google Classroom...',
    [Status.DONE]: 'Assignment solved and ready!',
    [Status.ERROR]: 'An error occurred.'
};

// --- ACTION REQUIRED ---
// Replace this placeholder with your actual Gemini API Key from Google AI Studio.
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // 👈 Paste your Gemini API Key here
// -----------------------

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const AssignmentView: React.FC<AssignmentViewProps> = ({ assignment, course, onBack }) => {
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<FileBlob[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('IDLE');
  const [selectedFont, setSelectedFont] = useState('Caveat');

  const needsHandwrittenFile = useMemo(() => {
    // This check is done before files are generated, so we check the description
    return assignment.description.toLowerCase().includes('handwritten');
  }, [assignment.description]);

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const createHandwrittenPdf = async (content: string, name: string, fontFamily: string): Promise<Blob> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(14);
    
    const lines = doc.splitTextToSize(content, 180);
    doc.text(lines, 15, 20);

    return doc.output('blob');
  };

  const handleSolve = useCallback(async () => {
    if (GEMINI_API_KEY.startsWith('YOUR_')) {
        setError("Please add your Gemini API Key in components/AssignmentView.tsx");
        setStatus(Status.ERROR);
        return;
    }
    setStatus(Status.SOLVING);
    setError(null);
    setGeneratedFiles([]);
    setZipBlob(null);
    setSubmissionStatus('IDLE');

    try {
        const prompt = `
        You are an AI assistant helping a student with their Google Classroom assignment.
        Course: "${course.name}"
        Assignment Title: "${assignment.title}"
        Assignment Description: "${assignment.description}"

        Generate a complete solution for this assignment. Your response MUST be a valid JSON object.
        The JSON object should contain a single key "files", which is an array of file objects.
        Each file object must have three properties:
        1. "name": A string representing the filename (e.g., "essay.txt", "script.py").
        2. "content": A string containing the full content of the file.
        3. "handwritten": A boolean value. Set to true if the assignment description asks for a handwritten style document, otherwise false.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        files: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    content: { type: Type.STRING },
                                    handwritten: { type: Type.BOOLEAN }
                                },
                                required: ['name', 'content', 'handwritten']
                            }
                        }
                    },
                    required: ['files']
                }
            }
        });

        // FIX: Trim whitespace from the response text before parsing as JSON to prevent errors.
        const resultJson = JSON.parse(response.text.trim());
        const filesToGenerate: GeneratedFile[] = resultJson.files;
        
        setStatus(Status.GENERATING_FILES);
        const fileBlobs: FileBlob[] = await Promise.all(
            filesToGenerate.map(async (file) => {
                let blob: Blob;
                if (file.handwritten) {
                    blob = await createHandwrittenPdf(file.content, file.name, selectedFont);
                    file.name = file.name.split('.').slice(0, -1).join('.') + '.pdf';
                } else {
                    blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
                }
                return { ...file, blob };
            })
        );
        setGeneratedFiles(fileBlobs);

        if (fileBlobs.length > 1) {
            setStatus(Status.ZIPPING);
            const zip = new JSZip();
            fileBlobs.forEach(file => {
                zip.file(file.name, file.blob);
            });
            const content = await zip.generateAsync({ type: 'blob' });
            setZipBlob(content);
        }

        setStatus(Status.DONE);
    } catch (e) {
        console.error(e);
        setError("Failed to solve assignment. The AI might be unavailable or the request failed. Please try again.");
        setStatus(Status.ERROR);
    }
  }, [assignment, course, selectedFont]);
  
  const handleSubmit = async () => {
    if (!assignment.studentSubmissionId) {
        setError("Cannot submit: Student submission details are missing.");
        setStatus(Status.ERROR);
        return;
    }
    setError(null);
    setStatus(Status.UPLOADING);
    try {
        await classroomApi.submitAssignment(course.id, assignment.id, assignment.studentSubmissionId, generatedFiles);
        setSubmissionStatus('SUCCESS');
        setStatus(Status.DONE);
    } catch (e: any) {
        console.error(e);
        const errorMessage = e?.result?.error?.message || e?.message || 'An unknown error occurred. Please check the console.';
        setError(`Submission failed: ${errorMessage}`);
        setStatus(Status.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-secondary p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto bg-primary p-6 sm:p-8 rounded-lg border border-border-color shadow-md">
        <button onClick={onBack} className="text-accent mb-6 hover:underline">&larr; Back to Assignments</button>
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary">{assignment.title}</h1>
          <p className="text-sm text-text-secondary mt-1">From: {course.name}</p>
        </div>
        
        <div className="bg-secondary p-4 rounded-lg border border-border-color mb-8">
          <h3 className="font-semibold mb-2 text-text-primary">Assignment Details</h3>
          <p className="text-text-secondary whitespace-pre-wrap">{assignment.description}</p>
        </div>
        
        {needsHandwrittenFile && status < Status.GENERATING_FILES && (
            <FontSelector selectedFont={selectedFont} onSelectFont={setSelectedFont} />
        )}

        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
                <button 
                    onClick={handleSolve}
                    disabled={status > Status.IDLE && status < Status.DONE}
                    className="w-full bg-accent text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 shadow-sm hover:shadow-md"
                >
                    {status > Status.IDLE && status < Status.DONE ? 'Solving...' : 'Solve with AI'}
                </button>
                {status > Status.IDLE && (
                    <div className="mt-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            {status < Status.DONE && status !== Status.ERROR && <div className="w-4 h-4 rounded-full bg-accent animate-pulse-fast"></div>}
                            {status === Status.DONE && <CheckCircleIcon className="w-6 h-6 text-highlight" />}
                            <p className="text-text-secondary">{statusMessages[status]}</p>
                        </div>
                    </div>
                )}
                {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
            </div>

            <div className="flex-1 bg-secondary p-4 rounded-lg border border-border-color">
                <h3 className="font-semibold mb-4 text-text-primary">Generated Files</h3>
                {generatedFiles.length > 0 ? (
                    <ul className="space-y-3 mb-4">
                        {generatedFiles.map((file) => (
                            <li key={file.name} className="flex justify-between items-center bg-primary p-3 rounded-md border border-border-color">
                                <span className="text-text-primary truncate mr-4">{file.name}</span>
                                <button onClick={() => downloadFile(file.blob, file.name)} className="text-accent hover:text-blue-600 flex-shrink-0">
                                    <DownloadIcon className="w-6 h-6" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-text-secondary text-sm text-center py-4">AI will generate files here.</p>
                )}

                {zipBlob && (
                    <button 
                        onClick={() => downloadFile(zipBlob, `${assignment.title.replace(/\s+/g, '_')}_solution.zip`)}
                        className="w-full bg-highlight text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                    >
                        <DownloadIcon className="w-5 h-5"/>
                        Download All (.zip)
                    </button>
                )}
                
                {status === Status.DONE && generatedFiles.length > 0 && (
                     submissionStatus === 'IDLE' ? (
                        <button
                            onClick={handleSubmit}
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg mt-4 hover:bg-blue-700 transition-colors"
                        >
                            Submit to Classroom
                        </button>
                     ) : (
                        <div className="mt-4 p-3 bg-green-100 text-green-800 border border-green-300 rounded-lg text-center text-sm">
                            Successfully submitted!
                        </div>
                     )
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentView;