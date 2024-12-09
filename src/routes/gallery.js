import express from 'express';
import { supabase } from '../config/supabase.js';

export const galleryRouter = express.Router();

// Get all gallery items
galleryRouter.get('/', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('gallery_items')
            .select(`
                *,
                artist:members!gallery_items_artist_id_fkey (
                    id,
                    name_he,
                    name_en,
                    bio_he,
                    bio_en,
                    image_url
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error in GET /gallery:', error);
        next(error);
    }
});

// Get a single gallery item
galleryRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get the gallery item with artist details in a single query
        const { data, error } = await supabase
            .from('gallery_items')
            .select(`
                *,
                artist:members!gallery_items_artist_id_fkey (
                    id,
                    name_he,
                    name_en,
                    bio_he,
                    bio_en,
                    image_url
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching gallery item:', error);
            throw error;
        }

        if (!data) {
            return res.status(404).json({ error: 'Gallery item not found' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error in GET /gallery/:id:', error);
        next(error);
    }
});
