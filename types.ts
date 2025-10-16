
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