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
let TRANSCRIPTION_MODEL = 'whisper-1'; // Default transcription model
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
      
      if (settings.transcriptionModel !== undefined) {
        TRANSCRIPTION_MODEL = settings.transcriptionModel;
        console.log(`Loaded transcription model from settings: ${TRANSCRIPTION_MODEL}`);
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
    settings.transcriptionModel = TRANSCRIPTION_MODEL;
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
  
  // Update transcription model
  ipcMain.handle('update-transcription-model', (event, model) => {
    try {
      TRANSCRIPTION_MODEL = model;
      console.log(`Updated transcription model to ${TRANSCRIPTION_MODEL}`);
      saveSettings();
      return { success: true };
    } catch (error) {
      console.error('Error updating transcription model:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update transcription model'
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
}

// Transcribe audio using OpenAI
async function transcribeAudio(filePath) {
  try {
    // Check if OpenAI client is initialized
    if (!openai) {
      throw new Error('OpenAI API key not set. Please configure in settings.');
    }
    
    console.log(`Using transcription model: ${TRANSCRIPTION_MODEL}`);
    
    let transcription;
    
    // Handle different model formats
    if (TRANSCRIPTION_MODEL === 'whisper-1') {
      // Use the whisper model API
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: TRANSCRIPTION_MODEL,
        language: "en",
      });
      
      console.log(`OpenAI Whisper transcription returned: "${transcription.text}"`);
      
      // Validation for whisper model result
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
    } else if (TRANSCRIPTION_MODEL === 'gpt-4o-mini-transcribe' || TRANSCRIPTION_MODEL === 'gpt-4o-transcribe') {
      // Use the gpt-4o transcription API format - FIXED to use audio.transcriptions.create instead of audio.speech.transcriptions.create
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: TRANSCRIPTION_MODEL,
        language: "en",
        response_format: "json" // Required for gpt-4o models
      });
      
      console.log(`OpenAI GPT-4o transcription returned:`, transcription);
      
      // Extract text from GPT-4o transcription result
      const transcribedText = transcription.text || '';
      
      // Validation
      if (!transcribedText || transcribedText.trim() === '') {
        console.log(`GPT-4o transcription ignored (too short): ${transcribedText}`);
        return '';
      }
      
      if (transcribedText.length < 2) {
        console.log(`Empty or short GPT-4o transcription: "${transcribedText}"`);
        return '';
      }
      
      console.log(`Valid GPT-4o transcription: "${transcribedText}"`);
      return transcribedText;
    } else {
      // Default to whisper-1 if model is not recognized
      console.warn(`Unrecognized transcription model: ${TRANSCRIPTION_MODEL}, falling back to whisper-1`);
      
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        language: "en",
      });
      
      return transcription.text || '';
    }
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