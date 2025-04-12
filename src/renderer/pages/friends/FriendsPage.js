// Friends Page Functionality

// State variables
let activeFriendDid = null;
let friendsList = [];
let pendingFriendRequests = [];
let activeRequestId = null;

// Initialize friends page
function initializeFriendsPage() {
  console.log('Initializing friends page...');
  
  // DOM Elements
  const addFriendBtn = document.getElementById('add-friend-btn');
  const closeAddFriendModal = document.getElementById('close-add-friend-modal');
  const addFriendModal = document.getElementById('add-friend-modal');
  const friendDIDInput = document.getElementById('friend-did-input');
  const sendFriendRequestBtn = document.getElementById('send-friend-request-btn');
  const friendsListEl = document.getElementById('friends-list');
  const friendRequestModal = document.getElementById('friend-request-modal');
  const closeRequestModal = document.getElementById('close-friend-request-modal');
  const acceptRequestBtn = document.getElementById('accept-request-btn');
  const rejectRequestBtn = document.getElementById('reject-request-btn');
  const startVideoCallBtn = document.getElementById('start-video-call');
  const friendMessageInput = document.getElementById('friend-message-input');
  const friendSendBtn = document.getElementById('friend-send-btn');
  const searchFriendsInput = document.getElementById('search-friends');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const myQRModal = document.getElementById('my-qr-modal');
  const closeMyQRModal = document.getElementById('close-my-qr-modal');
  const copyDIDBtn = document.getElementById('copy-did-btn');
  
  // Tab switching in the add friend modal
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update active button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show selected tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Event listeners
  addFriendBtn.addEventListener('click', () => {
    addFriendModal.classList.remove('hidden');
    
    // Display the user's own DID in the QR code tab
    if (window.currentUser && window.currentUser.did) {
      // In a real implementation, you would generate and display a QR code here
      console.log('Would display QR code for DID:', window.currentUser.did);
    }
  });
  
  closeAddFriendModal.addEventListener('click', () => {
    addFriendModal.classList.add('hidden');
    friendDIDInput.value = '';
  });
  
  closeRequestModal.addEventListener('click', () => {
    friendRequestModal.classList.add('hidden');
  });
  
  sendFriendRequestBtn.addEventListener('click', async () => {
    const targetDid = friendDIDInput.value.trim();
    if (!targetDid) {
      alert('Please enter a valid DID');
      return;
    }
    
    try {
      const result = await window.electronAPI.createFriendRequest(targetDid);
      if (result.success) {
        alert('Friend request sent successfully!');
        addFriendModal.classList.add('hidden');
        friendDIDInput.value = '';
      } else {
        alert(`Failed to send friend request: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert(`Error: ${error.message}`);
    }
  });
  
  acceptRequestBtn.addEventListener('click', async () => {
    if (!activeRequestId) {
      alert('No request selected');
      return;
    }
    
    try {
      const result = await window.electronAPI.acceptFriendRequest(activeRequestId);
      if (result.success) {
        alert('Friend request accepted!');
        friendRequestModal.classList.add('hidden');
        loadFriendsList();
      } else {
        alert(`Failed to accept friend request: ${result.error}`);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert(`Error: ${error.message}`);
    }
  });
  
  rejectRequestBtn.addEventListener('click', () => {
    // In a real implementation, you would reject the request
    alert('Friend request rejected');
    friendRequestModal.classList.add('hidden');
  });
  
  startVideoCallBtn.addEventListener('click', async () => {
    if (!activeFriendDid) {
      alert('No friend selected');
      return;
    }
    
    try {
      const result = await window.electronAPI.createFriendVideoCall(activeFriendDid);
      if (result.success) {
        // Switch to video call page
        const videoCallPage = document.getElementById('video-call-page');
        const chatsPage = document.getElementById('chats-page');
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.nav-btn[data-page="video-call"]').classList.add('active');
        
        // Switch pages
        document.querySelectorAll('.app-page').forEach(page => page.classList.remove('active'));
        videoCallPage.classList.add('active');
        
        // Set room ID and username in the form
        document.getElementById('room-input').value = result.roomId;
        
        // Trigger the join button
        document.getElementById('join-btn').click();
      } else {
        alert(`Failed to start video call: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting video call:', error);
      alert(`Error: ${error.message}`);
    }
  });
  
  friendMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFriendMessage();
    }
  });
  
  friendSendBtn.addEventListener('click', sendFriendMessage);
  
  searchFriendsInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterFriendsList(searchTerm);
  });
  
  // Load initial data
  loadFriendsList();
  
  // Listen for incoming friend requests
  window.electronAPI.onFriendRequestReceived((request) => {
    console.log('Friend request received:', request);
    
    // Display the request modal
    document.getElementById('request-did').textContent = `DID: ${request.from}`;
    activeRequestId = request.id;
    friendRequestModal.classList.remove('hidden');
  });
  
  // Listen for new friend messages
  window.electronAPI.onNewFriendMessage((data) => {
    console.log('New friend message received:', data);
    
    // If this is from the currently active friend, add it to the UI
    if (data.friendDid === activeFriendDid) {
      addFriendMessageToUI(data.message);
    }
  });
}

// Load the friends list
async function loadFriendsList() {
  try {
    const result = await window.electronAPI.getFriends();
    if (result.success) {
      friendsList = result.friends;
      renderFriendsList();
    } else {
      console.error('Failed to load friends list:', result.error);
    }
  } catch (error) {
    console.error('Error loading friends list:', error);
  }
}

// Render the friends list in the UI
function renderFriendsList() {
  const friendsListContainer = document.getElementById('friends-list');
  
  // Clear current list
  while (friendsListContainer.firstChild) {
    friendsListContainer.removeChild(friendsListContainer.firstChild);
  }
  
  if (friendsList.length === 0) {
    // Show "no friends" message
    const noFriendsMessage = document.createElement('div');
    noFriendsMessage.className = 'no-friends-message';
    noFriendsMessage.textContent = 'No friends added yet';
    friendsListContainer.appendChild(noFriendsMessage);
    return;
  }
  
  // Sort by most recently added
  const sortedFriends = [...friendsList].sort((a, b) => b.addedAt - a.addedAt);
  
  // Render each friend
  sortedFriends.forEach(friend => {
    const friendItem = createFriendElement(friend);
    friendsListContainer.appendChild(friendItem);
  });
}

// Create a friend list item
function createFriendElement(friend) {
  const friendItem = document.createElement('div');
  friendItem.className = 'friend-item';
  friendItem.dataset.did = friend.did;
  
  // Truncate DID for display
  const shortDid = `${friend.did.substring(0, 12)}...${friend.did.substring(friend.did.length - 6)}`;
  
  friendItem.innerHTML = `
    <div class="friend-avatar">👤</div>
    <div class="friend-info">
      <div class="friend-name">${friend.name || 'Friend'}</div>
      <div class="friend-did">${shortDid}</div>
    </div>
    <div class="friend-status ${friend.online ? 'online' : 'offline'}"></div>
  `;
  
  // Add click handler to open chat
  friendItem.addEventListener('click', () => {
    openFriendChat(friend.did);
    
    // Update active state
    document.querySelectorAll('.friend-item').forEach(item => {
      item.classList.remove('active');
    });
    friendItem.classList.add('active');
  });
  
  return friendItem;
}

// Filter the friends list by search term
function filterFriendsList(searchTerm) {
  const friendItems = document.querySelectorAll('.friend-item');
  
  friendItems.forEach(item => {
    const friendName = item.querySelector('.friend-name').textContent.toLowerCase();
    const friendDid = item.querySelector('.friend-did').textContent.toLowerCase();
    
    if (friendName.includes(searchTerm) || friendDid.includes(searchTerm)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// Open chat with a friend
async function openFriendChat(friendDid) {
  try {
    console.log(`Opening chat with friend: ${friendDid}`);
    
    // Set as active friend
    activeFriendDid = friendDid;
    
    // Show chat view, hide empty state
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('friend-chat').classList.remove('hidden');
    
    // Set friend info in the header
    const friendData = friendsList.find(f => f.did === friendDid);
    const shortDid = `${friendDid.substring(0, 12)}...${friendDid.substring(friendDid.length - 6)}`;
    
    document.getElementById('chat-friend-name').textContent = friendData?.name || 'Friend';
    document.getElementById('chat-friend-did').textContent = shortDid;
    
    // Load chat messages
    const messagesResult = await window.electronAPI.getFriendChatMessages(friendDid);
    if (messagesResult.success) {
      renderFriendChatMessages(messagesResult.messages);
    } else {
      console.error('Failed to load chat messages:', messagesResult.error);
    }
    
    // Focus message input
    document.getElementById('friend-message-input').focus();
  } catch (error) {
    console.error('Error opening friend chat:', error);
  }
}

// Render chat messages
function renderFriendChatMessages(messages) {
  const messagesContainer = document.getElementById('friend-messages');
  
  // Clear current messages
  messagesContainer.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-chat-message';
    emptyMessage.textContent = 'No messages yet. Say hello!';
    messagesContainer.appendChild(emptyMessage);
    return;
  }
  
  // Sort by timestamp
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  
  // Group messages by date
  let currentDate = null;
  
  sortedMessages.forEach(message => {
    const messageDate = new Date(message.timestamp).toLocaleDateString();
    
    // Add date separator if needed
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      const dateSeparator = document.createElement('div');
      dateSeparator.className = 'date-separator';
      dateSeparator.textContent = messageDate;
      messagesContainer.appendChild(dateSeparator);
    }
    
    // Add message to UI
    addFriendMessageToUI(message, false);
  });
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add a message to the UI
function addFriendMessageToUI(message, shouldScroll = true) {
  const messagesContainer = document.getElementById('friend-messages');
  
  const messageElement = document.createElement('div');
  messageElement.className = `friend-message ${message.sender === window.currentUser?.did ? 'sent' : 'received'}`;
  messageElement.dataset.id = message.id;
  
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageElement.innerHTML = `
    <div class="message-content">${message.text}</div>
    <div class="message-meta">
      <span class="message-time">${time}</span>
      ${message.sender === window.currentUser?.did ? `<span class="message-status">${message.status || 'sent'}</span>` : ''}
    </div>
  `;
  
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom if requested
  if (shouldScroll) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Send a message to the active friend
async function sendFriendMessage() {
  try {
    const messageInput = document.getElementById('friend-message-input');
    const text = messageInput.value.trim();
    
    if (!text || !activeFriendDid) return;
    
    // Clear input
    messageInput.value = '';
    
    // Send message
    const result = await window.electronAPI.sendFriendMessage(activeFriendDid, text);
    
    if (result.success) {
      // Message will be added to UI via the onNewFriendMessage listener
    } else {
      console.error('Failed to send message:', result.error);
      alert(`Failed to send message: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert(`Error: ${error.message}`);
  }
}

// Make function available globally instead of using ES modules
window.FriendsPage = {
  initializeFriendsPage: initializeFriendsPage
};