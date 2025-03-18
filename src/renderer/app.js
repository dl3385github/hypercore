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
const microphoneSelect = document.getElementById('microphone-select');
const speakerSelect = document.getElementById('speaker-select');
const webcamSelect = document.getElementById('webcam-select');
const refreshDevicesBtn = document.getElementById('refresh-devices-btn');

// State variables
let peers = new Set();
let currentRoom = null;
let localStream = null;
let isVideoEnabled = false;
let isAudioEnabled = false;
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
  audioThreshold: 0.05, // Default value
};

// Current user state
let currentUser = null;
// DOM elements for API settings
const openaiApiKeyInput = document.getElementById('openai-api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const apiKeyStatus = document.getElementById('api-key-status');

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
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
  
  // Add event listeners for transcript popup
  toggleTranscriptPopupBtn.addEventListener('click', toggleTranscriptPopup);
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
  
  audioThresholdSlider.addEventListener('input', (e) => {
    const newValue = parseFloat(e.target.value);
    appSettings.audioThreshold = newValue;
    thresholdValueDisplay.textContent = newValue.toFixed(2);
    updateAudioThreshold(newValue);
  });
  
  // Device selection listeners
  microphoneSelect.addEventListener('change', (e) => {
    selectedMicrophoneId = e.target.value;
    console.log(`Selected microphone: ${selectedMicrophoneId}`);
    applyDeviceSelection();
  });
  
  webcamSelect.addEventListener('change', (e) => {
    selectedWebcamId = e.target.value;
    console.log(`Selected webcam: ${selectedWebcamId}`);
    applyDeviceSelection();
  });
  
  speakerSelect.addEventListener('change', (e) => {
    selectedSpeakerId = e.target.value;
    console.log(`Selected speaker: ${selectedSpeakerId}`);
    applyDeviceSelection();
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
<<<<<<< HEAD
=======

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
  
  // Add event listeners after the rest of the event listeners are set up
  // Setup API key form
  saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  
  // Initialize by loading the masked API key
  loadApiKey();
>>>>>>> 3a3f440 (Move API keys to .env, fix transcript display, add API key settings)
});

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
    const ownId = await window.electronAPI.getOwnId();
    console.log(`Our peer ID: ${ownId}`);
    
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
    console.log(`Adding remote stream for peer ${peerId}`);
    
    // Create video container if it doesn't exist
    let remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
    
    if (!remoteContainer) {
      console.log(`Creating new remote container for peer ${peerId}`);
      
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
      
      // Add participant name
      const nameElement = document.createElement('div');
      nameElement.className = 'participant-name';
      nameElement.textContent = peerName;
      remoteContainer.appendChild(nameElement);
      
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
        
        // Find the audio element and adjust its volume
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
      setupRemoteTranscription(peerId, stream);
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
        // Create a blob from the recorded chunks
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        recordedChunks = [];
        
        // Convert blob to ArrayBuffer before sending to main process
        const arrayBuffer = await blob.arrayBuffer();
        
        // Create a regular array from the ArrayBuffer to ensure it can be cloned
        const uint8Array = new Uint8Array(arrayBuffer);
        const buffer = Array.from(uint8Array);
        
        // Send to main process for transcription
        const username = usernameInput.value.trim();
        const result = await window.electronAPI.transcribeAudio(buffer, username);
        if (result.success) {
          // Transcription will come back through the onTranscriptionResult listener
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
    
  } catch (error) {
    console.error('Error setting up media recording:', error);
    addSystemMessage(`Error setting up transcription: ${error.message}`);
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
function setupRemoteTranscription(peerId, stream) {
  console.log(`Setting up remote transcription for peer: ${peerId}`);
  
  const audioTracks = stream.getAudioTracks();
  
  if (!audioTracks || audioTracks.length === 0) {
    console.warn(`No audio tracks found in remote stream from ${peerId}`);
    return;
  }
  
  // Get peer username - use actual name if available, otherwise use ID-based placeholder
  const peerUsername = getPeerUsername(peerId) || `Peer ${peerId.substring(0, 6)}`;
  console.log(`Setting up transcription for remote audio from ${peerUsername} (${peerId})`);
  
  try {
    // Create a new MediaStream with just the audio track
    const audioStream = new MediaStream([audioTracks[0]]);
    
    // Create a new MediaRecorder for this remote stream
    const remoteRecorder = new MediaRecorder(audioStream, { 
      mimeType: 'audio/webm',
      audioBitsPerSecond: 128000 // Use a higher bitrate for better quality
    });
    const remoteChunks = [];
    
    // Handle data available event
    remoteRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        remoteChunks.push(event.data);
        console.log(`Remote audio chunk received from ${peerUsername}, size: ${event.data.size}`);
      } else {
        console.warn(`Empty audio chunk received from ${peerUsername}`);
      }
    };
    
    // Handle recording stop
    remoteRecorder.onstop = async () => {
      if (remoteChunks.length === 0) {
        console.log(`No audio chunks collected for ${peerUsername}, restarting recorder`);
        // Restart recording if still connected
        if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
          try {
            remoteRecorder.start(3000); // 3s chunks for faster transcription
          } catch (error) {
            console.error(`Error restarting recorder for ${peerUsername}:`, error);
          }
        }
        return;
      }
      
      try {
        // Create a blob from the recorded chunks
        const blob = new Blob(remoteChunks, { type: 'audio/webm' });
        console.log(`Processing ${remoteChunks.length} audio chunks from ${peerUsername}, total size: ${blob.size} bytes`);
        remoteChunks.length = 0; // Clear the array
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        
        // Ensure we have meaningful audio data
        if (arrayBuffer.byteLength < 1000) {
          console.log(`Audio data too small from ${peerUsername} (${arrayBuffer.byteLength} bytes), skipping transcription`);
          // Restart recording
          if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
            try {
              remoteRecorder.start(3000);
            } catch (error) {
              console.error(`Error restarting recorder for ${peerUsername}:`, error);
            }
          }
          return;
        }
        
        // Convert to Uint8Array for sending to main process
        const uint8Array = new Uint8Array(arrayBuffer);
        
        console.log(`Sending ${uint8Array.length} bytes of audio data from ${peerUsername} for transcription`);
        
        // Send to main process for transcription - pass the Uint8Array directly
        const result = await window.electronAPI.transcribeAudio(uint8Array, peerUsername);
        
        console.log(`Transcription result for ${peerUsername}:`, result);
        
        if (result.success && result.transcription && result.transcription.trim().length > 0) {
          // Log the successful transcription
          console.log(`Remote transcription for ${peerUsername}: "${result.transcription}"`);
          
          // Update our own UI with the transcript
          updateTranscription(peerUsername, result.transcription);
          
          // Share transcript with other peers via data channel
          for (const [otherPeerId, dataChannel] of dataChannels.entries()) {
            if (dataChannel && dataChannel.readyState === 'open') {
              const transcriptMessage = {
                type: 'transcript',
                speaker: peerUsername,
                text: result.transcription,
                timestamp: new Date().toISOString()
              };
              dataChannel.send(JSON.stringify(transcriptMessage));
            }
          }
        } else {
          console.log(`Empty or failed transcription for ${peerUsername}:`, result);
        }
      } catch (error) {
        console.error(`Error transcribing remote audio from ${peerUsername}:`, error);
      } finally {
        // Restart recording if still connected
        if (peerConnections.has(peerId) && remoteRecorder.state !== 'recording') {
          try {
            remoteRecorder.start(3000); // 3s chunks for faster transcription
          } catch (error) {
            console.error(`Error restarting recorder for ${peerUsername}:`, error);
            
            // Try to recreate the recorder if it's in a failed state
            if (remoteRecorder.state === 'inactive' && peerConnections.has(peerId)) {
              console.log(`Attempting to recreate recorder for ${peerUsername}`);
              setupRemoteTranscription(peerId, stream);
              return;
            }
          }
        }
      }
    };
    
    // Handle recorder errors
    remoteRecorder.onerror = (event) => {
      console.error(`MediaRecorder error for ${peerUsername}:`, event.error);
      
      // Try to recreate the recorder if there's an error
      if (peerConnections.has(peerId)) {
        console.log(`Recreating recorder for ${peerUsername} after error`);
        setupRemoteTranscription(peerId, stream);
      }
    };
    
    // Store the recorder for later cleanup
    remoteRecorders.set(peerId, remoteRecorder);
    
    // Start recording
    remoteRecorder.start(3000); // 3s chunks for faster transcription
    
    console.log(`Started remote transcription for ${peerUsername} (${peerId})`);
  } catch (error) {
    console.error(`Error setting up remote transcription for ${peerUsername} (${peerId}):`, error);
  }
}

// Toggle transcript popup visibility
function toggleTranscriptPopup() {
  console.log('Toggling transcript popup');
  
  // If the popup is hidden and there are no entries, add a placeholder message
  if (transcriptPopup.classList.contains('hidden') && transcriptPopupContent.childNodes.length === 0) {
    const placeholderMessage = document.createElement('div');
    placeholderMessage.className = 'transcript-placeholder';
    placeholderMessage.textContent = 'Transcript will appear here as people speak...';
    transcriptPopupContent.appendChild(placeholderMessage);
  }
  
  // Toggle visibility
  transcriptPopup.classList.toggle('hidden');
  
  // Update button text
  if (transcriptPopup.classList.contains('hidden')) {
    toggleTranscriptPopupBtn.textContent = 'Show Transcript';
  } else {
    toggleTranscriptPopupBtn.textContent = 'Hide Transcript';
  }
}

// Update transcription display
function updateTranscription(speaker, text) {
  if (!text || text.trim() === '') return;
  
  // Find transcript container for this speaker
  let transcriptContainer = null;
  let overlayContainer = null;
  
  if (speaker === username) {
    // Local user
    transcriptContainer = document.querySelector('#local-transcript .transcript-content');
    overlayContainer = document.getElementById('local-overlay-transcript');
  } else {
    // Remote user - find by peer name
    const remoteVideo = document.querySelector(`.remote-video-container[data-username="${speaker}"]`);
    if (remoteVideo) {
      transcriptContainer = remoteVideo.querySelector('.transcript-content');
      overlayContainer = remoteVideo.querySelector('.transcript-overlay');
    }
  }
  
  // Store transcript entry
  if (!transcripts.has(speaker)) {
    transcripts.set(speaker, []);
  }
  
  const timestamp = new Date().toISOString();
  transcripts.get(speaker).push({
    timestamp,
    text
  });
  
  console.log(`Updating transcription for ${speaker}: "${text}"`);
  
  // Add to transcript container if found
  if (transcriptContainer) {
    const entry = document.createElement('div');
    entry.textContent = text;
    transcriptContainer.appendChild(entry);
    
    // Auto-scroll to the bottom
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    
    console.log(`Added transcript to container for ${speaker}`);
  } else {
    console.warn(`Transcript container not found for ${speaker}`);
  }
  
  // Show in overlay for a few seconds
  if (overlayContainer) {
    overlayContainer.textContent = text;
    overlayContainer.classList.remove('hidden');
    
    // Hide after a few seconds
    setTimeout(() => {
      overlayContainer.classList.add('hidden');
    }, 5000);
    
    console.log(`Added transcript to overlay for ${speaker}`);
  } else {
    console.warn(`Overlay container not found for ${speaker}`);
  }
  
  // Add to transcript popup
  addTranscriptToPopup(speaker, text, timestamp);
}

// Add transcript to popup
function addTranscriptToPopup(speaker, text, timestamp) {
  // Create transcript entry
  const entry = document.createElement('div');
  entry.className = 'transcript-entry';
  
  // Add speaker name
  const speakerElement = document.createElement('div');
  speakerElement.className = 'transcript-speaker';
  speakerElement.textContent = speaker;
  entry.appendChild(speakerElement);
  
  // Add transcript text
  const textElement = document.createElement('div');
  textElement.className = 'transcript-text';
  textElement.textContent = text;
  entry.appendChild(textElement);
  
  // Add timestamp
  const timeElement = document.createElement('div');
  timeElement.className = 'transcript-time';
  
  // Format timestamp
  const date = new Date(timestamp);
  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  timeElement.textContent = formattedTime;
  entry.appendChild(timeElement);
  
  // Add to popup content
  transcriptPopupContent.appendChild(entry);
  
  // Auto-scroll to the bottom
  transcriptPopupContent.scrollTop = transcriptPopupContent.scrollHeight;
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
<<<<<<< HEAD
} 
=======
}

// Check authentication state on startup
async function checkAuthState() {
  try {
    const response = await window.electronAPI.getCurrentUser();
    
    if (response.success && response.user) {
      updateAuthState(response.user);
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
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
      formattedIdentifier = `${identifier}.hapa.ai`;
    }
    
    // Call API to sign in
    const response = await window.electronAPI.signIn(formattedIdentifier, password);
    
    if (response.success) {
      // Sign in successful
      updateAuthState(response.user);
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
  if (handle.includes('.hapa.ai')) {
    // Handle already has the domain, keep it as is
  } else if (handle.includes('.')) {
    signupError.textContent = 'Username can only contain letters, numbers, and underscores';
    return;
  } else {
    // No domain, will be added by the backend
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
    await window.electronAPI.signOut();
    updateAuthState(null);
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to load the API key (masked)
async function loadApiKey() {
  try {
    const response = await window.electronAPI.getApiKey();
    
    if (response.success) {
      openaiApiKeyInput.placeholder = response.apiKey || 'Enter your OpenAI API key';
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

// Function to save the API key
async function handleSaveApiKey() {
  // Clear previous status
  apiKeyStatus.textContent = '';
  apiKeyStatus.className = 'setting-status';
  
  const apiKey = openaiApiKeyInput.value.trim();
  
  if (!apiKey) {
    apiKeyStatus.textContent = 'Please enter an API key';
    apiKeyStatus.classList.add('error');
    return;
  }
  
  try {
    // Disable button while saving
    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.textContent = 'Saving...';
    
    const response = await window.electronAPI.updateApiKey(apiKey);
    
    if (response.success) {
      apiKeyStatus.textContent = 'API key saved successfully!';
      apiKeyStatus.classList.add('success');
      
      // Clear the input
      openaiApiKeyInput.value = '';
      
      // Load the masked key for display
      await loadApiKey();
    } else {
      apiKeyStatus.textContent = response.error || 'Failed to save API key';
      apiKeyStatus.classList.add('error');
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    apiKeyStatus.textContent = error.message || 'An error occurred while saving the API key';
    apiKeyStatus.classList.add('error');
  } finally {
    // Reset button state
    saveApiKeyBtn.disabled = false;
    saveApiKeyBtn.textContent = 'Save';
  }
}
>>>>>>> 3a3f440 (Move API keys to .env, fix transcript display, add API key settings)
