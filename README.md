# my-word-game

ブラウザで遊べる2人交代制の言葉当てゲームです。

## 遊び方

- ひらがな一文字を入力して、隠れた文字を当てます
- 答えが分かったら、単語を直接入力できます
- ミスするとプレイヤーが交代し、10回ミスするとゲームオーバーです
- ヒントは1ゲームにつき1回使えます
- 「音声」ボタンで、BGMと効果音をいつでもオン・オフできます

## 音声について

BGMと効果音は、`audio-engine.js`がWeb Audio APIでブラウザ内生成します。外部音源やローカルMP3ファイルは使用しません。

音声は最初の「決定」または「解答」操作後に開始し、ゲーム終了時または音声オフ時に停止します。ブラウザがWeb Audio APIへ対応していない場合も、ゲーム本体は無音で続行します。

スマートフォンでは、ラベル・入力欄・ボタンが画面幅に合わせて並び替わります。

## 確認

```bash
node --check audio-engine.js
node --check game_ver2.js
node tests/static-check.cjs
node tests/audio-engine.cjs
node tests/game-smoke.cjs
```

GitHub Actionsでは、JavaScript構文、欠落した音声ファイル参照がないこと、`audio-engine.js`がゲーム本体より先に読み込まれることに加え、音声の停止・ミュートと主要なゲーム進行を確認します。
