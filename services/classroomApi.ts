// services/classroomApi.ts
import type { Course, Assignment, FileBlob, Attachment } from '../types';
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
        // Handle Google Workspace file types by exporting them as plain text
        const googleMimeTypes: { [key: string]: string } = {
            'application/vnd.google-apps.document': 'text/plain',
            'application/vnd.google-apps.spreadsheet': 'text/csv',
            'application/vnd.google-apps.presentation': 'text/plain'
        };

        if (googleMimeTypes[mimeType]) {
            const response = await gapi.client.drive.files.export({
                fileId: fileId,
                mimeType: googleMimeTypes[mimeType]
            });
            return response.body;
        }

        // For other readable types, you could add more handlers here.
        // For now, we inform the AI we can't read non-Google Workspace files.
        return `[Content of file type (${mimeType}) cannot be read by the assistant.]`;

    } catch (error) {
        console.error(`Failed to fetch content for file ${fileId}:`, error);
        return `[Error reading attachment content.]`;
    }
  }

  async submitAssignment(courseId: string, courseWorkId: string, submissionId: string, files: FileBlob[]): Promise<{ success: true }> {
    const driveFileIds = await Promise.all(
      files.map(file => this.uploadFileToDrive(file))
    );
    
    await gapi.client.classroom.courses.courseWork.studentSubmissions.modifyAttachments({
      courseId: courseId,
      courseWorkId: courseWorkId,
      id: submissionId,
      resource: {
        addAttachments: driveFileIds.map(fileId => ({
          driveFile: { id: fileId }
        }))
      }
    });

    await gapi.client.classroom.courses.courseWork.studentSubmissions.turnIn({
        courseId: courseId,
        courseWorkId: courseWorkId,
        id: submissionId,
        resource: {}
    });

    return { success: true };
  }

  private async uploadFileToDrive(file: FileBlob): Promise<string> {
    const accessToken = authService.getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");
    
    const metadata = {
      name: file.name,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file.blob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Google Drive upload failed: ${errorBody.error.message}`);
    }

    const result = await response.json();
    return result.id;
  }
}

const classroomApi = new ClassroomApiService();
export default classroomApi;