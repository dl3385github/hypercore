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
const leaveRoomButton = document.getElementById('leave-room-btn');

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
  transcriptionModel: 'whisper-1', // Default transcription model
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
      
      if (parsedSettings.transcriptionModel) {
        appSettings.transcriptionModel = parsedSettings.transcriptionModel;
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
const transcriptionModelSelect = document.getElementById('transcription-model');

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
let screenSharingPeers = new Set(); // Set of peers currently sharing their screen
let screenSharingConnections = null; // Map of peer ID to screen sharing connection

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
  
  // Initialize transcription model selector
  if (transcriptionModelSelect) {
    transcriptionModelSelect.value = appSettings.transcriptionModel || 'whisper-1';
    
    transcriptionModelSelect.addEventListener('change', (e) => {
      const selectedModel = e.target.value;
      appSettings.transcriptionModel = selectedModel;
      console.log(`Transcription model updated to ${selectedModel}`);
      saveSettings();
      // Send the new model choice to the main process
      updateTranscriptionModel(selectedModel);
    });
  }
  
  function updateTranscriptionModel(model) {
    try {
      window.electronAPI.updateTranscriptionModel(model)
        .then(() => {
          console.log(`Transcription model updated to ${model}`);
        })
        .catch(error => {
          console.error('Error updating transcription model:', error);
        });
    } catch (error) {
      console.error('Error updating transcription model:', error);
    }
  }
  
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

  // Add leave room button click handler
  if (leaveRoomButton) {
    leaveRoomButton.addEventListener('click', handleLeaveRoom);
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
      
      // Call our track handler with the peer ID
      handleTrackEvent(event, peerId);
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
  
  // If message is a string, try to parse it as JSON
  let data;
  if (typeof message === 'string') {
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error(`Error parsing data channel message from ${peerId} as JSON:`, e);
      // Not a valid JSON string, use as-is
      data = message;
    }
  } else {
    // Already an object, use as-is
    data = message;
  }
  
  if (data.type === 'media-state') {
    // Update remote media state UI
    updateRemoteMediaState(peerId, data.username, data.videoEnabled, data.audioEnabled);
  } else if (data.type === 'transcript') {
    // Handle transcript message from peer
    // Get the speaker from the message or use the peer's username
    const speaker = data.speaker || getPeerUsername(peerId) || `Peer ${peerId.substring(0, 6)}`;
    console.log(`Received transcript message from ${speaker}: "${data.text}"`);
    
    // Make sure we store this username for the peer if we don't have it already
    if (!peerUsernames.has(peerId) && speaker !== `Peer ${peerId.substring(0, 6)}`) {
      peerUsernames.set(peerId, speaker);
    }
    
    // Skip empty or very short transcriptions
    if (!data.text || data.text.trim().length < 3) {
      console.log(`Ignoring short transcript from ${speaker}: "${data.text}"`);
      return;
    }
    
    // Update UI with the transcript
    updateTranscription(speaker, data.text);
    
    // No need to add to transcript map again since updateTranscription already does this
  } else if (data.type === 'screen-share-started') {
    console.log(`Peer ${peerId} started screen sharing: ${data.sourceName}`);
    addSystemMessage(`${data.username} started sharing their screen: ${data.sourceName}`);
    
    // Update active screen sharer
    activeScreenSharePeerId = peerId;
    
    // Check if we have screen connection
    const hasScreenConnection = screenSharingConnections && screenSharingConnections.has(peerId);
    console.log(`Screen sharing connection status for ${peerId}: ${hasScreenConnection ? 'Connected' : 'Not connected'}`);
    
    // Add to screen sharing peers set
    if (!screenSharingPeers) {
      screenSharingPeers = new Set();
    }
    screenSharingPeers.add(peerId);
    
  } else if (data.type === 'screen-share-stopped') {
    console.log(`Peer ${peerId} stopped screen sharing`);
    addSystemMessage(`${data.username} stopped sharing their screen`);
      
    // Remove the screen share from grid
    const screenContainer = document.getElementById(`screen-share-${peerId}`);
    if (screenContainer) {
      screenContainer.remove();
    }
    
    // Clear active screen sharer only if it was this peer
    if (activeScreenSharePeerId === peerId) {
      activeScreenSharePeerId = null;
    }
    
    // Remove from screen sharing peers set
    if (screenSharingPeers) {
      screenSharingPeers.delete(peerId);
    }
  } else if (data.type === 'screen-share-error') {
    console.error(`Screen share error reported by peer ${peerId}: ${data.error}`);
    
    // Handle specific error types
    if (data.error === 'empty-sdp') {
      console.log(`Peer ${peerId} reported empty SDP error, we should resend the offer`);
      
      // If we're currently screen sharing, try to send a new offer
      if (isScreenSharing && screenShareStream) {
        // Find the screen connection for this peer
        const screenConnection = screenSharingConnections.get(peerId);
        if (screenConnection) {
          // Start the connection setup again
          console.log(`Recreating and sending new screen share offer to ${peerId}`);
          
          // Create and send a new offer
          try {
            (async () => {
              const offer = await screenConnection.createOffer();
              await screenConnection.setLocalDescription(offer);
              
              // Allow more time for the description to be set
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Create an explicit SDP object
              const sdpFormatted = {
                type: screenConnection.localDescription.type,
                sdp: screenConnection.localDescription.sdp
              };
              
              // Send the offer with screen share flag
              const signal = {
                type: 'offer',
                isScreenShare: true,
                sdp: sdpFormatted
              };
              
              console.log(`Resending screen share offer to ${peerId} after error:`, JSON.stringify(signal));
              await window.electronAPI.sendSignal(peerId, signal);
            })().catch(error => {
              console.error(`Error recreating screen share offer:`, error);
            });
          } catch (error) {
            console.error(`Error preparing new screen share offer:`, error);
          }
        }
      }
    }
  } else if (data.type === 'request-screen-share') {
    console.log(`Received screen share request from ${peerId} (${data.username})`);
    
    // If we're currently screen sharing, send a new offer
    if (isScreenSharing && screenShareStream) {
      // Find the screen connection for this peer
      const screenConnection = screenSharingConnections.get(peerId);
      if (screenConnection) {
        // Create and send a new offer
        try {
          (async () => {
            const offer = await screenConnection.createOffer();
            await screenConnection.setLocalDescription(offer);
            
            // Allow more time for the description to be set
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Create an explicit SDP object
            const sdpFormatted = {
              type: screenConnection.localDescription.type,
              sdp: screenConnection.localDescription.sdp
            };
            
            // Send the offer with screen share flag
            const signal = {
              type: 'offer',
              isScreenShare: true,
              sdp: sdpFormatted
            };
            
            console.log(`Sending screen share offer to ${peerId} in response to request:`, JSON.stringify(signal));
            await window.electronAPI.sendSignal(peerId, signal);
          })().catch(error => {
            console.error(`Error creating screen share offer:`, error);
          });
        } catch (error) {
          console.error(`Error preparing screen share offer:`, error);
        }
      } else {
        console.error(`No screen connection found for peer ${peerId} to fulfill screen share request`);
      }
    } else {
      console.log(`Received screen share request but we're not currently sharing a screen`);
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
    
    // Check if this is a screen sharing signal
    if (signal.isScreenShare) {
      console.log(`This is a screen sharing signal from ${peerId}`);
      await handleScreenShareSignal(peerId, from, signal);
      return;
    }
    
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

// Handle screen sharing specific signals
async function handleScreenShareSignal(peerId, from, signal) {
  try {
    console.log(`TRACE: handleScreenShareSignal called with signal type ${signal.type}, isScreenShare=${signal.isScreenShare}, peerId=${peerId}`);
    console.log(`TRACE: Full signal:`, JSON.stringify(signal));
    
    // Create or get the screen sharing connection for this peer
    let screenConnection;
    
    if (!screenSharingConnections) {
      screenSharingConnections = new Map();
    }
    
    if (!screenSharingConnections.has(peerId)) {
      console.log(`Creating new screen share connection for ${peerId}`);
      
      // Create a dedicated connection for screen share
      screenConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });
      
      // Store the connection
      screenSharingConnections.set(peerId, screenConnection);
      
      // Set up event handlers
      screenConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate for screen share
          const iceSignal = {
            type: 'ice-candidate',
            isScreenShare: true,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment
            }
          };
          
          window.electronAPI.sendSignal(peerId, iceSignal).catch(err => {
            console.error(`Error sending screen share ICE candidate to ${peerId}:`, err);
          });
        }
      };
      
      // Handle tracks separately for screen share
      screenConnection.ontrack = (event) => {
        console.log(`Received screen share track from ${peerId}`, event);
        
        // Create a new MediaStream to contain just the screen share
        const screenStream = new MediaStream();
        
        // Add all tracks from the event to our new stream
        event.streams.forEach(stream => {
          stream.getTracks().forEach(track => {
            console.log(`Adding track from screen share: ${track.kind}`, track);
            screenStream.addTrack(track);
          });
        });
        
        if (screenStream.getTracks().length > 0) {
          // Mark this peer as screen sharing
          if (!screenSharingPeers) {
            screenSharingPeers = new Set();
          }
          screenSharingPeers.add(peerId);
          
          // Set this peer as the active screen sharer
          activeScreenSharePeerId = peerId;
          
          // Add screen share to UI
          const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
          console.log(`Adding screen share to grid for ${peerName} (${peerId})`);
          addScreenShareToGrid(peerId, screenStream, 'Screen Share', true);
          
          // Add system message
          addSystemMessage(`${peerName} is sharing their screen`);
        } else {
          console.warn(`Received screen share track event with no tracks from ${peerId}`);
        }
      };
    } else {
      screenConnection = screenSharingConnections.get(peerId);
    }
    
    // Handle different screen share signal types
    if (signal.type === 'offer') {
      console.log(`Processing screen share offer from ${peerId}, signal type: ${signal.type}`);
      console.log(`Screen share offer sdp type: ${typeof signal.sdp}, isObject: ${typeof signal.sdp === 'object'}, keys: ${Object.keys(signal.sdp || {})}`);
      
      // Use our helper function to create a standard SDP object
      let rtcSessionDescription;
      
      if (signal.sdp) {
        console.log(`Screen share offer SDP content:`, JSON.stringify(signal.sdp));
        
        // Check if the SDP is an empty object (this is the specific issue from the logs)
        if (typeof signal.sdp === 'object' && Object.keys(signal.sdp).length === 0) {
          console.error(`Empty SDP object detected in screen share offer, attempting to fix...`);
          
          // Notify the sender about the issue so they can fix it
          const dataChannel = dataChannels.get(peerId);
          if (dataChannel && dataChannel.readyState === 'open') {
            try {
              dataChannel.send(JSON.stringify({
                type: 'screen-share-error',
                error: 'empty-sdp'
              }));
            } catch (err) {
              console.error(`Failed to send error back to peer:`, err);
            }
          }
          
          // Request a new offer via data channel
          if (dataChannel && dataChannel.readyState === 'open') {
            try {
              console.log(`Requesting a new screen share offer from ${peerId}`);
              dataChannel.send(JSON.stringify({
                type: 'request-screen-share',
                username: usernameInput.value
              }));
            } catch (err) {
              console.error(`Failed to request a new screen share offer:`, err);
            }
          }
          
          // Return early - we'll wait for a new offer with valid SDP
          return;
        }
        
        // Try to create a proper RTCSessionDescription
        try {
          // If it's already an RTCSessionDescription, use it directly
          if (signal.sdp instanceof RTCSessionDescription) {
            rtcSessionDescription = signal.sdp;
          } 
          // If it has type and sdp properties, create a new RTCSessionDescription
          else if (signal.sdp.type && signal.sdp.sdp) {
            rtcSessionDescription = new RTCSessionDescription({
              type: signal.sdp.type,
              sdp: signal.sdp.sdp
            });
          } else {
            console.error(`Invalid SDP format in screen share offer:`, signal.sdp);
            return;
          }
        } catch (error) {
          console.error(`Error creating RTCSessionDescription for screen share:`, error);
          return;
        }
      } else {
        console.error(`Missing SDP in screen share offer:`, signal);
        return;
      }
      
      console.log(`Setting remote description for screen share from ${peerId}`, rtcSessionDescription);
      try {
        await screenConnection.setRemoteDescription(rtcSessionDescription);
        console.log(`Successfully set remote description for screen share from ${peerId}`);
        
        // Create and send answer (not offer - we're responding to an offer)
        console.log(`Creating answer for screen share from ${peerId}`);
        const answer = await screenConnection.createAnswer();
        await screenConnection.setLocalDescription(answer);
        
        // Wait for the local description to be fully set
        await new Promise(resolve => setTimeout(resolve, 500)); // Increased timeout for better reliability
        
        // Make sure we have a valid local description
        if (!screenConnection.localDescription) {
          console.error(`No local description available for screen share answer to ${peerId}`);
          return;
        }
        
        // Extract SDP properties explicitly to avoid empty object issues
        const sdpFormatted = {
          type: screenConnection.localDescription.type,
          sdp: screenConnection.localDescription.sdp
        };
        
        // Send the answer with screen share flag
        const signal = {
          type: 'answer',
          isScreenShare: true, // Mark as screen share answer
          sdp: sdpFormatted
        };
        
        console.log(`Sending screen share answer to ${peerId}`, JSON.stringify(signal));
        await window.electronAPI.sendSignal(peerId, signal);
      } catch (error) {
        console.error(`Error processing screen share offer from ${peerId}:`, error);
      }
    } else if (signal.type === 'answer') {
      console.log(`Processing screen share answer from ${peerId}`);
      
      // Make sure we have a valid SDP object
      let rtcSessionDescription;
      
      if (signal.sdp) {
        console.log(`Screen share answer SDP content:`, JSON.stringify(signal.sdp));
        
        // Try to create a proper RTCSessionDescription
        try {
          // If it's already an RTCSessionDescription, use it directly
          if (signal.sdp instanceof RTCSessionDescription) {
            rtcSessionDescription = signal.sdp;
          } 
          // If it has type and sdp properties, create a new RTCSessionDescription
          else if (signal.sdp.type && signal.sdp.sdp) {
            rtcSessionDescription = new RTCSessionDescription({
              type: signal.sdp.type,
              sdp: signal.sdp.sdp
            });
          } else {
            console.error(`Invalid SDP format in screen share answer:`, signal.sdp);
            return;
          }
        } catch (error) {
          console.error(`Error creating RTCSessionDescription for screen share answer:`, error);
          return;
        }
      } else {
        console.error(`Missing SDP in screen share answer:`, signal);
        return;
      }
      
      console.log(`Setting remote description for screen share answer from ${peerId}`, rtcSessionDescription);
      await screenConnection.setRemoteDescription(rtcSessionDescription);
      
    } else if (signal.type === 'ice-candidate') {
      console.log(`Processing screen share ICE candidate from ${peerId}`);
      
      if (signal.candidate) {
        const iceCandidate = new RTCIceCandidate({
          candidate: signal.candidate.candidate,
          sdpMid: signal.candidate.sdpMid,
          sdpMLineIndex: signal.candidate.sdpMLineIndex,
          usernameFragment: signal.candidate.usernameFragment
        });
        
        await screenConnection.addIceCandidate(iceCandidate);
      }
    }
  } catch (error) {
    console.error(`Error handling screen share signal from ${peerId}:`, error);
  }
}