const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Hyperswarm = require('hyperswarm');
const b4a = require('b4a');
const Hypercore = require('hypercore');
const crypto = require('crypto');
const fs = require('fs');
const { OpenAI } = require('openai');

// OpenAI API key for Whisper
const OPENAI_API_KEY = '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';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Ensure storage directory exists
if (!fs.existsSync('./storage')) {
  fs.mkdirSync('./storage', { recursive: true });
}

// Temporary directory for audio files
if (!fs.existsSync('./temp')) {
  fs.mkdirSync('./temp', { recursive: true });
}

// Keep a global reference of the window object
let mainWindow;

// Default topic for our chat - will be replaced by user's room choice
let TOPIC = null;

// Keep track of active swarm and connections
let activeSwarm = null;
let activeConnections = new Map();
let username = '';

// Threshold for transcribing audio (minimum volume level required)
let MIN_AUDIO_LEVEL = 0.05; // Default value, will be adjustable from UI
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

// Set up IPC handlers
function setupIpcHandlers() {
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
        leaveCurrentRoom();
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

      // Send the signal data
      const signalData = {
        type: 'rtc-signal',
        from: username,
        signal: serializedSignal,
        timestamp: Date.now()
      };

      connection.write(JSON.stringify(signalData));
      return { success: true };
    } catch (error) {
      console.error('Error sending signal:', error);
      return {
        success: false,
        error: error.message || 'Failed to send signal'
      };
    }
  });

  // Handle media permission requests
  ipcMain.handle('get-media-stream', async (event, config) => {
    // This just proxies the request to the renderer
    // (actual getUserMedia happens in renderer for Electron)
    return { success: true };
  });

  // Handle audio transcription requests
  ipcMain.handle('transcribe-audio', async (event, audioBuffer, speaker) => {
    try {
      console.log(`Received transcription request from ${speaker}, buffer type: ${typeof audioBuffer}`);
      
      // Debug audio buffer properties
      if (audioBuffer) {
        console.log(`Audio buffer properties: isArray=${Array.isArray(audioBuffer)}, isUint8Array=${audioBuffer instanceof Uint8Array}, isBuffer=${Buffer.isBuffer(audioBuffer)}, hasLength=${audioBuffer.length !== undefined}, hasSize=${audioBuffer.size !== undefined}, byteLength=${audioBuffer.byteLength || 'undefined'}`);
      } else {
        console.error(`Received null or undefined audio buffer from ${speaker}`);
        return { success: false, error: 'No audio buffer provided' };
      }
      
      // Make sure audioBuffer is a buffer or convert it if needed
      let buffer;
      
      if (Buffer.isBuffer(audioBuffer)) {
        buffer = audioBuffer;
      } else if (audioBuffer instanceof Uint8Array) {
        buffer = Buffer.from(audioBuffer);
      } else if (Array.isArray(audioBuffer)) {
        buffer = Buffer.from(audioBuffer);
      } else if (audioBuffer.buffer && audioBuffer.buffer instanceof ArrayBuffer) {
        // Handle case where we have a typed array view
        buffer = Buffer.from(audioBuffer.buffer);
      } else {
        console.error(`Unsupported audio buffer type from ${speaker}: ${typeof audioBuffer}`);
        return { success: false, error: 'Unsupported audio buffer format' };
      }
      
      // Skip transcribing if the buffer is too small
      if (buffer.length < 1000) { // Very short audio is likely just noise
        console.log(`Audio buffer too small from ${speaker}: ${buffer.length} bytes`);
        return { success: false, error: 'Audio too short to transcribe' };
      }
      
      console.log(`Processing audio from ${speaker} - buffer size: ${buffer.length} bytes`);
      
      // Generate random filename with timestamp for the WAV file
      const timestamp = Date.now();
      const filename = `./temp/audio_${timestamp}_${Math.floor(Math.random() * 1000)}.wav`;
      
      // Ensure temp directory exists
      if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp', { recursive: true });
      }
      
      // Save audio buffer to a temporary file
      fs.writeFileSync(filename, buffer);
      
      // Call OpenAI Whisper API
      try {
        console.log(`Calling Whisper API with audio file: ${filename}`);
        const transcription = await transcribeWithWhisper(filename);
        console.log(`Whisper API returned transcription for ${speaker}: "${transcription}"`);
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(filename);
        } catch (cleanupError) {
          console.error(`Error cleaning up temporary file ${filename}:`, cleanupError);
        }
        
        // If transcription is empty or too short, skip
        if (!transcription || transcription.trim().length < 2) {
          console.log(`Empty or short transcription from ${speaker}: "${transcription}"`);
          return { 
            success: true,
            transcription: ''
          };
        }
        
        console.log(`Valid transcription from ${speaker}: "${transcription}"`);
        
        // Send transcription result to renderer
        const result = {
          speaker,
          text: transcription,
          timestamp: Date.now()
        };
        
        mainWindow.webContents.send('transcription-result', result);
        
        return { 
          success: true,
          transcription
        };
      } catch (whisperError) {
        console.error(`Error in Whisper API call for ${speaker}:`, whisperError);
        return {
          success: false,
          error: `Whisper API error: ${whisperError.message}`
        };
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return {
        success: false,
        error: error.message || 'Failed to transcribe audio'
      };
    }
  });

  // Add a handler for generating a summary
  ipcMain.handle('generate-call-summary', async (event, transcriptData) => {
    try {
      if (!openai) {
        throw new Error('OpenAI API key not set. Cannot generate summary.');
      }
      
      if (!transcriptData || !transcriptData.length) {
        return { success: false, message: 'No transcript data available for summary' };
      }
      
      console.log(`Generating call summary with GPT-4o from ${transcriptData.length} entries...`);
      
      // Format the transcript data for GPT-4o - organize by username and make it like a conversation
      const formattedTranscript = transcriptData.map(item => 
        `${item.username}: ${item.text}`
      ).join('\n');
      
      // Log the formatted transcript for debugging
      console.log('Formatted transcript for summary:');
      console.log(formattedTranscript.substring(0, 500) + (formattedTranscript.length > 500 ? '...' : ''));
      
      // Generate a summary with GPT-4o
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates concise summaries of conversation transcripts. Identify key points, action items, decisions made, and important topics discussed. Format the summary with clear sections and bullet points. Make sure to attribute quotes and decisions to the correct participants."
          },
          {
            role: "user", 
            content: `Please summarize the following call transcript, showing who participated and what they talked about:\n\n${formattedTranscript}`
          }
        ],
        max_tokens: 1500
      });
      
      const summary = completion.choices[0].message.content;
      console.log('Summary generated successfully');
      
      return { 
        success: true, 
        summary 
      };
    } catch (error) {
      console.error('Error generating summary with GPT-4o:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate summary'
      };
    }
  });

  // Handle audio threshold updates
  ipcMain.handle('update-audio-threshold', (event, threshold) => {
    console.log(`Updating audio threshold to ${threshold}`);
    MIN_AUDIO_LEVEL = threshold;
    return { success: true };
  });
}

// Transcribe audio using OpenAI Whisper
async function transcribeWithWhisper(audioFilePath) {
  try {
    console.log(`Sending audio file to OpenAI Whisper: ${audioFilePath}`);
    
    // Read the audio file
    const audioFile = fs.createReadStream(audioFilePath);
    
    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
      response_format: "text"
    });
    
    // Filter out empty or very short transcriptions
    const text = transcription.trim();
    if (!text || text.length < 3) {
      console.log('Transcription ignored (too short):', text);
      return '';  // Return empty string to indicate no useful transcription
    }
    
    console.log('Transcription received:', text);
    return text;
  } catch (error) {
    console.error('Error transcribing with Whisper:', error);
    throw error;
  }
}

// Join a specific room
async function joinRoom(roomId) {
  try {
    // Create a topic from the room ID
    TOPIC = b4a.from(
      crypto.createHash('sha256')
        .update(`hypercore-p2p-chat-room-${roomId}`)
        .digest()
    );
    
    console.log(`Created topic for room ${roomId}: ${TOPIC.toString('hex')}`);
    
    // Create a new swarm
    activeSwarm = new Hyperswarm();
    
    // Create a hypercore to store chat messages for this room
    const core = new Hypercore(`./storage/chat-log-${roomId}`);
    
    // Join the swarm with this topic
    activeSwarm.join(TOPIC);
    console.log(`Joined swarm with topic: ${TOPIC.toString('hex')}`);
    
    // Listen for new connections
    activeSwarm.on('connection', handleConnection);
    
    return { success: true };
  } catch (error) {
    console.error('Error joining room:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error joining room'
    };
  }
}

// Leave the current room
async function leaveRoom() {
  if (!activeSwarm) return;
  
  try {
    console.log('Leaving current room');
    
    // Disconnect from all peers
    for (const [peerId, conn] of activeConnections.entries()) {
      console.log(`Closing connection to peer: ${peerId}`);
      conn.end();
    }
    
    // Clear connections
    activeConnections.clear();
    
    // Leave the topic
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

// Handle new connections
function handleConnection(conn) {
  try {
    // Keep track of connections
    const remotePublicKey = b4a.toString(conn.remotePublicKey, 'hex');
    activeConnections.set(remotePublicKey, conn);
    console.log(`New connection from: ${remotePublicKey}`);
    
    // Notify user of new peer
    if (mainWindow) {
      mainWindow.webContents.send('peer-connected', { id: remotePublicKey });
    }
    
    // Handle incoming data
    conn.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`Received message: ${JSON.stringify(message)}`);
        
        // Handle different message types
        if (message.type === 'chat-message') {
          mainWindow.webContents.send('new-message', message);
        } 
        else if (message.type === 'rtc-signal') {
          // Forward WebRTC signals to the renderer
          if (mainWindow) {
            mainWindow.webContents.send('signal-received', {
              peerId: remotePublicKey,
              from: message.from,
              signal: message.signal
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });
    
    // Handle disconnection
    conn.on('close', () => {
      console.log(`Connection closed: ${remotePublicKey}`);
      activeConnections.delete(remotePublicKey);
      
      if (mainWindow) {
        mainWindow.webContents.send('peer-disconnected', { id: remotePublicKey });
      }
    });
    
    // Send welcome message
    if (username) {
      const helloMsg = {
        type: 'chat-message',
        username,
        message: `Hello! I just connected.`,
        timestamp: Date.now()
      };
      conn.write(JSON.stringify(helloMsg));
    }
  } catch (error) {
    console.error('Error handling connection:', error);
  }
}