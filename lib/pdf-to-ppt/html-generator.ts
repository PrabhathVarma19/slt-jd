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
  const totalSlides = allSlides.length;

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      background: rgba(255, 255, 255, 0.95);
      padding: 1rem 2rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
    }
    .slide-info {
      font-size: 0.875rem;
      color: #6b7280;
    }
    .slide-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow: hidden;
      position: relative;
      min-height: 0;
    }
    .slide-wrapper {
      position: relative;
      width: 100%;
      max-width: 1200px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }
    .slide {
      background: ${TRIANZ_COLORS.background};
      width: 100%;
      max-width: 1120px;
      aspect-ratio: 16/9;
      padding: 3rem 4rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      position: absolute;
      opacity: 0;
      transform: scale(0.95);
      transition: opacity 0.4s ease, transform 0.4s ease;
      overflow-y: auto;
      max-height: calc(100vh - 200px);
      box-sizing: border-box;
    }
    .slide.active {
      opacity: 1;
      transform: scale(1);
      position: relative;
      z-index: 10;
    }
    .slide-title-slide {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-start;
      background: ${TRIANZ_COLORS.background};
      position: relative;
      overflow: hidden;
    }
    .slide-title-slide::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 60%;
      height: 62%;
      background: ${TRIANZ_COLORS.primary};
      z-index: 0;
    }
    .slide-title-slide::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 38%;
      background: ${TRIANZ_COLORS.secondary};
      z-index: 0;
    }
    .slide-title-slide > * {
      position: relative;
      z-index: 1;
    }
    .slide-title-slide h1 {
      color: white;
      font-size: 3.5rem;
      font-weight: 700;
      line-height: 1.2;
      margin: 0;
      margin-top: 2rem;
      margin-left: 1rem;
    }
    .slide-title-slide .title-subtitle {
      color: white;
      font-size: 1.5rem;
      font-weight: 400;
      margin: 0;
      margin-top: 0.5rem;
      margin-left: 1rem;
      opacity: 0.9;
    }
    .slide-content-slide::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 8px;
      background: ${TRIANZ_COLORS.primary};
      border-radius: 8px 8px 0 0;
    }
    .slide h1 {
      font-size: 2.5rem;
      color: ${TRIANZ_COLORS.heading};
      font-weight: 700;
      margin-bottom: 2rem;
      margin-top: 0;
      line-height: 1.2;
    }
    .slide ul {
      list-style: none;
      padding-left: 0;
      margin-top: 0;
    }
    .slide li {
      font-size: 1.25rem;
      color: ${TRIANZ_COLORS.body};
      margin-bottom: 1.25rem;
      padding-left: 2rem;
      position: relative;
      line-height: 1.6;
    }
    .slide li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: ${TRIANZ_COLORS.primary};
      font-weight: bold;
      font-size: 1.5rem;
      top: 0;
    }
    .slide-quote {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, ${TRIANZ_COLORS.secondary} 0%, ${TRIANZ_COLORS.secondaryLight} 100%);
    }
    .quote-content {
      max-width: 800px;
    }
    .quote-text {
      font-size: 2.5rem;
      color: white;
      font-style: italic;
      line-height: 1.6;
      margin-bottom: 2rem;
      font-weight: 300;
    }
    .quote-attribution {
      font-size: 1.5rem;
      color: rgba(255, 255, 255, 0.9);
      text-align: right;
    }
    .two-column-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      margin-top: 2rem;
    }
    .column ul {
      list-style: none;
      padding-left: 0;
    }
    .column li {
      font-size: 1.125rem;
      color: ${TRIANZ_COLORS.body};
      margin-bottom: 1rem;
      padding-left: 1.5rem;
      position: relative;
      line-height: 1.6;
    }
    .column li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: ${TRIANZ_COLORS.primary};
      font-weight: bold;
      font-size: 1.25rem;
    }
    .slide-section-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${TRIANZ_COLORS.secondary};
    }
    .section-title {
      font-size: 3.5rem;
      color: white;
      font-weight: 700;
      text-align: center;
    }
    .slide-title.highlight-title {
      font-size: 3rem;
      text-align: center;
      color: ${TRIANZ_COLORS.primary};
    }
    .controls {
      background: rgba(255, 255, 255, 0.95);
      padding: 1.5rem 2rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
    }
    .controls button {
      padding: 0.75rem 1.5rem;
      background: ${TRIANZ_COLORS.primary};
      color: white;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .controls button:hover:not(:disabled) {
      background: ${TRIANZ_COLORS.secondary};
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    .controls button:disabled {
      background: #d1d5db;
      cursor: not-allowed;
      opacity: 0.5;
    }
    .slide-counter {
      font-size: 1rem;
      color: #374151;
      font-weight: 600;
    }
    .slide-indicators {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
      max-width: 400px;
    }
    .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.2);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .indicator.active {
      background: ${TRIANZ_COLORS.primary};
      width: 24px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Presentation Preview</h1>
    <div class="slide-info">
      <span id="currentSlide">1</span> / <span id="totalSlides">${totalSlides}</span> slides
    </div>
  </div>
  <div class="slide-container">
    <div class="slide-wrapper">
      ${allSlides.map((slide, index) => {
        const slideType = slide.type || (index === 0 ? 'title' : 'content');
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
          return `
            <div class="${slideClass}" data-slide-index="${index}">
              ${slide.title ? `<h1>${escapeHtml(slide.title)}</h1>` : ''}
              <div class="two-column-content">
                <div class="column left-column">
                  <ul>
                    ${(slide.leftContent || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                  </ul>
                </div>
                <div class="column right-column">
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
        
        // Title slide (first slide)
        if (index === 0) {
          return `
            <div class="${slideClass}" data-slide-index="${index}">
              <h1>${escapeHtml(slide.title)}</h1>
              <p class="title-subtitle">Presentation</p>
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
  </div>
  <div class="controls">
    <button id="prevBtn" onclick="previousSlide()">← Previous</button>
    <div class="slide-indicators">
      ${allSlides.map((_, i) => `<div class="indicator ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`).join('')}
    </div>
    <button id="nextBtn" onclick="nextSlide()">Next →</button>
  </div>
  <script>
    let currentSlideIndex = 0;
    const slides = document.querySelectorAll('.slide');
    const indicators = document.querySelectorAll('.indicator');
    const totalSlides = slides.length;

    function updateIndicators(index) {
      indicators.forEach((ind, i) => {
        ind.classList.toggle('active', i === index);
      });
    }

    function showSlide(index) {
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });
      document.getElementById('currentSlide').textContent = index + 1;
      document.getElementById('prevBtn').disabled = index === 0;
      document.getElementById('nextBtn').disabled = index === totalSlides - 1;
      updateIndicators(index);
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

    function goToSlide(index) {
      currentSlideIndex = index;
      showSlide(currentSlideIndex);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        previousSlide();
      }
    });

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
