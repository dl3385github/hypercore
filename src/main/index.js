const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const Hyperswarm = require('hyperswarm');
const b4a = require('b4a');
const Hypercore = require('hypercore');
const crypto = require('crypto');
const fs = require('fs');
const { OpenAI } = require('openai');
const axios = require('axios');
require('dotenv').config();

// Hard-coded PDS configuration
const PDS_URL = 'https://pds.hapa.ai'; // .pds.hapa.ai domain for PDS service
const PDS_INVITE_CODE = 'pds-hapa-ai-6tdtr-bgkw2'; // Hard-coded invite code

// Application data
let currentUser = null;
let sessionData = null;
let openaiApiKey = process.env.OPENAI_API_KEY || '';
let openai = null;

// Ensure storage directory exists
if (!fs.existsSync('./storage')) {
  fs.mkdirSync('./storage', { recursive: true });
}

// Temporary directory for audio files
if (!fs.existsSync('./temp')) {
  fs.mkdirSync('./temp', { recursive: true });
}

// Threshold for transcribing audio (minimum volume level required)
let MIN_AUDIO_LEVEL = 0.05; // Default value for mic activation threshold
let TRANSCRIPTION_THRESHOLD = 0.05; // Default value for transcription threshold
const MIN_AUDIO_DURATION = 700; // Minimum milliseconds of audio to transcribe

// Error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Send to renderer if we have a window
  if (mainWindow) {
    mainWindow.webContents.send('network-error', {
      message: `Uncaught error: ${error.message}`
    });
  }
});

// Load API key and settings from storage
function loadApiKey() {
  try {
    if (fs.existsSync('./storage/settings.json')) {
      const settings = JSON.parse(fs.readFileSync('./storage/settings.json', 'utf8'));
      if (settings.openaiApiKey) {
        openaiApiKey = settings.openaiApiKey;
        console.log('Loaded OpenAI API key from settings');
      }
      
      // Load threshold values if they exist
      if (settings.audioThreshold !== undefined) {
        MIN_AUDIO_LEVEL = settings.audioThreshold;
        console.log(`Loaded audio threshold from settings: ${MIN_AUDIO_LEVEL}`);
      }
      
      if (settings.transcriptionThreshold !== undefined) {
        TRANSCRIPTION_THRESHOLD = settings.transcriptionThreshold;
        console.log(`Loaded transcription threshold from settings: ${TRANSCRIPTION_THRESHOLD}`);
      }
    }
  } catch (error) {
    console.error('Error loading settings from storage:', error);
  }
  
  // Initialize OpenAI
  initializeOpenAI();
}

// Initialize OpenAI client with current API key
function initializeOpenAI() {
  if (!openaiApiKey) {
    console.warn('OpenAI API key not set - transcription will not work');
    openai = null;
    return;
  }
  
  openai = new OpenAI({
    apiKey: openaiApiKey
  });
  
  console.log('OpenAI client initialized');
}

// Save API key to storage
function saveApiKey(apiKey) {
  try {
    const settings = {};
    
    // Load existing settings if any
    if (fs.existsSync('./storage/settings.json')) {
      Object.assign(settings, JSON.parse(fs.readFileSync('./storage/settings.json', 'utf8')));
    }
    
    // Update API key
    settings.openaiApiKey = apiKey;
    
    // Save settings
    fs.writeFileSync('./storage/settings.json', JSON.stringify(settings, null, 2), 'utf8');
    console.log('Saved OpenAI API key to settings');
    
    // Update current key and reinitialize client
    openaiApiKey = apiKey;
    initializeOpenAI();
    
    return true;
  } catch (error) {
    console.error('Error saving API key to storage:', error);
    return false;
  }
}

// Save all settings to storage
function saveSettings() {
  try {
    const settings = {};
    
    // Load existing settings if any
    if (fs.existsSync('./storage/settings.json')) {
      Object.assign(settings, JSON.parse(fs.readFileSync('./storage/settings.json', 'utf8')));
    }
    
    // Update with current values
    settings.audioThreshold = MIN_AUDIO_LEVEL;
    settings.transcriptionThreshold = TRANSCRIPTION_THRESHOLD;
    settings.openaiApiKey = openaiApiKey;
    
    // Save settings
    fs.writeFileSync('./storage/settings.json', JSON.stringify(settings, null, 2), 'utf8');
    console.log('Saved all settings to storage');
    
    return true;
  } catch (error) {
    console.error('Error saving settings to storage:', error);
    return false;
  }
}

// Keep a global reference of the window object
let mainWindow;

// Default topic for our chat - will be replaced by user's room choice
let TOPIC = null;

// Keep track of active swarm and connections
let activeSwarm = null;
let activeConnections = new Map();
let username = '';

// Error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Send to renderer if we have a window
  if (mainWindow) {
    mainWindow.webContents.send('network-error', {
      message: `Uncaught error: ${error.message}`
    });
  }
});

function createWindow() {
  try {
    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load the index.html of the app
    const htmlPath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath);

    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
    
    // Log when window is ready
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window loaded successfully');
      
      // Check if we have a session stored
      checkExistingSession();
    });
    
    // Log errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });
  } catch (error) {
    console.error('Error creating window:', error);
  }
}

// Initialize P2P networking when app is ready
app.whenReady().then(() => {
  console.log('App is ready, creating window');
  
  // Load API key from storage
  loadApiKey();
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  // Set up IPC handlers
  setupIpcHandlers();
}).catch(err => {
  console.error('Error during app startup:', err);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  // Generate call summary if possible
  if (mainWindow) {
    try {
      mainWindow.webContents.send('generate-summary');
      // Give a moment for the summary to be generated
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  }
  
  // Clean up swarm connections
  await leaveRoom();
});

// Check for existing session and authenticate
async function checkExistingSession() {
  try {
    // Check if there's a saved session
    if (fs.existsSync('./storage/session.json')) {
      const sessionJson = fs.readFileSync('./storage/session.json', 'utf8');
      const savedSession = JSON.parse(sessionJson);
      
      if (savedSession && savedSession.refreshJwt) {
        console.log('Found existing session, trying to refresh...');
        
        // Try to refresh the session
        const result = await refreshSession(savedSession.refreshJwt);
        
        if (result.success) {
          console.log('Successfully refreshed session');
          updateAuthState(result.user);
        } else {
          console.log('Session refresh failed, need to login again');
          fs.unlinkSync('./storage/session.json');
        }
      }
    }
  } catch (error) {
    console.error('Error checking existing session:', error);
    // If there's an error, we'll just require a fresh login
  }
}

// Set up IPC handlers
function setupIpcHandlers() {
  // Auth handlers
  ipcMain.handle('auth-sign-up', async (event, handle, email, password) => {
    try {
      console.log('Handling sign up request for:', handle);
      const result = await createAccount(handle, email, password);
      
      // Set the user state if sign up was successful
      if (result.success) {
        updateAuthState(result.user);
      }
      
      return result;
    } catch (error) {
      console.error('Error in sign up handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to sign up' 
      };
    }
  });
  
  ipcMain.handle('auth-sign-in', async (event, identifier, password) => {
    try {
      console.log('Handling sign in request for:', identifier);
      const result = await createSession(identifier, password);
      
      // Set the user state if sign in was successful
      if (result.success) {
        updateAuthState(result.user);
        
        // Initialize AT Protocol service with the same credentials
        try {
          const atProtocol = require('./atProtocol');
          await atProtocol.login(identifier, password);
          console.log('AT Protocol service initialized successfully');
        } catch (atError) {
          console.error('Error initializing AT Protocol service:', atError);
          // Continue execution even if AT Protocol initialization fails
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error in sign in handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to sign in' 
      };
    }
  });
  
  ipcMain.handle('auth-sign-out', async (event) => {
    try {
      console.log('Handling sign out request');
      
      // Clear session data
      currentUser = null;
      sessionData = null;
      
      // Remove stored session
      if (fs.existsSync('./storage/session.json')) {
        fs.unlinkSync('./storage/session.json');
      }
      
      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('auth-state-changed', null);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error in sign out handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to sign out' 
      };
    }
  });
  
  ipcMain.handle('auth-get-current-user', (event) => {
    return { 
      success: true, 
      user: currentUser 
    };
  });

  // Listen for auth state changes in the renderer
  ipcMain.on('auth-state-changed', (event, user) => {
    updateAuthState(user);
    
    // Load friends data when user logs in
    if (user && user.did) {
      loadFriendsFromStorage();
    }
  });

  // Handle username setting
  ipcMain.handle('set-username', (event, name) => {
    username = name;
    console.log(`Username set to: ${username}`);
    return { success: true };
  });
  
  // Handle room joining
  ipcMain.handle('join-room', async (event, roomId) => {
    try {
      console.log(`Joining room: ${roomId}`);
      currentRoom = roomId;
      
      // Close previous connections if any
      if (activeSwarm) {
        leaveRoom();
      }
      
      // Join the new room
      await joinRoom(roomId);
      
      return { success: true };
    } catch (error) {
      console.error('Error joining room:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to join room'
      };
    }
  });

  // Get our own peer ID (public key)
  ipcMain.handle('get-own-id', (event) => {
    if (!activeSwarm) {
      return null;
    }
    
    return activeSwarm.keyPair.publicKey.toString('hex');
  });

  // Handle application quit request
  ipcMain.handle('quit-app', (event) => {
    console.log('Quit application requested by renderer');
    app.quit();
    return { success: true };
  });

  // Handle sending messages
  ipcMain.handle('send-message', async (event, message) => {
    try {
      console.log(`Sending message: ${message}`);
      
      if (!activeSwarm) {
        throw new Error('Not connected to any room');
      }
      
      const chatMessage = {
        type: 'chat-message',
        username,
        message,
        timestamp: Date.now()
      };
      
      // Broadcast to all peers
      for (const conn of activeConnections.values()) {
        conn.write(JSON.stringify(chatMessage));
      }
      
      // Also send to UI
      mainWindow.webContents.send('new-message', chatMessage);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Notify renderer of error
      mainWindow.webContents.send('network-error', {
        message: `Failed to send message: ${error.message}`
      });
      
      return { 
        success: false, 
        error: error.message || 'Failed to send message'
      };
    }
  });

  // Handle WebRTC signaling
  ipcMain.handle('send-signal', async (event, peerId, signal) => {
    try {
      if (!activeSwarm) {
        throw new Error('Not connected to any room');
      }

      // Find the connection for this peer
      const connection = activeConnections.get(peerId);
      if (!connection) {
        throw new Error(`No connection found for peer: ${peerId}`);
      }

      // Properly serialize WebRTC objects for transport
      // This ensures that SDP and ICE candidates can be reconstructed on the receiving end
      let serializedSignal = signal;
      
      console.log(`Serializing ${signal.type} signal for peer ${peerId}`, signal);
      
      // For SDP (offer/answer), extract and format the session description
      if (signal.type === 'offer' || signal.type === 'answer') {
        if (signal.sdp && typeof signal.sdp === 'object') {
          serializedSignal = {
            type: signal.type,
            sdp: {
              type: signal.sdp.type,
              sdp: signal.sdp.sdp
            }
          };
          console.log(`Serialized ${signal.type} SDP:`, serializedSignal.sdp);
        } else {
          console.error(`Invalid SDP format in ${signal.type}:`, signal.sdp);
        }
      }
      // For ICE candidates, extract and format the candidate data
      else if (signal.type === 'ice-candidate' && signal.candidate) {
        serializedSignal = {
          type: signal.type,
          candidate: {
            candidate: signal.candidate.candidate,
            sdpMid: signal.candidate.sdpMid,
            sdpMLineIndex: signal.candidate.sdpMLineIndex,
            usernameFragment: signal.candidate.usernameFragment
          }
        };
        console.log(`Serialized ICE candidate:`, serializedSignal.candidate);
      } else {
        console.error(`Unknown signal type or missing data:`, signal);
      }

      // Send the serialized signal to the peer
      const signalMessage = {
        type: 'rtc-signal',
        from: username,
        signal: serializedSignal,
        timestamp: Date.now()
      };
      
      connection.write(JSON.stringify(signalMessage));
      
      return { success: true };
    } catch (error) {
      console.error('Error sending signal:', error);
      
      mainWindow.webContents.send('network-error', {
        message: `Failed to send signal: ${error.message}`
      });
      
      return { 
        success: false, 
        error: error.message || 'Failed to send signal'
      };
    }
  });
  
  // Handle audio transcription
  ipcMain.handle('transcribe-audio', async (event, audioBuffer, username) => {
    try {
      // Check if OpenAI client is initialized
      if (!openai) {
        return { 
          success: false, 
          error: 'OpenAI API key not set. Please configure in settings.'
        };
      }
      
      // Convert buffer to Uint8Array for audio level check
      const audioData = new Uint8Array(audioBuffer);
      
      // Check if audio meets global threshold
      if (!checkAudioLevel(audioData)) {
        console.log(`Audio from ${username} below global threshold ${TRANSCRIPTION_THRESHOLD}, skipping transcription`);
        return { 
          success: true, 
          transcription: '',
          username,
          speaker: username,
          text: '',
          timestamp: Date.now()
        };
      }
      
      // Process the audio buffer and transcribe
      const timestamp = Date.now();
      const filename = `./temp/audio_${timestamp}_${Math.floor(Math.random() * 1000)}.wav`;
      
      console.log(`Processing audio file for transcription: ${filename}`);
      
      // Write to file
      fs.writeFileSync(filename, Buffer.from(audioData));
      
      // Call OpenAI's transcription API
      console.log(`Sending audio file to OpenAI for transcription: ${filename}`);
      const transcription = await transcribeAudio(filename);
      
      console.log(`Transcription received: ${transcription}`);
      
      // Delete the temporary file
      try {
        fs.unlinkSync(filename);
      } catch (err) {
        console.error(`Error deleting temp file ${filename}:`, err);
      }
      
      return { 
        success: true, 
        transcription,
        username,
        speaker: username,
        text: transcription,
        timestamp 
      };
    } catch (error) {
      console.error(`Error in transcription API call for ${username}:`, error);
      return { 
        success: false, 
        error: error.message || 'Transcription failed'
      };
    }
  });
  
  // Update audio threshold
  ipcMain.handle('update-audio-threshold', (event, threshold) => {
    try {
      MIN_AUDIO_LEVEL = parseFloat(threshold);
      console.log(`Updated audio threshold to ${MIN_AUDIO_LEVEL}`);
      saveSettings();
      return { success: true };
    } catch (error) {
      console.error('Error updating audio threshold:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update threshold'
      };
    }
  });
  
  // Update transcription threshold
  ipcMain.handle('update-transcription-threshold', (event, threshold) => {
    try {
      TRANSCRIPTION_THRESHOLD = parseFloat(threshold);
      console.log(`Updated global transcription threshold to ${TRANSCRIPTION_THRESHOLD}`);
      saveSettings();
      return { success: true };
    } catch (error) {
      console.error('Error updating transcription threshold:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update transcription threshold'
      };
    }
  });
  
  // Update OpenAI API key
  ipcMain.handle('update-openai-api-key', (event, apiKey) => {
    try {
      console.log('Updating OpenAI API key');
      const success = saveApiKey(apiKey);
      
      return { 
        success, 
        message: success ? 'API key updated successfully' : 'Failed to save API key'
      };
    } catch (error) {
      console.error('Error updating OpenAI API key:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update API key'
      };
    }
  });
  
  // Get current OpenAI API key (masked for security)
  ipcMain.handle('get-openai-api-key', (event) => {
    try {
      if (!openaiApiKey) {
        return { 
          success: true, 
          apiKey: '' 
        };
      }
      
      // Mask the API key except for the first and last 4 characters
      const maskedKey = openaiApiKey.length > 8 
        ? `${openaiApiKey.substring(0, 4)}...${openaiApiKey.substring(openaiApiKey.length - 4)}`
        : '****';
        
      return { 
        success: true, 
        apiKey: maskedKey,
        isSet: !!openaiApiKey
      };
    } catch (error) {
      console.error('Error getting OpenAI API key:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get API key'
      };
    }
  });
  
  // Generate call summary
  ipcMain.handle('generate-call-summary', async (event, transcriptData) => {
    try {
      if (!transcriptData || transcriptData.length === 0) {
        return { 
          success: false, 
          error: 'No transcript data available to summarize' 
        };
      }
      
      console.log(`Generating summary from ${transcriptData.length} transcript entries`);
      
      // Format the transcript data
      const formattedTranscript = transcriptData
        .map(entry => `${entry.username}: ${entry.text}`)
        .join('\n');
      
      // Use OpenAI to generate a summary
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an assistant that summarizes meeting transcripts. Create a concise summary of the key points discussed, organized by topics. Include action items if any were mentioned." 
          },
          { 
            role: "user", 
            content: `Please summarize this meeting transcript:\n\n${formattedTranscript}` 
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      const summary = completion.choices[0].message.content;
      console.log('Summary generated successfully');
      
      return { 
        success: true, 
        summary 
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to generate summary'
      };
    }
  });

  // Generate task from conversation
  ipcMain.handle('generate-task-from-conversation', async (event, conversationData) => {
    try {
      if (!conversationData) {
        return { 
          success: false, 
          error: 'No conversation data provided to generate task' 
        };
      }
      
      console.log('Generating task from conversation');
      
      // Use OpenAI to generate a task
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an assistant that helps extract actionable tasks from meeting conversations. Your goal is to identify commitments, action items, and decisions that should be tracked." 
          },
          { 
            role: "user", 
            content: conversationData
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      });
      
      const task = completion.choices[0].message.content;
      console.log('Task generated successfully:', task);
      
      return { 
        success: true, 
        task 
      };
    } catch (error) {
      console.error('Error generating task:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to generate task'
      };
    }
  });

  // Get display media sources for screen sharing
  ipcMain.handle('get-screen-sources', async () => {
    try {
      console.log('Getting screen sources for sharing');
      const sources = await desktopCapturer.getSources({ 
        types: ['window', 'screen'],
        thumbnailSize: { width: 320, height: 180 }
      });
      
      // Convert sources to a format that can be sent via IPC
      // (remove native Image objects and convert to base64)
      const serializedSources = sources.map(source => {
        return {
          id: source.id,
          name: source.name,
          display_id: source.display_id,
          appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
          thumbnail: source.thumbnail.toDataURL()
        };
      });
      
      return { 
        success: true, 
        sources: serializedSources 
      };
    } catch (error) {
      console.error('Error getting screen sources:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get screen sources' 
      };
    }
  });
  
  // Handle screen share start request
  ipcMain.handle('start-screen-share', async (event, sourceId) => {
    try {
      console.log(`Starting screen share with source ID: ${sourceId}`);
      
      // In Electron, screen capture is handled in the renderer directly using 
      // getUserMedia with the chromeMediaSourceId, so we just return success
      // to acknowledge the request
      return { 
        success: true
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to start screen share' 
      };
    }
  });

  // Handle task creation and broadcast
  ipcMain.handle('send-task', async (event, task) => {
    try {
      console.log(`Sending task via Hypercore: ${task.text}`);
      
      if (!activeSwarm) {
        throw new Error('Not connected to any room');
      }
      
      const taskMessage = {
        type: 'new-task',
        task: task,
        lastTaskTimestamp: task.toTimestamp,
        timestamp: Date.now()
      };
      
      // Broadcast to all peers using the same channel as chat messages
      for (const conn of activeConnections.values()) {
        conn.write(JSON.stringify(taskMessage));
      }
      
      // Also send to UI so the user's own UI updates
      mainWindow.webContents.send('new-task', taskMessage);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending task:', error);
      
      // Notify renderer of error
      mainWindow.webContents.send('network-error', {
        message: `Failed to send task: ${error.message}`
      });
      
      return { 
        success: false, 
        error: error.message || 'Failed to send task'
      };
    }
  });

  // Handle vote broadcast
  ipcMain.handle('send-vote', async (event, taskId, vote) => {
    try {
      console.log(`Sending vote via Hypercore: ${vote} for task ${taskId}`);
      
      if (!activeSwarm) {
        throw new Error('Not connected to any room');
      }
      
      const voteMessage = {
        type: 'task-vote',
        taskId: taskId,
        vote: vote,
        peerId: activeSwarm.keyPair.publicKey.toString('hex'),
        username: username,
        timestamp: Date.now()
      };
      
      // Broadcast to all peers using the same channel as chat messages
      for (const conn of activeConnections.values()) {
        conn.write(JSON.stringify(voteMessage));
      }
      
      // Also send to UI so the user's own UI updates
      mainWindow.webContents.send('new-vote', voteMessage);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending vote:', error);
      
      // Notify renderer of error
      mainWindow.webContents.send('network-error', {
        message: `Failed to send vote: ${error.message}`
      });
      
      return { 
        success: false, 
        error: error.message || 'Failed to send vote'
      };
    }
  });

  // AT Protocol Handlers
  ipcMain.handle('getPosts', async () => {
    console.log('Handling getPosts request');
    try {
      const atProtocol = require('./atProtocol');
      return await atProtocol.getPosts();
    } catch (error) {
      console.error('Error handling getPosts:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get posts' 
      };
    }
  });

  ipcMain.handle('createPost', async (event, content) => {
    console.log('Handling createPost request:', content);
    try {
      const atProtocol = require('./atProtocol');
      return await atProtocol.createPost(content);
    } catch (error) {
      console.error('Error handling createPost:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create post' 
      };
    }
  });

  ipcMain.handle('createComment', async (event, postUri, content) => {
    console.log('Handling createComment request:', postUri, content);
    try {
      const atProtocol = require('./atProtocol');
      return await atProtocol.createComment(postUri, content);
    } catch (error) {
      console.error('Error handling createComment:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create comment' 
      };
    }
  });

  ipcMain.handle('performPostAction', async (event, postUri, action) => {
    console.log('Handling performPostAction request:', postUri, action);
    try {
      const atProtocol = require('./atProtocol');
      return await atProtocol.performPostAction(postUri, action);
    } catch (error) {
      console.error('Error handling performPostAction:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to perform post action' 
      };
    }
  });

  ipcMain.handle('getPostDetail', async (event, postUri) => {
    console.log('Handling getPostDetail request:', postUri);
    try {
      const atProtocol = require('./atProtocol');
      return await atProtocol.getPostDetail(postUri);
    } catch (error) {
      console.error('Error handling getPostDetail:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get post detail' 
      };
    }
  });

  // Friends handlers
  ipcMain.handle('get-friends', async (event) => {
    try {
      console.log('Getting friends list');
      return getFriends();
    } catch (error) {
      console.error('Error in get-friends handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get friends' 
      };
    }
  });
  
  ipcMain.handle('create-friend-request', async (event, targetDid) => {
    try {
      console.log('Handling create friend request for:', targetDid);
      const result = await createFriendRequest(targetDid);
      return result;
    } catch (error) {
      console.error('Error in create-friend-request handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create friend request' 
      };
    }
  });
  
  ipcMain.handle('accept-friend-request', async (event, requestId) => {
    try {
      console.log('Handling accept friend request for:', requestId);
      const result = await acceptFriendRequest(requestId);
      return result;
    } catch (error) {
      console.error('Error in accept-friend-request handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to accept friend request' 
      };
    }
  });
  
  ipcMain.handle('get-friend-chat-messages', async (event, friendDid) => {
    try {
      console.log('Getting chat messages for friend:', friendDid);
      return getFriendChatMessages(friendDid);
    } catch (error) {
      console.error('Error in get-friend-chat-messages handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get chat messages' 
      };
    }
  });
  
  ipcMain.handle('send-friend-message', async (event, friendDid, text) => {
    try {
      console.log('Handling send friend message to:', friendDid);
      const result = await sendFriendMessage(friendDid, text);
      
      // If successful, notify renderer about the new message
      if (result.success && mainWindow) {
        mainWindow.webContents.send('new-friend-message', {
          friendDid,
          message: result.message
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in send-friend-message handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send message' 
      };
    }
  });
  
  ipcMain.handle('create-friend-video-call', async (event, friendDid) => {
    try {
      console.log('Creating video call with friend:', friendDid);
      return createFriendVideoCallRoom(friendDid);
    } catch (error) {
      console.error('Error in create-friend-video-call handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create video call' 
      };
    }
  });
  
  // For testing only - simulate receiving a friend request
  ipcMain.handle('simulate-friend-request', async (event, fromDid) => {
    try {
      console.log('Simulating friend request from:', fromDid);
      return simulateIncomingFriendRequest(fromDid);
    } catch (error) {
      console.error('Error in simulate-friend-request handler:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to simulate friend request' 
      };
    }
  });
}

// Transcribe audio using OpenAI
async function transcribeAudio(filePath) {
  try {
    // Check if OpenAI client is initialized
    if (!openai) {
      throw new Error('OpenAI API key not set. Please configure in settings.');
    }
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",  // Using whisper-1 since gpt-4o-transcribe requires different API format
      language: "en",
    });
    
    console.log(`OpenAI transcription returned: "${transcription.text}"`);
    
    if (!transcription.text || transcription.text.trim() === '') {
      console.log(`Transcription ignored (too short): ${transcription.text}`);
      return '';
    }
    
    if (transcription.text.length < 2) {
      console.log(`Empty or short transcription: "${transcription.text}"`);
      return '';
    }
    
    console.log(`Valid transcription: "${transcription.text}"`);
    return transcription.text;
  } catch (error) {
    console.error('Error in OpenAI transcription API call:', error);
    throw error;
  }
}

// Create Hyperswarm topic from roomId
function getRoomTopic(roomId) {
  return crypto.createHash('sha256')
    .update(roomId)
    .digest();
}

// Join room with given ID
async function joinRoom(roomId) {
  try {
    console.log(`Creating topic for room ${roomId}`);
    
    // Create a new hyperswarm
    activeSwarm = new Hyperswarm();
    TOPIC = getRoomTopic(roomId);
    
    console.log(`Joined swarm with topic: ${TOPIC.toString('hex')}`);
    
    // Join the topic
    const discovery = activeSwarm.join(TOPIC, { server: true, client: true });
    
    // Set up connection handler
    activeSwarm.on('connection', (conn, info) => {
      handleConnection(conn, info);
    });
    
    // Listen for disconnection
    activeSwarm.on('disconnection', (conn, info) => {
      handleDisconnection(conn, info);
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

// Handle new peer connection
function handleConnection(conn, info) {
  try {
    // Get peer ID as hex
    const peerId = info.publicKey.toString('hex');
    console.log(`New connection from: ${peerId}`);
    
    // Store connection
    activeConnections.set(peerId, conn);
    
    // Update peer count in UI
    if (mainWindow) {
      mainWindow.webContents.send('peer-connected', {
        id: peerId,
        connections: activeConnections.size
      });
    }
    
    // Handle incoming data
    conn.on('data', data => {
      try {
        // Parse the message
        const message = JSON.parse(data.toString());
        
        // Forward to UI based on message type
        if (message.type === 'chat-message') {
          if (mainWindow) {
            mainWindow.webContents.send('new-message', message);
          }
        } else if (message.type === 'rtc-signal') {
          if (mainWindow) {
            mainWindow.webContents.send('signal-received', {
              peerId,
              signal: message.signal,
              from: message.from
            });
          }
        } else if (message.type === 'new-task') {
          if (mainWindow) {
            console.log(`Received task from peer ${peerId}:`, message.task);
            
            // Forward to UI
            mainWindow.webContents.send('new-task', message);
            
            // IMPORTANT: Rebroadcast to all other peers to ensure task propagation
            for (const [otherPeerId, otherConn] of activeConnections.entries()) {
              // Don't send back to the original sender
              if (otherPeerId !== peerId) {
                console.log(`Rebroadcasting task to peer ${otherPeerId}`);
                otherConn.write(data); // Use original data to preserve exact format
              }
            }
          }
        } else if (message.type === 'task-vote') {
          if (mainWindow) {
            console.log(`Received vote from peer ${peerId}: ${message.vote} for task ${message.taskId}`);
            
            // Forward to UI
            mainWindow.webContents.send('new-vote', message);
            
            // IMPORTANT: Rebroadcast to all other peers to ensure vote propagation
            for (const [otherPeerId, otherConn] of activeConnections.entries()) {
              // Don't send back to the original sender
              if (otherPeerId !== peerId) {
                console.log(`Rebroadcasting vote to peer ${otherPeerId}`);
                otherConn.write(data); // Use original data to preserve exact format
              }
            }
          }
        }
        
        console.log(`Received message:`, message);
      } catch (error) {
        console.error(`Error handling message from ${peerId}:`, error);
      }
    });
    
    // Handle connection errors
    conn.on('error', error => {
      console.error(`Connection error with peer ${peerId}:`, error);
    });
    
    // Handle connection close
    conn.on('close', () => {
      console.log(`Connection closed with peer ${peerId}`);
      activeConnections.delete(peerId);
      
      // Update UI
      if (mainWindow) {
        mainWindow.webContents.send('peer-disconnected', {
          id: peerId,
          connections: activeConnections.size
        });
      }
    });
  } catch (error) {
    console.error('Error handling connection:', error);
  }
}

// Handle peer disconnection
function handleDisconnection(conn, info) {
  try {
    // Get peer ID as hex
    const peerId = info.publicKey.toString('hex');
    console.log(`Peer disconnected: ${peerId}`);
    
    // Remove from active connections
    activeConnections.delete(peerId);
    
    // Update UI
    if (mainWindow) {
      mainWindow.webContents.send('peer-disconnected', {
        id: peerId,
        connections: activeConnections.size
      });
    }
  } catch (error) {
    console.error('Error handling disconnection:', error);
  }
}

// Leave current room
async function leaveRoom() {
  if (!activeSwarm) return;
  
  try {
    console.log('Leaving current room');
    
    // Close all connections
    for (const [peerId, conn] of activeConnections.entries()) {
      console.log(`Closing connection to peer: ${peerId}`);
      conn.destroy();
    }
    
    // Clear connections map
    activeConnections.clear();
    
    // Leave the swarm
    if (TOPIC) {
      activeSwarm.leave(TOPIC);
    }
    
    // Destroy the swarm
    await activeSwarm.destroy();
    activeSwarm = null;
    TOPIC = null;
    
    console.log('Successfully left room');
  } catch (error) {
    console.error('Error leaving room:', error);
  }
}

// ====== AT Protocol Authentication Functions ======

// Create account on PDS
async function createAccount(handle, email, password) {
  try {
    // Ensure handle doesn't contain domain already
    if (handle.includes('.')) {
      // Just use the handle as provided
    } else {
      // Add domain if not present
      handle = `${handle}.pds.hapa.ai`;
    }
    
    console.log(`Creating account for ${handle} on ${PDS_URL}`);
    
    // Make request to PDS to create account
    const response = await axios.post(`${PDS_URL}/xrpc/com.atproto.server.createAccount`, {
      email,
      handle,
      password,
      inviteCode: PDS_INVITE_CODE
    });
    
    if (!response.data || !response.data.did) {
      throw new Error('Invalid response from PDS');
    }
    
    console.log('Account created successfully:', response.data);
    
    // Store session data
    sessionData = {
      accessJwt: response.data.accessJwt,
      refreshJwt: response.data.refreshJwt,
      handle: response.data.handle,
      did: response.data.did
    };
    
    // Save session for future use
    saveSession(sessionData);
    
    // Create a Hypercore ID based on the DID
    const hypercoreId = generateHypercoreIdFromDid(response.data.did);
    
    const userData = {
      did: response.data.did,
      handle: response.data.handle,
      email,
      hypercoreId
    };
    
    return {
      success: true,
      user: userData
    };
  } catch (error) {
    console.error('Error creating account:', error);
    
    // Extract error message from response if available
    let errorMessage = 'Failed to create account';
    if (error.response && error.response.data) {
      errorMessage = error.response.data.message || error.response.data.error || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Create session (sign in)
async function createSession(identifier, password) {
  try {
    // Ensure identifier contains domain if not already present
    if (!identifier.includes('.')) {
      identifier = `${identifier}.pds.hapa.ai`;
    }
    
    console.log(`Creating session for ${identifier} on ${PDS_URL}`);
    
    // Make request to PDS to create session
    const response = await axios.post(`${PDS_URL}/xrpc/com.atproto.server.createSession`, {
      identifier,
      password
    });
    
    if (!response.data || !response.data.did) {
      throw new Error('Invalid response from PDS');
    }
    
    console.log('Session created successfully');
    
    // Store session data
    sessionData = {
      accessJwt: response.data.accessJwt,
      refreshJwt: response.data.refreshJwt,
      handle: response.data.handle,
      did: response.data.did
    };
    
    // Save session for future use
    saveSession(sessionData);
    
    // Create a Hypercore ID based on the DID
    const hypercoreId = generateHypercoreIdFromDid(response.data.did);
    
    const userData = {
      did: response.data.did,
      handle: response.data.handle,
      hypercoreId
    };
    
    return {
      success: true,
      user: userData
    };
  } catch (error) {
    console.error('Error creating session:', error);
    
    // Extract error message from response if available
    let errorMessage = 'Failed to sign in';
    if (error.response && error.response.data) {
      errorMessage = error.response.data.message || error.response.data.error || errorMessage;
      
      // Add more context if it's an authentication error
      if (error.response.status === 401) {
        errorMessage = 'Invalid username or password. Please try again.';
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Refresh session
async function refreshSession(refreshJwt) {
  try {
    console.log('Refreshing session');
    
    // Make request to PDS to refresh session
    const response = await axios.post(`${PDS_URL}/xrpc/com.atproto.server.refreshSession`, {}, {
      headers: {
        'Authorization': `Bearer ${refreshJwt}`
      }
    });
    
    if (!response.data || !response.data.did) {
      throw new Error('Invalid response from PDS');
    }
    
    console.log('Session refreshed successfully');
    
    // Store session data
    sessionData = {
      accessJwt: response.data.accessJwt,
      refreshJwt: response.data.refreshJwt,
      handle: response.data.handle,
      did: response.data.did
    };
    
    // Save session for future use
    saveSession(sessionData);
    
    // Create a Hypercore ID based on the DID
    const hypercoreId = generateHypercoreIdFromDid(response.data.did);
    
    const userData = {
      did: response.data.did,
      handle: response.data.handle,
      hypercoreId
    };
    
    return {
      success: true,
      user: userData
    };
  } catch (error) {
    console.error('Error refreshing session:', error);
    return {
      success: false,
      error: error.message || 'Failed to refresh session'
    };
  }
}

// Update auth state
function updateAuthState(user) {
  currentUser = user;
  
  // Set username to handle if available
  if (user && user.handle) {
    username = user.handle;
  }
  
  // If user is logged in, load their friends
  if (user && user.did) {
    // Load friends data
    loadFriendsFromStorage();
  } else {
    // Clear friends data when logged out
    friends.clear();
    friendRequests.clear();
    friendChats.clear();
  }
  
  // Notify renderer of auth state change
  if (mainWindow) {
    mainWindow.webContents.send('auth-state-changed', user);
  }
}

// Save session to storage
function saveSession(session) {
  if (!session) return;
  
  try {
    // Create storage directory if it doesn't exist
    if (!fs.existsSync('./storage')) {
      fs.mkdirSync('./storage', { recursive: true });
    }
    
    // Save session to file
    fs.writeFileSync('./storage/session.json', JSON.stringify(session), 'utf8');
    console.log('Session saved to storage');
  } catch (error) {
    console.error('Error saving session to storage:', error);
  }
}

// Generate a Hypercore ID from a DID
function generateHypercoreIdFromDid(did) {
  if (!did) return null;
  
  // Hash the DID to create a deterministic ID
  const hash = crypto.createHash('sha256').update(did).digest('hex');
  
  return hash;
}

// Function to check if audio level meets threshold
function checkAudioLevel(audioData) {
  // Calculate RMS (Root Mean Square) of audio data
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sum / audioData.length);
  
  // Check against global transcription threshold
  return rms >= TRANSCRIPTION_THRESHOLD;
}

// ====== Friends Management ======

// Store friends data
const friends = new Map(); // Map of friend DID to friend data
const friendRequests = new Map(); // Map of request ID to request data
const friendChats = new Map(); // Map of friend DID to chat feed

// Create a new friend request
async function createFriendRequest(targetDid) {
  try {
    console.log(`Creating friend request to ${targetDid}`);
    
    if (!currentUser || !currentUser.did) {
      throw new Error('You must be logged in to add friends');
    }
    
    // Check if already friends
    if (friends.has(targetDid)) {
      throw new Error('You are already friends with this user');
    }
    
    // Check if there's a pending request
    for (const [id, request] of friendRequests) {
      if (request.to === targetDid && request.from === currentUser.did) {
        throw new Error('You already have a pending request to this user');
      }
    }
    
    // Create a signed request
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Create a request object
    const request = {
      id: requestId,
      from: currentUser.did,
      to: targetDid,
      timestamp: timestamp,
      status: 'pending'
    };
    
    // Sign the request with our private key
    const signature = await signWithUserKey(JSON.stringify(request));
    request.signature = signature;
    
    // Store the request
    friendRequests.set(requestId, request);
    
    // In a real implementation, we would broadcast this request to the network
    // or store it in a Hypercore feed for the target user to discover
    
    // For now, we'll simulate this with a direct method call
    // In practice, you'd use Hyperswarm discovery to locate the user's device
    
    console.log('Friend request created:', request);
    
    return {
      success: true,
      request
    };
  } catch (error) {
    console.error('Error creating friend request:', error);
    return {
      success: false,
      error: error.message || 'Failed to create friend request'
    };
  }
}

// Handle incoming friend request
async function handleIncomingFriendRequest(request) {
  try {
    console.log(`Handling incoming friend request from ${request.from}`);
    
    // Verify the request signature
    const isValid = await verifySignature(request.from, JSON.stringify({
      id: request.id,
      from: request.from,
      to: request.to,
      timestamp: request.timestamp,
      status: 'pending'
    }), request.signature);
    
    if (!isValid) {
      throw new Error('Invalid request signature');
    }
    
    // Store the request
    friendRequests.set(request.id, request);
    
    // Notify the renderer
    if (mainWindow) {
      mainWindow.webContents.send('friend-request-received', request);
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error handling friend request:', error);
    return {
      success: false,
      error: error.message || 'Failed to handle friend request'
    };
  }
}

// Accept a friend request
async function acceptFriendRequest(requestId) {
  try {
    console.log(`Accepting friend request ${requestId}`);
    
    // Get the request
    const request = friendRequests.get(requestId);
    if (!request) {
      throw new Error('Friend request not found');
    }
    
    // Verify the request is for the current user
    if (request.to !== currentUser.did) {
      throw new Error('This request is not for you');
    }
    
    // Update request status
    request.status = 'accepted';
    request.acceptedAt = Date.now();
    
    // Sign the acceptance
    const acceptanceSignature = await signWithUserKey(JSON.stringify({
      id: request.id,
      from: request.from,
      to: request.to,
      timestamp: request.timestamp,
      status: 'accepted',
      acceptedAt: request.acceptedAt
    }));
    
    request.acceptanceSignature = acceptanceSignature;
    
    // Add the user to our friends list
    await addFriend(request.from, request);
    
    // In a real implementation, we would notify the other user through the network
    // For now, we'll just update our local state
    
    return {
      success: true,
      friend: friends.get(request.from)
    };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return {
      success: false,
      error: error.message || 'Failed to accept friend request'
    };
  }
}

// Add a friend to our friends list
async function addFriend(did, request) {
  try {
    console.log(`Adding friend: ${did}`);
    
    // Create friend entry if it doesn't exist
    if (!friends.has(did)) {
      // Derive a shared secret for this friendship using Diffie-Hellman
      // In a real implementation, this would use the friend's public key and our private key
      const sharedSecret = await deriveSharedSecret(did);
      
      const friend = {
        did,
        addedAt: Date.now(),
        sharedSecret,
        request: request || null,
        chatFeed: null
      };
      
      // Create a Hypercore feed for chat messages with this friend
      const chatFeed = await createChatFeed(did, sharedSecret);
      friend.chatFeed = chatFeed;
      
      // Store the friend
      friends.set(did, friend);
      
      // Save friends to persistent storage
      saveFriendsToStorage();
      
      console.log('Friend added successfully:', friend);
    }
    
    return {
      success: true,
      friend: friends.get(did)
    };
  } catch (error) {
    console.error('Error adding friend:', error);
    return {
      success: false,
      error: error.message || 'Failed to add friend'
    };
  }
}

// Create a chat feed for a friend
async function createChatFeed(friendDid, sharedSecret) {
  try {
    console.log(`Creating chat feed for friend: ${friendDid}`);
    
    // In a real implementation, we would create a Hypercore feed
    // encrypted with the shared secret
    
    // For this example, we'll simulate a feed with an array
    const chatFeed = {
      id: crypto.randomUUID(),
      messages: [],
      encryptionKey: sharedSecret,
      friendDid
    };
    
    // Store the feed
    friendChats.set(friendDid, chatFeed);
    
    return chatFeed;
  } catch (error) {
    console.error('Error creating chat feed:', error);
    throw error;
  }
}

// Sign data with the user's private key
async function signWithUserKey(data) {
  // In a real implementation, this would use the user's private key
  // For now, we'll simulate this with a simple hash
  const signature = crypto.createHash('sha256').update(data + currentUser.did).digest('hex');
  return signature;
}

// Verify a signature with a public key
async function verifySignature(publicKey, data, signature) {
  // In a real implementation, this would verify the signature with the public key
  // For now, we'll simulate this with a simple hash comparison
  const expectedSignature = crypto.createHash('sha256').update(data + publicKey).digest('hex');
  return signature === expectedSignature;
}

// Derive a shared secret using Diffie-Hellman
async function deriveSharedSecret(friendDid) {
  // In a real implementation, this would use Diffie-Hellman with the friend's public key
  // For now, we'll simulate this with a simple hash
  const sharedSecret = crypto.createHash('sha256').update(currentUser.did + friendDid).digest('hex');
  return sharedSecret;
}

// Generate a room ID from a shared secret
function generateRoomIdFromSharedSecret(sharedSecret) {
  // Use the first 12 characters of the SHA-256 hash of the shared secret
  return crypto.createHash('sha256').update(sharedSecret).digest('hex').substring(0, 12);
}

// Save friends to storage
function saveFriendsToStorage() {
  try {
    // Convert friends map to an array for storage
    const friendsArray = Array.from(friends.values()).map(friend => ({
      did: friend.did,
      addedAt: friend.addedAt,
      sharedSecret: friend.sharedSecret
    }));
    
    // Save to a file in the user data directory
    const friendsPath = path.join(app.getPath('userData'), `friends_${currentUser.did}.json`);
    fs.writeFileSync(friendsPath, JSON.stringify(friendsArray, null, 2));
    
    console.log('Friends saved to storage');
  } catch (error) {
    console.error('Error saving friends to storage:', error);
  }
}

// Load friends from storage
function loadFriendsFromStorage() {
  try {
    if (!currentUser || !currentUser.did) return;
    
    const friendsPath = path.join(app.getPath('userData'), `friends_${currentUser.did}.json`);
    
    if (!fs.existsSync(friendsPath)) {
      console.log('No friends file found, starting with empty friends list');
      return;
    }
    
    const friendsData = fs.readFileSync(friendsPath, 'utf8');
    const friendsArray = JSON.parse(friendsData);
    
    // Clear existing friends
    friends.clear();
    
    // Load friends and reconstruct chat feeds
    for (const friendData of friendsArray) {
      const chatFeed = {
        id: crypto.randomUUID(),
        messages: [],
        encryptionKey: friendData.sharedSecret,
        friendDid: friendData.did
      };
      
      const friend = {
        did: friendData.did,
        addedAt: friendData.addedAt,
        sharedSecret: friendData.sharedSecret,
        request: null,
        chatFeed: chatFeed
      };
      
      friends.set(friendData.did, friend);
      friendChats.set(friendData.did, chatFeed);
    }
    
    console.log(`Loaded ${friends.size} friends from storage`);
    
    // Load chat messages for each friend
    loadFriendChatMessages();
  } catch (error) {
    console.error('Error loading friends from storage:', error);
  }
}

// Load chat messages for all friends
function loadFriendChatMessages() {
  try {
    if (!currentUser || !currentUser.did) return;
    
    for (const [friendDid, friend] of friends.entries()) {
      const chatPath = path.join(app.getPath('userData'), `chat_${currentUser.did}_${friendDid}.json`);
      
      if (!fs.existsSync(chatPath)) {
        console.log(`No chat file found for friend ${friendDid}`);
        continue;
      }
      
      const chatData = fs.readFileSync(chatPath, 'utf8');
      const messages = JSON.parse(chatData);
      
      // Decrypt messages (in a real implementation)
      // In this example, we'll just use the messages as is
      
      // Update the chat feed
      friend.chatFeed.messages = messages;
    }
    
    console.log('Chat messages loaded for all friends');
  } catch (error) {
    console.error('Error loading friend chat messages:', error);
  }
}

// Save chat messages for a friend
function saveFriendChatMessages(friendDid) {
  try {
    if (!currentUser || !currentUser.did) return;
    
    const chatFeed = friendChats.get(friendDid);
    if (!chatFeed) return;
    
    // Encrypt messages (in a real implementation)
    // In this example, we'll just save the messages as is
    
    const chatPath = path.join(app.getPath('userData'), `chat_${currentUser.did}_${friendDid}.json`);
    fs.writeFileSync(chatPath, JSON.stringify(chatFeed.messages, null, 2));
    
    console.log(`Chat messages saved for friend ${friendDid}`);
  } catch (error) {
    console.error('Error saving friend chat messages:', error);
  }
}

// Send a message to a friend
async function sendFriendMessage(friendDid, text) {
  try {
    console.log(`Sending message to friend ${friendDid}: ${text}`);
    
    if (!currentUser || !currentUser.did) {
      throw new Error('You must be logged in to send messages');
    }
    
    // Check if the user is our friend
    if (!friends.has(friendDid)) {
      throw new Error('This user is not in your friends list');
    }
    
    const friend = friends.get(friendDid);
    const chatFeed = friend.chatFeed;
    
    // Create the message
    const message = {
      id: crypto.randomUUID(),
      sender: currentUser.did,
      text,
      timestamp: Date.now(),
      status: 'sent'
    };
    
    // Sign the message
    message.signature = await signWithUserKey(JSON.stringify({
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestamp: message.timestamp
    }));
    
    // In a real implementation, this would append to a Hypercore feed
    // that both users have access to
    
    // Add to the chat feed
    chatFeed.messages.push(message);
    
    // Save to disk
    saveFriendChatMessages(friendDid);
    
    // In a real implementation, the message would be automatically shared
    // through Hyperswarm. For now, we'll just update our local state.
    
    return {
      success: true,
      message
    };
  } catch (error) {
    console.error('Error sending friend message:', error);
    return {
      success: false,
      error: error.message || 'Failed to send message'
    };
  }
}

// Get all friends
function getFriends() {
  try {
    const friendsList = Array.from(friends.values()).map(friend => ({
      did: friend.did,
      addedAt: friend.addedAt
    }));
    
    return {
      success: true,
      friends: friendsList
    };
  } catch (error) {
    console.error('Error getting friends:', error);
    return {
      success: false,
      error: error.message || 'Failed to get friends'
    };
  }
}

// Get all chat messages with a friend
function getFriendChatMessages(friendDid) {
  try {
    // Check if the user is our friend
    if (!friends.has(friendDid)) {
      throw new Error('This user is not in your friends list');
    }
    
    const friend = friends.get(friendDid);
    const chatFeed = friend.chatFeed;
    
    return {
      success: true,
      messages: chatFeed.messages
    };
  } catch (error) {
    console.error('Error getting friend chat messages:', error);
    return {
      success: false,
      error: error.message || 'Failed to get chat messages'
    };
  }
}

// Simulate receiving a friend request for testing
function simulateIncomingFriendRequest(fromDid) {
  try {
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Create a request object
    const request = {
      id: requestId,
      from: fromDid,
      to: currentUser.did,
      timestamp: timestamp,
      status: 'pending'
    };
    
    // Sign the request with our private key (simulated)
    request.signature = crypto.createHash('sha256').update(JSON.stringify(request) + fromDid).digest('hex');
    
    // Handle the incoming request
    handleIncomingFriendRequest(request);
    
    return {
      success: true,
      request
    };
  } catch (error) {
    console.error('Error simulating friend request:', error);
    return {
      success: false,
      error: error.message || 'Failed to simulate friend request'
    };
  }
}

// Create a video call room with a friend
async function createFriendVideoCallRoom(friendDid) {
  try {
    console.log(`Creating video call room with friend ${friendDid}`);
    
    if (!currentUser || !currentUser.did) {
      throw new Error('You must be logged in to start a video call');
    }
    
    // Check if the user is our friend
    if (!friends.has(friendDid)) {
      throw new Error('This user is not in your friends list');
    }
    
    const friend = friends.get(friendDid);
    
    // Generate a room ID from the shared secret
    const roomId = generateRoomIdFromSharedSecret(friend.sharedSecret);
    
    return {
      success: true,
      roomId
    };
  } catch (error) {
    console.error('Error creating friend video call room:', error);
    return {
      success: false,
      error: error.message || 'Failed to create video call room'
    };
  }
}