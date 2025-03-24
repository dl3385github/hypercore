// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinButton = document.getElementById('join-btn');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-btn');
const connectionCount = document.getElementById('connection-count');
const currentRoomSpan = document.getElementById('current-room');
const localVideo = document.getElementById('local-video');
const remoteVideosContainer = document.getElementById('remote-videos');
const toggleVideoButton = document.getElementById('toggle-video');
const toggleAudioButton = document.getElementById('toggle-audio');
const remoteVideoTemplate = document.getElementById('remote-video-template');
const saveTranscriptButton = document.getElementById('save-transcript-btn');
const recordVideoButton = document.getElementById('record-video-btn');
const transcriptPopup = document.getElementById('transcript-popup');
const transcriptPopupContent = document.querySelector('.transcript-popup-content');
const toggleTranscriptPopupBtn = document.getElementById('toggle-transcript-popup-btn');
const closeTranscriptPopupBtn = document.getElementById('close-transcript-popup');
const summarizeBtn = document.getElementById('summarize-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPopup = document.getElementById('settings-popup');
const closeSettingsPopupBtn = document.getElementById('close-settings-popup');
const audioThresholdSlider = document.getElementById('audio-threshold');
const thresholdValueDisplay = document.getElementById('threshold-value');
const transcriptionThresholdSlider = document.getElementById('transcription-threshold');
const transcriptionThresholdValueDisplay = document.getElementById('transcription-threshold-value');
const microphoneSelect = document.getElementById('microphone-select');
const speakerSelect = document.getElementById('speaker-select');
const webcamSelect = document.getElementById('webcam-select');
const refreshDevicesBtn = document.getElementById('refresh-devices-btn');

// DOM Elements - Auth
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const authTabBtns = document.querySelectorAll('.auth-tab-btn');
const authTabContents = document.querySelectorAll('.auth-tab-content');

// Signin elements
const signinIdInput = document.getElementById('signin-id');
const signinPasswordInput = document.getElementById('signin-password');
const signinBtn = document.getElementById('signin-btn');
const signinError = document.getElementById('signin-error');

// Signup elements
const signupHandleInput = document.getElementById('signup-handle');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupPasswordConfirmInput = document.getElementById('signup-password-confirm');
const signupBtn = document.getElementById('signup-btn');
const signupError = document.getElementById('signup-error');

// Navigation elements
const navBtns = document.querySelectorAll('.nav-btn');
const appPages = document.querySelectorAll('.app-page');

// Settings page elements
const userDidDisplay = document.getElementById('user-did-display');
const userHandleDisplay = document.getElementById('user-handle-display');
const logoutBtn = document.getElementById('logout-btn');

// State variables
let peers = new Set();
let currentRoom = null;
let localStream = null;
let isVideoEnabled = false;
let isAudioEnabled = false;
let ownPeerId = null; // Define ownPeerId as null initially
let peerConnections = new Map(); // Map of peer ID to connection object
let peerUsernames = new Map(); // Map of peer ID to username
let transcriptionIntervals = new Map(); // Map of peer ID to transcription interval
let localTranscriptContainer = document.querySelector('#local-transcript .transcript-content');
// Store transcripts by participant for later saving
let transcripts = new Map(); // Key: username, Value: Array of transcript entries
let dataChannels = new Map(); // Map of peer ID to data channel
let localTranscriptionInterval = null;
let pendingIceCandidates = new Map(); // Map of peer ID to array of pending ICE candidates

// Media recording
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let transcriptionInterval = null;

// Video call recording
let isVideoRecording = false;
let videoRecorder = null;
let videoRecordedChunks = [];
let recordingStartTime = null;
let recordedChatMessages = [];
let recordedTranscripts = [];

// Store remote audio recorders for transcription
let remoteRecorders = new Map();

// Variable to track if we're already closing the app
let isClosingApp = false;

// Track if summary generation is in progress
let isSummaryGenerating = false;

// Store volume levels for remote peers
const peerVolumes = new Map();

// Device selection state
let selectedMicrophoneId = '';
let selectedSpeakerId = '';
let selectedWebcamId = '';
let availableDevices = {
  audioinput: [],
  audiooutput: [],
  videoinput: []
};

// App settings
const appSettings = {
  audioThreshold: 0.05, // Default microphone threshold
  transcriptionThreshold: 0.05, // Default transcription threshold
};

// Save settings to localStorage
function saveSettings() {
  try {
    // Store device selections
    const settingsToSave = {
      ...appSettings,
      selectedMicrophone: selectedMicrophoneId,
      selectedWebcam: selectedWebcamId,
      selectedSpeaker: selectedSpeakerId
    };
    
    localStorage.setItem('appSettings', JSON.stringify(settingsToSave));
    console.log('Settings saved to localStorage');
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
}

// Load settings from localStorage
function loadSettings() {
  try {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      
      // Update app settings
      if (parsedSettings.audioThreshold) {
        appSettings.audioThreshold = parsedSettings.audioThreshold;
      }
      
      if (parsedSettings.transcriptionThreshold) {
        appSettings.transcriptionThreshold = parsedSettings.transcriptionThreshold;
      }
      
      // Restore device selections
      if (parsedSettings.selectedMicrophone) {
        selectedMicrophoneId = parsedSettings.selectedMicrophone;
      }
      
      if (parsedSettings.selectedWebcam) {
        selectedWebcamId = parsedSettings.selectedWebcam;
      }
      
      if (parsedSettings.selectedSpeaker) {
        selectedSpeakerId = parsedSettings.selectedSpeaker;
      }
      
      console.log('Settings loaded from localStorage');
    }
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
  }
}

// Function to update transcription threshold on the main process
function updateTranscriptionThreshold(value) {
  window.electronAPI.updateTranscriptionThreshold(value)
    .then(() => {
      console.log(`Transcription threshold updated to ${value}`);
    })
    .catch(error => {
      console.error('Error updating transcription threshold:', error);
    });
}

// Current user state
let currentUser = null;

// OpenAI API settings
const openaiApiKeyInput = document.getElementById('openai-api-key');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const apiKeyStatus = document.getElementById('api-key-status');

// DOM elements - add screen sharing elements
const shareScreenButton = document.getElementById('share-screen');
const screenShareDialog = document.getElementById('screen-share-dialog');
const screenShareSources = document.getElementById('screen-share-sources');
const closeScreenDialogButton = document.getElementById('close-screen-dialog');
const fullscreenDialog = document.getElementById('fullscreen-dialog');
const fullscreenVideo = document.getElementById('fullscreen-video');
const closeFullscreenDialogButton = document.getElementById('close-fullscreen-dialog');
const fullscreenTitle = document.getElementById('fullscreen-title');

// Screen sharing variables
let isScreenSharing = false;
let screenShareStream = null;
let activeScreenSharePeerId = null; // ID of the peer currently sharing their screen
let screenVideoElement = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  loadSettings();
  
  // Focus on username input
  usernameInput.focus();
  
  // Set default room ID if empty
  if (!roomInput.value) {
    roomInput.value = generateDefaultRoomId();
  }
  
  // Set up join button event
  joinButton.addEventListener('click', joinChat);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (roomInput.value.trim()) {
        joinChat();
      } else {
        roomInput.focus();
      }
    }
  });
  
  roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && usernameInput.value.trim()) {
      joinChat();
    }
  });
  
  // Set up message sending
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Set up video controls
  toggleVideoButton.addEventListener('click', toggleVideo);
  toggleAudioButton.addEventListener('click', toggleAudio);
  
  // Set up save transcript button
  saveTranscriptButton.addEventListener('click', saveAllTranscripts);
  
  // Set up record video button
  recordVideoButton.addEventListener('click', toggleVideoRecording);
  
  // Set up transcript popup toggle button
  toggleTranscriptPopupBtn.addEventListener('click', toggleTranscriptPopup);
  
  // Add event listeners for transcript popup
  closeTranscriptPopupBtn.addEventListener('click', () => {
    transcriptPopup.classList.add('hidden');
  });
  
  // Add event listener for summarize button
  summarizeBtn.addEventListener('click', generateCallSummary);
  
  // Add event listeners for settings popup
  settingsBtn.addEventListener('click', toggleSettingsPopup);
  closeSettingsPopupBtn.addEventListener('click', toggleSettingsPopup);
  
  // Initialize audio threshold slider
  audioThresholdSlider.value = appSettings.audioThreshold;
  thresholdValueDisplay.textContent = appSettings.audioThreshold;
  
  // Initialize transcription threshold slider
  transcriptionThresholdSlider.value = appSettings.transcriptionThreshold;
  transcriptionThresholdValueDisplay.textContent = appSettings.transcriptionThreshold;
  
  audioThresholdSlider.addEventListener('input', (e) => {
    const newValue = parseFloat(e.target.value);
    appSettings.audioThreshold = newValue;
    thresholdValueDisplay.textContent = newValue.toFixed(2);
    updateAudioThreshold(newValue);
    saveSettings();
  });
  
  transcriptionThresholdSlider.addEventListener('input', (e) => {
    const newValue = parseFloat(e.target.value);
    appSettings.transcriptionThreshold = newValue;
    transcriptionThresholdValueDisplay.textContent = newValue.toFixed(2);
    updateTranscriptionThreshold(newValue);
    saveSettings();
  });
  
  // Device selection listeners
  microphoneSelect.addEventListener('change', (e) => {
    selectedMicrophoneId = e.target.value;
    console.log(`Selected microphone: ${selectedMicrophoneId}`);
    applyDeviceSelection();
    saveSettings();
  });
  
  webcamSelect.addEventListener('change', (e) => {
    selectedWebcamId = e.target.value;
    console.log(`Selected webcam: ${selectedWebcamId}`);
    applyDeviceSelection();
    saveSettings();
  });
  
  speakerSelect.addEventListener('change', (e) => {
    selectedSpeakerId = e.target.value;
    console.log(`Selected speaker: ${selectedSpeakerId}`);
    applyDeviceSelection();
    saveSettings();
  });
  
  refreshDevicesBtn.addEventListener('click', () => {
    enumerateDevices();
  });
  
  // Enumerate devices on startup
  enumerateDevices();
  
  // Set up message receiving
  window.electronAPI.onNewMessage((message) => {
    addMessageToUI(message);
  });
  
  // Track peers
  window.electronAPI.onPeerConnected((data) => {
    peers.add(data.id);
    updateConnectionCount();
    addSystemMessage(`New peer connected (${data.id.substring(0, 8)}...)`);
    
    // Create WebRTC connection to this peer
    createPeerConnection(data.id);
  });
  
  window.electronAPI.onPeerDisconnected((data) => {
    peers.delete(data.id);
    updateConnectionCount();
    addSystemMessage(`Peer disconnected (${data.id.substring(0, 8)}...)`);
    
    // Clean up WebRTC connection
    cleanupPeerConnection(data.id);
  });
  
  // Handle WebRTC signaling
  window.electronAPI.onSignalReceived((data) => {
    handleSignalReceived(data.peerId, data.from, data.signal);
  });
  
  // Listen for transcription results from the main process
  window.electronAPI.onTranscriptionResult((result) => {
    console.log('Transcription received from main process for ' + result.speaker + ': "' + result.text + '"');
    
    // Make sure we have a valid, non-empty transcription
    if (result.text && result.text.trim().length > 0) {
      console.log('Adding transcription to UI for ' + result.speaker);
      // Update UI with transcription
      updateTranscription(result.speaker, result.text);
      
      // Store transcript entry for later saving
      if (!transcripts.has(result.speaker)) {
        transcripts.set(result.speaker, []);
      }
      
      transcripts.get(result.speaker).push({
        text: result.text,
        timestamp: result.timestamp || Date.now()
      });
      
      // Share transcript with other peers via data channel
      for (const [peerId, dataChannel] of dataChannels.entries()) {
        if (dataChannel && dataChannel.readyState === 'open') {
          const transcriptMessage = {
            type: 'transcript',
            speaker: result.speaker,
            text: result.text,
            timestamp: new Date().toISOString()
          };
          
          console.log(`Sharing transcription from ${result.speaker} with peer ${peerId}`);
          dataChannel.send(JSON.stringify(transcriptMessage));
        }
      }
    } else {
      console.log('Ignoring empty transcription from ' + result.speaker);
    }
  });
  
  // Handle network errors
  window.electronAPI.onNetworkError((error) => {
    console.error('Network error:', error);
    addSystemMessage(`⚠️ Network Error: ${error.message || 'Unknown error'}`);
  });
  
  // Handle app exit
  window.addEventListener('beforeunload', handleAppExit);

  // Set up authentication tabs
  authTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Remove active class from all tabs
      authTabBtns.forEach(tabBtn => tabBtn.classList.remove('active'));
      authTabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to selected tab
      btn.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // Set up signin form
  signinBtn.addEventListener('click', handleSignIn);
  
  // Set up signup form
  signupBtn.addEventListener('click', handleSignUp);
  
  // Set up navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.getAttribute('data-page');
      
      // Remove active class from all navigation and pages
      navBtns.forEach(navBtn => navBtn.classList.remove('active'));
      appPages.forEach(page => page.classList.remove('active'));
      
      // Add active class to selected navigation and page
      btn.classList.add('active');
      document.getElementById(`${pageId}-page`).classList.add('active');
    });
  });
  
  // Set up logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleSignOut);
  }
  
  // Check if user is already signed in
  checkAuthState();
  
  // Listen for auth state changes
  window.electronAPI.onAuthStateChanged((user) => {
    updateAuthState(user);
  });
  
  // Add device selector event handlers
  microphoneSelect.addEventListener('change', applyDeviceSelection);
  webcamSelect.addEventListener('change', applyDeviceSelection);
  speakerSelect.addEventListener('change', applyDeviceSelection);
  refreshDevicesBtn.addEventListener('click', enumerateDevices);
  
  // Add API key settings
  saveApiKeyBtn.addEventListener('click', saveOpenAIApiKey);
  
  // Initialize the app after authentication
  checkAuthState();

  // Add screen share button click handler
  if (shareScreenButton) {
    shareScreenButton.addEventListener('click', handleScreenShareClick);
  }

  // Close screen dialog button click handler
  if (closeScreenDialogButton) {
    closeScreenDialogButton.addEventListener('click', () => {
      screenShareDialog.classList.add('hidden');
    });
  }

  // Close fullscreen dialog button click handler
  if (closeFullscreenDialogButton) {
    closeFullscreenDialogButton.addEventListener('click', () => {
      fullscreenDialog.classList.add('hidden');
    });
  }
});

// Initialize OpenAI API key settings
async function initializeApiKeySettings() {
  try {
    // Get the current API key (masked)
    const result = await window.electronAPI.getOpenAIApiKey();
    
    if (result.success) {
      openaiApiKeyInput.placeholder = result.isSet ? 'API key is set (hidden for security)' : 'Enter your OpenAI API key';
      if (result.apiKey) {
        openaiApiKeyInput.dataset.isSet = 'true';
      } else {
        openaiApiKeyInput.dataset.isSet = 'false';
      }
    }
  } catch (error) {
    console.error('Error initializing API key settings:', error);
  }
}

// Save OpenAI API key
async function saveOpenAIApiKey() {
  try {
    // Clear previous status
    apiKeyStatus.textContent = '';
    apiKeyStatus.className = 'setting-status';
    
    const apiKey = openaiApiKeyInput.value.trim();
    
    if (!apiKey && openaiApiKeyInput.dataset.isSet !== 'true') {
      apiKeyStatus.textContent = 'Please enter an API key';
      apiKeyStatus.classList.add('error');
      return;
    }
    
    // Don't send empty value if a key is already set and the field is empty (user wants to keep existing key)
    if (!apiKey && openaiApiKeyInput.dataset.isSet === 'true') {
      apiKeyStatus.textContent = 'No changes made';
      return;
    }
    
    // Save the API key
    const result = await window.electronAPI.updateOpenAIApiKey(apiKey);
    
    if (result.success) {
      apiKeyStatus.textContent = 'API key saved successfully';
      apiKeyStatus.classList.add('success');
      
      // Update placeholder to show key is set
      openaiApiKeyInput.value = '';
      openaiApiKeyInput.placeholder = 'API key is set (hidden for security)';
      openaiApiKeyInput.dataset.isSet = 'true';
      
      // Clear the status after a few seconds
      setTimeout(() => {
        apiKeyStatus.textContent = '';
      }, 3000);
    } else {
      apiKeyStatus.textContent = result.error || 'Failed to save API key';
      apiKeyStatus.classList.add('error');
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    apiKeyStatus.textContent = error.message || 'An error occurred while saving API key';
    apiKeyStatus.classList.add('error');
  }
}

// Generate a random room ID if none provided
function generateDefaultRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

// Join the chat with a username and room
async function joinChat() {
  const username = usernameInput.value.trim();
  const roomId = roomInput.value.trim() || generateDefaultRoomId();
  
  if (!username) {
    alert('Please enter a username');
    return;
  }
  
  try {
    // Try to get user media (camera and microphone)
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: true
      });
      
      // If we got here, both video and audio are available
      isVideoEnabled = true;
      isAudioEnabled = true;
      
    } catch (mediaError) {
      // Try fallback options if full access wasn't granted
      console.warn('Could not access both camera and microphone, trying fallback options', mediaError);
      
      try {
        // Try just audio
        localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        isVideoEnabled = false;
        isAudioEnabled = true;
        addSystemMessage('Camera access not available. Audio only mode enabled.');
      } catch (audioError) {
        // No media devices available
        console.warn('Could not access any media devices', audioError);
        localStream = null;
        isVideoEnabled = false;
        isAudioEnabled = false;
        addSystemMessage('⚠️ No camera or microphone access. Voice and video unavailable.');
      }
    }
    
    // If we have a stream, set it up for the local video display
    if (localStream) {
      // Setup local video display
      localVideo.srcObject = localStream;
      
      // Check what tracks we got
      const hasMicrophone = localStream.getAudioTracks().length > 0;
      const hasCamera = localStream.getVideoTracks().length > 0;
      
      // Store the IDs of the devices we're actually using
      if (hasMicrophone) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack.getSettings && audioTrack.getSettings().deviceId) {
          selectedMicrophoneId = audioTrack.getSettings().deviceId;
          console.log(`Using microphone: ${selectedMicrophoneId}`);
        }
      }
      
      if (hasCamera) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack.getSettings && videoTrack.getSettings().deviceId) {
          selectedWebcamId = videoTrack.getSettings().deviceId;
          console.log(`Using camera: ${selectedWebcamId}`);
        }
      }
      
      // If we have audio, setup the audio recording for transcription
      if (hasMicrophone) {
        setupMediaRecording();
      }
    }

    // Set app username
    await window.electronAPI.setUsername(username);
    
    // Join the specified room or use the default
    const joinRoomResult = await window.electronAPI.joinRoom(roomId);
    
    if (!joinRoomResult.success) {
      throw new Error(joinRoomResult.error || 'Failed to join room');
    }
    
    // Get and display our own peer ID
    ownPeerId = await window.electronAPI.getOwnId(); // Store in our variable
    console.log(`Our peer ID: ${ownPeerId}`);
    
    // Track the room we're in
    currentRoomSpan.textContent = roomId;
    currentRoom = roomId;
    
    // Switch to chat screen
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    
    // Add welcome message
    addSystemMessage(`Welcome ${username}! You've joined room: ${roomId}`);
    
    // Focus on message input
    messageInput.focus();
    
    // Don't show transcript popup by default
    // transcriptPopup.classList.remove('hidden');
  } catch (error) {
    alert(`Error joining chat: ${error.message || 'Unknown error'}`);
  }
}

// Send a message
async function sendMessage() {
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  try {
    // Send to main process
    await window.electronAPI.sendMessage(message);
    
    // Clear input
    messageInput.value = '';
  } catch (error) {
    addSystemMessage(`Failed to send message: ${error.message || 'Unknown error'}`);
  }
}

// Add a message to the UI
function addMessageToUI(messageData) {
  const { username, message, timestamp } = messageData;
  const isMyMessage = (usernameInput.value.trim() === username);
  
  // Create message element
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.classList.add(isMyMessage ? 'message-outgoing' : 'message-incoming');
  
  // Format date
  const date = new Date(timestamp);
  const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  
  // Set message content
  messageElement.innerHTML = `
    <div class="message-meta">${username} • ${formattedTime}</div>
    <div class="message-text">${message}</div>
  `;
  
  // Add to messages container
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add a system message
function addSystemMessage(text) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('system-message');
  messageElement.textContent = text;
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update the connection count display
function updateConnectionCount() {
  connectionCount.textContent = peers.size;
}

// Toggle video on/off
function toggleVideo() {
  if (!localStream) return;
  
  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length === 0) {
    addSystemMessage('No video device available');
    return;
  }
  
  isVideoEnabled = !isVideoEnabled;
  
  // Update all video tracks
  videoTracks.forEach(track => {
    track.enabled = isVideoEnabled;
  });
  
  // Update UI
  if (isVideoEnabled) {
    toggleVideoButton.querySelector('.icon').textContent = '📹';
    toggleVideoButton.classList.remove('video-off');
  } else {
    toggleVideoButton.querySelector('.icon').textContent = '🚫';
    toggleVideoButton.classList.add('video-off');
  }
  
  // Notify peers of video state change
  notifyMediaStateChange();
}

// Toggle audio on/off
function toggleAudio() {
  if (!localStream) return;
  
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length === 0) {
    addSystemMessage('No audio device available');
    return;
  }
  
  isAudioEnabled = !isAudioEnabled;
  
  // Update all audio tracks
  audioTracks.forEach(track => {
    track.enabled = isAudioEnabled;
  });
  
  // Update UI
  if (isAudioEnabled) {
    toggleAudioButton.querySelector('.icon').textContent = '🎤';
    toggleAudioButton.classList.remove('muted');
    
    // Restart recording if it was previously stopped
    if (!isRecording && localStream) {
      setupMediaRecording();
    }
  } else {
    toggleAudioButton.querySelector('.icon').textContent = '🔇';
    toggleAudioButton.classList.add('muted');
    
    // Stop recording if audio is off
    stopMediaRecording();
  }
  
  // Notify peers of audio state change
  notifyMediaStateChange();
}

// Notify peers of media state changes
function notifyMediaStateChange() {
  // Send to all connected peers via data channels
  for (const [peerId, dataChannel] of dataChannels.entries()) {
    if (dataChannel.readyState === 'open') {
      sendMediaStateViaDataChannel(dataChannel);
    }
  }
}

// Send control messages to all peers
function sendControlMessage(message) {
  // This would send media state changes through the data channel
  // For this implementation, we're not implementing separate data channels
  // as the focus is on basic video functionality first
}

// Create a WebRTC peer connection
async function createPeerConnection(peerId) {
  try {
    console.log(`Creating WebRTC connection to peer: ${peerId}`);
    
    // Create connection if it doesn't exist
    if (peerConnections.has(peerId)) {
      console.warn(`Connection to peer ${peerId} already exists, removing old one first`);
      // Close existing connection
      const existingConn = peerConnections.get(peerId);
      if (existingConn) {
        existingConn.close();
      }
      peerConnections.delete(peerId);
    }
    
    // Create new RTCPeerConnection with STUN servers
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.ekiga.net:3478' },
        { urls: 'stun:stun.ideasip.com:3478' },
        { urls: 'stun:stun.voiparound.com:3478' }
      ],
      iceCandidatePoolSize: 10
    });
    
    // Store the connection immediately so we can access it elsewhere
    peerConnections.set(peerId, peerConnection);
    
    // Create a data channel for control messages
    try {
      const dataChannel = peerConnection.createDataChannel(`chat-${peerId}`, {
        ordered: true
      });
      
      setupDataChannel(peerId, dataChannel);
    } catch (error) {
      console.error(`Error creating data channel for peer ${peerId}:`, error);
    }
    
    // Handle data channel from remote peer
    peerConnection.ondatachannel = (event) => {
      console.log(`Received data channel from peer ${peerId}`);
      setupDataChannel(peerId, event.channel);
    };
    
    // Add our local stream tracks to the connection
    if (localStream) {
      try {
        const tracks = localStream.getTracks();
        for (const track of tracks) {
          console.log(`Adding ${track.kind} track to peer connection with peer ${peerId}`);
          const sender = peerConnection.addTrack(track, localStream);
          console.log(`Successfully added ${track.kind} track to peer ${peerId}`);
        }
      } catch (trackError) {
        console.error(`Error adding tracks to peer connection with ${peerId}:`, trackError);
      }
    } else {
      console.warn(`No local stream available when creating connection to peer ${peerId}`);
    }
    
    // Connection state change events
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId} changed to: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed' || 
          peerConnection.connectionState === 'closed') {
        console.warn(`Connection to peer ${peerId} ${peerConnection.connectionState}`);
      }
    };
    
    // ICE connection state change
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId} changed to: ${peerConnection.iceConnectionState}`);
      
      // Handle disconnection
      if (peerConnection.iceConnectionState === 'disconnected' || 
          peerConnection.iceConnectionState === 'failed' ||
          peerConnection.iceConnectionState === 'closed') {
        console.warn(`ICE connection to peer ${peerId} ${peerConnection.iceConnectionState}, may need to reconnect`);
      }
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Generated ICE candidate for ${peerId}`, event.candidate);
        
        // Ensure the candidate has the required fields
        if (!event.candidate.candidate) {
          console.warn(`Skipping invalid ICE candidate for ${peerId}: missing candidate string`);
          return;
        }
        
        // Properly format the ICE candidate for transport
        const signal = {
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment
          }
        };
        
        console.log(`Formatted ICE candidate for ${peerId}:`, signal.candidate);
        
        // Send the ICE candidate to the peer
        window.electronAPI.sendSignal(peerId, signal).then(result => {
          if (!result.success) {
            console.error(`Failed to send ICE candidate to ${peerId}:`, result.error);
          } else {
            console.log(`Successfully sent ICE candidate to ${peerId}`);
          }
        }).catch(err => {
          console.error(`Error sending ICE candidate to ${peerId}:`, err);
        });
      } else {
        console.log(`ICE candidate gathering completed for peer ${peerId}`);
      }
    };
    
    // Handle negotiation needed
    peerConnection.onnegotiationneeded = async () => {
      console.log(`Negotiation needed for peer connection with ${peerId}`);
      const shouldInitiate = await shouldInitiateConnection(peerId);
      if (shouldInitiate) {
        console.log(`This peer will initiate renegotiation with ${peerId}`);
        await createOffer(peerId, peerConnection);
      } else {
        console.log(`Waiting for peer ${peerId} to initiate renegotiation`);
      }
    };
    
    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log(`Received track from ${peerId}:`, event.track.kind);
      const [remoteStream] = event.streams;
      
      if (!remoteStream) {
        console.warn(`No stream in track event from ${peerId}`);
        return;
      }
      
      console.log(`Received remote stream from ${peerId}`);
      
      // Add the remote stream to the UI
      addRemoteStream(peerId, remoteStream);
    };
    
    return peerConnection;
  } catch (error) {
    console.error(`Error creating peer connection to ${peerId}:`, error);
    throw error;
  }
}

// Determine if we should initiate the connection based on peer IDs
async function shouldInitiateConnection(peerId) {
  // Get our public key from the current connections
  // This is a simple way to decide who initiates
  try {
    const ownId = await window.electronAPI.getOwnId();
    if (!ownId) return true; // If we can't get our ID, default to initiating
    
    // Compare peer IDs to decide who initiates the connection
    // This ensures only one side creates the offer
    return ownId > peerId;
  } catch (error) {
    console.error('Error getting own ID:', error);
    return true; // Default to initiating if there's an error
  }
}

// Send our media state via data channel
function sendMediaStateViaDataChannel(dataChannel) {
  // Store username in data channel for reference
  dataChannel._username = usernameInput.value.trim();
  
  const mediaState = {
    type: 'media-state',
    username: usernameInput.value.trim(),
    videoEnabled: isVideoEnabled,
    audioEnabled: isAudioEnabled
  };
  
  dataChannel.send(JSON.stringify(mediaState));
}

// Handle messages received via data channel
function handleDataChannelMessage(peerId, message) {
  console.log(`Received data channel message from ${peerId}:`, message);
  
  if (message.type === 'media-state') {
    // Update remote media state UI
    updateRemoteMediaState(peerId, message.username, message.videoEnabled, message.audioEnabled);
  } else if (message.type === 'transcript') {
    // Handle transcript message from peer
    // Get the speaker from the message or use the peer's username
    const speaker = message.speaker || getPeerUsername(peerId) || `Peer ${peerId.substring(0, 6)}`;
    console.log(`Received transcript message from ${speaker}: "${message.text}"`);
    
    // Make sure we store this username for the peer if we don't have it already
    if (!peerUsernames.has(peerId) && speaker !== `Peer ${peerId.substring(0, 6)}`) {
      peerUsernames.set(peerId, speaker);
    }
    
    // Skip empty or very short transcriptions
    if (!message.text || message.text.trim().length < 3) {
      console.log(`Ignoring short transcript from ${speaker}: "${message.text}"`);
      return;
    }
    
    // Update UI with the transcript
    updateTranscription(speaker, message.text);
    
    // No need to add to transcript map again since updateTranscription already does this
  } else if (message.type === 'screen-share-started') {
    console.log(`Peer ${peerId} started screen sharing: ${message.sourceName}`);
    addSystemMessage(`${message.username} started sharing their screen: ${message.sourceName}`);
    
    // Update active screen sharer
    activeScreenSharePeerId = peerId;
    
    // No longer stopping our own share - we support multiple simultaneous shares
  } else if (message.type === 'screen-share-stopped') {
    console.log(`Peer ${peerId} stopped screen sharing`);
    addSystemMessage(`${message.username} stopped sharing their screen`);
    
    // Remove the screen share from grid
    const screenContainer = document.getElementById(`screen-share-${peerId}`);
    if (screenContainer) {
      screenContainer.remove();
    }
    
    // Clear active screen sharer only if it was this peer
    if (activeScreenSharePeerId === peerId) {
      activeScreenSharePeerId = null;
    }
  }
}

// Update remote media state indicators
function updateRemoteMediaState(peerId, username, videoEnabled, audioEnabled) {
  const remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
  if (!remoteContainer) return;
  
  // Store username for this peer
  if (username && username.trim() !== '') {
    peerUsernames.set(peerId, username);
    
    // Update the display name on the video
    const nameElement = remoteContainer.querySelector('.participant-name');
    if (nameElement) {
      const currentName = nameElement.textContent;
      
      // Only update if current name is a placeholder or different
      if (currentName.includes('Peer') || currentName !== username) {
        nameElement.textContent = username;
        console.log(`Updated display name for peer ${peerId} from "${currentName}" to "${username}"`);
      }
    }
  }
  
  // Update video state indicator
  const videoOffIndicator = remoteContainer.querySelector('.video-off-indicator');
  if (videoEnabled) {
    videoOffIndicator.classList.add('hidden');
  } else {
    videoOffIndicator.classList.remove('hidden');
  }
  
  // Update audio state indicator
  const audioOffIndicator = remoteContainer.querySelector('.audio-off-indicator');
  if (audioEnabled) {
    audioOffIndicator.classList.add('hidden');
  } else {
    audioOffIndicator.classList.remove('hidden');
  }
}

// Clean up peer connection
function cleanupPeerConnection(peerId) {
  console.log(`Cleaning up connection for peer ${peerId}`);
  
  // Clean up data channel
  const dataChannel = dataChannels.get(peerId);
  if (dataChannel) {
    try {
      dataChannel.close();
    } catch (e) {
      console.error(`Error closing data channel for ${peerId}:`, e);
    }
    dataChannels.delete(peerId);
  }
  
  // Clean up transcription resources
  const remoteRecorder = remoteRecorders.get(peerId);
  if (remoteRecorder) {
    try {
      if (remoteRecorder.state === 'recording') {
        remoteRecorder.stop();
      }
    } catch (e) {
      console.error(`Error stopping remote recorder for ${peerId}:`, e);
    }
    remoteRecorders.delete(peerId);
  }
  
  // Clean up connection
  const connection = peerConnections.get(peerId);
  if (connection) {
    try {
      connection.close();
    } catch (e) {
      console.error(`Error closing connection for ${peerId}:`, e);
    }
    peerConnections.delete(peerId);
  }
  
  // Clean up username mapping
  peerUsernames.delete(peerId);
  
  // Clean up pending ICE candidates
  pendingIceCandidates.delete(peerId);
  
  // Remove from peers set
  peers.delete(peerId);
  
  // Update connection count
  updateConnectionCount();
  
  // Remove from UI
  const remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
  if (remoteContainer) {
    remoteContainer.remove();
  }
  
  // Add system message
  const peerUsername = getPeerUsername(peerId) || `Peer ${peerId.substring(0, 6)}...`;
  addSystemMessage(`${peerUsername} disconnected`);
}

// Create an offer to initiate WebRTC connection
async function createOffer(peerId, peerConnection) {
  try {
    // Create offer
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    console.log(`Created offer for ${peerId}`, offer);
    await peerConnection.setLocalDescription(offer);
    
    // Wait a moment to ensure the local description is fully set
    // This is important as sometimes the localDescription might not be immediately available
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Ensure we have a valid local description before sending
    if (!peerConnection.localDescription) {
      console.error(`No local description available for ${peerId}`);
      return;
    }
    
    // Send the offer immediately to avoid delays
    const signal = {
      type: 'offer',
      sdp: {
        type: peerConnection.localDescription.type,
        sdp: peerConnection.localDescription.sdp
      }
    };
    
    console.log(`Sending offer to peer ${peerId}`, signal);
    window.electronAPI.sendSignal(peerId, signal).then(result => {
      if (!result.success) {
        console.error(`Failed to send offer to ${peerId}:`, result.error);
      } else {
        console.log(`Successfully sent offer to ${peerId}`);
      }
    }).catch(err => {
      console.error(`Error sending offer to ${peerId}:`, err);
    });
  } catch (error) {
    console.error(`Error creating offer for ${peerId}:`, error);
  }
}

// Handle incoming WebRTC signals
async function handleSignalReceived(peerId, from, signal) {
  try {
    console.log(`Received signal from ${from} (${peerId}):`, signal.type);
    console.log(`Signal content:`, signal);
    
    // If we don't have a connection to this peer yet, create one
    let peerConnection;
    if (!peerConnections.has(peerId)) {
      console.log(`Creating new peer connection for ${peerId} due to incoming signal`);
      peerConnection = await createPeerConnection(peerId);
    } else {
      peerConnection = peerConnections.get(peerId);
    }
    
    // Handle different signal types
    if (signal.type === 'offer') {
      // Make sure we have a valid SDP object
      if (!signal.sdp || !signal.sdp.type || !signal.sdp.sdp) {
        console.error('Invalid SDP in offer:', signal.sdp);
        return;
      }
      
      console.log(`Setting remote description (offer) from ${peerId}`);
      const rtcSessionDescription = new RTCSessionDescription({
        type: signal.sdp.type,
        sdp: signal.sdp.sdp
      });
      console.log(`Created RTCSessionDescription for offer:`, rtcSessionDescription);
      
      try {
        await peerConnection.setRemoteDescription(rtcSessionDescription);
        console.log(`Successfully set remote description (offer) for ${peerId}`);
        
        // Process any pending ICE candidates now that we have a remote description
        if (pendingIceCandidates.has(peerId)) {
          console.log(`Processing ${pendingIceCandidates.get(peerId).length} pending ICE candidates for ${peerId}`);
          const candidates = pendingIceCandidates.get(peerId);
          for (const candidate of candidates) {
            await processIceCandidate(peerId, peerConnection, candidate);
          }
          pendingIceCandidates.delete(peerId);
        }
        
        // Create and send answer
        console.log(`Creating answer for ${peerId}`);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Wait a moment to ensure the local description is fully set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ensure we have a valid local description before sending
        if (!peerConnection.localDescription) {
          console.error(`No local description available for ${peerId}`);
          return;
        }
        
        // Send the answer
        const answerSignal = {
          type: 'answer',
          sdp: {
            type: peerConnection.localDescription.type,
            sdp: peerConnection.localDescription.sdp
          }
        };
        
        console.log(`Sending answer to peer ${peerId}`);
        window.electronAPI.sendSignal(peerId, answerSignal).then(result => {
          if (!result.success) {
            console.error(`Failed to send answer to ${peerId}:`, result.error);
          } else {
            console.log(`Successfully sent answer to ${peerId}`);
          }
        }).catch(err => {
          console.error(`Error sending answer to ${peerId}:`, err);
        });
      } catch (error) {
        console.error(`Error processing offer from ${peerId}:`, error);
      }
    } else if (signal.type === 'answer') {
      // Make sure we have a valid SDP object
      if (!signal.sdp || !signal.sdp.type || !signal.sdp.sdp) {
        console.error('Invalid SDP in answer:', signal.sdp);
        return;
      }
      
      console.log(`Setting remote description (answer) from ${peerId}`);
      const rtcSessionDescription = new RTCSessionDescription({
        type: signal.sdp.type,
        sdp: signal.sdp.sdp
      });
      
      try {
        await peerConnection.setRemoteDescription(rtcSessionDescription);
        console.log(`Successfully set remote description (answer) for ${peerId}`);
        
        // Process any pending ICE candidates now that we have a remote description
        if (pendingIceCandidates.has(peerId)) {
          console.log(`Processing ${pendingIceCandidates.get(peerId).length} pending ICE candidates for ${peerId}`);
          const candidates = pendingIceCandidates.get(peerId);
          for (const candidate of candidates) {
            await processIceCandidate(peerId, peerConnection, candidate);
          }
          pendingIceCandidates.delete(peerId);
        }
      } catch (error) {
        console.error(`Error setting remote description for ${peerId}:`, error);
      }
    } else if (signal.type === 'ice-candidate') {
      // Process the ICE candidate
      if (signal.candidate) {
        console.log(`Received ICE candidate from ${peerId}:`, signal.candidate);
        await processIceCandidate(peerId, peerConnection, signal.candidate);
      } else {
        console.warn(`Received empty ICE candidate from ${peerId}`);
      }
    } else {
      console.warn(`Unknown signal type from ${peerId}: ${signal.type}`);
    }
  } catch (error) {
    console.error(`Error handling signal from ${peerId}:`, error);
  }
}

// Process an ICE candidate received from a peer
async function processIceCandidate(peerId, connection, candidate) {
  try {
    // If we don't have a remote description yet, buffer the ICE candidate
    if (!connection.remoteDescription || !connection.remoteDescription.type) {
      console.log(`Buffering ICE candidate for ${peerId} until remote description is set`);
      if (!pendingIceCandidates.has(peerId)) {
        pendingIceCandidates.set(peerId, []);
      }
      pendingIceCandidates.get(peerId).push(candidate);
      return;
    }
    
    // Ensure the candidate has the necessary properties
    if (candidate.candidate && (candidate.sdpMid !== undefined || candidate.sdpMLineIndex !== undefined)) {
      console.log(`Processing ICE candidate for ${peerId}:`, candidate);
      
      // Create an RTCIceCandidate object
      const iceCandidate = new RTCIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment
      });
      
      console.log(`Created RTCIceCandidate object:`, iceCandidate);
      
      try {
        await connection.addIceCandidate(iceCandidate);
        console.log(`Successfully added ICE candidate for ${peerId}`);
      } catch (err) {
        console.error(`Error adding ICE candidate for ${peerId}:`, err);
      }
    } else {
      console.warn(`Skipping invalid ICE candidate for ${peerId}: missing sdpMid or sdpMLineIndex`, candidate);
    }
  } catch (err) {
    // Only log error if connection is still viable
    if (connection && connection.iceConnectionState !== 'failed' && connection.iceConnectionState !== 'closed') {
      console.error(`Error processing ICE candidate for ${peerId}:`, err);
    }
  }
}

// Add remote stream to video grid
function addRemoteStream(peerId, stream) {
  try {
    console.log(`Adding remote stream from peer ${peerId}`);
    
    // Check if this might be a screen sharing stream
    const videoTracks = stream.getVideoTracks();
    
    // Check if this is a screen share stream by looking at track settings
    if (videoTracks.length > 0) {
      const track = videoTracks[0];
      const settings = track.getSettings();
      
      // Screen share tracks typically have different aspect ratios and higher resolutions
      // or might have special labels/constraints
      if (settings && 
          ((settings.width > 1000 && settings.height > 700) || 
           track.label.includes('screen') || 
           stream.id.includes('screen'))) {
        
        console.log(`Detected screen share track from peer ${peerId} with settings:`, settings);
        
        // Add to UI as a completely separate screen share element
        addScreenShareToGrid(peerId, stream, 'Shared Screen');
        
        // Add system message
        const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
        addSystemMessage(`${peerName} started sharing their screen`);
        
        // Setup audio transcription separately if there are audio tracks
        if (stream.getAudioTracks().length > 0) {
          setTimeout(() => {
            setupRemoteTranscription(stream, peerId);
          }, 1000);
        }
        
        // We've handled this as a screen share, return so it's not added as a video stream
        return;
      }
    }
    
    // If we're here, this is a regular video stream, not a screen share
    // Find an existing container for this peer or create a new one
    let remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
    
    if (!remoteContainer) {
      // Get the peer's username
      const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
      
      // Create a new container for this peer
      remoteContainer = document.createElement('div');
      remoteContainer.className = 'remote-video-container';
      remoteContainer.setAttribute('data-peer-id', peerId);
      
      // Create video wrapper for aspect ratio
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';
      remoteContainer.appendChild(videoWrapper);
      
      // Add video element
      const remoteVideo = document.createElement('video');
      remoteVideo.className = 'remote-video';
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;
      videoWrapper.appendChild(remoteVideo);
      
      // Add transcript overlay container inside video wrapper
      const transcriptOverlay = document.createElement('div');
      transcriptOverlay.className = 'transcript-overlay hidden';
      transcriptOverlay.id = `transcript-overlay-${peerId}`;
      videoWrapper.appendChild(transcriptOverlay);
      
      // Add participant info section
      const participantInfo = document.createElement('div');
      participantInfo.className = 'participant-info';
      remoteContainer.appendChild(participantInfo);
      
      // Add participant name
      const nameElement = document.createElement('div');
      nameElement.className = 'participant-name';
      nameElement.textContent = peerName;
      participantInfo.appendChild(nameElement);
      
      // Add transcript container
      const transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'transcript-container';
      participantInfo.appendChild(transcriptContainer);
      
      // Add transcript title
      const transcriptTitle = document.createElement('div');
      transcriptTitle.className = 'transcript-title';
      transcriptTitle.textContent = 'Transcript';
      transcriptContainer.appendChild(transcriptTitle);
      
      // Add transcript content
      const transcriptContent = document.createElement('div');
      transcriptContent.className = 'transcript-content';
      transcriptContainer.appendChild(transcriptContent);
      
      // Store the username in our map if it's not a placeholder
      if (peerName !== `Peer ${peerId.substring(0, 6)}`) {
        peerUsernames.set(peerId, peerName);
        console.log(`Stored username "${peerName}" for peer ${peerId}`);
      }
      
      // Add video off indicator
      const videoOffIndicator = document.createElement('div');
      videoOffIndicator.className = 'video-off-indicator hidden';
      videoOffIndicator.innerHTML = '📷❌';
      videoWrapper.appendChild(videoOffIndicator);
      
      // Add audio off indicator
      const audioOffIndicator = document.createElement('div');
      audioOffIndicator.className = 'audio-off-indicator hidden';
      audioOffIndicator.innerHTML = '🔇';
      videoWrapper.appendChild(audioOffIndicator);
      
      // Add volume control
      const volumeControl = document.createElement('div');
      volumeControl.className = 'volume-control';
      
      const volumeLabel = document.createElement('label');
      volumeLabel.textContent = 'Volume:';
      volumeControl.appendChild(volumeLabel);
      
      const volumeSlider = document.createElement('input');
      volumeSlider.type = 'range';
      volumeSlider.min = '0';
      volumeSlider.max = '2';
      volumeSlider.step = '0.1';
      volumeSlider.value = '1';
      volumeSlider.className = 'volume-slider';
      volumeControl.appendChild(volumeSlider);
      
      // Set initial volume
      peerVolumes.set(peerId, 1.0);
      
      // Add event listener for volume change
      volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        peerVolumes.set(peerId, volume);
        
        // Find the audio element
        const videoElement = remoteContainer.querySelector('video');
        if (videoElement) {
          videoElement.volume = volume;
        }
      });
      
      remoteContainer.appendChild(volumeControl);
      
      // Add the container to the video grid
      remoteVideosContainer.appendChild(remoteContainer);
      
      console.log(`Remote container for ${peerName} (${peerId}) added to DOM with transcript overlay`);
    } else {
      // Update the name if we now have a real username
      const nameElement = remoteContainer.querySelector('.participant-name');
      const currentName = nameElement.textContent;
      
      // If current name is a placeholder and we now have a real name
      if (currentName.includes('Peer') && peerUsernames.has(peerId)) {
        const realName = peerUsernames.get(peerId);
        nameElement.textContent = realName;
        console.log(`Updated name in DOM from "${currentName}" to "${realName}" for peer ${peerId}`);
      }
    }
    
    // Find the video element
    const remoteVideo = remoteContainer.querySelector('.remote-video');
    
    // Set the srcObject to display the stream
    remoteVideo.srcObject = stream;
    
    // Set the volume based on stored preference
    if (peerVolumes.has(peerId)) {
      remoteVideo.volume = peerVolumes.get(peerId);
    }
    
    // Log active tracks
    console.log(`Remote stream has ${stream.getTracks().length} tracks:`);
    stream.getTracks().forEach(track => {
      console.log(`- ${track.kind} track (${track.id}): enabled=${track.enabled}, readyState=${track.readyState}`);
    });
    
    // Ensure the container is visible
    remoteContainer.classList.remove('hidden');
    
    // Update connection count
    updateConnectionCount();
    
    // Setup transcription for audio tracks
    if (stream.getAudioTracks().length > 0) {
      console.log(`Remote stream has audio tracks, setting up transcription for peer ${peerId}`);
      
      // Make sure any audio tracks are enabled
      stream.getAudioTracks().forEach(track => {
        // Enable the track to ensure we can record it
        if (!track.enabled) {
          console.log(`Enabling audio track ${track.id} for transcription`);
          track.enabled = true;
        }
        
        console.log(`Audio track ${track.id} for peer ${peerId}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
      });
      
      // Set up transcription with a short delay to ensure everything is initialized
      setTimeout(() => {
        // Call with correct parameter order (stream first, then peerId)
        setupRemoteTranscription(stream, peerId);
      }, 1000);
    } else {
      console.warn(`No audio tracks found in remote stream for peer ${peerId}, cannot set up transcription`);
    }
    
    return remoteContainer;
  } catch (error) {
    console.error(`Error adding remote stream for ${peerId}:`, error);
    return null;
  }
}

// Get a username for a peer based on peerId
function getPeerUsername(peerId) {
  // Check if we have a username stored for this peer
  if (peerUsernames.has(peerId)) {
    return peerUsernames.get(peerId);
  }
  
  // If we find a remote video container with this peer ID, get the username from it
  const remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
  if (remoteContainer) {
    const nameElement = remoteContainer.querySelector('.participant-name');
    if (nameElement && nameElement.textContent && 
        !nameElement.textContent.includes('Peer') && 
        !nameElement.textContent.includes('...')) {
      // Store it for future use
      const username = nameElement.textContent;
      peerUsernames.set(peerId, username);
      console.log(`Retrieved username "${username}" for peer ${peerId} from DOM`);
      return username;
    }
  }
  
  // If still no username found, check remote streams or connections
  for (const [id, dataChannel] of dataChannels.entries()) {
    if (id === peerId && dataChannel._username) {
      const username = dataChannel._username;
      peerUsernames.set(peerId, username);
      console.log(`Retrieved username "${username}" for peer ${peerId} from data channel`);
      return username;
    }
  }
  
  // Fallback to using short peerId as username
  console.log(`No username found for peer ${peerId}, using ID-based name`);
  return null;
}

// Set up media recording for local transcription
function setupMediaRecording() {
  if (!localStream || !localStream.getAudioTracks().length) return;
  
  try {
    // Check if we already have a mediaRecorder that's recording
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('MediaRecorder is already running, not starting a new one');
      return;
    }
    
    // Create a new MediaRecorder
    const audioStream = new MediaStream([localStream.getAudioTracks()[0]]);
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    
    // Create an AudioContext to analyze volume levels
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyzer = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyzer);
    analyzer.fftSize = 256;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Volume threshold for audio detection - use the value from settings
    const volumeThreshold = appSettings.audioThreshold || 0.05;
    console.log(`Audio detection threshold set to ${volumeThreshold}`);
    
    // Separate threshold for transcription to reduce false positives
    const transcriptionThreshold = appSettings.transcriptionThreshold || 0.05;
    console.log(`Transcription threshold set to ${transcriptionThreshold}`);
    
    // Variables to track silence
    let isSilent = true;
    let silentFrameCount = 0;
    let hasSpokenDuringRecording = false;
    
    // Check volume levels periodically
    const volumeCheckInterval = setInterval(() => {
      if (!isAudioEnabled) return;
      
      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate average volume level (0-255 scale)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalizedVolume = average / 255; // Convert to 0-1 scale
      
      // Detect if audio is silent based on threshold
      const currentlyIsSilent = normalizedVolume < volumeThreshold;
      
      // Check if audio meets the higher transcription threshold
      const meetsTranscriptionThreshold = normalizedVolume >= transcriptionThreshold;
      
      // If state changed from silent to not silent, start recording
      if (isSilent && !currentlyIsSilent) {
        console.log(`Audio level above threshold: ${normalizedVolume.toFixed(3)}`);
        isSilent = false;
        silentFrameCount = 0;
        
        // Only mark as spoken if it meets the higher transcription threshold
        if (meetsTranscriptionThreshold) {
          hasSpokenDuringRecording = true;
        }
        
        // Start recording if not already recording and audio is enabled
        if (!isRecording && isAudioEnabled) {
          isRecording = true;
          try {
            mediaRecorder.start();
            console.log('Started recording audio for transcription');
          } catch (error) {
            console.error('Error starting media recorder:', error);
            isRecording = false;
          }
        }
      } 
      // If not silent but below transcription threshold, just note it
      else if (!isSilent && !currentlyIsSilent && !meetsTranscriptionThreshold) {
        // Audio is still above detection threshold but below transcription threshold
        if (Math.random() < 0.05) { // Log occasionally
          console.log(`Audio continues above detection threshold but below transcription threshold: ${normalizedVolume.toFixed(3)}`);
        }
      }
      // If state changed from not silent to silent, prepare to stop recording
      else if (!isSilent && currentlyIsSilent) {
        silentFrameCount++;
        
        if (silentFrameCount >= 10) { // About 0.5 seconds of silence (if interval is 50ms)
          isSilent = true;
          console.log(`Audio level below threshold: ${normalizedVolume.toFixed(3)}`);
          
          // Stop recording if we were recording
          if (isRecording) {
            console.log('Stopping recording after silence');
            isRecording = false;
            try {
              mediaRecorder.stop();
            } catch (error) {
              console.error('Error stopping media recorder:', error);
            }
          }
        }
      }
    }, 200); // Check every 200ms
    
    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    // Handle recording stop
    mediaRecorder.onstop = async () => {
      if (recordedChunks.length === 0) return;
      
      try {
        // Skip transcription if no speech was detected during this recording chunk
        if (!hasSpokenDuringRecording) {
          console.log('No speech detected above threshold during recording period, skipping transcription');
          recordedChunks = [];
          hasSpokenDuringRecording = false;
          return;
        }
        
        // Create a blob from the recorded chunks
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordedChunks = [];
        
        // Convert blob to ArrayBuffer before sending to main process
        const arrayBuffer = await blob.arrayBuffer();
        
        // Create a regular array from the ArrayBuffer to ensure it can be cloned
        const uint8Array = new Uint8Array(arrayBuffer);
        const buffer = Array.from(uint8Array);
        
        // Reset speech detection for next chunk
        hasSpokenDuringRecording = false;
        
        // Send to main process for transcription
        const username = usernameInput.value.trim();
        const result = await window.electronAPI.transcribeAudio(buffer, username);
        if (result.success && result.transcription && result.transcription.trim().length > 0) {
          console.log(`Local transcription success: "${result.transcription}"`);
          
          // Directly update the local transcript UI
          updateLocalTranscriptUI(result.transcription);
          
          // Also update the global transcript system
          updateTranscription(username, result.transcription);
          
          // Share transcript with other peers via data channel
          for (const [peerId, dataChannel] of dataChannels.entries()) {
            if (dataChannel && dataChannel.readyState === 'open') {
              const transcriptMessage = {
                type: 'transcript',
                speaker: username,
                text: result.transcription,
                timestamp: new Date().toISOString()
              };
              dataChannel.send(JSON.stringify(transcriptMessage));
            }
          }
        } else if (result.error) {
          console.error('Transcription error:', result.error);
          
          // Check if it's an API key error 
          if (result.error.includes('API key not set')) {
            addSystemMessage(`⚠️ Transcription failed: OpenAI API key not set. Please configure in settings.`);
            
            // Show this message only once
            if (!window.apiKeyErrorShown) {
              window.apiKeyErrorShown = true;
              
              // Open settings popup to prompt user to enter API key
              toggleSettingsPopup();
              
              // Focus on API key input
              setTimeout(() => {
                if (openaiApiKeyInput) {
                  openaiApiKeyInput.focus();
                }
              }, 500);
            }
          }
        }
      } catch (error) {
        console.error('Error transcribing audio:', error);
      }
    };
    
    // Start recording
    mediaRecorder.start();
    isRecording = true;
    
    // Set up interval to stop and restart recording every 5 seconds
    transcriptionInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        
        // Start a new recording after a small delay
        setTimeout(() => {
          if (isAudioEnabled && isRecording && mediaRecorder && mediaRecorder.state !== 'recording') {
            try {
              mediaRecorder.start();
            } catch (error) {
              console.error('Error restarting media recorder:', error);
            }
          }
        }, 500);
      }
    }, 5000); // Record in 5-second chunks
    
    // Cleanup function for when stopping transcription
    const originalStopMediaRecording = stopMediaRecording;
    stopMediaRecording = function() {
      // Call original function
      originalStopMediaRecording();
      
      // Also clean up our volume checking
      if (volumeCheckInterval) {
        clearInterval(volumeCheckInterval);
      }
      
      // Close audio context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(err => console.error('Error closing audio context:', err));
      }
    };
    
  } catch (error) {
    console.error('Error setting up media recording:', error);
    addSystemMessage(`Error setting up transcription: ${error.message}`);
  }
}

// Function to directly update the local transcript UI
function updateLocalTranscriptUI(text) {
  console.log(`Updating local transcript UI: "${text}"`);
  
  // Update the local transcript container
  const transcriptContainer = document.querySelector('#local-transcript .transcript-content');
  if (transcriptContainer) {
    // CHANGE: Clear existing entries, show only the latest
    transcriptContainer.innerHTML = '';
    
    // Create a new entry
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';
    entry.textContent = `${text}`;
    
    // Style the entry for visibility
    entry.style.padding = '4px 8px';
    entry.style.margin = '4px 0';
    entry.style.backgroundColor = '#e3f2fd'; // Light blue for "you"
    entry.style.borderRadius = '4px';
    entry.style.border = '1px solid #bbdefb';
    entry.style.fontWeight = 'normal';
    
    // Add to container
    transcriptContainer.appendChild(entry);
    
    console.log('Updated local transcript container with latest transcript');
  } else {
    console.warn('Local transcript container not found');
  }
  
  // Update the overlay
  const localOverlay = document.getElementById('local-overlay-transcript');
  if (localOverlay) {
    localOverlay.textContent = text;
    localOverlay.classList.remove('hidden');
    
    // Force visible styling
    localOverlay.style.display = 'block';
    localOverlay.style.position = 'absolute';
    localOverlay.style.bottom = '10px';
    localOverlay.style.left = '10px';
    localOverlay.style.right = '10px';
    localOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    localOverlay.style.color = 'white';
    localOverlay.style.padding = '8px';
    localOverlay.style.borderRadius = '4px';
    localOverlay.style.zIndex = '5';
    
    // Hide after a few seconds
    setTimeout(() => {
      localOverlay.classList.add('hidden');
      localOverlay.style.display = 'none';
    }, 5000);
    
    console.log('Updated local overlay');
  } else {
    console.warn('Local overlay not found');
  }
}

// Stop media recording
function stopMediaRecording() {
  isRecording = false;
  
  if (transcriptionInterval) {
    clearInterval(transcriptionInterval);
    transcriptionInterval = null;
  }
  
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  } catch (error) {
    console.error('Error stopping media recorder:', error);
  }
  
  // Reset the media recorder
  if (mediaRecorder) {
    try {
      // Remove event listeners
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
    } catch (error) {
      console.error('Error cleaning up media recorder:', error);
    }
  }
}

// Set up transcription for remote participants
function setupRemoteTranscription(stream, peerId) {
  try {
    const peerUsername = peerUsernames.get(peerId) || peerId.substring(0, 8);
    
    console.log(`Setting up remote transcription for ${peerUsername} (${peerId})`);
    
    // Ensure the stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error(`No audio tracks found in stream for ${peerUsername}`);
      return;
    }
    
    // Log audio track status
    audioTracks.forEach((track, index) => {
      console.log(`Remote audio track ${index} for ${peerUsername}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
      // Ensure track is enabled
      if (!track.enabled) {
        track.enabled = true;
        console.log(`Enabled previously disabled audio track for ${peerUsername}`);
      }
    });
    
    // Create a new MediaStream with just the audio
    const audioStream = new MediaStream();
    audioTracks.forEach(track => audioStream.addTrack(track));
    
    // Clean up any existing recorder for this peer
    if (remoteRecorders.has(peerId)) {
      console.log(`Found existing recorder for ${peerUsername}, cleaning up`);
      try {
        const oldRecorder = remoteRecorders.get(peerId);
        if (oldRecorder && oldRecorder.state === 'recording') {
          oldRecorder.stop();
        }
        
        // Also clean up any volume analyzers
        if (oldRecorder._volumeCheckInterval) {
          clearInterval(oldRecorder._volumeCheckInterval);
        }
        
        if (oldRecorder._audioContext && oldRecorder._audioContext.state !== 'closed') {
          oldRecorder._audioContext.close().catch(e => console.warn(`Error closing audio context: ${e.message}`));
        }
        
        console.log(`Cleaned up existing recorder for ${peerUsername}`);
      } catch (e) {
        console.warn(`Error cleaning up old recorder: ${e.message}`);
      }
      remoteRecorders.delete(peerId);
    }
    
    // Create a new MediaRecorder for this remote stream
    let options = { audioBitsPerSecond: 128000 };
    
    // Try to use supported format with fallbacks
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      options.mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options.mimeType = 'audio/mp4';
    }
    
    console.log(`Creating MediaRecorder with options:`, options);
    const remoteRecorder = new MediaRecorder(audioStream, options);
    
    // Set up volume analysis
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyzer = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyzer);
    analyzer.fftSize = 256;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Store these for cleanup later
    remoteRecorder._audioContext = audioContext;
    
    // Volume threshold for audio detection - use setting or default
    const volumeThreshold = appSettings.audioThreshold || 0.05;
    console.log(`Remote audio detection threshold for ${peerUsername} set to ${volumeThreshold}`);
    
    // Separate threshold for transcription to reduce false positives
    const transcriptionThreshold = appSettings.transcriptionThreshold || 0.05;
    console.log(`Remote transcription threshold for ${peerUsername} set to ${transcriptionThreshold}`);
    
    // Variables to track silence
    let isSilent = true;
    let hasSpokenDuringRecording = false;
    
    // Check volume levels periodically
    remoteRecorder._volumeCheckInterval = setInterval(() => {
      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate average volume level (0-255 scale)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalizedVolume = average / 255; // Convert to 0-1 scale
      
      // Store this for the peer
      peerVolumes.set(peerId, normalizedVolume);
      
      // Debug log volume every few seconds for troubleshooting
      if (Math.random() < 0.05) { // Roughly every 20 checks (4 seconds if interval is 200ms)
        console.log(`Remote audio level for ${peerUsername}: ${normalizedVolume.toFixed(3)} (threshold: ${volumeThreshold})`);
      }
      
      // Detect if audio is silent based on threshold
      const currentlyIsSilent = normalizedVolume < volumeThreshold;
      
      // Check if audio meets the higher transcription threshold
      const meetsTranscriptionThreshold = normalizedVolume >= transcriptionThreshold;
      
      // If state changed from silent to not silent, log it
      if (isSilent && !currentlyIsSilent) {
        console.log(`Remote audio level above threshold for ${peerUsername}: ${normalizedVolume.toFixed(3)}`);
        isSilent = false;
        
        // Only mark as spoken if it meets the higher transcription threshold
        if (meetsTranscriptionThreshold) {
          hasSpokenDuringRecording = true;
          console.log(`Remote audio meets transcription threshold for ${peerUsername}: ${normalizedVolume.toFixed(3)}`);
        }
      } 
      // If not silent but now meets transcription threshold
      else if (!isSilent && !currentlyIsSilent && meetsTranscriptionThreshold && !hasSpokenDuringRecording) {
        hasSpokenDuringRecording = true;
        console.log(`Remote audio now meets transcription threshold for ${peerUsername}: ${normalizedVolume.toFixed(3)}`);
      }
      // If state changed from not silent to silent, log it
      else if (!isSilent && currentlyIsSilent) {
        isSilent = true;
        console.log(`Remote audio level below threshold for ${peerUsername}: ${normalizedVolume.toFixed(3)}`);
      }
    }, 200); // Check every 200ms
    
    // Create a dedicated array for this recorder's chunks
    const remoteChunks = [];
    
    // Handle data available event
    remoteRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        remoteChunks.push(event.data);
        console.log(`Remote audio chunk received from ${peerUsername}, size: ${event.data.size} bytes, chunks total: ${remoteChunks.length}`);
      } else {
        console.warn(`Empty audio chunk received from ${peerUsername}`);
      }
    };
    
    // Handle recording stop
    remoteRecorder.onstop = async () => {
      console.log(`Remote recorder stopped for ${peerUsername}, processing ${remoteChunks.length} chunks`);
      
      if (remoteChunks.length === 0) {
        console.log(`No audio chunks collected for ${peerUsername}, restarting recorder`);
        // Restart recording if still connected
        if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
          try {
            remoteRecorder.start(2000); // Use shorter chunks for faster transcription
            console.log(`Restarted empty recorder for ${peerUsername}`);
          } catch (error) {
            console.error(`Error restarting recorder for ${peerUsername}:`, error);
          }
        }
        return;
      }
      
      try {
        // Skip transcription if no speech was detected during this recording chunk
        if (!hasSpokenDuringRecording) {
          console.log(`No speech detected above threshold during recording period for ${peerUsername}, skipping transcription`);
          // Clear the chunks array
          while (remoteChunks.length > 0) {
            remoteChunks.pop();
          }
          // Reset for next recording
          hasSpokenDuringRecording = false;
          
          // Restart recording if still connected
          if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
            try {
              remoteRecorder.start(2000);
              console.log(`Restarted recorder after silence for ${peerUsername}`);
            } catch (error) {
              console.error(`Error restarting recorder after silence for ${peerUsername}:`, error);
            }
          }
          return;
        }
        
        console.log(`Creating blob from ${remoteChunks.length} chunks for ${peerUsername}`);
        // Create a blob from the recorded chunks
        const blob = new Blob(remoteChunks, { type: remoteRecorder.mimeType || 'audio/webm' });
        console.log(`Processing audio chunks from ${peerUsername}, total size: ${blob.size} bytes`);
        
        // Clear the chunks array now that we've created the blob
        while (remoteChunks.length > 0) {
          remoteChunks.pop();
        }
        
        // Reset speech detection for next chunk
        hasSpokenDuringRecording = false;
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        
        // Ensure we have meaningful audio data
        if (arrayBuffer.byteLength < 1000) {
          console.log(`Audio data too small from ${peerUsername} (${arrayBuffer.byteLength} bytes), skipping transcription`);
          // Restart recording
          if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
            try {
              remoteRecorder.start(2000);
              console.log(`Restarted recorder after small data for ${peerUsername}`);
            } catch (error) {
              console.error(`Error restarting recorder for ${peerUsername}:`, error);
            }
          }
          return;
        }

        // Create a regular array from the ArrayBuffer to ensure it can be cloned
        const uint8Array = new Uint8Array(arrayBuffer);
        const buffer = Array.from(uint8Array);
        
        // Send to main process for transcription
        const result = await window.electronAPI.transcribeAudio(buffer, peerUsername);
        
        if (result.success && result.transcription && result.transcription.trim().length > 0) {
          console.log(`Remote transcription success for ${peerUsername}: "${result.transcription}"`);
          
          // Update the global transcript system
          updateTranscription(peerUsername, result.transcription);
        } else if (result.error) {
          console.error(`Transcription error for ${peerUsername}:`, result.error);
        }
        
        // Restart recording if still connected
        if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
          try {
            remoteRecorder.start(2000);
            console.log(`Restarted recorder for ${peerUsername} after transcription`);
          } catch (error) {
            console.error(`Error restarting recorder for ${peerUsername}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error processing audio from ${peerUsername}:`, error);
        
        // Restart recording if still connected, despite the error
        if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
          try {
            remoteRecorder.start(2000);
            console.log(`Restarted recorder for ${peerUsername} after error`);
          } catch (startError) {
            console.error(`Error restarting recorder for ${peerUsername}:`, startError);
          }
        }
      }
    };
    
    // Start recording
    remoteRecorder.start(5000);
    console.log(`Started remote recording for ${peerUsername}`);
    
    // Store the recorder for later cleanup/reference
    remoteRecorders.set(peerId, remoteRecorder);
    
    // Set up interval to stop and restart recording periodically
    const intervalId = setInterval(() => {
      // If the connection is gone, clean up
      if (!peerConnections.has(peerId)) {
        clearInterval(intervalId);
        
        // Clean up recorder
        if (remoteRecorders.has(peerId)) {
          const recorder = remoteRecorders.get(peerId);
          if (recorder && recorder.state === 'recording') {
            try {
              recorder.stop();
            } catch (e) {
              console.warn(`Error stopping recorder for disconnected peer ${peerUsername}:`, e);
            }
          }
          
          // Clean up intervals
          if (recorder._volumeCheckInterval) {
            clearInterval(recorder._volumeCheckInterval);
          }
          
          // Clean up audio context
          if (recorder._audioContext && recorder._audioContext.state !== 'closed') {
            recorder._audioContext.close().catch(e => console.warn(`Error closing audio context: ${e.message}`));
          }
          
          remoteRecorders.delete(peerId);
        }
        
        return;
      }
      
      // Otherwise, check if we need to restart the recorder
      if (remoteRecorders.has(peerId)) {
        const recorder = remoteRecorders.get(peerId);
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      }
    }, 10000); // Check/restart every 10 seconds
    
  } catch (error) {
    console.error(`Error setting up remote transcription for ${peerId}:`, error);
  }
}

// Toggle transcript popup
function toggleTranscriptPopup() {
  console.log('Toggle transcript popup clicked');
  
  // Check if the popup is currently hidden
  const isHidden = transcriptPopup.classList.contains('hidden');
  
  // If opening the popup, refresh all transcripts
  if (isHidden) {
    console.log('Opening transcript popup and refreshing content');
    refreshTranscriptPopup();
    
    // Position the popup in the center of the screen
    transcriptPopup.style.display = 'flex';
    transcriptPopup.style.position = 'fixed';
    transcriptPopup.style.top = '50%';
    transcriptPopup.style.left = '50%';
    transcriptPopup.style.transform = 'translate(-50%, -50%)';
    transcriptPopup.style.zIndex = '1000';
    transcriptPopup.style.backgroundColor = 'white';
    transcriptPopup.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
    transcriptPopup.style.borderRadius = '8px';
    transcriptPopup.style.width = '80%';
    transcriptPopup.style.maxWidth = '800px';
    transcriptPopup.style.maxHeight = '80%';
    
    // Style the content area
    transcriptPopupContent.style.overflow = 'auto';
    transcriptPopupContent.style.width = '100%';
    transcriptPopupContent.style.padding = '16px';
  }
  
  // Toggle the visibility
  transcriptPopup.classList.toggle('hidden');
  
  // Auto-scroll to the bottom when opening
  if (!transcriptPopup.classList.contains('hidden')) {
    transcriptPopupContent.scrollTop = transcriptPopupContent.scrollHeight;
  }
}

// Refresh the transcript popup with all stored transcripts
function refreshTranscriptPopup() {
  console.log('Refreshing transcript popup');
  
  // Clear existing content
  transcriptPopupContent.innerHTML = '';
  
  // Create a header if it's empty
  const header = document.createElement('div');
  header.className = 'transcript-popup-header-text';
  header.textContent = 'Call Transcript';
  header.style.fontWeight = 'bold';
  header.style.fontSize = '18px';
  header.style.marginBottom = '16px';
  header.style.textAlign = 'center';
  transcriptPopupContent.appendChild(header);
  
  // Compile all transcripts with timestamps
  const allTranscripts = [];
  
  transcripts.forEach((entries, speaker) => {
    entries.forEach(entry => {
      allTranscripts.push({
        speaker,
        text: entry.text,
        timestamp: entry.timestamp
      });
    });
  });
  
  // Sort by timestamp
  allTranscripts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Add them all to the popup
  allTranscripts.forEach(entry => {
    addTranscriptToPopup(entry.speaker, entry.text, entry.timestamp);
  });
  
  console.log(`Added ${allTranscripts.length} transcript entries to popup`);
  
  // Add a note if no transcripts
  if (allTranscripts.length === 0) {
    const noTranscripts = document.createElement('div');
    noTranscripts.className = 'no-transcripts';
    noTranscripts.textContent = 'No transcripts available yet. Speak to generate transcriptions.';
    noTranscripts.style.textAlign = 'center';
    noTranscripts.style.margin = '20px 0';
    noTranscripts.style.color = '#666';
    transcriptPopupContent.appendChild(noTranscripts);
  }
}

// Update transcription display
function updateTranscription(speaker, text) {
  if (!text || text.trim() === '') return;
  
  console.log(`Updating transcription for ${speaker}: "${text}"`);
  
  // Get current username from the currentUser object
  const currentUsername = currentUser ? currentUser.handle : 'You';
  
  // Store transcript entry in memory
  if (!transcripts.has(speaker)) {
    transcripts.set(speaker, []);
  }
  
  const timestamp = new Date().toISOString();
  transcripts.get(speaker).push({
    text,
    timestamp
  });
  
  // Find the appropriate container for this speaker
  let transcriptContainer = null;
  let overlayElement = null;
  
  // Handle local user's transcription
  if (speaker === currentUsername) {
    // For the local user
    transcriptContainer = document.querySelector('#local-transcript .transcript-content');
    overlayElement = document.getElementById('local-overlay-transcript');
  } else {
    // For remote peers, find the correct peer container by username
    let foundPeerId = null;
    
    // Find the peerId associated with this speaker's username
    for (const [peerId, peerUsername] of peerUsernames.entries()) {
      if (peerUsername === speaker) {
        foundPeerId = peerId;
        break;
      }
    }
    
    if (foundPeerId) {
      console.log(`Found peer ID ${foundPeerId} for speaker ${speaker}`);
      const peerElement = document.querySelector(`.remote-video-container[data-peer-id="${foundPeerId}"]`);
      if (peerElement) {
        console.log(`Found container element for peer ${foundPeerId}`);
        transcriptContainer = peerElement.querySelector('.transcript-content');
        overlayElement = document.getElementById(`transcript-overlay-${foundPeerId}`);
      } else {
        console.warn(`Could not find container element for peer ${foundPeerId}`);
      }
    } else {
      console.warn(`Could not find peer ID for speaker ${speaker}`);
    }
  }
  
  // Update the transcript container if found
  if (transcriptContainer) {
    console.log(`Updating transcript container for ${speaker}`);
    
    // CHANGE: Instead of appending, replace the content with just the latest entry
    // Clear all existing entries
    transcriptContainer.innerHTML = '';
    
    // Create a new entry for the latest transcript only
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';
    entry.textContent = text;
    
    // Style the entry to make it more visible
    entry.style.padding = '4px 8px';
    entry.style.marginBottom = '4px';
    entry.style.backgroundColor = '#f0f0f0';
    entry.style.borderRadius = '4px';
    
    // Add just this single entry
    transcriptContainer.appendChild(entry);
    
    console.log(`Updated transcript container for ${speaker} with latest: "${text}"`);
  } else {
    console.warn(`Could not find transcript container for ${speaker}`);
  }
  
  // Update the overlay if found
  if (overlayElement) {
    console.log(`Updating overlay for ${speaker}`);
    
    // Make overlay more noticeable
    overlayElement.textContent = text;
    overlayElement.classList.remove('hidden');
    
    // Make sure it's actually visible in UI
    overlayElement.style.display = 'block';
    
    // Make sure it has some basic styling if not already in CSS
    overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlayElement.style.color = 'white';
    overlayElement.style.padding = '8px';
    overlayElement.style.borderRadius = '4px';
    overlayElement.style.maxWidth = '90%';
    overlayElement.style.margin = '0 auto';
    
    // Hide after a few seconds
    setTimeout(() => {
      overlayElement.classList.add('hidden');
      overlayElement.style.display = 'none';
    }, 5000);
  }
  
  // Add to transcript popup
  addTranscriptToPopup(speaker, text, timestamp);
  
  // Ensure the transcript popup is scrolled to the bottom if visible
  if (!transcriptPopup.classList.contains('hidden')) {
    transcriptPopupContent.scrollTop = transcriptPopupContent.scrollHeight;
  }
}

// Add transcript to popup
function addTranscriptToPopup(speaker, text, timestamp) {
  console.log(`Adding transcript to popup: ${speaker}: "${text}"`);
  
  // Get the current user's handle to determine if this is from the local user
  const currentUsername = currentUser ? currentUser.handle : 'You';
  
  // Create transcript entry
  const entry = document.createElement('div');
  entry.className = 'transcript-entry';
  
  // Style the entry to be more visible
  entry.style.display = 'flex';
  entry.style.flexDirection = 'column';
  entry.style.marginBottom = '12px';
  entry.style.padding = '8px 12px';
  entry.style.borderRadius = '8px';
  entry.style.backgroundColor = speaker === currentUsername ? '#e3f2fd' : '#f5f5f5';
  entry.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  entry.style.borderLeft = speaker === currentUsername ? '4px solid #2196f3' : '4px solid #9e9e9e';
  
  // Add header row with speaker and timestamp
  const header = document.createElement('div');
  header.className = 'transcript-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '4px';
  
  // Add speaker name
  const speakerElement = document.createElement('div');
  speakerElement.className = 'transcript-speaker';
  speakerElement.textContent = speaker === currentUsername ? `${speaker} (You)` : speaker;
  speakerElement.style.fontWeight = 'bold';
  speakerElement.style.color = speaker === currentUsername ? '#0277bd' : '#424242';
  speakerElement.style.fontSize = '14px';
  header.appendChild(speakerElement);
  
  // Add timestamp
  const timeElement = document.createElement('div');
  timeElement.className = 'transcript-time';
  
  // Format timestamp
  const date = new Date(timestamp);
  const formattedTime = date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  
  timeElement.textContent = formattedTime;
  timeElement.style.color = '#757575';
  timeElement.style.fontSize = '12px';
  header.appendChild(timeElement);
  
  entry.appendChild(header);
  
  // Add transcript text
  const textElement = document.createElement('div');
  textElement.className = 'transcript-text';
  textElement.textContent = text;
  textElement.style.marginTop = '4px';
  textElement.style.lineHeight = '1.4';
  textElement.style.fontSize = '15px';
  textElement.style.color = '#212121';
  entry.appendChild(textElement);
  
  // Add to popup content
  transcriptPopupContent.appendChild(entry);
  
  // Auto-scroll to the bottom
  transcriptPopupContent.scrollTop = transcriptPopupContent.scrollHeight;
  
  // Limit the number of entries to avoid memory issues
  const maxEntries = 100;
  while (transcriptPopupContent.children.length > maxEntries) {
    transcriptPopupContent.removeChild(transcriptPopupContent.firstChild);
  }
}

// Add function to save transcripts
function saveTranscript(username) {
  if (!transcripts.has(username)) {
    console.warn(`No transcript found for ${username}`);
    return;
  }
  
  const entries = transcripts.get(username);
  const formattedTranscript = entries.map(entry => 
    `[${entry.timestamp}] ${username}: ${entry.text}`
  ).join('\n');
  
  // Create a download link
  const blob = new Blob([formattedTranscript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transcript_${username}_${currentRoom}_${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Save all transcripts
function saveAllTranscripts() {
  if (transcripts.size === 0) {
    console.warn('No transcripts available to save');
    return;
  }
  
  // Create a combined transcript with all participants
  let allTranscripts = [];
  
  transcripts.forEach((entries, username) => {
    entries.forEach(entry => {
      allTranscripts.push({
        timestamp: entry.timestamp,
        username,
        text: entry.text
      });
    });
  });
  
  // Sort by timestamp
  allTranscripts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Format the transcript
  const formattedTranscript = allTranscripts.map(entry => 
    `[${entry.timestamp}] ${entry.username}: ${entry.text}`
  ).join('\n');
  
  // Create a download link
  const blob = new Blob([formattedTranscript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transcript_all_${currentRoom}_${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate a call summary
async function generateCallSummary() {
  try {
    // Prevent multiple simultaneous calls to generate summary
    if (isSummaryGenerating) {
      console.log('Summary generation already in progress');
      return;
    }
    
    isSummaryGenerating = true;
    
    if (transcripts.size === 0) {
      alert('No transcripts available to summarize');
      isSummaryGenerating = false;
      return;
    }
    
    // Show a generating overlay
    const overlay = document.createElement('div');
    overlay.className = 'app-exit-overlay';
    overlay.innerHTML = '<div class="exit-message">Generating call summary, please wait...</div>';
    document.body.appendChild(overlay);
    
    console.log('Preparing transcript data for summary...');
    
    // Create a combined transcript with all participants
    let allTranscripts = [];
    
    transcripts.forEach((entries, username) => {
      entries.forEach(entry => {
        allTranscripts.push({
          timestamp: entry.timestamp,
          username,
          text: entry.text
        });
      });
    });
    
    // Sort by timestamp
    allTranscripts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Log the transcript data 
    console.log(`Sending ${allTranscripts.length} transcript entries from ${transcripts.size} speakers for summary generation...`);
    transcripts.forEach((entries, speaker) => {
      console.log(`- ${speaker}: ${entries.length} entries`);
    });
    
    // Generate summary using GPT-4o
    const result = await window.electronAPI.generateCallSummary(allTranscripts);
    
    // Remove overlay
    document.body.removeChild(overlay);
    
    if (!result.success) {
      console.error('Failed to generate summary:', result.error);
      alert(`Error generating summary: ${result.error}`);
      isSummaryGenerating = false;
      return;
    }
    
    console.log('Call summary generated successfully!');
    
    // Save the summary to a file
    const roomName = currentRoom || 'unknown-room';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `call-summary-${roomName}-${timestamp}.txt`;
    
    const summaryContent = `CALL SUMMARY\n============\n\nRoom: ${roomName}\nDate: ${new Date().toLocaleString()}\nParticipants: ${Array.from(transcripts.keys()).join(', ')}\n\n${result.summary}`;
    
    // Create a Blob from the summary text
    const blob = new Blob([summaryContent], { type: 'text/plain' });
    
    // Create a link to download the file
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append the link to the body
    document.body.appendChild(link);
    
    // Click the link to download the file
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    isSummaryGenerating = false;
    return result.summary;
  } catch (error) {
    console.error('Error generating call summary:', error);
    alert(`Error generating summary: ${error.message}`);
    isSummaryGenerating = false;
    throw error;
  }
}

// Function to handle application exit
function handleAppExit() {
  // Just do some basic cleanup before quitting
  console.log('App closing, cleaning up connections...');
  
  try {
    // Clean up connections
    for (const peerId of Object.keys(peerConnections)) {
      cleanupPeerConnection(peerId);
    }
    
    // Stop local media
    stopLocalMedia();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  // Don't need to quit explicitly since Electron will handle closing the window
}

// Toggle settings popup
function toggleSettingsPopup() {
  settingsPopup.classList.toggle('hidden');
  
  // If opening the popup, initialize settings
  if (!settingsPopup.classList.contains('hidden')) {
    // Initialize device selectors
    enumerateDevices();
    
    // Initialize API key input
    initializeApiKeySettings();
  }
}

// Update audio threshold on the main process
function updateAudioThreshold(value) {
  window.electronAPI.updateAudioThreshold(value)
    .then(() => {
      console.log(`Audio threshold updated to ${value}`);
    })
    .catch(error => {
      console.error('Error updating audio threshold:', error);
    });
}

// Device management functions
async function enumerateDevices() {
  try {
    console.log('Enumerating media devices...');
    
    // Request permissions first to ensure we can see device labels
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .catch(err => {
        console.warn('Could not get full media access, some device labels may not be visible', err);
        return navigator.mediaDevices.getUserMedia({ audio: true })
          .catch(audioErr => {
            console.warn('Could not get audio access either', audioErr);
          });
      });
    
    // Get devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Reset device lists
    availableDevices = {
      audioinput: [],
      audiooutput: [],
      videoinput: []
    };
    
    // Sort devices by kind
    devices.forEach(device => {
      if (availableDevices[device.kind]) {
        availableDevices[device.kind].push(device);
      }
    });
    
    console.log('Available devices:', availableDevices);
    
    // Update device selection dropdowns
    updateDeviceSelectors();
    
    // Select default devices if none selected
    if (!selectedMicrophoneId && availableDevices.audioinput.length > 0) {
      selectedMicrophoneId = availableDevices.audioinput[0].deviceId;
    }
    
    if (!selectedWebcamId && availableDevices.videoinput.length > 0) {
      selectedWebcamId = availableDevices.videoinput[0].deviceId;
    }
    
    if (!selectedSpeakerId && availableDevices.audiooutput.length > 0) {
      selectedSpeakerId = availableDevices.audiooutput[0].deviceId;
    }
  } catch (error) {
    console.error('Error enumerating devices:', error);
  }
}

function updateDeviceSelectors() {
  // Update microphone dropdown
  microphoneSelect.innerHTML = '';
  
  availableDevices.audioinput.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Microphone ${device.deviceId.substring(0, 5)}`;
    microphoneSelect.appendChild(option);
  });
  
  if (selectedMicrophoneId) {
    microphoneSelect.value = selectedMicrophoneId;
  }
  
  // Update webcam dropdown
  webcamSelect.innerHTML = '';
  
  availableDevices.videoinput.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Camera ${device.deviceId.substring(0, 5)}`;
    webcamSelect.appendChild(option);
  });
  
  if (selectedWebcamId) {
    webcamSelect.value = selectedWebcamId;
  }
  
  // Update speaker dropdown
  speakerSelect.innerHTML = '';
  
  availableDevices.audiooutput.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `Speaker ${device.deviceId.substring(0, 5)}`;
    speakerSelect.appendChild(option);
  });
  
  if (selectedSpeakerId) {
    speakerSelect.value = selectedSpeakerId;
  }
}

async function applyDeviceSelection() {
  try {
    console.log(`Applying device selection: microphone=${selectedMicrophoneId}, webcam=${selectedWebcamId}, speaker=${selectedSpeakerId}`);
    
    // Store original state before modifications
    const originalVideoEnabled = isVideoEnabled;
    const originalAudioEnabled = isAudioEnabled;
    
    // Handle speaker changes - this doesn't require restarting streams
    if (selectedSpeakerId && typeof HTMLMediaElement.prototype.setSinkId !== 'undefined') {
      // Apply to all remote videos
      const remoteVideos = document.querySelectorAll('.remote-video');
      for (const video of remoteVideos) {
        try {
          await video.setSinkId(selectedSpeakerId);
        } catch (error) {
          console.error('Error setting audio output device for video element:', error);
        }
      }
      
      console.log(`Applied audio output device to ${remoteVideos.length} video elements`);
    } else if (selectedSpeakerId) {
      console.warn('setSinkId not supported by this browser');
    }
    
    // Only process video/audio changes if we already have a stream
    if (localStream) {
      const existingPeers = [...peerConnections.keys()];
      const oldStream = localStream;
      let microphoneChanged = false;
      let webcamChanged = false;
      
      // Handle microphone change if needed
      if (selectedMicrophoneId && isAudioEnabled) {
        try {
          // Only get audio with the new microphone
          const audioConstraints = {
            audio: {
              deviceId: { exact: selectedMicrophoneId }
            }
          };
          
          console.log('Getting new audio stream with constraints:', audioConstraints);
          
          // Get just the new audio stream
          const newAudioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
          
          // Replace the audio track in the existing stream
          const newAudioTrack = newAudioStream.getAudioTracks()[0];
          
          if (newAudioTrack) {
            // Replace track in all peer connections
            for (const [peerId, peerConnection] of peerConnections.entries()) {
              const senders = peerConnection.getSenders();
              const audioSender = senders.find(sender => 
                sender.track && sender.track.kind === 'audio'
              );
              
              if (audioSender) {
                console.log(`Replacing audio track for peer ${peerId}`);
                await audioSender.replaceTrack(newAudioTrack);
              }
            }
            
            // Stop old audio tracks
            oldStream.getAudioTracks().forEach(track => {
              track.stop();
            });
            
            // Add the new audio track to our local stream
            // First remove existing audio tracks
            const existingAudioTracks = localStream.getAudioTracks();
            existingAudioTracks.forEach(track => {
              localStream.removeTrack(track);
            });
            
            // Then add the new one
            localStream.addTrack(newAudioTrack);
            
            microphoneChanged = true;
            console.log('Successfully replaced audio track');
            
            // Restart media recording with new audio track
            if (isAudioEnabled) {
              stopMediaRecording();
              setupMediaRecording();
            }
          }
        } catch (error) {
          console.error('Error getting new audio stream:', error);
          alert(`Could not access the selected microphone: ${error.message}`);
          // This shouldn't affect video if it fails
        }
      }
      
      // Handle webcam change if needed
      if (selectedWebcamId && isVideoEnabled) {
        try {
          // Only get video with the new webcam
          const videoConstraints = {
            video: {
              deviceId: { exact: selectedWebcamId },
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          };
          
          console.log('Getting new video stream with constraints:', videoConstraints);
          
          // Get just the new video stream
          const newVideoStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
          
          // Replace the video track in the existing stream
          const newVideoTrack = newVideoStream.getVideoTracks()[0];
          
          if (newVideoTrack) {
            // Replace track in all peer connections
            for (const [peerId, peerConnection] of peerConnections.entries()) {
              const senders = peerConnection.getSenders();
              const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
              );
              
              if (videoSender) {
                console.log(`Replacing video track for peer ${peerId}`);
                await videoSender.replaceTrack(newVideoTrack);
              }
            }
            
            // Stop old video tracks
            oldStream.getVideoTracks().forEach(track => {
              track.stop();
            });
            
            // Add the new video track to our local stream
            // First remove existing video tracks
            const existingVideoTracks = localStream.getVideoTracks();
            existingVideoTracks.forEach(track => {
              localStream.removeTrack(track);
            });
            
            // Then add the new one
            localStream.addTrack(newVideoTrack);
            
            webcamChanged = true;
            console.log('Successfully replaced video track');
          }
        } catch (error) {
          console.error('Error getting new video stream:', error);
          alert(`Could not access the selected webcam: ${error.message}`);
          // This shouldn't affect audio if it fails
        }
      }
      
      // Update local video display if either stream changed
      if ((microphoneChanged || webcamChanged) && localVideo) {
        localVideo.srcObject = localStream;
      }
      
      // Update UI to reflect current state
      toggleVideoButton.classList.toggle('control-btn-active', isVideoEnabled);
      toggleAudioButton.classList.toggle('control-btn-active', isAudioEnabled);
    } else {
      console.warn('No local stream exists, device selection will be applied when stream is initialized');
    }
  } catch (error) {
    console.error('Unexpected error in applyDeviceSelection:', error);
    alert(`Unexpected error in device selection: ${error.message}`);
  }
}

function setupDataChannel(peerId, channel) {
  // Store channel in our map
  dataChannels.set(peerId, channel);
  
  channel.onopen = () => {
    console.log(`Data channel to peer ${peerId} opened`);
    // Send our media state when the channel opens
    sendMediaStateViaDataChannel(channel);
  };
  
  channel.onclose = () => {
    console.log(`Data channel to peer ${peerId} closed`);
    dataChannels.delete(peerId);
  };
  
  channel.onerror = (error) => {
    console.error(`Data channel error with peer ${peerId}:`, error);
  };
  
  channel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleDataChannelMessage(peerId, message);
    } catch (error) {
      console.error(`Error parsing data channel message from ${peerId}:`, error);
    }
  };
}

// Check authentication state on startup
async function checkAuthState() {
  try {
    const result = await window.electronAPI.getCurrentUser();
    if (result.success && result.user) {
      currentUser = result.user;
      updateAuthState(result.user);
      
      // Hide auth screen and show main app
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      
      // Set username for video chat
      usernameInput.value = result.user.handle;
      
      // Load saved settings
      loadSettings();
      
      // Enumerate devices
      enumerateDevices();
    } else {
      // No valid session, show auth screen
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    // On error, show auth screen
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
  }
}

// Update UI based on auth state
function updateAuthState(user) {
  currentUser = user;
  
  if (user) {
    // User is signed in, show main app
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    
    // Update user info in the settings page
    if (userDidDisplay) {
      userDidDisplay.innerHTML = `DID: <span>${user.did || 'Not available'}</span>`;
    }
    
    if (userHandleDisplay) {
      userHandleDisplay.innerHTML = `Handle: <span>${user.handle || 'Not available'}</span>`;
    }
    
    // Show gatekeeper page for first-time users
    // In a real app, you might check if this is the first login
    const isFirstLogin = sessionStorage.getItem('hasLoggedInBefore') !== 'true';
    if (isFirstLogin) {
      // First login, show gatekeeper page
      navBtns.forEach(btn => btn.classList.remove('active'));
      appPages.forEach(page => page.classList.remove('active'));
      
      const gatekeeperBtn = document.querySelector('.nav-btn[data-page="gatekeeper"]');
      if (gatekeeperBtn) gatekeeperBtn.classList.add('active');
      
      const gatekeeperPage = document.getElementById('gatekeeper-page');
      if (gatekeeperPage) gatekeeperPage.classList.add('active');
      
      // Set flag in session storage
      sessionStorage.setItem('hasLoggedInBefore', 'true');
    } else {
      // Not first login, show default page (video-call)
      navBtns.forEach(btn => btn.classList.remove('active'));
      appPages.forEach(page => page.classList.remove('active'));
      
      const videoCallBtn = document.querySelector('.nav-btn[data-page="video-call"]');
      if (videoCallBtn) videoCallBtn.classList.add('active');
      
      const videoCallPage = document.getElementById('video-call-page');
      if (videoCallPage) videoCallPage.classList.add('active');
    }
  } else {
    // User is signed out, show auth screen
    authScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
    
    // Clear form fields and errors
    signinIdInput.value = '';
    signinPasswordInput.value = '';
    signinError.textContent = '';
    
    signupHandleInput.value = '';
    signupEmailInput.value = '';
    signupPasswordInput.value = '';
    signupPasswordConfirmInput.value = '';
    signupError.textContent = '';
  }
}

// Handle sign in
async function handleSignIn(event) {
  event.preventDefault();
  
  // Clear previous errors
  signinError.textContent = '';
  
  // Validate inputs
  const identifier = signinIdInput.value.trim();
  const password = signinPasswordInput.value.trim();
  const rememberMe = document.getElementById('remember-me').checked;
  
  if (!identifier) {
    signinError.textContent = 'Please enter your username or email';
    return;
  }
  
  if (!password) {
    signinError.textContent = 'Please enter your password';
    return;
  }
  
  // Show loading state
  signinBtn.disabled = true;
  signinBtn.textContent = 'Signing in...';
  
  try {
    // Format identifier if needed (ensure it has a domain)
    let formattedIdentifier = identifier;
    if (!identifier.includes('@') && !identifier.includes('.')) {
      formattedIdentifier = `${identifier}.pds.hapa.ai`;
    }
    
    // Call API to sign in
    const response = await window.electronAPI.signIn(formattedIdentifier, password);
    
    if (response.success) {
      // Sign in successful
      updateAuthState(response.user);
      
      // Save credentials if "Remember Me" is checked
      if (rememberMe) {
        saveCredentials(identifier, password);
      } else {
        clearCredentials();
      }
    } else {
      // Sign in failed
      signinError.textContent = response.error || 'Failed to sign in';
    }
  } catch (error) {
    console.error('Error signing in:', error);
    signinError.textContent = error.message || 'An error occurred while signing in';
  } finally {
    // Reset button state
    signinBtn.disabled = false;
    signinBtn.textContent = 'Sign In';
  }
}

// Handle sign up
async function handleSignUp(event) {
  event.preventDefault();
  
  // Clear previous errors
  signupError.textContent = '';
  
  // Validate inputs
  let handle = signupHandleInput.value.trim();
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value.trim();
  const passwordConfirm = signupPasswordConfirmInput.value.trim();
  
  if (!handle) {
    signupError.textContent = 'Please enter a username';
    return;
  }
  
  // Format handle if needed
  if (handle.includes('.pds.hapa.ai')) {
    // Handle already has the domain, keep it as is
  } else if (handle.includes('.')) {
    signupError.textContent = 'Username can only contain letters, numbers, and underscores';
    return;
  } else {
    // No domain, will be added by the backend (as .pds.hapa.ai)
  }
  
  if (!email) {
    signupError.textContent = 'Please enter your email';
    return;
  }
  
  if (!isValidEmail(email)) {
    signupError.textContent = 'Please enter a valid email address';
    return;
  }
  
  if (!password) {
    signupError.textContent = 'Please enter a password';
    return;
  }
  
  if (password.length < 8) {
    signupError.textContent = 'Password must be at least 8 characters';
    return;
  }
  
  if (password !== passwordConfirm) {
    signupError.textContent = 'Passwords do not match';
    return;
  }
  
  // Show loading state
  signupBtn.disabled = true;
  signupBtn.textContent = 'Signing up...';
  
  try {
    // Call API to sign up
    const response = await window.electronAPI.signUp(handle, email, password);
    
    if (response.success) {
      // Sign up successful
      updateAuthState(response.user);
    } else {
      // Sign up failed
      signupError.textContent = response.error || 'Failed to sign up';
    }
  } catch (error) {
    console.error('Error signing up:', error);
    signupError.textContent = error.message || 'An error occurred while signing up';
  } finally {
    // Reset button state
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
}

// Handle sign out
async function handleSignOut() {
  try {
    const result = await window.electronAPI.signOut();
    if (result.success) {
      // Clear current user
      currentUser = null;
      
      // Clear auth state
      updateAuthState(null);
      
      // Clear saved credentials
      clearCredentials();
      
      // Show auth screen and hide main app
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
      
      // Clear username input
      usernameInput.value = '';
      
      // Clear room input
      roomInput.value = generateDefaultRoomId();
      
      // Clear any active connections
      try {
        // Leave room if we're in one
        await leaveRoom();
      } catch (err) {
        console.warn('Error leaving room during sign out:', err);
      }
      
      // Clear any active screen sharing
      if (isScreenSharing) {
        stopScreenSharing();
      }
      
      // Clear any active video recording
      if (isRecording) {
        stopVideoRecording();
      }
      
      // Clear any active transcripts
      transcripts.clear();
      
      // Clear any active messages
      document.getElementById('messages').innerHTML = '';
      
      // Clear any active remote videos
      document.getElementById('remote-videos').innerHTML = '';
      
      // Reset connection count
      updateConnectionCount();
      
      // Add system message
      addSystemMessage('Signed out successfully');
    }
  } catch (error) {
    console.error('Error signing out:', error);
    addSystemMessage(`Error signing out: ${error.message}`);
  }
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Toggle video recording
function toggleVideoRecording() {
  if (isVideoRecording) {
    stopVideoRecording();
    recordVideoButton.textContent = 'Record Video';
    addSystemMessage('Video recording stopped');
  } else {
    startVideoRecording();
    recordVideoButton.textContent = 'Stop Recording';
    addSystemMessage('Video recording started');
  }
}

// Start recording the video call
function startVideoRecording() {
  // Check if we have the necessary streams and reset the collections
  if (!localStream) {
    addSystemMessage('Cannot start recording: No local stream available');
    return;
  }
  
  try {
    console.log('Starting video call recording');
    recordingStartTime = Date.now();
    videoRecordedChunks = [];
    recordedChatMessages = [];
    recordedTranscripts = [];
    
    // Start tracking chat messages during recording
    messagesContainer.querySelectorAll('.message').forEach(msgEl => {
      const username = msgEl.querySelector('.message-username')?.textContent;
      const text = msgEl.querySelector('.message-text')?.textContent;
      const timestamp = parseInt(msgEl.dataset.timestamp || Date.now());
      
      if (username && text) {
        recordedChatMessages.push({
          username,
          text,
          timestamp
        });
      }
    });
    
    // Start tracking transcripts
    transcripts.forEach((entries, username) => {
      entries.forEach(entry => {
        recordedTranscripts.push({
          username,
          text: entry.text,
          timestamp: entry.timestamp
        });
      });
    });
    
    // Create a canvas for compositing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Make canvas and context globally accessible
    window.recordingCanvas = canvas;
    window.recordingCtx = ctx;
    
    // Set canvas size with higher resolution for better quality
    // Use 1080p resolution regardless of container size for better quality
    canvas.width = 1920;  // Full HD width
    canvas.height = 1080; // Full HD height
    
    console.log(`Recording canvas size set to ${canvas.width}x${canvas.height}`);
    
    // Create a MediaStream from the canvas
    const canvasStream = canvas.captureStream(30); // 30 FPS
    
    // Add audio tracks from local and remote streams
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
    }
    
    // Add audio from all remote peers
    const remoteVideos = document.querySelectorAll('.remote-video');
    remoteVideos.forEach(video => {
      if (video.srcObject) {
        const audioTracks = video.srcObject.getAudioTracks();
        if (audioTracks.length > 0) {
          try {
            canvasStream.addTrack(audioTracks[0]);
            console.log('Added remote audio track to recording');
          } catch (e) {
            console.warn('Could not add remote audio track to recording:', e);
          }
        }
      }
    });
    
    // Add screen share audio if present
    if (screenShareStream && screenShareStream.getAudioTracks().length > 0) {
      try {
        canvasStream.addTrack(screenShareStream.getAudioTracks()[0]);
        console.log('Added screen share audio to recording');
      } catch (e) {
        console.warn('Could not add screen share audio to recording:', e);
      }
    }
    
    // Create MediaRecorder for the combined stream
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    videoRecorder = new MediaRecorder(canvasStream, options);
    
    // Handle data available event
    videoRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        videoRecordedChunks.push(event.data);
        console.log(`Recorded video chunk: ${event.data.size} bytes`);
      }
    };
    
    // Start the recorder
    videoRecorder.start(1000); // Collect chunks every second
    isVideoRecording = true;
    
    // Set up rendering loop
    function renderFrame() {
      if (!isVideoRecording) return;
      
      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // NEW LAYOUT: 
      // - Videos grid on the left (70% width)
      // - Chat and transcript on the right (30% width)
      const videoAreaWidth = Math.floor(canvas.width * 0.7);
      const chatAreaX = videoAreaWidth;
      const chatAreaWidth = canvas.width - videoAreaWidth;
      
      // Draw local video - position at the top left of the video area
      if (localVideo.srcObject && localVideo.videoWidth > 0) {
        // Calculate aspect ratio preserving dimensions
        const aspectRatio = localVideo.videoWidth / localVideo.videoHeight;
        const maxWidth = Math.floor(videoAreaWidth * 0.45);
        const maxHeight = Math.floor(canvas.height * 0.3);
        
        // Calculate dimensions that preserve aspect ratio
        let width = maxWidth;
        let height = width / aspectRatio;
        
        // If height exceeds max height, adjust width accordingly
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
        
        // Center in allocated space
        const x = 10 + Math.floor((maxWidth - width) / 2);
        const y = 10 + Math.floor((maxHeight - height) / 2);
        
        const localVideoRect = { 
          x: x, 
          y: y, 
          width: width, 
          height: height 
        };
        
        ctx.drawImage(
          localVideo, 
          localVideoRect.x, 
          localVideoRect.y, 
          localVideoRect.width, 
          localVideoRect.height
        );
        
        // Add border
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 3;
        ctx.strokeRect(
          localVideoRect.x, 
          localVideoRect.y, 
          localVideoRect.width, 
          localVideoRect.height
        );
        
        // Add username with better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(
          localVideoRect.x, 
          localVideoRect.y + localVideoRect.height - 30,
          localVideoRect.width,
          30
        );
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(
          currentUser ? currentUser.handle : 'You', 
          localVideoRect.x + 10, 
          localVideoRect.y + localVideoRect.height - 10
        );
      }
      
      // Draw screen share if active - place it prominently
      if (activeScreenSharePeerId && screenVideoElement && screenVideoElement.srcObject && screenVideoElement.videoWidth > 0) {
        // Calculate a good size for the screen share - make it larger and prominent
        const sharedScreenMaxWidth = Math.floor(videoAreaWidth * 0.9);
        const sharedScreenMaxHeight = Math.floor(canvas.height * 0.4);
        
        // Calculate dimensions preserving aspect ratio
        const aspectRatio = screenVideoElement.videoWidth / screenVideoElement.videoHeight;
        let width = sharedScreenMaxWidth;
        let height = width / aspectRatio;
        
        // If height is too large, adjust
        if (height > sharedScreenMaxHeight) {
          height = sharedScreenMaxHeight;
          width = height * aspectRatio;
        }
        
        // Position at the bottom of the video area
        const x = Math.floor((videoAreaWidth - width) / 2);
        const y = canvas.height - height - 20;
        
        // Draw the screen
        ctx.drawImage(screenVideoElement, x, y, width, height);
        
        // Add border
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        
        // Add label
        const username = activeScreenSharePeerId === ownPeerId 
          ? 'Your Screen' 
          : `${peerUsernames.get(activeScreenSharePeerId) || 'Peer'}'s Screen`;
        
        // Add background for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = 'bold 18px Arial';
        const textWidth = ctx.measureText(username).width + 20;
        ctx.fillRect(x, y - 30, textWidth, 30);
        
        // Add text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(username, x + 10, y - 10);
      }
      
      // Draw remote videos in a grid layout
      const remoteVideos = document.querySelectorAll('.remote-video');
      const maxRemotesPerRow = 2;
      const maxRemoteWidth = Math.floor(videoAreaWidth * 0.45);
      const maxRemoteHeight = Math.floor(canvas.height * 0.3);
      
      remoteVideos.forEach((video, index) => {
        if (video.srcObject && video.videoWidth > 0) {
          const row = Math.floor(index / maxRemotesPerRow);
          const col = index % maxRemotesPerRow;
          
          // Alternate positioning for even distribution
          let baseX = (col * maxRemoteWidth) + ((col + 1) * 10);
          if (col === 1) baseX = videoAreaWidth - maxRemoteWidth - 10;
          
          const baseY = (row * maxRemoteHeight) + ((row + 1) * 10) + (row > 0 ? 10 : 0);
          
          // Calculate aspect ratio preserving dimensions
          const aspectRatio = video.videoWidth / video.videoHeight;
          
          // Calculate dimensions that preserve aspect ratio
          let width = maxRemoteWidth;
          let height = width / aspectRatio;
          
          // If height exceeds max height, adjust width accordingly
          if (height > maxRemoteHeight) {
            height = maxRemoteHeight;
            width = height * aspectRatio;
          }
          
          // Center in allocated space
          const x = baseX + Math.floor((maxRemoteWidth - width) / 2);
          const y = baseY + Math.floor((maxRemoteHeight - height) / 2);
          
          ctx.drawImage(video, x, y, width, height);
          
          // Add border
          ctx.strokeStyle = '#9e9e9e';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);
          
          // Add username with better visibility
          const container = video.closest('.remote-video-container');
          if (container) {
            const name = container.querySelector('.participant-name')?.textContent || 'Peer';
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(
              x,
              y + height - 30,
              width,
              30
            );
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(name, x + 10, y + height - 10);
          }
        }
      });
      
      // Draw chat & transcript area with background
      ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
      ctx.fillRect(chatAreaX, 0, chatAreaWidth, canvas.height);
      
      // Title for the chat section
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('Chat Messages', chatAreaX + 20, 40);
      
      // Draw chat messages vertically on the right side
      const messagesToShow = [...recordedChatMessages].sort((a, b) => 
        b.timestamp - a.timestamp
      ).slice(0, 10).reverse();
      
      if (messagesToShow.length > 0) {
        ctx.font = '16px Arial';
        
        messagesToShow.forEach((msg, index) => {
          const y = 80 + (index * 45);
          const date = new Date(msg.timestamp);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          // Draw time
          ctx.fillStyle = '#999999';
          ctx.fillText(timeStr, chatAreaX + 20, y);
          
          // Draw username
          ctx.fillStyle = '#4db6ac';
          ctx.font = 'bold 16px Arial';
          ctx.fillText(`${msg.username}:`, chatAreaX + 20, y + 20);
          
          // Draw message with word wrap
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px Arial';
          
          const maxWidth = chatAreaWidth - 40;
          const words = msg.text.split(' ');
          let line = '';
          let lineY = y + 20;
          
          words.forEach(word => {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, chatAreaX + 120, lineY);
              line = word;
              lineY += 20;
            } else {
              line = testLine;
            }
          });
          
          ctx.fillText(line, chatAreaX + 120, lineY);
        });
      } else {
        ctx.fillStyle = '#999999';
        ctx.font = '16px Arial';
        ctx.fillText('No chat messages yet', chatAreaX + 20, 80);
      }
      
      // Title for the transcript section
      ctx.fillStyle = '#2196F3';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('Recent Transcripts', chatAreaX + 20, canvas.height / 2);
      
      // Draw recent transcripts
      const recentTranscripts = [...recordedTranscripts]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
        .reverse();
      
      if (recentTranscripts.length > 0) {
        ctx.font = '16px Arial';
        
        recentTranscripts.forEach((transcript, index) => {
          const y = (canvas.height / 2) + 40 + (index * 60);
          const date = new Date(transcript.timestamp);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          // Skip if transcript is just noise (less than 3 characters)
          if (transcript.text.trim().length < 3) return;
          
          // Draw time
          ctx.fillStyle = '#999999';
          ctx.fillText(timeStr, chatAreaX + 20, y);
          
          // Draw username
          ctx.fillStyle = '#64b5f6';
          ctx.font = 'bold 16px Arial';
          ctx.fillText(`${transcript.username}:`, chatAreaX + 20, y + 20);
          
          // Draw transcript with word wrap
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px Arial';
          
          const maxWidth = chatAreaWidth - 40;
          const words = transcript.text.split(' ');
          let line = '';
          let lineY = y + 20;
          
          words.forEach(word => {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, chatAreaX + 110, lineY);
              line = word;
              lineY += 20;
            } else {
              line = testLine;
            }
          });
          
          ctx.fillText(line, chatAreaX + 110, lineY);
        });
      } else {
        ctx.fillStyle = '#999999';
        ctx.font = '16px Arial';
        ctx.fillText('No transcripts yet', chatAreaX + 20, (canvas.height / 2) + 40);
      }
      
      // Request next frame
      requestAnimationFrame(renderFrame);
    }
    
    // Set the global renderFrame reference to our new function
    window.renderFrame = renderFrame;
    
    // Start render loop
    renderFrame();
    
    return true;
  } catch (error) {
    console.error('Error starting video recording:', error);
    addSystemMessage(`Error starting recording: ${error.message}`);
    isVideoRecording = false;
    return false;
  }
}

// Stop recording the video call
function stopVideoRecording() {
  if (!isVideoRecording || !videoRecorder) {
    return;
  }
  
  try {
    console.log('Stopping video recording');
    
    // Stop the recorder
    videoRecorder.stop();
    isVideoRecording = false;
    
    // Handle the recorded data
    videoRecorder.onstop = () => {
      console.log(`Recording stopped with ${videoRecordedChunks.length} chunks`);
      
      if (videoRecordedChunks.length === 0) {
        addSystemMessage('No video data was captured.');
        return;
      }
      
      // Create a blob from the recorded chunks
      const blob = new Blob(videoRecordedChunks, { type: 'video/webm' });
      
      // Save the video file and metadata
      saveRecordedVideo(blob);
    };
  } catch (error) {
    console.error('Error stopping video recording:', error);
    addSystemMessage(`Error stopping recording: ${error.message}`);
  }
}

// Save recorded video with metadata
function saveRecordedVideo(videoBlob) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const roomName = currentRoom || 'unknown-room';
    
    // Create metadata with chat and transcript
    const metadata = {
      roomName,
      startTime: recordingStartTime,
      endTime: Date.now(),
      participants: Array.from(peerUsernames.values()).concat(currentUser ? [currentUser.handle] : ['You']),
      chatMessages: recordedChatMessages,
      transcripts: recordedTranscripts
    };
    
    // Save metadata as JSON
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metadataUrl = URL.createObjectURL(metadataBlob);
    const metadataLink = document.createElement('a');
    metadataLink.href = metadataUrl;
    metadataLink.download = `meeting-metadata-${roomName}-${timestamp}.json`;
    
    // Save video
    const videoUrl = URL.createObjectURL(videoBlob);
    const videoLink = document.createElement('a');
    videoLink.href = videoUrl;
    videoLink.download = `meeting-recording-${roomName}-${timestamp}.webm`;
    
    // Trigger downloads
    document.body.appendChild(videoLink);
    videoLink.click();
    document.body.removeChild(videoLink);
    
    document.body.appendChild(metadataLink);
    metadataLink.click();
    document.body.removeChild(metadataLink);
    
    // Clean up URLs
    URL.revokeObjectURL(videoUrl);
    URL.revokeObjectURL(metadataUrl);
    
    addSystemMessage('Video recording saved successfully.');
  } catch (error) {
    console.error('Error saving video recording:', error);
    addSystemMessage(`Error saving recording: ${error.message}`);
  }
}

// Intercept chat messages to record them during video recording
const originalAddMessageToUI = addMessageToUI;
addMessageToUI = function(messageData) {
  // Call the original function
  originalAddMessageToUI(messageData);
  
  // If we're recording, also add to recorded messages
  if (isVideoRecording && messageData.username && messageData.message) {
    recordedChatMessages.push({
      username: messageData.username,
      text: messageData.message,
      timestamp: messageData.timestamp || Date.now()
    });
  }
};

// Intercept transcripts to record them during video recording
const originalUpdateTranscription = updateTranscription;
updateTranscription = function(speaker, text) {
  // Skip empty text
  if (!text || text.trim().length === 0) {
    console.log(`Skipping empty transcription from ${speaker}`);
    return;
  }
  
  // Hard block specific exact phrases and patterns regardless of other factors
  const exactBlockPatterns = [
    // Simple standalone phrases (case insensitive)
    /^you\.?$/i, 
    /^thank you\.?$/i,
    /^thanks\.?$/i, 
    /^bye\.?$/i, 
    /^bye bye\.?$/i, 
    /^goodbye\.?$/i,
    /^hello\.?$/i, 
    /^hi\.?$/i, 
    /^hey\.?$/i,
    /^um\.?$/i, 
    /^uh\.?$/i, 
    /^okay\.?$/i, 
    /^ok\.?$/i,
    
    // Common phrases with punctuation variations
    /^thank you(?:\.|\!|\s+)?$/i,
    /^thanks for (?:subscribing|watching|listening)(?:\.|\!|\s+)?$/i,
    /^(?:please|don't forget to) (?:subscribe|like|follow)(?:\.|\!|\s+)?$/i,
    /^see you (?:later|next time|soon)(?:\.|\!|\s+)?$/i,
    
    // Combinations of these phrases
    /^thank you,? bye(?:\.|\!|\s+)?$/i, 
    /^bye(?:\s+bye)+(?:\.|\!|\s+)?$/i,
    
    // Punctuation only patterns
    /^[\.\s,!?]+$/,
    
    // Common background noise misinterpretations
    /^(?:mm+|hmm+|uh+|ah+)(?:\.|\!|\s+)?$/i
  ];
  
  // Check against our exact hard block patterns
  for (const pattern of exactBlockPatterns) {
    if (pattern.test(text.trim())) {
      console.log(`Hard blocked exact pattern match: "${text}" from ${speaker}`);
      return;
    }
  }
  
  // Check for phrases containing specific substrings when they're short
  // Only apply to short phrases (<25 chars) to avoid filtering meaningful content
  if (text.length < 25) {
    const blockSubstrings = [
      "thank you", "thanks for", "bye bye", "goodbye", 
      "please subscribe", "don't forget to", "like and subscribe",
      "see you next time", "see you later"
    ];
    
    const lowerText = text.toLowerCase();
    for (const substring of blockSubstrings) {
      if (lowerText.includes(substring)) {
        console.log(`Hard blocked substring match: "${text}" (contains "${substring}") from ${speaker}`);
        return;
      }
    }
  }
  
  // Additional filter for common background noise misinterpretations
  // That might not be caught by exact patterns
  if (text.length < 15) {
    const noisePattern = /^(?:\s*[a-z\s]{1,3}){1,4}\.?$/i;
    if (noisePattern.test(text)) {
      console.log(`Blocked likely noise pattern: "${text}" from ${speaker}`);
      return;
    }
  }
  
  // DIRECT EXCLUSION - remove these regardless of context
  const directExcludeWords = ["you", "thank", "thanks", "bye", "yeah", "okay", "ok", "hello", "hi", "hey"];
  
  // If transcript is short (< 8 chars) and consists ONLY of excluded words, block it
  if (text.length < 8) {
    const words = text.toLowerCase().replace(/[.,!?;:"']/g, '').trim().split(/\s+/);
    if (words.every(word => directExcludeWords.includes(word))) {
      console.log(`Blocked short text with only excluded words: "${text}" from ${speaker}`);
      return;
    }
  }
  
  // Last-resort basic check to filter out very short nonsense
  if (text.trim().length <= 2) {
    console.log(`Blocked extremely short text: "${text}" from ${speaker}`);
    return;
  }
  
  // Call the original function for valid transcriptions
  originalUpdateTranscription(speaker, text);
  
  // If we're recording, also add to recorded transcripts
  if (isVideoRecording && speaker && text) {
    recordedTranscripts.push({
      username: speaker,
      text: text,
      timestamp: new Date().toISOString()
    });
  }
};

// Handle screen share button click
async function handleScreenShareClick() {
  try {
    // If already sharing, stop sharing
    if (isScreenSharing) {
      stopScreenSharing();
      return;
    }
    
    // No longer checking if someone else is already sharing - we allow multiple shares
    
    // Get screen sources from main process
    const result = await window.electronAPI.getScreenSources();
    
    if (!result.success || !result.sources || result.sources.length === 0) {
      throw new Error(result.error || 'No screen sources available');
    }
    
    // Clear previous sources
    screenShareSources.innerHTML = '';
    
    // Add sources to the dialog
    result.sources.forEach(source => {
      const sourceItem = document.createElement('div');
      sourceItem.className = 'screen-source-item';
      sourceItem.innerHTML = `
        <img src="${source.thumbnail}" alt="${source.name}" class="source-thumbnail">
        <div class="source-name">${source.name}</div>
      `;
      
      // Click handler for selection
      sourceItem.addEventListener('click', () => {
        // Hide the selection dialog
        screenShareDialog.classList.add('hidden');
        
        // Start screen sharing for this source
        startScreenSharing(source.id, source.name);
      });
      
      screenShareSources.appendChild(sourceItem);
    });
    
    // Show the selection dialog
    screenShareDialog.classList.remove('hidden');
  } catch (error) {
    console.error('Error preparing screen share:', error);
    addSystemMessage(`Error preparing screen share: ${error.message}`);
  }
}

// Start screen sharing for the selected source
async function startScreenSharing(sourceId, sourceName) {
  try {
    // No longer checking if anyone else is already sharing - we allow multiple shares
    
    console.log(`Starting screen sharing for source: ${sourceName} (${sourceId})`);
    
    // Get the screen share stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080
        }
      }
    });
    
    // Save the stream
    screenShareStream = stream;
    isScreenSharing = true;
    activeScreenSharePeerId = ownPeerId;
    
    // Update UI
    shareScreenButton.querySelector('.icon').textContent = '⏹️';
    addSystemMessage(`Screen sharing started: ${sourceName}`);
    
    // Add screen to the video grid as a completely separate element
    addScreenShareToGrid(ownPeerId, screenShareStream, sourceName);
    
    // Send screen stream to all peers as a separate ADDITIONAL track
    // This ensures it doesn't replace the video track
    for (const [peerId, connection] of peerConnections.entries()) {
      try {
        // Get screen track
        const screenTrack = screenShareStream.getVideoTracks()[0];
        
        // Create a new independent stream for the screen track only
        const screenOnlyStream = new MediaStream();
        screenOnlyStream.addTrack(screenTrack);
        
        // Create a unique transceiver for the screen track
        // This ensures it's treated as a completely separate stream
        const transceiverInit = { 
          direction: 'sendonly',
          sendEncodings: [
            {
              maxBitrate: 3000000,
              maxFramerate: 30
            }
          ],
          streams: [screenOnlyStream]
        };
        
        // Add as a completely separate track with a dedicated transceiver
        const transceiver = connection.addTransceiver(screenTrack, transceiverInit);
        
        // Store the transceiver reference for later cleanup
        if (!connection._screenTransceivers) {
          connection._screenTransceivers = [];
        }
        connection._screenTransceivers.push(transceiver);
        
        console.log(`Added screen track to peer connection: ${peerId} as a completely independent track`);
      } catch (error) {
        console.error(`Error adding screen track to peer ${peerId}:`, error);
      }
    }
    
    // Listen for the screen share to end (user stops sharing)
    screenShareStream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenSharing();
    });
    
    // Notify peers that screen sharing has started
    sendControlMessage({
      type: 'screen-share-started',
      username: currentUser ? currentUser.handle : 'You',
      sourceName
    });
  } catch (error) {
    console.error('Error starting screen share:', error);
    addSystemMessage(`Error starting screen share: ${error.message}`);
  }
}

// Stop screen sharing
function stopScreenSharing() {
  if (!isScreenSharing || !screenShareStream) return;
  
  try {
    console.log('Stopping screen sharing');
    
    // Stop all tracks
    screenShareStream.getTracks().forEach(track => {
      track.stop();
    });
    
    // Remove screen tracks from peer connections
    for (const [peerId, connection] of peerConnections.entries()) {
      try {
        // Clean up transceivers (newer approach)
        if (connection._screenTransceivers && connection._screenTransceivers.length > 0) {
          console.log(`Removing ${connection._screenTransceivers.length} screen transceivers from peer ${peerId}`);
          
          // Stop each screen transceiver
          connection._screenTransceivers.forEach(transceiver => {
            try {
              // Check if the transceiver is not stopped before trying to stop it
              if (transceiver.direction !== 'stopped') {
                transceiver.stop();
              }
              
              // Only replace track if the sender exists and is not stopped
              if (transceiver.sender && transceiver.sender.track) {
                transceiver.sender.replaceTrack(null);
              }
            } catch (e) {
              console.warn(`Error stopping screen transceiver from peer ${peerId}:`, e);
            }
          });
          
          connection._screenTransceivers = [];
        }
        
        // Also clean up older sender approach for backward compatibility
        if (connection._screenSenders && connection._screenSenders.length > 0) {
          console.log(`Removing ${connection._screenSenders.length} screen track senders from peer ${peerId}`);
          
          // Remove each screen track sender
          connection._screenSenders.forEach(sender => {
            try {
              connection.removeTrack(sender);
            } catch (e) {
              console.warn(`Error removing screen track sender from peer ${peerId}:`, e);
            }
          });
          
          connection._screenSenders = [];
        }
      } catch (error) {
        console.error(`Error cleaning up screen track for peer ${peerId}:`, error);
      }
    }
    
    // Reset state
    screenShareStream = null;
    isScreenSharing = false;
    
    // Update UI
    shareScreenButton.querySelector('.icon').textContent = '🖥️';
    addSystemMessage('Screen sharing stopped');
    
    // Remove screen share from the grid
    removeScreenShareFromGrid();
    
    // Notify peers that screen sharing has stopped
    sendControlMessage({
      type: 'screen-share-stopped',
      username: currentUser ? currentUser.handle : 'You'
    });
  } catch (error) {
    console.error('Error stopping screen share:', error);
    addSystemMessage(`Error stopping screen share: ${error.message}`);
  }
}

// Add screen share to the video grid
function addScreenShareToGrid(peerId, stream, sourceName) {
  // Check if a screen share container for this peer already exists
  const existingContainer = document.getElementById(`screen-share-${peerId}`);
  if (existingContainer) {
    // Just update the existing container with the new stream
    const videoElement = existingContainer.querySelector('video');
    if (videoElement) {
      videoElement.srcObject = stream;
      console.log(`Updated existing screen share for peer ${peerId}`);
    }
    return;
  }
  
  // Create screen share container
  const screenContainer = document.createElement('div');
  screenContainer.className = 'video-item screen-share-container';
  screenContainer.id = `screen-share-${peerId}`;
  
  // Create video element
  const screenVideo = document.createElement('video');
  screenVideo.className = 'screen-share-video';
  screenVideo.autoplay = true;
  screenVideo.playsInline = true;
  screenVideo.srcObject = stream;
  
  // Create info overlay
  const infoOverlay = document.createElement('div');
  infoOverlay.className = 'screen-share-info';
  infoOverlay.innerHTML = `
    <span class="screen-share-icon">🖥️</span>
    <span>${peerId === ownPeerId ? 'Your Screen' : `${peerUsernames.get(peerId) || 'Peer'}'s Screen`}: ${sourceName}</span>
  `;
  
  // Create fullscreen button
  const fullscreenButton = document.createElement('button');
  fullscreenButton.className = 'fullscreen-btn';
  fullscreenButton.innerHTML = '🔍';
  fullscreenButton.title = 'View in full screen';
  fullscreenButton.addEventListener('click', () => {
    openFullscreenView(stream, sourceName, peerId);
  });
  
  // Add elements to container
  screenContainer.appendChild(screenVideo);
  screenContainer.appendChild(infoOverlay);
  screenContainer.appendChild(fullscreenButton);
  
  // Add to video grid - insert at beginning for prominence
  const remoteVideosContainer = document.getElementById('remote-videos');
  if (remoteVideosContainer.firstChild) {
    remoteVideosContainer.insertBefore(screenContainer, remoteVideosContainer.firstChild);
  } else {
    remoteVideosContainer.appendChild(screenContainer);
  }
  
  console.log(`Added screen share grid element for peer ${peerId}`);
  
  // Store reference to the screen video element for this peer
  if (peerId === ownPeerId) {
    screenVideoElement = screenVideo;
  }
}

// Remove screen share from the grid
function removeScreenShareFromGrid() {
  // Find the screen container for the local user
  const screenContainer = document.getElementById(`screen-share-${ownPeerId}`);
  if (screenContainer) {
    screenContainer.remove();
  }
  
  // Also close the fullscreen view if it's open
  fullscreenDialog.classList.add('hidden');
}

// Open fullscreen view of shared screen
function openFullscreenView(stream, sourceName, peerId) {
  // Set video source
  fullscreenVideo.srcObject = stream;
  
  // Set title
  fullscreenTitle.textContent = `${peerId === ownPeerId ? 'Your Screen' : `${peerUsernames.get(peerId) || 'Peer'}'s Screen`}: ${sourceName}`;
  
  // Show dialog
  fullscreenDialog.classList.remove('hidden');
}

// Update handleDataChannelMessage to handle screen sharing control messages
const originalHandleDataChannelMessage = handleDataChannelMessage;
handleDataChannelMessage = function(peerId, message) {
  try {
    // Parse the message as JSON
    const data = JSON.parse(message);
    
    // Handle screen sharing messages
    if (data.type === 'screen-share-started') {
      console.log(`Peer ${peerId} started screen sharing: ${data.sourceName}`);
      addSystemMessage(`${data.username} started sharing their screen: ${data.sourceName}`);
      
      // We don't set global activeScreenSharePeerId anymore - each screen share is independent
      
      // Note: We don't need to do anything here because the actual screen share
      // stream will be received through the WebRTC connection and handled by onTrack
    } 
    else if (data.type === 'screen-share-stopped') {
      console.log(`Peer ${peerId} stopped screen sharing`);
      addSystemMessage(`${data.username} stopped sharing their screen`);
      
      // Remove the screen share from grid
      const screenContainer = document.getElementById(`screen-share-${peerId}`);
      if (screenContainer) {
        screenContainer.remove();
      }
    } 
    else {
      // For all other messages, pass to the original handler
      originalHandleDataChannelMessage(peerId, message);
    }
  } catch (error) {
    // If not a valid JSON message, pass to the original handler
    originalHandleDataChannelMessage(peerId, message);
  }
};

// Update the addTrack handler to detect incoming screen share tracks
const originalOnTrack = window.onTrack;
window.onTrack = function(event, peerId) {
  // Check if this is a screen sharing track
  if (event.streams && event.streams[0]) {
    const stream = event.streams[0];
    
    // Look for video tracks with specific settings that indicate screen sharing
    const videoTracks = stream.getVideoTracks();
    for (const track of videoTracks) {
      const settings = track.getSettings();
      
      // Screen share tracks typically have different aspect ratios and higher resolutions
      if (settings && 
          ((settings.width > 1000 && settings.height > 700) || 
           track.label.includes('screen') || 
           stream.id.includes('screen'))) {
        
        console.log(`Detected likely screen share track from peer ${peerId}:`, settings);
        
        // Process this as a screen share
        addScreenShareToGrid(peerId, stream, 'Shared Screen');
        
        // Note: We no longer set activeScreenSharePeerId globally
        // Each screen share is now completely independent
        
        // We've handled this stream as a screen share, so no need to pass to original handler
        return;
      }
    }
  }
  
  // For regular video tracks, call the original handler
  if (originalOnTrack) {
    originalOnTrack(event, peerId);
  }
};

// Add screen sharing to renderFrame in video recording
// Use safer access to prevent reference errors
if (typeof window.renderFrame === 'function') {
  const originalRenderFrame = window.renderFrame;
  window.renderFrame = function() {
    // If not recording, exit early
    if (!isVideoRecording) return;
    
    // Call the original render function
    originalRenderFrame();
    
    try {
      // Add screen share to the recording if it exists
      if (activeScreenSharePeerId && screenVideoElement && screenVideoElement.srcObject) {
        // Get the canvas that was created during recording
        const canvases = document.querySelectorAll('canvas');
        const canvas = canvases.length > 0 ? canvases[0] : null;
        
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Calculate video area dimensions 
        const videoAreaWidth = Math.floor(canvas.width * 0.7);
        
        // Draw screen share in a larger view at the bottom
        if (screenVideoElement.videoWidth > 0) {
          // Calculate position and size to fit in the available space
          const availableWidth = Math.floor(videoAreaWidth * 0.9);
          const availableHeight = Math.floor(canvas.height * 0.4);
          
          // Calculate dimensions that preserve aspect ratio
          const aspectRatio = screenVideoElement.videoWidth / screenVideoElement.videoHeight;
          let width = availableWidth;
          let height = width / aspectRatio;
          
          // If height exceeds available height, adjust width accordingly
          if (height > availableHeight) {
            height = availableHeight;
            width = height * aspectRatio;
          }
          
          // Center in available space at the bottom
          const x = Math.floor(videoAreaWidth * 0.05) + Math.floor((availableWidth - width) / 2);
          const y = canvas.height - height - 20;
          
          // Draw screen share
          ctx.drawImage(screenVideoElement, x, y, width, height);
          
          // Add border
          ctx.strokeStyle = '#4caf50';
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);
          
          // Add label
          const username = activeScreenSharePeerId === ownPeerId 
            ? 'Your Screen' 
            : `${peerUsernames.get(activeScreenSharePeerId) || 'Peer'}'s Screen`;
          
          // Add background for better visibility
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.font = 'bold 16px Arial'; 
          const textWidth = ctx.measureText(username).width + 20;
          ctx.fillRect(x, y - 30, textWidth, 30);
          
          // Add text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(username, x + 10, y - 10);
        }
      }
    } catch (error) {
      console.error('Error adding screen share to recording:', error);
    }
  };
} else {
  console.warn('renderFrame not available, screen sharing will not appear in recordings');
}

// Define renderFrame globally to avoid reference errors
window.renderFrame = function() {
  console.log("Default renderFrame called - this will be replaced during recording");
  // This is a placeholder that will be replaced when recording starts
  // But having it defined prevents reference errors
};

// Save credentials to localStorage when "Remember Me" is checked
function saveCredentials(identifier, password) {
  try {
    const credentials = {
      identifier,
      password
    };
    localStorage.setItem('savedCredentials', JSON.stringify(credentials));
    console.log('Credentials saved to localStorage');
  } catch (error) {
    console.error('Error saving credentials to localStorage:', error);
  }
}

// Load credentials from localStorage
function loadCredentials() {
  try {
    const savedCredentials = localStorage.getItem('savedCredentials');
    if (savedCredentials) {
      return JSON.parse(savedCredentials);
    }
    return null;
  } catch (error) {
    console.error('Error loading credentials from localStorage:', error);
    return null;
  }
}

// Clear saved credentials from localStorage
function clearCredentials() {
  try {
    localStorage.removeItem('savedCredentials');
    console.log('Credentials cleared from localStorage');
  } catch (error) {
    console.error('Error clearing credentials from localStorage:', error);
  }
}

// Check authentication state
async function checkAuthState() {
  try {
    const result = await window.electronAPI.getCurrentUser();
    if (result.success && result.user) {
      currentUser = result.user;
      updateAuthState(result.user);
      
      // Hide auth screen and show main app
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      
      // Set username for video chat
      usernameInput.value = result.user.handle;
      
      // Load saved settings
      loadSettings();
      
      // Enumerate devices
      enumerateDevices();
    } else {
      // No valid session, check for saved credentials
      const savedCredentials = loadCredentials();
      if (savedCredentials) {
        console.log('Found saved credentials, attempting auto-login...');
        // Pre-fill the login form
        signinIdInput.value = savedCredentials.identifier;
        signinPasswordInput.value = savedCredentials.password;
        
        // Attempt to sign in
        try {
          // Format identifier if needed (ensure it has a domain)
          let formattedIdentifier = savedCredentials.identifier;
          if (!formattedIdentifier.includes('@') && !formattedIdentifier.includes('.')) {
            formattedIdentifier = `${formattedIdentifier}.pds.hapa.ai`;
          }
          
          const response = await window.electronAPI.signIn(formattedIdentifier, savedCredentials.password);
          
          if (response.success) {
            // Sign in successful
            updateAuthState(response.user);
            
            // Hide auth screen and show main app
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            
            // Set username for video chat
            usernameInput.value = response.user.handle;
            
            // Load saved settings
            loadSettings();
            
            // Enumerate devices
            enumerateDevices();
            
            return; // Exit the function as we've successfully logged in
          } else {
            console.error('Auto-login failed:', response.error);
            // Show auth screen (will happen below)
          }
        } catch (error) {
          console.error('Error during auto-login:', error);
          // Show auth screen (will happen below)
        }
      }
      
      // Show auth screen if auto-login failed or no saved credentials
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    // On error, show auth screen
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
  }
}

// Leave the current room, closing all connections
async function leaveRoom() {
  try {
    console.log('Leaving current room...');
    
    // Clean up all peer connections
    for (const peerId of peers) {
      cleanupPeer(peerId);
    }
    
    // Clear all collections
    peers.clear();
    peerConnections.clear();
    dataChannels.clear();
    peerUsernames.clear();
    pendingIceCandidates.clear();
    remoteRecorders.clear();
    
    // Reset room tracking
    currentRoom = null;
    currentRoomSpan.textContent = '';
    
    // Update connection count
    updateConnectionCount();
    
    // Add system message
    addSystemMessage('Left the room');
    
    return true;
  } catch (error) {
    console.error('Error leaving room:', error);
    return false;
  }
}