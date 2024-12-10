import express from 'express';
import { supabase } from '../config/supabase.js';

export const authRouter = express.Router();

// Login endpoint
authRouter.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        // First try to find user by email in users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', username.toLowerCase())
            .single();

        // If found in users table, verify password_hash
        if (user && user.password_hash === password) {
            // Find corresponding member
            const { data: member, error: memberError } = await supabase
                .from('members')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (memberError) throw memberError;
            if (!member) {
                return res.status(401).json({ message: 'Member profile not found' });
            }

            const sessionToken = Buffer.from(JSON.stringify({
                memberId: member.id,
                timestamp: Date.now()
            })).toString('base64');

            return res.json({
                member,
                sessionToken
            });
        }

        // If not found in users table or password didn't match, try members table
        const { data: members, error: memberError } = await supabase
            .from('members')
            .select('*')
            .or(`id.eq.${username},id.eq.${username.toLowerCase()}`);

        if (memberError) throw memberError;

        const member = members.find(m => 
            (m.id.toLowerCase() === username.toLowerCase() || 
             m.id.toLowerCase().replace(/-/g, '') === username.toLowerCase().replace(/-/g, '')) && 
            m.password === password
        );

        if (!member) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

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

// Change password
authRouter.post('/change-password', async (req, res, next) => {
    try {
        // Verify session token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const sessionData = JSON.parse(Buffer.from(token, 'base64').toString());
        
        const { currentPassword, newPassword } = req.body;
        
        // Get user from database
        const { data: user, error: userError } = await supabase
            .from('members')
            .select('*')
            .eq('id', sessionData.memberId)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Verify current password
        const { data: validPassword, error: pwError } = await supabase
            .rpc('verify_password', { 
                member_id: user.id,
                password_to_check: currentPassword
            });
            
        if (pwError || !validPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        // Update password
        const { error: updateError } = await supabase
            .rpc('change_member_password', { 
                member_id: user.id,
                new_password: newPassword
            });
            
        if (updateError) {
            throw updateError;
        }
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        next(error);
    }
});
