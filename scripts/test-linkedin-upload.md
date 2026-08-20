# Testing LinkedIn PDF Upload

## Setup

1. **Get a LinkedIn PDF:**
   - Go to your LinkedIn profile (https://www.linkedin.com/in/YOUR-PROFILE/)
   - Click "More" button
   - Select "Save to PDF"
   - Download the PDF

## Test Cases

### ✅ Happy Path

1. **Navigate to Account Page:**
   ```
   http://localhost:3000/account
   ```

2. **Locate LinkedIn Profile Section:**
   - Should be below "Resume" section
   - Shows upload prompt with instructions

3. **Upload PDF:**
   - Click "Choose File"
   - Select LinkedIn PDF
   - Should show "Parsing..." spinner
   - Should complete in 3-10 seconds

4. **Verify Success:**
   - Toast notification: "LinkedIn Profile Uploaded!"
   - Section shows parsed name
   - Shows "X positions • Y skills"
   - "✓ Synced" badge appears

5. **Check Database:**
   ```bash
   # In Prisma Studio or database client
   SELECT linkedinData, linkedinSyncedAt FROM User WHERE email = 'your-email';
   ```

6. **Verify Parsed Data:**
   - Should have name, headline, location
   - Experience array populated
   - Skills array populated
   - Education array populated (if in PDF)
   - Certifications array populated (if in PDF)

### ❌ Error Cases

1. **Wrong File Type:**
   - Upload `.docx` or `.jpg`
   - Should show: "File must be a PDF"

2. **File Too Large:**
   - Upload >10MB PDF
   - Should show: "File size must be less than 10MB"

3. **Invalid PDF:**
   - Upload corrupted PDF
   - Should show error message
   - Should not break the UI

4. **Network Error:**
   - Disconnect internet
   - Try upload
   - Should show: "Failed to upload LinkedIn profile"

### 🔄 Replace & Delete

1. **Replace Profile:**
   - Upload first PDF
   - Click "Replace"
   - Upload different PDF
   - Should update data
   - Toast: "LinkedIn Profile Uploaded!"

2. **Delete Profile:**
   - Click "Delete"
   - Confirm dialog
   - Should remove data
   - Shows upload prompt again
   - Toast: "LinkedIn Profile Deleted"

## Validation Checks

### Frontend State
- [ ] `linkedinData` state updates correctly
- [ ] `uploadingLinkedin` shows during upload
- [ ] UI disables during upload
- [ ] Toast notifications appear
- [ ] File input clears after upload

### Backend Validation
- [ ] PDF uploaded to Vercel Blob
- [ ] AI parsing completes successfully
- [ ] JSON is valid and parseable
- [ ] Database updates `linkedinData` field
- [ ] Database updates `linkedinSyncedAt` timestamp

### Data Quality
- [ ] Name extracted correctly
- [ ] Headline preserved
- [ ] Location formatted properly
- [ ] About section complete
- [ ] All experience entries captured
- [ ] Education history complete
- [ ] Skills list accurate
- [ ] Certifications included

## Sample LinkedIn PDF Structure

A typical LinkedIn PDF contains:

```
[Header]
Name
Headline @ Company
Location • Contact info
Connections count

[About]
Full about/summary text

[Experience]
Job Title
Company Name • Employment Type
Start Date - End Date • Duration
Location
Description...

[Education]
School Name
Degree
Graduation Year

[Licenses & Certifications]
Certification Name
Issuing Organization
Issue Date

[Skills]
Skill 1 • Skill 2 • Skill 3
```

## Common Issues

### Issue: AI returns invalid JSON
**Cause:** PDF has unusual formatting
**Solution:** AI prompt already handles this, but may need refinement
**Check:** Anthropic API response logs

### Issue: Missing data sections
**Cause:** Section not in PDF or different format
**Solution:** Verify PDF contains all sections
**Check:** Open PDF and confirm content exists

### Issue: Upload timeout
**Cause:** Large PDF or slow AI parsing
**Solution:** Increase timeout or split into smaller chunks
**Check:** Vercel function logs

## Production Checklist

Before deploying:

- [ ] Test with various LinkedIn PDF formats (different years/layouts)
- [ ] Verify Anthropic API key is set in production env
- [ ] Confirm Vercel Blob storage is configured
- [ ] Test with multiple user accounts
- [ ] Verify permissions (only own profile upload)
- [ ] Check mobile responsiveness
- [ ] Confirm cost monitoring is in place
- [ ] Test error handling edge cases
- [ ] Verify data privacy (PDF not exposed publicly)
