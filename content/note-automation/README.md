# note Automation

FX Quest Guild の note メンバーシップ運用を、重複を避けながら半自動から自動投稿へ寄せるための作業領域です。

## 方針

- サイトから note へ: 既存の `NoteCTA` でメンバーシップへ誘導します。
- note からサイトへ: 生成される note 本文に、元QUEST記事・ホーム・メンバーシップ導線を入れます。
- 収益導線: 限定記事への参加導線と、必要な箇所にFXサービス確認導線を入れます。
- 重複防止: `posted-ledger.json` の `generated` と `posted` を見て、同じテーマを繰り返し作らないようにします。

## Commands

```sh
npm run note:generate
npm run note:post -- --file content/note-automation/drafts/<draft>.md
npm run note:publish -- --url https://note.com/<user>/n/<id>
```

`note:post` は note の公式APIではなく、ログイン済みブラウザでの投稿操作を自動化する入口です。note画面変更に弱いため、失敗した場合は生成済みMarkdownを貼り付けて使います。
