const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
    try {
        // Parse the service account JSON from Environment Variables
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper function to send email
const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Flipkart Label Cropper" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log('Email sent: ' + info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Email sending error:", error);
        throw error;
    }
};

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
    // Enable CORS for Vercel (although Vercel handles same-origin automatically, good for local dev)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this to your exact vercel domain later if needed
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Verify Authorization Header (Firebase Token)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        let decodedToken;
        try {
            if (!admin.apps.length) throw new Error("Firebase Admin not initialized properly.");
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (authErr) {
            console.error("Token verification failed:", authErr);
            return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
        }

        // Token is valid! decodedToken.uid contains the user's Firebase UID
        
        // 2. Parse Request Body
        const { targetEmail, transferLink } = req.body;
        
        if (!targetEmail || !transferLink) {
            return res.status(400).json({ error: 'Missing targetEmail or transferLink' });
        }
        
        // 3. Send Email
        const subject = "Data Transfer Request - Flipkart Label Cropper";
        const html = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 40px 20px;">
                <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center;">
                    <div style="background-color: #2874f0; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 30px;">🔄</span>
                    </div>
                    <h2 style="color: #1a1a1a; margin-bottom: 10px; font-size: 24px;">Data Transfer Request</h2>
                    <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        Hello,<br>You have received a request from a verified user to securely transfer their account data and inventory to this email address on <strong>Flipkart Label Cropper</strong>.
                    </p>
                    
                    <a href="${transferLink}" style="display: inline-block; background-color: #2874f0; color: #ffffff; font-weight: bold; font-size: 16px; text-decoration: none; padding: 15px 35px; border-radius: 8px; box-shadow: 0 4px 6px rgba(40, 116, 240, 0.2);">
                        Accept Data Transfer
                    </a>
                    
                    <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                        <p style="color: #888; font-size: 13px; line-height: 1.5;">
                            If you didn't request this transfer, you can safely ignore this email. No data will be transferred unless you click the button above.
                        </p>
                    </div>
                </div>
            </div>
        `;

        await sendEmail(targetEmail, subject, html);
        res.status(200).json({ success: true, message: 'Transfer email sent successfully!' });
    } catch (error) {
        console.error("Vercel Serverless Error:", error);
        res.status(500).json({ error: 'Failed to process request', details: error.message });
    }
};
