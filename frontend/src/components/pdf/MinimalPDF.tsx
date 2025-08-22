import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    fontSize: 12,
    marginBottom: 10,
  },
});

interface MinimalPDFProps {
  title: string;
  itemCount: number;
}

const MinimalPDF: React.FC<MinimalPDFProps> = ({ title, itemCount }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>Generated: {new Date().toISOString()}</Text>
      <Text style={styles.text}>Items: {itemCount}</Text>
      <Text style={styles.text}>This is a minimal PDF test.</Text>
    </Page>
  </Document>
);

export default MinimalPDF;
