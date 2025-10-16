// services/classroomApi.ts
import type { Course, Assignment, FileBlob, Attachment, DriveFileLink } from '../types';
import authService from './auth';

declare var gapi: any;

const formatDate = (date: any): string => {
    if (!date) return 'No due date';
    const d = new Date(date.year, date.month - 1, date.day);
    return d.toLocaleDateString();
}

class ClassroomApiService {
  async getCourses(): Promise<Course[]> {
    const response = await gapi.client.classroom.courses.list({
        courseStates: 'ACTIVE'
    });
    
    const courses = response.result.courses || [];
    // Fetch teacher details for each course
    const coursesWithTeachers = await Promise.all(courses.map(async (course: any) => {
        let teacherName = 'N/A';
        try {
            const teacherResponse = await gapi.client.classroom.users.get({ id: course.ownerId });
            if (teacherResponse?.result?.name?.fullName) {
                teacherName = teacherResponse.result.name.fullName;
            }
        } catch (e) {
            console.warn(`Could not fetch teacher for course ${course.name}`);
        }
        return {
            id: course.id,
            name: course.name,
            section: course.section || 'General',
            teacher: teacherName,
        };
    }));

    return coursesWithTeachers;
  }

  async getAssignments(courseId: string): Promise<Assignment[]> {
    const response = await gapi.client.classroom.courses.courseWork.list({
        courseId: courseId,
        orderBy: 'dueDate desc'
    });

    const coursework = response.result.courseWork || [];

    const submissionsResponse = await gapi.client.classroom.courses.courseWork.studentSubmissions.list({
        courseId: courseId,
        courseWorkId: '-',
        userId: 'me'
    });

    const submissionsMap = new Map();
    if (submissionsResponse.result.studentSubmissions) {
        submissionsResponse.result.studentSubmissions.forEach((sub: any) => {
            submissionsMap.set(sub.courseWorkId, sub.id);
        });
    }

    return coursework.map((item: any): Assignment => {
        const attachments: Attachment[] = (item.materials || [])
            .filter((m: any) => m.driveFile)
            .map((m: any) => ({
                title: m.driveFile.driveFile.title,
                driveFile: {
                    id: m.driveFile.driveFile.id,
                    title: m.driveFile.driveFile.title,
                    alternateLink: m.driveFile.driveFile.alternateLink,
                    mimeType: m.driveFile.driveFile.mimeType,
                }
            }));

        return {
            id: item.id,
            courseId: item.courseId,
            title: item.title,
            description: item.description || 'No description provided.',
            dueDate: formatDate(item.dueDate),
            attachments: attachments,
            studentSubmissionId: submissionsMap.get(item.id)
        };
    });
  }

  async getAttachmentContent(fileId: string, mimeType: string): Promise<string> {
    try {
        const googleMimeTypes: { [key: string]: string } = {
            'application/vnd.google-apps.document': 'text/plain',
            'application/vnd.google-apps.spreadsheet': 'text/csv',
            'application/vnd.google-apps.presentation': 'text/plain'
        };

        // Handle Google Workspace file types by exporting them as plain text
        if (googleMimeTypes[mimeType]) {
            const response = await gapi.client.drive.files.export({
                fileId: fileId,
                mimeType: googleMimeTypes[mimeType]
            });
            return response.body;
        }

        // Handle images and PDFs by downloading and base64 encoding them for the multimodal AI
        const readableImageOrPdf = mimeType.startsWith('image/') || mimeType === 'application/pdf';
        if (readableImageOrPdf) {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            // Prevent oversized files from breaking the AI request
            if (response.body.length > 3 * 1024 * 1024) { // ~3MB limit
                console.warn(`File ${fileId} (${mimeType}) is too large to be processed by AI.`);
                return `[Content of file type (${mimeType}) is too large to be read by the assistant.]`;
            }
            
            const base64Data = btoa(response.body);
            return `data:${mimeType};base64,${base64Data}`;
        }

        return `[Content of file type (${mimeType}) cannot be read by the assistant.]`;

    } catch (error) {
        console.error(`Failed to fetch content for file ${fileId}:`, error);
        return `[Error reading attachment content.]`;
    }
  }

  async uploadFilesToDrive(files: FileBlob[]): Promise<DriveFileLink[]> {
    const uploadPromises = files.map(async (file) => {
      const accessToken = authService.getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const metadata = { name: file.name };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file.blob);

      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.json();
        throw new Error(`Google Drive upload failed for ${file.name}: ${errorBody.error.message}`);
      }

      const result = await uploadResponse.json();
      const fileId = result.id;

      // After uploading, get the file metadata to retrieve the webViewLink
      const metadataResponse = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'webViewLink, name, id', // Request the data we need
      });

      return {
        name: metadataResponse.result.name,
        id: metadataResponse.result.id,
        link: metadataResponse.result.webViewLink,
      };
    });

    return Promise.all(uploadPromises);
  }
}

const classroomApi = new ClassroomApiService();
export default classroomApi;