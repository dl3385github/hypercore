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
  }
});

console.log('Preload script completed initialization'); 