# タスク管理アプリ (Task Management App)

Supabase（バックエンド）とGitHub Pages（フロントエンド）を利用して作成した、簡易的なタスク管理SPA（Single Page Application）です。
ビルド環境（Node.jsやWebpackなど）を必要とせず、HTML / CSS / Vanilla JavaScriptのみで構築されているため、軽量かつ簡単にデプロイ・拡張が可能です。

## 🚀 主な機能

* **ユーザー認証 (Supabase Auth)**
  * メールアドレスとパスワードによるサインアップ / ログイン
  * ログインユーザー専用のタスク一覧表示
* **日付ナビゲーション**
  * 画面上部の矢印ボタンやカレンダーアイコンを使用して、表示するタスクの日付を簡単に切り替えられます。
* **タスクのステータス管理とアクション**
  タスクの状態に応じてボタンが動的に変化します。
  1. **開始前** : 「▶ 開始」ボタン。クリックで現在時刻を開始時間として記録。
  2. **実行中** : 「◼ 終了」ボタン。クリックで現在時刻を終了時間として記録。
  3. **完了後** : チェックアイコンを表示。アイコンにホバーすると「📋 複製」ボタンが表示され、タスクを現在の選択日にコピー（再作成）できます。
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
  * HTML5 / CSS3 / Vanilla JavaScript
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
| `scheduled_at` | `date` | NOT NULL, `now()` | タスクの予定日 |
| `position` | `float8` | `extract(epoch from now())` | 並び替え順序を管理するための数値 |
| `note` | `text` | NULL | メモ（Markdown形式） |
| `user_id` | `uuid` | NOT NULL, REFERENCES `auth.users(id)`<br>デフォルト: `auth.uid()` | タスク作成者のユーザーID |
| `project_id` | `uuid` | NULL | 関連プロジェクトID |
| `mode_id` | `uuid` | NULL | モードID |
| `tag_ids` | `uuid` | NULL | タグID |
| `routine_id` | `uuid` | NULL | ルーチンID |
| `created_at` | `timestamptz` | `now()` | 作成日時 |
| `updated_at` | `timestamptz` | `now()` | 更新日時 |

### セキュリティ (Row Level Security: RLS)

フロントエンド環境（キーが公開される状態）での安全性を確保するため、RLSを有効化し、**「ログイン中のユーザーが、自身の作成したタスクのみを操作（CRUD）できる」** ように厳格なポリシーを設定しています。

---

## ⚙️ セットアップ手順 (Setup)

このリポジトリを自身の環境で動作させるための手順です。

### 1. Supabaseの準備
1. [Supabase](https://supabase.com/) で新規プロジェクトを作成します。
2. **SQL Editor** を開き、以下のSQLを実行してテーブルとRLSポリシーを作成します。

```sql
-- タスクテーブルの作成
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  scheduled_at DATE NOT NULL DEFAULT now(),
  position DOUBLE PRECISION DEFAULT extract(epoch from now()),
  note TEXT,
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  project_id UUID,
  mode_id UUID,
  tag_ids UUID,
  routine_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLSの有効化
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 自分自身のタスクのみ操作可能なポリシーを作成
CREATE POLICY "Users can manage their own tasks" 
ON tasks FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
```

3.  左側メニューの Authentication > Providers > Email を開き、Confirm email を OFF
    にして保存します（メール確認なしで即座にログインできるようにするため）。
4.  左側メニューの Project Settings > API から、Project URL と anon (public) key をコピーします。

2. フロントエンドの設定

1.  リポジトリをクローンまたはダウンロードします。
2.  app.js の1〜2行目にある定数を、先ほどコピーしたURLとキーに書き換えます。

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

3. ローカルでの動作確認とデプロイ

1.  index.html をブラウザで直接開くか、VS Codeの「Live Server」拡張機能などで起動し、動作を確認します。
2.  動作確認後、GitHubリポジトリ（PublicでOK）へプッシュします。
3.  リポジトリの Settings > Pages からデプロイ先を main ブランチに設定することで、GitHub
    Pagesとして全世界に公開されます。
