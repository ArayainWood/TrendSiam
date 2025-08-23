/**
 * System Architecture & Operations Manual - Main Document
 * 
 * Thai-language PDF manual for TrendSiam system
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import { registerPdfFonts } from '../pdfFonts.cli';
import { TitlePage } from './TitlePage';
import { TableOfContents } from './TableOfContents';
import { Architecture } from './Architecture';
import { DataFlow } from './DataFlow';
import { Security } from './Security';
import { Supabase } from './Supabase';
import { Operations } from './Operations';
import { Testing } from './Testing';
import { AppendixFiles } from './AppendixFiles';
import { AppendixAPIs } from './AppendixAPIs';

interface ManualDocProps {
  title?: string;
  date?: string;
  version?: string;
  fileInventory?: any[];
}

export function ManualDoc({ 
  title = 'คู่มือสถาปัตยกรรมและการปฏิบัติการระบบ TrendSiam',
  date = new Date().toLocaleDateString('th-TH'),
  version = '1.0',
  fileInventory = []
}: ManualDocProps) {
  // Register fonts before rendering
  registerPdfFonts();

  return (
    <Document
      title={title}
      author="TrendSiam Development Team"
      subject="System Architecture & Operations Manual"
      keywords="TrendSiam, Architecture, Operations, Manual, Thai"
      creator="TrendSiam PDF Generator"
      producer="React-PDF"
    >
      <TitlePage title={title} date={date} version={version} />
      <TableOfContents />
      <Architecture />
      <DataFlow />
      <Security />
      <Supabase />
      <Operations />
      <Testing />
      <AppendixFiles fileInventory={fileInventory} />
      <AppendixAPIs />
    </Document>
  );
}
