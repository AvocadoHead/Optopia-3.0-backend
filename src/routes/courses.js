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
