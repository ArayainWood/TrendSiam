/**
 * File Inventory Scanner for System Manual
 * 
 * Scans Python files and key TypeScript modules to generate
 * Thai-language descriptions for the manual
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

export interface FileInfo {
  path: string;
  relativePath: string;
  name: string;
  type: 'python' | 'typescript' | 'other';
  size: number;
  description: string;
  functions: string[];
  imports: string[];
  usage: string[];
}

/**
 * Scan repository for Python files and generate inventory
 */
export function scanPythonFiles(rootPath: string): FileInfo[] {
  const files: FileInfo[] = [];
  
  function scanDirectory(dirPath: string) {
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip certain directories
          if (!item.startsWith('.') && 
              !['node_modules', '__pycache__', '.git', 'venv'].includes(item)) {
            scanDirectory(fullPath);
          }
        } else if (item.endsWith('.py')) {
          const fileInfo = analyzePythonFile(fullPath, rootPath);
          if (fileInfo) {
            files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.warn(`[fileInventory] Cannot scan directory: ${dirPath}`);
    }
  }
  
  scanDirectory(rootPath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Analyze a Python file and extract information
 */
function analyzePythonFile(filePath: string, rootPath: string): FileInfo | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const stat = statSync(filePath);
    const relativePath = relative(rootPath, filePath);
    const name = relativePath.split('/').pop() || '';
    
    // Extract docstring
    const docstringMatch = content.match(/^"""([\s\S]*?)"""/m) || 
                          content.match(/^'''([\s\S]*?)'''/m);
    let description = '';
    
    if (docstringMatch && docstringMatch[1]) {
      description = docstringMatch[1].trim();
    } else {
      // Try to infer from filename and content
      description = inferPythonFileDescription(name, content);
    }
    
    // Extract function definitions
    const functions = extractPythonFunctions(content);
    
    // Extract imports
    const imports = extractPythonImports(content);
    
    // Determine usage (simplified)
    const usage = inferPythonUsage(name, content);
    
    return {
      path: filePath,
      relativePath,
      name,
      type: 'python',
      size: stat.size,
      description: translateToThai(description, name),
      functions,
      imports,
      usage
    };
  } catch (error) {
    console.warn(`[fileInventory] Cannot analyze file: ${filePath}`);
    return null;
  }
}

/**
 * Extract function definitions from Python code
 */
function extractPythonFunctions(content: string): string[] {
  const functions: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (match && match[1]) {
      functions.push(match[1]);
    }
  }
  
  return functions.slice(0, 10); // Limit to first 10 functions
}

/**
 * Extract import statements from Python code
 */
function extractPythonImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const importMatch = line.match(/^(?:from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+)?import\s+([a-zA-Z_][a-zA-Z0-9_.,\s]*)/);
    if (importMatch && importMatch[2]) {
      const moduleName = importMatch[1]; // Renamed from 'module' to avoid Next.js reserved variable
      const items = importMatch[2];
      const firstItem = items.split(',')[0];
      if (firstItem) {
        if (moduleName) {
          imports.push(`${moduleName}.${firstItem.trim()}`);
        } else {
          imports.push(firstItem.trim());
        }
      }
    }
  }
  
  return [...new Set(imports)].slice(0, 8); // Unique imports, limit to 8
}

/**
 * Infer file description from filename and content
 */
function inferPythonFileDescription(filename: string, content: string): string {
  const name = filename.replace('.py', '');
  
  // Common patterns
  if (name.includes('test_')) {
    return `Test file for ${name.replace('test_', '')} functionality`;
  }
  if (name.includes('_test')) {
    return `Test file for ${name.replace('_test', '')} functionality`;
  }
  if (name === 'app.py') {
    return 'Main Flask/FastAPI application entry point';
  }
  if (name.includes('config')) {
    return 'Configuration settings and environment variables';
  }
  if (name.includes('api')) {
    return 'API endpoints and request handlers';
  }
  if (name.includes('fetch') || name.includes('scraper')) {
    return 'Data fetching and web scraping functionality';
  }
  if (name.includes('summarize') || name.includes('summary')) {
    return 'Content summarization and AI processing';
  }
  if (name.includes('image')) {
    return 'Image processing and AI image generation';
  }
  if (name.includes('security') || name.includes('audit')) {
    return 'Security validation and audit functionality';
  }
  
  // Check content for clues
  if (content.includes('class ') && content.includes('def __init__')) {
    return `Class definitions and object-oriented functionality for ${name}`;
  }
  if (content.includes('def main(') || content.includes('if __name__ == "__main__"')) {
    return `Executable script for ${name} operations`;
  }
  if (content.includes('import requests') || content.includes('import urllib')) {
    return `HTTP client and web request functionality for ${name}`;
  }
  if (content.includes('import openai') || content.includes('from openai')) {
    return `OpenAI API integration for ${name}`;
  }
  
  return `Python module: ${name}`;
}

/**
 * Infer usage patterns for Python files
 */
function inferPythonUsage(filename: string, content: string): string[] {
  const usage: string[] = [];
  const name = filename.replace('.py', '');
  
  if (content.includes('if __name__ == "__main__"')) {
    usage.push('CLI script');
  }
  if (content.includes('app = Flask') || content.includes('app = FastAPI')) {
    usage.push('Web application');
  }
  if (content.includes('def test_') || filename.includes('test_')) {
    usage.push('Test suite');
  }
  if (content.includes('import schedule') || content.includes('cron')) {
    usage.push('Scheduled job');
  }
  if (content.includes('supabase') || content.includes('database')) {
    usage.push('Database operations');
  }
  
  return usage;
}

/**
 * Translate descriptions to Thai
 */
function translateToThai(description: string, filename: string): string {
  const name = filename.replace('.py', '');
  
  // Common translations
  const translations: Record<string, string> = {
    'summarize_all_v2.py': 'สคริปต์หลักสำหรับดึงข้อมูลและสร้างสรุปข่าวจาก YouTube API พร้อมการประมวลผล AI',
    'summarize_all_v3_supabase_only.py': 'เวอร์ชันที่ใช้ Supabase เป็นหลักสำหรับการจัดเก็บและประมวลผลข้อมูล',
    'ai_image_generator_v2.py': 'ระบบสร้างภาพประกอบด้วย AI สำหรับข่าวและเนื้อหา',
    'youtube_api_fetcher.py': 'ตัวดึงข้อมูลจาก YouTube Data API',
    'security_audit.py': 'เครื่องมือตรวจสอบความปลอดภัยของระบบ',
    'test_pipeline_diagnostics.py': 'การทดสอบและตรวจสอบสุขภาพของ data pipeline',
    'acceptance_tests.py': 'ชุดทดสอบการยอมรับสำหรับตรวจสอบฟังก์ชันหลัก',
    'setup_environment.py': 'สคริปต์ตั้งค่าสภาพแวดล้อมและ dependencies',
    'popularity_scorer.py': 'ระบบคำนวณคะแนนความนิยมและการจัดอันดับ',
    'clean_trending_data.py': 'เครื่องมือทำความสะอาดและปรับปรุงข้อมูลแนวโน้ม'
  };
  
  if (translations[filename]) {
    return translations[filename];
  }
  
  // Generic patterns
  if (name.includes('test_')) {
    return `ไฟล์ทดสอบสำหรับ ${name.replace('test_', '')}`;
  }
  if (name.includes('config')) {
    return `การตั้งค่าและกำหนดค่าสำหรับ ${name}`;
  }
  if (name.includes('api')) {
    return `API endpoints และการจัดการ requests สำหรับ ${name}`;
  }
  if (name.includes('fetch') || name.includes('scraper')) {
    return `การดึงข้อมูลและ web scraping สำหรับ ${name}`;
  }
  if (name.includes('image')) {
    return `การประมวลผลภาพและ AI image generation สำหรับ ${name}`;
  }
  
  // Fallback with original description
  if (description && description !== `Python module: ${name}`) {
    return `${description} (โมดูล Python สำหรับ ${name})`;
  }
  
  return `โมดูล Python: ${name}`;
}

/**
 * Get key TypeScript modules for the appendix
 */
export function getKeyTypeScriptModules(): FileInfo[] {
  const modules = [
    {
      path: 'frontend/src/app/page.tsx',
      relativePath: 'frontend/src/app/page.tsx',
      name: 'page.tsx',
      type: 'typescript' as const,
      size: 0,
      description: 'หน้าแรกของเว็บแอปพลิเคชัน แสดงข้อมูลข่าวแนวโน้มล่าสุด',
      functions: ['HomePage'],
      imports: ['React', 'Next.js'],
      usage: ['Main page component']
    },
    {
      path: 'frontend/src/app/weekly-report/page.tsx',
      relativePath: 'frontend/src/app/weekly-report/page.tsx',
      name: 'page.tsx',
      type: 'typescript' as const,
      size: 0,
      description: 'หน้ารายงานรายสัปดาห์ แสดงสรุปข้อมูลและสถิติ',
      functions: ['WeeklyReportPage'],
      imports: ['React', 'weeklySnapshot'],
      usage: ['Weekly report display']
    },
    {
      path: 'frontend/src/lib/weekly/weeklyRepo.ts',
      relativePath: 'frontend/src/lib/weekly/weeklyRepo.ts',
      name: 'weeklyRepo.ts',
      type: 'typescript' as const,
      size: 0,
      description: 'Repository สำหรับการเข้าถึงข้อมูล weekly snapshots พร้อม fallback logic',
      functions: ['fetchLatestWeekly', 'countTotalStories'],
      imports: ['Supabase', 'Zod'],
      usage: ['Data access layer']
    },
    {
      path: 'frontend/src/app/api/weekly/pdf/route.tsx',
      relativePath: 'frontend/src/app/api/weekly/pdf/route.tsx',
      name: 'route.tsx',
      type: 'typescript' as const,
      size: 0,
      description: 'API endpoint สำหรับสร้างและส่งไฟล์ PDF รายงานรายสัปดาห์',
      functions: ['GET'],
      imports: ['React-PDF', 'weeklySnapshot'],
      usage: ['PDF generation API']
    }
  ];
  
  return modules;
}
