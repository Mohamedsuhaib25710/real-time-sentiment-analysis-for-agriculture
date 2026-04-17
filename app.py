# ============================================================
#  app.py  —  Flask Web Server
#  Agriculture Sentiment Analysis Platform
# ============================================================

import os
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from sentiment_engine import analyze_csv

app = Flask(__name__)

# --- Config ---
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'csv'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB max upload

# Create uploads dir if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check that the uploaded file is a .csv"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ----------------------------------------------------------
# ROUTES
# ----------------------------------------------------------

@app.route('/')
def index():
    """Serve the main web app page."""
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Accepts a CSV file upload, runs sentiment analysis,
    returns structured JSON result to the frontend.
    """
    # --- Validate file was sent ---
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded.'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False,
                        'error': 'Invalid file type. Please upload a .csv file.'}), 400

    # --- Save file temporarily ---
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    # --- Run analysis ---
    result = analyze_csv(filepath)

    # Attach the filename to the result for display
    result['filename'] = filename

    # Clean up uploaded file after analysis
    try:
        os.remove(filepath)
    except Exception:
        pass

    status_code = 200 if result.get('success') else 422
    return jsonify(result), status_code


# ----------------------------------------------------------
# RUN
# ----------------------------------------------------------
if __name__ == '__main__':
    print("=" * 55)
    print("  Agriculture Sentiment Analysis — Web Platform")
    print("  Open your browser: http://localhost:5000")
    print("=" * 55)
    app.run(debug=True, port=5000)
