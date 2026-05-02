const retroEmojiMap = {
            "🤣": "assets/emojis/1f601.png",
            "🥺": "assets/emojis/1f625.png",
            "😀": "assets/emojis/1f600.png",
            "😁": "assets/emojis/1f601.png",
            "😂": "assets/emojis/1f602.png",
            "😃": "assets/emojis/1f603.png",
            "😄": "assets/emojis/1f604.png",
            "😅": "assets/emojis/1f605.png",
            "😆": "assets/emojis/1f606.png",
            "😇": "assets/emojis/1f607.png",
            "😉": "assets/emojis/1f609.png",
            "😊": "assets/emojis/1f60a.png",
            "😋": "assets/emojis/1f60b.png",
            "😌": "assets/emojis/1f60c.png",
            "😍": "assets/emojis/1f60d.png",
            "😎": "assets/emojis/1f60e.png",
            "😏": "assets/emojis/1f60f.png",
            "😐": "assets/emojis/1f610.png",
            "😒": "assets/emojis/1f612.png",
            "😓": "assets/emojis/1f613.png",
            "😔": "assets/emojis/1f614.png",
            "😖": "assets/emojis/1f616.png",
            "😘": "assets/emojis/1f618.png",
            "😚": "assets/emojis/1f61a.png",
            "😜": "assets/emojis/1f61c.png",
            "😝": "assets/emojis/1f61d.png",
            "😞": "assets/emojis/1f61e.png",
            "😠": "assets/emojis/1f620.png",
            "😡": "assets/emojis/1f621.png",
            "😢": "assets/emojis/1f622.png",
            "😣": "assets/emojis/1f623.png",
            "😤": "assets/emojis/1f624.png",
            "😥": "assets/emojis/1f625.png",
            "😨": "assets/emojis/1f628.png",
            "😩": "assets/emojis/1f629.png",
            "😪": "assets/emojis/1f62a.png",
            "😫": "assets/emojis/1f62b.png",
            "😭": "assets/emojis/1f62d.png",
            "😰": "assets/emojis/1f630.png",
            "😱": "assets/emojis/1f631.png",
            "😲": "assets/emojis/1f632.png",
            "😳": "assets/emojis/1f633.png",
            "😴": "assets/emojis/1f634.png",
            "😵": "assets/emojis/1f635.png",
            "😷": "assets/emojis/1f637.png",
            "🌍": "assets/emojis/earth.png",
            "🌤": "assets/emojis/suncloud.png",
            "🌡": "assets/emojis/thermometer.png",
            "🤔": "assets/emojis/thought.png",
            "💧": "assets/emojis/droplet.png",
            "🌬": "assets/emojis/dash.png",
            "🎈": "assets/emojis/balloon.png",
            "🌫": "assets/emojis/foggy.png",
            "😷": "assets/emojis/face.png",
            "📡": "assets/emojis/1f4e1.png",
            "🟢": "assets/emojis/1f7e2.png",
            "🟡": "assets/emojis/1f7e1.png",
            "🟠": "assets/emojis/1f7e0.png",
            "🔴": "assets/emojis/1f534.png",
            "🟣": "assets/emojis/1f7e3.png",
            "☠️": "assets/emojis/skull.png",
            "💡": "assets/emojis/1f4a1.png",
            "💦": "assets/emojis/1f4a6.png",
            "💬": "assets/emojis/1f4ac.png",
            "💻": "assets/emojis/1f4bb.png",
            "👌": "assets/emojis/1f44c.png",
            "👍": "assets/emojis/1f44d.png",
            "👏": "assets/emojis/1f44f.png",
            "🔍": "assets/emojis/1f50d.png",
            "🎉": "assets/emojis/1f389.png",
            "✅": "assets/emojis/2705.png",
            "❌": "assets/emojis/274c.png",
        };
        function renderRetroEmojis(text) {
            if (!text) return text;
            const emojiKeys = Object.keys(retroEmojiMap);
            const regex = new RegExp(emojiKeys.map(e => e.replace(/./g, "$&\\uFE0F?")).join('|'), 'g');
            return text.replace(regex, function (matched) {
                const cleanKey = matched.replace(/\uFE0F/g, "");
                const path = retroEmojiMap[cleanKey];
                return path ? `<img src="${path}" class="retro-emoji" alt="${cleanKey}">` : matched;
            });
        }

const SOUND_URLS = {
            sent: 'assets/sounds/sent.mp3',
            recv: 'assets/sounds/recv.mp3',
            switch: 'assets/sounds/switch.wav'
        };
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const soundBuffers = {
            sent: null,
            recv: null
        };
        async function initAudioSystem() {
            const loadSound = async (key, url) => {
                try {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    audioCtx.decodeAudioData(arrayBuffer, (decoded) => {
                        soundBuffers[key] = decoded;
                        try {
                            const source = audioCtx.createBufferSource();
                            source.buffer = decoded;
                            const silentGain = audioCtx.createGain();
                            silentGain.gain.value = 0;
                            source.connect(silentGain);
                            silentGain.connect(audioCtx.destination);
                            source.start(0);
                        } catch (e) { }
                        if (window.console && console.log) console.log(`✅ [音效] ${key} 预热完成`);
                    }, (err) => {
                        console.error(`❌ [音效] ${key} 解码失败`, err);
                    });
                } catch (e) {
                    console.error(`❌ [音效] ${key} 加载失败`, e);
                }
            };
            loadSound('sent', SOUND_URLS.sent);
            setTimeout(() => {
                loadSound('recv', SOUND_URLS.recv);
                loadSound('switch', SOUND_URLS.switch);
            }, 200);
        }
        initAudioSystem();
        function checkAndResumeAudio() {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }
        setInterval(() => {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                gain.gain.value = 0;
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                const now = audioCtx.currentTime;
                osc.start(now);
                osc.stop(now + 0.001);
            } catch (e) {
            }
        }, 8000);
        let hasUserInteracted = false;
        function initialUnlock() {
            if (hasUserInteracted) return;
            hasUserInteracted = true;
            if (audioCtx.state !== 'running') {
                audioCtx.resume();
            }
            const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() - 0.5) * 0.00001;
            }
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(audioCtx.destination);
            source.start(0);
            document.removeEventListener('touchstart', initialUnlock);
            document.removeEventListener('click', initialUnlock);
            document.removeEventListener('keydown', initialUnlock);
            window.removeEventListener('mousemove', initialUnlock);
        }
        function playSound(type) {
            try {
                checkAndResumeAudio();
                const buffer = soundBuffers[type];
                if (!buffer) return;
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = (type === 'sent') ? 0.6 : 0.8;
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                source.start(0);
            } catch (e) {
                console.error("播放失败:", e);
            }
        }
        function aggressiveWakeUp() {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            if (!hasUserInteracted) {
                initialUnlock();
            }
        }
        window.addEventListener('mousedown', aggressiveWakeUp, { passive: true });
        window.addEventListener('mousemove', aggressiveWakeUp, { passive: true });
        window.addEventListener('touchstart', aggressiveWakeUp, { passive: true });
        window.addEventListener('keydown', aggressiveWakeUp, { passive: true });
        const inputField = document.getElementById('user-input');
        if (inputField) {
            inputField.addEventListener('focus', aggressiveWakeUp);
        }
        class ClientBrain {
            constructor() {
                this.memory = {
                    name: "朋友",
                    topic: null,
                    mood: 0
                };
                this.loadMemory();
                this.history = [];
            }
            saveMemory() {
                try {
                    localStorage.setItem('neural_lite_memory', JSON.stringify(this.memory));
                } catch (e) {
                    console.error("保存记忆失败:", e);
                }
            }
            loadMemory() {
                const saved = localStorage.getItem('neural_lite_memory');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            this.memory = { ...this.memory, ...parsed };
                        }
                    } catch (e) {
                        console.error("记忆文件损坏，重置为默认");
                    }
                }
            }
            saveContext(userInput, aiResponse) {
                if (this.history.length >= 8) {
                    this.history.shift();
                }
                this.history.push({ q: userInput, a: aiResponse });
            }
            async fetchGeminiDirectly(text) {
                try {
                    const response = await fetch('/api/gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: text,
                            history: this.history
                        })
                    });
                    const data = await response.json();
                    if (data.reply) {
                        const reply = data.reply.trim();
                        this.saveContext(text, reply);
                        return reply;
                    } else {
                        throw new Error(data.error || "模型返回内容为空");
                    }
                } catch (e) {
                    console.error("直接请求失败:", e);
                    throw e;
                }
            }
            async process(input) {
                if (!input) return null;
                let text = input.trim();
                let finalResponse = null;

                try {
                    // Call the new unified backend endpoint
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: text,
                            history: this.history,
                            memory: this.memory
                        })
                    });

                    let data;
                    try {
                        data = await response.json();
                    } catch (e) {
                        console.error("解析JSON失败:", e);
                        throw new Error("服务器返回了非JSON数据，状态码: " + response.status);
                    }

                    // IF server-side sub-request failed (403/500), try direct client-side call
                    if (data.error === "Internal Sub-request Error") {
                        console.warn("服务端转发失败，尝试客户端直接连接...");
                        return await this.fetchGeminiDirectly(text);
                    }

                    if (data.memory) {
                        this.memory = data.memory;
                        this.saveMemory();
                    }

                    if (data.reply) {
                        finalResponse = data.reply.trim();
                        this.saveContext(text, finalResponse);
                        return finalResponse;
                    } else if (data.error) {
                        finalResponse = "【系统错误】" + data.error + (data.details ? ": " + data.details : "");
                        this.saveContext(text, finalResponse);
                        return finalResponse;
                    } else {
                        throw new Error("模型返回异常，缺少回复内容");
                    }
                } catch (e) {
                    console.error("优先请求失败，尝试降级连接:", e);
                    try {
                        return await this.fetchGeminiDirectly(text);
                    } catch (fallbackErr) {
                        finalResponse = "我的云端神经元似乎断线了... (" + fallbackErr.message + ")";
                        this.saveContext(text, finalResponse);
                        return finalResponse;
                    }
                }
            }
        }
        (function initSendButton() {
            const sendBtn = document.getElementById('send-btn');
            const input = document.getElementById('user-input');
            const handlePress = (e) => {
                if (e.type === 'touchstart') {
                    e.preventDefault();
                }
                sendBtn.classList.add('pressed');
            };
            const handleRelease = (e) => {
                if (e.type === 'touchend') {
                    e.preventDefault();
                }
                if (sendBtn.classList.contains('pressed')) {
                    sendBtn.classList.remove('pressed');
                    sendMessage();
                    const isIPad = (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
                        || /iPad/i.test(navigator.userAgent);
                    if (isIPad) {
                        input.blur();
                    } else {
                        setTimeout(() => input.focus(), 0);
                    }
                }
            };
            const handleCancel = (e) => {
                sendBtn.classList.remove('pressed');
            };
            sendBtn.addEventListener('touchstart', handlePress, { passive: false });
            sendBtn.addEventListener('touchend', handleRelease, { passive: false });
            sendBtn.addEventListener('touchcancel', handleCancel);
            sendBtn.addEventListener('mousedown', handlePress);
            sendBtn.addEventListener('mouseup', handleRelease);
            sendBtn.addEventListener('mouseleave', handleCancel);
        })();
        const brain = new ClientBrain();
        const chatBox = document.getElementById('chat-container');
        const userInput = document.getElementById('user-input');
        const statusDiv = document.getElementById('db-status');

        function handleEnter(e) { if (e.key === 'Enter') sendMessage(); }
        async function sendMessage() {
            const text = userInput.value.trim();
            if (!text) return;
            playSound('sent');
            addBubble(text, 'user');
            userInput.value = '';
            setTimeout(async () => {
                const typingId = addTypingBubble();
                const thinkingTimeout = setTimeout(() => {
                    const bubble = document.getElementById(typingId + '-bubble');
                    if (bubble && bubble.querySelector('.typing-indicator')) {
                        bubble.innerHTML = '<i>正在思考中...</i>';
                    }
                }, 5000);
                const replyText = await brain.process(text);
                clearTimeout(thinkingTimeout);
                setTimeout(() => {
                    updateTypingBubble(typingId, replyText);
                }, 900);
            }, 670);
        }
        function escapeHTML(str) {
            return str.replace(/[&<>'"]/g,
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag]));
        }
        function addBubble(text, role, isHistory = false) {
            const row = document.createElement('div');
            row.className = `message-row ${role}`;
            if (role === 'ai' && !isHistory) {
                playSound('recv');
            }
            const avatarDiv = document.createElement('div');
            avatarDiv.className = `avatar ${role}-avatar`;
            avatarDiv.textContent = role === 'ai' ? 'AI' : 'Me';
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `bubble ${role}-bubble`;
            if (role === 'user') {
                bubbleDiv.textContent = text;
            } else {
                let safeText = text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
                let formatted = safeText.replace(/\n/g, '<br>');
                formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                formatted = renderRetroEmojis(formatted);
                bubbleDiv.innerHTML = formatted;
            }
            if (role === 'ai') {
                row.appendChild(avatarDiv);
                row.appendChild(bubbleDiv);
            } else {
                row.appendChild(bubbleDiv);
                row.appendChild(avatarDiv);
            }
            chatBox.appendChild(row);
            scrollToBottom();
            if (!isHistory) {
                saveChatLog(text, role);
            }
        }
        function scrollToBottom() {
            const chatBox = document.getElementById('chat-container');
            const threshold = 5;
            if (chatBox.scrollHeight > chatBox.clientHeight + threshold) {
                chatBox.scrollTo({
                    top: chatBox.scrollHeight,
                    behavior: 'auto'
                });
            }
        }
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                const windowFrame = document.querySelector('.window-frame');
                if (window.innerWidth <= 768) {
                    windowFrame.style.height = window.visualViewport.height + 'px';
                    setTimeout(scrollToBottom, 100);
                } else {
                    windowFrame.style.height = '';
                }
            });
            window.visualViewport.addEventListener('scroll', () => {
                if (window.innerWidth <= 768) {
                    scrollToBottom();
                }
            });
        }



let lastMessageTime = 0;
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            let hours = date.getHours();
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${hours}:${minutes} ${ampm}`;
        }
        function insertTimeDivider(timestamp) {
            const chatBox = document.getElementById('chat-container');
            const divider = document.createElement('div');
            divider.className = 'time-divider';
            divider.textContent = formatTime(timestamp);
            chatBox.appendChild(divider);
        }
        function saveChatLog(text, role, timestamp) {
            let logs = JSON.parse(localStorage.getItem('chat_logs')) || [];
            logs.push({ text: text, role: role, timestamp: timestamp });
            localStorage.setItem('chat_logs', JSON.stringify(logs));
        }
        function loadChatHistory() {
            let logs = JSON.parse(localStorage.getItem('chat_logs')) || [];
            if (logs.length === 0) {
                let now = Date.now();
                insertTimeDivider(now);
                lastMessageTime = now;
                window.isFirstSessionMessage = true;
            }
            logs.forEach(log => {
                let ts = log.timestamp || Date.now();
                addBubble(log.text, log.role, true, ts);
            });
        }
        function addBubble(text, role, isHistory = false, timestamp = null) {
            if (!timestamp) timestamp = Date.now();
            if (window.isFirstSessionMessage && !isHistory) {
                window.isFirstSessionMessage = false;
            } else if (lastMessageTime === 0 || (timestamp - lastMessageTime > 60000)) {
                insertTimeDivider(timestamp);
            }
            lastMessageTime = timestamp;
            const row = document.createElement('div');
            row.className = `message-row ${role}`;
            if (role === 'ai' && !isHistory) {
                if (typeof playSound === 'function') playSound('recv');
            }
            const avatarDiv = document.createElement('div');
            avatarDiv.className = `avatar ${role}-avatar`;
            avatarDiv.textContent = role === 'ai' ? 'AI' : 'Me';
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `bubble ${role}-bubble`;
            if (role === 'user') {
                bubbleDiv.textContent = text;
            } else {
                let safeText = text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
                let formatted = safeText.replace(/\n/g, '<br>');
                formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                formatted = renderRetroEmojis(formatted);
                bubbleDiv.innerHTML = formatted;
            }
            if (role === 'ai') {
                row.appendChild(avatarDiv);
                row.appendChild(bubbleDiv);
            } else {
                row.appendChild(bubbleDiv);
                row.appendChild(avatarDiv);
            }
            const chatBox = document.getElementById('chat-container');
            chatBox.appendChild(row);
            scrollToBottom();
            if (!isHistory) {
                saveChatLog(text, role, timestamp);
            }
        }
        loadChatHistory();
        function toggleDarkMode() {
            const body = document.body;
            body.classList.toggle('dark-mode');
            if (typeof playSound === 'function') playSound('switch');
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('neural_lite_theme', 'dark');
                if (document.activeElement === userInput) userInput.blur();
            } else {
                localStorage.setItem('neural_lite_theme', 'light');
            }
        }
        setTimeout(() => {
            const minBtn = document.querySelector('.win-btn.min');
            if (minBtn) {
                minBtn.style.cursor = 'pointer';
                minBtn.title = "切换日/夜模式";
                minBtn.onclick = toggleDarkMode;
            }
        }, 100);
        setTimeout(() => {
            document.body.classList.remove('preload');
            var antiFlashStyle = document.getElementById('anti-flash');
            if (antiFlashStyle) {
                antiFlashStyle.remove();
            }
        }, 100);
        function resetSystem() {
            const modal = document.getElementById('custom-modal');
            modal.style.display = 'flex';
            if (typeof playSound === 'function') playSound('recv');
        }
        function closeModal() {
            document.getElementById('custom-modal').style.display = 'none';
        }
        function confirmResetAction() {
            closeModal();
            if (typeof playSound === 'function') playSound('sent');
            localStorage.removeItem('chat_logs');
            localStorage.removeItem('neural_lite_memory');
            setTimeout(() => {
                location.reload();
            }, 300);
            localStorage.removeItem('neural_lite_width');
            localStorage.removeItem('neural_lite_height');
            localStorage.removeItem('neural_lite_left');
            localStorage.removeItem('neural_lite_top');
        }
        (function makeDraggable() {
            const frame = document.querySelector('.window-frame');
            const header = document.querySelector('.header');
            if (window.innerWidth <= 768) return;
            let isDragging = false;
            let startX, startY;
            function stopDrag() {
                if (!isDragging) return;
                isDragging = false;
                frame.style.transform = '';
                frame.style.boxShadow = '';
                frame.style.cursor = 'default';
                header.style.cursor = 'default';
                localStorage.setItem('neural_lite_left', frame.style.left);
                localStorage.setItem('neural_lite_top', frame.style.top);
            }
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.win-btn') || e.target.closest('h1 span')) return;
                e.preventDefault();
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = frame.getBoundingClientRect();
                frame.style.margin = '0';
                frame.style.position = 'absolute';
                frame.style.left = rect.left + 'px';
                frame.style.top = rect.top + 'px';
            });
            document.addEventListener('mousemove', (e) => {
                if (isDragging && e.buttons === 0) {
                    stopDrag();
                    return;
                }
                if (!isDragging) return;
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                frame.style.left = `${parseFloat(frame.style.left) + dx}px`;
                frame.style.top = `${parseFloat(frame.style.top) + dy}px`;
                startX = e.clientX;
                startY = e.clientY;
            });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('mouseleave', stopDrag);
            window.addEventListener('blur', stopDrag);
        })();
        (function makeResizable() {
            const frame = document.querySelector('.window-frame');
            const handle = document.querySelector('.resize-handle');
            if (!handle || !frame) return;
            let isResizing = false;
            let startWidth, startHeight, startX, startY;
            function startResize(e) {
                if (window.innerWidth <= 768) return;
                isResizing = true;
                const rect = frame.getBoundingClientRect();
                frame.style.width = rect.width + 'px';
                frame.style.height = rect.height + 'px';
                frame.style.margin = '0';
                frame.style.position = 'absolute';
                frame.style.left = rect.left + 'px';
                frame.style.top = rect.top + 'px';
                startWidth = rect.width;
                startHeight = rect.height;
                startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                frame.style.maxWidth = 'none';
                frame.style.maxHeight = 'none';
                e.preventDefault();
            }
            function doResize(e) {
                if (!isResizing) return;
                const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                const newWidth = startWidth + (clientX - startX);
                const newHeight = startHeight + (clientY - startY);
                if (newWidth > 320) frame.style.width = newWidth + 'px';
                if (newHeight > 300) frame.style.height = newHeight + 'px';
                const chatBox = document.getElementById('chat-container');
                if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
            }
            function stopResize() {
                if (!isResizing) return;
                isResizing = false;
                localStorage.setItem('neural_lite_width', frame.style.width);
                localStorage.setItem('neural_lite_height', frame.style.height);
            }
            handle.addEventListener('mousedown', startResize);
            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
            handle.addEventListener('touchstart', startResize, { passive: false });
            document.addEventListener('touchmove', doResize, { passive: false });
            document.addEventListener('touchend', stopResize);
        })();
        (function restoreWindowState() {
            if (window.innerWidth <= 768) return;
            const frame = document.querySelector('.window-frame');
            if (!frame) return;
            const savedWidth = localStorage.getItem('neural_lite_width');
            const savedHeight = localStorage.getItem('neural_lite_height');
            const savedLeft = localStorage.getItem('neural_lite_left');
            const savedTop = localStorage.getItem('neural_lite_top');
            if (savedWidth && savedHeight) {
                frame.style.maxWidth = 'none';
                frame.style.maxHeight = 'none';
                frame.style.width = savedWidth;
                frame.style.height = savedHeight;
            }
            if (savedLeft && savedTop) {
                frame.style.margin = '0';
                frame.style.position = 'absolute';
                frame.style.left = savedLeft;
                frame.style.top = savedTop;
            }
        })();
        function addTypingBubble() {
            const id = 'typing-' + Date.now();
            const row = document.createElement('div');
            row.className = 'message-row ai';
            row.id = id;
            if (typeof playSound === 'function') playSound('recv');
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar ai-avatar';
            avatarDiv.textContent = 'AI';
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'bubble ai-bubble';
            bubbleDiv.id = id + '-bubble';
            bubbleDiv.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
            row.appendChild(avatarDiv);
            row.appendChild(bubbleDiv);
            const chatBox = document.getElementById('chat-container');
            chatBox.appendChild(row);
            scrollToBottom();
            return id;
        }
        function updateTypingBubble(rowId, text) {
            const bubbleDiv = document.getElementById(rowId + '-bubble');
            if (!bubbleDiv) return;
            let safeText = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            let formatted = safeText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            formatted = renderRetroEmojis(formatted);
            const startWidth = bubbleDiv.offsetWidth;
            const startHeight = bubbleDiv.offsetHeight;
            bubbleDiv.style.transition = 'none';
            bubbleDiv.style.width = 'auto';
            bubbleDiv.style.height = 'auto';
            bubbleDiv.innerHTML = formatted;
            const finalWidth = bubbleDiv.offsetWidth;
            const finalHeight = bubbleDiv.offsetHeight;
            const computedStyle = window.getComputedStyle(bubbleDiv);
            const paddingX = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
            const innerWidth = finalWidth - paddingX;
            const finalHTML = `<div style="width: ${innerWidth}px; animation: textFadeIn 0.3s ease forwards; opacity: 0;">${formatted}</div>`;
            bubbleDiv.style.boxSizing = 'border-box';
            bubbleDiv.style.width = startWidth + 'px';
            bubbleDiv.style.height = startHeight + 'px';
            bubbleDiv.style.overflow = 'hidden';
            bubbleDiv.innerHTML = finalHTML;
            void bubbleDiv.offsetWidth;
            bubbleDiv.style.transition = 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1), height 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
            bubbleDiv.style.width = finalWidth + 'px';
            bubbleDiv.style.height = finalHeight + 'px';
            scrollToBottom();
            setTimeout(() => {
                bubbleDiv.style.transition = '';
                bubbleDiv.style.width = '';
                bubbleDiv.style.height = '';
                bubbleDiv.style.overflow = '';
                bubbleDiv.style.boxSizing = '';
                const innerDiv = bubbleDiv.querySelector('div');
                if (innerDiv) innerDiv.style.width = '';
                scrollToBottom();
            }, 300);
            const timestamp = Date.now();
            lastMessageTime = timestamp;
            saveChatLog(text, 'ai', timestamp);
        }

