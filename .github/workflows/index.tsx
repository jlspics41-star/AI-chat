/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Chat } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY,
});

const USERS_KEY = 'users';
const CURRENT_USER_SESSION_KEY = 'currentUserSession';
const THEME_KEY = 'themePreference';

// --- Interfaces ---
interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  // For rendering purposes, not part of the API history
  meta?: {
    avatar: string;
    username: string;
  };
}

interface ChatSession {
  id: number;
  startTime: string;
  title: string;
  history: Message[];
}

interface UserProfile {
  username: string;
  avatar: string;
  password?: string; // Stored in plain text for this example. NOT FOR PRODUCTION.
  chatHistory: ChatSession[];
}

// --- Constants ---
const AVATARS = ['🧑', '👩', '🤖', '🐶', '🐱'];
const DEFAULT_AVATAR = '👤';
const GUEST_PROFILE: UserProfile = {
  username: 'You',
  avatar: DEFAULT_AVATAR,
  chatHistory: [],
};
const MODEL_PROFILE = {
  username: 'Model',
  avatar: '🤖',
};

// --- Main Chat Elements ---
const headerEl = document.getElementById('header');
const chatContainerEl = document.getElementById('chat-container');
const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('chat-input') as HTMLInputElement;
const sendButtonEl = document.getElementById(
  'send-button',
) as HTMLButtonElement;
const newChatButtonEl = document.getElementById(
  'new-chat-button',
) as HTMLButtonElement;
const micButtonEl = document.getElementById('mic-button') as HTMLButtonElement;
const themeSwitcherEl = document.getElementById('theme-switcher');

// --- Auth Elements ---
const authButtonsEl = document.getElementById('auth-buttons');
const userLoginButtonEl = document.getElementById('user-login-button');
const userSignupButtonEl = document.getElementById('user-signup-button');
const userDisplayEl = document.getElementById('user-display');
const userDisplayAvatarEl = document.getElementById('user-display-avatar');
const userDisplayUsernameEl = document.getElementById('user-display-username');
const logoutButtonEl = document.getElementById('logout-button');

// --- History Page Elements ---
const historyButtonEl = document.getElementById('history-button');
const historyPageEl = document.getElementById('history-page');
const backToChatButtonEl = document.getElementById('back-to-chat-button');
const historyListViewEl = document.getElementById('history-list-view');
const historySearchInputEl = document.getElementById(
  'history-search-input',
) as HTMLInputElement;
const chatHistoryListEl = document.getElementById('chat-history-list');
const historyDetailViewEl = document.getElementById('history-detail-view');
const backToHistoryListButtonEl = document.getElementById(
  'back-to-history-list-button',
);
const loadChatButtonEl = document.getElementById(
  'load-chat-button',
) as HTMLButtonElement;
const historyMessagesDisplayEl = document.getElementById(
  'history-messages-display',
);

// --- User Login Modal ---
const userLoginModalEl = document.getElementById('user-login-modal');
const closeUserLoginModalButtonEl =
  userLoginModalEl?.querySelector('.close-button');
const userLoginFormEl = document.getElementById(
  'user-login-form',
) as HTMLFormElement;
const userLoginUsernameEl = document.getElementById(
  'user-login-username',
) as HTMLInputElement;
const userLoginPasswordEl = document.getElementById(
  'user-login-password',
) as HTMLInputElement;
const userLoginErrorEl = document.getElementById('user-login-error');

// --- Profile Modal (Sign Up) Elements ---
const profileModalEl = document.getElementById('profile-modal');
const closeProfileModalButtonEl =
  profileModalEl?.querySelector('.close-button');
const profileFormEl = document.getElementById(
  'profile-form',
) as HTMLFormElement;
const usernameInputEl = document.getElementById(
  'username-input',
) as HTMLInputElement;
const profilePasswordInputEl = document.getElementById(
  'profile-password-input',
) as HTMLInputElement;
const avatarSelectionEl = document.getElementById('avatar-selection');
const signupErrorEl = document.getElementById('signup-error');

async function main() {
  const allElements = [
    headerEl,
    chatContainerEl,
    messagesEl,
    formEl,
    inputEl,
    sendButtonEl,
    newChatButtonEl,
    micButtonEl,
    themeSwitcherEl,
    authButtonsEl,
    userLoginButtonEl,
    userSignupButtonEl,
    userDisplayEl,
    userDisplayAvatarEl,
    userDisplayUsernameEl,
    logoutButtonEl,
    historyButtonEl,
    historyPageEl,
    backToChatButtonEl,
    historyListViewEl,
    historySearchInputEl,
    chatHistoryListEl,
    historyDetailViewEl,
    backToHistoryListButtonEl,
    loadChatButtonEl,
    historyMessagesDisplayEl,
    userLoginModalEl,
    closeUserLoginModalButtonEl,
    userLoginFormEl,
    userLoginUsernameEl,
    userLoginPasswordEl,
    userLoginErrorEl,
    profileModalEl,
    closeProfileModalButtonEl,
    profileFormEl,
    usernameInputEl,
    profilePasswordInputEl,
    avatarSelectionEl,
    signupErrorEl,
  ];

  if (allElements.some((el) => !el)) {
    console.error('One or more required elements were not found in the DOM.');
    return;
  }

  let chat: Chat;
  let currentUser: UserProfile | null = null;
  let currentMessages: Message[] = [];
  let currentLoadedSessionId: number | null = null;

  function initializeChat(history: Message[] = []) {
    // We only need the role and parts for the API history.
    const apiHistory = history.map(({ role, parts }) => ({ role, parts }));
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: apiHistory,
    });
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // --- Theme Functions ---
  function applyTheme(theme: 'light' | 'dark') {
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const sunIcon = themeSwitcherEl.querySelector('.icon-sun');
    const moonIcon = themeSwitcherEl.querySelector('.icon-moon');
    if (theme === 'dark') {
      sunIcon?.classList.add('hidden');
      moonIcon?.classList.remove('hidden');
    } else {
      sunIcon?.classList.remove('hidden');
      moonIcon?.classList.add('hidden');
    }
  }

  function toggleTheme() {
    const currentTheme = document.body.dataset.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) as
      | 'light'
      | 'dark'
      | null;
    applyTheme(savedTheme || 'light'); // Default to light
  }

  // --- User Profile & Auth Functions ---
  function getUsers(): UserProfile[] {
    const storedUsers = localStorage.getItem(USERS_KEY);
    return storedUsers ? JSON.parse(storedUsers) : [];
  }

  function saveUsers(users: UserProfile[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getCurrentUserProfile(): UserProfile {
    return currentUser || GUEST_PROFILE;
  }

  function updateUIForLogin(user: UserProfile) {
    currentUser = user;
    authButtonsEl.classList.add('hidden');
    userDisplayEl.classList.remove('hidden');
    userDisplayAvatarEl.textContent = user.avatar;
    userDisplayUsernameEl.textContent = user.username;
  }

  function updateUIForLogout() {
    currentUser = null;
    authButtonsEl.classList.remove('hidden');
    userDisplayEl.classList.add('hidden');
    // Clear user chat and start a fresh guest session
    currentMessages = [];
    currentLoadedSessionId = null;
    messagesEl.innerHTML = '';
    initializeChat();
  }

  function checkCurrentUserSession() {
    const sessionUser = sessionStorage.getItem(CURRENT_USER_SESSION_KEY);
    if (sessionUser) {
      const users = getUsers();
      const userProfile = users.find((u) => u.username === sessionUser);
      if (userProfile) {
        updateUIForLogin(userProfile);
        // Load the most recent chat session if it exists
        const sessions = userProfile.chatHistory || [];
        if (sessions.length > 0) {
          const latestSession = sessions[0]; // unshift puts the newest first
          currentMessages = latestSession.history;
          currentLoadedSessionId = latestSession.id;
          initializeChat(currentMessages);
          renderMessagesTo(messagesEl, currentMessages);
        }
      }
    }
  }

  // --- Chat History Functions ---
  function getChatSessions(): ChatSession[] {
    if (!currentUser) {
      return [];
    }
    const users = getUsers();
    const userProfile = users.find((u) => u.username === currentUser.username);
    return userProfile?.chatHistory || [];
  }

  function saveChatSession() {
    if (!currentUser || currentMessages.length === 0) {
      return; // Don't save for guests or if there's nothing to save
    }
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.username === currentUser.username);
    if (userIndex === -1) {
      return; // Should not happen if user is logged in
    }

    const userProfile = users[userIndex];
    const sessions = (userProfile.chatHistory || []).filter(
      (s) => s.id !== currentLoadedSessionId,
    );

    const newSession: ChatSession = {
      id: currentLoadedSessionId || Date.now(),
      startTime: new Date().toISOString(),
      title: currentMessages[0].parts[0].text.substring(0, 40) + '...',
      history: currentMessages,
    };
    sessions.unshift(newSession); // Add to the beginning

    users[userIndex].chatHistory = sessions;
    saveUsers(users);
  }

  function deleteChatSession(id: number) {
    if (!currentUser) {
      return;
    }
    const users = getUsers();
    const userIndex = users.findIndex((u) => u.username === currentUser.username);
    if (userIndex === -1) {
      return;
    }

    let sessions = users[userIndex].chatHistory || [];
    sessions = sessions.filter((s) => s.id !== id);
    users[userIndex].chatHistory = sessions;
    saveUsers(users);
    renderChatHistoryList();
  }

  function renderChatHistoryList(filter: string = '') {
    chatHistoryListEl.innerHTML = '';

    if (!currentUser) {
      const loginPrompt = document.createElement('li');
      loginPrompt.textContent = 'Log in or sign up to save and view chat history.';
      loginPrompt.style.textAlign = 'center';
      loginPrompt.style.color = '#888';
      loginPrompt.style.cursor = 'default';
      loginPrompt.style.padding = '2rem 0';
      chatHistoryListEl.appendChild(loginPrompt);
      return;
    }

    const sessions = getChatSessions();
    const lowerCaseFilter = filter.toLowerCase();

    const filteredSessions = sessions.filter((session) => {
      const dateString = new Date(session.startTime).toLocaleString();
      const contentText = session.history
        .map((m) => m.parts[0].text)
        .join(' ');
      return (
        session.title.toLowerCase().includes(lowerCaseFilter) ||
        dateString.toLowerCase().includes(lowerCaseFilter) ||
        contentText.toLowerCase().includes(lowerCaseFilter)
      );
    });

    if (filteredSessions.length === 0) {
      const emptyMessage = document.createElement('li');
      emptyMessage.textContent = filter
        ? 'No matching chats found.'
        : 'No saved chats yet.';
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.color = '#888';
      emptyMessage.style.cursor = 'default';
      chatHistoryListEl.appendChild(emptyMessage);
      return;
    }

    filteredSessions.forEach((session) => {
      const listItem = document.createElement('li');

      const textContainer = document.createElement('div');
      textContainer.className = 'history-item-text';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = session.title;
      const dateSpan = document.createElement('span');
      dateSpan.className = 'history-item-date';
      dateSpan.textContent = new Date(session.startTime).toLocaleString();
      textContainer.appendChild(titleSpan);
      textContainer.appendChild(dateSpan);
      listItem.appendChild(textContainer);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-history-button';
      deleteButton.textContent = '🗑️';
      deleteButton.title = 'Delete chat';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this chat history?')) {
          deleteChatSession(session.id);
        }
      });
      listItem.appendChild(deleteButton);

      listItem.addEventListener('click', () => showHistoryDetailView(session));
      chatHistoryListEl.appendChild(listItem);
    });
  }

  function showHistoryListView() {
    historyDetailViewEl.classList.add('hidden');
    historyListViewEl.classList.remove('hidden');
  }

  function showHistoryDetailView(session: ChatSession) {
    historyListViewEl.classList.add('hidden');
    renderMessagesTo(historyMessagesDisplayEl, session.history);
    historyDetailViewEl.classList.remove('hidden');
    loadChatButtonEl.onclick = () => {
      saveChatSession(); // Save any active chat before loading a new one
      currentMessages = session.history;
      currentLoadedSessionId = session.id;
      initializeChat(currentMessages);
      renderMessagesTo(messagesEl, currentMessages);
      historyPageEl.classList.add('hidden');
      headerEl.classList.remove('hidden');
      chatContainerEl.classList.remove('hidden');
      inputEl.focus();
    };
  }

  // --- Speech Recognition ---
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  let recognition: any | null = null;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => micButtonEl.classList.add('recording');
    recognition.onend = () => micButtonEl.classList.remove('recording');
    recognition.onerror = (event: any) => console.error('Speech recognition error:', event.error);
    recognition.onresult = (event: any) => {
      inputEl.value = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
    };
    micButtonEl.addEventListener('click', () => recognition?.start());
  } else {
    micButtonEl.style.display = 'none';
  }

  // --- Rendering ---
  function renderMessage(message: Message): HTMLElement {
    const p = document.createElement('p');
    const profile = message.role === 'user' ? message.meta || getCurrentUserProfile() : MODEL_PROFILE;
    const escapedUsername = profile.username
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const textContent = message.parts[0].text.replace(/\n/g, '<br>');
    p.innerHTML = `<strong><span class="avatar">${profile.avatar}</span> ${escapedUsername}:</strong> ${textContent}`;
    return p;
  }

  function renderMessagesTo(element: HTMLElement, messages: Message[]) {
    element.innerHTML = '';
    messages.forEach((msg) => {
      element.appendChild(renderMessage(msg));
    });
    element.scrollTop = element.scrollHeight;
  }

  // --- Main Chat Logic ---
  loadTheme();
  initializeChat();
  checkCurrentUserSession();

  newChatButtonEl.addEventListener('click', () => {
    saveChatSession();
    currentMessages = [];
    currentLoadedSessionId = null;
    messagesEl.innerHTML = '';
    initializeChat();
    inputEl.focus();
  });

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = inputEl.value.trim();
    if (!prompt) return;

    inputEl.disabled = true;
    sendButtonEl.disabled = true;
    inputEl.value = '';

    const userProfile = getCurrentUserProfile();
    const userMessage: Message = {
      role: 'user',
      parts: [{ text: prompt }],
      meta: { ...userProfile },
    };
    currentMessages.push(userMessage);
    messagesEl.appendChild(renderMessage(userMessage));
    scrollToBottom();

    const modelMessageEl = document.createElement('p');
    modelMessageEl.innerHTML = `<strong><span class="avatar">${MODEL_PROFILE.avatar}</span> ${MODEL_PROFILE.username}:</strong> `;
    const responseContainer = document.createElement('span');
    modelMessageEl.appendChild(responseContainer);
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    responseContainer.appendChild(typingIndicator);
    messagesEl.appendChild(modelMessageEl);
    scrollToBottom();

    let responseText = '';
    try {
      const responseStream = await chat.sendMessageStream({ message: prompt });
      let firstChunk = true;
      for await (const chunk of responseStream) {
        if (firstChunk) {
          responseContainer.removeChild(typingIndicator);
          firstChunk = false;
        }
        const sanitizedChunkText = chunk.text.replace(/\n/g, '<br>');
        responseContainer.innerHTML += sanitizedChunkText;
        responseText += chunk.text;
        scrollToBottom();
      }
      currentMessages.push({ role: 'model', parts: [{ text: responseText }] });
    } catch (error) {
      console.error(error);
      if (responseContainer.contains(typingIndicator)) {
        responseContainer.removeChild(typingIndicator);
      }
      responseContainer.innerHTML += '<strong>Error:</strong> Could not retrieve response.';
    } finally {
      inputEl.disabled = false;
      sendButtonEl.disabled = false;
      inputEl.focus();
    }
  });

  // --- Modals and Page Navigation Logic ---
  function setupModalsAndNav() {
    themeSwitcherEl.addEventListener('click', toggleTheme);

    historyButtonEl.addEventListener('click', () => {
      headerEl.classList.add('hidden');
      chatContainerEl.classList.add('hidden');
      historyPageEl.classList.remove('hidden');
      renderChatHistoryList();
      showHistoryListView();
    });

    userLoginButtonEl.addEventListener('click', () => userLoginModalEl.classList.remove('hidden'));
    const closeUserLoginModal = () => {
      userLoginModalEl.classList.add('hidden');
      userLoginErrorEl.classList.add('hidden');
      userLoginFormEl.reset();
    };
    closeUserLoginModalButtonEl.addEventListener('click', closeUserLoginModal);
    userLoginModalEl.addEventListener('click', (e) => e.target === userLoginModalEl && closeUserLoginModal());

    userLoginFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const users = getUsers();
      const user = users.find(
        (u) => u.username === userLoginUsernameEl.value && u.password === userLoginPasswordEl.value
      );
      if (user) {
        sessionStorage.setItem(CURRENT_USER_SESSION_KEY, user.username);
        updateUIForLogin(user);
        closeUserLoginModal();
        // Clear any guest chat after successful login
        currentMessages = [];
        currentLoadedSessionId = null;
        messagesEl.innerHTML = '';
        initializeChat();
      } else {
        userLoginErrorEl.classList.remove('hidden');
      }
    });

    userSignupButtonEl.addEventListener('click', () => profileModalEl.classList.remove('hidden'));
    const closeProfileModal = () => {
      profileModalEl.classList.add('hidden');
      signupErrorEl.classList.add('hidden');
      profileFormEl.reset();
      const current = avatarSelectionEl.querySelector('.avatar-option.selected');
      if (current) current.classList.remove('selected');
      (avatarSelectionEl.querySelector(`[data-avatar="${DEFAULT_AVATAR}"]`) as HTMLElement)?.classList.add('selected');
    };
    closeProfileModalButtonEl.addEventListener('click', closeProfileModal);
    profileModalEl.addEventListener('click', (e) => e.target === profileModalEl && closeProfileModal());

    profileFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const users = getUsers();
      const username = usernameInputEl.value.trim();

      if (users.some((u) => u.username === username)) {
        signupErrorEl.classList.remove('hidden');
        return;
      }

      const selectedAvatarEl = avatarSelectionEl.querySelector('.avatar-option.selected') as HTMLElement;
      const newUser: UserProfile = {
        username: username || 'User',
        avatar: selectedAvatarEl?.dataset.avatar || DEFAULT_AVATAR,
        password: profilePasswordInputEl.value,
        chatHistory: [],
      };

      users.push(newUser);
      saveUsers(users);

      sessionStorage.setItem(CURRENT_USER_SESSION_KEY, newUser.username);
      updateUIForLogin(newUser);
      closeProfileModal();
    });

    backToChatButtonEl.addEventListener('click', () => {
      historyPageEl.classList.add('hidden');
      headerEl.classList.remove('hidden');
      chatContainerEl.classList.remove('hidden');
    });

    backToHistoryListButtonEl.addEventListener('click', showHistoryListView);
    historySearchInputEl.addEventListener('input', () => renderChatHistoryList(historySearchInputEl.value));
    logoutButtonEl.addEventListener('click', () => {
      saveChatSession(); // Save current chat before logging out
      sessionStorage.removeItem(CURRENT_USER_SESSION_KEY);
      updateUIForLogout();
    });
  }

  function initializeAvatarPicker() {
    avatarSelectionEl.innerHTML = '';
    [DEFAULT_AVATAR, ...AVATARS].forEach((avatar, index) => {
      const option = document.createElement('span');
      option.className = 'avatar-option';
      option.textContent = avatar;
      option.dataset.avatar = avatar;
      if (index === 0) option.classList.add('selected');
      option.addEventListener('click', () => {
        avatarSelectionEl.querySelector('.avatar-option.selected')?.classList.remove('selected');
        option.classList.add('selected');
      });
      avatarSelectionEl.appendChild(option);
    });
  }

  initializeAvatarPicker();
  setupModalsAndNav();
}

main();