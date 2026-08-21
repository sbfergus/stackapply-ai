import { jsPDF } from 'jspdf';

/**
 * Generate a professional resume PDF from text content
 * Formats the text with proper spacing, sections, and styling
 */
export function generateResumePDF(resumeText: string, company: string): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  // Styling constants
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 20;
  const marginRight = 20;
  const marginTop = 20;
  const maxWidth = pageWidth - marginLeft - marginRight;

  let yPosition = marginTop;

  // Parse resume sections
  const lines = resumeText.split('\n').filter(line => line.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if we need a new page
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = marginTop;
    }

    // Detect section headers (ALL CAPS)
    if (line === line.toUpperCase() && line.length > 2 && line.length < 50 && !line.includes('@')) {
      // Section header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(line, marginLeft, yPosition);
      yPosition += 8;
      
      // Add underline
      doc.setLineWidth(0.5);
      doc.line(marginLeft, yPosition - 5, pageWidth - marginRight, yPosition - 5);
      yPosition += 3;
    }
    // Detect contact line (has @ or phone pattern)
    else if (i < 3 && (line.includes('@') || line.includes('|'))) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(line, marginLeft, yPosition);
      yPosition += 5;
    }
    // Detect name (first line, typically)
    else if (i === 0 && !line.includes('@') && line.length < 50) {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(line, marginLeft, yPosition);
      yPosition += 10;
    }
    // Bullet points
    else if (line.startsWith('-') || line.startsWith('•')) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const bulletText = line.substring(1).trim();
      const splitText = doc.splitTextToSize(bulletText, maxWidth - 5);
      
      // Draw bullet
      doc.circle(marginLeft + 1.5, yPosition - 1.5, 0.8, 'F');
      
      // Draw text
      doc.text(splitText, marginLeft + 5, yPosition);
      yPosition += splitText.length * 5;
    }
    // Job titles / Company names (lines with dates or dashes)
    else if (line.match(/\d{4}/) || (line.includes(' - ') && !line.startsWith('-'))) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(line, marginLeft, yPosition);
      yPosition += 6;
    }
    // Regular text
    else {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const splitText = doc.splitTextToSize(line, maxWidth);
      doc.text(splitText, marginLeft, yPosition);
      yPosition += splitText.length * 5;
    }
    
    // Add extra spacing after certain sections
    if (line === line.toUpperCase() && i > 0) {
      yPosition += 2;
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
