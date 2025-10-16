import React, { useState, useEffect, useCallback } from 'react';
import type { Course, Assignment, UserProfile } from '../types';
import AssignmentView from './AssignmentView';
import { LogoutIcon, PaperclipIcon } from './icons';
import classroomApi from '../services/classroomApi';

interface DashboardProps {
  user: UserProfile;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsCoursesLoading(true);
    setError(null);
    classroomApi.getCourses()
      .then(fetchedCourses => {
        setCourses(fetchedCourses);
      })
      .catch(err => {
        console.error(err);
        setError("Could not fetch courses. Please ensure you've granted Classroom permissions.");
      })
      .finally(() => {
        setIsCoursesLoading(false);
      });
  }, []);

  const selectCourse = useCallback((course: Course) => {
    setSelectedCourse(course);
    setSelectedAssignment(null);
    setAssignments([]);
    setIsAssignmentsLoading(true);
    setError(null);
    classroomApi.getAssignments(course.id)
      .then(fetchedAssignments => {
        setAssignments(fetchedAssignments);
      })
      .catch(err => {
        console.error(err);
        setError(`Could not fetch assignments for ${course.name}.`);
      })
      .finally(() => {
        setIsAssignmentsLoading(false);
      });
  }, []);

  if (selectedAssignment && selectedCourse) {
    return <AssignmentView assignment={selectedAssignment} course={selectedCourse} onBack={() => setSelectedAssignment(null)} />;
  }

  return (
    <div className="min-h-screen bg-secondary p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <h1 className="text-3xl font-bold text-text-primary">Your Classroom Dashboard</h1>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-right">
                    <div>
                        <p className="font-semibold text-text-primary">{user.name}</p>
                        <p className="text-xs text-text-secondary">{user.email}</p>
                    </div>
                    <img src={user.picture} alt="User avatar" className="w-10 h-10 rounded-full" />
                </div>
                <button 
                    onClick={onLogout}
                    className="flex items-center gap-2 text-text-secondary hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50"
                    title="Disconnect Google Account"
                >
                    <LogoutIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Disconnect</span>
                </button>
            </div>
        </header>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Courses List */}
          <div className="lg:col-span-1 bg-primary rounded-lg border border-border-color p-6 h-fit shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Your Courses</h2>
            {isCoursesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-secondary h-20 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : courses.length > 0 ? (
              <ul className="space-y-3">
                {courses.map(course => (
                  <li key={course.id}>
                    <button
                      onClick={() => selectCourse(course)}
                      className={`w-full text-left p-4 rounded-lg transition-colors border ${selectedCourse?.id === course.id ? 'bg-accent text-white border-accent shadow-md' : 'bg-primary border-border-color hover:border-accent hover:shadow-sm'}`}
                    >
                      <p className="font-bold">{course.name}</p>
                      <p className="text-sm opacity-80">{course.teacher}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
                <p className="text-text-secondary text-center py-8">No courses found.</p>
            )}
          </div>

          {/* Assignments List */}
          <div className="lg:col-span-2 bg-primary rounded-lg border border-border-color p-6 shadow-sm min-h-[300px]">
            {selectedCourse ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Assignments for {selectedCourse.name}</h2>
                {isAssignmentsLoading ? (
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="bg-secondary h-24 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : assignments.length > 0 ? (
                  <ul className="space-y-4">
                    {assignments.map(assignment => (
                      <li key={assignment.id} className="bg-secondary p-4 rounded-lg border border-border-color hover:border-accent transition-all group hover:shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex-grow">
                            <h3 className="font-bold text-text-primary">{assignment.title}</h3>
                            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{assignment.description}</p>
                            {assignment.attachments && assignment.attachments.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
                                    <PaperclipIcon className="w-4 h-4" />
                                    <span>{assignment.attachments.length} attachment{assignment.attachments.length > 1 ? 's' : ''}</span>
                                </div>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedAssignment(assignment)}
                            className="bg-accent text-white font-bold py-2 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-100 scale-95 ml-4 flex-shrink-0"
                          >
                            Solve
                          </button>
                        </div>
                        <p className="text-xs text-text-secondary mt-3">Due: {assignment.dueDate}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-secondary text-center py-8">No assignments found for this course.</p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-text-secondary">Select a course to see your assignments.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;