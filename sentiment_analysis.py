# ============================================================
#  Real-Time Sentiment Analysis for Agriculture
#  Tools : Python | NLTK | TextBlob | Pandas | Matplotlib
#  Author: [Your Name]
#  Date  : April 2026
# ============================================================

# ----------------------------------------------------------
# STEP 1: Import all libraries
# ----------------------------------------------------------
import pandas as pd                        # Read & manage CSV data
from textblob import TextBlob              # Sentiment analysis engine
import matplotlib.pyplot as plt            # Draw bar charts
import matplotlib.patches as mpatches     # Custom chart legend
import nltk                                # Natural Language Toolkit
from nltk.corpus import stopwords          # Common filler words to ignore
from nltk.tokenize import word_tokenize   # Split sentences into words
import string                              # Punctuation characters
import warnings
warnings.filterwarnings('ignore')

# ----------------------------------------------------------
# STEP 2: Download required NLTK data (runs once)
# ----------------------------------------------------------
print("Checking NLTK data packages...")
nltk.download('punkt',                    quiet=True)
nltk.download('punkt_tab',               quiet=True)
nltk.download('stopwords',               quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
print("NLTK data ready.\n")

# ----------------------------------------------------------
# STEP 3: Load the CSV file using Pandas
# ----------------------------------------------------------
# pd.read_csv() reads the file and stores it as a DataFrame
# A DataFrame is like a table — rows and columns, just like Excel

df = pd.read_csv('agriculture_reviews.csv')

print("=" * 62)
print("   REAL-TIME SENTIMENT ANALYSIS FOR AGRICULTURE")
print("=" * 62)
print(f"\n[+] Loaded {len(df)} reviews from agriculture_reviews.csv\n")
print("--- Preview of Data (first 5 rows) ---")
print(df[['id', 'product', 'review']].head().to_string(index=False))
print()

# ----------------------------------------------------------
# STEP 4: Clean the text before analysis
# ----------------------------------------------------------
# Raw text has noise: punctuation, capital letters, filler words
# We remove all of that so TextBlob can work more accurately

def clean_text(text):
    """
    Cleans a single review string:
      1) Lowercase everything
      2) Remove punctuation (! . , ? etc.)
      3) Split into individual words (tokenize)
      4) Remove stopwords like 'the', 'is', 'a', 'and'
      5) Rejoin cleaned words into a sentence
    """
    # 1. Lowercase
    text = text.lower()

    # 2. Remove punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))

    # 3. Split into words
    words = word_tokenize(text)

    # 4. Remove stopwords
    stop_words = set(stopwords.words('english'))
    filtered_words = [word for word in words if word not in stop_words]

    # 5. Rejoin
    return ' '.join(filtered_words)


# Apply clean_text() to every row in the 'review' column
# .apply() runs the function on each cell automatically
df['cleaned_review'] = df['review'].apply(clean_text)

print("[+] Text cleaning complete.")

# ----------------------------------------------------------
# STEP 5: Sentiment Analysis using TextBlob
# ----------------------------------------------------------
# TextBlob gives us two numbers for every sentence:
#   - polarity    : -1.0 (very negative) to +1.0 (very positive)
#   - subjectivity: 0.0 (factual) to 1.0 (very opinionated)
#
# We use polarity to decide: Positive / Negative / Neutral

def get_sentiment(text):
    """
    Returns the sentiment label for a piece of text.
    Thresholds:
      polarity >  0.1  --> Positive
      polarity < -0.1  --> Negative
      otherwise        --> Neutral
    """
    polarity = TextBlob(text).sentiment.polarity
    if polarity > 0.1:
        return 'Positive'
    elif polarity < -0.1:
        return 'Negative'
    else:
        return 'Neutral'


def get_polarity(text):
    """Returns the raw polarity score (float between -1 and +1)"""
    return round(TextBlob(text).sentiment.polarity, 3)


def get_subjectivity(text):
    """Returns how subjective the text is (0 = fact, 1 = opinion)"""
    return round(TextBlob(text).sentiment.subjectivity, 3)


# Apply all three functions to the cleaned review column
df['polarity']     = df['cleaned_review'].apply(get_polarity)
df['subjectivity'] = df['cleaned_review'].apply(get_subjectivity)
df['sentiment']    = df['cleaned_review'].apply(get_sentiment)

print("[+] Sentiment analysis complete.\n")

# ----------------------------------------------------------
# STEP 6: Display Results in Terminal
# ----------------------------------------------------------

print("=" * 62)
print("   ANALYSIS RESULTS — EACH REVIEW")
print("=" * 62)

# Label map for terminal output (emoji removed for Windows cp1252 compatibility)
label_map = {'Positive': '[POS]', 'Negative': '[NEG]', 'Neutral': '[NEU]'}

for _, row in df.iterrows():
    label = label_map[row['sentiment']]
    # Trim long reviews to 55 characters for clean display
    short_review = row['review'][:55] + '...' if len(row['review']) > 55 else row['review']
    print(f"\n  [{row['id']:02d}] {row['product']}")
    print(f"       Review    : {short_review}")
    print(f"       Polarity  : {row['polarity']:+.3f}  |  "
          f"Subjectivity: {row['subjectivity']:.3f}  |  "
          f"Sentiment: {label} {row['sentiment']}")

# ----------------------------------------------------------
# STEP 7: Summary Count
# ----------------------------------------------------------

counts = df['sentiment'].value_counts()
positive_count = counts.get('Positive', 0)
negative_count = counts.get('Negative', 0)
neutral_count  = counts.get('Neutral',  0)
total          = len(df)

print("\n" + "=" * 62)
print("   OVERALL SUMMARY")
print("=" * 62)
print(f"  Total Reviews Analyzed : {total}")
print(f"  [POS] Positive         : {positive_count}  ({positive_count/total*100:.1f}%)")
print(f"  [NEG] Negative         : {negative_count}  ({negative_count/total*100:.1f}%)")
print(f"  [NEU] Neutral          : {neutral_count}  ({neutral_count/total*100:.1f}%)")
print("=" * 62)

# Category-wise breakdown
print("\n--- Category-wise Sentiment Breakdown ---")
category_sentiment = df.groupby(['category', 'sentiment']).size().unstack(fill_value=0)
print(category_sentiment.to_string())

# ----------------------------------------------------------
# STEP 8: Generate Bar Chart
# ----------------------------------------------------------
# Matplotlib is used to draw the bar chart
# We will create a clean, color-coded chart

print("\n[+] Generating sentiment bar chart...")

# Data to plot
categories  = ['Positive', 'Negative', 'Neutral']
values      = [positive_count, negative_count, neutral_count]
bar_colors  = ['#4CAF50', '#F44336', '#FF9800']   # Green, Red, Orange

# Create the figure and axes
fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.patch.set_facecolor('#1a1a2e')   # Dark background for the figure

# ---- Chart 1: Main Sentiment Bar Chart ----
ax1 = axes[0]
ax1.set_facecolor('#16213e')

bars = ax1.bar(categories, values, color=bar_colors, width=0.5,
               edgecolor='white', linewidth=0.8)

# Add count labels on top of each bar
for bar, val in zip(bars, values):
    ax1.text(
        bar.get_x() + bar.get_width() / 2,   # X centre of bar
        bar.get_height() + 0.15,              # Slightly above bar
        str(val),                             # Label text
        ha='center', va='bottom',
        fontsize=15, fontweight='bold', color='white'
    )

ax1.set_title('Agriculture Review Sentiment', fontsize=15,
              fontweight='bold', color='white', pad=15)
ax1.set_xlabel('Sentiment Category', fontsize=12, color='#cccccc')
ax1.set_ylabel('Number of Reviews', fontsize=12, color='#cccccc')
ax1.set_ylim(0, max(values) + 3)
ax1.tick_params(colors='white')
ax1.spines['bottom'].set_color('#555555')
ax1.spines['left'].set_color('#555555')
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.grid(axis='y', linestyle='--', alpha=0.3, color='white')

# ---- Chart 2: Pie Chart (Percentage Breakdown) ----
ax2 = axes[1]
ax2.set_facecolor('#16213e')

wedge_colors  = ['#4CAF50', '#F44336', '#FF9800']
explode       = (0.05, 0.05, 0.05)   # Slightly separate each slice

wedges, texts, autotexts = ax2.pie(
    values,
    labels      = categories,
    colors      = wedge_colors,
    autopct     = '%1.1f%%',
    startangle  = 140,
    explode     = explode,
    wedgeprops  = dict(edgecolor='white', linewidth=1.2)
)

# Style the pie labels
for text in texts:
    text.set_color('white')
    text.set_fontsize(12)
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontweight('bold')

ax2.set_title('Sentiment Distribution (%)', fontsize=15,
              fontweight='bold', color='white', pad=15)

# Figure subtitle
fig.suptitle('Real-Time Sentiment Analysis for Agriculture',
             fontsize=17, fontweight='bold', color='#00d4ff', y=1.01)
fig.text(0.5, -0.02,
         f'Total Reviews: {total}   |   Analyzed using Python | NLTK | TextBlob',
         ha='center', fontsize=10, color='#aaaaaa')

plt.tight_layout()

# Save the chart as a PNG image
plt.savefig('sentiment_chart.png', dpi=150, bbox_inches='tight',
            facecolor=fig.get_facecolor())

print("[+] Chart saved as 'sentiment_chart.png'")

plt.show()

print("\n[DONE] Sentiment analysis complete!")
print("Files in your project folder:")
print("  agriculture_reviews.csv  <- your data")
print("  sentiment_analysis.py    <- your script")
print("  sentiment_chart.png      <- your output chart")
