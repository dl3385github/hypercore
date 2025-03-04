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
  
  // Set up save transcript button
  saveTranscriptButton.addEventListener('click', saveAllTranscripts);
  
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
  try {
    // Toggle video state
    isVideoEnabled = !isVideoEnabled;
    
    // Update the local video stream
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoEnabled;
      });
    }
    
    // Update UI
    const toggleBtn = document.getElementById('toggle-video');
    if (!isVideoEnabled) {
      toggleBtn.classList.add('video-off');
      localVideo.classList.add('video-off');
    } else {
      toggleBtn.classList.remove('video-off');
      localVideo.classList.remove('video-off');
    }
    
    // Notify peers of state change
    notifyMediaStateChange();
    
    console.log(`Video ${isVideoEnabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Error toggling video:', error);
  }
}

// Toggle audio on/off
function toggleAudio() {
  try {
    // Toggle audio state
    isAudioEnabled = !isAudioEnabled;
    
    // Update the local audio stream
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isAudioEnabled;
      });
    }
    
    // Update UI
    const toggleBtn = document.getElementById('toggle-audio');
    if (!isAudioEnabled) {
      toggleBtn.classList.add('muted');
    } else {
      toggleBtn.classList.remove('muted');
    }
    
    // Notify peers of state change
    notifyMediaStateChange();
    
    console.log(`Audio ${isAudioEnabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Error toggling audio:', error);
  }
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
    const remoteVideos = document.querySelector('.remote-videos');
    
    // Check if we already have a container for this peer
    let videoItem = document.getElementById(`video-${peerId}`);
    
    if (!videoItem) {
      const peerUsername = getPeerUsername(peerId) || 'Unknown User';
      
      // Create video container
      videoItem = document.createElement('div');
      videoItem.className = 'video-item';
      videoItem.id = `video-${peerId}`;
      
      // Create video wrapper
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';
      videoWrapper.setAttribute('data-username', peerUsername);
      videoWrapper.setAttribute('data-peer-id', peerId);
      
      // Create video element
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      // Create controls container
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'video-controls';
      
      // Create participant info container
      const participantInfo = document.createElement('div');
      participantInfo.className = 'participant-info';
      
      // Create participant name element
      const participantName = document.createElement('div');
      participantName.className = 'participant-name';
      participantName.textContent = peerUsername;
      
      // Create audio indicator
      const audioIndicator = document.createElement('div');
      audioIndicator.className = 'audio-off-indicator';
      audioIndicator.innerHTML = '<i class="fas fa-microphone-slash"></i>';
      audioIndicator.style.display = 'none';
      
      // Add elements to their containers
      participantInfo.appendChild(participantName);
      participantInfo.appendChild(audioIndicator);
      controlsContainer.appendChild(participantInfo);
      
      videoWrapper.appendChild(videoElement);
      videoWrapper.appendChild(controlsContainer);
      
      videoItem.appendChild(videoWrapper);
      remoteVideos.appendChild(videoItem);
      
      // Setup remote transcription
      setupRemoteTranscription(peerId, stream);
    } else {
      // Just update the stream for existing video
      const videoElement = videoItem.querySelector('video');
      
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
    }
    
    console.log(`Added remote stream for peer ${peerId}`);
  } catch (error) {
    console.error('Error adding remote stream:', error);
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
  try {
    console.log(`Setting up remote transcription for peer ${peerId}`);
    
    if (!stream || !stream.getAudioTracks || stream.getAudioTracks().length === 0) {
      console.warn(`No audio tracks available for peer ${peerId}`);
      return;
    }
    
    // Get the audio tracks from the stream
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      console.warn(`No audio tracks found in stream for peer ${peerId}`);
      return;
    }
    
    // Create a new audio stream with just the audio track
    const audioStream = new MediaStream([audioTracks[0]]);
    
    // Create an audio context to process the audio
    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(audioStream);
    
    // Create a media recorder for the audio stream
    const options = { mimeType: 'audio/webm' };
    const mediaRecorder = new MediaRecorder(audioStream, options);
    
    // Store the recorder for cleanup later
    if (!remoteRecorders.has(peerId)) {
      remoteRecorders.set(peerId, []);
    }
    remoteRecorders.get(peerId).push(mediaRecorder);
    
    // Array to store audio chunks
    const audioChunks = [];
    
    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Handle recording stop event
    mediaRecorder.onstop = async () => {
      try {
        // Create a blob from the audio chunks
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Convert blob to ArrayBuffer for transmission
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // Get the username for this peer
        const peerUsername = getPeerUsername(peerId);
        
        // Send the audio to the main process for transcription
        console.log(`Sending audio from peer ${peerId} (${peerUsername}) for transcription`);
        window.electronAPI.transcribeAudio(arrayBuffer, peerUsername);
        
        // Clear audio chunks for next recording
        audioChunks.length = 0;
        
        // Start recording again if still connected
        if (peerConnections.has(peerId) && peerConnections.get(peerId).connected) {
          mediaRecorder.start(RECORDING_INTERVAL);
        }
      } catch (error) {
        console.error(`Error processing audio from peer ${peerId}:`, error);
      }
    };
    
    // Start recording
    mediaRecorder.start(RECORDING_INTERVAL);
    
    console.log(`Remote transcription setup complete for peer ${peerId}`);
  } catch (error) {
    console.error(`Error setting up remote transcription for peer ${peerId}:`, error);
  }
}

// Update transcription display
function updateTranscription(speaker, text) {
  console.log(`Updating transcription for ${speaker}: ${text}`);
  
  try {
    // Find the right transcript container
    let container;
    
    if (speaker === usernameInput.value.trim()) {
      // Local user
      container = document.querySelector('.local-video-container .transcript-container');
      if (!container) {
        // Create if it doesn't exist
        const localVideoContainer = document.querySelector('.local-video-container');
        container = document.createElement('div');
        container.className = 'transcript-container';
        
        const titleElem = document.createElement('div');
        titleElem.className = 'transcript-title';
        titleElem.textContent = 'You';
        
        const contentElem = document.createElement('div');
        contentElem.className = 'transcript-content';
        
        container.appendChild(titleElem);
        container.appendChild(contentElem);
        localVideoContainer.appendChild(container);
      }
    } else {
      // Remote user - find the video element with this peer's username
      const remoteVideoContainer = document.querySelector(`.video-wrapper[data-username="${speaker}"]`);
      if (remoteVideoContainer) {
        container = remoteVideoContainer.querySelector('.transcript-container');
        if (!container) {
          // Create if it doesn't exist
          container = document.createElement('div');
          container.className = 'transcript-container';
          
          const titleElem = document.createElement('div');
          titleElem.className = 'transcript-title';
          titleElem.textContent = speaker;
          
          const contentElem = document.createElement('div');
          contentElem.className = 'transcript-content';
          
          container.appendChild(titleElem);
          container.appendChild(contentElem);
          remoteVideoContainer.appendChild(container);
        }
      } else {
        console.warn(`Could not find video container for ${speaker}`);
        return;
      }
    }
    
    if (container) {
      const contentElem = container.querySelector('.transcript-content');
      
      // Clear existing content
      contentElem.innerHTML = '';
      
      // Add new content
      const textElem = document.createElement('div');
      textElem.textContent = text;
      contentElem.appendChild(textElem);
      
      // Show the transcript container
      container.classList.add('active');
      
      // Hide after 5 seconds
      clearTimeout(container.fadeTimeout);
      container.fadeTimeout = setTimeout(() => {
        container.classList.remove('active');
      }, 5000);
    }
    
    // Add to transcript history
    if (!transcripts.has(speaker)) {
      transcripts.set(speaker, []);
    }
    
    transcripts.get(speaker).push({
      text,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Error updating transcription:', error);
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
function saveAllTranscripts() {
  if (transcripts.size === 0) {
    addSystemMessage('No transcripts available to save');
    return;
  }
  
  try {
    // Generate a combined transcript with all speakers, chronologically sorted
    const allEntries = [];
    
    transcripts.forEach((entries, speaker) => {
      entries.forEach(entry => {
        allEntries.push({
          speaker,
          timestamp: new Date(entry.timestamp),
          text: entry.text
        });
      });
    });
    
    // Sort by timestamp
    allEntries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Format as markdown
    let content = `# Complete Conversation Transcript - ${new Date().toLocaleString()}\n\n`;
    
    allEntries.forEach(entry => {
      const time = entry.timestamp.toLocaleTimeString();
      content += `[${time}] ${entry.speaker}: ${entry.text}\n`;
    });
    
    // Create a blob and download link
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complete_transcript_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    // Generate summary using the same transcript data
    const transcriptData = {};
    transcripts.forEach((entries, speaker) => {
      transcriptData[speaker] = entries;
    });
    
    // Send to main process for summary generation
    window.electronAPI.generateSummary(transcriptData)
      .then(result => {
        console.log('Summary generation initiated:', result);
        addSystemMessage('Generating call summary...');
      })
      .catch(error => {
        console.error('Error initiating summary generation:', error);
      });
    
    addSystemMessage('All transcripts saved successfully');
  } catch (error) {
    console.error('Error saving all transcripts:', error);
    addSystemMessage(`Error saving transcripts: ${error.message}`);
  }
}

// Add event listener for saving transcripts on leaving room
window.addEventListener('beforeunload', () => {
  // Save all transcripts automatically when leaving
  if (transcripts.size > 0) {
    saveAllTranscripts();
  }
}); 