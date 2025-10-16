import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { Assignment, Course, GeneratedFile, FileBlob, DriveFileLink } from '../types';
import { DownloadIcon, CheckCircleIcon, PaperclipIcon, XCircleIcon, DriveIcon, LinkIcon } from './icons';
import classroomApi from '../services/classroomApi';
import FontSelector from './FontSelector';
import { API_KEY } from '../services/env';

declare var jspdf: any;
declare var JSZip: any;

interface AssignmentViewProps {
  assignment: Assignment;
  course: Course;
  onBack: () => void;
}

enum Status {
  IDLE,
  FETCHING_ATTACHMENTS,
  SOLVING,
  GENERATING_FILES,
  ZIPPING,
  UPLOADING_TO_DRIVE,
  DONE,
  ERROR
}

const statusMessages = {
    [Status.IDLE]: 'Ready to start',
    [Status.FETCHING_ATTACHMENTS]: 'Analyzing assignment materials...',
    [Status.SOLVING]: 'The AI is crafting your solution...',
    [Status.GENERATING_FILES]: 'Preparing your files for download...',
    [Status.ZIPPING]: 'Packaging multiple files for convenience...',
    [Status.UPLOADING_TO_DRIVE]: 'Uploading solution to your Google Drive...',
    [Status.DONE]: 'Assignment solved and files are ready!',
    [Status.ERROR]: 'An error occurred.'
};

const ai = new GoogleGenAI({ apiKey: API_KEY });

const AssignmentView: React.FC<AssignmentViewProps> = ({ assignment, course, onBack }) => {
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<FileBlob[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [driveFileLinks, setDriveFileLinks] = useState<DriveFileLink[]>([]);
  const [selectedFont, setSelectedFont] = useState('Caveat');
  const [attachmentContents, setAttachmentContents] = useState<Record<string, string>>({});

  useEffect(() => {
    if (assignment.attachments.length > 0) {
        const fetchAttachments = async () => {
            setStatus(Status.FETCHING_ATTACHMENTS);
            const contents: Record<string, string> = {};
            await Promise.all(
                assignment.attachments.map(async (att) => {
                    const content = await classroomApi.getAttachmentContent(att.driveFile.id, att.driveFile.mimeType);
                    contents[att.title] = content;
                })
            );
            setAttachmentContents(contents);
            setStatus(Status.IDLE);
        };
        fetchAttachments().catch(e => {
            console.error(e);
            setError("Failed to read assignment attachments.");
            setStatus(Status.ERROR);
        });
    }
  }, [assignment.attachments]);

  const needsHandwrittenFile = useMemo(() => {
    return assignment.description.toLowerCase().includes('handwritten');
  }, [assignment.description]);
  
  const getAttachmentStatusText = (content: string) => {
    if (status === Status.FETCHING_ATTACHMENTS) return 'Analyzing...';
    if (content?.startsWith('data:')) return 'Content will be extracted by AI';
    if (content?.startsWith('[Content of file type')) return 'File type not readable';
    if (content?.startsWith('[Error reading')) return 'Error reading file';
    return 'Text read by AI';
  };

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
    
    // Draw a realistic lined-paper background
    doc.setDrawColor(200, 230, 255); // Light blue for lines
    doc.setLineWidth(0.1);
    for (let y = 20; y < 290; y += 10) { // Draw horizontal lines
        doc.line(15, y, 195, y);
    }
    doc.setDrawColor(255, 180, 180); // Light red for margin line
    doc.setLineWidth(0.2);
    doc.line(25, 15, 25, 290);

    // Set font and add text with randomization
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 80); // Dark blue ink color
    
    const lines = doc.splitTextToSize(content, 165); // 165mm width within margins
    const xOffset = 28 + (Math.random() - 0.5) * 2; // Randomized horizontal start
    const yOffset = 20 + (Math.random() - 0.5) * 2; // Randomized vertical start
    
    doc.text(lines, xOffset, yOffset);

    return doc.output('blob');
  };

  const handleSolve = useCallback(async () => {
    setStatus(Status.SOLVING);
    setError(null);
    setGeneratedFiles([]);
    setZipBlob(null);
    setDriveFileLinks([]);

    try {
        const parts: any[] = [];
        let textPrompt = `
        You are an AI assistant helping a student with their Google Classroom assignment.
        Course: "${course.name}"
        Assignment Title: "${assignment.title}"
        Assignment Description: "${assignment.description}"
        
        The assignment may include attachments. Use their content as context to provide a better solution.
        `;

        const attachmentParts: any[] = [];
        for (const [title, content] of Object.entries(attachmentContents)) {
            if (content.startsWith('data:')) {
                const match = content.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    const mimeType = match[1];
                    const data = match[2];
                    attachmentParts.push({ text: `\n--- Attachment Content from file: ${title} ---` });
                    attachmentParts.push({ inlineData: { mimeType, data } });
                }
            } else {
                textPrompt += `\n\n--- Attachment Content from file: ${title} ---\n${content}\n--- End of Attachment ---`;
            }
        }

        parts.push({ text: textPrompt });
        parts.push(...attachmentParts);
        
        parts.push({ text: `
        Based on all the information and attachments provided, generate a complete solution. Your response MUST be a valid JSON object.
        The JSON object should contain a single key "files", which is an array of file objects.
        Each file object must have three properties:
        1. "name": A string representing the filename (e.g., "essay.txt", "script.py").
        2. "content": A string containing the full content of the file.
        3. "handwritten": A boolean value. Set to true if the assignment description asks for a handwritten style document, otherwise false.
        `});

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
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
  }, [assignment, course, selectedFont, attachmentContents]);
  
  const handleUploadToDrive = useCallback(async () => {
    if (generatedFiles.length === 0 && !zipBlob) {
      setError("No files have been generated to upload.");
      return;
    }
    setError(null);
    setStatus(Status.UPLOADING_TO_DRIVE);
    try {
        const filesToUpload: FileBlob[] = zipBlob
            ? [{ name: `${assignment.title.replace(/\s+/g, '_')}_solution.zip`, blob: zipBlob, content: '', handwritten: false }]
            : generatedFiles;
      
        const links = await classroomApi.uploadFilesToDrive(filesToUpload);
        setDriveFileLinks(links);
        setStatus(Status.DONE);
    } catch (e: any) {
        console.error(e);
        const errorMessage = e?.message || 'An unknown error occurred while uploading. Please check the console.';
        setError(`Upload failed: ${errorMessage}`);
        setStatus(Status.ERROR);
    }
  }, [generatedFiles, zipBlob, assignment.title]);

  const isSolving = status > Status.IDLE && status < Status.DONE;
  const progressPercentage = isSolving ? Math.max(0, ((status - 1) / (Status.DONE - 2)) * 100) : 0;

  return (
    <div className="min-h-screen bg-secondary p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto bg-primary p-6 sm:p-8 rounded-lg border border-border-color shadow-md">
        <button onClick={onBack} className="text-accent mb-6 hover:underline">&larr; Back to Assignments</button>
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary">{assignment.title}</h1>
          <p className="text-sm text-text-secondary mt-1">From: {course.name}</p>
        </div>
        
        <div className="bg-secondary p-4 rounded-lg border border-border-color mb-6">
          <h3 className="font-semibold mb-2 text-text-primary">Assignment Details</h3>
          <p className="text-text-secondary whitespace-pre-wrap">{assignment.description}</p>
        </div>

        {assignment.attachments.length > 0 && (
            <div className="bg-secondary p-4 rounded-lg border border-border-color mb-6">
                <h3 className="font-semibold mb-3 text-text-primary flex items-center gap-2">
                    <PaperclipIcon className="w-5 h-5" />
                    Attachments
                </h3>
                <ul className="space-y-2">
                    {assignment.attachments.map(att => (
                        <li key={att.driveFile.id} className="text-sm flex justify-between items-center">
                            <a href={att.driveFile.alternateLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate pr-4">{att.title}</a>
                            <span className="text-xs text-text-secondary flex-shrink-0">{getAttachmentStatusText(attachmentContents[att.title])}</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}
        
        {needsHandwrittenFile && status < Status.SOLVING && (
            <FontSelector selectedFont={selectedFont} onSelectFont={setSelectedFont} />
        )}

        <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
                <button 
                    onClick={handleSolve}
                    disabled={isSolving || status === Status.FETCHING_ATTACHMENTS}
                    className="w-full bg-accent text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 shadow-sm hover:shadow-md"
                >
                    {isSolving ? 'Solving...' : status === Status.FETCHING_ATTACHMENTS ? 'Analyzing...' : 'Solve with AI'}
                </button>
            </div>

            <div className="flex-1 bg-secondary p-4 rounded-lg border border-border-color">
                <h3 className="font-semibold mb-4 text-text-primary">Generated Files</h3>
                {generatedFiles.length > 0 ? (
                    <ul className="space-y-3 mb-4">
                        {generatedFiles.map((file) => (
                            <li key={file.name} className="flex justify-between items-center bg-primary p-3 rounded-md border border-border-color">
                                <span className="text-text-primary truncate mr-4">{file.name}</span>
                                <button onClick={() => downloadFile(file.blob, file.name)} className="text-accent hover:text-blue-600 flex-shrink-0" title="Download file">
                                    <DownloadIcon className="w-6 h-6" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-text-secondary text-sm text-center py-4">{isSolving ? 'Generating...' : 'AI will generate files here.'}</p>
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
                
                {status === Status.DONE && generatedFiles.length > 0 && driveFileLinks.length === 0 && (
                    <button
                        onClick={handleUploadToDrive}
                        className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg mt-4 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <DriveIcon className="w-5 h-5" />
                        Upload Files to Drive
                    </button>
                )}
            </div>
        </div>

        {status > Status.IDLE && (
            <div className="mt-6 p-4 bg-secondary border border-border-color rounded-lg animate-fade-in">
                <div className="flex items-center mb-3">
                    {status === Status.ERROR ? (
                        <XCircleIcon className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" />
                    ) : status === Status.DONE ? (
                        <CheckCircleIcon className="w-6 h-6 text-highlight mr-3 flex-shrink-0" />
                    ) : (
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mr-3 flex-shrink-0"></div>
                    )}
                    <div>
                        <p className="font-semibold text-text-primary">
                            {status === Status.ERROR ? 'An Error Occurred' 
                             : status === Status.DONE ? (driveFileLinks.length > 0 ? 'Files Uploaded to Your Drive!' : 'Ready!')
                             : 'Processing...'}
                        </p>
                        <p className="text-sm text-text-secondary">
                            {error || statusMessages[status]}
                        </p>
                    </div>
                </div>
                 {isSolving && (
                    <div className="relative pt-1">
                        <div className="overflow-hidden h-2 text-xs flex rounded bg-accent/20">
                            <div style={{ width: `${progressPercentage}%`}} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-accent transition-all duration-500"></div>
                        </div>
                    </div>
                )}
                {driveFileLinks.length > 0 && (
                    <div className="mt-4 border-t border-border-color pt-4">
                        <h4 className="font-semibold text-text-primary mb-2">Next step: Add these files to your assignment in Google Classroom.</h4>
                        <ul className="space-y-2">
                            {driveFileLinks.map(file => (
                                <li key={file.id} className="flex items-center justify-between bg-primary p-2 rounded-md">
                                    <span className="text-sm text-text-secondary truncate pr-4">{file.name}</span>
                                    <a href={file.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-accent font-semibold hover:underline">
                                        <LinkIcon className="w-4 h-4" />
                                        Open in Drive
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentView;