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

let currentTasks = [];
let currentUser = null;

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
// 2. タスク管理関連の処理
// ==========================================

// タスクの取得と描画
async function fetchTasks() {
  if (!currentUser) return; // 未ログイン時は実行しない

  const { data: tasks, error } = await client
    .from('tasks')
    .select('*')
    .order('position', { ascending: true }); // 並び順に取得

  if (error) return console.error('取得エラー:', error);
  
  currentTasks = tasks;
  taskList.innerHTML = '';

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.dataset.id = task.id;

    let iconClass, btnAction, timesText = '';
    
    // 要件に応じた状態判定
    if (!task.start_time) {
      iconClass = 'fa-play'; // 開始前：開始ボタン
      btnAction = `startTask('${task.id}')`;
    } else if (!task.end_time) {
      iconClass = 'fa-stop'; // 実行中：終了ボタン
      btnAction = `endTask('${task.id}')`;
      timesText = `開始: ${new Date(task.start_time).toLocaleTimeString()}`;
    } else {
      iconClass = 'fa-copy'; // 完了後：複製ボタン
      btnAction = `duplicateTask('${task.id}')`;
      timesText = `開始: ${new Date(task.start_time).toLocaleTimeString()} | 終了: ${new Date(task.end_time).toLocaleTimeString()}`;
    }

    // HTMLの構築
    li.innerHTML = `
      <button class="task-btn" onclick="${btnAction}"><i class="fas ${iconClass}"></i></button>
      <div class="task-content">
        <span class="task-title"></span>
        ${timesText ? `<span class="task-times">${timesText}</span>` : ''}
      </div>
    `;
    
    // XSS対策：タイトルはtextContentで安全に挿入
    li.querySelector('.task-title').textContent = task.title;
    taskList.appendChild(li);
  });
}

// フォームからタスク追加
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titleInput = document.getElementById('task-title');
  if (!titleInput.value.trim() || !currentUser) return;

  // ※ user_id はSupabase側（PostgreSQLのデフォルト値）で自動付与されます
  await client.from('tasks').insert([{ title: titleInput.value.trim() }]);
  
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

// 複製ボタンの処理
window.duplicateTask = async (id) => {
  const task = currentTasks.find(t => t.id === id);
  if (!task) return;
  
  // タイトルだけをコピーし、開始・終了時間は空（デフォルト）で追加
  await client.from('tasks').insert([{ title: task.title }]);
  fetchTasks();
};

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
