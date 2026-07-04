// ↓ あなたのSupabaseプロジェクトのURLとanon keyに置き換えてください
const SUPABASE_URL = 'https://dbxesltmvijfnxvsklwj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9v4R-rTXUgktfzRIYVJlHA_qZ1ZCbGY';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM要素の取得
const authSection = document.getElementById('auth-section');
const taskSection = document.getElementById('task-section');
const userInfo = document.getElementById('user-info');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');

const taskList = document.getElementById('task-list');
const taskForm = document.getElementById('task-form');

// 日付ナビゲーション用要素
const btnPrevDay = document.getElementById('btn-prev-day');
const btnNextDay = document.getElementById('btn-next-day');
const btnCalendar = document.getElementById('btn-calendar');
const currentDateDisplay = document.getElementById('current-date-display');
const datePicker = document.getElementById('date-picker');

let currentTasks = [];
let currentUser = null;
let selectedDate = new Date(); // デフォルトは今日

// 日付を YYYY-MM-DD 形式の文字列にするヘルパー
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 表示を更新するヘルパー
function updateDateDisplay() {
  currentDateDisplay.textContent = selectedDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
  datePicker.value = formatDate(selectedDate);
}

// 時間入力をパースしてISO文字列（ローカル時刻）を返す
function parseTimeInput(val, dateStr) {
  if (!val) return null;
  let hh, mm, ss = '00';

  if (val.includes(':')) {
    const parts = val.split(':');
    hh = parts[0].padStart(2, '0');
    mm = (parts[1] || '0').padStart(2, '0');
    if (parts[2]) ss = parts[2].padStart(2, '0');
  } else {
    const digits = val.replace(/\D/g, '');
    if (digits.length === 4) {
      hh = digits.substring(0, 2);
      mm = digits.substring(2, 4);
    } else if (digits.length === 6) {
      hh = digits.substring(0, 2);
      mm = digits.substring(2, 4);
      ss = digits.substring(4, 6);
    } else {
      return null;
    }
  }

  // バリデーション
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  const s = parseInt(ss, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;

  return `${dateStr}T${hh}:${mm}:${ss}`;
}

// ISO文字列をHH:mm:ss形式に変換
function formatTimeForInput(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ==========================================
// 1. 認証（ログイン・サインアップ）関連の処理
// ==========================================

// 画面の表示切り替え（ログイン状態に応じて）
function updateUI(session) {
  if (session) {
    currentUser = session.user;
    authSection.style.display = 'none';
    taskSection.style.display = 'block';
    userInfo.textContent = `${currentUser.email} でログイン中`;
    fetchTasks(); // ログイン時のみタスクを取得
  } else {
    currentUser = null;
    authSection.style.display = 'block';
    taskSection.style.display = 'none';
    taskList.innerHTML = ''; // ログアウト時に画面のタスクを消去
  }
}

// 初回読み込み時のセッション確認
async function checkSession() {
  const { data: { session } } = await client.auth.getSession();
  updateUI(session);
}
checkSession();

// セッション状態の変化を監視（ログイン・ログアウト時）
client.auth.onAuthStateChange((event, session) => {
  updateUI(session);
});

// 新規登録ボタン
document.getElementById('btn-signup').addEventListener('click', async () => {
  const email = authEmail.value;
  const password = authPassword.value;
  if (!email || !password) return alert('メールアドレスとパスワードを入力してください');

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    alert('新規登録エラー: ' + error.message);
  } else {
    alert('登録成功！ログインします。');
  }
});

// ログインボタン
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = authEmail.value;
  const password = authPassword.value;
  if (!email || !password) return alert('メールアドレスとパスワードを入力してください');

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    alert('ログインエラー: ' + error.message);
  }
});

// ログアウトボタン
document.getElementById('btn-logout').addEventListener('click', async () => {
  await client.auth.signOut();
});

// ==========================================
// 1.5 日付ナビゲーションのイベント
// ==========================================

// 前の日へ
btnPrevDay.addEventListener('click', () => {
  selectedDate.setDate(selectedDate.getDate() - 1);
  fetchTasks();
});

// 次の日へ
btnNextDay.addEventListener('click', () => {
  selectedDate.setDate(selectedDate.getDate() + 1);
  fetchTasks();
});

// カレンダー表示（カレンダーアイコン部分をクリックした時）
btnCalendar.addEventListener('click', () => {
  // ブラウザのネイティブな日付選択ツールを起動
  if (typeof datePicker.showPicker === 'function') {
    datePicker.showPicker();
  } else {
    datePicker.focus();
    datePicker.click();
  }
});

// カレンダーで日付が選択された時
datePicker.addEventListener('change', (e) => {
  if (e.target.value) {
    // YYYY-MM-DD をローカル時刻としてパースする
    const [year, month, day] = e.target.value.split('-').map(Number);
    selectedDate = new Date(year, month - 1, day);
    fetchTasks();
  }
});

// ==========================================
// 2. タスク管理関連の処理
// ==========================================

// タスクの取得と描画
async function fetchTasks() {
  if (!currentUser) return; // 未ログイン時は実行しない

  updateDateDisplay();

  // 選択された日付（scheduled_at）でフィルタリング
  const { data: tasks, error } = await client
    .from('tasks')
    .select('*')
    .eq('scheduled_at', formatDate(selectedDate))
    .order('position', { ascending: true }); // 並び順に取得

  if (error) return console.error('取得エラー:', error);
  
  currentTasks = tasks;
  taskList.innerHTML = '';

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;

    let btnHtml = '';
    
    // 要件に応じた状態判定
    if (!task.start_time) {
      // 開始前：開始ボタン
      btnHtml = `<button class="task-btn start-btn" onclick="startTask('${task.id}')"><i class="fas fa-play"></i></button>`;
    } else if (!task.end_time) {
      // 実行中：終了ボタン
      btnHtml = `<button class="task-btn end-btn" onclick="endTask('${task.id}')"><i class="fas fa-stop"></i></button>`;
    } else {
      // 完了後：完了済みボタン（ホバーで複製ボタンを表示）
      btnHtml = `
        <div class="task-btn-container">
          <button class="task-btn completed-btn"><i class="fas fa-check"></i></button>
          <button class="task-btn duplicate-btn" onclick="duplicateTask('${task.id}')"><i class="fas fa-rotate-left"></i></button>
        </div>
      `;
    }

    const startTimeVal = formatTimeForInput(task.start_time);
    const endTimeVal = formatTimeForInput(task.end_time);

    // HTMLの構築
    li.innerHTML = `
      ${btnHtml}
      <div class="task-content">
        <input type="text" class="inline-edit-title" value="">
        <div class="task-times">
          <input type="text" class="inline-edit-time start-time-input" placeholder="開始" value="${startTimeVal}">
          <span class="time-separator">~</span>
          <input type="text" class="inline-edit-time end-time-input" placeholder="終了" value="${endTimeVal}">
        </div>
      </div>
      <button class="edit-btn" onclick="openEditModal('${task.id}')"><i class="fas fa-edit"></i></button>
    `;
    
    // タイトル
    const titleInput = li.querySelector('.inline-edit-title');
    titleInput.value = task.title;
    titleInput.addEventListener('blur', (e) => {
      const newVal = e.target.value.trim();
      if (newVal !== task.title && newVal !== "") {
        updateTaskInline(task.id, { title: newVal });
      } else {
        e.target.value = task.title;
      }
    });
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.target.blur();
    });

    // 開始時間
    const startInput = li.querySelector('.start-time-input');
    startInput.addEventListener('blur', (e) => {
      const val = e.target.value.trim();
      if (val === "") {
        if (task.start_time !== null) updateTaskInline(task.id, { start_time: null });
        return;
      }
      const iso = parseTimeInput(val, task.scheduled_at);
      if (!iso) {
        alert('時間の形式が正しくありません (例: 0123, 01:23, 01:23:45)');
        e.target.value = startTimeVal;
        return;
      }
      // 単純比較のためDateオブジェクト経由で比較
      if (!task.start_time || new Date(iso).getTime() !== new Date(task.start_time).getTime()) {
        updateTaskInline(task.id, { start_time: iso });
      }
    });
    startInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.target.blur();
    });

    // 終了時間
    const endInput = li.querySelector('.end-time-input');
    endInput.addEventListener('blur', (e) => {
      const val = e.target.value.trim();
      if (val === "") {
        if (task.end_time !== null) updateTaskInline(task.id, { end_time: null });
        return;
      }
      const iso = parseTimeInput(val, task.scheduled_at);
      if (!iso) {
        alert('時間の形式が正しくありません (例: 0123, 01:23, 01:23:45)');
        e.target.value = endTimeVal;
        return;
      }
      if (!task.end_time || new Date(iso).getTime() !== new Date(task.end_time).getTime()) {
        updateTaskInline(task.id, { end_time: iso });
      }
    });
    endInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.target.blur();
    });

    taskList.appendChild(li);
  });
}

// フォームからタスク追加
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titleInput = document.getElementById('task-title');
  if (!titleInput.value.trim() || !currentUser) return;

  // ※ user_id はSupabase側（PostgreSQLのデフォルト値）で自動付与されます
  await client.from('tasks').insert([{
    title: titleInput.value.trim(),
    scheduled_at: formatDate(selectedDate)
  }]);
  
  titleInput.value = '';
  fetchTasks();
});

// 開始ボタンの処理
window.startTask = async (id) => {
  await client.from('tasks').update({ start_time: new Date().toISOString() }).eq('id', id);
  fetchTasks();
};

// 終了ボタンの処理
window.endTask = async (id) => {
  await client.from('tasks').update({ end_time: new Date().toISOString() }).eq('id', id);
  fetchTasks();
};

// インライン更新の処理
async function updateTaskInline(id, updates) {
  const { error } = await client.from('tasks').update(updates).eq('id', id);
  if (error) {
    console.error('更新エラー:', error);
    alert('更新に失敗しました');
  }
  fetchTasks();
}

// 複製ボタンの処理
window.duplicateTask = async (id) => {
  const task = currentTasks.find(t => t.id === id);
  if (!task) return;
  
  // タイトルやメモ、属性をコピーし、現在の選択日に合わせる
  // 開始・終了時間は空（デフォルト）で追加
  await client.from('tasks').insert([{
    title: task.title,
    scheduled_at: formatDate(selectedDate),
    note: task.note,
    project_id: task.project_id,
    mode_id: task.mode_id,
    tag_ids: task.tag_ids,
    routine_id: task.routine_id
  }]);
  fetchTasks();
};

// ==========================================
// 2.5 タスク詳細編集モーダルの処理
// ==========================================

const editModal = document.getElementById('edit-modal');
const editTaskForm = document.getElementById('edit-task-form');

window.openEditModal = (id) => {
  const task = currentTasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('edit-id').value = task.id;
  document.getElementById('edit-title').value = task.title;
  document.getElementById('edit-scheduled-at').value = task.scheduled_at;
  document.getElementById('edit-note').value = task.note || '';
  document.getElementById('edit-project-id').value = task.project_id || '';
  document.getElementById('edit-mode-id').value = task.mode_id || '';
  document.getElementById('edit-tag-ids').value = task.tag_ids || '';
  document.getElementById('edit-routine-id').value = task.routine_id || '';

  document.getElementById('display-created-at').textContent = task.created_at ? new Date(task.created_at).toLocaleString() : '-';
  document.getElementById('display-updated-at').textContent = task.updated_at ? new Date(task.updated_at).toLocaleString() : '-';

  editModal.style.display = 'flex';
};

window.closeEditModal = () => {
  editModal.style.display = 'none';
};

editTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const updates = {
    title: document.getElementById('edit-title').value.trim(),
    scheduled_at: document.getElementById('edit-scheduled-at').value,
    note: document.getElementById('edit-note').value.trim() || null,
    project_id: document.getElementById('edit-project-id').value.trim() || null,
    mode_id: document.getElementById('edit-mode-id').value.trim() || null,
    tag_ids: document.getElementById('edit-tag-ids').value.trim() || null,
    routine_id: document.getElementById('edit-routine-id').value.trim() || null,
  };

  const { error } = await client.from('tasks').update(updates).eq('id', id);
  if (error) {
    alert('更新エラー: ' + error.message);
  } else {
    closeEditModal();
    fetchTasks();
  }
});

// モーダルの外側をクリックしたら閉じる
window.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

// ==========================================
// 3. ドラッグ＆ドロップによる並び替え処理
// ==========================================

new Sortable(taskList, {
  animation: 150,
  onEnd: async () => {
    // 画面上の現在の順番を取得
    const items = [...taskList.children];
    
    // 順番に基づいて position の数値を更新するリクエストを生成
    const updates = items.map((item, index) => {
      return client.from('tasks').update({ position: index }).eq('id', item.dataset.id);
    });
    
    // 並列処理で一括更新し、完了後に再取得
    await Promise.all(updates);
    fetchTasks();
  }
});
