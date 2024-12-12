import express from 'express';
import { supabase } from '../config/supabase.js';

export const coursesRouter = express.Router();

// Get all courses with their teachers
coursesRouter.get('/', async (req, res, next) => {
    try {
        console.log('Fetching all courses...');
        const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select(`
                id,
                name_he,
                name_en,
                description_he,
                description_en,
                created_at,
                course_teachers (
                    teacher_id,
                    members:teacher_id (
                        id,
                        name_he,
                        name_en,
                        role_he,
                        role_en,
                        image_url
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (coursesError) {
            console.error('Error fetching courses:', coursesError);
            throw coursesError;
        }

        console.log('Courses fetched successfully:', courses.length);
        
        // Transform the data to include teachers directly
        const transformedCourses = courses.map(course => ({
            id: course.id,
            title_he: course.name_he, // Map name_he to title_he for frontend compatibility
            title_en: course.name_en, // Map name_en to title_en for frontend compatibility
            description_he: course.description_he,
            description_en: course.description_en,
            teachers: course.course_teachers?.map(ct => ct.members) || []
        }));

        res.json(transformedCourses);
    } catch (error) {
        console.error('Error in GET /courses:', error);
        next(error);
    }
});

// Get a single course with its teachers
coursesRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        console.log('Fetching course by ID:', id);

        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select(`
                *,
                course_teachers (
                    teacher_id,
                    members:teacher_id (
                        id,
                        name_he,
                        name_en,
                        role_he,
                        role_en,
                        image_url
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (courseError) {
            console.error('Error fetching course:', courseError);
            throw courseError;
        }

        if (!course) {
            console.log('Course not found:', id);
            return res.status(404).json({ error: 'Course not found' });
        }

        console.log('Course fetched successfully:', course.id);

        // Transform the data to include teachers directly
        const transformedCourse = {
            ...course,
            title_he: course.name_he, // Map name_he to title_he for frontend compatibility
            title_en: course.name_en, // Map name_en to title_en for frontend compatibility
            teachers: course.course_teachers?.map(ct => ct.members) || []
        };

        res.json(transformedCourse);
    } catch (error) {
        console.error('Error in GET /courses/:id:', error);
        next(error);
    }
});

// Search courses
coursesRouter.get('/search/:query', async (req, res, next) => {
    try {
        const { query } = req.params;
        console.log('Searching courses with query:', query);
        
        const { data, error } = await supabase
            .from('courses')
            .select(`
                *,
                course_teachers (
                    teacher_id,
                    members:teacher_id (
                        id,
                        name_he,
                        name_en,
                        role_he,
                        role_en,
                        image_url
                    )
                )
            `)
            .or(`name_he.ilike.%${query}%,name_en.ilike.%${query}%,description_he.ilike.%${query}%,description_en.ilike.%${query}%`);

        if (error) {
            console.error('Error searching courses:', error);
            throw error;
        }

        console.log('Search results:', data.length);

        // Transform the data to include teachers directly
        const transformedCourses = data.map(course => ({
            ...course,
            title_he: course.name_he, // Map name_he to title_he for frontend compatibility
            title_en: course.name_en, // Map name_en to title_en for frontend compatibility
            teachers: course.course_teachers?.map(ct => ct.members) || []
        }));

        res.json(transformedCourses);
    } catch (error) {
        console.error('Error in GET /courses/search/:query:', error);
        next(error);
    }
});

// Add a teacher to a course
coursesRouter.post('/:courseId/teachers', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        const { courseId } = req.params;
        const { teacherId } = req.body;

        // Verify the teacher is the one making the request
        if (sessionData.user.id !== teacherId) {
            return res.status(403).json({ message: 'Forbidden: Cannot add another teacher' });
        }

        // Check if the teacher is already associated with the course
        const { data: existingTeachers, error: checkError } = await supabase
            .from('course_teachers')
            .select('*')
            .eq('course_id', courseId)
            .eq('teacher_id', teacherId);

        if (checkError) {
            console.error('Error checking existing teachers:', checkError);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (existingTeachers.length > 0) {
            return res.status(400).json({ message: 'Teacher already associated with this course' });
        }

        // Add teacher to the course
        const { data, error } = await supabase
            .from('course_teachers')
            .insert({ 
                course_id: courseId, 
                teacher_id: teacherId 
            })
            .select();

        if (error) {
            console.error('Error adding teacher to course:', error);
            return res.status(500).json({ message: 'Failed to add teacher to course' });
        }

        res.status(201).json(data[0]);
    } catch (error) {
        console.error('Error in POST /courses/:courseId/teachers:', error);
        next(error);
    }
});

// Remove a teacher from a course
coursesRouter.delete('/:courseId/teachers', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        const { courseId } = req.params;
        const { teacherId } = req.body;

        // Verify the teacher is the one making the request
        if (sessionData.user.id !== teacherId) {
            return res.status(403).json({ message: 'Forbidden: Cannot remove another teacher' });
        }

        // Remove teacher from the course
        const { data, error } = await supabase
            .from('course_teachers')
            .delete()
            .eq('course_id', courseId)
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error removing teacher from course:', error);
            return res.status(500).json({ message: 'Failed to remove teacher from course' });
        }

        res.status(200).json({ message: 'Teacher removed from course' });
    } catch (error) {
        console.error('Error in DELETE /courses/:courseId/teachers:', error);
        next(error);
    }
});
