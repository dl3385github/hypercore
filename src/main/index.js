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
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Load the index.html
    const startUrl = path.join(`file://${__dirname}/../renderer/index.html`);
    console.log(`Loading HTML from: ${startUrl}`);
    
    mainWindow.loadURL(startUrl)
      .then(() => console.log('Window loaded successfully'))
      .catch(err => console.error('Error loading window:', err));
    
    // Open DevTools
    // mainWindow.webContents.openDevTools();
    
    // Set up handlers before closing
    mainWindow.on('close', async (e) => {
      try {
        console.log('Window is closing, saving transcripts and generating summary...');
        
        // Notify renderer to save transcripts and generate summary
        // We need to prevent window from closing until this is done
        e.preventDefault();
        
        // Tell renderer to save transcripts
        mainWindow.webContents.send('save-transcripts');
        
        // Wait for renderer to signal it's done
        const result = await new Promise((resolve) => {
          ipcMain.once('save-transcripts-done', (event, result) => resolve(result));
          
          // Set a timeout in case the renderer doesn't respond
          setTimeout(() => resolve({ success: false, error: 'Timed out waiting for transcripts to save' }), 10000);
        });
        
        if (result && !result.success) {
          console.error('Error saving transcripts:', result.error);
        }
        
        // Now actually close the window
        mainWindow.destroy();
      } catch (error) {
        console.error('Error during window close:', error);
        // Force close if there was an error
        mainWindow.destroy();
      }
    });
    
    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
      console.log('Window has been closed');
      mainWindow = null;
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
  // Clean up swarm connections
  await leaveRoom();
});

// Set up IPC handlers
function setupIpcHandlers() {
  // Handle username setting
  ipcMain.handle('set-username', (event, name) => {
    username = name;
    console.log(`Username set to: ${username}`);
    return true;
  });
  
  // Handle room joining
  ipcMain.handle('join-room', async (event, roomId) => {
    try {
      console.log(`Joining room: ${roomId}`);
      
      // Leave current room if any
      await leaveRoom();
      
      // Join the new room
      return await joinRoom(roomId);
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
      console.log(`Transcribing audio from ${speaker}, size: ${audioBuffer?.length} bytes`);
      
      // Create temp directory if it doesn't exist
      if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp', { recursive: true });
      }
      
      // Save audio buffer to a temporary file
      const tempFilePath = path.join('./temp', `recording_${Date.now()}.webm`);
      fs.writeFileSync(tempFilePath, Buffer.from(audioBuffer));
      
      console.log(`Sending audio file to OpenAI: ${tempFilePath}`);
      
      // Call OpenAI Whisper API
      const transcription = await transcribeWithWhisper(tempFilePath);
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      
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
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return {
        success: false,
        error: error.message || 'Failed to transcribe audio'
      };
    }
  });

  // Handle saving files
  ipcMain.handle('save-file', async (event, filename, content) => {
    try {
      // Create output directory if it doesn't exist
      const outputDir = path.join('.', 'transcripts');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, content);
      
      return { 
        success: true,
        filePath
      };
    } catch (error) {
      console.error('Error saving file:', error);
      return {
        success: false,
        error: error.message || 'Failed to save file'
      };
    }
  });

  // Handle conversation summarization with OpenAI
  ipcMain.handle('summarize-conversation', async (event, transcript) => {
    try {
      if (!openai) {
        throw new Error('OpenAI API key not set. Cannot generate summary.');
      }
      
      console.log('Sending conversation to OpenAI for summarization');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates concise summaries of conversations. Identify the main topics discussed, key points made by each participant, and any decisions or action items agreed upon."
          },
          {
            role: "user",
            content: `Please summarize this conversation transcript:\n\n${transcript}`
          }
        ],
        max_tokens: 1000
      });
      
      const summary = response.choices[0].message.content;
      console.log('Summary generated successfully');
      
      return { 
        success: true,
        summary
      };
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      return {
        success: false,
        error: error.message || 'Failed to summarize conversation'
      };
    }
  });

  // Signal that transcript saving is complete
  ipcMain.handle('save-transcripts-done', async (event, result) => {
    console.log('Transcript saving complete:', result);
    return result;
  });
}

// Transcribe audio using OpenAI Whisper
async function transcribeWithWhisper(audioFilePath) {
  try {
    if (!openai) {
      throw new Error('OpenAI API key not set. Cannot transcribe audio.');
    }
    
    console.log(`Sending audio file to OpenAI: ${audioFilePath}`);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-1",
      language: "en",
    });
    
    console.log('Transcription received:', transcription.text);
    return transcription.text;
  } catch (error) {
    console.error('Error using Whisper API:', error);
    throw new Error(`Whisper API error: ${error.message}`);
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