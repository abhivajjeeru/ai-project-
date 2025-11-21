// public/chat.js
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const chatWindow = document.getElementById('chatWindow');
const btnList = document.getElementById('btnList');
const btnSample = document.getElementById('btnSample');

function appendMessage(text, isUser=false, meta='') {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (isUser ? 'user' : 'bot');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerText = text;
  wrap.appendChild(bubble);
  if (meta) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.innerText = meta;
    wrap.appendChild(m);
  }
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/** POST helper that handles non-JSON responses for debugging */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // If server returned JSON, parse it. Otherwise return text for debug.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  } else {
    const text = await res.text();
    // Provide the raw text back so frontend can show it
    return { __nonJson: true, status: res.status, text };
  }
}

async function sendMessageToServer(message) {
  appendMessage(message, true);
  try {
    const data = await postJson('/api/chat', { message });

    if (data.__nonJson) {
      appendMessage(`Error contacting server: received non-JSON (status ${data.status}).\n${data.text}`, false);
      return;
    }

    if (data.reply) {
      appendMessage(data.reply, false);
      if (data.appointment) {
        appendMessage(JSON.stringify({
          id: data.appointment._id,
          name: data.appointment.patientName,
          date: data.appointment.date,
          time: data.appointment.time
        }, null, 2), false);
      } else if (data.appointments) {
        appendMessage(JSON.stringify(data.appointments.map(a=>({
          id: a._id, name: a.patientName, date: a.date, time: a.time
        })), null, 2), false);
      }
    } else {
      appendMessage('No reply from server.', false);
    }
  } catch (err) {
    appendMessage('Error contacting server: ' + err.message, false);
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  sendMessageToServer(text);
  messageInput.value = '';
});

btnList.addEventListener('click', async () => {
  appendMessage('Show my appointments', true);
  try {
    const res = await fetch('/api/appointments');
    if (!res.ok) {
      const txt = await res.text();
      appendMessage(`Error fetching appointments: ${res.status}\n${txt}`, false);
      return;
    }
    const data = await res.json();
    if (data.length === 0) appendMessage('No appointments.', false);
    else {
      appendMessage('Appointments:', false);
      appendMessage(JSON.stringify(data.map(a=>({
        id: a._id, name: a.patientName, date: a.date, time: a.time
      })), null, 2), false);
    }
  } catch (err) {
    appendMessage('Error fetching appointments: ' + err.message, false);
  }
});

btnSample.addEventListener('click', () => {
  const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0,10);
  const sample = `My name is Test User, book for ${tomorrow} at 10:00 because routine checkup`;
  messageInput.value = sample;
  messageInput.focus();
});
