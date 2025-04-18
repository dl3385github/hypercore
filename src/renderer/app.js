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
const createTaskBtn = document.getElementById('create-task-btn');
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

// Global variables for task management
let tasks = []; // Array of task objects
let lastTaskTimestamp = 0; // Timestamp of the last accepted task
let taskVotes = new Map(); // Map of task ID to votes (Map of peer ID to vote)
let acceptedTasks = []; // Array of accepted task objects
let isPendingTask = false; // Flag to indicate if there's a task pending votes
let currentPendingTask = null; // The current task waiting for votes
let isCreatingTask = false; // Flag to indicate if a task is being created

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
let screenSharingPeers = new Set(); // Set of peers currently sharing their screen
let previousLocalStream = null; // Store the camera stream to restore when screen sharing ends

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
  
  // Add fullscreen button to local video container
  const localVideoContainer = localVideo.closest('.video-container');
  if (localVideoContainer && !localVideoContainer.querySelector('.fullscreen-btn')) {
    const fullscreenButton = document.createElement('button');
    fullscreenButton.className = 'fullscreen-btn';
    fullscreenButton.innerHTML = '🔍';
    fullscreenButton.title = 'View in full screen';
    fullscreenButton.style.position = 'absolute';
    fullscreenButton.style.top = '8px';
    fullscreenButton.style.right = '8px';
    fullscreenButton.style.zIndex = '3';
    fullscreenButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    fullscreenButton.style.color = 'white';
    fullscreenButton.style.border = 'none';
    fullscreenButton.style.borderRadius = '50%';
    fullscreenButton.style.width = '36px';
    fullscreenButton.style.height = '36px';
    fullscreenButton.style.cursor = 'pointer';
    fullscreenButton.addEventListener('click', () => {
      // When the local stream is available, use it
      if (localVideo.srcObject) {
        openFullscreenView(localVideo.srcObject, 'You', ownPeerId);
      }
    });
    localVideoContainer.appendChild(fullscreenButton);
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
  
  // Add event listener for create task button
  createTaskBtn.addEventListener('click', async () => {
    // Check if transcripts map is empty or if there are no entries
    let hasTranscriptData = false;
    transcripts.forEach((entries, username) => {
      if (entries.length > 0) hasTranscriptData = true;
    });
    
    // If no transcript data is available, offer to add test data
    if (!hasTranscriptData) {
      console.warn("No transcript data available for task creation");
      if (confirm("No transcript data found. Would you like to add some test transcript data for debugging?")) {
        window.addTestTranscriptData();
        return;
      }
    }
    
    // Proceed with creating task
    try {
      await createTask();
    } catch (err) {
      console.error('Error creating task:', err);
      alert('Error creating task: ' + (err.message || 'Unknown error'));
    }
  });
  
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
  
  // Set up task receiving
  window.electronAPI.onNewTask((message) => {
    console.log('Received task via Hypercore:', message);
    // Handle the task from peer
    if (message.task) {
      // Use the existing handlePeerData function to process the task message
      // This will create the task card and handle it properly
      handlePeerData(message.task.createdBy, JSON.stringify(message));
    }
  });
  
  // Set up vote receiving
  window.electronAPI.onNewVote((message) => {
    console.log('Received vote via Hypercore:', message);
    // Handle the vote from peer
    if (message.taskId && message.vote && message.peerId) {
      // Check for duplicate votes before processing
      const isDuplicateVote = taskVotes.has(message.taskId) && 
                             taskVotes.get(message.taskId).has(message.peerId) &&
                             taskVotes.get(message.taskId).get(message.peerId).vote === message.vote;
      
      if (isDuplicateVote) {
        console.log(`Skipping duplicate Hypercore vote from ${message.username || message.peerId}: ${message.vote}`);
        return;
      }
      
      // Use the existing handleReceivedVote function
      handleReceivedVote(message);
    }
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
  
  // Initialize variables
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize the transcripts map if it's undefined
    if (!transcripts || !(transcripts instanceof Map)) {
      console.log("Initializing transcripts Map");
      transcripts = new Map();
    }
    
    // Reset lastTaskTimestamp to ensure transcripts are included
    lastTaskTimestamp = 0;
    
    // Testing function to add dummy transcript data if needed
    window.addTestTranscriptData = function() {
      try {
        const testUser = usernameInput.value.trim() || 'You';
        const testTime = Date.now();
        
        if (!transcripts.has(testUser)) {
          transcripts.set(testUser, []);
        }
        
        transcripts.get(testUser).push({
          text: "This is a test transcript entry for debugging task creation.",
          timestamp: testTime - 30000 // 30 seconds ago
        });
        
        transcripts.get(testUser).push({
          text: "Let's make sure transcript data is being included in tasks.",
          timestamp: testTime - 15000 // 15 seconds ago
        });
        
        console.log(`Added test transcript data for ${testUser}:`, transcripts.get(testUser));
        alert("Added test transcript data. Try creating a task now.");
      } catch (error) {
        console.error("Error adding test transcript data:", error);
      }
    };
  });
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
  } else if (message.type === 'new-task') {
    // Handle new task from peer
    handleNewTask(message.task, peerId);
  } else if (message.type === 'task-vote') {
    // Handle task vote from peer
    handleTaskVote(message.taskId, message.username, message.vote, peerId);
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
    
    // Always process as a potential camera video, regardless of screen sharing
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
    
    // Return the container for further modifications
    return remoteContainer;
    
  } catch (error) {
    console.error(`Error adding remote stream for peer ${peerId}:`, error);
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
  
  // Store transcript entry in memory with a numeric timestamp
  if (!transcripts.has(speaker)) {
    transcripts.set(speaker, []);
  }
  
  // Use numeric timestamp to ensure compatibility with task creation
  const now = Date.now();
  transcripts.get(speaker).push({
    text,
    timestamp: now
  });
  
  console.log(`Added transcript entry for ${speaker}:`, {
    text,
    timestamp: now
  });
  
  // Find the appropriate container for this speaker
  const isSelf = speaker === currentUsername;
  let transcriptContainer = null;
  
  if (isSelf) {
    // Use the local transcript container
    transcriptContainer = document.querySelector('#local-transcript .transcript-content');
    
    // Also update the overlay if available
    const localOverlay = document.getElementById('local-overlay-transcript');
    if (localOverlay) {
      // Make overlay more noticeable by adding the text
      localOverlay.textContent = text;
      localOverlay.classList.remove('hidden');
      
      // Make sure it's actually visible in UI
      localOverlay.style.display = 'block';
      
      // Make sure it has some basic styling if not already in CSS
      localOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      localOverlay.style.color = 'white';
      localOverlay.style.padding = '8px';
      localOverlay.style.borderRadius = '4px';
      localOverlay.style.maxWidth = '90%';
      localOverlay.style.margin = '0 auto';
      
      // Hide after a few seconds
      setTimeout(() => {
        localOverlay.classList.add('hidden');
        localOverlay.style.display = 'none';
      }, 5000);
    } else {
      console.warn('Local overlay element not found!');
    }
  } else {
    // Find the remote peer's transcript container
    let foundPeerId = null;
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
        
        // Also update the overlay if available
        const overlay = document.getElementById(`transcript-overlay-${foundPeerId}`);
        if (overlay) {
          console.log(`Found overlay for peer ${foundPeerId}, updating it`);
          // Make overlay more noticeable
          overlay.textContent = text;
          overlay.classList.remove('hidden');
          
          // Make sure it's actually visible in UI
          overlay.style.display = 'block';
          
          // Make sure it has some basic styling if not already in CSS
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          overlay.style.color = 'white';
          overlay.style.padding = '8px';
          overlay.style.borderRadius = '4px';
          overlay.style.maxWidth = '90%';
          overlay.style.margin = '0 auto';
          
          // Hide after a few seconds
          setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
          }, 5000);
        } else {
          console.warn(`Could not find overlay element for peer ${foundPeerId}`);
        }
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
  
  // Add to transcript popup
  addTranscriptToPopup(speaker, text, now);
  
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
  
  // Create header with speaker and time
  const header = document.createElement('div');
  header.className = 'transcript-entry-header';
  
  // Create speaker element with styling
  const speakerElement = document.createElement('span');
  speakerElement.className = 'transcript-speaker';
  speakerElement.textContent = speaker;
  
  // Add special styling for local user
  if (speaker === currentUsername) {
    speakerElement.style.color = '#4CAF50';
    speakerElement.style.fontWeight = 'bold';
  } else {
    speakerElement.style.color = '#2196F3';
    speakerElement.style.fontWeight = 'bold';
  }
  
  // Create time element with styling
  const timeElement = document.createElement('span');
  timeElement.className = 'transcript-time';
  
  // Ensure we handle both string timestamps and numeric timestamps
  let timestampDate;
  if (typeof timestamp === 'string') {
    timestampDate = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    timestampDate = new Date(timestamp);
  } else {
    timestampDate = new Date(); // Fallback to current time
  }
  
  timeElement.textContent = timestampDate.toLocaleTimeString();
  timeElement.style.color = '#999';
  timeElement.style.marginLeft = '8px';
  timeElement.style.fontSize = '0.85em';
  
  // Add elements to header
  header.appendChild(speakerElement);
  header.appendChild(document.createTextNode(' • '));
  header.appendChild(timeElement);
  
  // Style the header
  header.style.marginBottom = '4px';
  
  // Create transcript text element with styling
  const textElement = document.createElement('div');
  textElement.className = 'transcript-text';
  textElement.textContent = text;
  textElement.style.marginBottom = '8px';
  textElement.style.marginLeft = '8px';
  
  // Add header and text to entry
  entry.appendChild(header);
  entry.appendChild(textElement);
  
  // Style the entry
  entry.style.marginBottom = '10px';
  entry.style.borderBottom = '1px solid #eee';
  entry.style.paddingBottom = '10px';
  
  // Add entry to popup content
  if (transcriptPopupContent) {
    transcriptPopupContent.appendChild(entry);
    
    // Scroll to bottom
    transcriptPopupContent.scrollTop = transcriptPopupContent.scrollHeight;
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
    console.log('Checking authentication state...');
    
    // Get the current user
    const result = await window.electronAPI.getUser();
    console.log('Auth check result:', result);
    
    if (result && result.success && result.user) {
      // User is logged in
      console.log('User is authenticated:', result.user.handle);
      currentUser = result.user;
      
      // Extract just the first part of the handle (before any dots)
      let simplifiedHandle = result.user.handle;
      if (simplifiedHandle.includes('.')) {
        simplifiedHandle = simplifiedHandle.split('.')[0];
      }
      
      // Set username input to simplified handle (without domain)
      usernameInput.value = simplifiedHandle;
      
      // Update the UI displays
      updateUserDisplays(result.user);
      
      // Show the main app and hide auth screen
      authScreen.classList.add('hidden');
      mainApp.classList.remove('hidden');
    } else {
      console.log('User not authenticated, checking for saved credentials');
      
      // Try to load saved credentials
      const savedCredentials = localStorage.getItem('userCredentials');
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        
        // Auto login with saved credentials
        console.log('Attempting auto-login with saved credentials');
        const signInResult = await window.electronAPI.signIn(credentials.handle, credentials.password);
        
        if (signInResult && signInResult.success) {
          console.log('Auto-login successful');
          currentUser = signInResult.user;
          
          // Extract just the first part of the handle (before any dots)
          let simplifiedHandle = signInResult.user.handle;
          if (simplifiedHandle.includes('.')) {
            simplifiedHandle = simplifiedHandle.split('.')[0];
          }
          
          // Set username with simplified handle
          usernameInput.value = simplifiedHandle;
          
          updateUserDisplays(signInResult.user);
          
          // Show the main app and hide auth screen
          authScreen.classList.add('hidden');
          mainApp.classList.remove('hidden');
          return;
        }
      }
      
      // No valid session or saved credentials, show auth screen
      authScreen.classList.remove('hidden');
      mainApp.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    authScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
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
    
    // Determine the best supported MIME type for video recording
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
            console.warn('No preferred MIME types are supported, using browser default');
          }
        }
      }
    }
    
    // Create MediaRecorder with appropriate options
    const options = mimeType ? { mimeType } : {};
    console.log(`Creating video recorder with MIME type: ${mimeType || 'browser default'}`);
    videoRecorder = new MediaRecorder(canvasStream, options);
    
    // Handle data available event
    videoRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        videoRecordedChunks.push(event.data);
        console.log(`Recorded video chunk: ${event.data.size} bytes, type: ${event.data.type}`);
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
      const localVideoRect = { 
        x: 10, 
        y: 10, 
        width: Math.floor(videoAreaWidth * 0.45),
        height: Math.floor(canvas.height * 0.3)
      };
      
      const localVideoIsActive = localVideo.srcObject && 
                                 localVideo.videoWidth > 0 && 
                                 isVideoEnabled;
      
      if (localVideoIsActive) {
        // Calculate aspect ratio preserving dimensions
        const aspectRatio = localVideo.videoWidth / localVideo.videoHeight;
        
        // Calculate dimensions that preserve aspect ratio
        let width = localVideoRect.width;
        let height = width / aspectRatio;
        
        // If height exceeds max height, adjust width accordingly
        if (height > localVideoRect.height) {
          height = localVideoRect.height;
          width = height * aspectRatio;
        }
        
        // Center in allocated space
        const x = localVideoRect.x + Math.floor((localVideoRect.width - width) / 2);
        const y = localVideoRect.y + Math.floor((localVideoRect.height - height) / 2);
        
        // Update rect with actual dimensions
        localVideoRect.x = x;
        localVideoRect.y = y;
        localVideoRect.width = width;
        localVideoRect.height = height;
        
        // Draw the video
        ctx.drawImage(
          localVideo, 
          localVideoRect.x, 
          localVideoRect.y, 
          localVideoRect.width, 
          localVideoRect.height
        );
      } else {
        // Draw placeholder for disabled camera
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(
          localVideoRect.x, 
          localVideoRect.y, 
          localVideoRect.width, 
          localVideoRect.height
        );
        
        // Add camera off icon
        ctx.fillStyle = '#999999';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('📷❌', 
          localVideoRect.x + localVideoRect.width/2, 
          localVideoRect.y + localVideoRect.height/2);
        ctx.textAlign = 'left';
      }
      
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
      
      // Draw recent transcript for local user
      if (transcripts.has(currentUser?.handle || 'You')) {
        const userTranscripts = transcripts.get(currentUser?.handle || 'You');
        if (userTranscripts && userTranscripts.length > 0) {
          const latestTranscript = userTranscripts[userTranscripts.length - 1];
          
          // Only show if less than 5 seconds old
          const transcriptAge = Date.now() - new Date(latestTranscript.timestamp).getTime();
          if (transcriptAge < 5000) {
            // Create transcript background
            const maxWidth = localVideoRect.width - 20;
            const transcriptText = latestTranscript.text;
            
            ctx.font = '16px Arial';
            const textMetrics = ctx.measureText(transcriptText);
            const textWidth = Math.min(maxWidth, textMetrics.width);
            
            // Background for transcript
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(
              localVideoRect.x, 
              localVideoRect.y + localVideoRect.height - 60,
              textWidth + 20,
              30
            );
            
            // Transcript text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(
              transcriptText, 
              localVideoRect.x + 10, 
              localVideoRect.y + localVideoRect.height - 40
            );
          }
        }
      }
      
      // Draw remote video feeds in a grid layout
      // Calculate grid layout for remaining peers
      const remotePeers = Array.from(peerUsernames.keys());
      
      if (remotePeers.length > 0) {
        // Create a grid layout (always starts at the top right)
        const gridStartX = localVideoRect.x + localVideoRect.width + 20; // Right of local video
        let gridX = gridStartX;
        let gridY = 10;
        const gridItemWidth = Math.floor((videoAreaWidth - gridStartX - 10) / 2); // 2 columns max
        const gridItemHeight = Math.floor((canvas.height - 20) / 3); // 3 rows max
        let colCounter = 0;
        
        // Draw each remote peer
        remotePeers.forEach(peerId => {
          // Get username
          const username = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
          
          // Calculate position
          const remoteRect = {
            x: gridX,
            y: gridY,
            width: gridItemWidth,
            height: gridItemHeight
          };
          
          // Find the video element for this peer
          const peerContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
          const remoteVideo = peerContainer ? peerContainer.querySelector('video') : null;
          const videoHasContent = remoteVideo && remoteVideo.videoWidth > 0;
          
          // Check if we have a valid video feed to display
          if (videoHasContent) {
            // Calculate aspect ratio preserving dimensions
            const aspectRatio = remoteVideo.videoWidth / remoteVideo.videoHeight;
            
            // Calculate dimensions that preserve aspect ratio
            let width = remoteRect.width;
            let height = width / aspectRatio;
            
            // If height exceeds max height, adjust width accordingly
            if (height > remoteRect.height) {
              height = remoteRect.height;
              width = height * aspectRatio;
            }
            
            // Center in allocated space
            const x = remoteRect.x + Math.floor((remoteRect.width - width) / 2);
            const y = remoteRect.y + Math.floor((remoteRect.height - height) / 2);
            
            // Update rect with actual dimensions
            remoteRect.x = x;
            remoteRect.y = y;
            remoteRect.width = width;
            remoteRect.height = height;
            
            // Draw the video
            ctx.drawImage(
              remoteVideo, 
              remoteRect.x, 
              remoteRect.y, 
              remoteRect.width, 
              remoteRect.height
            );
          } else {
            // Draw placeholder for video-off or not yet connected
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(
              remoteRect.x, 
              remoteRect.y, 
              remoteRect.width, 
              remoteRect.height
            );
            
            // Add camera off icon
            ctx.fillStyle = '#999999';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('📷❌', 
              remoteRect.x + remoteRect.width/2, 
              remoteRect.y + remoteRect.height/2);
            ctx.textAlign = 'left';
          }
          
          // Add border
          ctx.strokeStyle = '#4CAF50';
          ctx.lineWidth = 3;
          ctx.strokeRect(
            remoteRect.x, 
            remoteRect.y, 
            remoteRect.width, 
            remoteRect.height
          );
          
          // Add username with better visibility
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(
            remoteRect.x, 
            remoteRect.y + remoteRect.height - 30,
            remoteRect.width,
            30
          );
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px Arial';
          ctx.fillText(
            username, 
            remoteRect.x + 10, 
            remoteRect.y + remoteRect.height - 10
          );
          
          // Draw recent transcript for this user if available
          if (transcripts.has(username)) {
            const peerTranscripts = transcripts.get(username);
            if (peerTranscripts && peerTranscripts.length > 0) {
              const latestTranscript = peerTranscripts[peerTranscripts.length - 1];
              
              // Only show if less than 5 seconds old
              const transcriptAge = Date.now() - new Date(latestTranscript.timestamp).getTime();
              if (transcriptAge < 5000) {
                // Create transcript background
                const maxWidth = remoteRect.width - 20;
                const transcriptText = latestTranscript.text;
                
                ctx.font = '16px Arial';
                const textMetrics = ctx.measureText(transcriptText);
                const textWidth = Math.min(maxWidth, textMetrics.width);
                
                // Background for transcript
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(
                  remoteRect.x, 
                  remoteRect.y + remoteRect.height - 60,
                  textWidth + 20,
                  30
                );
                
                // Transcript text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(
                  transcriptText, 
                  remoteRect.x + 10, 
                  remoteRect.y + remoteRect.height - 40
                );
              }
            }
          }
          
          // Move to next grid position
          colCounter++;
          if (colCounter % 2 === 0) {
            // Move to next row
            gridX = gridStartX;
            gridY += gridItemHeight + 10;
          } else {
            // Move to next column
            gridX += gridItemWidth + 10;
          }
        });
      }
      
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
          
          const usernameWidth = ctx.measureText(`${msg.username}:`).width + 40; // Add extra spacing
          const maxWidth = chatAreaWidth - 40 - usernameWidth;
          const textX = chatAreaX + 20 + usernameWidth;
          const words = msg.text.split(' ');
          let line = '';
          let lineY = y + 20;
          
          words.forEach(word => {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, textX, lineY);
              line = word;
              lineY += 20;
            } else {
              line = testLine;
            }
          });
          
          ctx.fillText(line, textX, lineY);
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
          
          const usernameWidth = ctx.measureText(`${transcript.username}:`).width + 20; // Add space after username
          const maxWidth = chatAreaWidth - 40 - usernameWidth;
          const textX = chatAreaX + 20 + usernameWidth;
          const words = transcript.text.split(' ');
          let line = '';
          let lineY = y + 20;
          
          words.forEach(word => {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, textX, lineY);
              line = word;
              lineY += 20;
            } else {
              line = testLine;
            }
          });
          
          ctx.fillText(line, textX, lineY);
        });
      } else {
        ctx.fillStyle = '#999999';
        ctx.font = '16px Arial';
        ctx.fillText('No transcripts yet', chatAreaX + 20, canvas.height / 2 + 40);
      }
      
      // Add To-Do List to the recording if there are accepted tasks
      if (acceptedTasks && acceptedTasks.length > 0) {
        // Title for the to-do list section
        const todoY = Math.min(canvas.height - 250, (canvas.height / 2) + 300);
        ctx.fillStyle = '#FFC107'; // Match the amber color from CSS
        ctx.font = 'bold 22px Arial';
        ctx.fillText('To-Do List', chatAreaX + 20, todoY);
        
        // Draw background rectangle for to-do list
        ctx.fillStyle = 'rgba(45, 45, 45, 0.7)'; // Match todo-list-container background
        ctx.fillRect(chatAreaX + 10, todoY + 10, chatAreaWidth - 20, Math.min(200, 50 * acceptedTasks.length));
        
        // Draw each to-do item
        ctx.font = '16px Arial';
        acceptedTasks.forEach((task, index) => {
          const itemY = todoY + 40 + (index * 60);
          
          // Draw a separator line between tasks (except before the first one)
          if (index > 0) {
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(chatAreaX + 20, itemY - 20);
            ctx.lineTo(chatAreaX + chatAreaWidth - 20, itemY - 20);
            ctx.stroke();
          }
          
          // Draw task content
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px Arial';
          
          // Draw task text with word wrap
          const maxWidth = chatAreaWidth - 40;
          const textX = chatAreaX + 20;
          const words = task.text.split(' ');
          let line = '';
          let lineY = itemY;
          
          words.forEach(word => {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, textX, lineY);
              line = word;
              lineY += 20;
            } else {
              line = testLine;
            }
          });
          
          ctx.fillText(line, textX, lineY);
          
          // Draw task creator and time
          ctx.fillStyle = '#999999';
          ctx.font = '12px Arial';
          ctx.fillText(`Added by ${task.createdBy} at ${new Date(task.createdAt).toLocaleTimeString()}`, 
                       textX, lineY + 20);
        });
      }
      
      // Draw pending task card if there is one
      if (isPendingTask && currentPendingTask) {
        const task = currentPendingTask;
        const taskCardY = 80; // Position it right after chat messages title
        
        // Draw card background
        ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
        ctx.fillRect(chatAreaX + 10, taskCardY + 250, chatAreaWidth - 20, 160);
        
        // Draw card border
        ctx.strokeStyle = '#4a69bd';
        ctx.lineWidth = 2;
        ctx.strokeRect(chatAreaX + 10, taskCardY + 250, chatAreaWidth - 20, 160);
        
        // Draw task header
        ctx.fillStyle = '#4a69bd';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Current Task Proposal', chatAreaX + 20, taskCardY + 25 + 250);
        
        // Draw task creator and time
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '14px Arial';
        ctx.fillText(`Proposed by ${task.createdBy} at ${new Date(task.createdAt).toLocaleTimeString()}`, 
                     chatAreaX + 20, taskCardY + 45 + 250);
        
        // Draw task content
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        
        // Draw task text with word wrap
        const maxWidth = chatAreaWidth - 40;
        const textX = chatAreaX + 20;
        const words = task.text.split(' ');
        let line = '';
        let lineY = taskCardY + 75 + 250;
        
        words.forEach(word => {
          const testLine = line + (line ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, textX, lineY);
            line = word;
            lineY += 20;
          } else {
            line = testLine;
          }
        });
        
        ctx.fillText(line, textX, lineY);
        
        // Draw voting status
        const votes = taskVotes.get(task.id);
        if (votes) {
          const voteCount = votes.size;
          const totalParticipants = peers.size + 1; // Include self
          const acceptVotes = Array.from(votes.values()).filter(v => v.vote === 'accept').length;
          
          ctx.fillStyle = '#aaaaaa';
          ctx.font = '14px Arial';
          ctx.fillText(`Votes: ${voteCount}/${totalParticipants} (${acceptVotes} accept)`, 
                       textX, lineY + 30);
        }
      }
      
      // Record this frame
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
      
      // Get the MIME type from the recorder or fallback to webm
      const mimeType = (videoRecorder.mimeType && videoRecorder.mimeType.includes('video/')) 
                     ? videoRecorder.mimeType 
                     : 'video/webm';
      
      console.log(`Creating final video blob with MIME type: ${mimeType}`);
      
      // Create a blob from the recorded chunks with explicit MIME type
      const blob = new Blob(videoRecordedChunks, { type: mimeType });
      
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
    
    // Ensure proper MIME type for video blob
    const videoType = videoBlob.type || 'video/webm';
    if (videoType !== 'video/webm') {
      console.warn(`Video blob has unexpected MIME type: ${videoType}, forcing video/webm`);
      // Create a new blob with the correct MIME type
      videoBlob = new Blob([videoBlob], { type: 'video/webm' });
    }
    
    // Save metadata as JSON - create and save the file separately to avoid confusion
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metadataUrl = URL.createObjectURL(metadataBlob);
    const metadataLink = document.createElement('a');
    metadataLink.href = metadataUrl;
    metadataLink.download = `meeting-metadata-${roomName}-${timestamp}.json`;
    
    // Save video - ensure it has .webm extension and is downloaded first
    const videoUrl = URL.createObjectURL(videoBlob);
    const videoLink = document.createElement('a');
    videoLink.href = videoUrl;
    
    // Ensure the filename has the .webm extension
    let videoFilename = `meeting-recording-${roomName}-${timestamp}.webm`;
    // Double-check that the extension is included
    if (!videoFilename.toLowerCase().endsWith('.webm')) {
      videoFilename += '.webm';
    }
    videoLink.download = videoFilename;
    
    // Trigger video download first
    document.body.appendChild(videoLink);
    videoLink.click();
    document.body.removeChild(videoLink);
    
    // Short delay before triggering metadata download to avoid confusion
    setTimeout(() => {
      document.body.appendChild(metadataLink);
      metadataLink.click();
      document.body.removeChild(metadataLink);
      
      // Clean up URLs
      URL.revokeObjectURL(videoUrl);
      URL.revokeObjectURL(metadataUrl);
    }, 1000);
    
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
    if (!isScreenSharing) {
      console.log('Getting display media sources...');
      const result = await window.electronAPI.getScreenSources();
      
      if (!result.success || !result.sources) {
        throw new Error(result.error || 'Failed to get screen sources');
      }
      
      const sources = result.sources;
      screenShareSources.innerHTML = '';
      
      // Display sources as thumbnails in dialog
      sources.forEach(source => {
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'source-option';
        sourceDiv.innerHTML = `
          <img src="${source.thumbnail}" alt="${source.name}">
          <div class="source-name">${source.name}</div>
        `;
        
        // Add click event to select this source
        sourceDiv.addEventListener('click', () => {
          startScreenShare(source.id);
          screenShareDialog.classList.add('hidden');
        });
        
        screenShareSources.appendChild(sourceDiv);
      });
      
      screenShareDialog.classList.remove('hidden');
    } else {
      stopScreenShare();
    }
  } catch (error) {
    console.error('Error handling screen share:', error);
    addSystemMessage('Error starting screen share: ' + error.message);
  }
}

// Start screen sharing for the selected source
async function startScreenShare(sourceId) {
  try {
    console.log(`Starting screen share with source ID: ${sourceId}`);
    
    // Store the current camera stream if it exists
    const previousStream = localStream;
    
    // Use the desktopCapturer source ID with getUserMedia
    const screenStream = await navigator.mediaDevices.getUserMedia({
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
    
    if (!screenStream) {
      throw new Error('Failed to get screen share stream');
    }
    
    // Save the stream for later use
    screenShareStream = screenStream;
    isScreenSharing = true;
    
    // Update UI to show we're sharing
    shareScreenButton.textContent = 'Stop Sharing';
    shareScreenButton.classList.add('active');
    
    // Add to the set of screen sharing peers
    screenSharingPeers.add(ownPeerId);
    
    // Mark as active screen sharer
    activeScreenSharePeerId = ownPeerId;
    
    // Check if we can use the local video container
    // We need both the localVideo element to exist AND have a valid stream
    const localVideoExists = localVideo && localVideo.parentElement;
    const hasLocalStream = localStream && localStream.active && localStream.getVideoTracks().length > 0;
    const useVideoContainer = localVideoExists && hasLocalStream;
    
    if (useVideoContainer) {
      // Replace the local video stream with the screen stream
      localVideo.srcObject = screenStream;
      
      // Also store a reference to the local video (for recording purposes)
      screenVideoElement = localVideo;
      
      // Add screen share info overlay to local video
      const localVideoContainer = localVideo.closest('.video-container');
      const videoWrapper = localVideoContainer.querySelector('.video-wrapper') || localVideoContainer;
      
      // Create or update info overlay for screen share - make sure it doesn't block interaction
      let infoOverlay = videoWrapper.querySelector('.screen-share-info');
      if (!infoOverlay) {
        infoOverlay = document.createElement('div');
        infoOverlay.className = 'screen-share-info';
        infoOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
        videoWrapper.appendChild(infoOverlay);
      }
      
      // Update the overlay text
      infoOverlay.innerHTML = `
        <span class="screen-share-icon">🖥️</span>
        <span>Your Screen</span>
      `;
      
      // Add fullscreen button if it doesn't exist
      if (!videoWrapper.querySelector('.fullscreen-btn')) {
        const fullscreenButton = document.createElement('button');
        fullscreenButton.className = 'fullscreen-btn';
        fullscreenButton.innerHTML = '🔍';
        fullscreenButton.title = 'View in full screen';
        fullscreenButton.addEventListener('click', () => {
          openFullscreenView(screenStream, 'Your Screen', ownPeerId);
        });
        videoWrapper.appendChild(fullscreenButton);
      }
    } else {
      // No local video or no stream - create a separate container for the screen share
      console.log('Creating separate container for screen share (no camera or disabled camera)');
      const screenContainer = addScreenShareToGrid(ownPeerId, screenStream, 'Your Screen', false);
      
      // Store reference for later
      screenVideoElement = screenContainer.querySelector('video');
    }
    
    // Add the screen track to all peer connections
    const videoTrack = screenStream.getVideoTracks()[0];
    for (const [peerId, connection] of peerConnections.entries()) {
      try {
        console.log(`Adding screen share track to peer ${peerId}`);
        
        // Find existing video sender to replace track
        const senders = connection.getSenders();
        const videoSender = senders.find(sender => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          console.log('Replacing existing camera track with screen track');
          videoSender.replaceTrack(videoTrack);
        } else {
          console.log('No existing video sender, adding screen track as new track');
          connection.addTrack(videoTrack, screenStream);
        }
        
        // Send a message about the screen share
        const dataChannel = dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
          const message = JSON.stringify({
            type: 'screen-share-started',
            username: usernameInput.value,
            sourceName: 'Screen'
          });
          dataChannel.send(message);
        }
      } catch (error) {
        console.error(`Error adding screen track to peer ${peerId}:`, error);
      }
    }
    
    // Store previous local stream to restore when screen sharing stops
    previousLocalStream = previousStream;
    
    // Add system message
    addSystemMessage('You started sharing your screen');
    
  } catch (error) {
    console.error('Error starting screen share:', error);
    addSystemMessage(`Error sharing screen: ${error.message}`);
  }
}

// Stop screen sharing
function stopScreenShare() {
  try {
    console.log('Stopping screen share');
    
    if (!isScreenSharing || !screenShareStream) {
      console.warn('No active screen share to stop');
      return;
    }
    
    // Stop all tracks in the screen share stream
    screenShareStream.getTracks().forEach(track => {
      track.stop();
    });
    
    // Update UI
    shareScreenButton.textContent = 'Share Screen';
    shareScreenButton.classList.remove('active');
    
    // Mark as not sharing
    isScreenSharing = false;
    
    // Check if we used the local video or created a separate container
    const screenshareContainer = document.getElementById(`screen-share-${ownPeerId}`);
    
    // If we have a camera, we might have used the localVideo element
    const usedLocalVideo = !screenshareContainer && localVideo && localVideo.srcObject === screenShareStream;
    
    if (usedLocalVideo) {
      console.log('Restoring camera view after screen share');
      // Remove screen share info overlay from local video
      const localVideoContainer = localVideo.closest('.video-container');
      const infoOverlay = localVideoContainer.querySelector('.screen-share-info');
      if (infoOverlay) {
        infoOverlay.remove();
      }
      
      // Restore the previous camera stream if it exists
      if (previousLocalStream && previousLocalStream.active) {
        console.log('Restoring previous camera stream');
        localVideo.srcObject = previousLocalStream;
        
        // Replace screen tracks with camera tracks in all peer connections
        const videoTracks = previousLocalStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];
          for (const [peerId, connection] of peerConnections.entries()) {
            try {
              const senders = connection.getSenders();
              const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
              );
              
              if (videoSender) {
                console.log(`Replacing screen track with camera track for peer ${peerId}`);
                videoSender.replaceTrack(videoTrack);
              }
            } catch (error) {
              console.error(`Error replacing screen track for peer ${peerId}:`, error);
            }
          }
        } else {
          // Camera was disabled before screen sharing
          console.log('Camera was disabled before screen sharing, disabling video track');
          for (const [peerId, connection] of peerConnections.entries()) {
            try {
              const senders = connection.getSenders();
              const videoSender = senders.find(sender => 
                sender.track && sender.track.kind === 'video'
              );
              
              if (videoSender && videoSender.track) {
                console.log(`Stopping video track for peer ${peerId}`);
                videoSender.track.stop();
              }
            } catch (error) {
              console.error(`Error stopping video track for peer ${peerId}:`, error);
            }
          }
          
          // Show video disabled indicator
          const videoOffIndicator = localVideoContainer.querySelector('.video-off-indicator');
          if (videoOffIndicator) {
            videoOffIndicator.classList.remove('hidden');
          }
        }
      }
    } else if (screenshareContainer) {
      // We created a dedicated screen share container, remove it
      console.log('Removing dedicated screen share container');
      screenshareContainer.remove();
      
      // Handle the track replacement in peer connections
      for (const [peerId, connection] of peerConnections.entries()) {
        try {
          const senders = connection.getSenders();
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video' && 
            sender.track.readyState !== 'ended'
          );
          
          if (videoSender) {
            console.log(`Removing screen share track for peer ${peerId}`);
            // If we don't have a camera track to replace with, just remove this track
            if (!previousLocalStream || !previousLocalStream.getVideoTracks().length) {
              try {
                connection.removeTrack(videoSender);
              } catch (error) {
                console.error(`Failed to remove track, may already be removed: ${error.message}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error handling screen track removal for peer ${peerId}:`, error);
        }
      }
    } else {
      console.warn('Could not find screen share container or local video - may have been removed already');
    }
    
    // Clear stored variables
    screenShareStream = null;
    previousLocalStream = null;
    
    // Notify peers that we stopped sharing
    for (const [peerId, dataChannel] of dataChannels.entries()) {
      if (dataChannel && dataChannel.readyState === 'open') {
        const message = JSON.stringify({
          type: 'screen-share-stopped',
          username: usernameInput.value
        });
        dataChannel.send(message);
      }
    }
    
    // Remove from the set of sharing peers
    screenSharingPeers.delete(ownPeerId);
    
    // Remove active screen sharer if it was us
    if (activeScreenSharePeerId === ownPeerId) {
      activeScreenSharePeerId = null;
    }
    
    // Add system message
    addSystemMessage('You stopped sharing your screen');
    
  } catch (error) {
    console.error('Error stopping screen share:', error);
    addSystemMessage(`Error stopping screen share: ${error.message}`);
  }
}

// Add screen share to the video grid
function addScreenShareToGrid(peerId, stream, sourceName, isRemoteShare = false) {
  // Create screen share container
  const screenContainer = document.createElement('div');
  screenContainer.className = 'video-item screen-share-container';
  screenContainer.id = `screen-share-${peerId}`;
  
  // Add special styling for better visibility
  screenContainer.style.border = '3px solid #4caf50';
  screenContainer.style.borderRadius = '8px';
  screenContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  screenContainer.style.overflow = 'hidden';
  
  // If this is a remote share, add additional visual distinction
  if (isRemoteShare) {
    screenContainer.style.borderColor = '#e91e63'; // Pink border for remote shares
  }
  
  // Create video element - create a new one each time, don't reuse
  const screenVideo = document.createElement('video');
  screenVideo.className = 'screen-share-video';
  screenVideo.autoplay = true;
  screenVideo.playsInline = true;
  screenVideo.srcObject = stream;
  
  // Also store a reference to the most recent screen video (for recording purposes)
  screenVideoElement = screenVideo;
  
  // Create info overlay
  const infoOverlay = document.createElement('div');
  infoOverlay.className = 'screen-share-info';
  infoOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  infoOverlay.style.color = 'white';
  infoOverlay.style.padding = '8px';
  infoOverlay.style.position = 'absolute';
  infoOverlay.style.bottom = '0';
  infoOverlay.style.left = '0';
  infoOverlay.style.right = '0';
  infoOverlay.style.zIndex = '2';
  
  // Get the peer's username for display
  const peerUsername = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
  infoOverlay.innerHTML = `
    <span class="screen-share-icon">🖥️</span>
    <span>${peerId === ownPeerId ? 'Your Screen' : `${peerUsername}'s Screen`}: ${sourceName}</span>
  `;
  
  // Create fullscreen button
  const fullscreenButton = document.createElement('button');
  fullscreenButton.className = 'fullscreen-btn';
  fullscreenButton.innerHTML = '🔍';
  fullscreenButton.title = 'View in full screen';
  fullscreenButton.style.position = 'absolute';
  fullscreenButton.style.top = '8px';
  fullscreenButton.style.right = '8px';
  fullscreenButton.style.zIndex = '3';
  fullscreenButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  fullscreenButton.style.color = 'white';
  fullscreenButton.style.border = 'none';
  fullscreenButton.style.borderRadius = '50%';
  fullscreenButton.style.width = '36px';
  fullscreenButton.style.height = '36px';
  fullscreenButton.style.cursor = 'pointer';
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
  
  console.log(`Added screen share for ${peerId === ownPeerId ? 'local user' : peerUsername} to the video grid`);
  
  return screenContainer;
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
  // Call original function first
  originalHandleDataChannelMessage(peerId, message);
  
  // Handle screen sharing messages
  try {
    const data = JSON.parse(message);
    
    if (data.type === 'screen-share-started') {
      console.log(`Peer ${peerId} started screen sharing: ${data.sourceName}`);
      addSystemMessage(`${data.username} started sharing their screen: ${data.sourceName}`);
      
      // Track that this peer is sharing their screen
      if (!screenSharingPeers) {
        screenSharingPeers = new Set();
      }
      screenSharingPeers.add(peerId);
      
      // Also track as the active screen sharer for certain features
      activeScreenSharePeerId = peerId;
      
      // Find the peer's video container and add screen share info overlay
      const peerContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
      if (peerContainer) {
        const videoWrapper = peerContainer.querySelector('.video-wrapper');
        if (videoWrapper) {
          // Add or update screen share info overlay
          let infoOverlay = videoWrapper.querySelector('.screen-share-info');
          if (!infoOverlay) {
            infoOverlay = document.createElement('div');
            infoOverlay.className = 'screen-share-info';
            infoOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            infoOverlay.style.color = 'white';
            infoOverlay.style.padding = '8px';
            infoOverlay.style.position = 'absolute';
            infoOverlay.style.bottom = '0';
            infoOverlay.style.left = '0';
            infoOverlay.style.right = '0';
            infoOverlay.style.height = 'auto';
            infoOverlay.style.zIndex = '2';
            infoOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
            videoWrapper.appendChild(infoOverlay);
          }
          
          // Update overlay text
          infoOverlay.innerHTML = `
            <span class="screen-share-icon">🖥️</span>
            <span>${data.username}'s Screen: ${data.sourceName}</span>
          `;
        }
      }
      
    } else if (data.type === 'screen-share-stopped') {
      console.log(`Peer ${peerId} stopped screen sharing`);
      addSystemMessage(`${data.username} stopped sharing their screen`);
      
      // Remove screen share info overlay
      const peerContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
      if (peerContainer) {
        const infoOverlay = peerContainer.querySelector('.screen-share-info');
        if (infoOverlay) {
          infoOverlay.remove();
        }
      }
      
      // Remove this peer from the set of screen sharing peers
      if (screenSharingPeers) {
        screenSharingPeers.delete(peerId);
      }
      
      // Clear active screen sharer only if it was this peer
      if (activeScreenSharePeerId === peerId) {
        activeScreenSharePeerId = null;
      }
    }
  } catch (error) {
    // Not a JSON message or other error, ignore
    // This is expected for regular chat messages
  }
};

// Update the addTrack handler to detect incoming screen share tracks
const originalOnTrack = window.onTrack;
window.onTrack = function(event, peerId) {
  console.log(`onTrack event for peer ${peerId}:`, event);
  
  // We need to handle each track individually to separate screen shares from camera video
  if (event.track && event.streams && event.streams.length > 0) {
    const track = event.track;
    const stream = event.streams[0];
    
    // Check if this is a likely screen sharing track
    const settings = track.getSettings();
    const isVideoTrack = track.kind === 'video';
    
    // Screen share tracks typically have different properties
    const isScreenShare = isVideoTrack && (
      // Screen shares have high resolution
      (settings && settings.width > 1000 && settings.height > 700) ||
      // Or contain "screen" in track label
      track.label && track.label.toLowerCase().includes('screen') ||
      // Or in stream ID
      stream.id && stream.id.toLowerCase().includes('screen') ||
      // Or in transceiver mid (set by our code)
      (event.transceiver && event.transceiver.mid && event.transceiver.mid.includes('screen'))
    );
    
    if (isVideoTrack && isScreenShare) {
      console.log(`Detected screen share track from peer ${peerId}:`, settings);
      
      // Create a separate dedicated stream just for this screen track
      const screenOnlyStream = new MediaStream();
      screenOnlyStream.addTrack(track);
      
      // Get the peer's username
      const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
      
      // Add to UI as a separate screen share
      addScreenShareToGrid(peerId, screenOnlyStream, 'Shared Screen', true);
      
      // Add to the set of screen sharing peers
      if (!screenSharingPeers) {
        screenSharingPeers = new Set();
      }
      screenSharingPeers.add(peerId);
      
      // Also set as active screen share for recording
      activeScreenSharePeerId = peerId;
      
      // Notify all users about this screen share
      addSystemMessage(`${peerName} is sharing their screen`);
      
      // We still want to process the original stream with any other tracks
      // so do NOT return early
    }
  }
  
  // Always process the original stream as normal (for camera/audio)
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
      
      // Set username for video chat - strip domain part (.pds.hapa.ai)
      const handle = result.user.handle;
      const simplifiedHandle = handle.includes('.') ? handle.split('.')[0] : handle;
      usernameInput.value = simplifiedHandle;
      
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
            
            // Set username for video chat - strip domain part (.pds.hapa.ai)
            const handle = response.user.handle;
            const simplifiedHandle = handle.includes('.') ? handle.split('.')[0] : handle;
            usernameInput.value = simplifiedHandle;
            
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
      cleanupPeerConnection(peerId);
    }
    
    // Stop any screen sharing if active
    if (isScreenSharing) {
      stopScreenShare(); // Fixed function name from stopScreenSharing to stopScreenShare
    }
    
    // Stop video recording if active
    if (isVideoRecording) {
      stopVideoRecording();
    }
    
    // Stop local audio recording if active
    if (isRecording) {
      stopMediaRecording();
    }
    
    // Clear remote videos display
    document.getElementById('remote-videos').innerHTML = '';
    
    // Clear messages display
    document.getElementById('messages').innerHTML = '';
    
    // Clear all collections
    peers.clear();
    peerConnections.clear();
    dataChannels.clear();
    peerUsernames.clear();
    pendingIceCandidates.clear();
    remoteRecorders.clear();
    screenSharingPeers.clear();
    transcripts.clear();
    
    // Close any open popups or modals
    document.getElementById('transcript-popup').classList.add('hidden');
    document.getElementById('settings-popup').classList.add('hidden');
    document.getElementById('screen-share-dialog').classList.add('hidden');
    document.getElementById('fullscreen-dialog').classList.add('hidden');
    
    // Reset room tracking
    currentRoom = null;
    currentRoomSpan.textContent = '';
    
    // Update connection count
    updateConnectionCount();
    
    // Add system message
    addSystemMessage('Left the room');
    
    // Notify server that we're leaving the room
    try {
      await window.electronAPI.joinRoom(''); // Join empty room to leave current
    } catch (err) {
      console.warn('Error notifying server about leaving room:', err);
    }
    
    return true;
  } catch (error) {
    console.error('Error leaving room:', error);
    return false;
  }
}

// Handle leave room button click
async function handleLeaveRoom() {
  try {
    console.log('Leaving current room...');
    
    // Call the leaveRoom function (this handles all cleanup)
    leaveRoom();
    
    // Show the login screen
    loginScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    
    // Add a success message on the login screen
    const successMessage = document.createElement('div');
    successMessage.className = 'system-notification';
    successMessage.innerHTML = `
      <p>You have left the room successfully. You can join another room below.</p>
    `;
    
    // Insert at top of login screen
    loginScreen.insertBefore(successMessage, loginScreen.firstChild);
    
    // Remove the message after 10 seconds
    setTimeout(() => {
      successMessage.remove();
    }, 10000);
    
    // Clear the input fields
    messageInput.value = '';
  } catch (error) {
    console.error('Error leaving room:', error);
    alert(`Error leaving room: ${error.message}`);
  }
}

// Handle track events separately to detect screen sharing
function handleTrackEvent(event, peerId) {
  // Extract stream and track from the event
  const [remoteStream] = event.streams;
  const track = event.track;
  
  if (!remoteStream || !track) {
    console.warn(`No stream or track in event from peer ${peerId}`);
    return;
  }
  
  console.log(`Received ${track.kind} track from peer ${peerId}`, track);
  
  // If this is a video track, check if it's a screen share
  if (track.kind === 'video') {
    const settings = track.getSettings();
    
    // Check for screen share indicators
    const isScreenShare = 
      // Check the track label
      (track.label && track.label.toLowerCase().includes('screen')) ||
      // Check high resolution (typical for screen shares)
      (settings && settings.width > 1280 && settings.height > 720) ||
      // Check for custom mid we set during sending
      (event.transceiver && event.transceiver.mid && 
       event.transceiver.mid.toString().includes('screen')) ||
      // Check stream ID
      (remoteStream.id && remoteStream.id.toLowerCase().includes('screen'));
    
    if (isScreenShare) {
      console.log(`Detected screen share track from peer ${peerId}`);
      
      // Add to the set of screen sharing peers
      screenSharingPeers.add(peerId);
      
      // Mark this peer as the active screen sharer
      activeScreenSharePeerId = peerId;
      
      // Get peer's name
      const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
      
      // Notify user
      addSystemMessage(`${peerName} started sharing their screen`);
      
      // We'll use the same video element, so just continue processing
    }
  }
  
  // Always add or update the stream in the UI
  // Check if we already have a video container for this peer
  const existingContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
  
  if (!existingContainer) {
    // No existing container, add the entire stream (will handle camera and audio)
    const container = addRemoteStream(peerId, remoteStream);
    
    // Add fullscreen button to this container
    addFullscreenButtonToContainer(container, remoteStream, peerId);
  } else {
    // Already have a container, update the stream
    const videoElement = existingContainer.querySelector('video');
    if (videoElement) {
      // Update the stream
      videoElement.srcObject = remoteStream;
      
      // Check if this peer is screen sharing
      if (screenSharingPeers.has(peerId)) {
        // Add screen share indicator
        const videoWrapper = existingContainer.querySelector('.video-wrapper');
        if (videoWrapper) {
          let infoOverlay = videoWrapper.querySelector('.screen-share-info');
          if (!infoOverlay) {
            infoOverlay = document.createElement('div');
            infoOverlay.className = 'screen-share-info';
            infoOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            infoOverlay.style.color = 'white';
            infoOverlay.style.padding = '8px';
            infoOverlay.style.position = 'absolute';
            infoOverlay.style.bottom = '0';
            infoOverlay.style.left = '0';
            infoOverlay.style.right = '0';
            infoOverlay.style.height = 'auto';
            infoOverlay.style.zIndex = '2';
            infoOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
            videoWrapper.appendChild(infoOverlay);
          }
          
          // Update the overlay text
          const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
          infoOverlay.innerHTML = `
            <span class="screen-share-icon">🖥️</span>
            <span>${peerName}'s Screen</span>
          `;
        }
      }
      
      // Make sure there's a fullscreen button
      addFullscreenButtonToContainer(existingContainer, remoteStream, peerId);
    }
  }
}

// Helper function to add fullscreen button to a container
function addFullscreenButtonToContainer(container, stream, peerId) {
  // Get the video wrapper
  const videoWrapper = container.querySelector('.video-wrapper');
  if (!videoWrapper) return;
  
  // Check if we already have a fullscreen button
  if (!videoWrapper.querySelector('.fullscreen-btn')) {
    const fullscreenButton = document.createElement('button');
    fullscreenButton.className = 'fullscreen-btn';
    fullscreenButton.innerHTML = '🔍';
    fullscreenButton.title = 'View in full screen';
    
    // Get peer's name
    const peerName = peerUsernames.get(peerId) || `Peer ${peerId.substring(0, 6)}`;
    
    // Make sure we get the current stream from the video element, not the one passed in
    // This ensures we show whatever content is currently displayed (camera or screen share)
    fullscreenButton.addEventListener('click', () => {
      const videoElement = videoWrapper.querySelector('video');
      if (videoElement && videoElement.srcObject) {
        const currentStream = videoElement.srcObject;
        const sourceName = screenSharingPeers.has(peerId) ? `${peerName}'s Screen` : peerName;
        openFullscreenView(currentStream, sourceName, peerId);
      } else {
        // Fallback to the stream passed in
        const sourceName = screenSharingPeers.has(peerId) ? `${peerName}'s Screen` : peerName;
        openFullscreenView(stream, sourceName, peerId);
      }
    });
    
    videoWrapper.appendChild(fullscreenButton);
  }
}

// Function to render a frame of the video recording
function renderFrame() {
  // If not recording, exit early
  if (!isVideoRecording) return;
  
  const videoCanvas = document.createElement('canvas');
  videoCanvas.width = 1280;
  videoCanvas.height = 720;
  const ctx = videoCanvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
  
  // Calculate sizes for grid layout
  // Main video area takes 70% of width, chat takes 30%
  const videoAreaWidth = Math.floor(videoCanvas.width * 0.7);
  const chatAreaX = videoAreaWidth;
  const chatAreaWidth = videoCanvas.width - videoAreaWidth;
  
  // Draw separation line
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(videoAreaWidth, 0);
  ctx.lineTo(videoAreaWidth, videoCanvas.height);
  ctx.stroke();
  
  // Draw timestamp
  const timestamp = new Date().toLocaleTimeString();
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(timestamp, 10, 30);
  
  // Draw room ID
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`Room: ${currentRoomSpan.textContent}`, videoAreaWidth - 10, 30);
  
  // Draw local video
  if (localVideo.srcObject && localVideo.srcObject.getVideoTracks().length > 0 && localVideo.videoWidth > 0) {
    ctx.save();
    
    // Position in bottom right of video area
    const aspectRatio = localVideo.videoWidth / localVideo.videoHeight;
    const width = Math.min(320, videoAreaWidth * 0.3);
    const height = width / aspectRatio;
    const x = videoAreaWidth - width - 20;
    const y = videoCanvas.height - height - 20;
    
    // Draw a border
    ctx.strokeStyle = '#3f51b5';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    
    // Draw the video
    ctx.drawImage(localVideo, x, y, width, height);
    
    // Add username overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y + height - 30, width, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('You', x + 10, y + height - 10);
    
    ctx.restore();
  }
  
  // Draw remote videos in a grid
  const remoteVideos = document.querySelectorAll('#remote-videos video:not([id^="screen-"]):not(.fullscreen-video)');
  if (remoteVideos.length > 0) {
    ctx.save();
    
    // Calculate grid dimensions
    const maxPerRow = Math.min(remoteVideos.length, 2);
    const rows = Math.ceil(remoteVideos.length / maxPerRow);
    const vidWidth = Math.floor((videoAreaWidth - 40) / maxPerRow);
    const vidHeight = Math.floor((videoCanvas.height - 60) / rows);
    
    remoteVideos.forEach((video, index) => {
      if (video.srcObject && video.srcObject.getVideoTracks().length > 0 && video.videoWidth > 0) {
        const row = Math.floor(index / maxPerRow);
        const col = index % maxPerRow;
        
        const x = 20 + col * vidWidth;
        const y = 60 + row * vidHeight;
        
        // Get peer username from container
        const container = video.closest('.remote-video-container');
        let username = 'Peer';
        if (container && container.dataset.peerUsername) {
          username = container.dataset.peerUsername;
        }
        
        // Draw border
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, vidWidth - 10, vidHeight - 10);
        
        // Draw video
        ctx.drawImage(video, x, y, vidWidth - 10, vidHeight - 10);
        
        // Add username overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y + vidHeight - 40, vidWidth - 10, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(username, x + 10, y + vidHeight - 20);
      }
    });
    
    ctx.restore();
  }
  
  // Draw chat messages
  ctx.save();
  
  // Chat area header
  ctx.fillStyle = '#333333';
  ctx.fillRect(chatAreaX, 0, chatAreaWidth, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Chat', chatAreaX + chatAreaWidth / 2, 25);
  
  // Draw chat messages
  const messageY = 60;
  const messageHeight = 20;
  const maxMessages = Math.floor((videoCanvas.height - messageY) / messageHeight);
  
  let displayMessages = [];
  
  // If recording in progress, use the recorded messages
  if (recordedChatMessages.length > 0) {
    displayMessages = [...recordedChatMessages];
  }
  
  // Only show the last 'maxMessages' messages
  if (displayMessages.length > maxMessages) {
    displayMessages = displayMessages.slice(displayMessages.length - maxMessages);
  }
  
  displayMessages.forEach((msg, index) => {
    const y = messageY + index * messageHeight;
    
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // Calculate width of username for proper spacing
    ctx.font = 'bold 14px Arial';
    const usernameWidth = ctx.measureText(msg.username + ':').width + 10; // Add some spacing

    // Draw username in bold
    ctx.fillStyle = msg.isSystem ? '#ffeb3b' : '#4fc3f7';
    ctx.fillText(msg.username + ':', chatAreaX + 10, y);
    
    // Draw message content after username with proper spacing
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    
    // Calculate max width for the text (with some margin)
    const maxWidth = chatAreaWidth - 20 - usernameWidth;
    const textX = chatAreaX + 10 + usernameWidth;
    
    // Simple word wrap for message content
    const words = msg.content.split(' ');
    let line = '';
    let lineY = y;
    
    words.forEach(word => {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = ctx.measureText(testLine).width;
      
      if (testWidth > maxWidth && line !== '') {
        // Draw the current line
        ctx.fillText(line, textX, lineY);
        // Start a new line
        line = word;
        lineY += messageHeight;
      } else {
        line = testLine;
      }
    });
    
    // Draw the last line
    if (line) {
      ctx.fillText(line, textX, lineY);
    }
  });
  
  // Draw transcripts if they are recorded and not empty
  if (recordedTranscripts.length > 0) {
    // Draw transcripts header
    const transcriptHeaderY = Math.min(videoCanvas.height - 120, messageY + displayMessages.length * messageHeight + 40);
    ctx.fillStyle = '#333333';
    ctx.fillRect(chatAreaX, transcriptHeaderY, chatAreaWidth, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Transcripts', chatAreaX + chatAreaWidth / 2, transcriptHeaderY + 20);
    
    // Draw transcript content
    let transcriptY = transcriptHeaderY + 40;
    
    // Only show a few recent transcripts to not overcrowd
    const maxTranscripts = 3;
    const recentTranscripts = recordedTranscripts.slice(-maxTranscripts);
    
    recentTranscripts.forEach(transcript => {
      // Calculate username width for proper spacing
      ctx.font = 'bold 14px Arial';
      const usernameWidth = ctx.measureText(transcript.username + ':').width + 10;
      
      // Draw username
      ctx.fillStyle = '#26a69a';
      ctx.textAlign = 'left';
      ctx.fillText(transcript.username + ':', chatAreaX + 10, transcriptY);
      
      // Draw transcript content
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ffffff';
      
      // Draw transcript with simple word wrap
      const maxWidth = chatAreaWidth - 20 - usernameWidth;
      const textX = chatAreaX + 10 + usernameWidth;
      
      // Simple word wrap
      const words = transcript.content.split(' ');
      let line = '';
      let lineY = transcriptY;
      
      words.forEach(word => {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = ctx.measureText(testLine).width;
        
        if (testWidth > maxWidth && line !== '') {
          ctx.fillText(line, textX, lineY);
          line = word;
          lineY += 20;
        } else {
          line = testLine;
        }
      });
      
      if (line) {
        ctx.fillText(line, textX, lineY);
      }
      
      transcriptY = lineY + 30;
    });
  }
  
  ctx.restore();
  
  // Store canvas data for recording
  videoCanvas._lastFrameTime = Date.now();
  return videoCanvas;
}

// Task management functions
async function createTask() {
  try {
    // Prevent multiple simultaneous task creation
    if (isCreatingTask) {
      console.log('Task creation already in progress');
      alert('Task creation is already in progress. Please wait.');
      return;
    }
    
    // Check if there's already a pending task in the room
    if (isPendingTask && currentPendingTask) {
      console.log('There is already a pending task waiting for votes');
      alert('There is already a task waiting for votes. Please vote on the current task first.');
      return;
    }
    
    isCreatingTask = true;
    
    // Get our own peer ID from the main process
    const peerId = await window.electronAPI.getOwnId();
    if (!peerId) {
      console.error("Failed to get local peer ID");
      alert("Cannot create task: Unable to get local peer ID");
      isCreatingTask = false;
      return;
    }
    
    // Store our peer ID for voting
    ownPeerId = peerId;
    
    // Prepare the data to summarize (from lastTaskTimestamp to now)
    const now = Date.now();
    
    console.log("Transcript data structure:", Array.from(transcripts.entries()).map(([username, entries]) => 
      `${username}: ${entries.length} entries`));
    console.log("Using lastTaskTimestamp:", new Date(lastTaskTimestamp).toISOString());
    
    // Collect transcripts from lastTaskTimestamp to now
    let transcriptsToSummarize = [];
    transcripts.forEach((entries, username) => {
      console.log(`Processing transcripts for ${username}: ${entries.length} entries`);
      entries.forEach(entry => {
        // Convert string timestamp to number if needed
        const entryTimestamp = typeof entry.timestamp === 'string' 
          ? new Date(entry.timestamp).getTime() 
          : entry.timestamp;
        
        if ((entryTimestamp > lastTaskTimestamp) && (entryTimestamp < now)) {
          transcriptsToSummarize.push({
            timestamp: entryTimestamp,
            username,
            text: entry.text,
            type: 'transcript'
          });
          console.log(`Added transcript from ${username}: "${entry.text}"`);
        }
      });
    });
    
    // Get chat messages from lastTaskTimestamp to now
    // Get all message elements in the chat
    const messageElements = document.querySelectorAll('.messages .message');
    console.log(`Found ${messageElements.length} message elements in DOM`);
    
    const chatMessagesToSummarize = Array.from(messageElements).map(msgElement => {
      const meta = msgElement.querySelector('.message-meta')?.textContent || '';
      const text = msgElement.querySelector('.message-text')?.textContent || '';
      
      // Extract username and time from meta (format: "username • time")
      const parts = meta.split(' • ');
      const username = parts[0] || 'Unknown';
      
      // Create a timestamp from the time string (this is approximate)
      const timeString = parts[1] || '';
      // Parse the time string - this is a basic approximation
      let timestamp = now; // Default to current time if parsing fails
      if (timeString) {
        try {
          const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
          const date = new Date();
          date.setHours(hours || 0, minutes || 0, 0, 0);
          timestamp = date.getTime();
          
          // If timestamp is in the future (due to hour parsing), subtract a day
          if (timestamp > now) {
            timestamp -= 24 * 60 * 60 * 1000;
          }
        } catch (err) {
          console.error('Error parsing message time:', err);
        }
      }
      
      return {
        timestamp,
        username,
        text,
        type: 'chat'
      };
    }).filter(msg => (msg.timestamp > lastTaskTimestamp) && (msg.timestamp < now));
    
    // Log counts for debugging
    console.log(`Found ${transcriptsToSummarize.length} transcript entries and ${chatMessagesToSummarize.length} chat messages since ${new Date(lastTaskTimestamp).toLocaleTimeString()}`);
    
    // Debug transcription data
    if (transcriptsToSummarize.length === 0) {
      console.warn("No transcript data found. Check if transcripts are being stored correctly.");
      console.log("Current lastTaskTimestamp:", new Date(lastTaskTimestamp).toISOString());
      console.log("Current time:", new Date(now).toISOString());
      
      // Print some raw transcript data regardless of timestamp
      let totalTranscriptEntries = 0;
      transcripts.forEach((entries, username) => {
        totalTranscriptEntries += entries.length;
        if (entries.length > 0) {
          console.log(`Sample entry for ${username}:`, entries[0]);
        }
      });
      console.log(`Total transcript entries available: ${totalTranscriptEntries}`);
    }
    
    // Combine and sort all messages by timestamp
    const allMessages = [...transcriptsToSummarize, ...chatMessagesToSummarize]
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (allMessages.length === 0) {
      alert('No conversation data available since the last task was created');
      isCreatingTask = false;
      return;
    }
    
    console.log('Creating task from conversation with', allMessages.length, 'items');
    console.log('Sample messages:', allMessages.slice(0, 3));
    
    // Show a generating overlay
    const overlay = document.createElement('div');
    overlay.className = 'app-exit-overlay';
    overlay.innerHTML = '<div class="exit-message">Creating task from conversation, please wait...</div>';
    document.body.appendChild(overlay);
    
    // Format the conversation data for GPT
    const formattedConversation = allMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.username} (${msg.type}): ${msg.text}`
    ).join('\n');
    
    // Ask GPT to summarize and convert to a task
    const taskCreationPrompt = `
      Please summarize the following conversation and convert it into a clear, actionable task.
      Focus on commitments, decisions, and action items mentioned. 
      Keep the task brief (under 150 characters if possible) and specific.

      CONVERSATION:
      ${formattedConversation}
      
      TASK:
    `;
    
    // Call the API to generate the task
    const result = await window.electronAPI.generateTaskFromConversation(taskCreationPrompt);
    
    // Remove overlay
    document.body.removeChild(overlay);
    
    if (!result.success) {
      console.error('Failed to generate task:', result.error);
      alert(`Error creating task: ${result.error}`);
      isCreatingTask = false;
      return;
    }
    
    // Create a new task object
    const taskId = generateUniqueTaskId();
    const task = {
      id: taskId,
      text: result.task,
      createdAt: now,
      createdBy: usernameInput.value.trim() || 'You',
      status: 'pending', // pending, accepted, rejected
      fromTimestamp: lastTaskTimestamp,
      toTimestamp: now
    };
    
    // Add to tasks array
    tasks.push(task);
    
    // Set as the current pending task
    currentPendingTask = task;
    isPendingTask = true;
    
    // Create a Map to store votes for this task
    taskVotes.set(taskId, new Map());
    
    // Update last task timestamp for next task creation
    // This should be propagated to all peers along with the task
    lastTaskTimestamp = now;
    
    // Create and show the task card
    createTaskCard(task);
    
    // Broadcast the task to other peers
    broadcastNewTask(task);
    
    // Display a message that the task has been created
    addSystemMessage(`Task created: "${task.text}". Please vote to accept or reject.`);
    
    isCreatingTask = false;
    console.log('Task created successfully:', task);
  } catch (error) {
    console.error('Error creating task:', error);
    alert(`Error creating task: ${error.message || 'Unknown error'}`);
    isCreatingTask = false;
  }
}

// Create a UI card for a new task
function createTaskCard(task) {
  // Check for any existing task cards and remove them
  const existingTaskCard = document.getElementById('task-card-container');
  if (existingTaskCard) {
    existingTaskCard.remove();
  }

  // Create task card container
  const taskCardContainer = document.createElement('div');
  taskCardContainer.id = 'task-card-container';
  taskCardContainer.className = 'task-card-container';

  // Create task card
  const taskCard = document.createElement('div');
  taskCard.className = 'task-card';
  taskCard.dataset.taskId = task.id;

  // Add task content
  taskCard.innerHTML = `
    <div class="task-header">
      <h3>Task</h3>
      <div class="task-meta">
        <span class="task-creator">${task.createdBy}</span>
        <span class="task-time">${new Date(task.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
    <div class="task-content">${task.text}</div>
    <div class="task-actions">
      <button class="task-btn accept-btn" data-action="accept">Accept</button>
      <button class="task-btn reject-btn" data-action="reject">Reject</button>
      <div class="task-votes">
        <span class="accept-count">0</span>
        <span class="reject-count">0</span>
      </div>
    </div>
  `;

  // Add the task card to the container
  taskCardContainer.appendChild(taskCard);

  // Get chat container
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) {
    console.error('Chat container not found for task card insertion');
    return null;
  }

  // Get messages container
  const messagesContainer = document.querySelector('.messages-container');

  // Ensure proper DOM insertion
  if (messagesContainer && chatContainer.contains(messagesContainer)) {
    // If messagesContainer exists and is a child of chatContainer, insert before it
    chatContainer.insertBefore(taskCardContainer, messagesContainer);
  } else {
    // Otherwise, insert at the top of the chat container
    if (chatContainer.firstChild) {
      chatContainer.insertBefore(taskCardContainer, chatContainer.firstChild);
    } else {
      chatContainer.appendChild(taskCardContainer);
    }
    console.log('Inserted task card at the top of chat container');
  }

  // Get vote buttons
  const acceptBtn = taskCard.querySelector('.accept-btn');
  const rejectBtn = taskCard.querySelector('.reject-btn');
  
  // Get vote count elements
  const acceptCount = taskCard.querySelector('.accept-count');
  const rejectCount = taskCard.querySelector('.reject-count');
  
  // Update vote counts initially
  updateTaskVoteCounts(task.id, acceptCount, rejectCount);
  
  // Add event listeners for voting
  acceptBtn.addEventListener('click', () => handleVote(task.id, 'accept'));
  rejectBtn.addEventListener('click', () => handleVote(task.id, 'reject'));
  
  // Check if this user has already voted
  if (taskVotes.has(task.id) && ownPeerId && taskVotes.get(task.id).has(ownPeerId)) {
    // User has already voted
    acceptBtn.disabled = true;
    rejectBtn.disabled = true;
    
    const userVote = taskVotes.get(task.id).get(ownPeerId);
    // Highlight the button they voted for
    if (userVote.vote === 'accept') {
      acceptBtn.classList.add('voted');
    } else if (userVote.vote === 'reject') {
      rejectBtn.classList.add('voted');
    }
  }

  // Disable the Create Task button while there's a pending task
  const createTaskBtn = document.getElementById('create-task-btn');
  if (createTaskBtn) {
    createTaskBtn.disabled = isPendingTask;
    if (isPendingTask) {
      createTaskBtn.title = "Cannot create a new task while there's a pending task";
    } else {
      createTaskBtn.title = "Create a task from the conversation";
    }
  }

  console.log(`Task card created for task ${task.id} with text: "${task.text}"`);
  return taskCardContainer;
}

// Handle voting on a task (accept or reject)
function handleVote(taskId, voteType) {
  // Don't allow voting if there's no pending task
  if (!isPendingTask || !currentPendingTask || currentPendingTask.id !== taskId) {
    console.warn('Cannot vote: no pending task or task ID mismatch');
    return;
  }
  
  // Get the task card
  const taskCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  if (!taskCard) {
    console.error('Task card not found for voting');
    return;
  }
  
  // Get the task from our array
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    console.error('Task not found for voting');
    return;
  }
  
  // Check if user has already voted
  if (taskVotes.has(taskId) && ownPeerId && taskVotes.get(taskId).has(ownPeerId)) {
    console.warn('User has already voted on this task');
    return;
  }
  
  // Create vote object
  const vote = {
    peerId: ownPeerId,
    username: usernameInput.value.trim() || 'You',
    vote: voteType
  };
  
  // Store the vote locally
  if (!taskVotes.has(taskId)) {
    taskVotes.set(taskId, new Map());
  }
  taskVotes.get(taskId).set(ownPeerId, vote);
  
  // Disable voting buttons and highlight selected vote
  const acceptBtn = taskCard.querySelector('.accept-btn');
  const rejectBtn = taskCard.querySelector('.reject-btn');
  if (acceptBtn) acceptBtn.disabled = true;
  if (rejectBtn) rejectBtn.disabled = true;
  
  if (voteType === 'accept' && acceptBtn) {
    acceptBtn.classList.add('voted');
  } else if (voteType === 'reject' && rejectBtn) {
    rejectBtn.classList.add('voted');
  }
  
  // Update vote counts
  const acceptCount = taskCard.querySelector('.accept-count');
  const rejectCount = taskCard.querySelector('.reject-count');
  updateTaskVoteCounts(taskId, acceptCount, rejectCount);
  
  // Show a message that the user has voted
  addSystemMessage(`You voted to ${voteType} the task: "${task.text}"`);
  
  // Broadcast the vote to all peers via Hypercore
  broadcastVote(taskId, voteType);
  
  // Check if task is resolved (accepted or rejected)
  checkTaskResolution(taskId);
}

// Update the vote counts for a task
function updateTaskVoteCounts(taskId, acceptCountEl, rejectCountEl) {
  if (!taskVotes.has(taskId)) {
    console.warn('No votes available for task', taskId);
    return;
  }
  
  // Count the votes
  let acceptCount = 0;
  let rejectCount = 0;
  
  taskVotes.get(taskId).forEach(vote => {
    if (vote.vote === 'accept') acceptCount++;
    else if (vote.vote === 'reject') rejectCount++;
  });
  
  // Update the UI elements if provided
  if (acceptCountEl) acceptCountEl.textContent = acceptCount;
  if (rejectCountEl) rejectCountEl.textContent = rejectCount;
  
  return { acceptCount, rejectCount };
}

// Check if a task is resolved based on votes
function checkTaskResolution(taskId) {
  // Find the task
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'pending') {
    return; // Task is already resolved or not found
  }
  
  // Get vote counts
  const votes = taskVotes.get(taskId);
  if (!votes) return;
  
  let acceptCount = 0;
  let rejectCount = 0;
  votes.forEach(vote => {
    if (vote.vote === 'accept') acceptCount++;
    else if (vote.vote === 'reject') rejectCount++;
  });
  
  // Calculate total participants (peers + self)
  const totalParticipants = peers.size + 1;
  
  // Check if we have enough votes to make a decision
  const hasEnoughVotes = (acceptCount + rejectCount) >= totalParticipants;
  const hasMajorityAccept = acceptCount > totalParticipants / 2;
  const hasMajorityReject = rejectCount > totalParticipants / 2;
  
  // Task is accepted if majority votes to accept
  if (hasMajorityAccept || (hasEnoughVotes && acceptCount > rejectCount)) {
    resolveTask(task, 'accepted');
  }
  // Task is rejected if majority votes to reject
  else if (hasMajorityReject || (hasEnoughVotes && rejectCount >= acceptCount)) {
    resolveTask(task, 'rejected');
  }
}

// Resolve a task (accept or reject)
function resolveTask(task, resolution) {
  console.log(`Resolving task ${task.id} as ${resolution}`);
  
  // Update task status
  task.status = resolution;
  
  // Update the task in our array
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  if (taskIndex !== -1) {
    tasks[taskIndex] = task;
  }
  
  // Update the UI
  updateTaskCardUI(task);
  
  // If accepted, add to accepted tasks array and to-do list
  if (resolution === 'accepted') {
    // Add to accepted tasks array if not already there
    if (!acceptedTasks.find(t => t.id === task.id)) {
      acceptedTasks.push(task);
      console.log(`Task ${task.id} added to acceptedTasks array. Total: ${acceptedTasks.length}`);
    }
    
    // Add to to-do list UI
    addTaskToTodoList(task);
    
    // Display notification
    addSystemMessage(`Task accepted and added to To-Do list: "${task.text}"`);
    
    // Make sure lastTaskTimestamp is updated to this task's toTimestamp
    if (task.toTimestamp > lastTaskTimestamp) {
      lastTaskTimestamp = task.toTimestamp;
      console.log(`Updated lastTaskTimestamp to ${new Date(lastTaskTimestamp).toLocaleTimeString()}`);
    }
  } else {
    // Display notification for rejected tasks
    addSystemMessage(`Task rejected: "${task.text}"`);
  }
  
  // Remove pending task status
  isPendingTask = false;
  currentPendingTask = null;
  
  // Re-enable the Create Task button
  const createTaskBtn = document.getElementById('create-task-btn');
  if (createTaskBtn) {
    createTaskBtn.disabled = false;
    createTaskBtn.title = "Create a task from the conversation";
  }
  
  // After a delay, remove the task card
  setTimeout(() => {
    const taskCard = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
    if (taskCard) {
      taskCard.style.animation = 'fadeOut 0.5s';
      setTimeout(() => {
        if (taskCard.parentNode) {
          taskCard.parentNode.remove();
        }
      }, 500);
    }
  }, 3000);
}

// Update the task card UI based on status
function updateTaskCardUI(task) {
  const taskCard = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
  if (!taskCard) return;
  
  // Update class based on status
  taskCard.classList.remove('pending', 'accepted', 'rejected');
  taskCard.classList.add(task.status);
  
  // Update UI elements
  const voteButtons = taskCard.querySelector('.task-actions');
  if (voteButtons) {
    if (task.status === 'accepted') {
      voteButtons.innerHTML = '<div class="status-badge accepted">Accepted ✓</div>';
    } else if (task.status === 'rejected') {
      voteButtons.innerHTML = '<div class="status-badge rejected">Rejected ✗</div>';
    }
  }
}

// Broadcast a new task to all peers
function broadcastNewTask(task) {
  console.log(`Broadcasting new task to all peers:`, task);
  
  // Make sure required fields are present
  const requiredFields = ['id', 'text', 'createdAt', 'createdBy', 'status', 'fromTimestamp', 'toTimestamp'];
  for (const field of requiredFields) {
    if (task[field] === undefined) {
      console.error(`Task missing required field ${field}`, task);
      return;
    }
  }
  
  // Send task via Hypercore instead of directly via data channels
  // This ensures all peers receive the task through the reliable Hypercore protocol
  window.electronAPI.sendTask(task)
    .then(result => {
      if (result.success) {
        console.log('Task sent successfully via Hypercore');
      } else {
        console.error('Failed to send task via Hypercore:', result.error);
        addSystemMessage(`Error: Failed to send task (${result.error})`);
      }
    })
    .catch(err => {
      console.error('Error sending task via Hypercore:', err);
      addSystemMessage(`Error: Failed to send task (${err.message || 'Unknown error'})`);
    });
  
  // Disable the Create Task button since there's now a pending task
  const createTaskBtn = document.getElementById('create-task-btn');
  if (createTaskBtn) {
    createTaskBtn.disabled = true;
    createTaskBtn.title = "Cannot create a new task while there's a pending task";
  }
}

// Add debug UI for easier testing
document.addEventListener('DOMContentLoaded', () => {
  // Create a debug button for testing purposes
  const debugContainer = document.createElement('div');
  debugContainer.style.position = 'fixed';
  debugContainer.style.bottom = '20px';
  debugContainer.style.left = '20px';
  debugContainer.style.zIndex = '1000';
  debugContainer.style.display = 'flex';
  debugContainer.style.flexDirection = 'column';
  debugContainer.style.gap = '10px';
  
  const addTestDataBtn = document.createElement('button');
  addTestDataBtn.textContent = 'Add Test Transcript Data';
  addTestDataBtn.style.padding = '8px';
  addTestDataBtn.style.backgroundColor = '#4caf50';
  addTestDataBtn.style.color = 'white';
  addTestDataBtn.style.border = 'none';
  addTestDataBtn.style.borderRadius = '4px';
  addTestDataBtn.style.cursor = 'pointer';
  addTestDataBtn.addEventListener('click', () => {
    window.addTestTranscriptData();
  });
  
  const debugTaskBtn = document.createElement('button');
  debugTaskBtn.textContent = 'Debug Task Creation';
  debugTaskBtn.style.padding = '8px';
  debugTaskBtn.style.backgroundColor = '#2196f3';
  debugTaskBtn.style.color = 'white';
  debugTaskBtn.style.border = 'none';
  debugTaskBtn.style.borderRadius = '4px';
  debugTaskBtn.style.cursor = 'pointer';
  debugTaskBtn.addEventListener('click', () => {
    console.log('===== DEBUG TASK CREATION =====');
    console.log('transcripts Map:', transcripts);
    console.log('lastTaskTimestamp:', lastTaskTimestamp, 'Date:', new Date(lastTaskTimestamp).toISOString());
    
    // Count total transcript entries
    let totalEntries = 0;
    transcripts.forEach((entries) => {
      totalEntries += entries.length;
    });
    console.log('Total transcript entries:', totalEntries);
    
    // Check DOM for message elements
    const messages = document.querySelectorAll('.messages .message');
    console.log('Chat messages in DOM:', messages.length);
    
    // Execute task creation
    createTask()
      .then(() => console.log('Task creation completed'))
      .catch(err => console.error('Task creation failed:', err));
  });
  
  debugContainer.appendChild(addTestDataBtn);
  debugContainer.appendChild(debugTaskBtn);
  
  // Add to DOM when chat screen is visible
  const chatScreen = document.getElementById('chat-screen');
  if (chatScreen) {
    // Only add in development or if URL has debug=true parameter
    const isDebugMode = window.location.search.includes('debug=true') || 
                        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
    
    if (isDebugMode) {
      document.body.appendChild(debugContainer);
    }
  }
});

// Broadcast a vote to all peers
function broadcastVote(taskId, voteType) {
  console.log(`Broadcasting vote on task ${taskId} to all peers: ${voteType}`);
  
  // Send vote via Hypercore instead of directly via data channels
  // This ensures all peers receive the vote through the reliable Hypercore protocol
  window.electronAPI.sendVote(taskId, voteType)
    .then(result => {
      if (result.success) {
        console.log('Vote sent successfully via Hypercore');
      } else {
        console.error('Failed to send vote via Hypercore:', result.error);
        addSystemMessage(`Error: Failed to send vote (${result.error})`);
      }
    })
    .catch(err => {
      console.error('Error sending vote via Hypercore:', err);
      addSystemMessage(`Error: Failed to send vote (${err.message || 'Unknown error'})`);
    });
}

// Handle a vote received from a peer
function handleReceivedVote(data) {
  const { taskId, vote, peerId, username } = data;
  
  // Validate data
  if (!taskId || !vote || !peerId) {
    console.error('Invalid vote data received:', data);
    return;
  }
  
  // IMPORTANT: Check if we've already processed this exact vote
  // This prevents infinite rebroadcast loops
  if (taskVotes.has(taskId) && taskVotes.get(taskId).has(peerId)) {
    const existingVote = taskVotes.get(taskId).get(peerId);
    if (existingVote.vote === vote) {
      // Skip processing if this is the same vote we already have
      console.log(`Skipping duplicate vote from ${username} (${peerId}) for task ${taskId}: ${vote}`);
      return;
    }
  }
  
  console.log(`Processing vote from ${username} (${peerId}) for task ${taskId}: ${vote}`);
  
  // Check if we have this task
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    console.warn(`Received vote for unknown task ${taskId}`);
    return;
  }
  
  // Store the vote
  if (!taskVotes.has(taskId)) {
    taskVotes.set(taskId, new Map());
  }
  
  // Create vote object
  const voteObj = { peerId, username, vote };
  taskVotes.get(taskId).set(peerId, voteObj);
  
  // Update the UI if the task card exists
  const taskCard = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
  if (taskCard) {
    const acceptCount = taskCard.querySelector('.accept-count');
    const rejectCount = taskCard.querySelector('.reject-count');
    updateTaskVoteCounts(taskId, acceptCount, rejectCount);
    
    // Mark voted button if this is the current user's vote
    if (peerId === ownPeerId) {
      const acceptBtn = taskCard.querySelector('.accept-btn');
      const rejectBtn = taskCard.querySelector('.reject-btn');
      
      if (acceptBtn) acceptBtn.disabled = true;
      if (rejectBtn) rejectBtn.disabled = true;
      
      if (vote === 'accept' && acceptBtn) {
        acceptBtn.classList.add('voted');
      } else if (vote === 'reject' && rejectBtn) {
        rejectBtn.classList.add('voted');
      }
    }
  } else {
    console.warn(`Task card for task ${taskId} not found in DOM, creating it now`);
    
    // If the task is pending but we don't have the card displayed, create it
    if (task.status === 'pending') {
      // Set as current pending task
      currentPendingTask = task;
      isPendingTask = true;
      
      // Create task card
      createTaskCard(task);
      
      // Add system message about the task
      addSystemMessage(`Task received: "${task.text}". Please vote to accept or reject.`);
    }
  }
  
  // Check if task is resolved
  checkTaskResolution(taskId);
}

// Handle incoming data from a peer
function handlePeerData(peerId, data) {
  try {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'chat-message':
        if (message.username && message.text) {
          renderChatMessage(message.username, message.text, true);
        }
        break;
        
      case 'new-task':
        if (message.task) {
          // Validate the task object
          const requiredFields = ['id', 'text', 'createdAt', 'createdBy', 'status', 'fromTimestamp', 'toTimestamp'];
          if (requiredFields.every(field => message.task[field] !== undefined)) {
            // Check if we already have this task
            const existingTaskIndex = tasks.findIndex(t => t.id === message.task.id);
            if (existingTaskIndex !== -1) {
              console.log(`Task ${message.task.id} already exists, skipping`);
              return;
            }
            
            console.log(`Received new task from ${message.task.createdBy} via peer ${peerId}:`, message.task);
            
            // Update global lastTaskTimestamp if newer
            if (message.lastTaskTimestamp > lastTaskTimestamp) {
              console.log(`Updating lastTaskTimestamp from ${new Date(lastTaskTimestamp).toLocaleTimeString()} to ${new Date(message.lastTaskTimestamp).toLocaleTimeString()}`);
              lastTaskTimestamp = message.lastTaskTimestamp;
            }
            
            // Store the task
            tasks.push(message.task);
            
            // Initialize vote tracking
            if (!taskVotes.has(message.task.id)) {
              taskVotes.set(message.task.id, new Map());
            }
            
            // If this is an accepted task, add it to the to-do list
            if (message.task.status === 'accepted') {
              addTaskToTodoList(message.task);
              addSystemMessage(`Task added to to-do list: "${message.task.text}"`);
            } else if (message.task.status === 'pending') {
              // Check if there's already a pending task with different ID
              if (isPendingTask && currentPendingTask && currentPendingTask.id !== message.task.id) {
                // If the current task is already resolved (but UI hasn't been updated),
                // we should allow the new pending task to be processed
                const currentTaskVotes = taskVotes.get(currentPendingTask.id);
                const currentTaskResolved = currentTaskVotes && isTaskResolved(currentTaskVotes);
                
                if (!currentTaskResolved) {
                  console.warn(`Received new pending task ${message.task.id} but we already have pending task ${currentPendingTask.id}`);
                  
                  // If the new task is newer, replace the current pending task
                  if (message.task.createdAt > currentPendingTask.createdAt) {
                    console.log(`New task is newer, replacing current pending task`);
                    // Remove old task card
                    const oldTaskCard = document.getElementById('task-card-container');
                    if (oldTaskCard) {
                      oldTaskCard.remove();
                    }
                  } else {
                    console.log(`Current pending task is newer, keeping it and storing new task for later`);
                    addSystemMessage(`New task received from ${message.task.createdBy} but will be processed after current task is resolved.`);
                    return;
                  }
                } else {
                  console.log(`Current pending task is already resolved, processing new task`);
                  // Clean up the old resolved task UI
                  const oldTaskCard = document.getElementById('task-card-container');
                  if (oldTaskCard) {
                    oldTaskCard.remove();
                  }
                  
                  // Reset the pending task state
                  isPendingTask = false;
                  currentPendingTask = null;
                }
              }
              
              // Set as current pending task
              currentPendingTask = message.task;
              isPendingTask = true;
              
              // Create and show the task card
              createTaskCard(message.task);
              
              // Disable the create task button
              const createTaskBtn = document.getElementById('create-task-btn');
              if (createTaskBtn) {
                createTaskBtn.disabled = true;
                createTaskBtn.title = "Cannot create a new task while there's a pending task";
              }
              
              // Display notification
              addSystemMessage(`New task from ${message.task.createdBy}: "${message.task.text}". Please vote to accept or reject.`);
            }
          } else {
            console.error('Received malformed task object:', message.task, 'Missing fields:', requiredFields.filter(field => message.task[field] === undefined));
          }
        }
        break;
        
      case 'task-vote':
        // Handle received vote
        if (message.taskId !== undefined && message.vote && message.peerId && message.username) {
          // Check for duplicate votes before processing
          const isDuplicateVote = taskVotes.has(message.taskId) && 
                                 taskVotes.get(message.taskId).has(message.peerId) &&
                                 taskVotes.get(message.taskId).get(message.peerId).vote === message.vote;
          
          if (isDuplicateVote) {
            console.log(`Skipping duplicate WebRTC vote from ${message.username}: ${message.vote}`);
            return;
          }
          
          // Process the vote
          handleReceivedVote(message);
          console.log(`Received vote from ${message.username}: ${message.vote}`);
          
          // Show message about the vote
          addSystemMessage(`${message.username} voted to ${message.vote} the task.`);
        } else {
          console.error('Received malformed vote object:', message);
        }
        break;
        
      case 'transcript-message':
        handleTranscriptMessage(message);
        break;
        
      default:
        console.log(`Received unknown message type from ${peerId}:`, message);
    }
  } catch (err) {
    console.error(`Error parsing data from peer ${peerId}:`, err, data);
  }
}

// Helper function to check if a task is resolved based on its votes
function isTaskResolved(votes) {
  if (!votes || votes.size === 0) return false;
  
  // Count accept and reject votes
  let acceptCount = 0;
  let rejectCount = 0;
  
  for (const vote of votes.values()) {
    if (vote.vote === 'accept') acceptCount++;
    else if (vote.vote === 'reject') rejectCount++;
  }
  
  // Calculate total peers for majority
  const totalPeers = peerConnections.size + 1; // +1 for self
  const majority = Math.ceil(totalPeers / 2);
  
  // Task is resolved if either accept or reject has majority
  return acceptCount >= majority || rejectCount >= majority;
}

// Add a task to the to-do list
function addTaskToTodoList(task) {
  console.log(`Adding task to to-do list: ${task.id} - ${task.text}`);
  
  // Add to accepted tasks array if not already there
  if (!acceptedTasks.find(t => t.id === task.id)) {
    acceptedTasks.push(task);
    console.log(`Task ${task.id} added to acceptedTasks array. Total: ${acceptedTasks.length}`);
  }
  
  // Get chat container
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) {
    console.error('Chat container not found for to-do list insertion');
    return null;
  }
  
  // Create a to-do list container if it doesn't exist
  let todoListContainer = document.getElementById('todo-list-container');
  if (!todoListContainer) {
    todoListContainer = document.createElement('div');
    todoListContainer.id = 'todo-list-container';
    todoListContainer.className = 'todo-list-container';
    todoListContainer.innerHTML = '<h3>To-Do List</h3><ul id="todo-list" class="todo-list"></ul>';
    
    // Insert the to-do list at the appropriate position in the DOM
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer && chatContainer.contains(messagesContainer)) {
      // If messagesContainer exists and is a child of chatContainer, insert before it
      chatContainer.insertBefore(todoListContainer, messagesContainer);
    } else {
      // Otherwise, append to the beginning of the chat container
      const firstChild = chatContainer.firstChild;
      if (firstChild) {
        chatContainer.insertBefore(todoListContainer, firstChild);
      } else {
        chatContainer.appendChild(todoListContainer);
      }
    }
  }
  
  // Get the to-do list element
  const todoList = document.getElementById('todo-list');
  if (!todoList) {
    console.error('To-do list element not found');
    return todoListContainer;
  }
  
  // Check if this task is already in the list
  const existingItem = Array.from(todoList.children).find(item => 
    item.dataset.taskId === task.id.toString()
  );
  
  if (!existingItem) {
    // Create a new task item
    const taskItem = document.createElement('li');
    taskItem.className = 'todo-item';
    taskItem.dataset.taskId = task.id;
    
    // Add task content
    taskItem.innerHTML = `
      <div class="todo-text">${task.text}</div>
      <div class="todo-meta">
        <span class="todo-creator">${task.createdBy}</span>
        <span class="todo-time">${new Date(task.createdAt).toLocaleTimeString()}</span>
      </div>
    `;
    
    // Add to the list
    todoList.appendChild(taskItem);
    console.log(`Task item added to todo list in DOM: ${task.id}`);
  }
  
  // Update UI to show to-do list is visible
  todoListContainer.style.display = 'block';
  
  return todoListContainer;
}

// Generate unique task IDs that work across all peers
function generateUniqueTaskId() {
  // Combine timestamp and random value for uniqueness
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Social Page Functionality
let currentPosts = [];
let currentPostDetail = null;

// Initialize social page
function initializeSocialPage() {
  const createPostBtn = document.getElementById('create-post-btn');
  const createPostModal = document.getElementById('create-post-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const postContent = document.getElementById('post-content');
  const postCharCount = document.getElementById('post-char-count');
  const postSubmitBtn = document.getElementById('post-submit');
  const backToFeedBtn = document.getElementById('back-to-feed');

  // Event listeners
  createPostBtn.addEventListener('click', () => {
    createPostModal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => {
    createPostModal.classList.add('hidden');
    postContent.value = '';
    postCharCount.textContent = '0/300';
  });

  postContent.addEventListener('input', () => {
    const length = postContent.value.length;
    postCharCount.textContent = `${length}/300`;
    postSubmitBtn.disabled = length === 0;
  });

  postSubmitBtn.addEventListener('click', handleCreatePost);
  backToFeedBtn.addEventListener('click', () => {
    document.getElementById('post-detail').classList.add('hidden');
    document.getElementById('post-list').classList.remove('hidden');
  });

  // Load initial posts
  loadPosts();
}

// Load posts from PDS
async function loadPosts() {
  try {
    const response = await window.electronAPI.getPosts();
    if (response.success) {
      currentPosts = response.posts;
      renderPosts();
    } else {
      console.error('Failed to load posts:', response.error);
    }
  } catch (error) {
    console.error('Error loading posts:', error);
  }
}

// Render posts in the list
function renderPosts() {
  const postList = document.getElementById('post-list');
  postList.innerHTML = '';

  currentPosts.forEach(post => {
    const postElement = createPostElement(post);
    postList.appendChild(postElement);
  });
}

// Create a post element
function createPostElement(post) {
  const div = document.createElement('div');
  div.className = 'post-card';
  div.dataset.postId = post.uri;

  const content = post.record.text;
  const truncatedContent = content.length > 300 
    ? content.substring(0, 300) + '...' 
    : content;

  div.innerHTML = `
    <div class="post-header">
      <span class="post-author">${post.author.displayName || post.author.handle}</span>
      <span class="post-timestamp">${formatTimestamp(post.indexedAt)}</span>
    </div>
    <div class="post-content">${truncatedContent}</div>
    <div class="post-actions">
      <div class="post-action like-action" data-action="like">
        <span class="icon">❤️</span>
        <span class="count">${post.likeCount || 0}</span>
      </div>
      <div class="post-action repost-action" data-action="repost">
        <span class="icon">🔄</span>
        <span class="count">${post.repostCount || 0}</span>
      </div>
      <div class="post-action comment-action" data-action="comment">
        <span class="icon">💬</span>
        <span class="count">${post.replyCount || 0}</span>
      </div>
    </div>
  `;

  // Add click handlers
  div.addEventListener('click', (e) => {
    if (!e.target.closest('.post-action')) {
      showPostDetail(post);
    }
  });

  // Add action handlers
  div.querySelectorAll('.post-action').forEach(action => {
    action.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePostAction(post, action.dataset.action);
    });
  });

  return div;
}

// Show post detail
function showPostDetail(post) {
  currentPostDetail = post;
  const postDetail = document.getElementById('post-detail');
  const postDetailContent = document.getElementById('post-detail-content');
  
  postDetailContent.innerHTML = `
    <div class="post-card">
      <div class="post-header">
        <span class="post-author">${post.author.displayName || post.author.handle}</span>
        <span class="post-timestamp">${formatTimestamp(post.indexedAt)}</span>
      </div>
      <div class="post-content">${post.record.text}</div>
      <div class="post-actions">
        <div class="post-action like-action" data-action="like">
          <span class="icon">❤️</span>
          <span class="count">${post.likeCount || 0}</span>
        </div>
        <div class="post-action repost-action" data-action="repost">
          <span class="icon">🔄</span>
          <span class="count">${post.repostCount || 0}</span>
        </div>
        <div class="post-action comment-action" data-action="comment">
          <span class="icon">💬</span>
          <span class="count">${post.replyCount || 0}</span>
        </div>
      </div>
    </div>
    <div class="comments-section">
      <h4>Comments</h4>
      <div class="comments-list">
        ${renderComments(post.replies || [])}
      </div>
      <div class="comment-input">
        <textarea placeholder="Write a comment..." maxlength="300"></textarea>
        <button class="action-btn">Post Comment</button>
      </div>
    </div>
  `;

  // Add action handlers for the detail view
  postDetailContent.querySelectorAll('.post-action').forEach(action => {
    action.addEventListener('click', () => {
      handlePostAction(post, action.dataset.action);
    });
  });

  // Add comment submission handler
  const commentInput = postDetailContent.querySelector('.comment-input textarea');
  const commentButton = postDetailContent.querySelector('.comment-input button');
  commentButton.addEventListener('click', () => {
    handleCreateComment(post, commentInput.value);
  });

  postDetail.classList.remove('hidden');
  document.getElementById('post-list').classList.add('hidden');
}

// Render comments
function renderComments(comments) {
  return comments.map(comment => `
    <div class="comment">
      <div class="comment-header">
        <span class="comment-author">${comment.author.displayName || comment.author.handle}</span>
        <span class="comment-timestamp">${formatTimestamp(comment.indexedAt)}</span>
      </div>
      <div class="comment-content">${comment.record.text}</div>
      <div class="comment-actions">
        <div class="post-action like-action" data-action="like">
          <span class="icon">❤️</span>
          <span class="count">${comment.likeCount || 0}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Handle post actions (like, repost, comment)
async function handlePostAction(post, action) {
  try {
    const response = await window.electronAPI.performPostAction(post.uri, action);
    if (response.success) {
      // Update UI
      if (currentPostDetail && currentPostDetail.uri === post.uri) {
        showPostDetail(response.updatedPost);
      } else {
        loadPosts(); // Refresh the list
      }
    } else {
      console.error('Failed to perform action:', response.error);
    }
  } catch (error) {
    console.error('Error performing action:', error);
  }
}

// Handle creating a new post
async function handleCreatePost() {
  const content = document.getElementById('post-content').value.trim();
  if (!content) return;

  try {
    const response = await window.electronAPI.createPost(content);
    if (response.success) {
      // Close modal and refresh posts
      document.getElementById('create-post-modal').classList.add('hidden');
      document.getElementById('post-content').value = '';
      loadPosts();
    } else {
      console.error('Failed to create post:', response.error);
    }
  } catch (error) {
    console.error('Error creating post:', error);
  }
}

// Handle creating a comment
async function handleCreateComment(post, content) {
  if (!content.trim()) return;

  try {
    const response = await window.electronAPI.createComment(post.uri, content);
    if (response.success) {
      showPostDetail(response.updatedPost);
    } else {
      console.error('Failed to create comment:', response.error);
    }
  } catch (error) {
    console.error('Error creating comment:', error);
  }
}

// Format timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Initialize social page when the page becomes active
document.querySelector('.nav-btn[data-page="social"]').addEventListener('click', () => {
  initializeSocialPage();
});

// Initialize social page when the page becomes active
document.querySelector('.nav-btn[data-page="social"]').addEventListener('click', () => {
  initializeSocialPage();
});

// Initialize friends page when the chats page is selected
document.querySelector('.nav-btn[data-page="chats"]').addEventListener('click', () => {
  // Use the global FriendsPage object
  if (window.FriendsPage && typeof window.FriendsPage.initializeFriendsPage === 'function') {
    window.FriendsPage.initializeFriendsPage();
  } else {
    console.error('FriendsPage module not available');
  }
});