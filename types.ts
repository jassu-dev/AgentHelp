
export interface Attachment {
  title: string;
  driveFile: {
    id: string;
    title: string;
    alternateLink: string;
    mimeType: string;
  };
}

export interface Course {
  id: string;
  name: string;
  section: string;
  teacher: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  attachments: Attachment[];
  // This ID is needed for submitting work
  studentSubmissionId?: string; 
}

export interface GeneratedFile {
  name: string;
  content: string;
  handwritten: boolean;
}

export interface FileBlob extends GeneratedFile {
  blob: Blob;
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
}