import { Slide } from '@/types/pdf-to-ppt';

// Trianz brand colors
const TRIANZ_COLORS = {
  primary: '#F36C24',      // Orange - primary accent
  secondary: '#0092C5',    // Blue - secondary accent
  secondaryLight: '#7ECBE5', // Light blue
  secondaryGrey: '#858586',  // Grey
  heading: '#00367E',      // Dark blue - headings
  body: '#090909',          // Black - body text
  background: '#FFFFFF',    // White - background
};

export function generateHtmlPreview(slides: Slide[], filename: string): string {
  const titleSlide: Slide = {
    title: filename.replace(/\.pdf$/i, ''),
    content: [],
    type: 'title',
  };

  const allSlides = [titleSlide, ...slides];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF to PPT Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      background: #f3f4f6;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .slide-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      overflow-y: auto;
    }
    .slide {
      background: ${TRIANZ_COLORS.background};
      width: 960px;
      max-width: 100%;
      min-height: 540px;
      padding: 2rem 3rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      position: relative;
      display: none;
    }
    .slide.active {
      display: block;
    }
    .slide-title-slide {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
    }
    .slide-title-slide::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 30px;
      background: ${TRIANZ_COLORS.primary};
    }
    .slide-content-slide::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 15px;
      background: ${TRIANZ_COLORS.primary};
    }
    .slide h1 {
      font-size: 44px;
      color: ${TRIANZ_COLORS.heading};
      font-weight: bold;
      margin-bottom: 1rem;
      margin-top: 2rem;
    }
    .slide-title-slide h1 {
      font-size: 44px;
      margin-top: 3rem;
    }
    .slide ul {
      list-style: none;
      padding-left: 0;
      margin-top: 1.5rem;
    }
    .slide li {
      font-size: 18px;
      color: ${TRIANZ_COLORS.body};
      margin-bottom: 0.75rem;
      padding-left: 1.5rem;
      position: relative;
      line-height: 1.5;
    }
    .slide li::before {
      content: counter(slide-counter) '.';
      counter-increment: slide-counter;
      position: absolute;
      left: 0;
      color: ${TRIANZ_COLORS.primary};
      font-weight: bold;
    }
    .slide-content-slide {
      counter-reset: slide-counter;
    }
    .slide-quote {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .slide-quote::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50px;
      background: ${TRIANZ_COLORS.primary};
    }
    .quote-content {
      max-width: 800px;
    }
    .quote-text {
      font-size: 32px;
      color: ${TRIANZ_COLORS.heading};
      font-style: italic;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .quote-attribution {
      font-size: 20px;
      color: ${TRIANZ_COLORS.secondaryGrey};
      text-align: right;
    }
    .two-column-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 1.5rem;
    }
    .column ul {
      list-style: none;
      padding-left: 0;
    }
    .column li {
      font-size: 16px;
      color: ${TRIANZ_COLORS.body};
      margin-bottom: 0.75rem;
      padding-left: 1.5rem;
      position: relative;
      line-height: 1.5;
    }
    .column li::before {
      content: counter(column-counter) '.';
      counter-increment: column-counter;
      position: absolute;
      left: 0;
      color: ${TRIANZ_COLORS.primary};
      font-weight: bold;
    }
    .left-column {
      counter-reset: column-counter;
    }
    .right-column {
      counter-reset: column-counter;
    }
    .slide-section-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${TRIANZ_COLORS.secondary};
    }
    .slide-section-divider::before {
      display: none;
    }
    .section-title {
      font-size: 44px;
      color: ${TRIANZ_COLORS.background};
      font-weight: bold;
      text-align: center;
    }
    .slide-title.highlight-title {
      font-size: 48px;
      text-align: center;
      color: ${TRIANZ_COLORS.primary};
    }
    .slide-title::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100px;
      background: ${TRIANZ_COLORS.primary};
    }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: white;
      border-top: 1px solid #e5e7eb;
    }
    .controls button {
      padding: 0.5rem 1rem;
      background: ${TRIANZ_COLORS.primary};
      color: white;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    .controls button:hover {
      background: ${TRIANZ_COLORS.secondary};
    }
    .controls button:disabled {
      background: #d1d5db;
      cursor: not-allowed;
    }
    .slide-counter {
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="slide-container">
    ${allSlides.map((slide, index) => {
      const isTitleSlide = index === 0;
      const slideType = slide.type || (isTitleSlide ? 'title' : 'content');
      const slideClass = `slide slide-${slideType} ${index === 0 ? 'active' : ''}`;
      
      // Render based on slide type
      if (slideType === 'quote') {
        return `
          <div class="${slideClass}" data-slide-index="${index}">
            <div class="quote-content">
              <div class="quote-text">"${escapeHtml(slide.quote || slide.title)}"</div>
              ${slide.attribution ? `<div class="quote-attribution">— ${escapeHtml(slide.attribution)}</div>` : ''}
            </div>
          </div>
        `;
      }
      
      if (slideType === 'two-column') {
        const leftCount = slide.leftContent?.length || 0;
        return `
          <div class="${slideClass}" data-slide-index="${index}">
            ${slide.title ? `<h1>${escapeHtml(slide.title)}</h1>` : ''}
            <div class="two-column-content">
              <div class="column left-column">
                <ul>
                  ${(slide.leftContent || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
              </div>
              <div class="column right-column" style="counter-reset: column-counter ${leftCount};">
                <ul>
                  ${(slide.rightContent || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        `;
      }
      
      if (slideType === 'section-divider') {
        return `
          <div class="${slideClass}" data-slide-index="${index}">
            <h1 class="section-title">${escapeHtml(slide.title)}</h1>
          </div>
        `;
      }
      
      if (slideType === 'title' && slide.highlight) {
        return `
          <div class="${slideClass}" data-slide-index="${index}">
            <h1 class="highlight-title">${escapeHtml(slide.title)}</h1>
          </div>
        `;
      }
      
      // Default content slide
      return `
        <div class="${slideClass}" data-slide-index="${index}">
          ${slide.title ? `<h1>${escapeHtml(slide.title)}</h1>` : ''}
          ${slide.content && slide.content.length > 0 ? `
            <ul>
              ${slide.content.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }).join('')}
  </div>
  <div class="controls">
    <button id="prevBtn" onclick="previousSlide()">Previous</button>
    <span class="slide-counter">
      <span id="currentSlide">1</span> / <span id="totalSlides">${allSlides.length}</span>
    </span>
    <button id="nextBtn" onclick="nextSlide()">Next</button>
  </div>
  <script>
    let currentSlideIndex = 0;
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;

    function showSlide(index) {
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });
      document.getElementById('currentSlide').textContent = index + 1;
      document.getElementById('prevBtn').disabled = index === 0;
      document.getElementById('nextBtn').disabled = index === totalSlides - 1;
    }

    function nextSlide() {
      if (currentSlideIndex < totalSlides - 1) {
        currentSlideIndex++;
        showSlide(currentSlideIndex);
      }
    }

    function previousSlide() {
      if (currentSlideIndex > 0) {
        currentSlideIndex--;
        showSlide(currentSlideIndex);
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        previousSlide();
      }
    });

    // Initialize
    showSlide(0);
  </script>
</body>
</html>
  `.trim();

  return html;
}

function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  // Fallback for server-side
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
