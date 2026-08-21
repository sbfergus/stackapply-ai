import { jsPDF } from 'jspdf';

/**
 * Generate a professional, ATS-friendly resume PDF from text content
 * Enforces 1-page constraint with modern design principles
 * Based on 2026 tech sector best practices
 */
export function generateResumePDF(resumeText: string, company: string): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  // Styling constants - optimized for 1-page fit
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;  // Tighter margins for more space
  const marginRight = 15;
  const marginTop = 15;
  const marginBottom = 15;
  const maxWidth = pageWidth - marginLeft - marginRight;
  const maxContentHeight = pageHeight - marginTop - marginBottom;

  // Professional color palette (navy accent - ATS safe)
  const accentColor = { r: 31, g: 58, b: 96 };  // Navy blue #1F3A60
  
  let yPosition = marginTop;

  // Parse resume sections
  const lines = resumeText.split('\n').filter(line => line.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // ONE PAGE ENFORCEMENT: Warn but continue to fit as much as possible
    if (yPosition > marginTop + maxContentHeight - 10) {
      // Getting close to bottom, but allow certifications section
      const remainingLines = lines.slice(i);
      const hasCertifications = remainingLines.some(l => l === 'CERTIFICATIONS');
      if (!hasCertifications || yPosition > marginTop + maxContentHeight) {
        console.warn('Resume content truncated to fit one page');
        break;
      }
    }

    // Detect section headers (ALL CAPS)
    if (line === line.toUpperCase() && line.length > 2 && line.length < 50 && !line.includes('@')) {
      // Add extra space before section headers (except first one)
      if (i > 0) {
        yPosition += 3;
      }
      
      // Section header with accent color and horizontal rule
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
      doc.text(line, marginLeft, yPosition);
      doc.setTextColor(0, 0, 0); // Reset to black
      yPosition += 4;
      
      // Add horizontal rule under section header
      doc.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
      doc.setDrawColor(0, 0, 0); // Reset to black
      yPosition += 4;
    }
    // Detect contact line (has @ or phone pattern)
    else if (i < 3 && (line.includes('@') || line.includes('|'))) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80); // Slightly gray
      const textWidth = doc.getTextWidth(line);
      doc.text(line, (pageWidth - textWidth) / 2, yPosition); // Center align
      doc.setTextColor(0, 0, 0);
      yPosition += 4;
    }
    // Detect name (first line, typically)
    else if (i === 0 && !line.includes('@') && line.length < 50) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
      const textWidth = doc.getTextWidth(line);
      doc.text(line, (pageWidth - textWidth) / 2, yPosition); // Center align
      doc.setTextColor(0, 0, 0);
      yPosition += 6;
    }
    // Bullet points - compact spacing
    else if (line.startsWith('-') || line.startsWith('•')) {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      const bulletText = line.substring(1).trim();
      const splitText = doc.splitTextToSize(bulletText, maxWidth - 5);
      
      // Draw bullet (smaller)
      doc.circle(marginLeft + 1.2, yPosition - 1.2, 0.6, 'F');
      
      // Draw text
      doc.text(splitText, marginLeft + 4, yPosition);
      yPosition += splitText.length * 4.5; // Slightly more spacing for readability
    }
    // Job titles / Company names / Certifications (lines with dates or dashes)
    else if (line.match(/\d{4}/) || (line.includes(' - ') && !line.startsWith('-'))) {
      // Detect if this is a certification (under CERTIFICATIONS section)
      let isCertification = false;
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        if (prevLine === 'CERTIFICATIONS') {
          isCertification = true;
          break;
        }
        if (prevLine === prevLine.toUpperCase() && prevLine.length > 2 && prevLine.length < 50) {
          // Hit another section header before CERTIFICATIONS
          break;
        }
      }
      
      // Check if this line has dates at the end that should be right-aligned
      // Matches patterns like:
      // - "Title - Company November 2022 - Present"
      // - "Degree - School 2018 - 2022"
      // - "Certification - Org June 2023"
      const withDateRange = line.match(/^(.+?)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*-\s*(?:Present|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})|\d{4}\s*-\s*\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4})$/);
      
      if (withDateRange) {
        // Entry with dates: left-align title, right-align dates
        const [, title, dates] = withDateRange;
        doc.setFontSize(10);
        
        if (isCertification) {
          // Certifications: normal weight (not bold)
          doc.setFont('helvetica', 'normal');
        } else {
          // Experience/Education: bold
          doc.setFont('helvetica', 'bold');
        }
        
        doc.text(title.trim(), marginLeft, yPosition);
        
        // Right-align the dates (always normal weight)
        doc.setFont('helvetica', 'normal');
        const datesWidth = doc.getTextWidth(dates);
        doc.text(dates, pageWidth - marginRight - datesWidth, yPosition);
        yPosition += 5;
      } else {
        // Regular line with dates or dashes (fallback)
        doc.setFontSize(10);
        
        if (isCertification) {
          doc.setFont('helvetica', 'normal');
        } else {
          doc.setFont('helvetica', 'bold');
        }
        
        doc.text(line, marginLeft, yPosition);
        yPosition += 5;
      }
    }
    // Regular text - compact
    else {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      const splitText = doc.splitTextToSize(line, maxWidth);
      doc.text(splitText, marginLeft, yPosition);
      yPosition += splitText.length * 4.5; // Slightly more spacing
    }
    
    // Minimal spacing between sections - removed to save space
  }

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

/**
 * Generate filename for tailored resume
 * Format: resume-{company}-{date}.pdf
 */
export function generateResumeFilename(company: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedCompany = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `resume-${sanitizedCompany}-${date}.pdf`;
}
