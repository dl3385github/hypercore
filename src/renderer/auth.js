// Authentication Script
const AUTH_STORAGE_KEY = 'hapa_auth_data';
const PDS_URL = 'https://pds.hapa.ai'; // Your AT Protocol PDS server

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const signinTab = document.getElementById('signin-tab');
const signupTab = document.getElementById('signup-tab');
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const signinUsername = document.getElementById('signin-username');
const signinPassword = document.getElementById('signin-password');
const signinBtn = document.getElementById('signin-btn');
const signupUsername = document.getElementById('signup-username');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupConfirmPassword = document.getElementById('signup-confirm-password');
const signupBtn = document.getElementById('signup-btn');
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const userAvatar = document.getElementById('user-avatar');
const userDisplayName = document.getElementById('user-display-name');
const userId = document.getElementById('user-id');

// User authentication state
let currentUser = null;

// Check if user is already logged in
function checkAuth() {
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
  if (storedAuth) {
    try {
      currentUser = JSON.parse(storedAuth);
      console.log('User is already authenticated:', currentUser.username);
      updateUserInterface();
      showMainApp();
    } catch (error) {
      console.error('Error parsing stored auth data:', error);
      // Clear invalid auth data
      localStorage.removeItem(AUTH_STORAGE_KEY);
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
}

// Show authentication screen
function showAuthScreen() {
  authScreen.classList.remove('hidden');
  loginScreen.classList.add('hidden');
  mainApp.classList.add('hidden');
}

// Show the main app UI
function showMainApp() {
  authScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');
  
  // Initialize the video call login screen
  const videoCallLoginScreen = document.getElementById('login-screen');
  if (videoCallLoginScreen) {
    videoCallLoginScreen.classList.add('hidden');
  }
  
  // Update the user interface with current user data
  updateUserInterface();
  
  // Check if this is first time login to show gatekeeper
  if (currentUser.isFirstLogin) {
    // Show gatekeeper tab
    showPage('gatekeeper');
    
    // Add default gatekeeper message
    addGatekeeperMessage("Hi, I'm your gatekeeper, your local AI assistant. You can connect your social accounts to let me understand you better. I will not share your personal information with anyone, and it's open-source.", 'bot');
    
    // Update first login status
    currentUser.isFirstLogin = false;
    saveUserData();
  } else {
    // Show chats tab by default
    showPage('chats');
  }
  
  // Initialize the main app
  if (window.initApp) {
    window.initApp();
  }
}

// Update user interface with current user data
function updateUserInterface() {
  if (currentUser) {
    userDisplayName.textContent = currentUser.displayName || currentUser.username;
    userId.textContent = `@${currentUser.username}`;
    
    // Profile picture
    if (currentUser.avatar) {
      userAvatar.src = currentUser.avatar;
    }
    
    // Also update profile settings page
    const profileDisplayName = document.getElementById('profile-display-name');
    const profileUserId = document.getElementById('profile-user-id');
    const profileDid = document.getElementById('profile-did');
    const profilePicturePreview = document.getElementById('profile-picture-preview');
    
    if (profileDisplayName) profileDisplayName.value = currentUser.displayName || currentUser.username;
    if (profileUserId) profileUserId.textContent = `@${currentUser.username}`;
    if (profileDid) profileDid.textContent = currentUser.did || 'Not available';
    if (profilePicturePreview && currentUser.avatar) profilePicturePreview.src = currentUser.avatar;
  }
}

// Save user data to local storage
function saveUserData() {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
}

// Switch between signin and signup tabs
function switchTab(tab) {
  if (tab === 'signin') {
    signinTab.classList.add('active');
    signupTab.classList.remove('active');
    signinForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    signinTab.classList.remove('active');
    signupTab.classList.add('active');
    signinForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
  }
}

// Handle sign in
async function handleSignIn() {
  const username = signinUsername.value.trim();
  const password = signinPassword.value;
  
  if (!username || !password) {
    alert('Please enter both username and password');
    return;
  }
  
  try {
    // In a real implementation, this would call the AT Protocol API
    console.log(`Signing in with: ${username}`);
    signinBtn.disabled = true;
    signinBtn.textContent = 'Signing in...';
    
    try {
      // Call AT Protocol authentication endpoint
      const response = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier: username,
          password: password
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Authentication failed');
      }
      
      const authData = await response.json();
      
      // Store user data
      currentUser = {
        did: authData.did,
        username: authData.handle,
        displayName: authData.handle,  // We'll update this with profile data later
        accessJwt: authData.accessJwt,
        refreshJwt: authData.refreshJwt,
        // Generate a Hypercore keypair for this user
        hypercoreId: await generateHypercoreId(authData.did),
        isFirstLogin: false  // Assume existing user
      };
      
      // Try to get profile information
      await fetchUserProfile();
      
      // Save auth data
      saveUserData();
      
      // Show main app
      updateUserInterface();
      showMainApp();
      
    } catch (error) {
      console.error('Authentication error:', error);
      alert(`Authentication failed: ${error.message}`);
    }
  } finally {
    signinBtn.disabled = false;
    signinBtn.textContent = 'Sign In';
  }
}

// Handle sign up
async function handleSignUp() {
  const username = signupUsername.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;
  
  // Validate inputs
  if (!username || !email || !password) {
    alert('Please fill in all fields');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }
  
  try {
    console.log(`Signing up with: ${username}, ${email}`);
    signupBtn.disabled = true;
    signupBtn.textContent = 'Creating account...';
    
    try {
      // Create account with AT Protocol
      const response = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createAccount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          handle: username,
          email: email,
          password: password,
          inviteCode: null  // No invite code needed as you mentioned
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Account creation failed');
      }
      
      const accountData = await response.json();
      
      // Store user data
      currentUser = {
        did: accountData.did,
        username: accountData.handle,
        displayName: accountData.handle,
        accessJwt: accountData.accessJwt,
        refreshJwt: accountData.refreshJwt,
        // Generate a Hypercore keypair for this user
        hypercoreId: await generateHypercoreId(accountData.did),
        isFirstLogin: true  // New user
      };
      
      // Save auth data
      saveUserData();
      
      // Show main app
      updateUserInterface();
      showMainApp();
      
    } catch (error) {
      console.error('Account creation error:', error);
      alert(`Account creation failed: ${error.message}`);
    }
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
}

// Fetch user profile from AT Protocol
async function fetchUserProfile() {
  if (!currentUser || !currentUser.did || !currentUser.accessJwt) {
    console.error('Cannot fetch profile: User not authenticated');
    return;
  }
  
  try {
    const response = await fetch(`${PDS_URL}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(currentUser.did)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentUser.accessJwt}`
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch profile, using default values');
      return;
    }
    
    const profileData = await response.json();
    
    // Update user data with profile information
    currentUser.displayName = profileData.displayName || currentUser.username;
    if (profileData.avatar) {
      currentUser.avatar = profileData.avatar;
    }
    
    // Save updated user data
    saveUserData();
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
}

// Generate a stable Hypercore ID based on the user's DID
async function generateHypercoreId(did) {
  // In a real implementation, we would use a crypto library to derive a stable keypair
  // For now, we'll just create a mock ID
  return `hc_${did.replace('did:plc:', '')}_${Date.now().toString(36)}`;
}

// Sign out
function signOut() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  currentUser = null;
  showAuthScreen();
}

// Show a specific page
function showPage(pageId) {
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.add('hidden');
  });
  
  // Show selected page
  const page = document.getElementById(`${pageId}-page`);
  if (page) {
    page.classList.remove('hidden');
  }
}

// Add a message to the gatekeeper chat
function addGatekeeperMessage(text, sender) {
  const messages = document.getElementById('gatekeeper-messages');
  const messageEl = document.createElement('div');
  messageEl.className = `gatekeeper-message ${sender}`;
  
  const contentEl = document.createElement('div');
  contentEl.className = 'gatekeeper-message-content';
  contentEl.textContent = text;
  
  messageEl.appendChild(contentEl);
  messages.appendChild(messageEl);
  
  // Scroll to bottom
  messages.scrollTop = messages.scrollHeight;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already authenticated
  checkAuth();
  
  // Tab switching
  signinTab.addEventListener('click', () => switchTab('signin'));
  signupTab.addEventListener('click', () => switchTab('signup'));
  
  // Form submissions
  signinBtn.addEventListener('click', handleSignIn);
  signupBtn.addEventListener('click', handleSignUp);
  
  // Enter key in password fields
  signinPassword.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleSignIn();
  });
  
  signupConfirmPassword.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleSignUp();
  });
  
  // Sign out button
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', signOut);
  }
  
  // Navigation menu
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      showPage(pageId);
    });
  });
  
  // Gatekeeper send message
  const gatekeeperSendBtn = document.getElementById('gatekeeper-send-btn');
  const gatekeeperInput = document.getElementById('gatekeeper-message-input');
  
  if (gatekeeperSendBtn && gatekeeperInput) {
    gatekeeperSendBtn.addEventListener('click', () => {
      const message = gatekeeperInput.value.trim();
      if (message) {
        addGatekeeperMessage(message, 'user');
        gatekeeperInput.value = '';
        
        // Simulate gatekeeper response
        setTimeout(() => {
          addGatekeeperMessage("I'm still learning and developing my capabilities. Is there anything specific you'd like to know about the app?", 'bot');
        }, 1000);
      }
    });
    
    gatekeeperInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        gatekeeperSendBtn.click();
      }
    });
  }
}); 