// Main App Script - Handles the main application functionality

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// Chat page elements
const chatList = document.getElementById('chat-list');
const chatMessages = document.getElementById('chat-messages');
const chatMessageInput = document.getElementById('chat-message-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const addChatBtn = document.getElementById('add-chat-btn');
const addChatModal = document.getElementById('add-chat-modal');
const closeAddChatModal = document.getElementById('close-add-chat-modal');
const newChatUserIdInput = document.getElementById('new-chat-user-id');
const startChatBtn = document.getElementById('start-chat-btn');

// Social page elements
const socialFeed = document.getElementById('social-feed');
const newPostBtn = document.getElementById('new-post-btn');
const newPostModal = document.getElementById('new-post-modal');
const closeNewPostModal = document.getElementById('close-new-post-modal');
const newPostContent = document.getElementById('new-post-content');
const createPostBtn = document.getElementById('create-post-btn');
const filterFeedBtn = document.getElementById('filter-feed-btn');

// Settings page elements
const profileDisplayName = document.getElementById('profile-display-name');
const changeProfilePictureBtn = document.getElementById('change-profile-picture-btn');
const profilePicturePreview = document.getElementById('profile-picture-preview');
const saveOpenAiKeyBtn = document.getElementById('save-openai-key-btn');
const openaiApiKey = document.getElementById('openai-api-key');

// App state
let currentPage = 'chats';
let currentChatId = null;
let chats = new Map(); // Map of chat ID to chat data
let posts = []; // Array of social posts

// Local storage keys
const CHATS_STORAGE_KEY = 'hapa_chats_data';
const OPENAI_KEY_STORAGE_KEY = 'hapa_openai_key';

// Initialize app
function initApp() {
  // Load chats from local storage
  loadChats();
  
  // Load OpenAI API key from local storage
  const savedApiKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
  if (savedApiKey) {
    openaiApiKey.value = savedApiKey;
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Fetch social feed (mock data for now)
  fetchSocialFeed();
}

// Set up event listeners
function setupEventListeners() {
  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      navigateToPage(pageId);
      
      // Special handling for video call page
      if (pageId === 'video-call') {
        // Make sure the video call login screen is visible
        const videoCallLoginScreen = document.getElementById('login-screen');
        const chatScreen = document.getElementById('chat-screen');
        
        if (videoCallLoginScreen && chatScreen) {
          videoCallLoginScreen.classList.remove('hidden');
          chatScreen.classList.add('hidden');
        }
      }
    });
  });
  
  // Chat functionality
  if (chatSendBtn && chatMessageInput) {
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatMessageInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }
  
  // Add chat modal
  if (addChatBtn && addChatModal) {
    addChatBtn.addEventListener('click', () => {
      addChatModal.classList.remove('hidden');
    });
    
    closeAddChatModal.addEventListener('click', () => {
      addChatModal.classList.add('hidden');
    });
    
    startChatBtn.addEventListener('click', startNewChat);
  }
  
  // Social post modal
  if (newPostBtn && newPostModal) {
    newPostBtn.addEventListener('click', () => {
      newPostModal.classList.remove('hidden');
    });
    
    closeNewPostModal.addEventListener('click', () => {
      newPostModal.classList.add('hidden');
    });
    
    createPostBtn.addEventListener('click', createNewPost);
  }
  
  // Profile settings
  if (profileDisplayName) {
    profileDisplayName.addEventListener('change', updateProfileDisplayName);
  }
  
  if (changeProfilePictureBtn) {
    changeProfilePictureBtn.addEventListener('click', changeProfilePicture);
  }
  
  // Save OpenAI key
  if (saveOpenAiKeyBtn) {
    saveOpenAiKeyBtn.addEventListener('click', saveOpenAiKey);
  }
}

// Navigate to a page
function navigateToPage(pageId) {
  // Update current page
  currentPage = pageId;
  
  // Update active nav item
  navItems.forEach(item => {
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Hide all pages and show the selected one
  pages.forEach(page => {
    if (page.id === `${pageId}-page`) {
      page.classList.remove('hidden');
    } else {
      page.classList.add('hidden');
    }
  });
}

// Chats functionality
function loadChats() {
  const storedChats = localStorage.getItem(CHATS_STORAGE_KEY);
  if (storedChats) {
    try {
      // Convert the stored JSON back to a Map
      const chatArray = JSON.parse(storedChats);
      chats = new Map(chatArray);
      
      // Render chat list
      renderChatList();
    } catch (error) {
      console.error('Error loading chats from storage:', error);
    }
  }
}

function saveChats() {
  // Convert Map to array for JSON serialization
  const chatArray = Array.from(chats.entries());
  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chatArray));
}

function renderChatList() {
  if (!chatList) return;
  
  chatList.innerHTML = '';
  
  if (chats.size === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No chats yet. Start a new chat!';
    chatList.appendChild(emptyMessage);
    return;
  }
  
  // Convert Map to array and sort by last message timestamp (newest first)
  const sortedChats = Array.from(chats.values())
    .sort((a, b) => {
      const aTimestamp = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : a.createdAt;
      const bTimestamp = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : b.createdAt;
      return bTimestamp - aTimestamp;
    });
  
  sortedChats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    if (chat.id === currentChatId) {
      chatItem.classList.add('active');
    }
    chatItem.setAttribute('data-chat-id', chat.id);
    
    const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
    
    chatItem.innerHTML = `
      <div class="chat-item-name">${chat.displayName}</div>
      <div class="chat-item-last-message">${lastMessage ? lastMessage.text : 'No messages yet'}</div>
    `;
    
    chatItem.addEventListener('click', () => {
      selectChat(chat.id);
    });
    
    chatList.appendChild(chatItem);
  });
}

function selectChat(chatId) {
  currentChatId = chatId;
  
  // Update UI
  document.querySelectorAll('.chat-item').forEach(item => {
    if (item.getAttribute('data-chat-id') === chatId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Render chat messages
  renderChatMessages(chatId);
}

function renderChatMessages(chatId) {
  if (!chatMessages) return;
  
  chatMessages.innerHTML = '';
  
  const chat = chats.get(chatId);
  if (!chat) return;
  
  if (chat.messages.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No messages yet. Say hello!';
    chatMessages.appendChild(emptyMessage);
    return;
  }
  
  chat.messages.forEach(message => {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.sender === currentUser.username ? 'outgoing' : 'incoming'}`;
    
    let senderName = message.sender;
    if (message.sender === currentUser.username) {
      senderName = 'You';
    }
    
    messageEl.innerHTML = `
      <div class="chat-message-sender">${senderName}</div>
      <div class="chat-message-text">${message.text}</div>
      <div class="chat-message-timestamp">${formatTimestamp(message.timestamp)}</div>
    `;
    
    chatMessages.appendChild(messageEl);
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage() {
  if (!currentChatId || !chatMessageInput) return;
  
  const messageText = chatMessageInput.value.trim();
  if (!messageText) return;
  
  // Clear input
  chatMessageInput.value = '';
  
  // Get chat
  const chat = chats.get(currentChatId);
  if (!chat) return;
  
  // Create message
  const message = {
    id: generateId(),
    sender: currentUser.username,
    text: messageText,
    timestamp: Date.now()
  };
  
  // Add to chat
  chat.messages.push(message);
  
  // Save chats
  saveChats();
  
  // Update UI
  renderChatMessages(currentChatId);
  renderChatList();
  
  // In a real app, we would send this message to the peer via Hypercore
  console.log(`Sending message to ${chat.userId}: ${messageText}`);
}

function startNewChat() {
  const userId = newChatUserIdInput.value.trim();
  if (!userId) {
    alert('Please enter a user ID');
    return;
  }
  
  // Create a new chat
  const chatId = generateId();
  const chat = {
    id: chatId,
    userId: userId,
    displayName: userId.startsWith('@') ? userId : `@${userId}`,
    createdAt: Date.now(),
    messages: []
  };
  
  // Add to chats
  chats.set(chatId, chat);
  
  // Save chats
  saveChats();
  
  // Close modal
  addChatModal.classList.add('hidden');
  newChatUserIdInput.value = '';
  
  // Select the new chat
  renderChatList();
  selectChat(chatId);
}

// Social feed functionality
function fetchSocialFeed() {
  // In a real app, we would fetch posts from the AT Protocol
  // For now, we'll just use mock data
  
  posts = [
    {
      id: 'post1',
      author: {
        userId: '@alice',
        displayName: 'Alice',
        avatar: 'https://randomuser.me/api/portraits/women/1.jpg'
      },
      content: 'Just got a new cat! 🐱 #cats #pets',
      timestamp: Date.now() - 3600000,
      likes: 5,
      comments: 2
    },
    {
      id: 'post2',
      author: {
        userId: '@bob',
        displayName: 'Bob',
        avatar: 'https://randomuser.me/api/portraits/men/1.jpg'
      },
      content: 'Check out this cute cat I saw today! #cats #cute',
      timestamp: Date.now() - 7200000,
      likes: 12,
      comments: 3
    },
    {
      id: 'post3',
      author: {
        userId: '@charlie',
        displayName: 'Charlie',
        avatar: 'https://randomuser.me/api/portraits/women/2.jpg'
      },
      content: 'Working on my new art project with my cat as inspiration',
      timestamp: Date.now() - 10800000,
      likes: 8,
      comments: 1
    }
  ];
  
  renderSocialFeed();
}

function renderSocialFeed() {
  if (!socialFeed) return;
  
  socialFeed.innerHTML = '';
  
  if (posts.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No posts to display. Create a new post!';
    socialFeed.appendChild(emptyMessage);
    return;
  }
  
  posts.forEach(post => {
    const postEl = document.createElement('div');
    postEl.className = 'social-post';
    postEl.setAttribute('data-post-id', post.id);
    
    postEl.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">
          <img src="${post.author.avatar}" alt="${post.author.displayName}">
        </div>
        <div class="post-user-info">
          <div class="post-username">${post.author.displayName}</div>
          <div class="post-user-id">${post.author.userId}</div>
        </div>
        <div class="post-timestamp">${formatTimestamp(post.timestamp)}</div>
      </div>
      <div class="post-content">${post.content}</div>
      <div class="post-actions">
        <div class="post-action like">
          <span class="action-icon">❤️</span>
          <span class="action-count">${post.likes}</span>
        </div>
        <div class="post-action comment">
          <span class="action-icon">💬</span>
          <span class="action-count">${post.comments}</span>
        </div>
      </div>
    `;
    
    socialFeed.appendChild(postEl);
  });
}

function createNewPost() {
  const content = newPostContent.value.trim();
  if (!content) {
    alert('Please enter post content');
    return;
  }
  
  // In a real app, we would send this to the AT Protocol
  console.log(`Creating new post: ${content}`);
  
  // For now, just add it to our local posts
  const post = {
    id: generateId(),
    author: {
      userId: `@${currentUser.username}`,
      displayName: currentUser.displayName || currentUser.username,
      avatar: currentUser.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg'
    },
    content: content,
    timestamp: Date.now(),
    likes: 0,
    comments: 0
  };
  
  posts.unshift(post);
  
  // Close modal
  newPostModal.classList.add('hidden');
  newPostContent.value = '';
  
  // Update UI
  renderSocialFeed();
}

// Settings functionality
function updateProfileDisplayName() {
  if (!profileDisplayName || !currentUser) return;
  
  const newName = profileDisplayName.value.trim();
  if (!newName) return;
  
  // Update user data
  currentUser.displayName = newName;
  
  // Save user data
  saveUserData();
  
  // Update UI
  userDisplayName.textContent = newName;
  
  console.log(`Updated display name to: ${newName}`);
}

function changeProfilePicture() {
  // In a real app, we would open a file picker
  alert('This feature is not yet implemented');
}

function saveOpenAiKey() {
  const apiKey = openaiApiKey.value.trim();
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }
  
  // Save API key
  localStorage.setItem(OPENAI_KEY_STORAGE_KEY, apiKey);
  
  alert('API key saved successfully');
}

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if the user is logged in
  if (currentUser) {
    initApp();
  }
}); 