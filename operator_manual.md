【プロジェクト要件】
スマホで撮影した画像（伝票および段ボール）を解析し、検品および「商い奉行」連携用データを作成するPython (FastAPI) + Webフロントアプリのソースコードを作成してください。

【ディレクトリ構造】
以下の構成で必要なコードファイルを作成・記述してください。
C:\AGI\ctej-ocr
├── requirements.txt
├── main.py
├── app/
│   ├── __init__.py
│   ├── ocr_engine.py
│   ├── matcher.py
│   └── csv_generator.py
└── static/
    ├── index.html
    └── app.js

【各ファイルの製造仕様】

1. `requirements.txt`
   - fastapi, uvicorn, opencv-python-headless, numpy, pillow, python-multipart, openai, google-cloud-vision を記述。

2. `app/ocr_engine.py`
   - OpenCV (HSV変換) を使い、画像内から赤色および緑色のマーカー塗り領域（Y座標の高さ範囲）を特定する関数を実装。
   - OpenAI Vision API (または Google Vision API) を呼び出す関数を実装。
   - 段ボール画像からマーカー領域に対応する「品番」と「数量」を読み取るロジック。
   - 手書き伝票画像（IMG_0735）から「商品名」と「数量」の配列を抽出するロジック。

3. `app/matcher.py`
   - 指示書（手書きまたは出荷案内書）のデータと、段ボールから読み取った現物データを突き合わせ、OK/NGの判定ロジックを実装。

4. `app/csv_generator.py`
   - 検品確定データを「商い奉行」のインポートフォーマット（Shift-JIS、カンマ区切りCSV）に変換して生成する処理を実装。

5. `main.py`
   - FastAPIのルーティングを構築。
   - エンドポイント:
     - POST `/api/scan/instruction` (手書き指示書解析)
     - POST `/api/scan/cardboard` (段ボール・マーカー検知＆OCR解析)
     - POST `/api/scan/shipping-notice` (出荷案内書解析)
     - POST `/api/export/csv` (商い奉行用CSV出力)
   - `static/` ディレクトリを StaticFiles としてマウント。

6. `static/index.html` & `static/app.js`
   - iPhone 13 (Safari) に最適化したレスポンシブなUI。
   - カメラ撮影 (`<input type="file" accept="image/*" capture="environment">`) 対応。
   - 画像送信前に JavaScript の Canvas を使用して長辺1200pxに圧縮・リサイズしてからAPIへ送信する処理。
   - 解析結果（品番・数量）を表示するカードUI、および照合一致時の「大画面グリーン＆完了ポップアップ」を実装。

上記仕様に沿って、各ファイルを完全に動作するコードとして作成してください。