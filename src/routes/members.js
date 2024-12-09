import express from 'express';
import multer from 'multer';
import path from 'path';
import { supabase } from '../config/supabase.js';

export const membersRouter = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get all members
membersRouter.get('/', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Get a single member with their courses and gallery items
membersRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get member details
        const { data: member, error: memberError } = await supabase
            .from('members')
            .select('*')
            .eq('id', id)
            .single();

        if (memberError) throw memberError;

        // Get member's courses (both teaching and all available)
        const [courseTeachersResult, allCoursesResult] = await Promise.all([
            supabase
                .from('course_teachers')
                .select(`
                    course_id,
                    courses:course_id (*)
                `)
                .eq('teacher_id', id),
            supabase
                .from('courses')
                .select('*')
        ]);

        if (courseTeachersResult.error) throw courseTeachersResult.error;
        if (allCoursesResult.error) throw allCoursesResult.error;

        // Get member's gallery items
        const { data: galleryItems, error: galleryError } = await supabase
            .from('gallery_items')
            .select('*')
            .eq('artist_id', id)
            .order('created_at', { ascending: false });

        if (galleryError) throw galleryError;

        // Combine all data
        const memberWithDetails = {
            ...member,
            teaching_courses: courseTeachersResult.data.map(ct => ct.courses),
            all_courses: allCoursesResult.data,
            gallery_items: galleryItems
        };

        res.json(memberWithDetails);
    } catch (error) {
        next(error);
    }
});

// Update member details
membersRouter.patch('/:id', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Check if token is valid and matches the member being updated
        if (sessionData.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { name_he, name_en, role_he, role_en, bio_he, bio_en } = req.body;

        // Update member data
        const { data, error } = await supabase
            .from('members')
            .update({
                name_he,
                name_en,
                role_he,
                role_en,
                bio_he,
                bio_en
            })
            .eq('id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        next(error);
    }
});

// Add gallery item
membersRouter.post('/:id/gallery', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (sessionData.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { title_he, title_en, description_he, description_en, image_url } = req.body;

        const { data, error } = await supabase
            .from('gallery_items')
            .insert({
                artist_id: req.params.id,
                title_he,
                title_en,
                description_he,
                description_en,
                image_url
            })
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        next(error);
    }
});

// Update gallery item
membersRouter.patch('/:id/gallery/:itemId', async (req, res, next) => {
    try {
        // Verify session token and ownership
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (sessionData.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { title_he, title_en, description_he, description_en, image_url } = req.body;

        const { data, error } = await supabase
            .from('gallery_items')
            .update({
                title_he,
                title_en,
                description_he,
                description_en,
                image_url
            })
            .eq('id', req.params.itemId)
            .eq('artist_id', req.params.id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        next(error);
    }
});

// Delete gallery item
membersRouter.delete('/:id/gallery/:itemId', async (req, res, next) => {
    try {
        // Verify session token and ownership
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (sessionData.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { error } = await supabase
            .from('gallery_items')
            .delete()
            .eq('id', req.params.itemId)
            .eq('artist_id', req.params.id);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Add course teaching assignment
membersRouter.post('/:id/courses/:courseId/teach', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (sessionData.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { data, error } = await supabase
            .from('course_teachers')
            .insert({
                teacher_id: req.params.id,
                course_id: req.params.courseId
            })
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        next(error);
    }
});

// Remove course teaching assignment
membersRouter.delete('/:id/courses/:courseId/teach', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        if (sessionData.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { error } = await supabase
            .from('course_teachers')
            .delete()
            .eq('teacher_id', req.params.id)
            .eq('course_id', req.params.courseId);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Upload member image
membersRouter.post('/upload-image', upload.single('image'), async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('member-images')
            .upload(req.file.filename, req.file.path, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('member-images')
            .getPublicUrl(data.path);

        res.json({ url: publicUrl });
    } catch (error) {
        next(error);
    }
});

// Add member as teacher to course
membersRouter.post('/:memberId/courses/:courseId/teach', async (req, res, next) => {
    try {
        const { memberId, courseId } = req.params;
        
        // Verify member exists
        const { data: member, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('id', memberId)
            .single();
            
        if (memberError || !member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Verify course exists
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('id')
            .eq('id', courseId)
            .single();
            
        if (courseError || !course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Add member as teacher
        const { error: insertError } = await supabase
            .from('course_teachers')
            .insert([{ member_id: memberId, course_id: courseId }]);

        if (insertError) {
            console.error('Error adding teacher:', insertError);
            return res.status(500).json({ error: 'Failed to add teacher' });
        }

        res.status(200).json({ message: 'Successfully added as teacher' });
    } catch (error) {
        console.error('Error in add teacher endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove member as teacher from course
membersRouter.delete('/:memberId/courses/:courseId/teach', async (req, res, next) => {
    try {
        const { memberId, courseId } = req.params;

        const { error } = await supabase
            .from('course_teachers')
            .delete()
            .match({ member_id: memberId, course_id: courseId });

        if (error) {
            console.error('Error removing teacher:', error);
            return res.status(500).json({ error: 'Failed to remove teacher' });
        }

        res.status(200).json({ message: 'Successfully removed as teacher' });
    } catch (error) {
        console.error('Error in remove teacher endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
