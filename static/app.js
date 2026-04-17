// ============================================================
//  app.js  —  CropIntel Frontend Logic
//  Chart.js + Vanilla JS
// ============================================================

'use strict';

// ---------- DOM References ----------
const uploadSection  = document.getElementById('upload-section');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');

const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const browseBtn      = document.getElementById('browse-btn');
const filePreview    = document.getElementById('file-preview');
const fileNameDisplay= document.getElementById('file-name-display');
const analyzeBtn     = document.getElementById('analyze-btn');
const clearBtn       = document.getElementById('clear-btn');
const resetBtn       = document.getElementById('reset-btn');
const pdfBtn         = document.getElementById('pdf-btn');

const errorToast     = document.getElementById('error-toast');
const toastMsg       = document.getElementById('toast-msg');
const toastClose     = document.getElementById('toast-close');

const tableBody      = document.getElementById('table-body');
const filterBtns     = document.querySelectorAll('.filter-btn');

// Active Chart.js instances (stored so we can destroy before re-drawing)
let charts = {};

// Full reviews data for table filtering
let allReviews = [];


// ============================================================
//  SECTION SWITCHING
// ============================================================
function showSection(name) {
  uploadSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  resultsSection.classList.add('hidden');

  uploadSection.classList.remove('active');
  loadingSection.classList.remove('active');
  resultsSection.classList.remove('active');

  const target = document.getElementById(`${name}-section`);
  target.classList.remove('hidden');
  target.classList.add('active');
}


// ============================================================
//  FILE HANDLING
// ============================================================
browseBtn.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('click', (e) => {
  if (e.target !== browseBtn) fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
});

// Drag and Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});

function handleFileSelect(file) {
  if (!file.name.endsWith('.csv')) {
    showToast('Please upload a .csv file only.');
    return;
  }
  fileNameDisplay.textContent = file.name;
  filePreview.classList.remove('hidden');
  analyzeBtn.onclick = () => uploadAndAnalyze(file);
}

clearBtn.addEventListener('click', () => {
  fileInput.value = '';
  filePreview.classList.add('hidden');
});

resetBtn.addEventListener('click', () => {
  fileInput.value = '';
  filePreview.classList.add('hidden');
  destroyAllCharts();
  showSection('upload');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

pdfBtn.addEventListener('click', () => {
  if (!allReviews || allReviews.length === 0) return;

  const originalText = pdfBtn.textContent;
  pdfBtn.textContent = '⏳ Generating Report...';
  pdfBtn.disabled = true;

  // 1. Calculate Insights (Top and Bottom products by polarity)
  const sortedReviews = [...allReviews].sort((a, b) => b.polarity - a.polarity);
  const topPos = sortedReviews.slice(0, 5).filter(r => r.polarity > 0);
  const topNeg = sortedReviews.slice().reverse().slice(0, 5).filter(r => r.polarity < 0);

  // 2. Build a clean, white-background HTML report structure
  const reportDiv = document.createElement('div');
  reportDiv.style.padding = '40px';
  reportDiv.style.fontFamily = 'Helvetica, Arial, sans-serif';
  reportDiv.style.color = '#333';
  reportDiv.style.background = '#fff';

  let reportHtml = `
    <div style="text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px;">
      <h1 style="color: #4CAF50; margin: 0;">CropIntel Sentiment Report</h1>
      <p style="margin: 5px 0 0; color: #666;">Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div style="margin-bottom: 30px;">
      <h2 style="font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Overall Summary</h2>
      <ul style="list-style: none; padding: 0; font-size: 16px; line-height: 1.8;">
        <li><strong>Total Reviews Analyzed:</strong> ${allReviews.length}</li>
        <li><strong style="color: #4CAF50;">Positive Reviews:</strong> ${document.getElementById('kpi-positive').textContent}</li>
        <li><strong style="color: #F44336;">Negative Reviews:</strong> ${document.getElementById('kpi-negative').textContent}</li>
        <li><strong style="color: #FF9800;">Neutral Reviews:</strong> ${document.getElementById('kpi-neutral').textContent}</li>
      </ul>
    </div>

    <div style="margin-bottom: 30px;">
      <h2 style="font-size: 18px; color: #4CAF50; border-bottom: 1px solid #ccc; padding-bottom: 5px;">🏆 Top Highly Rated Products</h2>
      <ul style="padding-left: 20px; line-height: 1.6;">
        ${topPos.map(r => `<li><strong>${escHtml(r.product)}</strong> (Polarity: +${r.polarity.toFixed(2)}) — <em>"${escHtml(r.review)}"</em></li>`).join('')}
        ${topPos.length === 0 ? '<li>No positive highly rated products found.</li>' : ''}
      </ul>
    </div>

    <div>
      <h2 style="font-size: 18px; color: #F44336; border-bottom: 1px solid #ccc; padding-bottom: 5px;">⚠️ Critical Negative Feedback</h2>
      <ul style="padding-left: 20px; line-height: 1.6;">
        ${topNeg.map(r => `<li><strong>${escHtml(r.product)}</strong> (Polarity: ${r.polarity.toFixed(2)}) — <em>"${escHtml(r.review)}"</em></li>`).join('')}
        ${topNeg.length === 0 ? '<li>No severe negative feedback found.</li>' : ''}
      </ul>
    </div>
  `;

  reportDiv.innerHTML = reportHtml;

  // 3. Convert to PDF
  const opt = {
    margin:       15,
    filename:     `CropIntel_Report_${new Date().getTime()}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(reportDiv).save().then(() => {
    pdfBtn.textContent = originalText;
    pdfBtn.disabled = false;
  });
});


// ============================================================
//  UPLOAD & ANALYZE
// ============================================================
async function uploadAndAnalyze(file) {
  showSection('loading');
  startLoaderAnimation();

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/analyze', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!data.success) {
      showSection('upload');
      showToast(data.error || 'Analysis failed. Please check your CSV file.');
      return;
    }

    renderDashboard(data, file.name);

  } catch (err) {
    showSection('upload');
    showToast('Server error. Make sure app.py is running on port 5000.');
  }
}


// ============================================================
//  LOADER ANIMATION
// ============================================================
const loaderSteps = ['lstep-1','lstep-2','lstep-3','lstep-4'];
let loaderTimer = null;

function startLoaderAnimation() {
  loaderSteps.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
  });
  document.getElementById('loader-bar').style.width = '0%';

  let step = 0;
  const percents = [15, 40, 70, 95];

  loaderTimer = setInterval(() => {
    if (step > 0) {
      document.getElementById(loaderSteps[step - 1]).classList.remove('active');
      document.getElementById(loaderSteps[step - 1]).classList.add('done');
    }
    if (step < loaderSteps.length) {
      document.getElementById(loaderSteps[step]).classList.add('active');
      document.getElementById('loader-bar').style.width = percents[step] + '%';
      step++;
    } else {
      clearInterval(loaderTimer);
    }
  }, 600);
}


// ============================================================
//  RENDER FULL DASHBOARD
// ============================================================
function renderDashboard(data, filename) {
  // Finish loader bar
  clearInterval(loaderTimer);
  loaderSteps.forEach(id => {
    document.getElementById(id).classList.remove('active');
    document.getElementById(id).classList.add('done');
  });
  document.getElementById('loader-bar').style.width = '100%';

  setTimeout(() => {
    showSection('results');

    // --- Top bar ---
    document.getElementById('res-filename').textContent = '📄 ' + filename;
    document.getElementById('res-total').textContent = data.total + ' Reviews Analyzed';

    // --- KPI Cards ---
    animateCount('kpi-positive', data.summary.Positive);
    animateCount('kpi-negative', data.summary.Negative);
    animateCount('kpi-neutral',  data.summary.Neutral);
    animateCount('kpi-total',    data.total);

    document.getElementById('kpi-positive-pct').textContent = data.percentages.Positive + '%';
    document.getElementById('kpi-negative-pct').textContent = data.percentages.Negative + '%';
    document.getElementById('kpi-neutral-pct').textContent  = data.percentages.Neutral  + '%';

    // --- Charts ---
    destroyAllCharts();
    renderBarChart(data);
    renderDoughnutChart(data);
    renderPolarityChart(data);
    renderCategoryChart(data);
    renderHistogramChart(data);
    renderScatterChart(data);

    // --- Table ---
    allReviews = data.reviews;
    renderTable(allReviews);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 400);
}


// ============================================================
//  CHART.JS — CHART RENDERERS
// ============================================================
const COLORS = {
  Positive: '#4CAF50',
  Negative: '#F44336',
  Neutral:  '#FF9800',
};

const CHART_DEFAULTS = {
  color: '#8b949e',
  font: { family: 'Inter', size: 12 },
};

Chart.defaults.color = CHART_DEFAULTS.color;
Chart.defaults.font  = CHART_DEFAULTS.font;


// --- Chart 1: Vertical Bar (Sentiment Overview) ---
function renderBarChart(data) {
  const ctx = document.getElementById('chart-bar').getContext('2d');
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{
        label: 'Reviews',
        data: [data.summary.Positive, data.summary.Negative, data.summary.Neutral],
        backgroundColor: [
          'rgba(76,175,80,0.8)',
          'rgba(244,67,54,0.8)',
          'rgba(255,152,0,0.8)',
        ],
        borderColor: [COLORS.Positive, COLORS.Negative, COLORS.Neutral],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw} reviews (${data.percentages[ctx.label]}%)`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b949e' },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b949e', stepSize: 1 },
          beginAtZero: true,
        }
      }
    }
  });
}


// --- Chart 2: Doughnut ---
function renderDoughnutChart(data) {
  const ctx = document.getElementById('chart-doughnut').getContext('2d');
  charts.doughnut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{
        data: [data.summary.Positive, data.summary.Negative, data.summary.Neutral],
        backgroundColor: [
          'rgba(76,175,80,0.85)',
          'rgba(244,67,54,0.85)',
          'rgba(255,152,0,0.85)',
        ],
        borderColor: ['#0d1117','#0d1117','#0d1117'],
        borderWidth: 3,
        hoverOffset: 10,
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b949e', padding: 16, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${data.percentages[ctx.label]}%)`
          }
        }
      }
    }
  });
}


// --- Chart 3: Horizontal Bar (Polarity per product) ---
function renderPolarityChart(data) {
  // Aggregate average polarity by unique product
  const productStats = {};
  data.reviews.forEach(r => {
    if (!productStats[r.product]) productStats[r.product] = { sum: 0, count: 0 };
    productStats[r.product].sum += r.polarity;
    productStats[r.product].count += 1;
  });

  let aggData = Object.keys(productStats).map(p => ({
    product: p,
    avgPolarity: productStats[p].sum / productStats[p].count
  }));

  // Sort highest to lowest polarity
  aggData.sort((a, b) => b.avgPolarity - a.avgPolarity);

  // Prevent canvas crash by limiting to 50 products (Top 25 and Bottom 25)
  if (aggData.length > 50) {
    aggData = [...aggData.slice(0, 25), ...aggData.slice(-25)];
  }

  const labels   = aggData.map(d => d.product);
  const values   = aggData.map(d => Number(d.avgPolarity.toFixed(3)));
  const bgColors = values.map(v =>
    v > 0.1  ? 'rgba(76,175,80,0.75)' :
    v < -0.1 ? 'rgba(244,67,54,0.75)' :
               'rgba(255,152,0,0.75)'
  );

  const canvasHeight = Math.max(300, labels.length * 32);
  const canvas = document.getElementById('chart-polarity');
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  charts.polarity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Polarity Score',
        data: values,
        backgroundColor: bgColors,
        borderColor: bgColors.map(c => c.replace('0.75','1')),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Polarity: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b949e' },
          min: -1, max: 1,
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#c9d1d9', font: { size: 11 } },
        }
      }
    }
  });
}


// --- Chart 4: Grouped Bar (Category Breakdown) ---
function renderCategoryChart(data) {
  const cats    = Object.keys(data.category_breakdown);
  const posData = cats.map(c => data.category_breakdown[c].Positive);
  const negData = cats.map(c => data.category_breakdown[c].Negative);
  const neuData = cats.map(c => data.category_breakdown[c].Neutral);

  const ctx = document.getElementById('chart-category').getContext('2d');
  charts.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cats.map(c => c.charAt(0).toUpperCase() + c.slice(1)),
      datasets: [
        { label: 'Positive', data: posData, backgroundColor: 'rgba(76,175,80,0.8)',  borderColor: '#4CAF50', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Negative', data: negData, backgroundColor: 'rgba(244,67,54,0.8)',  borderColor: '#F44336', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Neutral',  data: neuData, backgroundColor: 'rgba(255,152,0,0.8)',  borderColor: '#FF9800', borderWidth: 1.5, borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#8b949e', boxWidth: 12, padding: 14 }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e', stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}


// --- Chart 5: Polarity Distribution Histogram ---
function renderHistogramChart(data) {
  const dist   = data.polarity_distribution;
  const labels = Object.keys(dist);
  const values = Object.values(dist);
  const bgColors = [
    'rgba(244,67,54,0.85)',
    'rgba(255,152,0,0.85)',
    'rgba(255,193,7,0.85)',
    'rgba(76,175,80,0.85)',
    'rgba(0,212,255,0.85)',
  ];

  const ctx = document.getElementById('chart-histogram').getContext('2d');
  charts.histogram = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Reviews',
        data: values,
        backgroundColor: bgColors,
        borderColor: bgColors.map(c => c.replace('0.85','1')),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e', font:{ size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e', stepSize: 1 }, beginAtZero: true }
      }
    }
  });
}


function destroyAllCharts() {
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = {};
}

// --- Chart 6: Scatter Plot (Polarity vs Subjectivity) ---
function renderScatterChart(data) {
  const points = data.reviews.map(r => ({
    x: r.subjectivity,
    y: r.polarity,
    product: r.product,
    sentiment: r.sentiment
  }));

  const bgColors = points.map(p => 
    p.sentiment === 'Positive' ? 'rgba(76,175,80,0.8)' :
    p.sentiment === 'Negative' ? 'rgba(244,67,54,0.8)' :
                                 'rgba(255,152,0,0.8)'
  );

  const ctx = document.getElementById('chart-scatter').getContext('2d');
  charts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Reviews',
        data: points,
        backgroundColor: bgColors,
        borderColor: bgColors.map(c => c.replace('0.8', '1')),
        borderWidth: 1,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw.product}: Pol ${ctx.raw.y.toFixed(2)}, Sub ${ctx.raw.x.toFixed(2)}`
          }
        }
      },
      scales: {
        x: { 
          title: { display: true, text: 'Subjectivity (0=Fact, 1=Opinion)', color: '#8b949e', font: {size: 11} },
          grid: { color: 'rgba(255,255,255,0.05)' }, 
          ticks: { color: '#8b949e' },
          min: 0, max: 1
        },
        y: { 
          title: { display: true, text: 'Polarity (-1=Neg, +1=Pos)', color: '#8b949e', font: {size: 11} },
          grid: { color: 'rgba(255,255,255,0.05)' }, 
          ticks: { color: '#8b949e' },
          min: -1, max: 1
        }
      }
    }
  });
}


// ============================================================
//  HELPERS
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ============================================================
//  REVIEWS TABLE
// ============================================================
function renderTable(reviews) {
  tableBody.innerHTML = '';

  if (reviews.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No reviews match this filter.</td></tr>`;
    return;
  }

  reviews.forEach(r => {
    const shortReview = r.review.length > 60 ? r.review.slice(0,60) + '…' : r.review;
    const badgeCls = r.sentiment === 'Positive' ? 'badge-pos' : r.sentiment === 'Negative' ? 'badge-neg' : 'badge-neu';
    const polCls   = r.polarity > 0.1 ? 'pos-val' : r.polarity < -0.1 ? 'neg-val' : '';
    const polSign  = r.polarity >= 0 ? '+' : '';

    const tr = document.createElement('tr');
    tr.dataset.sentiment = r.sentiment;
    tr.innerHTML = `
      <td>${r.id}</td>
      <td class="td-product">${escHtml(r.product)}</td>
      <td class="td-review" title="${escHtml(r.review)}">${escHtml(shortReview)}</td>
      <td class="td-polarity ${polCls}">${polSign}${r.polarity.toFixed(3)}</td>
      <td class="td-polarity">${r.subjectivity.toFixed(3)}</td>
      <td><span class="badge ${badgeCls}">${r.sentiment}</span></td>
      <td><span class="cat-tag">${escHtml(r.category)}</span></td>
    `;
    tableBody.appendChild(tr);
  });
}

// Filter buttons
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    const filtered = filter === 'all'
      ? allReviews
      : allReviews.filter(r => r.sentiment === filter);
    renderTable(filtered);
  });
});

// Table sorting
document.querySelectorAll('th.sortable').forEach(th => {
  let asc = true;
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    const sorted = [...allReviews].sort((a, b) =>
      asc ? a[col] - b[col] : b[col] - a[col]
    );
    asc = !asc;
    renderTable(sorted);
  });
});


// ============================================================
//  KPI COUNT ANIMATION
// ============================================================
function animateCount(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 30);
}


// ============================================================
//  ERROR TOAST
// ============================================================
function showToast(msg) {
  toastMsg.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.add('hidden'), 6000);
}

toastClose.addEventListener('click', () => errorToast.classList.add('hidden'));
