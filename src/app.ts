// @ts-ignore
const SUPABASE_URL = 'https://dbxesltmvijfnxvsklwj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9v4R-rTXUgktfzRIYVJlHA_qZ1ZCbGY';

// 外部グローバル変数の型定義
declare const Sortable: any;
interface Window {
  supabase: any;
  startTask: (id: string) => void;
  endTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  openEditModal: (id: string) => void;
  closeEditModal: () => void;
}

const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM要素の取得（型キャストとNon-null指定を追加）
const authSection = document.getElementById('auth-section')!;
const taskSection = document.getElementById('task-section')!;
const userInfo = document.getElementById('user-info')!;
const authEmail = document.getElementById('auth-email') as HTMLInputElement;
const authPassword = document.getElementById('auth-password') as HTMLInputElement;

const taskList = document.getElementById('task-list')!;
const taskForm = document.getElementById('task-form')!;

// 日付ナビゲーション用要素
const btnPrevDay = document.getElementById('btn-prev-day')!;
const btnNextDay = document.getElementById('btn-next-day')!;
const btnCalendar = document.getElementById('btn-calendar')!;
const currentDateDisplay = document.getElementById('current-date-display')!;
const datePicker = document.getElementById('date-picker') as HTMLInputElement;

// タスクオブジェクトの簡易的な型定義
interface Task {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  scheduled_at: string;
  position: number;
  note: string | null;
  project_id: string | null;
  mode_id: string | null;
  tag_ids: string | null;
  routine_id: string | null;
  created_at?: string;
  updated_at?: string;
}

let currentTasks: Task[] = [];
let currentUser: any = null;
let selectedDate = new Date(); // デフォルトは今日

// 日付を YYYY-MM-DD 形式の文字列にするヘルパー
function formatDate(date: Date): string {
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
function parseTimeInput(val: string, dateStr: string): string | null {
  if (!val) return null;
  let hh: string, mm: string, ss = '00';

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

  // 日本時間としてパースするために +09:00 を付与してISO文字列化
  const localIso = `${dateStr}T${hh}:${mm}:${ss}+09:00`;
  return new Date(localIso).toISOString();
}

// ISO文字列をHH:mm:ss形式（日本時間）に変換
function formatTimeForInput(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  // 日本時間(JST)でフォーマット
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo'
  });
}

// ==========================================
// 1. 認証（ログイン・サインアップ）関連の処理
// ==========================================

function updateUI(session: any) {
  if (session) {
    currentUser = session.user;
    (authSection as HTMLElement).style.display = 'none';
    (taskSection as HTMLElement).style.display = 'block';
    userInfo.textContent = `${currentUser.email} でログイン中`;
    fetchTasks(); // ログイン時のみタスクを取得
  } else {
    currentUser = null;
    (authSection as HTMLElement).style.display = 'block';
    (taskSection as HTMLElement).style.display = 'none';
    taskList.innerHTML = ''; // ログアウト時に画面のタスクを消去
  }
}

async function checkSession() {
  const { data: { session } } = await client.auth.getSession();
  updateUI(session);
}
checkSession();

client.auth.onAuthStateChange((_event: any, session: any) => {
  updateUI(session);
});

document.getElementById('btn-signup')!.addEventListener('click', async () => {
  const email = authEmail.value;
  const password = authPassword.value;
  if (!email || !password) return alert('メールアドレスとパスワードを入力してください');

  const { error } = await client.auth.signUp({ email, password });
  if (error) {
    alert('新規登録エラー: ' + error.message);
  } else {
    alert('登録成功！ログインします。');
  }
});

document.getElementById('btn-login')!.addEventListener('click', async () => {
  const email = authEmail.value;
  const password = authPassword.value;
  if (!email || !password) return alert('メールアドレスとパスワードを入力してください');

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    alert('ログインエラー: ' + error.message);
  }
});

document.getElementById('btn-logout')!.addEventListener('click', async () => {
  await client.auth.signOut();
});

// ==========================================
// 1.5 日付ナビゲーションのイベント
// ==========================================

btnPrevDay.addEventListener('click', () => {
  selectedDate.setDate(selectedDate.getDate() - 1);
  fetchTasks();
});

btnNextDay.addEventListener('click', () => {
  selectedDate.setDate(selectedDate.getDate() + 1);
  fetchTasks();
});

btnCalendar.addEventListener('click', () => {
  if (typeof (datePicker as any).showPicker === 'function') {
    (datePicker as any).showPicker();
  } else {
    datePicker.focus();
    datePicker.click();
  }
});

datePicker.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.value) {
    const [year, month, day] = target.value.split('-').map(Number);
    selectedDate = new Date(year, month - 1, day);
    fetchTasks();
  }
});

// ==========================================
// 2. タスク管理関連の処理
// ==========================================

async function fetchTasks() {
  if (!currentUser) return;

  updateDateDisplay();

  const { data: tasks, error } = await client
    .from('tasks')
    .select('*')
    .eq('scheduled_at', formatDate(selectedDate))
    .order('position', { ascending: true });

  if (error) return console.error('取得エラー:', error);
  
  currentTasks = tasks as Task[];
  taskList.innerHTML = '';

  currentTasks.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;

    let btnHtml = '';
    
    if (!task.start_time) {
      btnHtml = `<button class="task-btn start-btn" onclick="startTask('${task.id}')"><i class="fas fa-play"></i></button>`;
    } else if (!task.end_time) {
      btnHtml = `<button class="task-btn end-btn" onclick="endTask('${task.id}')"><i class="fas fa-stop"></i></button>`;
    } else {
      btnHtml = `
        <div class="task-btn-container">
          <button class="task-btn completed-btn"><i class="fas fa-check"></i></button>
          <button class="task-btn duplicate-btn" onclick="duplicateTask('${task.id}')"><i class="fas fa-rotate-left"></i></button>
        </div>
      `;
    }

    const startTimeVal = formatTimeForInput(task.start_time);
    const endTimeVal = formatTimeForInput(task.end_time);

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
    
    const titleInput = li.querySelector('.inline-edit-title') as HTMLInputElement;
    titleInput.value = task.title;
    titleInput.addEventListener('blur', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const newVal = target.value.trim();
      if (newVal !== task.title && newVal !== "") {
        updateTaskInline(task.id, { title: newVal });
      } else {
        target.value = task.title;
      }
    });
    titleInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    });

    const startInput = li.querySelector('.start-time-input') as HTMLInputElement;
    startInput.addEventListener('blur', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const val = target.value.trim();
      if (val === "") {
        if (task.start_time !== null) updateTaskInline(task.id, { start_time: null });
        return;
      }
      const iso = parseTimeInput(val, task.scheduled_at);
      if (!iso) {
        alert('時間の形式が正しくありません (例: 0123, 01:23, 01:23:45)');
        target.value = startTimeVal;
        return;
      }
      if (!task.start_time || new Date(iso).getTime() !== new Date(task.start_time).getTime()) {
        updateTaskInline(task.id, { start_time: iso });
      }
    });
    startInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    });

    const endInput = li.querySelector('.end-time-input') as HTMLInputElement;
    endInput.addEventListener('blur', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const val = target.value.trim();
      if (val === "") {
        if (task.end_time !== null) updateTaskInline(task.id, { end_time: null });
        return;
      }
      const iso = parseTimeInput(val, task.scheduled_at);
      if (!iso) {
        alert('時間の形式が正しくありません (例: 0123, 01:23, 01:23:45)');
        target.value = endTimeVal;
        return;
      }
      if (!task.end_time || new Date(iso).getTime() !== new Date(task.end_time).getTime()) {
        updateTaskInline(task.id, { end_time: iso });
      }
    });
    endInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    });

    taskList.appendChild(li);
  });
}

taskForm.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  const titleInput = document.getElementById('task-title') as HTMLInputElement;
  if (!titleInput.value.trim() || !currentUser) return;

  await client.from('tasks').insert([{
    title: titleInput.value.trim(),
    scheduled_at: formatDate(selectedDate)
  }]);
  
  titleInput.value = '';
  fetchTasks();
});

window.startTask = async (id: string) => {
  await client.from('tasks').update({ start_time: new Date().toISOString() }).eq('id', id);
  fetchTasks();
};

window.endTask = async (id: string) => {
  await client.from('tasks').update({ end_time: new Date().toISOString() }).eq('id', id);
  fetchTasks();
};

async function updateTaskInline(id: string, updates: Partial<Task>) {
  const { error } = await client.from('tasks').update(updates).eq('id', id);
  if (error) {
    console.error('更新エラー:', error);
    alert('更新に失敗しました');
  }
  fetchTasks();
}

window.duplicateTask = async (id: string) => {
  const task = currentTasks.find(t => t.id === id);
  if (!task) return;
  
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

const editModal = document.getElementById('edit-modal')!;
const editTaskForm = document.getElementById('edit-task-form')!;

window.openEditModal = (id: string) => {
  const task = currentTasks.find(t => t.id === id);
  if (!task) return;

  (document.getElementById('edit-id') as HTMLInputElement).value = task.id;
  (document.getElementById('edit-title') as HTMLInputElement).value = task.title;
  (document.getElementById('edit-scheduled-at') as HTMLInputElement).value = task.scheduled_at;
  (document.getElementById('edit-note') as HTMLTextAreaElement).value = task.note || '';
  (document.getElementById('edit-project-id') as HTMLInputElement).value = task.project_id || '';
  (document.getElementById('edit-mode-id') as HTMLInputElement).value = task.mode_id || '';
  (document.getElementById('edit-tag-ids') as HTMLInputElement).value = task.tag_ids || '';
  (document.getElementById('edit-routine-id') as HTMLInputElement).value = task.routine_id || '';

  document.getElementById('display-created-at')!.textContent = task.created_at ? new Date(task.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-';
  document.getElementById('display-updated-at')!.textContent = task.updated_at ? new Date(task.updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-';

  (editModal as HTMLElement).style.display = 'flex';
};

const closeEditModal = () => {
  (editModal as HTMLElement).style.display = 'none';
};
window.closeEditModal = closeEditModal;

editTaskForm.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  const id = (document.getElementById('edit-id') as HTMLInputElement).value;
  const updates = {
    title: (document.getElementById('edit-title') as HTMLInputElement).value.trim(),
    scheduled_at: (document.getElementById('edit-scheduled-at') as HTMLInputElement).value,
    note: (document.getElementById('edit-note') as HTMLTextAreaElement).value.trim() || null,
    project_id: (document.getElementById('edit-project-id') as HTMLInputElement).value.trim() || null,
    mode_id: (document.getElementById('edit-mode-id') as HTMLInputElement).value.trim() || null,
    tag_ids: (document.getElementById('edit-tag-ids') as HTMLInputElement).value.trim() || null,
    routine_id: (document.getElementById('edit-routine-id') as HTMLInputElement).value.trim() || null,
  };

  const { error } = await client.from('tasks').update(updates).eq('id', id);
  if (error) {
    alert('更新エラー: ' + error.message);
  } else {
    closeEditModal();
    fetchTasks();
  }
});

window.addEventListener('click', (e: MouseEvent) => {
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
    const items = [...taskList.children] as HTMLElement[];
    
    const updates = items.map((item, index) => {
      return client.from('tasks').update({ position: index }).eq('id', item.dataset.id);
    });
    
    await Promise.all(updates);
    fetchTasks();
  }
});
