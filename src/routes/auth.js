import express from 'express';
import { supabase } from '../config/supabase.js';

export const authRouter = express.Router();

// Login endpoint
authRouter.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        // Normalize the username by converting to lowercase and removing hyphens
        const normalizedUsername = username.toLowerCase().replace(/-/g, '');
        
        // Check if password is correct
        if (password !== '1234') {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Find member by normalized ID
        const { data: members, error: memberError } = await supabase
            .from('members')
            .select('*');

        if (memberError) throw memberError;

        // Find member by comparing normalized IDs
        const member = members.find(m => 
            m.id.toLowerCase().replace(/-/g, '') === normalizedUsername
        );

        if (!member) {
            return res.status(401).json({ message: 'Member not found' });
        }

        // Create a session token
        const sessionToken = Buffer.from(JSON.stringify({
            memberId: member.id,
            timestamp: Date.now()
        })).toString('base64');

        res.json({
            member,
            sessionToken
        });
    } catch (error) {
        next(error);
    }
});

// Logout endpoint
authRouter.post('/logout', async (req, res, next) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

// Validate session
authRouter.get('/validate', async (req, res, next) => {
    try {
        const sessionToken = req.headers.authorization?.split(' ')[1];
        
        if (!sessionToken) {
            return res.status(401).json({ message: 'No session token provided' });
        }

        try {
            const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
            
            // Check if session is expired (24 hours)
            if (Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000) {
                return res.status(401).json({ message: 'Session expired' });
            }

            const { data: member, error } = await supabase
                .from('members')
                .select('*')
                .eq('id', sessionData.memberId)
                .single();

            if (error) throw error;

            res.json({ member });
        } catch (e) {
            return res.status(401).json({ message: 'Invalid session token' });
        }
    } catch (error) {
        next(error);
    }
});

// Get current session
authRouter.get('/session', async (req, res, next) => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        res.json({ session });
    } catch (error) {
        next(error);
    }
});
