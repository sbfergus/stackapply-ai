/**
 * LinkedIn Profile Scraper
 * Uses structural selectors (IDs, aria-labels) instead of fragile CSS classes
 * 
 * This is the refactored version that was in popup.js
 */

export function scrapeLinkedInProfile() {
  const profileData = {
    name: '',
    headline: '',
    location: '',
    about: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    profileUrl: window.location.href,
    scrapedAt: new Date().toISOString(),
  };
  
  try {
    console.log('🔍 Starting LinkedIn profile scrape...');
    
    // ===== TOP CARD: Name, Headline, Location =====
    const topCard = document.querySelector('section[id*="topcard"]') || 
                    document.querySelector('div[data-view-name*="profile-topcard"]') ||
                    document.querySelector('main section:first-of-type');
    
    if (topCard) {
      const nameEl = topCard.querySelector('h1') || topCard.querySelector('h2');
      if (nameEl) profileData.name = nameEl.innerText.trim();
      
      const headlineEl = topCard.querySelector('h1 + div') || 
                        topCard.querySelector('h2 + div') ||
                        topCard.querySelector('[class*="headline"]');
      if (headlineEl && !headlineEl.querySelector('h1, h2')) {
        profileData.headline = headlineEl.innerText.trim();
      }
      
      const allText = Array.from(topCard.querySelectorAll('span, div'));
      const locationEl = allText.find(el => {
        const text = el.innerText || '';
        return /United States|Remote|,\s*[A-Z]{2}|Metropolitan Area/i.test(text) &&
               !text.includes('@') &&
               text.length < 100;
      });
      if (locationEl) profileData.location = locationEl.innerText.trim();
    }
    
    // ===== ABOUT SECTION =====
    const aboutSection = document.querySelector('section[id*="about"]') ||
                        document.querySelector('section[aria-labelledby*="about"]') ||
                        Array.from(document.querySelectorAll('section')).find(s => {
                          const heading = s.querySelector('h2, h3');
                          return heading && /about/i.test(heading.innerText);
                        });
    
    if (aboutSection) {
      const textBlocks = Array.from(aboutSection.querySelectorAll('span, div'))
        .filter(el => el.innerText && el.innerText.length > 50)
        .sort((a, b) => b.innerText.length - a.innerText.length);
      
      if (textBlocks[0]) profileData.about = textBlocks[0].innerText.trim();
    }
    
    // ===== EXPERIENCE SECTION =====
    const expSection = document.querySelector('section[id*="experience"]') ||
                      document.querySelector('section[aria-labelledby*="experience"]') ||
                      Array.from(document.querySelectorAll('section')).find(s => {
                        const heading = s.querySelector('h2, h3');
                        return heading && /experience/i.test(heading.innerText);
                      });
    
    if (expSection) {
      const expItems = expSection.querySelectorAll('ul > li, [role="listitem"]');
      
      expItems.forEach(item => {
        const titleEl = item.querySelector('span[aria-hidden="true"]') ||
                       item.querySelector('div[class*="title"]') ||
                       Array.from(item.querySelectorAll('span, div')).find(el => {
                         const style = window.getComputedStyle(el);
                         return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
                       });
        
        const companyEl = item.querySelector('a[href*="/company/"]') ||
                         Array.from(item.querySelectorAll('span')).find(s => 
                           s.innerText && s.innerText.length < 100 && 
                           s.innerText.toLowerCase().includes('company')
                         );
        
        const allSpans = Array.from(item.querySelectorAll('span'));
        const datesEl = allSpans.find(s => 
          /\d{4}|present|now|current/i.test(s.innerText) &&
          s.innerText.length < 50
        );
        
        const descEl = Array.from(item.querySelectorAll('span, div'))
          .filter(el => el.innerText && el.innerText.length > 80)
          .sort((a, b) => b.innerText.length - a.innerText.length)[0];
        
        if (titleEl && titleEl.innerText.trim()) {
          profileData.experience.push({
            title: titleEl.innerText.trim(),
            company: companyEl ? companyEl.innerText.trim() : '',
            dates: datesEl ? datesEl.innerText.trim() : '',
            description: descEl ? descEl.innerText.trim() : '',
          });
        }
      });
    }
    
    // ===== EDUCATION SECTION =====
    const eduSection = document.querySelector('section[id*="education"]') ||
                      document.querySelector('section[aria-labelledby*="education"]') ||
                      Array.from(document.querySelectorAll('section')).find(s => {
                        const heading = s.querySelector('h2, h3');
                        return heading && /education/i.test(heading.innerText);
                      });
    
    if (eduSection) {
      const eduItems = eduSection.querySelectorAll('ul > li, [role="listitem"]');
      
      eduItems.forEach(item => {
        const schoolEl = item.querySelector('a[href*="/school/"]') ||
                        Array.from(item.querySelectorAll('span, div')).find(el => {
                          const style = window.getComputedStyle(el);
                          return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
                        });
        
        const allSpans = Array.from(item.querySelectorAll('span'));
        const degreeEl = allSpans.find(s => 
          s.innerText && 
          /degree|bachelor|master|phd|certificate/i.test(s.innerText) &&
          s.innerText.length < 100
        );
        
        const datesEl = allSpans.find(s => 
          /\d{4}|present|now/i.test(s.innerText) &&
          s.innerText.length < 50
        );
        
        if (schoolEl && schoolEl.innerText.trim()) {
          profileData.education.push({
            school: schoolEl.innerText.trim(),
            degree: degreeEl ? degreeEl.innerText.trim() : '',
            dates: datesEl ? datesEl.innerText.trim() : '',
          });
        }
      });
    }
    
    // ===== SKILLS SECTION =====
    const skillsSection = document.querySelector('section[id*="skills"]') ||
                         document.querySelector('section[aria-labelledby*="skills"]') ||
                         Array.from(document.querySelectorAll('section')).find(s => {
                           const heading = s.querySelector('h2, h3');
                           return heading && /skills/i.test(heading.innerText);
                         });
    
    if (skillsSection) {
      const skillElements = skillsSection.querySelectorAll('ul > li span[aria-hidden="true"]') ||
                           skillsSection.querySelectorAll('[role="listitem"] span');
      
      skillElements.forEach(skill => {
        const skillText = skill.innerText.trim();
        if (skillText && 
            skillText.length < 50 && 
            !profileData.skills.includes(skillText) &&
            !/endorsement|show|more|less/i.test(skillText)) {
          profileData.skills.push(skillText);
        }
      });
    }
    
    // ===== CERTIFICATIONS SECTION =====
    const certSection = document.querySelector('section[id*="licenses"]') ||
                       document.querySelector('section[id*="certification"]') ||
                       document.querySelector('section[aria-labelledby*="certification"]') ||
                       Array.from(document.querySelectorAll('section')).find(s => {
                         const heading = s.querySelector('h2, h3');
                         return heading && /certification|license/i.test(heading.innerText);
                       });
    
    if (certSection) {
      const certItems = certSection.querySelectorAll('ul > li, [role="listitem"]');
      
      certItems.forEach(item => {
        const titleEl = Array.from(item.querySelectorAll('span, div')).find(el => {
          const style = window.getComputedStyle(el);
          return (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600) &&
                 el.innerText && el.innerText.length < 150;
        });
        
        const allSpans = Array.from(item.querySelectorAll('span'));
        const issuerEl = allSpans.find(s => 
          s.innerText && s.innerText.length < 100 &&
          s !== titleEl
        );
        
        const dateEl = allSpans.find(s => 
          /issued|\d{4}|20\d{2}/i.test(s.innerText) &&
          s.innerText.length < 50
        );
        
        if (titleEl && titleEl.innerText.trim()) {
          profileData.certifications.push({
            name: titleEl.innerText.trim(),
            issuer: issuerEl ? issuerEl.innerText.trim() : '',
            date: dateEl ? dateEl.innerText.trim() : '',
          });
        }
      });
    }
    
    console.log('✅ LinkedIn profile scraped:', profileData);
    return profileData;
    
  } catch (error) {
    console.error('❌ LinkedIn profile scraping error:', error);
    return profileData;
  }
}
