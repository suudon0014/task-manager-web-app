# タスク管理アプリ (Task Management App)

Supabase（バックエンド）と GitHub Pages（フロントエンド）を利用して作成した、タスク管理SPA（Single Page Application）です。
Vite と TypeScript を使用して構築されており、型安全で高速な開発・ビルドが可能です。

## 🚀 主な機能

* **ユーザー認証 (Supabase Auth)**
  * メールアドレスとパスワードによるサインアップ / ログイン
  * ログインユーザー専用のタスク一覧表示
* **日付ナビゲーション**
  * 画面上部の矢印ボタンやカレンダーアイコンを使用して、表示するタスクの日付を簡単に切り替えられます。
* **タスクのステータス管理とアクション**
  タスクの状態に応じてボタンが動的に変化します。
  1. **開始前** : 再生アイコン（<i class="fas fa-play"></i>）。クリックで現在時刻を開始時間として記録。
  2. **実行中** : 停止アイコン（<i class="fas fa-stop"></i>）。クリックで現在時刻を終了時間として記録。
  3. **完了後** : チェックアイコン（<i class="fas fa-check"></i>）を表示。アイコンにホバーすると複製アイコン（<i class="fas fa-rotate-left"></i>）が表示され、クリックするとタスクを現在の選択日に複製（再作成）できます。
* **インライン編集**
  * タスク一覧上で、タスク名および開始・終了時間を直接編集し、即座に保存できます。
* **詳細編集モーダル**
  * タスク右側の編集ボタンからモーダルを開き、予定日、メモ（Markdown対応）、各種UUID（Project, Mode, Tag, Routine）を詳細に設定できます。
* **直感的な並び替え**
  * ドラッグ＆ドロップでタスクの順序を自由に変更可能（SortableJSを使用）。順序はデータベースに保存されます。

## 💡 便利な機能

* **柔軟な時間入力**
  * 時間の入力フィールドは、`0900` (HHmm)、`090000` (HHmmss) のような数字のみの入力や、コロンを省略した形式にも対応しており、自動的に適切なフォーマットに補完されます。
* **日本時間 (JST) への対応**
  * サーバー（Supabase）側ではUTCで保存されますが、アプリ内での表示・入力はすべて日本時間（Asia/Tokyo）として処理されます。

## 🛠 使用技術 (Tech Stack)

* **フロントエンド**
  * [TypeScript](https://www.typescriptlang.org/)
  * [Vite](https://ja.vite.dev/) (ビルドツール)
  * HTML5 / CSS3
  * [SortableJS](https://sortablejs.github.io/Sortable/) (ドラッグ＆ドロップ機能)
  * [FontAwesome](https://fontawesome.com/) (アイコン)
* **バックエンド (BaaS)**
  * [Supabase](https://supabase.com/) (PostgreSQL, Authentication)
* **ホスティング**
  * GitHub Pages (Public Repository)

---

## 🗄 データベース構造 (Database Schema)

Supabase上のPostgreSQLを使用します。

### テーブル定義: `tasks`

ユーザーごとのタスク情報を格納するテーブルです。

| カラム名 | データ型 | 制約・デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PRIMARY KEY, `gen_random_uuid()` | タスクを一意に識別するID |
| `title` | `text` | NOT NULL | タスク名 |
| `start_time` | `timestamptz` | NULL | タスクの開始日時 |
| `end_time` | `timestamptz` | NULL | タスクの終了日時 |
| `scheduled_at` | `date` | NULL, DEFAULT `now()` | タスクの予定日 |
| `position` | `float8` | NULL, DEFAULT `extract(epoch from now())` | 並び替え順序を管理するための数値 |
| `note` | `text` | NULL | メモ（Markdown形式） |
| `user_id` | `uuid` | NOT NULL, REFERENCES `auth.users(id)`<br>デフォルト: `auth.uid()` | タスク作成者のユーザーID |
| `project_id` | `uuid` | NULL, REFERENCES `projects(id)` | 関連プロジェクトID |
| `mode_id` | `uuid` | NULL, REFERENCES `modes(id)` | モードID |
| `tag_ids` | `text` | NULL | タグID（※現在は簡易的にUUID文字列を保持） |
| `routine_id` | `uuid` | NULL, REFERENCES `routines(id)` | ルーチンID |
| `created_at` | `timestamptz` | NULL, DEFAULT `now()` | 作成日時 |
| `updated_at` | `timestamptz` | NULL, DEFAULT `now()` | 更新日時 |

### その他のテーブル

タスクに紐付くメタ情報や関連データを管理するテーブル群です。

- **`projects`**: プロジェクト情報を管理
- **`modes`**: 作業モード（例：集中、休憩）を管理
- **`tags`**: タグ情報を管理
- **`routines`**: ルーチンタスクのテンプレート情報を管理
- **`tasks_tags`**: タスクとタグの中間テーブル（多対多の関連付け用）

### セキュリティ (Row Level Security: RLS)

フロントエンド環境（キーが公開される状態）での安全性を確保するため、RLSを有効化し、**「ログイン中のユーザーが、自身の作成したタスクのみを操作（CRUD）できる」** ように厳格なポリシーを設定しています。

---

## ⚙️ セットアップ手順 (Setup)

このリポジトリを自身の環境で動作させるための手順です。

### 1. Supabaseの準備
1. [Supabase](https://supabase.com/) で新規プロジェクトを作成します。
2. **SQL Editor** を開き、以下のSQLを実行してテーブルとRLSポリシーを作成します。

```sql
-- 1. 関連テーブルの作成
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE modes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. タスクテーブルの作成
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  scheduled_at DATE DEFAULT now(),
  position DOUBLE PRECISION DEFAULT extract(epoch from now()),
  note TEXT,
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  project_id UUID REFERENCES projects(id),
  mode_id UUID REFERENCES modes(id),
  tag_ids TEXT, -- 簡易的な複数タグ保持用（拡張用）
  routine_id UUID REFERENCES routines(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 中間テーブル（タスクとタグの多対多用）
CREATE TABLE tasks_tags (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (task_id, tag_id)
);

-- 4. RLS (Row Level Security) の設定
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks" 
ON tasks FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- ※ 他のテーブル（projects, modes等）も必要に応じてポリシーを設定してください。
```

3.  左側メニューの Authentication > Providers > Email を開き、Confirm email を OFF
    にして保存します（メール確認なしで即座にログインできるようにするため）。
4.  左側メニューの Project Settings > API から、Project URL と anon (public) key をコピーします。

### 2. フロントエンドの設定

1.  リポジトリをクローンまたはダウンロードします。
2.  `src/app.ts` の1〜2行目にある定数を、先ほどコピーしたURLとキーに書き換えます。

```typescript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. ローカルでの動作確認とデプロイ

1.  依存関係をインストールします。
    ```bash
    npm install
    ```
2.  ローカル開発サーバーを起動します。
    ```bash
    npm run dev
    ```
3.  `http://localhost:5173` (デフォルト) にアクセスして動作を確認します。
4.  ビルドを行う場合は以下のコマンドを実行します。
    ```bash
    npm run build
    ```
    `dist` ディレクトリに公開用ファイルが生成されます。
