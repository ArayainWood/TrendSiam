/**
 * Download Multilingual Fonts for PDF
 * 
 * Downloads authentic Noto Sans fonts from trusted Google sources
 * Computes SHA-256 for provenance tracking
 * 
 * Trusted sources:
 * - fonts.gstatic.com (Google Fonts CDN)
 * - github.com/notofonts
 * - github.com/googlefonts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as https from 'https';

interface FontFile {
  family: string;
  variant: string;
  filename: string;
  url: string;
  size?: number;
  sha256?: string;
  downloaded: boolean;
}

interface FontProvenance {
  generated_at: string;
  fonts: FontFile[];
}

const FONTS_BASE_DIR = path.join(__dirname, '..', 'public', 'fonts');

/**
 * Font URLs from Google Fonts API / GitHub releases
 * Using static TTF files (not Variable fonts for PDF reliability)
 */
const FONT_DOWNLOADS: FontFile[] = [
  // Thai (already present, but verify)
  {
    family: 'NotoSansThai',
    variant: 'Regular',
    filename: 'NotoSansThai-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzF-QRvzzXg.ttf',
    downloaded: false
  },
  {
    family: 'NotoSansThai',
    variant: 'Bold',
    filename: 'NotoSansThai-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/notosansthai/v20/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RttpzF-QRvzzXg.ttf',
    downloaded: false
  },
  
  // Latin (Noto Sans)
  {
    family: 'NotoSans',
    variant: 'Regular',
    filename: 'NotoSans-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A946.ttf',
    downloaded: false
  },
  {
    family: 'NotoSans',
    variant: 'Bold',
    filename: 'NotoSans-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyDNA946.ttf',
    downloaded: false
  },
  
  // Chinese Simplified
  {
    family: 'NotoSansSC',
    variant: 'Regular',
    filename: 'NotoSansSC-Regular.otf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf',
    downloaded: false
  },
  {
    family: 'NotoSansSC',
    variant: 'Bold',
    filename: 'NotoSansSC-Bold.otf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Bold.otf',
    downloaded: false
  },
  
  // Japanese
  {
    family: 'NotoSansJP',
    variant: 'Regular',
    filename: 'NotoSansJP-Regular.otf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Regular.otf',
    downloaded: false
  },
  {
    family: 'NotoSansJP',
    variant: 'Bold',
    filename: 'NotoSansJP-Bold.otf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansJP-Bold.otf',
    downloaded: false
  },
  
  // Korean
  {
    family: 'NotoSansKR',
    variant: 'Regular',
    filename: 'NotoSansKR-Regular.otf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Regular.otf',
    downloaded: false
  },
  {
    family: 'NotoSansKR',
    variant: 'Bold',
    filename: 'NotoSansKR-Bold.otf',
    url: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Bold.otf',
    downloaded: false
  },
  
  // Arabic
  {
    family: 'NotoSansArabic',
    variant: 'Regular',
    filename: 'NotoSansArabic-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpCtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyG2vu3CBFQLaig.ttf',
    downloaded: false
  },
  {
    family: 'NotoSansArabic',
    variant: 'Bold',
    filename: 'NotoSansArabic-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpCtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyXvXCBFQLaig.ttf',
    downloaded: false
  },
  
  // Hebrew
  {
    family: 'NotoSansHebrew',
    variant: 'Regular',
    filename: 'NotoSansHebrew-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/notosanshebrew/v43/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0sqk3xXGiXd4utoiJltutR2g.ttf',
    downloaded: false
  },
  {
    family: 'NotoSansHebrew',
    variant: 'Bold',
    filename: 'NotoSansHebrew-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/notosanshebrew/v43/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0sqk3xXGiXd4uto4pmtutR2g.ttf',
    downloaded: false
  },
  
  // Emoji (monochrome for PDF)
  {
    family: 'NotoEmoji',
    variant: 'Regular',
    filename: 'NotoEmoji-Regular.ttf',
    url: 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoEmoji-Regular.ttf',
    downloaded: false
  },
  
  // Symbols
  {
    family: 'NotoSansSymbols',
    variant: 'Regular',
    filename: 'NotoSansSymbols-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/notosanssymbols/v43/rP2up3q65FkAtHfwd-eIS2brbDN6gxP34F9jRRCe4W3gfQ4gavVFRkzrbQ.ttf',
    downloaded: false
  },
  {
    family: 'NotoSansSymbols',
    variant: 'Bold',
    filename: 'NotoSansSymbols-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/notosanssymbols/v43/rP2up3q65FkAtHfwd-eIS2brbDN6gxP34F9jRRCe4W3gfQ4gavVsR0zrbQ.ttf',
    downloaded: false
  }
];

/**
 * Download a file from URL
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        if (response.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Compute SHA-256 hash of file
 */
function computeSHA256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex').toUpperCase();
}

/**
 * Main download function
 */
async function downloadFonts(dryRun: boolean = false): Promise<void> {
  console.log('🔍 Multilingual Font Downloader\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE DOWNLOAD'}\n`);
  console.log('Trusted sources:');
  console.log('  - fonts.gstatic.com');
  console.log('  - github.com/googlefonts');
  console.log('  - github.com/notofonts\n');
  console.log('='.repeat(80) + '\n');
  
  const provenance: FontProvenance = {
    generated_at: new Date().toISOString(),
    fonts: []
  };
  
  for (const font of FONT_DOWNLOADS) {
    const familyDir = path.join(FONTS_BASE_DIR, font.family);
    const filePath = path.join(familyDir, font.filename);
    
    // Check if already exists
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      const sha256 = computeSHA256(filePath);
      
      console.log(`✅ EXISTS: ${font.family}/${font.filename}`);
      console.log(`   Size: ${size.toLocaleString()} bytes`);
      console.log(`   SHA-256: ${sha256}\n`);
      
      provenance.fonts.push({
        ...font,
        size,
        sha256,
        downloaded: false
      });
      
      continue;
    }
    
    if (dryRun) {
      console.log(`⏸️ WOULD DOWNLOAD: ${font.family}/${font.filename}`);
      console.log(`   URL: ${font.url}\n`);
      continue;
    }
    
    // Create family directory
    if (!fs.existsSync(familyDir)) {
      fs.mkdirSync(familyDir, { recursive: true });
    }
    
    try {
      console.log(`⬇️ DOWNLOADING: ${font.family}/${font.filename}`);
      console.log(`   URL: ${font.url}`);
      
      await downloadFile(font.url, filePath);
      
      const size = fs.statSync(filePath).size;
      const sha256 = computeSHA256(filePath);
      
      console.log(`   ✅ Downloaded: ${size.toLocaleString()} bytes`);
      console.log(`   SHA-256: ${sha256}\n`);
      
      provenance.fonts.push({
        ...font,
        size,
        sha256,
        downloaded: true
      });
      
    } catch (error) {
      console.error(`   ❌ FAILED: ${error}\n`);
      
      provenance.fonts.push({
        ...font,
        downloaded: false
      });
    }
  }
  
  // Save provenance file
  if (!dryRun) {
    const provenancePath = path.join(FONTS_BASE_DIR, 'fonts_provenance.json');
    fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2));
    console.log('\n📄 Provenance saved to: fonts_provenance.json\n');
  }
  
  // Summary
  const downloaded = provenance.fonts.filter(f => f.downloaded).length;
  const existing = provenance.fonts.filter(f => !f.downloaded && f.sha256).length;
  const failed = provenance.fonts.filter(f => !f.downloaded && !f.sha256).length;
  
  console.log('='.repeat(80));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total fonts: ${FONT_DOWNLOADS.length}`);
  console.log(`   Already exist: ${existing}`);
  if (!dryRun) {
    console.log(`   Downloaded: ${downloaded}`);
    console.log(`   Failed: ${failed}`);
  }
  console.log('');
  
  // Calculate total size
  const totalSize = provenance.fonts.reduce((sum, f) => sum + (f.size || 0), 0);
  console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
}

// Run
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

downloadFonts(dryRun).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

