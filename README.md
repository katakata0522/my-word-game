# my-word-game

ブラウザで遊べる2人交代制の言葉当てゲームです。

## 音声について

BGMと効果音は、`audio-engine.js`がWeb Audio APIでブラウザ内生成します。外部音源やローカルMP3ファイルは使用しません。

音声は最初の「決定」または「解答」操作後に開始し、ゲーム終了時に停止します。ブラウザがWeb Audio APIへ対応していない場合も、ゲーム本体は無音で続行します。

## 確認

```bash
node --check audio-engine.js
node --check game_ver2.js
node tests/static-check.cjs
```

GitHub Actionsでは、JavaScript構文、欠落した音声ファイル参照がないこと、`audio-engine.js`がゲーム本体より先に読み込まれることを確認します。
