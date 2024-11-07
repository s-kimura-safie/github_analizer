## 環境構築
[こちら](https://www.notion.so/safie/Express-js-137b6aee49b980959e96fbb109c4d7a6?pvs=4#137b6aee49b9809294bddd532d112b9e)の手順を参考にnvm, node.js, npm, express.js をインストールしてください。

## npmパッケージのインストール
npm install cors

## pythonパッケージのインストール
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Github のTokenを更新
config_tmpl.pyをCopyしてconfig.pyを作成する。
github_token = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
に適切なTokenを設定する。

## 実行
```
node app.js
```

## TODO
- ~~python実行後にデータ更新~~
- ~~日付をボタンからPOST~~
- ~~Python の実行待ち時間だとわかるようにする機能追加~~
- ~~ボタンにホバーを付ける。~~
- ~~グラフを押したらその人の詳細情報が見れる画面に遷移する機能追加~~
- ~~PR詳細情報のUI改善~~
- ~~closeのPRは文字を薄くする？~~
  - ~~PRのOpenDayとCloseDayを追加~~
  - ~~リストを表形式にして見やすくする。~~
- ~~READMEに使用方法を記述する。~~
- リクエストされているPRを確認できるようにする。
