# ============================================================
#  sentiment_engine.py
#  Core NLP Analysis Engine — NLTK + TextBlob
#  Used by: app.py (Flask web server)
# ============================================================

import pandas as pd
from textblob import TextBlob
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import string
import warnings
warnings.filterwarnings('ignore')

# Download required NLTK data silently
nltk.download('punkt',                       quiet=True)
nltk.download('punkt_tab',                  quiet=True)
nltk.download('stopwords',                  quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('vader_lexicon',              quiet=True)

from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Initialize VADER and inject agricultural domain-specific intelligence!
vader_analyzer = SentimentIntensityAnalyzer()
custom_agri_lexicon = {
    'thriving': 2.5, 'yield': 2.0, 'germinate': 1.5, 'pest-free': 2.5, 'fertile': 2.0, 'bloom': 1.5, 
    'harvest': 1.5, 'lush': 2.0, 'bountiful': 2.5, 'flourishing': 2.5, 'healthy': 2.0,
    'burned': -2.5, 'wilt': -2.0, 'wilted': -2.0, 'died': -3.0, 'rot': -2.5, 'pest': -1.5, 'pests': -1.5, 
    'barren': -2.0, 'failed': -2.5, 'bugs': -1.5, 'infestation': -2.5, 'drought': -2.0, 'weeds': -1.0,
    'shriveled': -2.0, 'toxic': -3.0
}
vader_analyzer.lexicon.update(custom_agri_lexicon)


# ----------------------------------------------------------
# SMART COLUMN DETECTION
# Detects which column in the CSV contains review text
# ----------------------------------------------------------
REVIEW_KEYWORDS = ['review', 'feedback', 'comment', 'text',
                   'description', 'opinion', 'remarks', 'notes']

def detect_review_column(columns):
    """
    Searches column names for known review-related keywords.
    Returns the matched column name, or None if not found.
    """
    cols_lower = {c.lower(): c for c in columns}
    for keyword in REVIEW_KEYWORDS:
        if keyword in cols_lower:
            return cols_lower[keyword]
    return None


def detect_product_column(columns):
    """Detects a product/item name column."""
    PRODUCT_KEYWORDS = ['product', 'item', 'name', 'title', 'crop',
                        'goods', 'service']
    cols_lower = {c.lower(): c for c in columns}
    for keyword in PRODUCT_KEYWORDS:
        if keyword in cols_lower:
            return cols_lower[keyword]
    return None


def detect_category_column(columns):
    """Detects a category column."""
    CAT_KEYWORDS = ['category', 'type', 'group', 'class', 'tag', 'sector']
    cols_lower = {c.lower(): c for c in columns}
    for keyword in CAT_KEYWORDS:
        if keyword in cols_lower:
            return cols_lower[keyword]
    return None


# ----------------------------------------------------------
# TEXT CLEANING
# ----------------------------------------------------------
def clean_text(text):
    """
    Preprocesses review text (for topic modeling or word clouds).
    Keeps negation words to preserve context!
    """
    text = str(text).lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    words = word_tokenize(text)
    
    # Base stopwords but exclude negations
    stop_words = set(stopwords.words('english'))
    negations = {'not', 'no', 'nor', 'against', 'aren', "aren't", 'couldn', "couldn't", 'didn', 
                 "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', 
                 "haven't", 'isn', "isn't", 'mightn', "mightn't", 'mustn', "mustn't", 'needn', 
                 "needn't", 'shan', "shan't", 'shouldn', "shouldn't", 'wasn', "wasn't", 
                 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't"}
    
    stop_words = stop_words - negations
    
    filtered = [w for w in words if w not in stop_words]
    return ' '.join(filtered)


# ----------------------------------------------------------
# SENTIMENT CLASSIFICATION
# ----------------------------------------------------------
def classify_sentiment(polarity):
    """Maps a TextBlob polarity float to a sentiment label."""
    if polarity > 0.1:
        return 'Positive'
    elif polarity < -0.1:
        return 'Negative'
    else:
        return 'Neutral'


# ----------------------------------------------------------
# MAIN ANALYSIS FUNCTION
# ----------------------------------------------------------
def analyze_csv(filepath):
    """
    Reads a CSV file, detects columns, runs NLP analysis, and
    returns a structured dict ready for JSON serialization.

    Returns:
        dict with keys:
          - success (bool)
          - error (str, only if success=False)
          - total, summary, percentages, category_breakdown,
            polarity_distribution, reviews, columns_used
    """
    try:
        df = pd.read_csv(filepath)
    except Exception as e:
        return {'success': False, 'error': f'Could not read CSV: {str(e)}'}

    # --- Detect columns ---
    review_col   = detect_review_column(df.columns.tolist())
    product_col  = detect_product_column(df.columns.tolist())
    category_col = detect_category_column(df.columns.tolist())

    if review_col is None:
        return {
            'success': False,
            'error': (
                'No review/feedback column found. '
                'Please ensure your CSV has a column named: '
                + ', '.join(REVIEW_KEYWORDS)
            )
        }

    # Drop rows with empty reviews
    df = df.dropna(subset=[review_col]).reset_index(drop=True)

    if len(df) == 0:
        return {'success': False, 'error': 'The review column is empty.'}

    # --- Fill optional columns with defaults if missing ---
    if product_col is None:
        df['_product'] = [f'Item {i+1}' for i in range(len(df))]
        product_col = '_product'
    if category_col is None:
        df['_category'] = 'general'
        category_col = '_category'

    # Add id if not present
    if 'id' not in [c.lower() for c in df.columns]:
        df.insert(0, 'id', range(1, len(df) + 1))
        id_col = 'id'
    else:
        id_col = [c for c in df.columns if c.lower() == 'id'][0]

    # --- NLP pipeline ---
    df['_cleaned']     = df[review_col].apply(clean_text)
    
    # We pass the RAW review text to VADER and TextBlob to ensure punctuation intensity ("!!!")
    # and grammar structures are perfectly understood by their respective pattern analyzers.
    df['_polarity']    = df[review_col].apply(
                            lambda t: round(vader_analyzer.polarity_scores(str(t))['compound'], 3))
    df['_subjectivity']= df[review_col].apply(
                            lambda t: round(TextBlob(str(t)).sentiment.subjectivity, 3))
    
    df['_sentiment']   = df['_polarity'].apply(classify_sentiment)

    # --- Summary counts ---
    counts = df['_sentiment'].value_counts()
    total  = len(df)
    summary = {
        'Positive': int(counts.get('Positive', 0)),
        'Negative': int(counts.get('Negative', 0)),
        'Neutral':  int(counts.get('Neutral',  0)),
    }
    percentages = {
        k: round(v / total * 100, 1) for k, v in summary.items()
    }

    # --- Category-wise breakdown ---
    cat_group = df.groupby([df[category_col].str.lower(),
                            '_sentiment']).size().unstack(fill_value=0)
    category_breakdown = {}
    for cat in cat_group.index:
        category_breakdown[cat] = {
            'Positive': int(cat_group.loc[cat].get('Positive', 0)),
            'Negative': int(cat_group.loc[cat].get('Negative', 0)),
            'Neutral':  int(cat_group.loc[cat].get('Neutral',  0)),
        }

    # --- Polarity distribution buckets (for histogram) ---
    bins   = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.01]
    labels = ['Very Negative', 'Negative', 'Neutral', 'Positive', 'Very Positive']
    df['_bucket'] = pd.cut(df['_polarity'], bins=bins, labels=labels, right=False)
    polarity_dist = df['_bucket'].value_counts().reindex(labels, fill_value=0).to_dict()
    polarity_dist = {k: int(v) for k, v in polarity_dist.items()}

    # --- Per-review rows ---
    reviews = []
    for _, row in df.iterrows():
        reviews.append({
            'id':           int(row[id_col]),
            'product':      str(row[product_col]),
            'review':       str(row[review_col]),
            'category':     str(row[category_col]).lower(),
            'polarity':     float(row['_polarity']),
            'subjectivity': float(row['_subjectivity']),
            'sentiment':    str(row['_sentiment']),
        })

    return {
        'success':            True,
        'total':              total,
        'summary':            summary,
        'percentages':        percentages,
        'category_breakdown': category_breakdown,
        'polarity_distribution': polarity_dist,
        'reviews':            reviews,
        'columns_used': {
            'review':   review_col,
            'product':  product_col,
            'category': category_col,
        }
    }
