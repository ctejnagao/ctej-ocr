# ロール
あなたは Python (FastAPI/OpenCV) および JavaScript (フロントエンド) の開発に精通したシニアフルスタックエンジニアです。

# タスク
Webアプリケーション `ctej-ocr` において、画像スキャン（OCR解析）のレスポンス時間を短縮し、処理スピードを 2〜3 倍高速化するためのコード改修を行ってください。

# 課題と背景
現在、段ボールラベルや指示書の画像から OpenAI Vision API (`gpt-4o-mini`) を用いてテキストを抽出していますが、解析完了までに数秒以上の待ち時間が発生しています。

原因として以下が挙がっています：
1. `ocr_engine.py` の `parse_cardboard_multimodal` において、全体画像に加えてクロップ画像（最大3枚）を同時に OpenAI へ送信しているため、APIの処理時間が長くなっている。
2. Vision API 呼び出し時に `detail: "low"` が指定されておらず、不要な高精度トークン消費と画像変換時間がかかっている。
3. `static/app.js` 側での画像圧縮サイズ（現在 最大1200px）をさらに最適化する余地がある。

# 修正内容の要求

## 1. `ocr_engine.py` の修正
- `parse_cardboard_multimodal` 関数で、OpenAI API に送信する画像を **全体画像（`full_image_b64`）の1枚のみ** に絞り込んでください（クロップ画像の追加ロジックを削除）。
- APIリクエストの `image_url` オブジェクトに `"detail": "low"` を追加してください。
- `scan_instruction_image` および `scan_shipping_notice_image` 関数の OpenAI API リクエスト部においても、`image_url` オブジェクトに `"detail": "low"` を追加してください。

## 2. `static/app.js` の修正
- クライアント側での画像圧縮処理 `compressImage` 内の `max_size` を `1200` から `800` に変更し、画像送信サイズを軽量化してください。

# 制約条件
- 既存の JSON レスポンスフォーマット（`item_code`, `quantity`, `color` 等）やプロンプトのロジックは変更しないこと。
- 画像認識精度を落とさず、エラー処理やフォールバック（Mock処理）の動作を維持すること。

# 出力形式
1. 修正版 `app/ocr_engine.py` の全コード（または変更箇所の明確な差し替え指示）
2. 修正版 `static/app.js` の全コード（または変更箇所の明確な差し替え指示）