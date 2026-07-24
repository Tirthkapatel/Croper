// =========================================================================
// Custom UI Injection (Ensures Modals exist even if index.html is cached)
function injectCustomModals() {
    if (document.getElementById('toast-container')) return; // Already injected
    
    const html = `
        <!-- Custom Toast Notification Container -->
        <div id="toast-container" style="position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 9999;"></div>

        <!-- Custom Alert Modal -->
        <div class="modal-overlay hidden" id="custom-alert-overlay" style="z-index: 10000;"></div>
        <div class="glass-panel modal-card hidden" id="custom-alert-modal" style="z-index: 10001; text-align: center; max-width: 400px;">
            <div id="custom-alert-icon" style="margin-bottom: 15px;"></div>
            <h3 id="custom-alert-title" style="color: #1e293b; margin-bottom: 10px; font-size: 1.3rem;">Notice</h3>
            <p id="custom-alert-message" style="color: #64748b; font-size: 1rem; margin-bottom: 25px; line-height: 1.5; word-break: break-all; overflow-wrap: break-word;"></p>
            <button class="btn primary-btn" id="custom-alert-btn" style="width: 100%;">OK</button>
        </div>

        <!-- Custom Confirm Modal -->
        <div class="modal-overlay hidden" id="custom-confirm-overlay" style="z-index: 10000;"></div>
        <div class="glass-panel modal-card hidden" id="custom-confirm-modal" style="z-index: 10001; text-align: center; max-width: 400px;">
            <div style="margin-bottom: 15px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h3 id="custom-confirm-title" style="color: #1e293b; margin-bottom: 10px; font-size: 1.3rem;">Confirm</h3>
            <p id="custom-confirm-message" style="color: #64748b; font-size: 1rem; margin-bottom: 25px; line-height: 1.5;"></p>
            <div style="display: flex; gap: 15px;">
                <button class="btn secondary-btn" id="custom-confirm-cancel-btn" style="flex: 1;">Cancel</button>
                <button class="btn primary-btn" id="custom-confirm-ok-btn" style="flex: 1; background: #ef4444;">Confirm</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}
injectCustomModals();

// Custom UI Functions
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">${message}</div>
    `;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Global Error Handlers (Zero Silent Failures)
window.addEventListener('error', function(event) {
    if (event.message && !event.message.includes('ResizeObserver')) {
        showToast("Error: " + event.message, "error");
    }
});

window.addEventListener('unhandledrejection', function(event) {
    if (event.reason) {
        let msg = typeof event.reason === 'string' ? event.reason : (event.reason.message || "Unknown error");
        showToast("Error: " + msg, "error");
    }
});

window.showAlert = function(title, message, type = 'info', callback = null) {
    const overlay = document.getElementById('custom-alert-overlay');
    const modal = document.getElementById('custom-alert-modal');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');
    const iconEl = document.getElementById('custom-alert-icon');
    const btn = document.getElementById('custom-alert-btn');
    
    titleEl.innerText = title;
    msgEl.innerHTML = message;
    
    if (type === 'success') {
        iconEl.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        btn.style.background = '#10b981';
    } else if (type === 'error') {
        iconEl.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        btn.style.background = '#ef4444';
    } else {
        iconEl.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        btn.style.background = '#3b82f6';
    }
    
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    btn.onclick = () => {
        overlay.classList.add('hidden');
        modal.classList.add('hidden');
        if (callback) callback();
    };
};

window.showConfirm = function(title, message, onConfirm, confirmText = "Confirm", confirmColor = "#ef4444") {
    const overlay = document.getElementById('custom-confirm-overlay');
    const modal = document.getElementById('custom-confirm-modal');
    
    document.getElementById('custom-confirm-title').innerText = title;
    document.getElementById('custom-confirm-message').innerText = message;
    
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
    
    okBtn.innerText = confirmText;
    okBtn.style.background = confirmColor;
    
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    const close = () => {
        overlay.classList.add('hidden');
        modal.classList.add('hidden');
    };
    
    cancelBtn.onclick = close;
    okBtn.onclick = () => {
        close();
        onConfirm();
    };
};

// =========================================================================
// ⚠️ IMPORTANT: REPLACE THIS CONFIG WITH YOUR ACTUAL FIREBASE PROJECT CONFIG
// 1. Go to console.firebase.google.com
// 2. Create a project
// 3. Enable Authentication (Email/Password)
// 4. Register a Web App to get this config object
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyD4RtqUOVpThObS417Fiwj3Bz_S-OZeUKo",
  authDomain: "get-autocut.firebaseapp.com",
  projectId: "get-autocut",
  storageBucket: "get-autocut.firebasestorage.app",
  messagingSenderId: "402865929644",
  appId: "1:402865929644:web:4fb597fe383345f18f0e09",
  measurementId: "G-GQ5521HGNR"
};

// Initialize Firebase (Only if config is changed from placeholder)
let app, auth, db;
if (firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE") {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    window.db = db;
    window.auth = auth;
} else {
    console.warn("Firebase is not configured! Authentication will run in 'Mock Mode' for preview purposes only.");
}

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContent = document.getElementById('app-content');
const navbar = document.getElementById('navbar');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleLink = document.getElementById('auth-toggle-link');
const authError = document.getElementById('auth-error');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// State
let isLoginMode = true;

const getBtnHtml = (text) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <span>${text}</span>`;

// Toggle between Login and Sign Up
authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    authError.classList.add('hidden');
    
    if (isLoginMode) {
        authTitle.innerText = "Login";
        authSubtitle.innerText = "Welcome back! Please login to continue.";
        authSubmitBtn.innerHTML = getBtnHtml("Login");
        authToggleText.innerText = "Don't have an account?";
        authToggleLink.innerText = "Sign Up";
        const fpLink = document.getElementById('main-forgot-password');
        if(fpLink) fpLink.style.display = 'inline';
    } else {
        authTitle.innerText = "Sign Up";
        authSubtitle.innerText = "Create an account to start saving data.";
        authSubmitBtn.innerHTML = getBtnHtml("Sign Up");
        authToggleText.innerText = "Known to Flipkart Cropper?";
        authToggleLink.innerText = "Sign in to continue!";
        const fpLink = document.getElementById('main-forgot-password');
        if(fpLink) fpLink.style.display = 'none';
    }
});

// Forgot Password Logic
const mainForgotPassword = document.getElementById('main-forgot-password');
if (mainForgotPassword) {
    mainForgotPassword.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            authError.innerText = "❌ Please enter your email address first.";
            authError.classList.remove('hidden');
            return;
        }
        
        if (!auth) {
            showToast("This is a Mock environment. Real password reset emails require Firebase Config.", "info");
            return;
        }
        
        try {
            // Since Email Enumeration Protection is ON, we cannot check if the account exists or is Google.
            // We just send the request. Firebase will silently drop it if the account is Google-only or doesn't exist.
            await auth.sendPasswordResetEmail(email);
            showToast(`If an account exists for ${email} (and is not a Google account), a reset link has been sent. Please check your inbox/spam folder.`, "success");
        } catch (error) {
            console.error("Forgot Password Error:", error);
            authError.innerText = getFriendlyErrorMessage(error);
            authError.classList.remove('hidden');
        }
    });
}

// Helper function for professional error messages
function getFriendlyErrorMessage(error) {
    let msg = '';
    
    // Check if the error message is a raw JSON string from Identity Platform
    if (error.message && typeof error.message === 'string' && error.message.includes('INVALID_LOGIN_CREDENTIALS')) {
        return '❌ Invalid login credentials. Please check your email and password.';
    }

    switch (error.code) {
        case 'auth/popup-closed-by-user':
            msg = 'Login was cancelled. Please try again.'; break;
        case 'auth/invalid-email':
            msg = 'Please enter a valid email address.'; break;
        case 'auth/user-not-found':
            msg = 'No account found with this email. Please sign up.'; break;
        case 'auth/wrong-password':
            msg = 'Incorrect password. Please try again.'; break;
        case 'auth/email-already-in-use':
            msg = 'This email is already registered. Please log in instead.'; break;
        case 'auth/weak-password':
            msg = 'Your password is too weak. It should be at least 6 characters.'; break;
        case 'auth/too-many-requests':
            msg = 'Too many failed attempts. Please try again later.'; break;
        case 'auth/network-request-failed':
            msg = 'Network error. Please check your internet connection.'; break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            msg = 'Invalid login credentials. Please check your email and password.'; break;
        default:
            msg = 'An unexpected error occurred. Please try again later.';
            // Fallback for raw JSON if we didn't catch it
            if (error.message && !error.message.includes('{')) {
                msg = error.message;
            }
    }
    return '❌ ' + msg;
}

// Helper to check for disposable emails
window.isDisposableEmail = async function(email) {
    const domain = email.split('@')[1];
    if (!domain) return false;
    try {
        const response = await fetch(`https://disposable.debounce.io/?email=${email}`);
        if (response.ok) {
            const data = await response.json();
            if (data.disposable === "true" || data.disposable === true) {
                return true;
            }
        }
    } catch (e) {
        // Ignore network errors to not block legitimate users
        console.warn("Disposable email check failed:", e);
    }
    return false;
};

// Handle Form Submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        authError.innerText = "❌ Please enter both email and password.";
        authError.classList.remove('hidden');
        return;
    }

    authError.classList.add('hidden');
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerHTML = getBtnHtml("Processing...");

    try {
        if (!auth) {
            // MOCK MODE (If user hasn't added Firebase config yet)
            setTimeout(() => {
                showAlert("Mock Mode", "This is a Mock Login because Firebase config is missing. To make this real, add your firebaseConfig to auth.js!", "info", () => {
                    showAppUI(email);
                    authSubmitBtn.disabled = false;
                    authSubmitBtn.innerHTML = getBtnHtml(isLoginMode ? "Login" : "Sign Up");
                });
            }, 1000);
            return;
        }

        // REAL FIREBASE AUTH
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
            window.createNotification(email, "New Login", `Your account was accessed from a new session.`, "security");
        } else {
            // Block temporary/disposable emails on signup
            const isDisposable = await window.isDisposableEmail(email);
            if (isDisposable) {
                throw new Error("Temporary or disposable email addresses are not allowed. Please use a valid email.");
            }
            
            await auth.createUserWithEmailAndPassword(email, password);
            window.createNotification(email, "Welcome!", `Welcome to Flipkart Label Cropper! Start managing your inventory today.`, "success");
        }
    } catch (error) {
        console.error("Auth Error:", error);
        authError.innerText = getFriendlyErrorMessage(error);
        authError.classList.remove('hidden');
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerHTML = getBtnHtml(isLoginMode ? "Login" : "Sign Up");
    }
});

// Handle Google Login
const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        if (!auth) {
            showAlert("Mock Mode", "This is a Mock Google Login. To make this real, add your firebaseConfig to auth.js!", "info", () => {
                showAppUI("guest@google.com");
            });
            return;
        }
        
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const isNewUser = result.additionalUserInfo && result.additionalUserInfo.isNewUser;
            if (isNewUser) {
                window.createNotification(result.user.email, "Welcome!", `Welcome to Flipkart Label Cropper! Your Google account was linked.`, "success");
            } else {
                window.createNotification(result.user.email, "New Login", `Your account was accessed via Google.`, "security");
            }
        } catch (error) {
            console.error("Google Auth Error:", error);
            // Hide error if user intentionally closed the popup, otherwise show friendly message
            if (error.code === 'auth/popup-closed-by-user') {
                authError.classList.add('hidden');
            } else {
                authError.innerText = getFriendlyErrorMessage(error);
                authError.classList.remove('hidden');
            }
        }
    });
}

// Handle Logout
logoutBtn.addEventListener('click', () => {
    if (auth) {
        auth.signOut();
    } else {
        // Mock logout
        showAuthUI();
    }
});

// Send Email Notification using EmailJS (Placeholder)
function sendEmailNotification(email, type) {
    console.log(`[EmailJS] Sending ${type} email to ${email}`);
    // emailjs.init("YOUR_PUBLIC_KEY");
    // emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
    //     to_email: email,
    //     message_type: type
    // }).then(res => console.log("Email sent!", res))
    // .catch(err => console.error("Email failed:", err));
}

// Listen to Auth State Changes
if (auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            const email = user.email;
            
            // 1. Check Deactivation
            if (localStorage.getItem('deactivated_' + email)) {
                // Since showConfirm is async, we don't proceed to showAppUI yet.
                showConfirm(
                    "Account Deactivated", 
                    "Your account is currently deactivated. Do you want to reactivate it?",
                    () => { // On Confirm
                        localStorage.removeItem('deactivated_' + email);
                        showToast("Account reactivated successfully!", "success");
                        showAppUI(email);
                    },
                    "Reactivate",
                    "#10b981"
                );
                
                // If they cancel (or while waiting), we keep them out of the app.
                // We must override the cancel button behavior for this specific case to logout.
                const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
                const oldCancel = cancelBtn.onclick;
                cancelBtn.onclick = () => {
                    oldCancel();
                    auth.signOut();
                };
                return;
            }

            // 2. Check 7-Day Deletion Schedule
            const deleteRequestedAt = localStorage.getItem('deleted_' + email);
            if (deleteRequestedAt) {
                const requestedDate = new Date(parseInt(deleteRequestedAt));
                const now = new Date();
                const daysPassed = (now - requestedDate) / (1000 * 60 * 60 * 24);
                
                if (daysPassed >= 7) {
                    // Permanently block/delete
                    showAlert("Account Deleted", "Your account has been permanently deleted as 7 days have passed.", "error", () => {
                        localStorage.removeItem('inventory_' + email); // clear data
                        localStorage.removeItem('deleted_' + email);
                        user.delete().catch(e => console.log("Final deletion error:", e));
                        auth.signOut();
                    });
                    return;
                } else {
                    // Show Recovery Screen
                    showRecoveryUI(email, requestedDate);
                    return;
                }
            }
            
            showAppUI(user.email);
        } else {
            showAuthUI();
        }
    });
}

function showAppUI(email) {
    authContainer.style.display = 'none';
    
    // Load inventory specific to this user email
    if (typeof window.loadInventoryForUser === 'function') {
        window.loadInventoryForUser(email);
    }
    
    // Initialize Notifications
    if (typeof initNotificationListener === 'function') {
        initNotificationListener(email);
    }
    
    // Hide all main containers first
    const allDashboards = document.querySelectorAll('.app-wrapper');
    allDashboards.forEach(d => { if(d) d.classList.add('hidden'); });
    
    // Show Analytics Dashboard by default
    const analyticsDashboard = document.getElementById('analytics-dashboard');
    if(analyticsDashboard) {
        analyticsDashboard.classList.remove('hidden');
        if (typeof renderAnalyticsGraph === 'function') {
            setTimeout(renderAnalyticsGraph, 100);
        }
    }
    
    navbar.classList.remove('hidden');
    // Smart email display: show short version on mobile, full on tooltip
    const atIndex = email.indexOf('@');
    const username = atIndex > -1 ? email.substring(0, atIndex) : email;
    const isMobile = window.innerWidth < 480;
    userEmailSpan.innerText = isMobile ? username : email;
    userEmailSpan.title = email; // Full email visible on hover/long-press (native tooltip)
    // Update on resize
    const _updateEmailDisplay = () => {
        userEmailSpan.innerText = window.innerWidth < 480 ? username : email;
    };
    window.removeEventListener('resize', window._navEmailResize);
    window._navEmailResize = _updateEmailDisplay;
    window.addEventListener('resize', window._navEmailResize);
    
    // Populate Settings Info
    const settingsEmail = document.getElementById('settings-user-email');
    const settingsJoinDate = document.getElementById('settings-join-date');
    if (settingsEmail) settingsEmail.innerText = email;
    if (settingsJoinDate) {
        if (auth && auth.currentUser && auth.currentUser.metadata.creationTime) {
            const creationTime = new Date(auth.currentUser.metadata.creationTime);
            const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            settingsJoinDate.innerText = creationTime.toLocaleDateString('en-US', dateOptions);
        } else {
            settingsJoinDate.innerText = "Just now (Mock Mode)";
        }
    }
    
    // Ensure 'Dashboard' sidebar item is active by default
    const links = document.querySelectorAll('.side-panel-nav a');
    links.forEach(l => l.classList.remove('active'));
    if(links.length > 0) links[0].classList.add('active');
}

function showAuthUI() {
    authContainer.style.display = 'flex';
    const allDashboards = document.querySelectorAll('.app-wrapper');
    allDashboards.forEach(d => { if(d) d.classList.add('hidden'); });
    navbar.classList.add('hidden');
    
    // Ensure side panel is closed
    const sidePanel = document.getElementById('side-panel');
    const sidePanelOverlay = document.getElementById('side-panel-overlay');
    if (sidePanel) sidePanel.classList.remove('open');
    if (sidePanelOverlay) sidePanelOverlay.classList.remove('visible');
    
    authSubmitBtn.disabled = false;
    authSubmitBtn.innerHTML = getBtnHtml(isLoginMode ? "Login" : "Sign Up");
    emailInput.value = '';
}

// --- Recovery Screen Logic ---
function showRecoveryUI(email, requestedDate) {
    authContainer.style.display = 'none';
    const allDashboards = document.querySelectorAll('.app-wrapper');
    allDashboards.forEach(d => { if(d) d.classList.add('hidden'); });
    navbar.classList.add('hidden');
    
    const recoveryDashboard = document.getElementById('recovery-dashboard');
    if (recoveryDashboard) {
        recoveryDashboard.classList.remove('hidden');
        
        // Calculate when it will be deleted
        const deletionDate = new Date(requestedDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        document.getElementById('recovery-date').innerText = deletionDate.toLocaleDateString('en-US', dateOptions);
    }
}

document.getElementById('recovery-logout-btn')?.addEventListener('click', () => {
    if (auth) auth.signOut();
});

document.getElementById('recovery-confirm-btn')?.addEventListener('click', () => {
    if (auth && auth.currentUser) {
        const email = auth.currentUser.email;
        localStorage.removeItem('deleted_' + email);
        showToast("Account recovered successfully! The deletion request has been cancelled.", "success");
        sendEmailNotification(email, "account_recovered");
        document.getElementById('recovery-dashboard').classList.add('hidden');
        showAppUI(email);
    }
});

// --- Security Modal Logic (Deactivate / Delete) ---
const securityModal = document.getElementById('security-modal');
const securityOverlay = document.getElementById('security-modal-overlay');
const securityPassSection = document.getElementById('security-password-section');
const securityGoogleSection = document.getElementById('security-google-section');
const securityPasswordInput = document.getElementById('security-password');
const securityError = document.getElementById('security-error');

let pendingSecurityAction = null;

window.openSecurityModal = function(actionType) {
    if (!auth || !auth.currentUser) return;
    pendingSecurityAction = actionType;
    securityError.classList.add('hidden');
    securityPasswordInput.value = '';
    
    document.getElementById('security-modal-title').innerText = actionType === 'delete' ? 'Delete Account' : 'Deactivate Account';
    
    // Check if user is Google or Password
    const isGoogleUser = auth.currentUser.providerData.some(p => p.providerId === 'google.com');
    
    if (isGoogleUser) {
        securityPassSection.classList.add('hidden');
        securityGoogleSection.classList.remove('hidden');
    } else {
        securityGoogleSection.classList.add('hidden');
        securityPassSection.classList.remove('hidden');
    }
    
    securityModal.classList.remove('hidden');
    securityOverlay.classList.remove('hidden');
}

function closeSecurityModal() {
    securityModal.classList.add('hidden');
    securityOverlay.classList.add('hidden');
    pendingSecurityAction = null;
}

document.getElementById('security-cancel-btn')?.addEventListener('click', closeSecurityModal);
securityOverlay?.addEventListener('click', closeSecurityModal);

// Forgot Password inside modal
document.getElementById('security-forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (auth && auth.currentUser) {
        auth.sendPasswordResetEmail(auth.currentUser.email)
            .then(() => showToast("Password reset link sent to your email!", "info"))
            .catch(err => {
                securityError.innerText = getFriendlyErrorMessage(err);
                securityError.classList.remove('hidden');
            });
    }
});

// Re-authenticate and execute action
async function executeSecurityAction(credential) {
    if (!auth || !auth.currentUser) return;
    const user = auth.currentUser;
    const email = user.email;
    
    try {
        if (credential) {
            await user.reauthenticateWithCredential(credential);
        }
        
        if (pendingSecurityAction === 'deactivate') {
            localStorage.setItem('deactivated_' + email, 'true');
            sendEmailNotification(email, "account_deactivated");
            showAlert("Deactivated", "Account Deactivated successfully.", "info", () => {
                auth.signOut();
            });
        } else if (pendingSecurityAction === 'delete') {
            localStorage.setItem('deleted_' + email, Date.now().toString());
            sendEmailNotification(email, "account_scheduled_for_deletion");
            showAlert("Scheduled for Deletion", "Account scheduled for deletion. You will be logged out now. You have 7 days to log back in and recover your account.", "error", () => {
                auth.signOut();
            });
        }
        
        closeSecurityModal();
    } catch (error) {
        console.error("Reauth error:", error);
        securityError.innerText = getFriendlyErrorMessage(error);
        securityError.classList.remove('hidden');
    }
}

document.getElementById('security-confirm-btn')?.addEventListener('click', () => {
    if (!auth || !auth.currentUser) return;
    const pwd = securityPasswordInput.value;
    if (!pwd) {
        securityError.innerText = "❌ Please enter your password.";
        securityError.classList.remove('hidden');
        return;
    }
    const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, pwd);
    executeSecurityAction(credential);
});

document.getElementById('security-google-btn')?.addEventListener('click', async () => {
    if (!auth || !auth.currentUser) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
        executeSecurityAction(credential);
    } catch (error) {
        console.error("Google Reauth error:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
            securityError.innerText = getFriendlyErrorMessage(error);
            securityError.classList.remove('hidden');
        }
    }
});

// =========================================================================
// Notification System (Firestore)
// =========================================================================
window.createNotification = async function(userEmail, title, message, type = 'general', relatedId = null) {
    if (!db) return; // Mock mode
    try {
        await db.collection('notifications').add({
            userEmail: userEmail,
            title: title,
            message: message,
            type: type, // 'transfer', 'success', 'security', 'general'
            relatedId: relatedId,
            isRead: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Error creating notification:", e);
    }
};

let notificationUnsubscribe = null;

function initNotificationListener(userEmail) {
    if (!db) return;
    
    const bellContainer = document.getElementById('notification-bell-container');
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');
    const dropdown = document.getElementById('notification-dropdown');
    
    if (notificationUnsubscribe) {
        notificationUnsubscribe();
    }
    
    notificationUnsubscribe = db.collection('notifications')
        .where('userEmail', '==', userEmail)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            let unreadCount = 0;
            list.innerHTML = '';
            
            if (snapshot.empty) {
                list.innerHTML = '<div class="notification-empty">No notifications yet.</div>';
                badge.classList.add('hidden');
                return;
            }
            
            snapshot.forEach(doc => {
                const notif = doc.data();
                if (!notif.isRead) unreadCount++;
                
                const timeStr = notif.timestamp ? new Date(notif.timestamp.toDate()).toLocaleString() : 'Just now';
                
                const item = document.createElement('div');
                item.className = `notification-item ${notif.isRead ? '' : 'unread'}`;
                item.innerHTML = `
                    <div class="notification-icon ${notif.type}">
                        ${getNotificationIcon(notif.type)}
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title}</div>
                        <div class="notification-message">${notif.message}</div>
                        <div class="notification-time">${timeStr}</div>
                    </div>
                `;
                
                item.addEventListener('click', async (e) => {
                    if (!notif.isRead) {
                        try {
                            await db.collection('notifications').doc(doc.id).update({ isRead: true });
                        } catch(err) {
                            console.error("Error marking read:", err);
                        }
                    }
                    
                    // Route transfer clicks
                    if (notif.type === 'transfer' && notif.relatedId) {
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.set('transfer_id', notif.relatedId);
                        window.history.pushState({}, document.title, newUrl.toString());
                        if (typeof window.checkForPendingTransfers === 'function') {
                            window.checkForPendingTransfers();
                        }
                    }
                    
                    dropdown.classList.add('hidden');
                });
                
                list.appendChild(item);
            });
            
            if (unreadCount > 0) {
                badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }, (error) => {
            console.error("Notification Snapshot Error:", error);
            
            // Extract URL from error message if exists
            let errorMsg = error.message;
            const urlMatch = errorMsg.match(/(https:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[1];
                errorMsg = errorMsg.replace(url, `<br><br><a href="${url}" target="_blank" style="color: blue; text-decoration: underline; background: #e0f2fe; padding: 10px; border-radius: 5px; display: inline-block; word-break: break-all;">Click here to Fix Database Index</a><br><br>`);
            }
            
            list.innerHTML = `<div class="notification-empty" style="color:red; padding:20px;">Error loading notifications: ${errorMsg}<br><br>Please check console or click the link above if available.</div>`;
            badge.classList.add('hidden');
        });
        
    const dropdownGlassEl = document.getElementById('dropdown-glass');
    let dropdownGlassInitialized = false;

    // Toggle dropdown
    bellContainer.onclick = (e) => {
        // Toggle visibility
        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            dropdown.classList.remove('closing');
        } else if (!dropdown.classList.contains('closing')) {
            // Animate close
            dropdown.classList.add('closing');
            setTimeout(() => {
                dropdown.classList.add('hidden');
                dropdown.classList.remove('closing');
            }, 400); // Wait for animation to finish
        }
    };
}

function getNotificationIcon(type) {
    switch(type) {
        case 'transfer': return '🔄';
        case 'success': return '✅';
        case 'security': return '🛡️';
        case 'rejected': return '❌';
        case 'timeout': return '⏱️';
        default: return '🔔';
    }
}

// Hook into outside clicks to close dropdown
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notification-dropdown');
    const bell = document.getElementById('notification-bell-container');
    if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.classList.contains('closing') && !bell.contains(e.target)) {
        dropdown.classList.add('closing');
        setTimeout(() => {
            dropdown.classList.add('hidden');
            dropdown.classList.remove('closing');
        }, 400);
    }
});
