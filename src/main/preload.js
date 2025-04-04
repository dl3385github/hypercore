const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script starting up');

// Debugging helper
function logEvent(eventName, ...args) {
  console.log(`[Preload] ${eventName}:`, ...args);
  return args[0]; // Return the first argument for chaining
}

// Expose protected methods that allow the renderer process to use the ipcRenderer
// without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth functions
  signUp: (handle, email, password) => {
    logEvent('signUp', handle, email);
    return ipcRenderer.invoke('auth-sign-up', handle, email, password);
  },
  
  signIn: (identifier, password) => {
    logEvent('signIn', identifier);
    return ipcRenderer.invoke('auth-sign-in', identifier, password);
  },
  
  signOut: () => {
    logEvent('signOut');
    return ipcRenderer.invoke('auth-sign-out');
  },
  
  getCurrentUser: () => {
    logEvent('getCurrentUser');
    return ipcRenderer.invoke('auth-get-current-user');
  },
  
  // Send username to main process
  setUsername: (name) => {
    logEvent('setUsername', name);
    return ipcRenderer.invoke('set-username', name);
  },
  
  // Join a specific room
  joinRoom: (roomId) => {
    logEvent('joinRoom', roomId);
    return ipcRenderer.invoke('join-room', roomId);
  },
  
  // Send chat message
  sendMessage: (message) => {
    logEvent('sendMessage', message);
    return ipcRenderer.invoke('send-message', message);
  },
  
  // WebRTC signaling
  sendSignal: (peerId, signal) => {
    logEvent('sendSignal', peerId, signal);
    return ipcRenderer.invoke('send-signal', peerId, signal);
  },
  
  // Get video stream permissions
  getMediaStream: (config) => {
    logEvent('getMediaStream', config);
    return ipcRenderer.invoke('get-media-stream', config);
  },
  
  //  audio
  transcribeAudio: (audioBuffer, username) => {
    try {
      const bufferSize = audioBuffer.byteLength || audioBuffer.length || 'unknown';
      logEvent('transcribeAudio', `Audio from ${username}, size: ${bufferSize} bytes, type: ${audioBuffer.constructor.name}`);
      return ipcRenderer.invoke('transcribe-audio', audioBuffer, username);
    } catch (error) {
      console.error('Error in transcribeAudio:', error);
      logEvent('transcribeAudio', `Error processing audio from ${username}: ${error.message}`);
      return ipcRenderer.invoke('transcribe-audio', audioBuffer, username);
    }
  },
  
  // Get our own peer ID (public key)
  getOwnId: () => {
    return ipcRenderer.invoke('get-own-id');
  },
  
  // Quit the application
  quitApp: () => {
    logEvent('quitApp', 'Application exit requested');
    return ipcRenderer.invoke('quit-app');
  },
  
  // Receive new messages
  onNewMessage: (callback) => {
    console.log('[Preload] Setting up onNewMessage listener');
    ipcRenderer.on('new-message', (event, message) => {
      logEvent('received new-message', message);
      callback(message);
    });
    
    // Return a cleanup function
    return () => {
      console.log('[Preload] Cleaning up onNewMessage listener');
      ipcRenderer.removeAllListeners('new-message');
    };
  },
  
  // Peer connection events
  onPeerConnected: (callback) => {
    console.log('[Preload] Setting up onPeerConnected listener');
    ipcRenderer.on('peer-connected', (event, data) => {
      logEvent('peer-connected', data);
      callback(data);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onPeerConnected listener');
      ipcRenderer.removeAllListeners('peer-connected');
    };
  },
  
  onPeerDisconnected: (callback) => {
    console.log('[Preload] Setting up onPeerDisconnected listener');
    ipcRenderer.on('peer-disconnected', (event, data) => {
      logEvent('peer-disconnected', data);
      callback(data);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onPeerDisconnected listener');
      ipcRenderer.removeAllListeners('peer-disconnected');
    };
  },
  
  // WebRTC signaling events
  onSignalReceived: (callback) => {
    console.log('[Preload] Setting up onSignalReceived listener');
    ipcRenderer.on('signal-received', (event, data) => {
      logEvent('signal-received', data);
      callback(data);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onSignalReceived listener');
      ipcRenderer.removeAllListeners('signal-received');
    };
  },
  
  // Transcription results
  onTranscriptionResult: (callback) => {
    console.log('[Preload] Setting up onTranscriptionResult listener');
    ipcRenderer.on('transcription-result', (event, data) => {
      logEvent('transcription-result', data);
      callback(data);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onTranscriptionResult listener');
      ipcRenderer.removeAllListeners('transcription-result');
    };
  },
  
  // Network error events
  onNetworkError: (callback) => {
    console.log('[Preload] Setting up onNetworkError listener');
    ipcRenderer.on('network-error', (event, error) => {
      logEvent('network-error', error);
      callback(error);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onNetworkError listener');
      ipcRenderer.removeAllListeners('network-error');
    };
  },
  
  // Auth events
  onAuthStateChanged: (callback) => {
    console.log('[Preload] Setting up onAuthStateChanged listener');
    ipcRenderer.on('auth-state-changed', (event, user) => {
      logEvent('auth-state-changed', user);
      callback(user);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onAuthStateChanged listener');
      ipcRenderer.removeAllListeners('auth-state-changed');
    };
  },
  
  // Generate call summary
  generateCallSummary: (transcriptData) => {
    logEvent('generateCallSummary', `Transcript data with ${transcriptData.length} entries`);
    return ipcRenderer.invoke('generate-call-summary', transcriptData);
  },
  
  // Generate task from conversation
  generateTaskFromConversation: (conversationData) => {
    logEvent('generateTaskFromConversation', 'Creating task from conversation data');
    return ipcRenderer.invoke('generate-task-from-conversation', conversationData);
  },
  
  // Send task to all peers via Hypercore
  sendTask: (task) => {
    logEvent('sendTask', 'Sending task to all peers via Hypercore', task);
    return ipcRenderer.invoke('send-task', task);
  },
  
  // Send vote to all peers via Hypercore
  sendVote: (taskId, vote) => {
    logEvent('sendVote', `Sending vote ${vote} for task ${taskId} to all peers via Hypercore`);
    return ipcRenderer.invoke('send-vote', taskId, vote);
  },
  
  // Receive new tasks
  onNewTask: (callback) => {
    console.log('[Preload] Setting up onNewTask listener');
    ipcRenderer.on('new-task', (event, task) => {
      logEvent('received new-task', task);
      callback(task);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onNewTask listener');
      ipcRenderer.removeAllListeners('new-task');
    };
  },
  
  // Receive votes
  onNewVote: (callback) => {
    console.log('[Preload] Setting up onNewVote listener');
    ipcRenderer.on('new-vote', (event, vote) => {
      logEvent('received new-vote', vote);
      callback(vote);
    });
    
    return () => {
      console.log('[Preload] Cleaning up onNewVote listener');
      ipcRenderer.removeAllListeners('new-vote');
    };
  },
  
  // Listen for summary generation request
  onGenerateSummary: (callback) => {
    console.log('[Preload] Setting up onGenerateSummary listener');
    ipcRenderer.on('generate-summary', (event) => {
      logEvent('generate-summary');
      callback();
    });
    
    return () => {
      console.log('[Preload] Cleaning up onGenerateSummary listener');
      ipcRenderer.removeAllListeners('generate-summary');
    };
  },
  
  // Update audio threshold
  updateAudioThreshold: (threshold) => {
    logEvent('updateAudioThreshold', `New threshold: ${threshold}`);
    return ipcRenderer.invoke('update-audio-threshold', threshold);
  },
  
  // Update transcription threshold
  updateTranscriptionThreshold: (threshold) => {
    logEvent('updateTranscriptionThreshold', `New threshold: ${threshold}`);
    return ipcRenderer.invoke('update-transcription-threshold', threshold);
  },
  
  // OpenAI API key management
  getOpenAIApiKey: () => {
    logEvent('getOpenAIApiKey', 'Requesting current API key (masked)');
    return ipcRenderer.invoke('get-openai-api-key');
  },
  
  updateOpenAIApiKey: (apiKey) => {
    logEvent('updateOpenAIApiKey', 'Updating OpenAI API key');
    return ipcRenderer.invoke('update-openai-api-key', apiKey);
  },
  
  // Screen sharing functions
  getScreenSources: () => {
    logEvent('getScreenSources', 'Requesting available screen sharing sources');
    return ipcRenderer.invoke('get-screen-sources');
  },
  
  // Start screen sharing
  startScreenShare: (sourceId) => {
    logEvent('startScreenShare', `Starting screen share with source ID: ${sourceId}`);
    return ipcRenderer.invoke('start-screen-share', sourceId);
  },
  
  // AT Protocol functions
  getPosts: () => {
    logEvent('getPosts');
    return ipcRenderer.invoke('getPosts');
  },
  
  createPost: (content) => {
    logEvent('createPost', content);
    return ipcRenderer.invoke('createPost', content);
  },
  
  createComment: (postUri, content) => {
    logEvent('createComment', postUri, content);
    return ipcRenderer.invoke('createComment', postUri, content);
  },
  
  performPostAction: (postUri, action) => {
    logEvent('performPostAction', postUri, action);
    return ipcRenderer.invoke('performPostAction', postUri, action);
  },
  
  getPostDetail: (postUri) => {
    logEvent('getPostDetail', postUri);
    return ipcRenderer.invoke('getPostDetail', postUri);
  },
});

console.log('Preload script completed initialization'); 