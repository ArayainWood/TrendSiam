"""
Advanced keyword extraction for multilingual content
"""
import re
import json
from typing import List, Dict, Set, Tuple, Optional
from collections import Counter, defaultdict


class KeywordExtractor:
    """Extract and rank keywords from multilingual content"""
    
    def __init__(self):
        # English stopwords
        self.en_stopwords = {
            'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when', 'where',
            'who', 'why', 'how', 'but', 'not', 'all', 'can', 'will', 'just', 'only',
            'video', 'official', 'watch', 'subscribe', 'like', 'share', 'comment', 'new',
            'full', 'hd', '4k', '1080p', 'lyrics', 'audio', 'youtube', 'channel'
        }
        
        # Thai stopwords
        self.th_stopwords = {
            'และ', 'หรือ', 'แต่', 'ที่', 'ใน', 'บน', 'กับ', 'ของ', 'เป็น', 'มี',
            'ได้', 'จะ', 'ให้', 'ไป', 'มา', 'เพลง', 'ทางการ', 'ดู', 'ชม', 'ฟัง',
            'ใหม่', 'ล่าสุด', 'วิดีโอ', 'คลิป', 'ช่อง'
        }
        
        # Japanese stopwords
        self.ja_stopwords = {
            'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
            'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や',
            '公式', '動画', '配信', '最新', '新曲', 'ビデオ', 'チャンネル'
        }
        
        # Boilerplate patterns to remove
        self.boilerplate = {
            'official mv', 'official music video', 'music video', 'short film',
            'full version', 'full mv', 'teaser', 'trailer', 'preview',
            'lyric video', 'dance practice', 'choreography', 'behind the scenes',
            'mv full', 'mv teaser', 'ost', 'soundtrack'
        }
        
        # Generic terms to penalize
        self.generic_terms = {
            'song', 'music', 'artist', 'singer', 'band', 'group', 'album', 'single',
            'release', 'performance', 'concert', 'live', 'cover', 'remix', 'version',
            'episode', 'part', 'chapter', 'series', 'show', 'program'
        }
        
        # Music pattern regexes
        self.feat_pattern = re.compile(r'\b(?:feat\.?|ft\.?|featuring|x)\s+([^,\(\)\[\]]+)', re.IGNORECASE)
        self.hashtag_pattern = re.compile(r'#(\w+)')
        
        # Character patterns for different languages
        self.thai_pattern = re.compile(r'[\u0E00-\u0E7F]+')
        self.japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+')
        self.korean_pattern = re.compile(r'[\uAC00-\uD7AF]+')
        self.latin_pattern = re.compile(r'[a-zA-Z]+')
    
    def extract_keywords(self, 
                        title: str, 
                        description: str = '',
                        channel: str = '',
                        category: str = '',
                        batch_tf_idf: Optional[Dict[str, float]] = None) -> List[str]:
        """
        Extract and rank keywords from video metadata
        
        Args:
            title: Video title
            description: Video description
            channel: Channel name
            category: Video category
            batch_tf_idf: TF-IDF scores for batch-level uniqueness
            
        Returns:
            List of top keywords (max 6)
        """
        # Collect all text sources
        sources = {
            'title': title or '',
            'description': description or '',
            'channel': channel or '',
            'category': category or ''
        }
        
        # Extract candidates from each source
        candidates = defaultdict(lambda: {'score': 0, 'sources': set(), 'original': ''})
        
        # Extract from title (highest weight)
        title_tokens = self._tokenize(sources['title'])
        for token in title_tokens:
            normalized = self._normalize(token)
            if self._is_valid_keyword(normalized):
                # Use lowercase for deduplication key but preserve original case
                key = normalized.lower()
                if key not in candidates or 'original' not in candidates[key]:
                    candidates[key]['original'] = token
                candidates[key]['score'] += 3
                candidates[key]['sources'].add('title')
        
        # Extract hashtags from title and description
        all_text = f"{sources['title']} {sources['description']}"
        hashtags = self.hashtag_pattern.findall(all_text)
        for tag in hashtags:
            normalized = self._normalize(tag)
            if self._is_valid_keyword(normalized):
                # Use lowercase for deduplication key but preserve original case
                key = normalized.lower()
                if key not in candidates:
                    candidates[key]['original'] = tag
                candidates[key]['score'] += 2
                candidates[key]['sources'].add('hashtag')
        
        # Extract from description
        desc_tokens = self._tokenize(sources['description'])
        for token in desc_tokens[:200]:  # Limit to first 200 tokens for performance
            normalized = self._normalize(token)
            if self._is_valid_keyword(normalized):
                key = normalized.lower()
                if key not in candidates:
                    candidates[key]['original'] = token
                    candidates[key]['score'] += 1
                    candidates[key]['sources'].add('description')
        
        # Extract featured artists
        featured = self._extract_featured_artists(all_text)
        for artist in featured:
            normalized = self._normalize(artist)
            if self._is_valid_keyword(normalized):
                key = normalized.lower()
                if key not in candidates:
                    candidates[key]['original'] = artist
                candidates[key]['score'] += 1
                candidates[key]['sources'].add('featured')
        
        # Boost channel name if it appears
        if sources['channel']:
            channel_normalized = self._normalize(sources['channel'])
            key = channel_normalized.lower()
            if key in candidates:
                candidates[key]['score'] += 1
                candidates[key]['sources'].add('channel')
        
        # Apply penalties for generic terms
        for term in candidates:
            if term in self.generic_terms:
                candidates[term]['score'] -= 1
        
        # Apply TF-IDF boost if provided
        if batch_tf_idf:
            for term in candidates:
                if term in batch_tf_idf:
                    # Penalize common terms in the batch
                    candidates[term]['score'] *= (1 - batch_tf_idf[term])
        
        # Sort by score and select top 6
        sorted_candidates = sorted(
            [(term, data) for term, data in candidates.items() if data['score'] > 0],
            key=lambda x: (-x[1]['score'], x[0])  # Sort by score desc, then alphabetically
        )
        
        # Return original forms of top keywords
        top_keywords = []
        seen_normalized = set()
        
        for normalized, data in sorted_candidates:
            if normalized.lower() not in seen_normalized:
                seen_normalized.add(normalized.lower())
                # Use original form with proper capitalization
                top_keywords.append(self._format_keyword(data['original']))
                if len(top_keywords) >= 6:
                    break
        
        return top_keywords
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for multiple languages"""
        if not text:
            return []
        
        tokens = []
        
        # Extract all character sequences by language
        # Thai tokens
        tokens.extend(self.thai_pattern.findall(text))
        
        # Japanese tokens (individual characters can be meaningful)
        japanese_matches = self.japanese_pattern.findall(text)
        tokens.extend(japanese_matches)
        
        # Korean tokens
        tokens.extend(self.korean_pattern.findall(text))
        
        # Latin tokens (split on non-word characters)
        latin_text = re.sub(r'[^\w\s]', ' ', text)
        latin_tokens = latin_text.split()
        tokens.extend(latin_tokens)
        
        # Also extract quoted phrases and parenthetical content as individual words
        quoted = re.findall(r'"([^"]+)"', text)
        for phrase in quoted:
            tokens.extend(phrase.split())
        
        parens = re.findall(r'\(([^)]+)\)', text)
        for phrase in parens:
            tokens.extend(phrase.split())
        
        return tokens
    
    def _normalize(self, token: str) -> str:
        """Normalize token while preserving language-specific features"""
        if not token:
            return ''
        
        # Start with the original token
        normalized = token.strip()
        
        # Don't normalize if it's a multi-word phrase that slipped through
        if ' ' in normalized and len(normalized.split()) > 3:
            # This shouldn't be a keyword, return empty to filter it out
            return ''
        
        # Remove specific boilerplate words if they're the entire token
        lower = normalized.lower()
        if lower in {'official', 'mv', 'music', 'video', 'full', 'version', 'hd', '4k', '1080p'}:
            return ''
        
        # Normalize music-specific patterns
        normalized = re.sub(r'^(?:feat\.?|ft\.?|featuring)$', 'feat', normalized, flags=re.IGNORECASE)
        
        # Remove extra whitespace
        normalized = ' '.join(normalized.split())
        
        return normalized
    
    def _is_valid_keyword(self, token: str) -> bool:
        """Check if token is a valid keyword"""
        if not token or len(token) < 2:
            return False
        
        # Check if it's just numbers or punctuation
        if token.isdigit() or not re.search(r'\w', token):
            return False
        
        lower = token.lower()
        
        # Check stopwords based on language
        if self._is_thai(token) and lower in self.th_stopwords:
            return False
        elif self._is_japanese(token) and token in self.ja_stopwords:
            return False
        elif self._is_latin(token) and lower in self.en_stopwords:
            return False
        
        # Filter out single letters (except for CJK)
        if len(token) == 1 and self._is_latin(token):
            return False
        
        return True
    
    def _extract_featured_artists(self, text: str) -> List[str]:
        """Extract featured artist names"""
        artists = []
        
        # Find all featuring patterns
        matches = self.feat_pattern.findall(text)
        for match in matches:
            # Clean up and split multiple artists
            artist_text = match.strip()
            # Split on common separators
            for separator in [',', '&', 'และ', 'と']:
                if separator in artist_text:
                    parts = artist_text.split(separator)
                    artists.extend([p.strip() for p in parts if p.strip()])
                    break
            else:
                artists.append(artist_text)
        
        return artists
    
    def _format_keyword(self, keyword: str) -> str:
        """Format keyword with proper capitalization"""
        if not keyword:
            return ''
        
        # For Latin text, use title case
        if self._is_latin(keyword):
            # Don't capitalize certain words
            exclude = {'and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'for'}
            words = keyword.split()
            formatted = []
            for i, word in enumerate(words):
                if i == 0 or word.lower() not in exclude:
                    formatted.append(word.capitalize())
                else:
                    formatted.append(word.lower())
            return ' '.join(formatted)
        
        # For other scripts, preserve original
        return keyword
    
    def _is_thai(self, text: str) -> bool:
        """Check if text contains Thai characters"""
        return bool(self.thai_pattern.search(text))
    
    def _is_japanese(self, text: str) -> bool:
        """Check if text contains Japanese characters"""
        return bool(self.japanese_pattern.search(text))
    
    def _is_latin(self, text: str) -> bool:
        """Check if text is primarily Latin characters"""
        return bool(self.latin_pattern.match(text))
    
    def compute_batch_tf_idf(self, documents: List[Dict[str, str]]) -> Dict[str, float]:
        """
        Compute TF-IDF scores for a batch of documents
        
        Args:
            documents: List of dicts with 'title' and 'description' keys
            
        Returns:
            Dict mapping terms to their IDF scores (0-1, higher = more common)
        """
        # Count document frequency
        doc_freq = Counter()
        total_docs = len(documents)
        
        for doc in documents:
            # Get unique terms in this document
            text = f"{doc.get('title', '')} {doc.get('description', '')}"
            tokens = set(self._tokenize(text))
            normalized_tokens = {self._normalize(t).lower() for t in tokens if self._is_valid_keyword(self._normalize(t))}
            
            for term in normalized_tokens:
                doc_freq[term] += 1
        
        # Calculate IDF scores (normalized to 0-1)
        idf_scores = {}
        for term, freq in doc_freq.items():
            if freq > 1:  # Only penalize terms that appear in multiple docs
                # Higher score = more common = more penalty
                idf_scores[term] = min(freq / total_docs, 0.8)  # Cap at 0.8 to avoid complete suppression
        
        return idf_scores
