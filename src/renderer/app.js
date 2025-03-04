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
const saveTranscriptButton = document.getElementById('save-raw-transcript-btn');
const saveAllTranscriptsButton = document.getElementById('save-all-transcripts-btn');
const chatContainer = document.querySelector('.chat-container');

// State variables
let peers = new Set();
let currentRoom = null;
let localStream = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let peerConnections = new Map(); // Map of peer ID to connection object
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

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
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
  
  // Set up save transcript buttons
  saveTranscriptButton.addEventListener('click', () => saveAllTranscripts(false));
  saveAllTranscriptsButton.addEventListener('click', () => saveAllTranscripts(true));
  
  // Ensure chat container stays visible
  // Create a MutationObserver to watch for style changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
        // If chat container is hidden, make it visible again
        if (chatContainer.classList.contains('hidden') || 
            chatContainer.style.display === 'none' ||
            chatContainer.style.visibility === 'hidden') {
          chatContainer.classList.remove('hidden');
          chatContainer.style.display = '';
          chatContainer.style.visibility = '';
        }
      }
    });
  });
  
  // Start observing the chat container for attribute changes
  observer.observe(chatContainer, { attributes: true });
  
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
  
  // Handle transcription results
  window.electronAPI.onTranscriptionResult((result) => {
    console.log('Received transcription result:', result);
    if (result.speaker && result.text) {
      updateTranscription(result.speaker, result.text);
    }
  });
  
  // Handle network errors
  window.electronAPI.onNetworkError((error) => {
    addSystemMessage(`Network error: ${error.message}`);
  });
  
  // Listen for app close event to generate summary
  window.addEventListener('beforeunload', saveAndSummarizeTranscripts);
  
  // Set up summary generation result listener
  window.electronAPI.onSummaryGenerated((result) => {
    console.log('Received summary generation result:', result);
    if (result.success) {
      addSystemMessage(`Call summary saved to: ${result.summaryFilePath}`);
    } else {
      addSystemMessage(`Failed to generate call summary: ${result.error}`);
    }
  });
  
  // Update button text and ID
  if (saveTranscriptButton) {
    saveTranscriptButton.textContent = 'Save Raw Transcript';
    saveTranscriptButton.id = 'save-raw-transcript-btn';
  }
  
  const saveAllTranscriptsButton = document.getElementById('save-all-transcripts-btn');
  if (saveAllTranscriptsButton) {
    saveAllTranscriptsButton.textContent = 'Save Summary';
  }
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
        addSystemMessage('No camera or microphone detected. You can see and hear others but cannot share your own video or audio.');
      }
    }
    
    // Display local video if we have video access
    if (localStream && isVideoEnabled) {
      localVideo.srcObject = localStream;
      localVideo.play().catch(e => console.error('Error playing local video:', e));
      toggleVideoButton.querySelector('.icon').textContent = '📹';
    } else {
      toggleVideoButton.querySelector('.icon').textContent = '🚫';
      toggleVideoButton.classList.add('video-off');
    }
    
    // Set initial audio state
    if (localStream && isAudioEnabled) {
      toggleAudioButton.querySelector('.icon').textContent = '🎤';
    } else {
      toggleAudioButton.querySelector('.icon').textContent = '🔇';
      toggleAudioButton.classList.add('muted');
    }
    
    // Set up recording for transcription
    if (localStream && isAudioEnabled) {
      setupMediaRecording();
    }
    
    // Set username and join room in main process
    currentRoom = roomId;
    await window.electronAPI.setUsername(username);
    const joinResult = await window.electronAPI.joinRoom(roomId);
    
    if (!joinResult.success) {
      alert(`Failed to join room: ${joinResult.error}`);
      return;
    }
    
    // Update UI
    currentRoomSpan.textContent = roomId;
    
    // Switch to chat screen
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    
    // Add welcome message
    addSystemMessage(`Welcome ${username}! You've joined room: ${roomId}`);
    
    // Focus on message input
    messageInput.focus();
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
      console.log(`Connection to peer ${peerId} already exists`);
      return;
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
    
    // Create a data channel for control messages
    const dataChannel = peerConnection.createDataChannel(`chat-${peerId}`, {
      ordered: true
    });
    
    dataChannel.onopen = () => {
      console.log(`Data channel to ${peerId} opened`);
      
      // Send our current media state immediately
      if (dataChannel.readyState === 'open') {
        sendMediaStateViaDataChannel(dataChannel);
      }
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleDataChannelMessage(peerId, message);
      } catch (err) {
        console.error('Failed to parse data channel message:', err);
      }
    };
    
    dataChannel.onclose = () => {
      console.log(`Data channel to ${peerId} closed`);
    };
    
    dataChannel.onerror = (error) => {
      console.error(`Data channel error for peer ${peerId}:`, error);
    };
    
    dataChannels.set(peerId, dataChannel);
    
    // Handle data channel from remote peer
    peerConnection.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      console.log(`Received data channel from ${peerId}:`, receiveChannel.label);
      
      receiveChannel.onmessage = (msgEvent) => {
        try {
          const message = JSON.parse(msgEvent.data);
          handleDataChannelMessage(peerId, message);
        } catch (err) {
          console.error('Failed to parse incoming data channel message:', err);
        }
      };
    };
    
    // Add our local stream tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`Adding track to peer connection: ${track.kind}`);
        peerConnection.addTrack(track, localStream);
      });
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
    
    // Store the connection
    peerConnections.set(peerId, {
      connection: peerConnection,
      stream: null
    });
    
    // Create offer (initiate connection)
    // We'll use a comparison of peer IDs to determine who initiates
    // This ensures only one side creates the offer
    const shouldInitiate = await shouldInitiateConnection(peerId);
    if (shouldInitiate) {
      console.log(`This peer should initiate connection to ${peerId}`);
      createOffer(peerId, peerConnection);
    } else {
      console.log(`Waiting for offer from peer ${peerId}`);
    }
    
  } catch (error) {
    console.error(`Error creating peer connection to ${peerId}:`, error);
    addSystemMessage(`Failed to connect to peer: ${error.message}`);
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
  }
}

// Update remote media state indicators
function updateRemoteMediaState(peerId, username, videoEnabled, audioEnabled) {
  const remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
  if (!remoteContainer) return;
  
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

// Clean up peer connection when a peer disconnects
function cleanupPeerConnection(peerId) {
  console.log(`Cleaning up connection for peer ${peerId}`);
  
  try {
    // Clean up data channel
    if (dataChannels.has(peerId)) {
      const dataChannel = dataChannels.get(peerId);
      if (dataChannel && dataChannel.readyState !== 'closed') {
        dataChannel.close();
      }
      dataChannels.delete(peerId);
    }
    
    // Clean up peer connection
    if (peerConnections.has(peerId)) {
      const { connection, stream } = peerConnections.get(peerId);
      
      // Close connection if it exists
      if (connection) {
        connection.ontrack = null;
        connection.onicecandidate = null;
        connection.oniceconnectionstatechange = null;
        connection.onsignalingstatechange = null;
        connection.onicegatheringstatechange = null;
        connection.onconnectionstatechange = null;
        connection.ondatachannel = null;
        connection.close();
      }
      
      peerConnections.delete(peerId);
    }
    
    // Clean up remote recorder
    if (remoteRecorders.has(peerId)) {
      const { recorder, interval } = remoteRecorders.get(peerId);
      if (interval) {
        clearInterval(interval);
      }
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
      remoteRecorders.delete(peerId);
    }
    
    // Remove video element from the UI
    const videoContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
    if (videoContainer) {
      const videoElement = videoContainer.querySelector('video');
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.pause();
      }
      videoContainer.remove();
    }
    
    // Remove participant from transcript if it exists
    const transcriptContainer = document.querySelector(`.transcript-container[data-participant="${peerId}"]`);
    if (transcriptContainer) {
      transcriptContainer.remove();
    }
    
    // Update the UI
    updateConnectionCount();
    
  } catch (error) {
    console.error(`Error cleaning up peer connection for ${peerId}:`, error);
  }
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
    if (!peerConnections.has(peerId)) {
      console.log(`Creating new peer connection for ${peerId} due to incoming signal`);
      await createPeerConnection(peerId);
    }
    
    const { connection } = peerConnections.get(peerId);
    
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
        await connection.setRemoteDescription(rtcSessionDescription);
        console.log(`Successfully set remote description (offer) for ${peerId}`);
        
        // Process any pending ICE candidates now that we have a remote description
        if (pendingIceCandidates.has(peerId)) {
          console.log(`Processing ${pendingIceCandidates.get(peerId).length} pending ICE candidates for ${peerId}`);
          const candidates = pendingIceCandidates.get(peerId);
          for (const candidate of candidates) {
            await processIceCandidate(peerId, connection, candidate);
          }
          pendingIceCandidates.delete(peerId);
        }
        
        // Create and send answer
        console.log(`Creating answer for ${peerId}`);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        
        // Wait a moment to ensure the local description is fully set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ensure we have a valid local description before sending
        if (!connection.localDescription) {
          console.error(`No local description available for answer to ${peerId}`);
          return;
        }
        
        console.log(`Sending answer to ${peerId}`);
        window.electronAPI.sendSignal(peerId, {
          type: 'answer',
          sdp: {
            type: connection.localDescription.type,
            sdp: connection.localDescription.sdp
          }
        }).then(result => {
          if (!result.success) {
            console.error(`Failed to send answer to ${peerId}:`, result.error);
          } else {
            console.log(`Successfully sent answer to ${peerId}`);
          }
        }).catch(err => {
          console.error(`Error sending answer to ${peerId}:`, err);
        });
      } catch (error) {
        console.error(`Failed to set remote description (offer) for ${peerId}:`, error);
        return;
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
      console.log(`Created RTCSessionDescription for answer:`, rtcSessionDescription);
      
      try {
        await connection.setRemoteDescription(rtcSessionDescription);
        console.log(`Successfully set remote description (answer) for ${peerId}`);
        
        // Process any pending ICE candidates now that we have a remote description
        if (pendingIceCandidates.has(peerId)) {
          console.log(`Processing ${pendingIceCandidates.get(peerId).length} pending ICE candidates for ${peerId}`);
          const candidates = pendingIceCandidates.get(peerId);
          for (const candidate of candidates) {
            await processIceCandidate(peerId, connection, candidate);
          }
          pendingIceCandidates.delete(peerId);
        }
      } catch (error) {
        console.error(`Failed to set remote description (answer) for ${peerId}:`, error);
        return;
      }
    } else if (signal.type === 'ice-candidate') {
      // Make sure we have a valid candidate
      if (!signal.candidate) {
        console.error('Invalid ICE candidate:', signal.candidate);
        return;
      }
      
      // If we don't have a remote description yet, buffer the ICE candidate
      if (!connection.remoteDescription || !connection.remoteDescription.type) {
        console.log(`Buffering ICE candidate for ${peerId} until remote description is set`);
        if (!pendingIceCandidates.has(peerId)) {
          pendingIceCandidates.set(peerId, []);
        }
        pendingIceCandidates.get(peerId).push(signal.candidate);
        return;
      }
      
      // Process the ICE candidate
      await processIceCandidate(peerId, connection, signal.candidate);
    }
  } catch (error) {
    console.error(`Error handling signal from ${peerId}:`, error);
  }
}

// Process an ICE candidate
async function processIceCandidate(peerId, connection, candidate) {
  console.log(`Processing ICE candidate for ${peerId}`, candidate);
  try {
    // Check if the ICE candidate has required fields before adding
    if (candidate.sdpMid !== null || candidate.sdpMLineIndex !== null) {
      // Create a proper RTCIceCandidate object from the serialized data
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
    // Only log error if connection hasn't failed
    if (connection.iceConnectionState !== 'failed') {
      console.error(`Error processing ICE candidate for ${peerId}:`, err);
    }
  }
}

// Add a remote stream to the UI
function addRemoteStream(peerId, stream) {
  try {
    console.log(`Adding remote stream from peer ${peerId}`);
    
    // Check if there's already a container for this peer
    let remoteContainer = document.querySelector(`.remote-video-container[data-peer-id="${peerId}"]`);
    
    if (!remoteContainer) {
      // Clone the template
      const template = document.getElementById('remote-video-template');
      const clone = document.importNode(template.content, true);
      remoteContainer = clone.querySelector('.remote-video-container');
      
      // Set peer ID as a data attribute
      remoteContainer.setAttribute('data-peer-id', peerId);
      
      // Get and set username
      const peerUsername = getPeerUsername(peerId);
      if (peerUsername) {
        remoteContainer.setAttribute('data-username', peerUsername);
        const nameElement = remoteContainer.querySelector('.participant-name');
        if (nameElement) {
          nameElement.textContent = peerUsername;
        }
      }
      
      // Add to the DOM
      document.getElementById('remote-videos').appendChild(remoteContainer);
    }
    
    const videoElement = remoteContainer.querySelector('.remote-video');
    if (videoElement) {
      videoElement.srcObject = stream;
      
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(error => {
          console.error(`Error playing remote video: ${error.message}`);
        });
      };
    }
    
    // Update media state indicators
    updateRemoteMediaState(
      peerId, 
      getPeerUsername(peerId),
      peerMediaStates[peerId]?.videoEnabled ?? true,
      peerMediaStates[peerId]?.audioEnabled ?? true
    );
    
    return remoteContainer;
  } catch (error) {
    console.error(`Error adding remote stream: ${error.message}`);
    return null;
  }
}

// Get a username for a peer based on peerId
function getPeerUsername(peerId) {
  // This would be more sophisticated in a real app
  // where we have a mapping of peer IDs to usernames
  return null;
}

// Set up media recording for local transcription
function setupMediaRecording() {
  if (!localStream || !localStream.getAudioTracks().length) return;
  
  try {
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
          if (isAudioEnabled && isRecording) {
            mediaRecorder.start();
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
  
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// Setup transcription for remote participants
function setupRemoteTranscription(peerId, stream) {
  // Extract audio track from the remote stream
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks || audioTracks.length === 0) {
    console.warn(`No audio tracks found in remote stream from ${peerId}`);
    return;
  }
  
  console.log(`Setting up transcription for remote audio from ${peerId}`);
  
  try {
    // Create a new MediaStream with just the audio track
    const audioStream = new MediaStream([audioTracks[0]]);
    
    // Create a new MediaRecorder for this remote stream
    const remoteRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    const remoteChunks = [];
    
    // Handle data available event
    remoteRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        remoteChunks.push(event.data);
      }
    };
    
    // Handle recording stop
    remoteRecorder.onstop = async () => {
      if (remoteChunks.length === 0) return;
      
      try {
        // Get peer username
        const peerUsername = getPeerUsername(peerId) || `Peer ${peerId.substring(0, 6)}`;
        
        // Create a blob from the recorded chunks
        const blob = new Blob(remoteChunks, { type: 'audio/webm' });
        remoteChunks.length = 0; // Clear the array
        
        // Convert blob to ArrayBuffer before sending to main process
        const arrayBuffer = await blob.arrayBuffer();
        
        // Create a regular array from the ArrayBuffer to ensure it can be cloned
        const uint8Array = new Uint8Array(arrayBuffer);
        const buffer = Array.from(uint8Array);
        
        // Send to main process for transcription
        console.log(`Sending remote audio for transcription from ${peerUsername}, size: ${buffer.length} bytes`);
        const result = await window.electronAPI.transcribeAudio(buffer, peerUsername);
        
        if (result.success) {
          console.log(`Successfully transcribed audio from ${peerUsername}: "${result.transcription}"`);
          // Transcription will come back through the onTranscriptionResult listener
        } else {
          console.error(`Failed to transcribe audio from ${peerUsername}:`, result.error);
        }
      } catch (error) {
        console.error(`Error processing remote audio from ${peerId}:`, error);
      }
    };
    
    // Start recording
    remoteRecorder.start();
    
    // Set up interval to stop and restart recording every 5 seconds
    const interval = setInterval(() => {
      if (remoteRecorder && remoteRecorder.state === 'recording') {
        remoteRecorder.stop();
        
        // Start a new recording after a small delay
        setTimeout(() => {
          // Only restart if the peer connection is still active
          if (peerConnections.has(peerId)) {
            remoteRecorder.start();
          } else {
            clearInterval(interval);
          }
        }, 500);
      }
    }, 5000); // Record in 5-second chunks
    
    // Store the recorder and interval for cleanup
    if (!remoteRecorders.has(peerId)) {
      remoteRecorders.set(peerId, { recorder: remoteRecorder, interval });
    } else {
      // Clean up existing recorder first
      const existing = remoteRecorders.get(peerId);
      clearInterval(existing.interval);
      if (existing.recorder && existing.recorder.state === 'recording') {
        existing.recorder.stop();
      }
      remoteRecorders.set(peerId, { recorder: remoteRecorder, interval });
    }
    
  } catch (error) {
    console.error(`Error setting up remote transcription for ${peerId}:`, error);
  }
}

// Update transcription display
function updateTranscription(speaker, text) {
  console.log(`Updating transcription for ${speaker}: ${text}`);
  
  if (!text || text.trim() === '') return;
  
  let transcriptContainer;
  let transcriptContent;
  
  // Store transcript entry
  if (!transcripts.has(speaker)) {
    transcripts.set(speaker, []);
  }
  
  transcripts.get(speaker).push({
    timestamp: new Date().toISOString(),
    text: text
  });
  
  // Find local or remote container
  if (speaker === usernameInput.value.trim()) {
    // Local user transcript
    transcriptContainer = document.querySelector('#local-transcript');
    if (transcriptContainer) {
      transcriptContent = transcriptContainer.querySelector('.transcript-content');
    }
  } else {
    // Find remote container by username attribute
    const remoteContainer = document.querySelector(`.remote-video-container[data-username="${speaker}"]`);
    
    if (!remoteContainer) {
      // Try to find by peer ID (fallback)
      const containers = document.querySelectorAll('.remote-video-container');
      for (const container of containers) {
        const nameElement = container.querySelector('.participant-name');
        if (nameElement && nameElement.textContent === speaker) {
          transcriptContainer = container.querySelector('.transcript-container');
          if (transcriptContainer) {
            transcriptContent = transcriptContainer.querySelector('.transcript-content');
          }
          break;
        }
      }
    } else {
      transcriptContainer = remoteContainer.querySelector('.transcript-container');
      if (transcriptContainer) {
        transcriptContent = transcriptContainer.querySelector('.transcript-content');
      }
    }
  }
  
  if (transcriptContent) {
    const transcriptLine = document.createElement('div');
    transcriptLine.textContent = text;
    transcriptContent.appendChild(transcriptLine);
    
    // Auto-scroll to the latest transcript
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
    
    // Show the transcript container
    showTranscriptContainer(transcriptContainer);
  } else {
    console.warn(`Transcript container for ${speaker} not found`);
  }
}

// Add this function to ensure remote transcripts are displayed properly
function showTranscriptContainer(transcriptContainer) {
  if (transcriptContainer) {
    transcriptContainer.classList.add('active');
    // Auto-hide transcript after 5 seconds if no new content is added
    setTimeout(() => {
      transcriptContainer.classList.remove('active');
    }, 5000);
  }
}

// Function to save and summarize transcripts on app close
function saveAndSummarizeTranscripts(event) {
  // Only process if we have transcripts
  if (transcripts.size === 0) {
    console.log('No transcripts to summarize');
    return;
  }
  
  console.log('Saving and summarizing transcripts before app close');
  
  try {
    // Convert Map to object for IPC transport
    const transcriptData = {};
    
    transcripts.forEach((entries, speaker) => {
      transcriptData[speaker] = entries;
    });
    
    // Send to main process for summary generation
    window.electronAPI.generateSummary(transcriptData)
      .then(result => {
        console.log('Summary generation initiated:', result);
      })
      .catch(error => {
        console.error('Error initiating summary generation:', error);
      });
    
  } catch (error) {
    console.error('Error saving and summarizing transcripts:', error);
  }
}

// Add function to save and download transcript for a single user
function saveTranscript(username) {
  if (!transcripts.has(username)) {
    addSystemMessage(`No transcript available for ${username}`);
    return;
  }
  
  try {
    const entries = transcripts.get(username);
    let content = `# Transcript for ${username} - ${new Date().toLocaleString()}\n\n`;
    
    entries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      content += `[${time}] ${username}: ${entry.text}\n`;
    });
    
    // Create a blob and download link
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${username.replace(/\s+/g, '_')}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    addSystemMessage(`Transcript for ${username} saved successfully`);
  } catch (error) {
    console.error(`Error saving transcript for ${username}:`, error);
    addSystemMessage(`Error saving transcript: ${error.message}`);
  }
}

// Save all transcripts
function saveAllTranscripts(generateSummary = true) {
  if (transcripts.size === 0) {
    addSystemMessage('No transcripts available to save.');
    return;
  }

  try {
    // Combine all transcripts from different speakers
    const allTranscriptEntries = [];
    transcripts.forEach((entries, speaker) => {
      entries.forEach(entry => {
        allTranscriptEntries.push({
          timestamp: entry.timestamp,
          speaker: speaker,
          text: entry.text
        });
      });
    });
    
    // Sort by timestamp
    allTranscriptEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Format as markdown
    let markdownContent = '# Conversation Transcript\n\n';
    allTranscriptEntries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      markdownContent += `**${entry.speaker}** (${time}): ${entry.text}\n\n`;
    });
    
    // Create a blob and download link
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    a.click();
    
    // If generate summary flag is true, send the transcript data to generate a summary
    if (generateSummary) {
      console.log('Initiating summary generation...');
      
      // Convert transcripts Map to an object suitable for IPC transport
      const transcriptData = {};
      transcripts.forEach((entries, speaker) => {
        transcriptData[speaker] = entries;
      });
      
      try {
        window.electronAPI.generateSummary(transcriptData);
        addSystemMessage('Summary generation initiated. It will be saved when ready.');
      } catch (error) {
        console.error('Error requesting summary generation:', error);
        addSystemMessage('Failed to initiate summary generation.');
      }
    } else {
      addSystemMessage('Raw transcript saved successfully.');
    }
    
  } catch (error) {
    console.error('Error saving all transcripts:', error);
    addSystemMessage('Failed to save transcripts.');
  }
}

// Add event listener for saving transcripts on leaving room
window.addEventListener('beforeunload', () => {
  // Save all transcripts automatically when leaving
  if (transcripts.size > 0) {
    saveAllTranscripts();
  }
}); 