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
  let contentFits = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // ONE PAGE ENFORCEMENT: Stop if we exceed page height
    if (yPosition > marginTop + maxContentHeight) {
      contentFits = false;
      console.warn('Resume content truncated to fit one page');
      break;
    }

    // Detect section headers (ALL CAPS)
    if (line === line.toUpperCase() && line.length > 2 && line.length < 50 && !line.includes('@')) {
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
      yPosition += splitText.length * 4; // Tighter line spacing
    }
    // Job titles / Company names (lines with dates or dashes)
    else if (line.match(/\d{4}/) || (line.includes(' - ') && !line.startsWith('-'))) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(line, marginLeft, yPosition);
      yPosition += 5;
    }
    // Regular text - compact
    else {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      const splitText = doc.splitTextToSize(line, maxWidth);
      doc.text(splitText, marginLeft, yPosition);
      yPosition += splitText.length * 4; // Tighter line spacing
    }
    
    // Minimal spacing between sections
    if (line === line.toUpperCase() && i > 0) {
      yPosition += 1;
    }
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
